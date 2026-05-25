// SSH server that accepts reverse port-forwarding (`ssh -R`) from clients.
//
// When a client runs:
//   ssh -p 2222 -R 80:localhost:3000 <subdomain>@tunnel.example.com
//
// 1. We authenticate (token-as-password or pubkey).
// 2. We accept the `tcpip-forward` global request.
// 3. We register a tunnel keyed by the SSH username (used as desired subdomain).
// 4. Incoming HTTP requests get routed to that tunnel — we open a `forwarded-tcpip`
//    channel back to the client, which proxies bytes to their local server.
//
// Special bind_port handling (matches OpenSSH convention):
//   - bind_port == 80   -> HTTP tunnel via the shared HTTP router (subdomain routing)
//   - bind_port == 0    -> allocate a random TCP port from the configured range
//   - other ports       -> bind a dedicated TCP listener (if not reserved)

const fs = require('fs');
const path = require('path');
const net = require('net');
const ssh2 = require('ssh2');
const config = require('./config');
const registry = require('./registry');
const accounts = require('./accounts');
const marketplace = require('./marketplace');

const HTTP_BIND_PORT = 80;

const AUTH_METHODS = ['publickey'];

function checkPubkey(ctx) {
  const acct = accounts.verifySshAuth(ctx);
  if (acct) return { ok: true, address: acct.address };
  return { ok: false };
}

function ensureHostKey(p) {
  if (fs.existsSync(p)) return;
  fs.mkdirSync(path.dirname(p), { recursive: true });
  const { private: priv, public: pub } = ssh2.utils.generateKeyPairSync('ed25519');
  fs.writeFileSync(p, priv, { mode: 0o600 });
  fs.writeFileSync(p + '.pub', pub);
  console.log(`[ssh] generated host key at ${p}`);
}

function start() {
  ensureHostKey(config.ssh.hostKeyPath);
  const hostKey = fs.readFileSync(config.ssh.hostKeyPath);

  const server = new ssh2.Server({
    hostKeys: [hostKey],
    banner: 'AirWeb — reverse SSH tunneling service\r\n',
  }, (client, info) => {
    const remoteAddr = `${info.ip}:${info.port}`;
    let username = null;
    let ownerAddress = null;   // account address, if authenticated via account pubkey
    const ownedTunnels = new Set();

    client.on('authentication', (ctx) => {
      username = (ctx.username || '').toLowerCase();
      if (!/^[a-z0-9-]{1,40}$/.test(username)) {
        return ctx.reject(AUTH_METHODS, false);
      }

      if (ctx.method !== 'publickey') return ctx.reject(AUTH_METHODS);
      const r = checkPubkey(ctx);
      if (!r.ok) return ctx.reject(AUTH_METHODS);
      if (r.address) ownerAddress = r.address;
      return ctx.accept();
    });

    client.on('ready', () => {
      console.log(`[ssh] ${remoteAddr} authed user="${username}" account=${ownerAddress || '(none)'}`);

      client.on('request', (accept, reject, name, info) => {
        if (name !== 'tcpip-forward') {
          return reject && reject();
        }
        handleForwardRequest(client, username, ownerAddress, remoteAddr, info, ownedTunnels, accept, reject);
      });

      // We don't run shells, but politely handle session opens so clients aren't surprised.
      client.on('session', (acceptSess) => {
        const session = acceptSess();
        session.on('pty', (a) => a && a());
        session.on('shell', (a) => {
          const stream = a && a();
          if (!stream) return;
          stream.write('AirWeb server — interactive shell is disabled.\r\n');
          stream.write('Your tunnels are active as long as this SSH connection stays open.\r\n');
          if (ownerAddress) stream.write(`Account: ${ownerAddress}\r\n`);
        });
        session.on('exec', (a, _r, info) => {
          const stream = a && a();
          if (!stream) return;
          stream.stderr.write(`Exec not supported: ${info.command}\r\n`);
          stream.exit(1);
          stream.end();
        });
      });
    });

    client.on('close', () => {
      for (const t of ownedTunnels) {
        console.log(`[ssh] closing tunnel ${t.publicUrl || t.subdomain || t.bindPort}`);
        try { t.close && t.close(); } catch {}
        registry.unregister(t);
      }
      ownedTunnels.clear();
    });

    client.on('error', (err) => {
      console.error(`[ssh] client error from ${remoteAddr}:`, err.message);
    });
  });

  server.listen(config.ssh.port, config.ssh.host, () => {
    console.log(`[ssh] listening on ${config.ssh.host}:${config.ssh.port}`);
  });

  return server;
}

function handleForwardRequest(client, username, ownerAddress, remoteAddr, info, ownedTunnels, accept, reject) {
  const { bindAddr, bindPort } = info;

  const openChannel = (srcIp, srcPort) => new Promise((resolve, reject2) => {
    client.forwardOut(bindAddr, info.boundPort || bindPort, srcIp, srcPort, (err, ch) => {
      if (err) return reject2(err);
      resolve(ch);
    });
  });

  // Case 1: HTTP tunnel — bind_port 80 means "expose me via the HTTP router"
  if (bindPort === HTTP_BIND_PORT) {
    // If the requested subdomain is a reserved handle, only its owner may use it.
    const handleOwner = marketplace.getHandleOwner(username);
    if (handleOwner && handleOwner !== ownerAddress) {
      console.warn(`[tunnel] denied handle "${username}" to ${ownerAddress || '(anon)'} (owner ${handleOwner})`);
      return reject && reject();
    }
    if ((config.limits.reservedSubdomains || []).includes(username)) {
      console.warn(`[tunnel] reserved subdomain "${username}" rejected`);
      return reject && reject();
    }

    // Owner-owned handle gets exact subdomain; everyone else gets unique-ified.
    const subdomain = handleOwner === ownerAddress && ownerAddress
      ? username
      : registry.uniqueSubdomain(username);
    const scheme = config.http.publicScheme || 'http';
    const publicUrl = `${scheme}://${subdomain}.${config.http.publicDomain}`;
    const tunnel = registry.register({
      type: 'http',
      subdomain,
      username,
      ownerAddress,
      remoteAddr,
      bindAddr,
      bindPort,
      publicUrl,
      openChannel,
      close: () => {},
      disconnect: () => { try { client.end(); } catch {} },
    });
    ownedTunnels.add(tunnel);
    console.log(`[tunnel] HTTP  ${tunnel.publicUrl}  -> client ${remoteAddr} (account ${ownerAddress || '(none)'})`);
    accept(bindPort);
    return;
  }

  // Case 2: Raw TCP — allocate or use requested port
  let port = bindPort;
  const [lo, hi] = config.limits.tcpPortRange;

  if (port === 0) {
    port = pickRandomPort(lo, hi);
  } else if (config.limits.reservedPorts.includes(port)) {
    console.warn(`[tunnel] rejecting reserved port ${port} requested by ${remoteAddr}`);
    return reject && reject();
  }

  const listener = net.createServer((socket) => {
    const srcIp = socket.remoteAddress || '0.0.0.0';
    const srcPort = socket.remotePort || 0;
    openChannel(srcIp, srcPort)
      .then((ch) => {
        socket.pipe(ch).pipe(socket);
        socket.on('error', () => ch.end());
        ch.on('error', () => socket.end());
      })
      .catch(() => socket.destroy());
  });

  listener.on('error', (err) => {
    console.error(`[tunnel] tcp listen :${port} failed:`, err.message);
    try { reject && reject(); } catch {}
  });

  listener.listen(port, bindAddr || '0.0.0.0', () => {
    const actualPort = listener.address().port;
    const publicUrl = `tcp://${config.http.publicDomain.split(':')[0]}:${actualPort}`;
    const tunnel = registry.register({
      type: 'tcp',
      username,
      ownerAddress,
      remoteAddr,
      bindAddr,
      bindPort: actualPort,
      publicUrl,
      openChannel,
      close: () => listener.close(),
      disconnect: () => { try { listener.close(); } catch {}; try { client.end(); } catch {} },
    });
    ownedTunnels.add(tunnel);
    console.log(`[tunnel] TCP   ${tunnel.publicUrl}  -> client ${remoteAddr}`);
    accept(actualPort);
  });
}

function pickRandomPort(lo, hi) {
  return Math.floor(Math.random() * (hi - lo + 1)) + lo;
}

module.exports = { start };
