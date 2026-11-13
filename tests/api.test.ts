import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createApp } from '../src/server/app.js';
import { readConfig } from '../src/server/config.js';
import type { Workspace } from '../src/shared/types.js';

const jobInput={title:'验收岗位',department:'测试团队',location:'北京',employmentType:'实习',status:'open',description:'负责 TypeScript 项目开发和部署验证，并提供可检查的项目证据。',criteria:[{id:'ts',label:'TypeScript 项目实践',weight:60,required:true,keywords:['TypeScript']},{id:'deploy',label:'部署实践',weight:40,required:true,keywords:['Docker']}]};
const resume='虚构验收简历。\n使用 TypeScript 和 React 完成任务工作台，承担查询接口与表单功能。\n通过 Git 管理变更并编写需求文档，愿意在面试中提供项目代码与演示记录。';
async function fixture(env:NodeJS.ProcessEnv={},startWorker=true) {
  const directory=mkdtempSync(path.join(tmpdir(),'hire-api-'));
  const config=readConfig({DATA_DIR:directory,SEED_DEMO:'false',...env});config.webDir=path.join(directory,'none');
  const server=await createApp(config,{startWorker});
  const request=(method:'GET'|'POST'|'PUT'|'PATCH'|'DELETE',url:string,payload?:unknown,headers:Record<string,string>={})=>server.app.inject({method,url,payload:payload as any,headers:{host:'127.0.0.1:3000',...headers}});
  const close=async()=>{await server.app.close();rmSync(directory,{recursive:true,force:true});};
  return {...server,config,directory,request,close};
}
async function setup(f:Awaited<ReturnType<typeof fixture>>) {
  const jr=await f.request('POST','/api/jobs',jobInput);assert.equal(jr.statusCode,201,jr.body);const job=jr.json();
  const cr=await f.request('POST','/api/candidates',{name:'验收候选人',resumeText:resume});assert.equal(cr.statusCode,201,cr.body);const candidate=cr.json();
  const ar=await f.request('POST','/api/applications',{jobId:job.id,candidateId:candidate.id});assert.equal(ar.statusCode,201,ar.body);
  return {job,candidate,application:ar.json()};
}
async function waitForAnalysis(f:Awaited<ReturnType<typeof fixture>>) {
  for(let i=0;i<100;i++){const state=(await f.request('GET','/api/workspace')).json<Workspace>();if(state.analyses.length)return state.analyses[0];await new Promise(resolve=>setTimeout(resolve,10));}throw new Error('analysis timeout');
}
test('HTTP 工作流：岗位 → 简历 → 证据分析 → 复核 → 面试，并保留旧输入快照',async()=>{
  const f=await fixture();try {
    const {job,candidate,application}=await setup(f);
    const tr=await f.request('POST',`/api/applications/${application.id}/analyze`,{mode:'rules'});assert.equal(tr.statusCode,202,tr.body);
    const analysis=await waitForAnalysis(f);assert.equal(analysis.mode,'rules');assert.equal(analysis.result.coverage,60);
    assert.equal(analysis.result.assessments[1].status,'unknown');
    for(const assessment of analysis.result.assessments)for(const e of assessment.evidence)assert.equal(analysis.resumeSnapshot.resumeText.slice(e.start,e.end),e.quote);
    const changed=await f.request('PUT',`/api/jobs/${job.id}`,{...jobInput,title:'岗位新版本'});assert.equal(changed.json().version,2);
    const changedResume=await f.request('PUT',`/api/candidates/${candidate.id}`,{name:'验收候选人',resumeText:resume+'\n补充使用 Docker 完成容器部署。'});assert.equal(changedResume.json().resumeVersion,2);
    const exported=(await f.request('GET',`/api/analyses/${analysis.id}/export`)).json();assert.equal(exported.analysis.jobSnapshot.title,'验收岗位');assert.equal(exported.analysis.resumeSnapshot.resumeText,resume);
    const rr=await f.request('POST',`/api/applications/${application.id}/reviews`,{analysisId:analysis.id,reviewer:'验收工程师',decision:'advance',note:'项目证据已找到，面试核实部署经历。'});assert.equal(rr.statusCode,201,rr.body);
    const ir=await f.request('POST','/api/interviews',{applicationId:application.id,scheduledAt:'2026-12-01T02:00:00.000Z',interviewer:'面试官',location:'线上会议'});assert.equal(ir.statusCode,201,ir.body);
    const updated=await f.request('PUT',`/api/interviews/${ir.json().id}`,{scheduledAt:'2026-12-01T02:00:00.000Z',interviewer:'面试官',location:'线上会议',notes:'已核实 TypeScript 项目；部署经验需要继续培养。',outcome:'pass'});assert.equal(updated.statusCode,200,updated.body);
    const state=(await f.request('GET','/api/workspace')).json<Workspace>();assert.equal(state.applications[0].stage,'interview');assert.equal(state.reviews.length,1);assert.equal(state.interviews[0].outcome,'pass');assert.ok(state.audit.some(e=>e.action==='review.created'));
  } finally {await f.close();}
});
test('岗位权重和重复维度校验在服务端强制执行',async()=>{
  const f=await fixture();try {
    const invalid={...jobInput,criteria:[{...jobInput.criteria[0],weight:30}]};assert.equal((await f.request('POST','/api/jobs',invalid)).statusCode,400);
    const duplicate={...jobInput,criteria:jobInput.criteria.map(c=>({...c,id:'same'}))};assert.equal((await f.request('POST','/api/jobs',duplicate)).statusCode,400);
    assert.equal(f.store.jobs().length,0);
  }finally{await f.close();}
});
test('无模型配置和不可读简历不能生成伪成功分析',async()=>{
  const f=await fixture();try {
    const {application,candidate}=await setup(f);
    const noProvider=await f.request('POST',`/api/applications/${application.id}/analyze`,{mode:'llm'});assert.equal(noProvider.statusCode,422);assert.equal(noProvider.json().code,'MODEL_NOT_CONFIGURED');
    await f.request('PUT',`/api/candidates/${candidate.id}`,{name:'验收候选人',resumeText:''});
    const noText=await f.request('POST',`/api/applications/${application.id}/analyze`,{mode:'rules'});assert.equal(noText.statusCode,422);assert.equal(f.store.analyses().length,0);
  }finally{await f.close();}
});
test('关联岗位幂等；输入快照与任务重试保持原版本',async()=>{
  const f=await fixture({},false);try {
    const {application,job}=await setup(f);
    const same=await f.request('POST','/api/applications',{jobId:application.jobId,candidateId:application.candidateId});assert.equal(same.json().id,application.id);
    const task=(await f.request('POST',`/api/applications/${application.id}/analyze`,{mode:'rules'})).json();
    assert.equal((await f.request('POST',`/api/applications/${application.id}/analyze`,{mode:'rules'})).statusCode,409);
    f.store.startTask(task.id);f.store.failTask(task.id,'模拟进程中断恢复条件');
    await f.request('PUT',`/api/jobs/${job.id}`,{...jobInput,title:'新版本'});
    assert.equal((await f.request('POST',`/api/tasks/${task.id}/retry`)).statusCode,202);
    assert.equal(f.store.task(task.id).input.job.version,1);
  }finally{await f.close();}
});
test('SQLite 文件重启后保留数据，运行中任务被标记失败并可重试',async()=>{
  const f=await fixture({},false);let closed=false;try {
    const {application}=await setup(f);const task=(await f.request('POST',`/api/applications/${application.id}/analyze`,{mode:'rules'})).json();f.store.startTask(task.id);
    await f.app.close();closed=true;
    const second=await createApp(f.config);try {
      assert.equal(second.store.jobs().length,1);assert.equal(second.store.candidates().length,1);
      assert.equal(second.store.task(task.id).status,'failed');assert.match(second.store.task(task.id).error||'',/中断/);
    }finally{await second.app.close();}
  }finally{if(!closed)await f.app.close();rmSync(f.directory,{recursive:true,force:true});}
});
test('远程访问需要口令；登录Cookie和跨域写入边界有效',async()=>{
  assert.throws(()=>readConfig({HOST:'0.0.0.0'}),/APP_ACCESS_TOKEN/);
  const f=await fixture({APP_ACCESS_TOKEN:'test-only-long-access-token'});try {
    assert.equal((await f.request('GET','/api/workspace')).statusCode,401);
    assert.equal((await f.request('POST','/api/session',{token:'wrong'})).statusCode,401);
    const login=await f.request('POST','/api/session',{token:'test-only-long-access-token'});assert.equal(login.statusCode,200);
    const setCookie=String(login.headers['set-cookie']);assert.match(setCookie,/HttpOnly/i);const cookie=setCookie.split(';')[0];
    assert.equal((await f.request('GET','/api/workspace',undefined,{cookie})).statusCode,200);
    assert.equal((await f.request('POST','/api/jobs',jobInput,{cookie,origin:'https://untrusted.example'})).statusCode,403);
    assert.equal((await f.request('GET','/api/workspace',undefined,{host:'untrusted.example',cookie})).statusCode,421);
    assert.equal((await f.request('POST','/api/jobs',jobInput,{cookie,origin:'http://127.0.0.1:3000'})).statusCode,201);
  }finally{await f.close();}
});
test('业务导出包含历史资料但不包含访问凭据',async()=>{
  const secret='test-only-long-access-token';const f=await fixture({APP_ACCESS_TOKEN:secret});try {
    const response=await f.request('GET','/api/export',undefined,{authorization:`Bearer ${secret}`});assert.equal(response.statusCode,200);assert.equal(response.body.includes(secret),false);assert.ok(Array.isArray(response.json().jobVersions));
  }finally{await f.close();}
});
