import { z } from 'zod';
const short = (max = 200) => z.string().trim().max(max);
export const criterionSchema = z.object({
  id: z.string().regex(/^[a-zA-Z0-9_-]{1,80}$/), label: short(120).min(2),
  weight: z.number().int().min(1).max(100), required: z.boolean(),
  keywords: z.array(short(60).min(1)).min(1).max(20),
}).strict();
export const jobSchema = z.object({
  title: short(120).min(2), department: short(100).default(''), location: short(100).default(''),
  employmentType: short(50).default('全职'), description: short(20000).min(10),
  status: z.enum(['open','paused','closed']).default('open'),
  criteria: z.array(criterionSchema).min(1).max(12),
}).strict().superRefine((value, ctx) => {
  if (value.criteria.reduce((n, c) => n + c.weight, 0) !== 100) ctx.addIssue({code:'custom',path:['criteria'],message:'评价权重合计必须为 100%'});
  if (new Set(value.criteria.map(c => c.id)).size !== value.criteria.length) ctx.addIssue({code:'custom',path:['criteria'],message:'评价维度 ID 不可重复'});
});
export const candidateSchema = z.object({
  name: short(100).min(1), email: z.union([z.email(), z.literal('')]).default(''),
  phone: short(40).default(''), headline: short(200).default(''),
  tags: z.array(short(40).min(1)).max(20).default([]), resumeText: z.string().max(80000).default(''),
}).strict();
export const applicationSchema = z.object({jobId:z.string().uuid(),candidateId:z.string().uuid()}).strict();
export const stageSchema = z.object({stage:z.enum(['new','review','interview','offer','hired','rejected'])}).strict();
export const analysisSchema = z.object({mode:z.enum(['rules','llm']).default('rules')}).strict();
export const reviewSchema = z.object({
  analysisId:z.string().uuid().nullable().optional(), reviewer:short(100).min(1),
  decision:z.enum(['advance','hold','reject']), note:short(10000).min(3),
}).strict();
export const interviewSchema = z.object({
  applicationId:z.string().uuid(), scheduledAt:z.iso.datetime({offset:true}),
  interviewer:short(100).min(1), location:short(500).default(''), notes:short(20000).default(''),
  outcome:z.enum(['pending','pass','hold','reject']).default('pending'),
}).strict();
export const interviewUpdateSchema = interviewSchema.omit({applicationId:true});
export class AppError extends Error { constructor(public status:number, message:string, public code = 'VALIDATION_ERROR') { super(message); } }
