// 文件说明：分片上传临时目录的创建、写入、校验、合并与清理工具。
import fs from 'fs';
import { createReadStream, createWriteStream } from 'node:fs';
import path from 'path';
import { randomUUID } from 'crypto';
import { pipeline } from 'node:stream/promises';
import { FILE_CHUNK_SIZE } from '../constants/upload.js';

/**
 * 确保目录存在。
 */
function ensureDir(dir) {
	if (!fs.existsSync(dir)) {
		fs.mkdirSync(dir, { recursive: true });
	}
}

/**
 * 获取分片临时根目录路径。
 */
export function getChunksRoot(uploadsDir) {
	return path.join(uploadsDir, '.chunks');
}

/**
 * 获取指定 uploadId 的分片目录路径。
 */
export function getChunkDir(uploadsDir, uploadId) {
	return path.join(getChunksRoot(uploadsDir), uploadId);
}

/**
 * 读取分片任务的 meta.json。
 */
export function readChunkMeta(uploadsDir, uploadId) {
	const metaPath = path.join(getChunkDir(uploadsDir, uploadId), 'meta.json');
	if (!fs.existsSync(metaPath)) {
		return null;
	}
	return JSON.parse(fs.readFileSync(metaPath, 'utf-8'));
}

/**
 * 写入分片任务的 meta.json。
 */
export function writeChunkMeta(uploadsDir, uploadId, meta) {
	const dir = getChunkDir(uploadsDir, uploadId);
	ensureDir(dir);
	fs.writeFileSync(path.join(dir, 'meta.json'), JSON.stringify(meta, null, 2), 'utf-8');
}

/**
 * 创建分片上传会话，返回 uploadId 与 totalChunks。
 */
export function createChunkSession(uploadsDir, { filename, fileSize, mimeType }) {
	const uploadId = randomUUID();
	const totalChunks = Math.ceil(fileSize / FILE_CHUNK_SIZE);
	const meta = {
		uploadId,
		filename,
		fileSize,
		mimeType,
		totalChunks,
		createdAt: new Date().toISOString(),
	};
	writeChunkMeta(uploadsDir, uploadId, meta);
	return { uploadId, totalChunks };
}

/**
 * 保存单个分片到临时目录。
 */
export function saveChunk(uploadsDir, uploadId, chunkIndex, buffer) {
	const dir = getChunkDir(uploadsDir, uploadId);
	ensureDir(dir);
	const chunkPath = path.join(dir, String(chunkIndex));
	fs.writeFileSync(chunkPath, buffer);
}

/**
 * 列出已上传的分片 index（用于断点续传）。
 */
export function listUploadedChunkIndices(uploadsDir, uploadId, totalChunks) {
	const dir = getChunkDir(uploadsDir, uploadId);
	const uploaded = [];
	for (let i = 0; i < totalChunks; i++) {
		if (fs.existsSync(path.join(dir, String(i)))) {
			uploaded.push(i);
		}
	}
	return uploaded;
}

/**
 * 检查所有分片是否均已上传。
 */
export function allChunksPresent(uploadsDir, uploadId, totalChunks) {
	const dir = getChunkDir(uploadsDir, uploadId);
	for (let i = 0; i < totalChunks; i++) {
		if (!fs.existsSync(path.join(dir, String(i)))) {
			return false;
		}
	}
	return true;
}

/**
 * 合并分片为最终文件，返回最终文件路径与文件名（流式 I/O，避免阻塞事件循环）。
 */
export async function mergeChunks(uploadsDir, uploadId, meta) {
	const dir = getChunkDir(uploadsDir, uploadId);
	const ext = path.extname(meta.filename);
	const finalFilename = `${Date.now()}${ext}`;
	const finalPath = path.join(uploadsDir, finalFilename);

	// 原代码注释（同步实现，大文件会阻塞事件循环）：
	// export function mergeChunks(uploadsDir, uploadId, meta) {
	// 	const dir = getChunkDir(uploadsDir, uploadId);
	// 	const ext = path.extname(meta.filename);
	// 	const finalFilename = `${Date.now()}${ext}`;
	// 	const finalPath = path.join(uploadsDir, finalFilename);
	// 	fs.writeFileSync(finalPath, Buffer.alloc(0));
	// 	for (let i = 0; i < meta.totalChunks; i++) {
	// 		const chunkPath = path.join(dir, String(i));
	// 		const chunkData = fs.readFileSync(chunkPath);
	// 		fs.appendFileSync(finalPath, chunkData);
	// 	}
	// 	return { finalFilename, finalPath };
	// }

	const writeStream = createWriteStream(finalPath);
	try {
		for (let i = 0; i < meta.totalChunks; i++) {
			const chunkPath = path.join(dir, String(i));
			await pipeline(createReadStream(chunkPath), writeStream, { end: false });
		}
		await new Promise((resolve, reject) => {
			writeStream.end(() => resolve());
			writeStream.on('error', reject);
		});
	} catch (err) {
		writeStream.destroy();
		if (fs.existsSync(finalPath)) {
			fs.unlinkSync(finalPath);
		}
		throw err;
	}

	return { finalFilename, finalPath };
}

/**
 * 清理超过 maxAgeMs 的孤儿分片会话目录，返回被删除的 uploadId 列表。
 */
export function cleanupOrphanChunkSessions(uploadsDir, maxAgeMs) {
	const root = getChunksRoot(uploadsDir);
	if (!fs.existsSync(root)) {
		return { removed: [], count: 0 };
	}

	const removed = [];
	const now = Date.now();

	for (const uploadId of fs.readdirSync(root)) {
		const dir = path.join(root, uploadId);
		let stat;
		try {
			stat = fs.statSync(dir);
		} catch {
			continue;
		}
		if (!stat.isDirectory()) {
			continue;
		}

		let createdAtMs;
		const meta = readChunkMeta(uploadsDir, uploadId);
		if (meta?.createdAt) {
			createdAtMs = new Date(meta.createdAt).getTime();
		} else {
			createdAtMs = stat.mtimeMs;
		}

		if (Number.isNaN(createdAtMs) || now - createdAtMs > maxAgeMs) {
			removeChunkSession(uploadsDir, uploadId);
			removed.push(uploadId);
		}
	}

	return { removed, count: removed.length };
}

/**
 * 删除分片临时目录。
 */
export function removeChunkSession(uploadsDir, uploadId) {
	const dir = getChunkDir(uploadsDir, uploadId);
	if (fs.existsSync(dir)) {
		fs.rmSync(dir, { recursive: true, force: true });
	}
}
