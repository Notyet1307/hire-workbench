import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync, appendFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
const directory='evidence/latest';mkdirSync(directory,{recursive:true});
const output=`${directory}/verify.log`;writeFileSync(output,'');
const commands=['typecheck','test','build','e2e'];const runs=[];
let revision='uncommitted';try{revision=execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim();}catch{}
const startedAt=new Date().toISOString();
for(const script of commands){
  const started=Date.now();appendFileSync(output,`\n## npm run ${script}\n`);console.log(`\nChecking ${script}…`);
  const code=await new Promise(resolve=>{
    const child=spawn(process.platform==='win32'?'npm.cmd':'npm',['run',script],{env:process.env,shell:process.platform==='win32'});
    child.stdout.on('data',chunk=>{process.stdout.write(chunk);appendFileSync(output,chunk);});
    child.stderr.on('data',chunk=>{process.stderr.write(chunk);appendFileSync(output,chunk);});
    child.on('error',error=>{appendFileSync(output,error.message);resolve(1);});child.on('exit',code=>resolve(code??1));
  });
  runs.push({command:`npm run ${script}`,status:code===0?'PASS':'FAIL',exitCode:code,durationMs:Date.now()-started});
  if(code!==0){process.exitCode=1;break;}
}
const summary={status:runs.length===commands.length&&runs.every(r=>r.status==='PASS')?'PASS':'FAIL',startedAt,finishedAt:new Date().toISOString(),revision,node:process.version,platform:process.platform,tests:runs,liveModel:'NOT_RUN: no real provider credentials',targetMacMini:'NOT_RUN: verified in Linux development environment',independentCrossModelAudit:'NOT_RUN: model routing not available in this delivery'};
writeFileSync(`${directory}/summary.json`,JSON.stringify(summary,null,2)+'\n');console.log(JSON.stringify(summary,null,2));
