import Fastify from 'fastify';
import cookie from '@fastify/cookie';
import multipart from '@fastify/multipart';
import staticFiles from '@fastify/static';
import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { z } from 'zod';
import type { AppConfig } from '../shared/types.js';
import type { ServerConfig } from './config.js';
import { Store } from './db.js';
import { AnalysisWorker } from './worker.js';
import { seedDemo } from './seed.js';
import { parseResume } from './parse.js';
import { draftJob } from './draft.js';
import { assessTextReadability } from '../vendor/harly/document.js';
import { AppError, jobSchema, candidateSchema, applicationSchema, stageSchema, analysisSchema, reviewSchema, interviewSchema, interviewUpdateSchema } from './validation.js';

const VERSION='0.1.0';
function equalSecret(a:string,b:string) { return timingSafeEqual(createHash('sha256').update(a).digest(),createHash('sha256').update(b).digest()); }
function textStatus(text:string) {
  const ready=assessTextReadability(text).readable;
  return {status:ready?'ready' as const:'needs_text' as const,message:ready?null:'文本过短、为空或不可读，请补充至少 50 字符的简历文字。扫描件暂未启用 OCR。'};
}
export async function createApp(config:ServerConfig, options:{databaseFile?:string;startWorker?:boolean}={}) {
  const app=Fastify({logger:false,bodyLimit:1024*1024,requestTimeout:90000});
  const store=new Store(options.databaseFile||path.join(config.dataDir,'workbench.sqlite'));
  if(config.seedDemo)seedDemo(store);
  const worker=new AnalysisWorker(store,config.provider);
  const sessions=new Map<string,number>();
  const failedLogins=new Map<string,{count:number;since:number}>();
  const allowedOrigins=new Set([config.origin,`http://127.0.0.1:${config.port}`,`http://localhost:${config.port}`]);
  if(config.dev){allowedOrigins.add('http://127.0.0.1:5173');allowedOrigins.add('http://localhost:5173');}
  const allowedHosts=new Set([...allowedOrigins].map(origin=>new URL(origin).host));
  const authorized=(req:{headers:{authorization?:string};cookies:Record<string,string|undefined>}) => {
    if(!config.accessToken)return true;
    const header=req.headers.authorization;
    if(header?.startsWith('Bearer ') && equalSecret(header.slice(7),config.accessToken))return true;
    const session=req.cookies.hire_session;if(!session)return false;
    const expires=sessions.get(session);if(!expires)return false;
    if(expires<Date.now()){sessions.delete(session);return false;}return true;
  };
  const publicConfig=(authenticated:boolean):AppConfig=>({version:VERSION,mode:config.mode,model:authenticated?config.provider?.model||null:null,modelConfigured:Boolean(config.provider),authenticated,authRequired:Boolean(config.accessToken),localOnly:['127.0.0.1','localhost','::1'].includes(config.host)});
  await app.register(cookie);
  await app.register(multipart,{limits:{fileSize:8*1024*1024,files:1,fields:8,parts:9}});
  app.addHook('onRequest',async(req,reply)=>{
    reply.header('X-Content-Type-Options','nosniff');
    reply.header('Referrer-Policy','same-origin');
    reply.header('X-Frame-Options','DENY');
    if(!allowedHosts.has(req.headers.host||''))throw new AppError(421,'访问地址与 APP_ORIGIN 不一致','INVALID_HOST');
    const pathname=req.url.split('?')[0];
    if(pathname.startsWith('/api/')) {
      reply.header('Cache-Control','no-store');
      const origin=req.headers.origin;
      if(!['GET','HEAD','OPTIONS'].includes(req.method) && origin && !allowedOrigins.has(origin))throw new AppError(403,'请求来源不受信任','INVALID_ORIGIN');
      if(!['/api/config','/api/health','/api/session'].includes(pathname) && !authorized(req))throw new AppError(401,'请先输入访问口令登录','UNAUTHORIZED');
    }
  });
  app.setErrorHandler((error,req,reply)=>{
    if(error instanceof z.ZodError)return reply.status(400).send({error:error.issues.map(issue=>issue.message).join('；'),code:'VALIDATION_ERROR'});
    if(error instanceof AppError)return reply.status(error.status).send({error:error.message,code:error.code});
    const e=error as {statusCode?:number;message?:string;name?:string};
    if(e.statusCode && e.statusCode>=400 && e.statusCode<500)return reply.status(e.statusCode).send({error:e.statusCode===413?'文件或请求过大（单文件最多 8 MB）':e.message,code:'REQUEST_ERROR'});
    // Do not log request bodies, resumes, keys or raw upstream model output.
    console.error('[request-failed]',req.method,req.routeOptions.url,e.name);
    return reply.status(500).send({error:'操作未完成，请检查服务日志或重试。',code:'INTERNAL_ERROR'});
  });
  app.get('/api/health',async()=>({ok:true,version:VERSION,database:store.db.prepare('SELECT 1').get()?'ready':'failed'}));
  app.get('/api/config',async req=>publicConfig(authorized(req)));
  app.post('/api/session',async(req,reply)=>{
    const {token}=z.object({token:z.string().max(1000)}).parse(req.body);
    const entry=failedLogins.get(req.ip);
    if(entry && entry.since>Date.now()-60000 && entry.count>=6)throw new AppError(429,'尝试过多，请一分钟后再试','RATE_LIMIT');
    if(config.accessToken&&!equalSecret(token,config.accessToken)) {
      const current=entry && entry.since>Date.now()-60000?entry:{count:0,since:Date.now()};current.count++;failedLogins.set(req.ip,current);
      throw new AppError(401,'访问口令不正确','UNAUTHORIZED');
    }
    failedLogins.delete(req.ip);
    for(const [key,expires] of sessions)if(expires<Date.now())sessions.delete(key);
    const tokenValue=randomBytes(32).toString('hex');sessions.set(tokenValue,Date.now()+8*60*60*1000);
    reply.setCookie('hire_session',tokenValue,{path:'/',httpOnly:true,sameSite:'strict',secure:config.origin.startsWith('https:'),maxAge:8*60*60});
    return {ok:true};
  });
  app.delete('/api/session',async(req,reply)=>{if(req.cookies.hire_session)sessions.delete(req.cookies.hire_session);reply.clearCookie('hire_session',{path:'/'});return {ok:true};});
  app.get('/api/workspace',async req=>store.workspace(publicConfig(authorized(req))));
  app.get('/api/audit',async()=>store.events());
  app.post('/api/jobs',async(req,reply)=>reply.status(201).send(store.createJob(jobSchema.parse(req.body))));
  app.post('/api/jobs/draft',async req=>{
    const {requirements}=z.object({requirements:z.string().trim().min(10).max(12000)}).strict().parse(req.body);
    try {return await draftJob(requirements,config.provider);}catch(error){throw new AppError(422,error instanceof Error?error.message:'岗位草稿生成失败','DRAFT_FAILED');}
  });
  app.put<{Params:{id:string}}>('/api/jobs/:id',async req=>store.updateJob(req.params.id,jobSchema.parse(req.body)));
  app.get<{Params:{id:string}}>('/api/jobs/:id/versions',async req=>{store.job(req.params.id);return store.versions('job',req.params.id);});
  app.post('/api/candidates',async(req,reply)=>{const input=candidateSchema.parse(req.body);return reply.status(201).send(store.createCandidate(input,textStatus(input.resumeText)));});
  app.put<{Params:{id:string}}>('/api/candidates/:id',async req=>{const input=candidateSchema.parse(req.body);return store.updateCandidate(req.params.id,input,textStatus(input.resumeText));});
  app.get<{Params:{id:string}}>('/api/candidates/:id/versions',async req=>{store.candidate(req.params.id);return store.versions('resume',req.params.id);});
  app.post('/api/candidates/upload',async(req,reply)=>{
    let bytes:Buffer|undefined,filename='',name='';
    for await(const part of req.parts()) {
      if(part.type==='file'){filename=path.basename(part.filename).slice(0,200);bytes=await part.toBuffer();}
      else if(part.fieldname==='name')name=String(part.value).trim().slice(0,100);
    }
    if(!bytes||!filename)throw new AppError(400,'请选择一个 PDF、DOCX 或 TXT 文件');
    let parsed:Awaited<ReturnType<typeof parseResume>>;
    try {parsed=await parseResume(bytes,filename);}catch(error){throw new AppError(422,error instanceof Error?error.message:'文件解析失败','PARSE_FAILED');}
    const input=candidateSchema.parse({name:name||filename.replace(/\.[^.]+$/,'').slice(0,100),resumeText:parsed.text,email:'',phone:'',headline:'',tags:[]});
    const candidate=store.createCandidate(input,{...parsed,sourceFile:filename});
    return reply.status(201).send(candidate);
  });
  app.post('/api/applications',async(req,reply)=>{const input=applicationSchema.parse(req.body);return reply.status(201).send(store.createApplication(input.jobId,input.candidateId));});
  app.patch<{Params:{id:string}}>('/api/applications/:id',async req=>store.setStage(req.params.id,stageSchema.parse(req.body).stage));
  app.post<{Params:{id:string}}>('/api/applications/:id/analyze',async(req,reply)=>{
    const {mode}=analysisSchema.parse(req.body??{});
    if(mode==='llm'&&!config.provider)throw new AppError(422,'尚未配置真实模型，请设置 LLM_BASE_URL、LLM_API_KEY、LLM_MODEL 后重启服务','MODEL_NOT_CONFIGURED');
    const task=store.createTask(req.params.id,mode);if(options.startWorker!==false)worker.wake();return reply.status(202).send(task);
  });
  app.post<{Params:{id:string}}>('/api/tasks/:id/retry',async(req,reply)=>{const task=store.retryTask(req.params.id);if(options.startWorker!==false)worker.wake();return reply.status(202).send(task);});
  app.post<{Params:{id:string}}>('/api/applications/:id/reviews',async(req,reply)=>reply.status(201).send(store.createReview(req.params.id,reviewSchema.parse(req.body))));
  app.post('/api/interviews',async(req,reply)=>reply.status(201).send(store.createInterview(interviewSchema.parse(req.body))));
  app.put<{Params:{id:string}}>('/api/interviews/:id',async req=>store.updateInterview(req.params.id,interviewUpdateSchema.parse(req.body)));
  app.get<{Params:{id:string}}>('/api/analyses/:id/export',async(req,reply)=>{
    const analysis=store.analysis(req.params.id);
    reply.header('Content-Disposition',`attachment; filename="analysis-${analysis.id}.json"`);
    return {schemaVersion:1,exportedAt:new Date().toISOString(),analysis,reviews:store.reviews().filter(review=>review.analysisId===analysis.id)};
  });
  app.get('/api/export',async(req,reply)=>{
    reply.header('Content-Disposition','attachment; filename="hire-workbench-export.json"');
    return {schemaVersion:1,exportedAt:new Date().toISOString(),...store.workspace(publicConfig(authorized(req))),jobVersions:store.jobs().flatMap(j=>store.versions('job',j.id)),resumeVersions:store.candidates().flatMap(c=>store.versions('resume',c.id))};
  });
  if(existsSync(path.join(config.webDir,'index.html'))) {
    await app.register(staticFiles,{root:config.webDir,prefix:'/',index:'index.html'});
  }
  app.setNotFoundHandler((req,reply)=>{
    if(req.url.startsWith('/api/'))return reply.status(404).send({error:'接口不存在',code:'NOT_FOUND'});
    if(existsSync(path.join(config.webDir,'index.html')))return reply.sendFile('index.html');
    return reply.status(503).type('text/plain; charset=utf-8').send('前端尚未构建，请运行 npm run build；开发模式请访问 http://127.0.0.1:5173');
  });
  app.addHook('onClose',async()=>{await worker.stop();store.close();});
  if(options.startWorker!==false)worker.start();
  return {app,store,worker};
}
