---
name: verify-hire-workbench
description: 验证 Hire Workbench 的中文招聘工作台、真实 HTTP API、数据持久化与浏览器用户路径。修改岗位、简历、证据分析、人工复核、面试或启动方式后，以及接手仓库和交付版本前使用。
---

# 验证 Hire Workbench

从仓库根目录执行。先读 `AGENTS.md`、`docs/TEST-REPORT.md` 和本目录 `features/README.md`。这是项目专属验收方法，工作选路和审阅沿用已安装的官方 pstack。

## Launch

需要 Node.js 24。安装锁定依赖并构建：

```bash
npm ci
npm run build
```

没有测试浏览器时安装 Chromium：

```bash
npx playwright install chromium
```

默认完整验收命令：

```bash
npm run verify
```

它顺序运行类型检查、API/分析测试、构建及浏览器验收。只驱动浏览器用户路径可运行：

```bash
npm run e2e
```

浏览器验收通过 `scripts/e2e-server.mjs` 在 `.verification/e2e/run-*` 创建独立空数据目录，使用端口 `3317` 和 `SEED_DEMO=false`。Playwright 等待健康接口响应后开始驱动，首个用例再确认页面可用。测试自己创建所需记录，不依赖演示数据。不要与另一次 E2E 并行运行，也不要把目录改成用户的 `data/`。

默认使用 Playwright 安装的 Chromium。受限运行环境可显式提供 `E2E_CHROMIUM_EXECUTABLE`，启动参数通过 JSON 数组形式的 `E2E_CHROMIUM_ARGS` 传入；具体选择必须在测试报告中记录。使用适配过的无头浏览器完成 Linux 验收，不等于已经验证 Mac 浏览器或用户设备部署。

需要人工交互时在单独终端运行 `npm start`，默认本机端口 `3000`。验证结束在该终端按 `Ctrl+C`。需要第二个手动实例时同时设置不同 `PORT` 和 `DATA_DIR`；只改端口仍会共享数据库，不允许这样运行。

## Doctor

对手动运行的实例执行：

```bash
npm run doctor
```

指定实例：

```bash
APP_ORIGIN=http://127.0.0.1:3000 npm run doctor
```

Doctor 只读健康接口和受保护的工作区接口。有访问口令时通过当前环境的 `APP_ACCESS_TOKEN` 使用正确凭据，不把令牌打印到证据或聊天中。

健康响应必须对应 `0.1.0` 且数据库就绪；工作区必须能读取。若状态不符，先核查进程、端口、数据目录、构建和凭据，不用坐标点击或修改前端状态绕过去。

E2E 配置先等 `/api/health` 可访问，用户路径再检查页面标题并通过 `/api/workspace` 核查数据副作用。它没有调用完整的 `doctor` 脚本，两者的执行记录要分开。端口冲突、服务无法启动或浏览器缺失是环境失败，不能记为功能通过。

## Drive

按 [功能地图](features/README.md) 选择路径。优先使用现有 Playwright 用例；界面元素使用可访问名称或稳定测试标识，不依赖屏幕坐标和 Tab 次序。

```bash
npm run e2e
npm run e2e -- --grep '完整浏览器路径'
npm run e2e -- --grep '简历文件上传'
```

目前只有两条浏览器用例。`完整浏览器路径` 覆盖岗位创建、手工正文、关联、分析高亮、复核、面试、刷新和公开 API 回读；`简历文件上传` 覆盖 TXT 上传和 390 像素宽度无横向溢出。`--grep '岗位|简历|复核'` 会匹配这两条，不是三个独立功能测试。

筛选后的运行只证明匹配到的用例。未匹配到测试必须作为失败处理，不能把零项执行记为通过。岗位编辑、快照、重启、认证和模型错误等边界由 `tests/*.test.ts` 检查，不能声称它们都经过了浏览器操作。新增用户入口或状态需要同时更新现有用例和功能地图。

用户路径必须通过界面或公开 API 操作，不直接写数据库、调用内部 setter 或新增只供测试使用的后门。API 层测试可以检查持久化和边界，但不能代替浏览器路径。

规则分析是本地真实产品路径。模拟模型服务只能放在既有 provider 边界，用于超时、格式、引文校验和失败重试；它不证明真实提供商兼容或中文招聘判断有效。

## Evidence

统一验证输出保留在 `evidence/latest/`，包含 `summary.json`、`verify.log`；浏览器测试生成 `playwright-results.json`、`browser-proof.json` 和 `01-job.png` 至 `05-mobile.png`。Playwright 失败时的 trace 和截图保留在 `test-results/`，成功运行不保证有 trace。交付时使用 `evidence/release/` 保存本次版本证据；后续运行可能更新 latest，不应覆盖 release。

每个通过结论要包含动作和结果，必要时同时检查持久化数据。只截最终页面不足以说明保存成功；用页面刷新、公开 API 或服务重启后的结果证明相应副作用。

记录运行时间、环境、执行命令、退出码、版本及 spec/base/head。没有 Git 时明确标为不适用。浏览器、真实模型、目标设备或跨模型审阅未运行时分别说明，不能借其他检查推断通过。

证据只使用合成数据或脱敏样本。不要保存 API Key、访问口令、真实简历和用户机器凭据。完成后更新 `docs/TEST-REPORT.md` 和 `docs/HANDOFF.md` 中与本次任务相关的状态。

## Cleanup

E2E 负责停止自己启动的服务和浏览器。运行异常时先检查测试输出中记录的进程归属，只结束本次创建的进程。不要按进程名称批量 kill，也不要占用用户正在运行的 3000 端口实例。

手动实例在原终端 `Ctrl+C`。清理只涉及本次测试实例及 `.verification` 内对应的隔离数据，不得删除默认 `data/`。

清理后确认 `evidence/latest/` 或本次记录的证据路径仍存在。证据和测试临时数据是不同用途，禁止一起删除。交付报告要区分已经执行的清理与仍需处理的残留。

## Helpers

| 入口 | 用途 |
|---|---|
| `npm run doctor` | 对当前目标实例进行只读就绪检查 |
| `npm run typecheck` | 验证前后端类型契约 |
| `npm test` | 运行服务端、分析与持久化行为测试 |
| `npm run build` | 生成可启动的生产构建 |
| `npm run e2e` | 隔离启动并驱动真实浏览器路径 |
| `npm run verify` | 统一执行全部本地验收 |

具体脚本路径以 `package.json` 为准。不要为了运行这个技能另外搭建一套验收服务。维护功能地图时参照官方 pstack 的 `/maintain-verification-skill`，并沿用实际安装版本的调用前缀。
