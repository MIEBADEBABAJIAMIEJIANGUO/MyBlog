// 文件说明：客户端文件预校验，选中后立即拦截无效类型与超大文件。
import type { UploadConfig } from './types';

export interface ValidateResult {
	valid: boolean;
	reason?: string;
	code?: number;
}

/** 扩展名与 MIME 兜底映射 */
const EXT_MIME_MAP: Record<string, string[]> = {
	'.jpg': ['image/jpeg'],
	'.jpeg': ['image/jpeg'],
	'.png': ['image/png'],
	'.gif': ['image/gif'],
	'.webp': ['image/webp'],
	'.svg': ['image/svg+xml'],
	'.pdf': ['application/pdf'],
	'.txt': ['text/plain'],
	'.doc': ['application/msword'],
	'.docx': ['application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
	'.xls': ['application/vnd.ms-excel'],
	'.xlsx': ['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'],
	'.mp4': ['video/mp4'],
	'.webm': ['video/webm', 'audio/webm'],
	'.mov': ['video/quicktime'],
	'.mp3': ['audio/mpeg'],
	'.m4a': ['audio/mp4'],
	'.wav': ['audio/wav'],
	'.ogg': ['audio/ogg'],
};

/**
 * 从文件名提取小写扩展名。
 */
function getExtension(name: string): string {
	const dot = name.lastIndexOf('.');
	return dot >= 0 ? name.slice(dot).toLowerCase() : '';
}

/**
 * 判断文件 MIME 是否在白名单内（含扩展名兜底）。
 */
function isAllowedType(file: File, allowedMimeTypes: string[]): boolean {
	if (file.type && allowedMimeTypes.includes(file.type)) return true;
	const ext = getExtension(file.name);
	const fallbacks = EXT_MIME_MAP[ext];
	if (!fallbacks) return false;
	return fallbacks.some((m) => allowedMimeTypes.includes(m));
}

/**
 * 校验单个文件是否允许上传。
 */
export function validateFile(file: File, config: UploadConfig): ValidateResult {
	if (file.size > config.FILE_MAX_SIZE) {
		const msg = config.statusMessages[config.statusCodes.FILE_TOO_LARGE] ?? 'File too large';
		return { valid: false, reason: msg, code: config.statusCodes.FILE_TOO_LARGE };
	}
	if (!config.allowedMimeTypes?.length || !isAllowedType(file, config.allowedMimeTypes)) {
		const msg = config.statusMessages[config.statusCodes.UNSUPPORTED_TYPE] ?? 'Unsupported type';
		return { valid: false, reason: msg, code: config.statusCodes.UNSUPPORTED_TYPE };
	}
	return { valid: true };
}
