# Claude Code 项目入口

先读取并遵循 `AGENTS.md`。它是本项目的唯一事实入口。

已安装官方 pstack 时使用 `/pstack:poteto-mode`，具体接入见 `docs/PSTACK.md`。项目验证入口为 `.cursor/skills/verify-hire-workbench/SKILL.md`；`.claude/skills/verify-hire-workbench/` 只负责指向它，不维护另一套验收规则。

Claude Code 与实际模型分开记录。经 Magpie 运行不代表使用 Claude 模型；不要覆盖用户现有模型配置。
