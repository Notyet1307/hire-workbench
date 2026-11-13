# 公开发布整理

此版本从交付源码创建干净初始 Git 提交，不继承原始私有提交历史。

- 泛化个人模型别名和提供商映射；移除旧 source-history.bundle 和原包清单。
- 保留源码、锁文件、测试、Lauren 官方 pstack 接入说明、项目验证技能与许可。
- 原始浏览器证据中的工作区绝对路径改为占位符，历史测试结果未改变。
- 没有扩展产品功能；当前 Git HEAD 是公开发布基线，旧验收 SHA 仅用于历史证据。

本次在 Linux、Node.js v24.22.1 实际重新执行：
- npm ci --ignore-scripts：安装 263 个包成功。
- npm run typecheck：通过。
- npm test：28/28 通过。
- npm run build：通过。

证据位于 evidence/publication/。本次未重新运行浏览器路径、重启持久化、真实模型调用、Mac 或 Docker 部署验证。原始交付的浏览器与重启结果见 docs/TEST-REPORT.md，不把其表述为本次重跑。

安装出现传递依赖 glob 弃用警告；未进行完整依赖安全审计，不声明无漏洞。
