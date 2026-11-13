const base=process.env.APP_ORIGIN || `http://127.0.0.1:${process.env.PORT||3000}`;
const headers=process.env.APP_ACCESS_TOKEN?{Authorization:`Bearer ${process.env.APP_ACCESS_TOKEN}`}:{ };
try {
  const health=await fetch(new URL('/api/health',base),{signal:AbortSignal.timeout(5000)});
  const data=await health.json();
  if(!health.ok||data.ok!==true||data.database!=='ready'||data.version!=='0.1.0')throw new Error('版本或数据库健康状态不匹配');
  const response=await fetch(new URL('/api/workspace',base),{headers,signal:AbortSignal.timeout(5000)});
  if(!response.ok)throw new Error(response.status===401?'服务可达，但访问口令缺失或不匹配':'工作区不可读取');
  const workspace=await response.json();
  console.log(JSON.stringify({status:'PASS',version:data.version,database:data.database,jobs:workspace.jobs.length,candidates:workspace.candidates.length,mode:workspace.config.mode,providerConfigured:workspace.config.modelConfigured,localOnly:workspace.config.localOnly},null,2));
} catch(error){console.error(JSON.stringify({status:'FAIL',error:error.message,action:'确认服务已启动；APP_ORIGIN/PORT/APP_ACCESS_TOKEN 与服务配置一致。'}));process.exitCode=1;}
