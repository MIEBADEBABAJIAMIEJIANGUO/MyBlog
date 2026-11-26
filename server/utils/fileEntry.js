// 文件说明：文件记录构建、序列化与 MinIO 对象键工具函数。
/**
 * 根据存储文件名生成 MinIO 对象键。
 */
export function buildObjectKey(filename) {
	return `files/${filename}`;
}

/**
 * 构建预览 API 路径（供前端复制链接与打开预览）。
 */
export function buildPreviewUrl(filename) {
	return `/api/files/${encodeURIComponent(filename)}/preview`;
}

/**
 * 构建待写入 MongoDB 的文件记录文档。
 */
export function buildFileRecord({ filename, originalName, mimeType, size }) {
	const objectKey = buildObjectKey(filename);
	return {
		filename,
		objectKey,
		originalName,
		mimeType: mimeType || 'application/octet-stream',
		size,
		url: buildPreviewUrl(filename),
		uploadedAt: new Date(),
		contentIndex: '',
		indexStatus: 'pending',
		indexedAt: null,
	};
}

/**
 * 将 MongoDB 文档序列化为 API 响应格式。
 */
export function serializeFileRecord(doc, extras = {}) {
	if (!doc) return null;
	return {
		filename: doc.filename,
		originalName: doc.originalName,
		url: doc.url,
		size: doc.size,
		mimeType: doc.mimeType,
		uploadedAt:
			doc.uploadedAt instanceof Date ? doc.uploadedAt.toISOString() : doc.uploadedAt,
		indexStatus: doc.indexStatus,
		...extras,
	};
}
