import path from 'node:path';
import type { AnalysisMode, ProviderConfig } from '../shared/types.js';

export interface ServerConfig {
  host: string; port: number; dataDir: string; seedDemo: boolean;
  accessToken: string; origin: string; dev: boolean; mode: AnalysisMode;
  provider?: ProviderConfig; webDir: string;
}
export function readConfig(env: NodeJS.ProcessEnv = process.env): ServerConfig {
  const host = env.HOST || '127.0.0.1';
  const port = Number(env.PORT || 3000);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('PORT 必须为 1–65535 的整数');
  const accessToken = env.APP_ACCESS_TOKEN || '';
  const local = ['127.0.0.1', 'localhost', '::1'].includes(host);
  if ((!local || accessToken) && accessToken.length < 16) throw new Error('远程监听或启用登录时，APP_ACCESS_TOKEN 至少需要 16 个字符');
  if (!local && !env.APP_ORIGIN) throw new Error('远程监听需要 APP_ORIGIN，填写浏览器实际访问的完整地址');
  const origin = env.APP_ORIGIN || `http://127.0.0.1:${port}`;
  let originUrl: URL;
  try { originUrl = new URL(origin); } catch { throw new Error('APP_ORIGIN 必须为完整 http/https 地址'); }
  if (!['http:', 'https:'].includes(originUrl.protocol) || originUrl.username || originUrl.password || originUrl.pathname !== '/' || originUrl.search || originUrl.hash) throw new Error('APP_ORIGIN 只包含协议、主机和端口');
  const mode = env.AI_MODE || 'rules';
  if (mode !== 'rules' && mode !== 'llm') throw new Error('AI_MODE 仅支持 rules 或 llm');
  let provider: ProviderConfig | undefined;
  if (env.LLM_BASE_URL && env.LLM_MODEL && env.LLM_API_KEY) {
    const url = new URL(env.LLM_BASE_URL);
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) throw new Error('LLM_BASE_URL 必须为 http/https 地址且不能包含凭据');
    const timeoutMs = Number(env.LLM_TIMEOUT_MS || 60000);
    if (!Number.isInteger(timeoutMs) || timeoutMs < 1000 || timeoutMs > 300000) throw new Error('LLM_TIMEOUT_MS 需要在 1000–300000 之间');
    const structuredOutput = env.LLM_JSON_MODE || 'json_object';
    if (structuredOutput !== 'json_object' && structuredOutput !== 'json_schema') throw new Error('LLM_JSON_MODE 仅支持 json_object 或 json_schema');
    provider = { baseUrl: env.LLM_BASE_URL.replace(/\/$/, ''), model: env.LLM_MODEL, apiKey: env.LLM_API_KEY, timeoutMs, structuredOutput };
  }
  if (mode === 'llm' && !provider) throw new Error('AI_MODE=llm 需要完整配置 LLM_BASE_URL / LLM_API_KEY / LLM_MODEL');
  return { host, port, dataDir: path.resolve(env.DATA_DIR || 'data'), seedDemo: env.SEED_DEMO !== 'false', accessToken,
    origin: originUrl.origin, dev: env.DEV_MODE === '1', mode, provider, webDir: path.resolve('dist/web') };
}
