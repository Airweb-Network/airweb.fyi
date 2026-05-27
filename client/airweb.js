#!/usr/bin/env node
// Airweb client — convenience wrapper around `ssh -R`.
//
//   airweb http <localPort> [--sub <name>] --server <host[:port]> --key <path>
//   airweb tcp  <localPort> [--remote <port>] --server <host[:port]> --key <path>
//
// Requires the OpenSSH client (`ssh`) to be installed and on PATH.

const { spawn, spawnSync } = require('child_process');

function parseArgs(argv) {
  const args = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) {
      const key = a.slice(2);
      const next = argv[i + 1];
      if (next === undefined || next.startsWith('--')) { args[key] = true; }
      else { args[key] = next; i++; }
    } else {
      args._.push(a);
    }
  }
  return args;
}

function help() {
  console.log(`Airweb client

Usage:
  airweb http <localPort> [--sub <name>] --server <host[:port]> --key <path>
  airweb tcp  <localPort> [--remote <port>] --server <host[:port]> --key <path>

Get your --key file:
  Visit https://airweb.fyi/dashboard, click "Create account", and save the
  downloaded '<domain>_<your account id>_key.txt' file
  (e.g. 'airweb.fyi_aw_abc1234567_key.txt'). Then:
      chmod 600 ./<domain>_<your account id>_key.txt    # macOS / Linux

Examples:
  airweb http 3000 --sub myapp --server airweb.fyi:2222 --key ./airweb.fyi_<your account id>_key.txt
      -> exposes https://myapp.airweb.fyi -> http://localhost:3000

  airweb tcp 5432 --server airweb.fyi:2222 --key ./airweb.fyi_<your account id>_key.txt
      -> server picks a random TCP port and forwards it to localhost:5432

Notes:
  * SSH must be installed (use 'ssh' from OpenSSH).
  * The SSH username doubles as your requested HTTP subdomain (for 'http' mode).
  * Anyone can use 'mysub.<publicDomain>'; lease a 'handle' on the dashboard
    to reserve a permanent name only you can publish under.
`);
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const mode = args._[0];
  const localPort = parseInt(args._[1], 10);

  if (!mode || !localPort || args.help) { help(); process.exit(mode ? 1 : 0); }
  if (!['http', 'tcp'].includes(mode)) { console.error(`Unknown mode: ${mode}`); help(); process.exit(1); }
  if (!args.server) { console.error('Missing --server <host[:port]>'); process.exit(1); }
  if (!args.key) { console.error('Missing --key <path>  (get one from https://<publicDomain>/dashboard)'); process.exit(1); }

  const probe = spawnSync(process.platform === 'win32' ? 'where' : 'which', ['ssh']);
  if (probe.status !== 0) {
    console.error('Could not find the `ssh` command. Install OpenSSH client first.');
    process.exit(1);
  }

  const [serverHost, serverPortRaw] = args.server.split(':');
  const serverPort = serverPortRaw ? parseInt(serverPortRaw, 10) : 2222;
  const user = args.user || args.sub || randomName();
  const remotePort = mode === 'http' ? 80 : (args.remote ? parseInt(args.remote, 10) : 0);

  const sshArgs = [
    '-i', args.key,
    '-p', String(serverPort),
    '-o', 'StrictHostKeyChecking=accept-new',
    '-o', 'ServerAliveInterval=30',
    '-o', 'ServerAliveCountMax=3',
    '-o', 'ExitOnForwardFailure=yes',
    '-o', 'IdentitiesOnly=yes',
    '-N',
    '-R', `${remotePort}:localhost:${localPort}`,
    `${user}@${serverHost}`,
  ];

  console.log(`\n  Airweb client`);
  console.log(`  -----------------`);
  console.log(`  local        : localhost:${localPort}`);
  console.log(`  server       : ${serverHost}:${serverPort}`);
  console.log(`  username/sub : ${user}`);
  console.log(`  key file     : ${args.key}`);
  if (mode === 'http') {
    console.log(`  public URL   : https://${user}.<your-public-domain>`);
  } else {
    console.log(`  public TCP   : ${serverHost}:${remotePort === 0 ? '<assigned>' : remotePort}`);
  }
  console.log(`\n  Running: ssh ${sshArgs.join(' ')}\n`);

  const child = spawn('ssh', sshArgs, { stdio: 'inherit' });
  child.on('exit', (code) => process.exit(code ?? 0));
}

function randomName() {
  const chars = 'abcdefghijkmnpqrstuvwxyz23456789';
  let s = '';
  for (let i = 0; i < 8; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return s;
}

main();
