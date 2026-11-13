# API 与数据说明

前端与 API 同源。JSON 请求使用 `Content-Type: application/json`；错误统一返回 `{ "error": "说明", "code": "错误类型" }` 和非 2xx 状态。配置访问口令时，可以使用登录 Cookie，或从可信自动化客户端发送 `Authorization: Bearer <APP_ACCESS_TOKEN>`。不要把口令放进 URL。

| 方法与路径 | 请求 | 返回 / 行为 |
|---|---|---|
| GET `/api/health` | 无 | 版本、SQLite 就绪状态 |
| GET `/api/config` | 无 | 非敏感配置状态 |
| POST `/api/session` | `{token}` | 建立 8 小时 HttpOnly 会话 |
| DELETE `/api/session` | 无 | 注销当前会话 |
| GET `/api/workspace` | 无 | `Workspace` 聚合视图，适用于小团队规模 |
| POST `/api/jobs` | 岗位可编辑字段 | 创建 v1，权重合计必须 100 |
| PUT `/api/jobs/:id` | 岗位可编辑字段 | 新版本；保留历史快照 |
| POST `/api/jobs/draft` | `{requirements}` | 可选模型生成待确认建议，不保存 |
| GET `/api/jobs/:id/versions` | 无 | 历史岗位快照 |
| POST `/api/candidates` | `{name,resumeText,email?,phone?,headline?,tags?}` | 候选资料 v1 |
| POST `/api/candidates/upload` | multipart：`file`、可选 `name` | 提取正文；最多 8 MB |
| PUT `/api/candidates/:id` | 同文本创建字段 | 每次保存生成候选资料新版本 |
| GET `/api/candidates/:id/versions` | 无 | 历史候选资料快照 |
| POST `/api/applications` | `{jobId,candidateId}` | 唯一关联；重复提交返回原记录 |
| PATCH `/api/applications/:id` | `{stage}` | 人工调整招聘阶段 |
| POST `/api/applications/:id/analyze` | `{mode:"rules"或"llm"}` | 202，保存输入快照并提交任务 |
| POST `/api/tasks/:id/retry` | 无 | 202，仅失败任务；原输入重试 |
| POST `/api/applications/:id/reviews` | `{reviewer,decision,note,analysisId?}` | 保存复核，更新阶段 |
| POST `/api/interviews` | `{applicationId,scheduledAt,interviewer,location}` | 安排面试；不发送通知 |
| PUT `/api/interviews/:id` | `{scheduledAt,interviewer,location,notes,outcome}` | 保存记录和结果 |
| GET `/api/analyses/:id/export` | 无 | 单次分析快照与关联复核 JSON |
| GET `/api/export` | 无 | 工作区及历史版本 JSON，排除配置秘密 |
| GET `/api/audit` | 无 | 最近 200 条业务事件 |

完整实体字段以 `src/shared/types.ts` 为准；服务端输入约束见 `src/server/validation.ts`。岗位和候选编辑请求不能直接回传整个实体，ID、版本与时间戳由服务端维护。

`score` 是已知标准的加权平均：明确满足 100、部分满足 50、明确不满足 0，信息不足不进分母；全未知为 `null`。`coverage` 是具有可判断证据的标准权重占全部权重的百分比。两者必须同时显示。规则模式不做语义能力认证，只返回部分满足或信息不足。

版本名 `resumeVersion` 在首版表示整份候选资料快照版本；即使只改联系方式，每次保存也会递增，保证快照数据一致。历史分析引用的原文不随当前编辑改变。
