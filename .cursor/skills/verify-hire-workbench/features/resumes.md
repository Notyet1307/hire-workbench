# 候选人与简历

## Sub-features

- 添加候选人并粘贴简历正文。
- 上传 PDF、DOCX 或 TXT。
- 每次保存候选资料产生新版本，包括只改联系方式。
- 没有可用文本时明确提示补充正文。

## How to get to it (user POV)

进入“候选人”，点击标题区域“添加候选人”。默认填写姓名与正文，也可切换“上传简历文件”页签。详情页可编辑资料并查看原文和解析状态。

## Driving it with Playwright

执行 `npm run e2e -- --grep '完整浏览器路径'` 覆盖手工录入；执行 `npm run e2e -- --grep '简历文件上传'` 覆盖 TXT 上传。实际选择器包括：

```ts
page.locator('.section-heading').getByRole('button', { name: '添加候选人', exact: true });
page.getByRole('dialog').getByLabel('候选人姓名', { exact: true });
page.getByRole('dialog').getByLabel('简历原文', { exact: true });
page.getByRole('dialog').getByRole('tab', { name: '上传简历文件' });
page.getByRole('dialog').getByLabel('简历文件', { exact: true });
page.getByRole('dialog').getByRole('button', { name: '上传并解析', exact: true });
```

上传用例通过公开 `/api/workspace` 回读确认正文与 `parseStatus=ready`。`tests/parse.test.ts` 检查 PDF 文本层、中文 DOCX、TXT 与无文本文件，PDF/DOCX 当前没有浏览器上传用例。

## Gotchas

当前没有 OCR。扫描件和无可用正文的 PDF 会进入待补充正文状态；空文件、超大文件和不支持的类型会明确拒绝。不能显示“已解析”后返回空结果。上传后只保留正文、文件名和版本，不归档二进制。真实简历不用于源码测试夹具。
