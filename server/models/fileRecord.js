// 文件说明：files 集合名称、索引定义与 MIME 分类常量。
export const FILES_COLLECTION = 'files';

/** 文档类 MIME（显式列表，避免音视频被归入文档） */
export const documentMimeTypes = [
	'application/pdf',
	'text/plain',
	'application/msword',
	'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
	'application/vnd.ms-excel',
	'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
];

/**
 * 确保 files 集合索引存在。
 */
export async function ensureFileIndexes(db) {
	const collection = db.collection(FILES_COLLECTION);
	await collection.createIndex({ filename: 1 }, { unique: true });
	await collection.createIndex({ uploadedAt: -1 });
	await collection.createIndex({ mimeType: 1 });
	await collection.createIndex({ originalName: 'text' });
	await collection.createIndex({ indexStatus: 1 });
	// MongoDB 每个集合仅允许一个 text 索引，OCR 搜索使用 contentIndex $regex，无需再建 text 索引
	// await collection.createIndex({ contentIndex: 'text' });
}

/**
 * 根据 mimeCategory 构建 MongoDB 查询条件。
 */
export function mimeCategoryFilter(mimeCategory) {
	if (mimeCategory === 'image') {
		return { mimeType: { $regex: '^image/' } };
	}
	if (mimeCategory === 'video') {
		return { mimeType: { $regex: '^video/' } };
	}
	if (mimeCategory === 'audio') {
		return { mimeType: { $regex: '^audio/' } };
	}
	if (mimeCategory === 'document') {
		return { mimeType: { $in: documentMimeTypes } };
	}
	return {};
}
