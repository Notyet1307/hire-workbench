import { defineConfig } from '@playwright/test';
const executablePath=process.env.E2E_CHROMIUM_EXECUTABLE || undefined;
const args=process.env.E2E_CHROMIUM_ARGS?JSON.parse(process.env.E2E_CHROMIUM_ARGS) as string[]:[];
export default defineConfig({
  testDir:'./tests/e2e',timeout:45000,expect:{timeout:10000},fullyParallel:false,workers:1,retries:0,
  reporter:[['list'],['json',{outputFile:'evidence/latest/playwright-results.json'}]],
  outputDir:'test-results',
  use:{baseURL:'http://127.0.0.1:3317',actionTimeout:10000,viewport:{width:1440,height:1000},locale:'zh-CN',timezoneId:'Asia/Shanghai',trace:'retain-on-failure',screenshot:'only-on-failure',launchOptions:{executablePath,args}},
  webServer:{command:'node scripts/e2e-server.mjs',url:'http://127.0.0.1:3317/api/health',timeout:30000,reuseExistingServer:false,gracefulShutdown:{signal:'SIGTERM',timeout:5000},stdout:'pipe',stderr:'pipe'},
});
