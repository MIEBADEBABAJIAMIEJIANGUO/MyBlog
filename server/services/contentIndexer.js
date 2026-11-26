// 文件说明：上传文件正文索引服务，OCR 与文本提取后写入 MongoDB contentIndex 字段。
import mammoth from 'mammoth';
import { PDFParse } from 'pdf-parse';
import { createWorker } from 'tesseract.js';
import * as XLSX from 'xlsx';
import { findFileDocByFilename, updateContentIndex } from '../repositories/fileRepository.js';
import { getObjectBuffer } from '../storage/minio.js';
import { docBufferToPlainText } from '../utils/docPreview.js';

/** 单文件 contentIndex 最大字符数（约 200KB） */
const CONTENT_INDEX_MAX = 200 * 1024;

/** PDF 文本层过短时 OCR 的最大页数 */
const PDF_OCR_MAX_PAGES = 3;

/** PDF 判定为扫描件的正文长度阈值 */
const PDF_TEXT_MIN_LENGTH = 32;

/** Tesseract  worker 单例 */
let ocrWorkerPromise = null;

/**
 * 获取或创建 Tesseract OCR worker（chi_sim + eng）。
 */
async function getOcrWorker() {
	if (!ocrWorkerPromise) {
		ocrWorkerPromise = (async () => {
			const worker = await createWorker('chi_sim+eng');
			return worker;
		})();
	}
	return ocrWorkerPromise;
}

/**
 * 截断索引文本至上限。
 */
function truncateIndexText(text) {
	if (!text || text.length <= CONTENT_INDEX_MAX) return text ?? '';
	return text.slice(0, CONTENT_INDEX_MAX);
}

/**
 * 对图片 Buffer 执行 OCR 识别。
 */
async function ocrImageBuffer(buffer) {
	const worker = await getOcrWorker();
	const { data } = await worker.recognize(buffer);
	return data.text ?? '';
}

/**
 * 使用 pdfjs + napi-rs canvas 渲染 PDF 前几页并 OCR。
 */
async function ocrPdfPages(buffer, maxPages = PDF_OCR_MAX_PAGES) {
	const { getDocument } = await import('pdfjs-dist/legacy/build/pdf.mjs');
	const { createCanvas } = await import('@napi-rs/canvas');

	const pdf = await getDocument({ data: new Uint8Array(buffer), useSystemFonts: true }).promise;
	const pageCount = Math.min(pdf.numPages, maxPages);
	let combined = '';

	try {
		for (let i = 1; i <= pageCount; i++) {
			const page = await pdf.getPage(i);
			const viewport = page.getViewport({ scale: 2 });
			const canvas = createCanvas(Math.ceil(viewport.width), Math.ceil(viewport.height));
			const context = canvas.getContext('2d');
			await page.render({
				canvasContext: context,
				viewport,
				canvas,
			}).promise;
			const pngBuffer = canvas.toBuffer('image/png');
			combined += `${await ocrImageBuffer(pngBuffer)}\n`;
			page.cleanup();
		}
	} finally {
		await pdf.destroy();
	}

	return combined.trim();
}

/**
 * 从 PDF Buffer 提取文本（文本层优先，不足则 OCR 前几页）。
 */
async function extractPdfText(buffer) {
	const parser = new PDFParse({ data: buffer });
	try {
		const textResult = await parser.getText();
		const text = (textResult.text ?? '').trim();
		if (text.length >= PDF_TEXT_MIN_LENGTH) {
			return text;
		}
		try {
			const ocrText = await ocrPdfPages(buffer);
			return ocrText || text;
		} catch (err) {
			console.warn('[content-indexer] PDF OCR fallback failed:', err.message);
			return text;
		}
	} finally {
		await parser.destroy();
	}
}

/**
 * 从 Excel Buffer 提取全部工作表单元格文本。
 */
function extractSpreadsheetText(buffer) {
	const workbook = XLSX.read(buffer, { type: 'buffer' });
	const parts = [];
	for (const name of workbook.SheetNames) {
		const sheet = workbook.Sheets[name];
		if (!sheet) continue;
		const csv = XLSX.utils.sheet_to_csv(sheet, { blankrows: false });
		if (csv.trim()) {
			parts.push(csv);
		}
	}
	return parts.join('\n');
}

/**
 * 判断 MIME 是否支持正文索引。
 */
function isIndexableMime(mimeType) {
	if (!mimeType) return false;
	if (mimeType.startsWith('image/')) {
		return mimeType !== 'image/svg+xml';
	}
	if (mimeType === 'application/pdf') return true;
	if (mimeType === 'text/plain') return true;
	if (mimeType === 'application/msword') return true;
	if (mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
		return true;
	}
	if (
		mimeType === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
		mimeType === 'application/vnd.ms-excel'
	) {
		return true;
	}
	return false;
}

/**
 * 根据 MIME 与 Buffer 提取可搜索文本。
 */
export async function extractSearchText(mimeType, buffer) {
	if (!isIndexableMime(mimeType)) {
		return { text: '', status: 'skipped' };
	}

	try {
		let text = '';

		if (mimeType.startsWith('image/')) {
			text = await ocrImageBuffer(buffer);
		} else if (mimeType === 'application/pdf') {
			text = await extractPdfText(buffer);
		} else if (mimeType === 'text/plain') {
			text = buffer.toString('utf8');
		} else if (mimeType === 'application/msword') {
			text = await docBufferToPlainText(buffer);
		} else if (mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
			const result = await mammoth.extractRawText({ buffer });
			text = result.value ?? '';
		} else if (
			mimeType === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
			mimeType === 'application/vnd.ms-excel'
		) {
			text = extractSpreadsheetText(buffer);
		}

		return { text: truncateIndexText(text.trim()), status: 'done' };
	} catch (err) {
		console.error('[content-indexer] extract failed:', mimeType, err.message);
		return { text: '', status: 'failed' };
	}
}

/**
 * 异步索引单个文件正文，供上传后 fire-and-forget 调用。
 */
export async function indexFileContent(filename) {
	const doc = await findFileDocByFilename(filename);
	if (!doc) return;

	await updateContentIndex(filename, { contentIndex: doc.contentIndex ?? '', indexStatus: 'processing' });

	try {
		const buffer = await getObjectBuffer(doc.objectKey);
		const { text, status } = await extractSearchText(doc.mimeType, buffer);
		await updateContentIndex(filename, { contentIndex: text, indexStatus: status });
	} catch (err) {
		console.error('[content-indexer]', filename, err.message);
		await updateContentIndex(filename, { contentIndex: '', indexStatus: 'failed' });
	}
}
