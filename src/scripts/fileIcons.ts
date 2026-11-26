// 文件说明：文件类型 iconfont 图标映射，基于阿里矢量图库 Symbol 引用。
/** iconfont Symbol 脚本地址（阿里 CDN，项目 id 1187166） */
export const ICONFONT_SCRIPT = '/iconfont/file-type.js';

/** 文件后缀到 iconfont symbol id 的映射 */
const EXT_ICON_MAP: Record<string, string> = {
	PDF: 'icon-doc-pdf',
	DOC: 'icon-doc-word',
	DOCX: 'icon-doc-word',
	XLS: 'icon-doc-excel',
	XLSX: 'icon-doc-excel',
	TXT: 'icon-doc-file',
	JPG: 'icon-picture',
	JPEG: 'icon-picture',
	PNG: 'icon-picture',
	GIF: 'icon-picture',
	WEBP: 'icon-picture',
	SVG: 'icon-picture',
	MP4: 'icon-media-video',
	WEBM: 'icon-media-video',
	MOV: 'icon-media-video',
	MP3: 'icon-media-audio',
	M4A: 'icon-media-audio',
	WAV: 'icon-media-audio',
	OGG: 'icon-media-audio',
};

/** MIME 到后缀名的兜底映射 */
const MIME_EXT_MAP: Record<string, string> = {
	'application/pdf': 'PDF',
	'text/plain': 'TXT',
	'application/msword': 'DOC',
	'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'DOCX',
	'application/vnd.ms-excel': 'XLS',
	'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'XLSX',
	'image/jpeg': 'JPG',
	'image/png': 'PNG',
	'image/gif': 'GIF',
	'image/webp': 'WEBP',
	'image/svg+xml': 'SVG',
	'video/mp4': 'MP4',
	'video/webm': 'WEBM',
	'video/quicktime': 'MOV',
	'audio/mpeg': 'MP3',
	'audio/mp4': 'M4A',
	'audio/wav': 'WAV',
	'audio/ogg': 'OGG',
	'audio/webm': 'WEBM',
};

/**
 * 从文件名或 MIME 解析展示用后缀名（如 PDF、DOCX）。
 */
export function getFileExtension(originalName: string, mimeType?: string): string {
	const match = originalName.match(/\.([^.]+)$/i);
	if (match) return match[1].toUpperCase();
	if (mimeType && MIME_EXT_MAP[mimeType]) return MIME_EXT_MAP[mimeType];
	return 'FILE';
}

/**
 * 根据后缀名返回 iconfont Symbol 的 SVG HTML。
 */
export function getFileIconHtml(extension: string): string {
	const symbolId = EXT_ICON_MAP[extension.toUpperCase()] ?? 'icon-file';
	return `<svg class="file-type-icon shrink-0" aria-hidden="true"><use href="#${symbolId}" xlink:href="#${symbolId}"></use></svg>`;
}

/**
 * 动态加载 iconfont Symbol 脚本（仅加载一次）。
 */
export function ensureIconfontLoaded(): void {
	if (typeof document === 'undefined') return;
	if (document.querySelector(`script[data-iconfont-file-type]`)) return;
	const script = document.createElement('script');
	script.src = ICONFONT_SCRIPT;
	script.dataset.iconfontFileType = 'true';
	document.head.appendChild(script);
}
