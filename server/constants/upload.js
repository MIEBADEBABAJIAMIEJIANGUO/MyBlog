// 文件说明：上传相关常量与服务端状态码定义，供路由与前端 config 接口共享。
/** 单文件上传上限，超过此值走分片上传 */
export const FILE_CHUNK_MAXSIZE = 10 * 1024 * 1024;

/** 每个分片的大小 */
export const FILE_CHUNK_SIZE = 2 * 1024 * 1024;

/** 分片模式允许的最大文件总大小 */
export const FILE_MAX_SIZE = 500 * 1024 * 1024;

/** 未完成分片会话最大保留时间（24 小时） */
export const CHUNK_SESSION_MAX_AGE_MS = 24 * 60 * 60 * 1000;

/** 同时进行的上传任务数量上限 */
export const MAX_CONCURRENT_UPLOADS = 3;

/** 全局同时进行的上传 HTTP 请求上限 */
export const MAX_GLOBAL_IN_FLIGHT = 6;

/** 单个大文件内同时上传的分片数量上限 */
export const MAX_CONCURRENT_CHUNKS = 4;

/** 服务端定义的上传状态码 */
export const UploadStatusCode = {
	SUCCESS: 0,
	NO_FILE: 1001,
	FILE_TOO_LARGE: 1002,
	UNSUPPORTED_TYPE: 1003,
	SERVER_ERROR: 1004,
	CHUNK_INIT_FAILED: 2001,
	CHUNK_INDEX_INVALID: 2002,
	CHUNK_MISSING: 2003,
	MERGE_FAILED: 2004,
	UPLOAD_ID_NOT_FOUND: 2005,
};

/** 状态码对应的默认提示文案（英文，响应 message 字段使用） */
export const StatusMessages = {
	[UploadStatusCode.SUCCESS]: 'Upload successful',
	[UploadStatusCode.NO_FILE]: 'No file uploaded',
	[UploadStatusCode.FILE_TOO_LARGE]: 'File exceeds size limit',
	[UploadStatusCode.UNSUPPORTED_TYPE]: 'Unsupported file type',
	[UploadStatusCode.SERVER_ERROR]: 'Internal server error',
	[UploadStatusCode.CHUNK_INIT_FAILED]: 'Failed to initialize chunked upload',
	[UploadStatusCode.CHUNK_INDEX_INVALID]: 'Invalid chunk index',
	[UploadStatusCode.CHUNK_MISSING]: 'Missing chunk data',
	[UploadStatusCode.MERGE_FAILED]: 'Failed to merge chunks',
	[UploadStatusCode.UPLOAD_ID_NOT_FOUND]: 'Upload session not found',
};

/** 允许上传的 MIME 类型（图片 + 常见文档 + 音视频） */
export const allowedMimeTypes = [
	'image/jpeg',
	'image/png',
	'image/gif',
	'image/webp',
	'image/svg+xml',
	'application/pdf',
	'text/plain',
	'application/msword',
	'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
	'application/vnd.ms-excel',
	'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
	'video/mp4',
	'video/webm',
	'video/quicktime',
	'audio/mpeg',
	'audio/mp4',
	'audio/wav',
	'audio/ogg',
	'audio/webm',
];
