# pstack 接入与接手说明

## 本项目如何使用 Lauren 的 pstack

官方项目是 [cursor/plugins/pstack](https://github.com/cursor/plugins/tree/main/pstack)，作者为 Lauren Tan。本仓库保留项目事实、验收脚本和功能地图；任务选路、委派、审阅及 shipping 继续使用官方插件。不要把整套插件复制进本仓库后另行维护。

首版交付中的项目验证技能位于 `.cursor/skills/verify-hire-workbench/`。Claude Code 的同名技能只是指向这个入口，避免维护两套验收说明。

## Claude Code + Magpie

在 Claude Code 中安装官方插件：

```text
/plugin marketplace add cursor/plugins
/plugin install pstack@cursor-plugins
/pstack:setup-pstack
```

以后在项目目录开启 Claude Code，使用 `/pstack:poteto-mode` 发起任务。官方适配将模型选择保存到 `~/.claude/rules/pstack-models.md`。具体以安装版本的 README 和 setup 输出为准。

本源码包不改写该文件，不提供伪造的模型 ID，也不包含 Magpie、Codync 或机器登录配置。模型别名与提供商的映射由各自运行环境管理；请依据所选提供商的文档配置真实模型 ID，并核实能力与可用性。角色名、运行时名或模型别名不等于实际调用的模型，不能从别名推断调用成功。

运行时支持 Claude Code 不代表拥有 Claude 模型。报告里分别记录运行时、提供商和实际模型；不能确认的字段写“未确认”。

## Cursor 与 Codex

Cursor 可按官方说明使用 `/add-plugin pstack`、`/setup-pstack`、`/poteto-mode`。本仓库的 `.cursor/rules/project.mdc` 只指向 `AGENTS.md`。

Codex 从 `AGENTS.md` 开始，读取项目验证技能文件并执行相同命令。官方 Codex 包装与原生 agent 映射仍需按实际安装版本核查；本项目不依赖未经验证的 Codex 专用 slash command。

## 接手一项开发任务

1. 阅读根目录 `AGENTS.md`、`docs/HANDOFF.md`、本次 spec 和 `docs/TEST-REPORT.md`。
2. 确定一个源码写入者，记录 base 和任务范围。需要并行研究时只读或隔离写入路径。
3. 按官方 pstack 选用合适 playbook，先验证关键假设再扩展。
4. 使用项目现有 `npm run verify` 和功能地图；行为变了就更新同一套检查。
5. 记录 head、证据、失败与未验证项，让独立审阅者从新上下文检查当前交付。

当官方流程需要项目验收时，读取 [verify-hire-workbench](../.cursor/skills/verify-hire-workbench/SKILL.md)。它覆盖启动、健康检查、用户路径、证据和清理，没有另一套任务调度器。

## 审阅与证据

交付记录至少能定位 spec、base、head 和证据。审阅结论使用 PASS、FAIL、BLOCKED。代码通过、真实模型通过、设备部署通过是不同事实，不合并成一个含糊的“全部通过”。

独立上下文审阅和跨模型审阅也不同。只有确认使用了另一模型家族，才能声称跨模型审阅；实际模型不明或没有运行时，记录 BLOCKED 与原因。

多阶段工作使用官方 `show-me-your-work` 的 TSV 日志。需要持久留档时放 `.audit/`，追加修正，不删除失败决策。架构文档解释现行选择，TSV 记录决策发生过程，不重复建立第二套日志。

## 可直接交给 AI 的提示词

```text
请接手 Hire Workbench。
先读取 AGENTS.md、docs/HANDOFF.md、specs/next.md 和 docs/TEST-REPORT.md。
沿用当前安装的 Lauren 官方 pstack，不复制或改写其 playbook。
本任务只指定一个源码写入者；研究和审阅可以独立委派。
先确认实际代码行为与数据结构，再实现 specs/next.md 的下一项工作。
沿用项目验证技能和 npm 脚本，保留 spec/base/head/证据。
不要把规则分析、mock provider、模型 API 联通和真实业务效果混为一谈。
完成后安排独立上下文审阅，给出 PASS/FAIL/BLOCKED；模型未知就明确说明。
不要改我的全局模型、插件或权限配置。
```

## 官方核查入口

核查日期为 2026-11-13。上游持续变化，升级插件时重新确认安装和调用方式。

- [官方 README 与安装方式](https://github.com/cursor/plugins/blob/main/pstack/README.md)
- [Claude Code 适配](https://github.com/cursor/plugins/blob/main/pstack/docs/harness/claude-code.md)
- [项目验证技能生成规范](https://github.com/cursor/plugins/blob/main/pstack/skills/create-verification-skill/SKILL.md)
- [验证与交付指南](https://github.com/cursor/plugins/blob/main/pstack/docs/guide/06-verify-and-ship.md)
- [决策过程留档](https://github.com/cursor/plugins/blob/main/pstack/skills/show-me-your-work/SKILL.md)
- [Codex 适配讨论 #601](https://github.com/cursor/plugins/issues/601)
- [Codex 安装与原生 Agent 请求 #734](https://github.com/cursor/plugins/issues/734)

这些链接是本项目接入依据，不是本项目运行证明。实际运行证明见测试报告与证据文件。
