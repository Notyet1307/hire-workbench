import { extname } from 'node:path';
import mammoth from 'mammoth';
import { extractText, getDocumentProxy } from 'unpdf';
import { assessTextReadability, fromPlainText } from '../vendor/harly/document.js';

export interface ParseResult { text: string; status: 'ready' | 'needs_text'; message: string | null }
export const MAX_RESUME_BYTES = 8 * 1024 * 1024;
const MAX_TEXT_CHARS = 80_000;

/** Check DOCX central-directory sizes before allowing Mammoth to inflate XML. */
function checkDocxSize(buffer: Buffer): void {
  let eocd = -1;
  for (let offset = buffer.length - 22; offset >= Math.max(0, buffer.length - 65_557); offset--) {
    if (buffer.readUInt32LE(offset) === 0x06054b50) { eocd = offset; break; }
  }
  if (eocd < 0 || buffer.readUInt16LE(eocd + 4) !== 0 || buffer.readUInt16LE(eocd + 6) !== 0) throw new Error('Invalid DOCX archive');
  const entries = buffer.readUInt16LE(eocd + 10);
  const directorySize = buffer.readUInt32LE(eocd + 12);
  let offset = buffer.readUInt32LE(eocd + 16);
  const directoryEnd = offset + directorySize;
  if (entries > 2000 || directoryEnd > eocd) throw new Error('DOCX archive exceeds limit');
  let unpacked = 0;
  for (let entry = 0; entry < entries; entry++) {
    if (offset + 46 > directoryEnd || buffer.readUInt32LE(offset) !== 0x02014b50) throw new Error('Invalid DOCX directory');
    unpacked += buffer.readUInt32LE(offset + 24);
    if (unpacked > 20 * 1024 * 1024) throw new Error('DOCX expands beyond limit');
    offset += 46 + buffer.readUInt16LE(offset + 28) + buffer.readUInt16LE(offset + 30) + buffer.readUInt16LE(offset + 32);
  }
  if (offset !== directoryEnd) throw new Error('Invalid DOCX directory size');
}

function resultFor(rawText: string): ParseResult {
  const text = rawText.replace(/\r\n?/g, '\n').replace(/\u0000/g, '').trim();
  if (text.length > MAX_TEXT_CHARS) return { text: '', status: 'needs_text', message: '提取文字超过 80,000 字符，请精简简历后重新导入，或粘贴需要分析的内容。' };
  // Reused upstream module is unmodified; the application owns user-facing
  // diagnostics. Blocks/readability do not imply semantic resume parsing.
  const document = fromPlainText({ text });
  if (!assessTextReadability(document.plainText).readable) return { text: '', status: 'needs_text', message: '未提取到足够的可用文字。文件可能是扫描件、图片、乱码或内容过短；本版本未启用 OCR，请粘贴至少 50 字符的简历文字。' };
  return { text: document.plainText, status: 'ready', message: null };
}

/**
 * Text extraction only: PDF text layer, DOCX paragraphs, UTF-8/UTF-16LE TXT.
 * Scanned PDFs never silently become successful analyses. No OCR is claimed.
 * The 15s async deadline is not a process sandbox; hostile documents should be
 * moved into isolated worker processes before opening a public upload service.
 */
export async function parseResume(buffer: Buffer, filename: string): Promise<ParseResult> {
  if (buffer.length === 0 || buffer.length > MAX_RESUME_BYTES) throw new Error('简历文件须为 1 字节至 8 MB。');
  const extension = extname(filename).toLowerCase();
  if (!['.pdf', '.docx', '.txt'].includes(extension)) throw new Error('仅支持 PDF、DOCX、TXT；旧版 DOC 或图片请先转换或粘贴文字。');
  let timer: ReturnType<typeof setTimeout> | undefined;
  let pdf: Awaited<ReturnType<typeof getDocumentProxy>> | undefined;
  let timedOut = false;
  try {
    const operation = async (): Promise<string> => {
      if (extension === '.txt') {
        if (buffer[0] === 0xff && buffer[1] === 0xfe) return buffer.subarray(2).toString('utf16le');
        return new TextDecoder('utf-8', { fatal: true }).decode(buffer);
      }
      if (extension === '.docx') {
        checkDocxSize(buffer);
        return (await mammoth.extractRawText({ buffer })).value;
      }
      if (!buffer.subarray(0, 1024).includes(Buffer.from('%PDF-'))) throw new Error('Invalid PDF header');
      pdf = await getDocumentProxy(new Uint8Array(buffer), { maxImageSize: 16_777_216 });
      if (timedOut) { await pdf.loadingTask.destroy(); throw new Error('Parse timed out'); }
      if (pdf.numPages > 50) throw new Error('PDF page limit exceeded');
      return (await extractText(pdf, { mergePages: true })).text;
    };
    const text = await Promise.race([
      operation(),
      new Promise<never>((_, reject) => { timer = setTimeout(() => { timedOut = true; reject(new Error('Parse timed out')); }, 15_000); }),
    ]);
    return resultFor(text);
  } catch {
    return { text: '', status: 'needs_text', message: '文件文字提取失败，可能存在格式错误、加密、编码或资源限制。请导出无密码的 PDF/DOCX、UTF-8 TXT，或直接粘贴简历文字。' };
  } finally {
    if (timer) clearTimeout(timer);
    if (pdf) await pdf.loadingTask.destroy().catch(() => undefined);
  }
}
