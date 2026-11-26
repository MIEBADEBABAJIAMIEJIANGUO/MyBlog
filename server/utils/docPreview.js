// 文件说明：legacy .doc 文件正文提取与 HTML 段落转换，供预览 API 使用。
import WordExtractor from 'word-extractor';

const extractor = new WordExtractor();

/**
 * 转义 HTML 特殊字符，防止 XSS。
 */
function escapeHtml(text) {
	return text
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;')
		.replace(/'/g, '&#39;');
}

/**
 * 将纯文本按空行拆段并转为 HTML 段落。
 */
function textToParagraphHtml(text) {
	const paragraphs = text
		.split(/\r?\n\r?\n+/)
		.map((p) => p.trim())
		.filter(Boolean);

	if (paragraphs.length === 0) {
		return '<p></p>';
	}

	return paragraphs.map((p) => `<p>${escapeHtml(p).replace(/\r?\n/g, '<br>')}</p>`).join('');
}

/**
 * 从 .doc 二进制 Buffer 提取纯文本正文。
 */
export async function docBufferToPlainText(buffer) {
	const doc = await extractor.extract(buffer);
	return doc.getBody() ?? '';
}

/**
 * 从 .doc 二进制 Buffer 提取正文并转为预览 HTML。
 */
export async function docBufferToPreviewHtml(buffer) {
	const doc = await extractor.extract(buffer);
	const body = doc.getBody() ?? '';
	return textToParagraphHtml(body);
}
