import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluate, redactContacts } from '../src/server/evaluation.js';
import type { EvaluationInput, ProviderConfig } from '../src/shared/types.js';

// Provider responses below are contract simulations, not live-model validation.
const provider: ProviderConfig = { baseUrl: 'https://model.example.test/v1', apiKey: 'synthetic-test-key', model: 'contract-test-model', timeoutMs: 1000 };
const text = '姓名：示例候选人\n邮箱：candidate@example.test\n手机：13800138000\n项目经历\n我使用 TypeScript 开发了招聘工作台，并为表单与权限编写了测试。\n我负责 Docker 镜像构建和部署，排查过数据库连接失败，并写了处理过程。\n其他经历：参与需求访谈，记录业务目标，并将目标拆解为可验证的任务。';
function input(mode: 'rules' | 'llm' = 'rules'): EvaluationInput {
  return {
    mode,
    job: { id: 'job-demo', title: 'FDE 实习生', department: '研发', location: '远程', employmentType: '实习', description: '开发与部署业务应用', status: 'open', version: 1, createdAt: '2026-11-13', updatedAt: '2026-11-13', criteria: [
      { id: 'coding', label: 'TypeScript 应用开发', weight: 70, required: true, keywords: ['TypeScript'] },
      { id: 'deploy', label: '容器部署', weight: 30, required: true, keywords: ['Docker'] },
    ] },
    candidate: { id: 'candidate-demo', name: '示例候选人', email: 'candidate@example.test', phone: '13800138000', headline: '', tags: [], resumeText: text, resumeVersion: 1, sourceFile: null, parseStatus: 'ready', parseMessage: null, createdAt: '2026-11-13', updatedAt: '2026-11-13' },
  };
}
function remote(status = 'met') {
  return { assessments: [
    { criterionId: 'coding', status, rationale: '原文描述了应用开发经历，面试需核实个人职责。', evidence: ['我使用 TypeScript 开发了招聘工作台，并为表单与权限编写了测试。'], question: '请演示你编写的测试并解释覆盖范围。' },
    { criterionId: 'deploy', status: 'partial', rationale: '原文描述了部署，但需要进一步核实复杂度。', evidence: ['我负责 Docker 镜像构建和部署，排查过数据库连接失败，并写了处理过程。'], question: '数据库连接故障是如何定位和恢复的？' },
  ] };
}
function response(value: unknown): Response { return new Response(JSON.stringify({ choices: [{ finish_reason: 'stop', message: { content: JSON.stringify(value) } }] }), { status: 200 }); }

test('中文关键词命中只产生部分满足，且引用可切回原文', async () => {
  const original = input();
  const result = await evaluate(original);
  assert.deepEqual(result.assessments.map(item => item.status), ['partial', 'partial']);
  assert.equal(result.score, 50); assert.equal(result.coverage, 100);
  assert.equal(result.model, null); assert.match(result.warnings.join(' '), /未调用大模型/);
  for (const item of result.assessments) for (const evidence of item.evidence) {
    assert.equal(original.candidate.resumeText.slice(evidence.start, evidence.end), evidence.quote);
  }
});

test('没有证据返回未知与空分数，不把未写经历变为明确不满足', async () => {
  const original = input();
  original.job.criteria = [{ id: 'unknown', label: '供应链治理', weight: 100, required: true, keywords: ['供应链治理'] }];
  const result = await evaluate(original);
  assert.equal(result.assessments[0].status, 'unknown'); assert.equal(result.score, null); assert.equal(result.coverage, 0);
});

test('中英文混排的中文关键词不会被英文词边界误过滤', async () => {
  const original = input();
  original.candidate.resumeText = '项目经历：我负责Docker部署，并处理了数据库连接失败；随后完成了回归测试、部署文档与故障复盘。所有描述均为测试合成数据。';
  original.job.criteria = [{ id: 'deployment', label: '部署经验', weight: 100, required: true, keywords: ['部署'] }];
  const result = await evaluate(original);
  assert.equal(result.assessments[0].status, 'partial'); assert.match(result.assessments[0].evidence[0].quote, /Docker部署/);
});

test('否定语境不会成为正向命中，Go 不会命中 Google', async () => {
  const original = input();
  original.candidate.resumeText = '我没有使用 TypeScript，只在课堂了解过概念；实际开发使用其他工具。\n我不会 Docker，目前还没有容器部署经历。\n我参与 Google 文档维护，记录需求沟通结果。';
  original.job.criteria.push({ id: 'golang', label: 'Go 开发', keywords: ['Go'], weight: 10, required: false });
  const result = await evaluate(original);
  assert.ok(result.assessments.every(item => item.status === 'unknown'));
});

test('没有模型配置时明确失败，不自动回退', async () => {
  await assert.rejects(evaluate(input('llm')), /尚未配置模型接口/);
});

test('未说明或尚无相关经历的说明不能抬高证据覆盖率',async()=>{
  const original=input();
  original.candidate.resumeText='使用 TypeScript 完成任务管理页面，并通过 Git 管理代码，编写使用文档。项目主要运行在本地，简历未说明服务端开发、部署、自动化测试或安全项目经历。尚无 Docker 实践。';
  original.job.criteria=[{id:'coding',label:'开发实践',weight:50,required:true,keywords:['TypeScript']},{id:'delivery',label:'交付实践',weight:30,required:true,keywords:['Docker','部署','测试']},{id:'security',label:'安全实践',weight:20,required:false,keywords:['安全']}];
  const result=await evaluate(original);
  assert.deepEqual(result.assessments.map(item=>item.status),['partial','unknown','unknown']);assert.equal(result.coverage,50);
});

test('模型契约：严格格式、去除联系字段、逐字证据与权重计算', async t => {
  t.mock.method(globalThis, 'fetch', async (url: string | URL | Request, init?: RequestInit) => {
    assert.equal(String(url), 'https://model.example.test/v1/chat/completions');
    const body = JSON.parse(String(init?.body));
    assert.equal(body.response_format.type, 'json_object');
    assert.equal(body.messages[1].content.includes('candidate@example.test'), false);
    assert.equal(body.messages[1].content.includes('13800138000'), false);
    return response(remote());
  });
  const result = await evaluate(input('llm'), provider);
  assert.equal(result.score, 85); assert.equal(result.coverage, 100);
  assert.equal(result.model, 'contract-test-model');
  for (const item of result.assessments) for (const evidence of item.evidence) assert.equal(text.slice(evidence.start, evidence.end), evidence.quote);
});

test('模型契约：显式 json_schema 模式发送严格 schema', async t => {
  t.mock.method(globalThis, 'fetch', async (_url: unknown, init?: RequestInit) => {
    const body = JSON.parse(String(init?.body));
    assert.equal(body.response_format.type, 'json_schema');
    assert.equal(body.response_format.json_schema.strict, true);
    return response(remote());
  });
  const result = await evaluate(input('llm'), { ...provider, structuredOutput: 'json_schema' });
  assert.equal(result.score, 85);
});

test('模型契约：虚构原文、缺失标准、重复标准均拒绝保存', async t => {
  let payload = remote();
  t.mock.method(globalThis, 'fetch', async () => response(payload));
  payload.assessments[0].evidence = ['这是一条简历根本没有写过的研发成果。'];
  await assert.rejects(evaluate(input('llm'), provider), /无法定位到简历原文/);
  payload = remote(); payload.assessments.pop();
  await assert.rejects(evaluate(input('llm'), provider), /遗漏、重复或增加/);
  payload = remote(); payload.assessments[1].criterionId = 'coding';
  await assert.rejects(evaluate(input('llm'), provider), /遗漏、重复或增加/);
});

test('模型契约：无证据的明确判断以及额外字段被拒绝', async t => {
  let payload: unknown = remote();
  t.mock.method(globalThis, 'fetch', async () => response(payload));
  const missing = remote(); missing.assessments[0].evidence = []; payload = missing;
  await assert.rejects(evaluate(input('llm'), provider), /未提供原文证据/);
  payload = { ...remote(), secretScore: 100 };
  await assert.rejects(evaluate(input('llm'), provider), /不符合严格结构/);
});

test('模型契约：HTTP 错误与超时原样成为失败，不产生规则结果', async t => {
  const fetchMock = t.mock.method(globalThis, 'fetch', async () => new Response('synthetic error', { status: 401 }));
  await assert.rejects(evaluate(input('llm'), provider), /HTTP 401/);
  fetchMock.mock.mockImplementation((_url: unknown, init?: RequestInit) => new Promise<Response>((_resolve, reject) => {
    init?.signal?.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')), { once: true });
  }));
  // AbortSignal.timeout is unref'd; this timer keeps the isolated test process alive.
  const alive = setTimeout(() => undefined, 1000);
  try { await assert.rejects(evaluate(input('llm'), { ...provider, timeoutMs: 100 }), /请求超时/); }
  finally { clearTimeout(alive); }
});

test('联系方式屏蔽保留原始长度与行位置', () => {
  const redacted = redactContacts(text);
  assert.equal(redacted.length, text.length);
  assert.equal(redacted.split('\n').length, text.split('\n').length);
  assert.equal(redacted.includes('candidate@example.test'), false);
});
