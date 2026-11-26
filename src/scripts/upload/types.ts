// 文件说明：上传模块共享类型定义，包含配置、API 响应与上传任务项。
export type UploadItemStatus = 'pending' | 'uploading' | 'success' | 'failed';

export interface UploadConfig {
	FILE_CHUNK_MAXSIZE: number;
	FILE_CHUNK_SIZE: number;
	FILE_MAX_SIZE: number;
	MAX_CONCURRENT_UPLOADS: number;
	MAX_GLOBAL_IN_FLIGHT: number;
	MAX_CONCURRENT_CHUNKS: number;
	allowedMimeTypes: string[];
	statusCodes: Record<string, number>;
	statusMessages: Record<number, string>;
}

export interface ApiResponse<T = unknown> {
	code: number;
	success: boolean;
	message: string;
	data?: T;
}

export interface SearchSnippet {
	before: string;
	match: string;
	after: string;
}

export interface UploadedFileInfo {
	filename: string;
	originalName: string;
	url: string;
	size: number;
	uploadedAt: string;
	mimeType?: string;
	searchSnippets?: SearchSnippet[];
	matchCount?: number;
}

export interface FileListResponse {
	files: UploadedFileInfo[];
	total: number;
	page: number;
	pageSize: number;
}

export interface FileManagerLabels {
	title: string;
	description: string;
	search: string;
	searchModeName: string;
	searchModeOcr: string;
	searchPlaceholderOcr: string;
	searchOcrPendingHint: string;
	searchMatchCount: string;
	filterAll: string;
	filterImage: string;
	filterDocument: string;
	filterVideo: string;
	filterAudio: string;
	tabAll: string;
	empty: string;
	pageInfo: string;
	prev: string;
	next: string;
	copyLink: string;
	delete: string;
	preview: string;
	open: string;
	download: string;
	copied: string;
	deleteConfirm: string;
	bulkDelete: string;
	bulkSelected: string;
	bulkDeleteConfirm: string;
	selectAll: string;
	colName: string;
	colType: string;
	colCategory: string;
	colExpiry: string;
	colSize: string;
	colUploadedAt: string;
	colActions: string;
	typeFile: string;
	categoryImage: string;
	categoryDocument: string;
	categoryOther: string;
	expiryNone: string;
	serverOffline: string;
	previewClose: string;
	previewLoading: string;
	previewUnsupported: string;
	previewLoadError: string;
	previewOpenNew: string;
	confirmCancel: string;
	confirmOk: string;
}

export interface UploadItem {
	id: string;
	fileName: string;
	fileSize: number;
	status: UploadItemStatus;
	progress: number;
	code?: number;
	errorMessage?: string;
	url?: string;
	uploadId?: string;
	speedText?: string;
	etaText?: string;
}

export interface UploadLabels {
	title: string;
	description: string;
	dropzone: string;
	select: string;
	submit: string;
	uploading: string;
	success: string;
	error: string;
	serverOffline: string;
	fileInfo: string;
	preview: string;
	listTitle: string;
	statusUploading: string;
	statusSuccess: string;
	statusFailed: string;
	statusPending: string;
	fileInfoItem: string;
	fileInfoMore: string;
	remove: string;
	retry: string;
	progress: string;
	speedEta: string;
	errorCode: string;
	emptyList: string;
	validationFailed: string;
	copyLink: string;
	delete: string;
	copied: string;
	deleteConfirm: string;
	clearCompleted: string;
	restoreFailed: string;
	goToFiles: string;
}

export type ProgressCallback = (percent: number, loaded: number, total: number) => void;

// 原代码注释：export const API_BASE = 'http://localhost:3001';
let apiBase: string =
	(typeof import.meta !== 'undefined' &&
		(import.meta.env.PUBLIC_UPLOAD_API as string | undefined)) ||
	'http://localhost:3001';

/** 获取当前上传 API 根地址 */
export function getApiBase(): string {
	return apiBase;
}

/** 设置上传 API 根地址（可由 DOM data-api-base 覆盖） */
export function setApiBase(url: string): void {
	if (url) apiBase = url.replace(/\/$/, '');
}

/** 同时进行的上传任务数量上限 */
export const MAX_CONCURRENT_UPLOADS = 3;

/** 全局同时进行的上传 HTTP 请求上限 */
export const MAX_GLOBAL_IN_FLIGHT = 6;

/** 单个大文件内同时上传的分片数量上限 */
export const MAX_CONCURRENT_CHUNKS = 4;

/** 单分片 / 单文件上传失败时的最大重试次数 */
export const MAX_CHUNK_RETRIES = 3;

/** 重试指数退避的基础等待毫秒数 */
export const RETRY_BASE_DELAY_MS = 500;

export interface ChunkProgress {
	uploadId: string;
	totalChunks: number;
	uploadedChunks: number[];
}
