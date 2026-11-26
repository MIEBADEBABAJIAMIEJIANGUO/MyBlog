// 文件说明：文件预览弹窗的事件桥接与 MIME 类型到预览模式的映射。
import type { SearchSnippet } from './upload/types';

export const FILE_PREVIEW_EVENT = 'file-preview-open';

/** 弹窗预览支持的渲染模式 */
export type PreviewKind = 'image' | 'svg' | 'pdf' | 'text' | 'doc' | 'docx' | 'xlsx' | 'video' | 'audio' | 'unsupported';

/** 打开预览弹窗时传递的文件信息 */
export interface PreviewFilePayload {
	url: string;
	filename: string;
	originalName: string;
	mimeType?: string;
	highlightQuery?: string;
	searchSnippets?: SearchSnippet[];
	matchCount?: number;
}

/** 预览弹窗文案 */
export interface FilePreviewLabels {
	close: string;
	loading: string;
	unsupported: string;
	loadError: string;
	openNew: string;
	download: string;
	searchMatchCount: string;
	searchHitSummary: string;
}

/**
 * 根据 MIME 类型判断预览渲染模式。
 */
export function getPreviewKind(mimeType?: string): PreviewKind {
	if (!mimeType) return 'unsupported';
	if (mimeType.startsWith('video/')) return 'video';
	if (mimeType.startsWith('audio/')) return 'audio';
	if (mimeType === 'image/svg+xml') return 'svg';
	if (mimeType.startsWith('image/')) return 'image';
	if (mimeType === 'application/pdf') return 'pdf';
	if (mimeType === 'text/plain') return 'text';
	if (mimeType === 'application/msword') {
		return 'doc';
	}
	if (mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
		return 'docx';
	}
	if (mimeType === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet') {
		return 'xlsx';
	}
	return 'unsupported';
}

/**
 * 通过自定义事件触发文件预览弹窗。
 */
export function openFilePreview(payload: PreviewFilePayload): void {
	window.dispatchEvent(new CustomEvent(FILE_PREVIEW_EVENT, { detail: payload }));
}
