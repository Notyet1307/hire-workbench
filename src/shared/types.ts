export type CriterionStatus = 'met' | 'partial' | 'not_met' | 'unknown';
export type Stage = 'new' | 'review' | 'interview' | 'offer' | 'hired' | 'rejected';
export type AnalysisMode = 'rules' | 'llm';
export interface Criterion { id: string; label: string; weight: number; required: boolean; keywords: string[] }
export interface Job { id: string; title: string; department: string; location: string; employmentType: string; description: string; status: 'open' | 'paused' | 'closed'; version: number; criteria: Criterion[]; createdAt: string; updatedAt: string }
export interface Candidate { id: string; name: string; email: string; phone: string; headline: string; tags: string[]; resumeText: string; resumeVersion: number; sourceFile: string | null; parseStatus: 'ready' | 'needs_text'; parseMessage: string | null; createdAt: string; updatedAt: string }
export interface Application { id: string; jobId: string; candidateId: string; stage: Stage; createdAt: string; updatedAt: string }
export interface Evidence { quote: string; start: number; end: number }
export interface Assessment { criterionId: string; label: string; weight: number; required: boolean; status: CriterionStatus; rationale: string; evidence: Evidence[]; question: string }
export interface EvaluationResult { assessments: Assessment[]; score: number | null; coverage: number; summary: string; strengths: string[]; gaps: string[]; questions: string[]; engine: string; model: string | null; warnings: string[] }
export interface Analysis { id: string; applicationId: string; taskId: string; mode: AnalysisMode; jobVersion: number; resumeVersion: number; jobSnapshot: Job; resumeSnapshot: Candidate; result: EvaluationResult; createdAt: string }
export interface AnalysisTask { id: string; applicationId: string; mode: AnalysisMode; status: 'queued' | 'running' | 'succeeded' | 'failed'; attempts: number; error: string | null; analysisId: string | null; createdAt: string; updatedAt: string }
export interface Review { id: string; applicationId: string; analysisId: string | null; reviewer: string; decision: 'advance' | 'hold' | 'reject'; note: string; createdAt: string }
export interface Interview { id: string; applicationId: string; scheduledAt: string; interviewer: string; location: string; notes: string; outcome: 'pending' | 'pass' | 'hold' | 'reject'; createdAt: string; updatedAt: string }
export interface AuditEvent { id: string; action: string; entityId: string; detail: string; createdAt: string }
export interface AppConfig { version: string; mode: AnalysisMode; model: string | null; modelConfigured: boolean; authenticated: boolean; authRequired: boolean; localOnly: boolean }
export interface Workspace { jobs: Job[]; candidates: Candidate[]; applications: Application[]; analyses: Analysis[]; tasks: AnalysisTask[]; reviews: Review[]; interviews: Interview[]; audit: AuditEvent[]; config: AppConfig }
export interface EvaluationInput { job: Job; candidate: Candidate; mode: AnalysisMode; signal?: AbortSignal }
export interface ProviderConfig { baseUrl: string; apiKey: string; model: string; timeoutMs: number; structuredOutput?: 'json_object'|'json_schema' }
export const stageLabels: Record<Stage,string> = {new:'新投递', review:'待复核', interview:'面试中', offer:'Offer', hired:'已录用', rejected:'不推进'};
export const statusLabels: Record<CriterionStatus,string> = {met:'明确满足', partial:'部分满足', not_met:'明确不满足', unknown:'信息不足'};
