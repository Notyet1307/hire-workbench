import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import type { Job, Candidate, Application, Analysis, AnalysisTask, Review, Interview, AuditEvent, AnalysisMode, Stage, EvaluationInput, EvaluationResult, Workspace, AppConfig } from '../shared/types.js';
import { AppError } from './validation.js';

type EditableJob = Omit<Job, 'id'|'version'|'createdAt'|'updatedAt'>;
type EditableCandidate = Pick<Candidate,'name'|'email'|'phone'|'headline'|'tags'|'resumeText'>;
export interface TaskRecord extends AnalysisTask { input: EvaluationInput }
const now = () => new Date().toISOString();

/** A single-process SQLite store. Snapshots and evaluations are append-only. */
export class Store {
  readonly db: DatabaseSync;
  constructor(filename: string) {
    if (filename !== ':memory:') mkdirSync(path.dirname(filename), {recursive:true});
    this.db = new DatabaseSync(filename);
    this.db.exec(`PRAGMA foreign_keys=ON; PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000;
      CREATE TABLE IF NOT EXISTS schema_meta(version INTEGER NOT NULL);
      INSERT INTO schema_meta SELECT 1 WHERE NOT EXISTS(SELECT 1 FROM schema_meta);
      CREATE TABLE IF NOT EXISTS jobs(id TEXT PRIMARY KEY, data TEXT NOT NULL CHECK(json_valid(data)));
      CREATE TABLE IF NOT EXISTS job_versions(job_id TEXT NOT NULL REFERENCES jobs(id), version INTEGER NOT NULL, data TEXT NOT NULL, PRIMARY KEY(job_id,version));
      CREATE TABLE IF NOT EXISTS candidates(id TEXT PRIMARY KEY, data TEXT NOT NULL CHECK(json_valid(data)));
      CREATE TABLE IF NOT EXISTS resume_versions(candidate_id TEXT NOT NULL REFERENCES candidates(id), version INTEGER NOT NULL, data TEXT NOT NULL, PRIMARY KEY(candidate_id,version));
      CREATE TABLE IF NOT EXISTS applications(id TEXT PRIMARY KEY,job_id TEXT NOT NULL REFERENCES jobs(id),candidate_id TEXT NOT NULL REFERENCES candidates(id),data TEXT NOT NULL,UNIQUE(job_id,candidate_id));
      CREATE TABLE IF NOT EXISTS tasks(id TEXT PRIMARY KEY,application_id TEXT NOT NULL REFERENCES applications(id),data TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS analyses(id TEXT PRIMARY KEY,application_id TEXT NOT NULL REFERENCES applications(id),task_id TEXT NOT NULL UNIQUE REFERENCES tasks(id),data TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS reviews(id TEXT PRIMARY KEY,application_id TEXT NOT NULL REFERENCES applications(id),analysis_id TEXT REFERENCES analyses(id),data TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS interviews(id TEXT PRIMARY KEY,application_id TEXT NOT NULL REFERENCES applications(id),data TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS audit_events(id TEXT PRIMARY KEY,data TEXT NOT NULL);
      CREATE INDEX IF NOT EXISTS tasks_application_idx ON tasks(application_id);
      CREATE INDEX IF NOT EXISTS analyses_application_idx ON analyses(application_id);
    `);
    const version = this.db.prepare('SELECT version FROM schema_meta').get() as {version:number};
    if (version.version !== 1) throw new Error('数据库版本不受支持，请使用匹配的软件版本');
  }
  close() { this.db.close(); }
  private tx<T>(fn: () => T): T {
    this.db.exec('BEGIN IMMEDIATE');
    try { const result = fn(); this.db.exec('COMMIT'); return result; }
    catch(error) { this.db.exec('ROLLBACK'); throw error; }
  }
  private all<T>(table: string): T[] {
    return (this.db.prepare(`SELECT data FROM ${table} ORDER BY rowid DESC`).all() as {data:string}[]).map(row => JSON.parse(row.data) as T);
  }
  private one<T>(table:string,id:string):T {
    const row = this.db.prepare(`SELECT data FROM ${table} WHERE id=?`).get(id) as {data:string}|undefined;
    if (!row) throw new AppError(404,'记录不存在','NOT_FOUND');
    return JSON.parse(row.data) as T;
  }
  private update<T extends {id:string}>(table:string, value:T) { this.db.prepare(`UPDATE ${table} SET data=? WHERE id=?`).run(JSON.stringify(value),value.id); }
  private audit(action:string,entityId:string,detail:string) {
    const event:AuditEvent = {id:randomUUID(),action,entityId,detail,createdAt:now()};
    this.db.prepare('INSERT INTO audit_events(id,data) VALUES(?,?)').run(event.id,JSON.stringify(event));
  }
  jobs() { return this.all<Job>('jobs'); }
  candidates() { return this.all<Candidate>('candidates'); }
  applications() { return this.all<Application>('applications'); }
  analyses() { return this.all<Analysis>('analyses'); }
  reviews() { return this.all<Review>('reviews'); }
  interviews() { return this.all<Interview>('interviews'); }
  events() { return this.all<AuditEvent>('audit_events').slice(0,200); }
  tasks():AnalysisTask[] { return this.all<TaskRecord>('tasks').map(({input:_input,...task}) => task); }
  job(id:string) { return this.one<Job>('jobs',id); }
  candidate(id:string) { return this.one<Candidate>('candidates',id); }
  application(id:string) { return this.one<Application>('applications',id); }
  analysis(id:string) { return this.one<Analysis>('analyses',id); }
  task(id:string) { return this.one<TaskRecord>('tasks',id); }
  workspace(config:AppConfig):Workspace {
    return {jobs:this.jobs(),candidates:this.candidates(),applications:this.applications(),analyses:this.analyses(),tasks:this.tasks(),reviews:this.reviews(),interviews:this.interviews(),audit:this.events(),config};
  }
  createJob(input:EditableJob) {
    const t=now(); const job:Job={...input,id:randomUUID(),version:1,createdAt:t,updatedAt:t};
    return this.tx(() => {
      this.db.prepare('INSERT INTO jobs(id,data) VALUES(?,?)').run(job.id,JSON.stringify(job));
      this.db.prepare('INSERT INTO job_versions(job_id,version,data) VALUES(?,?,?)').run(job.id,1,JSON.stringify(job));
      this.audit('job.created',job.id,`创建岗位「${job.title}」v1`); return job;
    });
  }
  updateJob(id:string,input:EditableJob) {
    return this.tx(() => {
      const previous=this.job(id); const job:Job={...previous,...input,version:previous.version+1,updatedAt:now()};
      this.update('jobs',job);
      this.db.prepare('INSERT INTO job_versions(job_id,version,data) VALUES(?,?,?)').run(job.id,job.version,JSON.stringify(job));
      this.audit('job.updated',id,`保存岗位「${job.title}」v${job.version}；既有分析仍保留旧快照`);return job;
    });
  }
  createCandidate(input:EditableCandidate, parsing:{status:'ready'|'needs_text';message:string|null;sourceFile?:string|null}) {
    const t=now(); const c:Candidate={...input,id:randomUUID(),resumeVersion:1,sourceFile:parsing.sourceFile||null,parseStatus:parsing.status,parseMessage:parsing.message,createdAt:t,updatedAt:t};
    return this.tx(() => {
      this.db.prepare('INSERT INTO candidates(id,data) VALUES(?,?)').run(c.id,JSON.stringify(c));
      this.db.prepare('INSERT INTO resume_versions(candidate_id,version,data) VALUES(?,?,?)').run(c.id,1,JSON.stringify(c));
      this.audit('candidate.created',c.id,`录入候选人「${c.name}」；资料${c.parseStatus==='ready'?'可分析':'待补充文本'}`); return c;
    });
  }
  updateCandidate(id:string,input:EditableCandidate,parsing:{status:'ready'|'needs_text';message:string|null}) {
    return this.tx(() => {
      const previous=this.candidate(id);const changed=input.resumeText!==previous.resumeText;
      const c:Candidate={...previous,...input,resumeVersion:previous.resumeVersion+1,sourceFile:changed?null:previous.sourceFile,parseStatus:parsing.status,parseMessage:parsing.message,updatedAt:now()};
      this.update('candidates',c);
      this.db.prepare('INSERT INTO resume_versions(candidate_id,version,data) VALUES(?,?,?)').run(c.id,c.resumeVersion,JSON.stringify(c));
      this.audit('candidate.updated',id,`保存候选资料 v${c.resumeVersion}`); return c;
    });
  }
  createApplication(jobId:string,candidateId:string) {
    const job=this.job(jobId);this.candidate(candidateId);
    if(job.status!=='open') throw new AppError(409,'岗位已暂停或关闭，请先调整为招聘中','JOB_CLOSED');
    const existing=this.db.prepare('SELECT data FROM applications WHERE job_id=? AND candidate_id=?').get(jobId,candidateId) as {data:string}|undefined;
    if(existing) return JSON.parse(existing.data) as Application;
    const t=now();const a:Application={id:randomUUID(),jobId,candidateId,stage:'new',createdAt:t,updatedAt:t};
    return this.tx(()=>{this.db.prepare('INSERT INTO applications(id,job_id,candidate_id,data) VALUES(?,?,?,?)').run(a.id,jobId,candidateId,JSON.stringify(a));this.audit('application.created',a.id,`关联岗位「${job.title}」`);return a;});
  }
  setStage(id:string,stage:Stage) {
    return this.tx(()=>{const a={...this.application(id),stage,updatedAt:now()};this.update('applications',a);this.audit('application.stage',id,`流程阶段更新为 ${stage}`);return a;});
  }
  createTask(applicationId:string,mode:AnalysisMode) {
    const a=this.application(applicationId);const job=this.job(a.jobId);const candidate=this.candidate(a.candidateId);
    if(candidate.parseStatus!=='ready') throw new AppError(422,'简历没有足够可读文本，请补充文本后再分析','RESUME_NEEDS_TEXT');
    if(this.tasks().some(t=>t.applicationId===applicationId && ['queued','running'].includes(t.status))) throw new AppError(409,'此候选人在该岗位已有分析任务，请等待完成','TASK_ACTIVE');
    const t=now();const task:TaskRecord={id:randomUUID(),applicationId,mode,status:'queued',attempts:0,error:null,analysisId:null,createdAt:t,updatedAt:t,input:{job,candidate,mode}};
    return this.tx(()=>{this.db.prepare('INSERT INTO tasks(id,application_id,data) VALUES(?,?,?)').run(task.id,applicationId,JSON.stringify(task));this.audit('analysis.queued',task.id,`提交 ${mode} 分析，岗位 v${job.version} / 简历 v${candidate.resumeVersion}`);const {input:_input,...publicTask}=task;return publicTask;});
  }
  retryTask(id:string) {
    return this.tx(()=>{
      const task=this.task(id);
      if(task.status!=='failed') throw new AppError(409,'仅失败任务可以重试','INVALID_TASK_STATE');
      if(this.tasks().some(t=>t.id!==id && t.applicationId===task.applicationId && ['queued','running'].includes(t.status))) throw new AppError(409,'该候选人已有正在运行的任务','TASK_ACTIVE');
      const next={...task,status:'queued' as const,error:null,updatedAt:now()};this.update('tasks',next);this.audit('analysis.retry',id,'使用任务最初保存的岗位和简历快照重试');const {input:_input,...result}=next;return result;
    });
  }
  startTask(id:string) {
    const task=this.task(id);if(task.status!=='queued') throw new AppError(409,'任务状态已变化');
    const next={...task,status:'running' as const,attempts:task.attempts+1,updatedAt:now()};this.update('tasks',next);return next;
  }
  completeTask(id:string,result:EvaluationResult) {
    return this.tx(()=>{
      const task=this.task(id);if(task.status!=='running') throw new AppError(409,'任务状态已变化');
      const analysis:Analysis={id:randomUUID(),applicationId:task.applicationId,taskId:id,mode:task.mode,jobVersion:task.input.job.version,resumeVersion:task.input.candidate.resumeVersion,jobSnapshot:task.input.job,resumeSnapshot:task.input.candidate,result,createdAt:now()};
      this.db.prepare('INSERT INTO analyses(id,application_id,task_id,data) VALUES(?,?,?,?)').run(analysis.id,analysis.applicationId,id,JSON.stringify(analysis));
      this.update('tasks',{...task,status:'succeeded',error:null,analysisId:analysis.id,updatedAt:now()});
      const a=this.application(task.applicationId);if(a.stage==='new')this.update('applications',{...a,stage:'review',updatedAt:now()});
      this.audit('analysis.completed',analysis.id,`完成 ${task.mode} 分析；证据覆盖 ${result.coverage}%`);return analysis;
    });
  }
  failTask(id:string,message:string) {
    this.tx(()=>{const task=this.task(id);this.update('tasks',{...task,status:'failed',error:message.slice(0,1000),updatedAt:now()});this.audit('analysis.failed',id,message.slice(0,300));});
  }
  recoverInterrupted() {
    for(const task of this.tasks()) if(task.status==='running') this.failTask(task.id,'服务在上次分析时中断；输入快照已保留，可手动重试。');
  }
  createReview(applicationId:string,input:Pick<Review,'reviewer'|'decision'|'note'> & {analysisId?:string|null}) {
    const a=this.application(applicationId);
    if(input.analysisId && this.analysis(input.analysisId).applicationId!==applicationId)throw new AppError(400,'分析记录与候选岗位不匹配');
    const review:Review={...input,analysisId:input.analysisId||null,id:randomUUID(),applicationId,createdAt:now()};
    return this.tx(()=>{
      this.db.prepare('INSERT INTO reviews(id,application_id,analysis_id,data) VALUES(?,?,?,?)').run(review.id,applicationId,review.analysisId,JSON.stringify(review));
      const stage:Stage=input.decision==='advance'?'interview':input.decision==='reject'?'rejected':'review';
      this.update('applications',{...a,stage,updatedAt:now()});this.audit('review.created',review.id,`${input.reviewer} 完成人工复核：${input.decision}`);return review;
    });
  }
  createInterview(input:Omit<Interview,'id'|'createdAt'|'updatedAt'>) {
    const a=this.application(input.applicationId);const t=now();const interview:Interview={...input,id:randomUUID(),createdAt:t,updatedAt:t};
    return this.tx(()=>{this.db.prepare('INSERT INTO interviews(id,application_id,data) VALUES(?,?,?)').run(interview.id,input.applicationId,JSON.stringify(interview));this.update('applications',{...a,stage:'interview',updatedAt:t});this.audit('interview.created',interview.id,`安排面试：${input.interviewer}`);return interview;});
  }
  updateInterview(id:string,input:Omit<Interview,'id'|'applicationId'|'createdAt'|'updatedAt'>) {
    return this.tx(()=>{const old=this.one<Interview>('interviews',id);const interview={...old,...input,updatedAt:now()};this.update('interviews',interview);this.audit('interview.updated',id,`保存面试记录：${input.outcome}`);return interview;});
  }
  versions(kind:'job'|'resume',id:string) {
    const table=kind==='job'?'job_versions':'resume_versions';const key=kind==='job'?'job_id':'candidate_id';
    return (this.db.prepare(`SELECT data FROM ${table} WHERE ${key}=? ORDER BY version DESC`).all(id) as {data:string}[]).map(r=>JSON.parse(r.data));
  }
}
