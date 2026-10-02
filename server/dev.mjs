import { spawn } from 'node:child_process';
const children = [spawn(process.execPath,['server/index.mjs'],{stdio:'inherit'}),spawn(process.execPath,['node_modules/vite/bin/vite.js'],{stdio:'inherit'})];
const stop=()=>children.forEach(c=>c.kill());
process.on('SIGINT',stop);process.on('SIGTERM',stop);
children.forEach(c=>c.on('exit',code=>{stop();process.exitCode=code || 0;}));
