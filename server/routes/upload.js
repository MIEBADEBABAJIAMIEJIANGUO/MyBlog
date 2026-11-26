// 文件说明：Express 上传路由，支持单文件上传、大文件分片上传与已上传列表查询。
import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { createReadStream } from 'node:fs';
import { fileURLToPath } from 'url';
import {
	FILE_CHUNK_MAXSIZE,
	FILE_CHUNK_SIZE,
	FILE_MAX_SIZE,
	MAX_CONCURRENT_UPLOADS,
	MAX_GLOBAL_IN_FLIGHT,
	MAX_CONCURRENT_CHUNKS,
	UploadStatusCode,
	StatusMessages,
	allowedMimeTypes,
} from '../constants/upload.js';
import { sendOk, sendError } from '../utils/response.js';
import {
	createChunkSession,
	readChunkMeta,
	saveChunk,
	allChunksPresent,
	mergeChunks,
	removeChunkSession,
	listUploadedChunkIndices,
} from '../utils/chunkStorage.js';
import {
	createFileRecord,
	deleteFileRecord,
	findFileDocByFilename,
	listRecentFiles,
} from '../repositories/fileRepository.js';
import { buildFileRecord } from '../utils/fileEntry.js';
import { indexFileContent } from '../services/contentIndexer.js';
import { putObject, removeObject } from '../storage/minio.js';

// 原代码注释：import { readManifest, appendManifest, removeFromManifest } from '../utils/manifest.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const uploadsDir = path.resolve(__dirname, '../../uploads');

if (!fs.existsSync(uploadsDir)) {
	fs.mkdirSync(uploadsDir, { recursive: true });
}

/**
 * 校验 MIME 类型是否在白名单内。
 */
function isAllowedMime(mimeType) {
	return allowedMimeTypes.includes(mimeType);
}

/**
 * 生成存储用文件名（时间戳 + 扩展名）。
 */
function generateStoredFilename(originalName) {
	const ext = path.extname(originalName);
	return `${Date.now()}${ext}`;
}

// 原代码注释：Multer 单文件磁盘存储配置
// const storage = multer.diskStorage({ ... });

const singleUpload = multer({
	storage: multer.memoryStorage(),
	limits: { fileSize: FILE_CHUNK_MAXSIZE },
	fileFilter: (_req, file, cb) => {
		if (isAllowedMime(file.mimetype)) {
			cb(null, true);
		} else {
			cb(new Error(StatusMessages[UploadStatusCode.UNSUPPORTED_TYPE]));
		}
	},
});

const chunkUpload = multer({
	storage: multer.memoryStorage(),
	limits: { fileSize: FILE_CHUNK_SIZE + 1024 },
});

const router = express.Router();

router.get('/health', (_req, res) => {
	res.json({ ok: true });
});

router.get('/upload/config', (_req, res) => {
	return sendOk(res, {
		FILE_CHUNK_MAXSIZE,
		FILE_CHUNK_SIZE,
		FILE_MAX_SIZE,
		MAX_CONCURRENT_UPLOADS,
		MAX_GLOBAL_IN_FLIGHT,
		MAX_CONCURRENT_CHUNKS,
		statusCodes: UploadStatusCode,
		statusMessages: StatusMessages,
		allowedMimeTypes,
	});
});

/**
 * 返回已上传文件列表（最近 100 条，供上传页简要展示）。
 */
router.get('/upload/list', async (_req, res) => {
	try {
		const files = await listRecentFiles(100);
		return sendOk(res, { files });
	} catch {
		return sendError(res, UploadStatusCode.SERVER_ERROR, undefined, 500);
	}
});

/**
 * 单文件上传：内存接收 → MinIO → MongoDB。
 */
router.post('/upload', singleUpload.single('file'), async (req, res) => {
	if (!req.file) {
		return sendError(res, UploadStatusCode.NO_FILE);
	}
	if (req.file.size > FILE_CHUNK_MAXSIZE) {
		return sendError(res, UploadStatusCode.FILE_TOO_LARGE);
	}

	const filename = generateStoredFilename(req.file.originalname);
	const record = buildFileRecord({
		filename,
		originalName: req.file.originalname,
		mimeType: req.file.mimetype,
		size: req.file.size,
	});

	try {
		await putObject(record.objectKey, req.file.buffer, req.file.size, {
			'Content-Type': req.file.mimetype,
		});
		const entry = await createFileRecord(record);
		void indexFileContent(record.filename).catch((err) =>
			console.error('[content-indexer]', record.filename, err),
		);
		return sendOk(res, entry);
	} catch {
		return sendError(res, UploadStatusCode.SERVER_ERROR, undefined, 500);
	}
});

router.post('/upload/chunk/init', express.json(), (req, res) => {
	try {
		const { filename, fileSize, mimeType } = req.body ?? {};
		if (!filename || !fileSize || !mimeType) {
			return sendError(res, UploadStatusCode.CHUNK_INIT_FAILED, 'Missing required fields');
		}
		if (!isAllowedMime(mimeType)) {
			return sendError(res, UploadStatusCode.UNSUPPORTED_TYPE);
		}
		if (fileSize <= FILE_CHUNK_MAXSIZE) {
			return sendError(
				res,
				UploadStatusCode.CHUNK_INIT_FAILED,
				'File is within single upload limit, use POST /api/upload instead',
			);
		}
		if (fileSize > FILE_MAX_SIZE) {
			return sendError(res, UploadStatusCode.FILE_TOO_LARGE);
		}
		const session = createChunkSession(uploadsDir, {
			filename,
			fileSize,
			mimeType,
		});
		return sendOk(res, session);
	} catch {
		return sendError(res, UploadStatusCode.CHUNK_INIT_FAILED, undefined, 500);
	}
});

router.post('/upload/chunk', chunkUpload.single('chunk'), (req, res) => {
	const uploadId = req.body?.uploadId;
	const chunkIndex = Number(req.body?.chunkIndex);
	const totalChunks = Number(req.body?.totalChunks);

	if (!uploadId || Number.isNaN(chunkIndex) || Number.isNaN(totalChunks)) {
		return sendError(res, UploadStatusCode.CHUNK_MISSING, 'Missing chunk metadata');
	}

	const meta = readChunkMeta(uploadsDir, uploadId);
	if (!meta) {
		return sendError(res, UploadStatusCode.UPLOAD_ID_NOT_FOUND);
	}
	if (totalChunks !== meta.totalChunks) {
		return sendError(res, UploadStatusCode.CHUNK_INDEX_INVALID, 'totalChunks mismatch');
	}
	if (chunkIndex < 0 || chunkIndex >= meta.totalChunks) {
		return sendError(res, UploadStatusCode.CHUNK_INDEX_INVALID);
	}
	if (!req.file) {
		return sendError(res, UploadStatusCode.CHUNK_MISSING);
	}

	try {
		saveChunk(uploadsDir, uploadId, chunkIndex, req.file.buffer);
		return sendOk(res, { uploadId, chunkIndex });
	} catch {
		return sendError(res, UploadStatusCode.SERVER_ERROR, undefined, 500);
	}
});

/**
 * 合并分片 → 上传 MinIO → 写 MongoDB → 清理本地临时文件。
 */
router.post('/upload/chunk/merge', express.json(), async (req, res) => {
	const { uploadId } = req.body ?? {};
	if (!uploadId) {
		return sendError(res, UploadStatusCode.UPLOAD_ID_NOT_FOUND);
	}

	const meta = readChunkMeta(uploadsDir, uploadId);
	if (!meta) {
		return sendError(res, UploadStatusCode.UPLOAD_ID_NOT_FOUND);
	}

	if (!allChunksPresent(uploadsDir, uploadId, meta.totalChunks)) {
		return sendError(res, UploadStatusCode.CHUNK_MISSING, 'Not all chunks uploaded');
	}

	let finalPath;
	try {
		const { finalFilename, finalPath: mergedPath } = await mergeChunks(uploadsDir, uploadId, meta);
		finalPath = mergedPath;

		const record = buildFileRecord({
			filename: finalFilename,
			originalName: meta.filename,
			mimeType: meta.mimeType,
			size: meta.fileSize,
		});

		await putObject(record.objectKey, createReadStream(finalPath), meta.fileSize, {
			'Content-Type': meta.mimeType,
		});

		const entry = await createFileRecord(record);
		void indexFileContent(record.filename).catch((err) =>
			console.error('[content-indexer]', record.filename, err),
		);
		removeChunkSession(uploadsDir, uploadId);

		if (fs.existsSync(finalPath)) {
			fs.unlinkSync(finalPath);
		}

		return sendOk(res, entry);
	} catch {
		if (finalPath && fs.existsSync(finalPath)) {
			fs.unlinkSync(finalPath);
		}
		return sendError(res, UploadStatusCode.MERGE_FAILED, undefined, 500);
	}
});

/**
 * 删除已上传文件（MinIO 对象 + MongoDB 记录）。
 */
router.delete('/upload/:filename', async (req, res) => {
	const raw = req.params.filename;
	const filename = path.basename(raw);
	if (filename !== raw || filename.includes('..')) {
		return sendError(res, UploadStatusCode.SERVER_ERROR, 'Invalid filename');
	}

	try {
		const doc = await findFileDocByFilename(filename);
		if (!doc) {
			return sendError(res, UploadStatusCode.NO_FILE, 'File not found');
		}

		await removeObject(doc.objectKey);
		await deleteFileRecord(filename);

		// 原代码注释：本地磁盘删除（已迁移至 MinIO）
		// const filePath = path.join(uploadsDir, filename);
		// if (fs.existsSync(filePath)) fs.unlinkSync(filePath);

		return sendOk(res, { filename });
	} catch {
		return sendError(res, UploadStatusCode.SERVER_ERROR, undefined, 500);
	}
});

router.get('/upload/chunk/:uploadId/progress', (req, res) => {
	const { uploadId } = req.params;
	const meta = readChunkMeta(uploadsDir, uploadId);
	if (!meta) {
		return sendError(res, UploadStatusCode.UPLOAD_ID_NOT_FOUND);
	}
	const uploadedChunks = listUploadedChunkIndices(uploadsDir, uploadId, meta.totalChunks);
	return sendOk(res, {
		uploadId,
		totalChunks: meta.totalChunks,
		uploadedChunks,
	});
});

router.delete('/upload/chunk/:uploadId', (req, res) => {
	const { uploadId } = req.params;
	const meta = readChunkMeta(uploadsDir, uploadId);
	if (!meta) {
		return sendError(res, UploadStatusCode.UPLOAD_ID_NOT_FOUND);
	}
	removeChunkSession(uploadsDir, uploadId);
	return sendOk(res, { uploadId });
});

router.use((err, _req, res, _next) => {
	if (err instanceof multer.MulterError) {
		if (err.code === 'LIMIT_FILE_SIZE') {
			return sendError(res, UploadStatusCode.FILE_TOO_LARGE);
		}
		return sendError(res, UploadStatusCode.SERVER_ERROR, err.message);
	}
	if (err) {
		const message = err.message ?? '';
		if (message.includes('Unsupported')) {
			return sendError(res, UploadStatusCode.UNSUPPORTED_TYPE, message);
		}
		return sendError(res, UploadStatusCode.SERVER_ERROR, message);
	}
});

export default router;
