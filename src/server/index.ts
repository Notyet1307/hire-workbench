import { createApp } from './app.js';
import { readConfig } from './config.js';

const config=readConfig();
const {app}=await createApp(config);
try {
  await app.listen({host:config.host,port:config.port});
  console.log(`Hire Workbench v0.1.0 ready at ${config.origin} | ${config.accessToken?'口令登录':'本机模式'} | ${config.mode==='rules'?'规则辅助':'模型辅助'}`);
} catch(error) {
  await app.close();throw error;
}
for(const signal of ['SIGINT','SIGTERM'] as const)process.once(signal,()=>{void app.close().then(()=>process.exit(0));});
