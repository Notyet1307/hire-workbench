import test from 'node:test';
import assert from 'node:assert/strict';
import { deflateRawSync } from 'node:zlib';
import { parseResume } from '../src/server/parse.js';

const chinese = '示例候选人\n项目经历\n使用 TypeScript 开发招聘工作台，设计岗位标准与原文证据引用；使用 Docker 部署服务，排查数据库连接故障并记录处理过程。所有内容均为测试合成资料。';

function crc32(buffer: Buffer): number {
  let crc = 0xffffffff;
  for (const value of buffer) { crc ^= value; for (let bit = 0; bit < 8; bit++) crc = crc & 1 ? (crc >>> 1) ^ 0xedb88320 : crc >>> 1; }
  return (crc ^ 0xffffffff) >>> 0;
}
function zip(files: Record<string, string>): Buffer {
  const locals: Buffer[] = [], central: Buffer[] = []; let position = 0;
  for (const [name, value] of Object.entries(files)) {
    const filename = Buffer.from(name), plain = Buffer.from(value), compressed = deflateRawSync(plain), crc = crc32(plain);
    const local = Buffer.alloc(30); local.writeUInt32LE(0x04034b50); local.writeUInt16LE(20, 4); local.writeUInt16LE(8, 8); local.writeUInt32LE(crc, 14); local.writeUInt32LE(compressed.length, 18); local.writeUInt32LE(plain.length, 22); local.writeUInt16LE(filename.length, 26);
    const header = Buffer.alloc(46); header.writeUInt32LE(0x02014b50); header.writeUInt16LE(20, 4); header.writeUInt16LE(20, 6); header.writeUInt16LE(8, 10); header.writeUInt32LE(crc, 16); header.writeUInt32LE(compressed.length, 20); header.writeUInt32LE(plain.length, 24); header.writeUInt16LE(filename.length, 28); header.writeUInt32LE(position, 42);
    locals.push(local, filename, compressed); central.push(header, filename); position += local.length + filename.length + compressed.length;
  }
  const directory = Buffer.concat(central), end = Buffer.alloc(22); end.writeUInt32LE(0x06054b50); end.writeUInt16LE(Object.keys(files).length, 8); end.writeUInt16LE(Object.keys(files).length, 10); end.writeUInt32LE(directory.length, 12); end.writeUInt32LE(position, 16);
  return Buffer.concat([...locals, directory, end]);
}
function docx(text: string): Buffer {
  return zip({
    '[Content_Types].xml': '<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>',
    '_rels/.rels': '<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>',
    'word/document.xml': `<?xml version="1.0" encoding="UTF-8"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${text.split('\n').map(line => `<w:p><w:r><w:t>${line}</w:t></w:r></w:p>`).join('')}</w:body></w:document>`,
  });
}
function pdf(contents: string): Buffer {
  const stream = contents ? `BT /F1 10 Tf 40 700 Td (${contents}) Tj ET` : '';
  const objects = ['<< /Type /Catalog /Pages 2 0 R >>', '<< /Type /Pages /Kids [3 0 R] /Count 1 >>', '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>', '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>', `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`];
  let value = '%PDF-1.4\n'; const offsets = [0];
  objects.forEach((object, index) => { offsets.push(Buffer.byteLength(value)); value += `${index + 1} 0 obj\n${object}\nendobj\n`; });
  const xref = Buffer.byteLength(value); value += `xref\n0 6\n0000000000 65535 f \n${offsets.slice(1).map(offset => `${String(offset).padStart(10, '0')} 00000 n `).join('\n')}\ntrailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return Buffer.from(value);
}

test('真实 UTF-8 中文 TXT 可以读取并保持证据文本', async () => {
  const result = await parseResume(Buffer.from(chinese), 'synthetic.txt');
  assert.equal(result.status, 'ready'); assert.equal(result.text, chinese);
});
test('真实 DOCX 中文段落通过 Mammoth 提取', async () => {
  const result = await parseResume(docx(chinese), 'synthetic.docx');
  assert.equal(result.status, 'ready'); assert.match(result.text, /TypeScript/); assert.match(result.text, /原文证据引用/);
});
test('真实 PDF 文本层可以提取', async () => {
  const result = await parseResume(pdf('Synthetic resume: Built TypeScript applications and deployed Docker services with documented database incident recovery.'), 'synthetic.pdf');
  assert.equal(result.status, 'ready'); assert.match(result.text, /TypeScript/);
});
test('无文字 PDF 与损坏文件进入待补文字，不生成虚假内容', async () => {
  const scanned = await parseResume(pdf(''), 'no-text.pdf');
  assert.equal(scanned.status, 'needs_text'); assert.equal(scanned.text, ''); assert.match(scanned.message!, /未启用 OCR/);
  const corrupt = await parseResume(Buffer.from('not-a-docx'), 'broken.docx');
  assert.equal(corrupt.status, 'needs_text'); assert.equal(corrupt.text, '');
});
test('旧版 DOC、超大文件与空文件明确拒绝', async () => {
  await assert.rejects(parseResume(Buffer.from(chinese), 'synthetic.doc'), /仅支持/);
  await assert.rejects(parseResume(Buffer.alloc(8 * 1024 * 1024 + 1), 'big.txt'), /8 MB/);
  await assert.rejects(parseResume(Buffer.alloc(0), 'empty.txt'), /1 字节/);
});
