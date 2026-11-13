# 岗位与评价标准

## Sub-features

- 新建岗位，填写部门、地点、描述与评价标准。
- 编辑岗位和评价维度，设置权重、必需项和关键词。
- 保留岗位版本，并在新分析中使用新版本。

## How to get to it (user POV)

在“主导航”点击“岗位画像”，再点页面标题区域的“新建岗位”；填“岗位名称”“岗位职责与要求”及评价维度。已保存岗位详情里有“编辑岗位”。测试自己创建独立岗位，不依赖演示记录。

## Driving it with Playwright

执行 `npm run e2e -- --grep '完整浏览器路径'`。现有用例用以下实际入口创建岗位：

```ts
page.getByRole('navigation', { name: '主导航' }).getByRole('button', { name: '岗位画像' });
page.locator('.section-heading').getByRole('button', { name: '新建岗位', exact: true });
page.getByRole('dialog').getByLabel('岗位名称', { exact: true });
page.getByRole('dialog').getByLabel('维度权重 1', { exact: true });
page.getByRole('dialog').getByRole('button', { name: '保存岗位', exact: true });
```

浏览器用例验证权重合计错误时禁止保存，修正后创建成功，并截图 `01-job.png`。岗位编辑、版本增长和旧输入快照由 `tests/api.test.ts` 的 HTTP 工作流检查，当前浏览器用例没有编辑岗位步骤。

## Gotchas

只看到表单中的文本不代表已保存。保存失败必须在界面显示错误。新建岗位按钮在空状态和标题区可能同时存在，测试应限定到 `.section-heading`。不要直接修改 SQLite 绕过岗位 API。权重总和必须为 100。
