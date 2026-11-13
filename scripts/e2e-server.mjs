import { mkdirSync,mkdtempSync,rmSync } from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
const root=path.resolve('.verification/e2e');mkdirSync(root,{recursive:true});
const data=mkdtempSync(path.join(root,'run-'));
const child=spawn(process.execPath,['dist/server/index.js'],{stdio:'inherit',env:{...process.env,HOST:'127.0.0.1',PORT:'3317',APP_ORIGIN:'http://127.0.0.1:3317',DATA_DIR:data,SEED_DEMO:'false',AI_MODE:'rules',APP_ACCESS_TOKEN:'',LLM_BASE_URL:'',LLM_API_KEY:'',LLM_MODEL:''}});
let cleaning=false;
function cleanup(){if(cleaning)return;cleaning=true;rmSync(data,{recursive:true,force:true});}
child.on('exit',code=>{cleanup();process.exitCode=code||0;});
child.on('error',error=>{console.error(error.message);cleanup();process.exitCode=1;});
process.on('SIGINT',()=>child.kill('SIGINT'));process.on('SIGTERM',()=>child.kill('SIGTERM'));
