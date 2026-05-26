// Validates a user-supplied sudo username + password by attempting an
// outbound SSH login through one of the user's already-published TCP tunnels.
//
// The user must have a TCP tunnel that exposes their SSH daemon (e.g.
//   `ssh -p 2222 -R 22:localhost:22 mysub@airweb.fyi`
// ). The validator connects to the public host:port of that tunnel, performs
// an SSH banner check, then attempts password auth. Credentials are never
// persisted.

const net = require('net');
const { Client } = require('ssh2');

const BANNER_TIMEOUT_MS = 4000;
const AUTH_TIMEOUT_MS   = 8000;

function parseTcpUrl(publicUrl) {
  // expected: "tcp://host:port"
  const m = /^tcp:\/\/([^:/]+):(\d+)$/i.exec(publicUrl || '');
  if (!m) return null;
  return { host: m[1], port: Number(m[2]) };
}

function checkSshBanner(host, port) {
  return new Promise((resolve, reject) => {
    const sock = net.createConnection({ host, port });
    let buf = Buffer.alloc(0);
    const done = (err, ok) => {
      try { sock.destroy(); } catch {}
      if (err) reject(err); else resolve(ok);
    };
    const to = setTimeout(() => done(new Error('banner_timeout')), BANNER_TIMEOUT_MS);
    sock.on('error', (e) => { clearTimeout(to); done(e); });
    sock.on('data', (chunk) => {
      buf = Buffer.concat([buf, chunk]);
      const head = buf.slice(0, 4).toString('ascii');
      if (head.length >= 4) {
        clearTimeout(to);
        if (head === 'SSH-') return done(null, true);
        return done(new Error('not_ssh'));
      }
    });
  });
}

function attemptPasswordAuth(host, port, username, password) {
  return new Promise((resolve, reject) => {
    const c = new Client();
    const to = setTimeout(() => {
      try { c.end(); } catch {}
      reject(new Error('auth_timeout'));
    }, AUTH_TIMEOUT_MS);

    c.on('ready', async () => {
      let id = null;
      let hardware = null;
      try { id       = await execCollect(c, 'id'); } catch {}
      try { hardware = parseProbe(await execCollect(c, 'bash -s', HARDWARE_PROBE)); } catch {}
      clearTimeout(to);
      c.end();
      resolve({ ok: true, id: id ? id.trim() || null : null, hardware });
    });
    c.on('error', (e) => {
      clearTimeout(to);
      reject(e);
    });

    c.connect({
      host, port, username, password,
      readyTimeout: AUTH_TIMEOUT_MS,
      tryKeyboard: false,
      algorithms: undefined,
    });
  });
}

// Run `command` over an exec channel; optionally feed `stdin` then close.
// Resolves to combined stdout (utf8). Rejects on channel errors.
function execCollect(client, command, stdin) {
  return new Promise((resolve, reject) => {
    client.exec(command, (err, stream) => {
      if (err) return reject(err);
      let out = '';
      stream.on('data', (d) => { out += d.toString('utf8'); });
      stream.stderr.on('data', () => {});
      stream.on('close', () => resolve(out));
      stream.on('error', reject);
      if (stdin != null) {
        stream.write(stdin);
        stream.end();
      }
    });
  });
}

// Portable POSIX-ish probe. Run via `bash -s` so we can pipe this in as stdin
// and avoid quoting hell. Outputs `key=value` lines that parseProbe consumes.
const HARDWARE_PROBE = `
LC_ALL=C
CPU=$(grep -m1 "model name" /proc/cpuinfo 2>/dev/null | cut -d: -f2- | sed 's/^ *//')
[ -z "$CPU" ] && CPU=$(sysctl -n machdep.cpu.brand_string 2>/dev/null)
CORES=$(nproc 2>/dev/null || sysctl -n hw.ncpu 2>/dev/null)
RAM_KB=$(awk '/^MemTotal/ {print $2}' /proc/meminfo 2>/dev/null)
RAM=
[ -n "$RAM_KB" ] && RAM=$(( RAM_KB / 1024 / 1024 ))
[ -z "$RAM" ] && RAM=$(sysctl -n hw.memsize 2>/dev/null | awk '{printf "%d", $1/1024/1024/1024}')
DISK=$(df -P / 2>/dev/null | awk 'NR==2{printf "%d", $2/1024/1024}')
ARCH=$(uname -m 2>/dev/null)
KERNEL=$(uname -sr 2>/dev/null)
if [ -f /etc/os-release ]; then
  . /etc/os-release
  OS="$PRETTY_NAME"
else
  OS="$KERNEL"
fi
printf 'cpu_model=%s\n' "$CPU"
printf 'cpu_cores=%s\n' "$CORES"
printf 'ram_gb=%s\n' "$RAM"
printf 'disk_gb=%s\n' "$DISK"
printf 'os=%s\n' "$OS"
printf 'arch=%s\n' "$ARCH"
printf 'kernel=%s\n' "$KERNEL"
`;

function parseProbe(text) {
  if (!text) return null;
  const out = {};
  for (const raw of String(text).split(/\r?\n/)) {
    const i = raw.indexOf('=');
    if (i <= 0) continue;
    const k = raw.slice(0, i).trim();
    const v = raw.slice(i + 1).trim();
    if (!v) continue;
    out[k] = v;
  }
  const toInt = (s) => {
    const n = parseInt(s, 10);
    return Number.isFinite(n) && n > 0 ? n : null;
  };
  return {
    cpuModel: out.cpu_model || null,
    cpuCores: toInt(out.cpu_cores),
    ramGb:    toInt(out.ram_gb),
    diskGb:   toInt(out.disk_gb),
    os:       out.os || null,
    arch:     out.arch || null,
    kernel:   out.kernel || null,
  };
}

/**
 * Validate `username`/`password` against the SSH daemon reachable via the
 * tunnel `tunnel`. Resolves on success; throws an Error with a stable .code
 * on failure.
 */
async function validateTunnelSudo(tunnel, username, password) {
  if (!tunnel) {
    const e = new Error('tunnel_not_found'); e.code = 'NO_TUNNEL'; throw e;
  }
  if (tunnel.type !== 'tcp') {
    const e = new Error('listing_requires_tcp_ssh_tunnel'); e.code = 'NOT_TCP'; throw e;
  }
  const target = parseTcpUrl(tunnel.publicUrl);
  if (!target) {
    const e = new Error('tunnel_url_unparseable'); e.code = 'BAD_URL'; throw e;
  }
  try {
    await checkSshBanner(target.host, target.port);
  } catch (err) {
    const e = new Error('ssh_banner_check_failed: ' + err.message);
    e.code = 'NO_SSH_BANNER';
    throw e;
  }
  try {
    const result = await attemptPasswordAuth(target.host, target.port, username, password);
    return {
      ok: true,
      host: target.host,
      port: target.port,
      id: result.id,
      hardware: result.hardware || null,
    };
  } catch (err) {
    const e = new Error('ssh_auth_failed: ' + err.message);
    e.code = 'AUTH_FAILED';
    throw e;
  }
}

module.exports = { validateTunnelSudo };
