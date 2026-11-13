import { spawn } from 'node:child_process';
const command=process.platform==='win32'?'npm.cmd':'npm';
const children=['dev:server','dev:web'].map(script=>spawn(command,['run',script],{stdio:'inherit',env:{...process.env,DEV_MODE:'1'},shell:process.platform==='win32'}));
let stopping=false;
function stop(code=0){if(stopping)return;stopping=true;for(const child of children)child.kill('SIGTERM');process.exitCode=code;}
children.forEach(child=>child.on('exit',code=>stop(code||0)));
process.on('SIGINT',()=>stop());process.on('SIGTERM',()=>stop());
