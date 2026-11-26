// 文件说明：files 集合的增删查仓储层，替代 manifest.json。
import { getDb } from '../db/mongo.js';
import {
	FILES_COLLECTION,
	mimeCategoryFilter,
} from '../models/fileRecord.js';
import { serializeFileRecord } from '../utils/fileEntry.js';
import { normalizeFilename } from '../utils/filename.js';
import { extractSearchSnippets } from '../utils/searchSnippets.js';

/**
 * 获取 files 集合引用。
 */
function getCollection() {
	return getDb().collection(FILES_COLLECTION);
}

/**
 * 创建文件元数据记录。
 */
export async function createFileRecord(entry) {
	const normalized = {
		...entry,
		originalName: normalizeFilename(entry.originalName),
	};
	await getCollection().insertOne(normalized);
	return serializeFileRecord(normalized);
}

/**
 * 按 filename 删除文件记录，返回被删文档或 null。
 */
export async function deleteFileRecord(filename) {
	const result = await getCollection().findOneAndDelete({ filename });
	return serializeFileRecord(result);
}

/**
 * 按 filename 查找单条记录。
 */
export async function findFileByFilename(filename) {
	const doc = await getCollection().findOne({ filename });
	return serializeFileRecord(doc);
}

/**
 * 按 filename 查找原始文档（含 objectKey，供 MinIO 操作）。
 */
export async function findFileDocByFilename(filename) {
	return getCollection().findOne({ filename });
}

/**
 * 转义正则特殊字符，用于 MongoDB $regex 字面量匹配。
 */
function escapeRegex(text) {
	return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * 更新文件正文索引字段。
 */
export async function updateContentIndex(filename, { contentIndex, indexStatus }) {
	const update = {
		contentIndex,
		indexStatus,
		indexedAt: new Date(),
	};
	await getCollection().updateOne({ filename }, { $set: update });
}

/**
 * 分页查询文件列表，支持关键词搜索与 MIME 分类筛选。
 */
export async function listFiles({
	page = 1,
	pageSize = 20,
	q = '',
	mimeCategory = '',
	searchMode = 'name',
} = {}) {
	const filter = { ...mimeCategoryFilter(mimeCategory) };
	const trimmed = q.trim();
	if (trimmed) {
		const pattern = { $regex: escapeRegex(trimmed), $options: 'i' };
		if (searchMode === 'ocr') {
			filter.contentIndex = pattern;
			filter.indexStatus = 'done';
		} else {
			filter.originalName = pattern;
		}
	}

	const skip = Math.max(0, (page - 1) * pageSize);
	const limit = Math.min(Math.max(1, pageSize), 100);

	const collection = getCollection();
	const [docs, total] = await Promise.all([
		collection.find(filter).sort({ uploadedAt: -1 }).skip(skip).limit(limit).toArray(),
		collection.countDocuments(filter),
	]);

	const includeSnippets = searchMode === 'ocr' && trimmed;

	return {
		files: docs.map((doc) => {
			if (!includeSnippets) {
				return serializeFileRecord(doc);
			}
			const { snippets, matchCount } = extractSearchSnippets(doc.contentIndex ?? '', trimmed);
			return serializeFileRecord(doc, { searchSnippets: snippets, matchCount });
		}),
		total,
		page,
		pageSize: limit,
	};
}

/**
 * 返回最近上传的文件列表（供上传页简要列表，最多 limit 条）。
 */
export async function listRecentFiles(limit = 100) {
	const docs = await getCollection()
		.find({})
		.sort({ uploadedAt: -1 })
		.limit(limit)
		.toArray();
	return docs.map(serializeFileRecord);
}

/**
 * 返回尚未完成正文索引的文件（供回填脚本使用）。
 */
export async function listFilesPendingIndex(limit = 1000) {
	const docs = await getCollection()
		.find({ indexStatus: { $nin: ['done', 'skipped'] } })
		.sort({ uploadedAt: -1 })
		.limit(limit)
		.toArray();
	return docs;
}

/**
 * 检查 filename 是否已存在于数据库。
 */
export async function fileExists(filename) {
	const count = await getCollection().countDocuments({ filename }, { limit: 1 });
	return count > 0;
}
