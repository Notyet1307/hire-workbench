# 开源来源与许可

## 本项目与参考产品

Hire Workbench 的新写代码以根目录 MIT 许可证发布。项目参考了 [WhaleHire 岗位画像](https://whalehire.docs.baizhi.cloud/node/019b26a0-d113-779b-a84c-e2867e024324)、[使用场景](https://whalehire.docs.baizhi.cloud/node/01999a25-b8a3-78dd-b7ba-fbf572fe6e3a) 和 [面试管理](https://whalehire.docs.baizhi.cloud/node/019b345c-4811-796b-adff-b544da7541d7) 的业务方向。未复制其商标、Logo、网页截图或专有产品源码，也不代表官方版本。

## Harly：已实际复用的源文件

- 上游：[Vytral/harly](https://github.com/Vytral/harly)
- 固定提交：`899cddb32cd30f4d35c96fab915cf069695095c0`
- 来源文件：`apps/web/src/lib/evaluation/parsing/document.ts`
- 本地位置：`src/vendor/harly/document.ts`
- 复用内容：Unicode 可读性校验、原文分块、文档 provider 与 OCR 接口类型。
- 文件未修改；原始 MIT 许可见 `src/vendor/harly/LICENSE`，来源记录见 `src/vendor/harly/ORIGIN.json`。

原版权人为 `Copyright (c) 2026 Maximiliano M (https://molret.dev)`。这些版权和许可随源码保留。

Harly 全量 ATS、鉴权、数据库、招聘门户和原评分引擎没有被搬入本项目。中文匹配、持久化、工作台及提供商适配是本项目实现，不能把 Harly 的功能范围当作本交付范围。

## npm 组件

实际版本由 `package-lock.json` 锁定，安装使用 `npm ci`。下表是本次安装中直接运行依赖的许可；完整依赖仍受各自包内许可证约束。

| 组件 | 许可 | 用途 |
|---|---|---|
| Fastify、@fastify/cookie、@fastify/multipart、@fastify/static | MIT | HTTP、会话、文件上传、静态资源 |
| React、React DOM | MIT | 中文界面 |
| Zod | MIT | 输入与模型输出约束 |
| Mammoth | BSD-2-Clause | DOCX 文字提取 |
| unpdf | MIT | PDF 文本层提取；其内置 PDF.js 另遵循 Apache-2.0 |
| lucide-react | ISC | 界面图标 |

TypeScript、Vite 和 Playwright 为开发工具；其许可随安装包保留。源码包不包含 `node_modules`、浏览器二进制或外部模型权重。

## pstack

参考 [Lauren Tan 的官方 pstack](https://github.com/cursor/plugins/tree/main/pstack) 的项目验证规范。没有把整个插件源码复制进项目，也没有声称已替用户安装或配置全局插件。仓库仅包含此项目的验证说明、功能地图和接手入口，具体依据见 `docs/PSTACK.md`。
