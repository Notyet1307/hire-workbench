import test from 'node:test';
import assert from 'node:assert/strict';
import { draftJob } from '../src/server/draft.js';

const provider = { baseUrl: 'https://model.example.test/v1', apiKey: 'synthetic-only', model: 'contract-test-model', timeoutMs: 1000 };
const requirements = '招聘 FDE 实习生，完成 TypeScript 业务开发与 Docker 部署，能说明自己的验证方法。';

test('岗位建议契约模拟：生成可编辑草稿并标记人工确认', async t => {
  t.mock.method(globalThis, 'fetch', async () => new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify({ title: 'FDE 实习生', description: requirements, criteria: [{ label: 'TypeScript 开发', weight: 100, required: true, keywords: ['TypeScript'] }] }) } }] })));
  const result = await draftJob(requirements, provider);
  assert.equal(result.criteria[0].id, 'criterion-1'); assert.match(result.notice, /人工核对/);
});
test('岗位建议没有模型配置时不生成假 AI 内容', async () => {
  await assert.rejects(draftJob(requirements), /配置 LLM/);
});
test('岗位建议无效输出不会被静默转换成模板', async t => {
  t.mock.method(globalThis, 'fetch', async () => new Response(JSON.stringify({ choices: [{ message: { content: '{"title":"假数据"}' } }] })));
  await assert.rejects(draftJob(requirements, provider), /不符合规定结构/);
});

test('岗位建议契约与实际保存一致：错误权重与过长关键词被拒绝',async t=>{
  const draft={title:'FDE 实习生',description:requirements,criteria:[{label:'开发实践',weight:40,required:true,keywords:['TypeScript']},{label:'部署实践',weight:40,required:true,keywords:['Docker']}]};
  const mock=t.mock.method(globalThis,'fetch',async()=>new Response(JSON.stringify({choices:[{message:{content:JSON.stringify(draft)}}]})));
  await assert.rejects(draftJob(requirements,provider),/权重必须合计/);
  draft.criteria=[{label:'开发实践',weight:100,required:true,keywords:['a'.repeat(61)]}];
  await assert.rejects(draftJob(requirements,provider),/不符合规定结构/);
  assert.equal(mock.mock.callCount(),2);
});
