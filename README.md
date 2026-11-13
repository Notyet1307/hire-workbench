# Hire Workbench · 招聘工作台

一个面向小团队的中文招聘 MVP。先维护岗位标准，再导入简历，逐项查看证据与信息缺口，由招聘者复核并安排面试。

本项目参考 WhaleHire 的产品方向，采用 TypeScript 实现。它是独立工作台，复用了 Harly 的 MIT 文档处理模块，并非完整 Harly fork，也不是 WhaleHire 官方源码。

## 先运行

需要 **Node.js 24** 和 npm。无需安装 Python、数据库服务或 Docker。首次安装依赖需要访问 npm registry。

解压源码包，进入 `hire-workbench` 文件夹，在终端依次运行：

```bash
node --version
npm ci
npm run build
npm start
```

`node --version` 应显示 `v24.x.x`。看到服务启动后，用浏览器打开 **http://localhost:3000**。保持这个终端运行；结束时按 `Ctrl+C`。

默认使用本地规则分析，不需要模型密钥。此模式会提取关键词相关原文并标记待核实项，用于验证产品流程，不代表大模型理解了候选人的能力。

数据默认写在 `data/`。正常重启会保留已有内容。不要为了升级直接删除这个目录；先停止服务并备份。

默认首次启动会载入合成演示数据。想从空工作区开始，可在首次运行前将 `.env` 中的 `SEED_DEMO=false`；这个选项不会删除已有数据。

## 用一份简历走完整流程

1. 打开“岗位画像”，点击“新建岗位”。可以应用模板或手工填写，每项评价标准设置权重、必需项及关键词，**权重合计必须为 100**，然后“保存岗位”。
2. 打开“候选人”，点击“添加候选人”。填写“候选人姓名”和“简历原文”后保存；也可切换“上传简历文件”，选择 PDF、DOCX、TXT，再点击“上传并解析”。
3. 在候选人详情点击“关联岗位”，选择招聘中的岗位并“确认关联”。同一个候选人可以应聘不同岗位。
4. 点击“开始分析”。等待完成后查看逐项结果，点击右侧“原文证据”可在左侧正文中高亮定位。历史结果可通过“分析历史版本”切换。
5. 填写“复核人”“复核结论”和“判断与下一步”，点击“保存复核”。决定会更新该应聘记录的招聘阶段。
6. 点击“安排面试”，填写时间、面试官和地点；再从“面试管理”进入“填写记录”，保存面试观察和结论。单份分析在报告的下载按钮导出，工作区 JSON 在“工作区设置”导出。

**信息不足不等于明确不满足。** 分数与证据覆盖率一起看。系统不会因为分析完成就自动拒绝或录用候选人。

扫描 PDF 没有可提取文本时会进入“待补充正文”状态。当前版本没有 OCR 服务，请手工补充正文后再分析。

上传后保存的是提取的正文、源文件名和版本，**不归档 PDF/DOCX 原文件**。请自行保留原始材料。单文件上限为 8 MB。

候选资料每次保存都会增加一个版本，包括只改联系方式的情况。已有分析继续保留当时的整份资料快照。

## 接入模型

服务端支持 OpenAI 兼容的 Chat Completions 接口。复制环境示例文件后，填写你的服务地址、模型 ID 和 API Key：

```bash
cp .env.example .env
```

在 `.env` 填写 `LLM_BASE_URL`、`LLM_API_KEY`、`LLM_MODEL`。服务地址应指向兼容 API 的基础地址，通常以 `/v1` 结尾，也支持已经包含 `/chat/completions` 的完整地址，服务端不会重复追加。密钥只放本地 `.env`，不要提交或发给接手 AI。

`LLM_JSON_MODE` 默认是 `json_object`；提供商支持时可改为 `json_schema`。两种模式都会校验结果结构和原文证据。`AI_MODE=rules` 是默认选择，设为 `llm` 前必须配全模型参数。

配置完成后重启服务，在界面选择模型分析。模型响应需要满足结构化结果与证据原文校验；接口异常或校验失败会明确显示失败，不会悄悄改用规则结果。

**本交付不包含可用模型密钥，也不宣称已经验证任何真实模型服务。** 兼容性测试与真实模型效果是两回事。首次接入后，请先用获得授权或脱敏的样本验证中文事实提取、引用准确性、耗时和成本。

## 开发与检查

```bash
# 本地开发，前端 http://localhost:5173，API http://localhost:3000
npm run dev

# 在另一个终端检查已启动实例
npm run doctor

# 类型、行为、构建与用户路径验收
npm run typecheck
npm test
npm run build
npm run e2e
```

`npm run verify` 是统一验收入口。准确覆盖范围、命令输出和本次未验证项见 [验证报告](docs/TEST-REPORT.md)。浏览器测试需要安装测试所需的 Chromium；具体启动和清理方法见 [项目验证技能](.cursor/skills/verify-hire-workbench/SKILL.md)。

本次交付环境使用的浏览器启动方式记录在验证报告中。目标 Mac 上的浏览器安装、真实模型和部署尚需在目标设备运行验证，不能由 Linux 结果直接推断通过。

## 配置与数据

| 配置 | 用途 |
|---|---|
| `HOST` | 默认 `127.0.0.1`，只监听本机 |
| `PORT` | 默认 `3000` |
| `DATA_DIR` | 默认 `./data`，存放 `workbench.sqlite` 及其辅助文件 |
| `SEED_DEMO` | 默认 `true`，空工作区加载合成演示数据 |
| `APP_ORIGIN` | 浏览器实际访问的完整来源地址，不带路径 |
| `APP_ACCESS_TOKEN` | 可选访问口令，至少 16 个字符；非本机监听时必填 |
| `AI_MODE` | 默认 `rules`；配置模型后可设为 `llm` |
| `LLM_BASE_URL / LLM_API_KEY / LLM_MODEL` | 兼容模型接口、密钥和实际模型 ID |
| `LLM_TIMEOUT_MS` | 默认 60000 毫秒 |
| `LLM_JSON_MODE` | 默认 `json_object`，可选 `json_schema` |

这是单工作区应用。访问口令不是多用户身份和权限体系。若要通过局域网或 Tailscale 访问，请设置访问口令，并按自己的部署环境配置 HTTPS。不要将未配置访问口令的实例直接暴露到公网。

工作区 JSON 导出用于查看和留档，不是自动恢复备份。备份时先停止服务，再复制整个 `DATA_DIR`，一并保留 `workbench.sqlite` 及可能存在的 WAL/SHM 文件。当前没有一键 JSON 导入恢复功能。

## 让 AI 接手

先让 AI 读取 [AGENTS.md](AGENTS.md)，再读取 [交接说明](docs/HANDOFF.md)。已经安装官方 pstack 的 Claude Code 可使用：

```text
/pstack:poteto-mode
接手这个仓库。先读 AGENTS.md、docs/HANDOFF.md 和 specs/next.md，
确认当前行为与验收证据，再执行下一项任务。
沿用官方 pstack，不另造控制器或验收系统。
用仓库内 verify-hire-workbench 技能验证变更，保留 spec/base/head/证据。
```

安装、运行时和模型映射边界见 [pstack 接入说明](docs/PSTACK.md)。Codex 可直接读取 `AGENTS.md` 和验证技能文件，使用同一组项目命令。

## 文档入口

- [产品范围与未完成项](docs/PRODUCT.md)
- [数据模型与扩展位置](docs/ARCHITECTURE.md)
- [pstack 与 AI 接手方式](docs/PSTACK.md)
- [当前交接状态](docs/HANDOFF.md)
- [下一个开发规格](specs/next.md)
- [本次验证报告](docs/TEST-REPORT.md)
- [开源来源与许可](THIRD-PARTY-NOTICES.md)

后续优先验证真实模型和中文简历样本，再补 OCR、权限和部署能力。Go 服务拆分、招聘渠道接入、完整 Harly 迁移都属于后续工作。

## 保留 Git 基线继续开发

公开仓库使用清理后的源码建立干净初始提交，不包含原始私有提交历史或 source-history.bundle。请从公开仓库克隆后继续开发，使用 git rev-parse HEAD 记录当前基线。原始交付的验证范围见 `docs/TEST-REPORT.md`，它不是新环境的运行证明。

## 可选 Docker 部署

包内提供 Dockerfile 与 Compose，当前交付没有在 Docker 环境运行验收。先在 `.env` 设置至少 16 字符的 `APP_ACCESS_TOKEN`，再执行 `docker compose up --build`。Compose 默认只把端口映射到宿主机 `127.0.0.1:3000`，数据放在具名卷中；不要用 `docker compose down -v` 删除要保留的数据。优先按上面的 Node.js 路径试用。
