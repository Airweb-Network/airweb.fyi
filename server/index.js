// Entry point — boots the SSH server, the public HTTP router, and the credit ticker.
require('./db');                       // initialise schema before any module that prepares statements
const credits = require('./credits');
const ssh = require('./sshServer');
const http = require('./httpRouter');

console.log('Starting AirWeb server…');
ssh.start();
http.start();
credits.start();

process.on('SIGINT', () => { console.log('\nShutting down.'); process.exit(0); });
process.on('uncaughtException', (e) => console.error('uncaughtException:', e));
process.on('unhandledRejection', (e) => console.error('unhandledRejection:', e));
