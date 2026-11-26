// 文件说明：文件管理 API 路由，提供分页列表与预览重定向。
import express from 'express';
import path from 'path';
import { UploadStatusCode } from '../constants/upload.js';
import { sendOk, sendError } from '../utils/response.js';
import { listFiles, findFileDocByFilename } from '../repositories/fileRepository.js';
import { getPresignedUrl, getObjectBuffer } from '../storage/minio.js';
import { docBufferToPreviewHtml } from '../utils/docPreview.js';

const router = express.Router();

/**
 * 分页查询文件列表，支持搜索与 MIME 分类筛选。
 */
router.get('/files', async (req, res) => {
	try {
		const page = Math.max(1, Number(req.query.page) || 1);
		const pageSize = Math.min(100, Math.max(1, Number(req.query.pageSize) || 20));
		const q = typeof req.query.q === 'string' ? req.query.q : '';
		const mimeCategory = typeof req.query.mimeCategory === 'string' ? req.query.mimeCategory : '';
		const searchMode = req.query.searchMode === 'ocr' ? 'ocr' : 'name';

		const result = await listFiles({ page, pageSize, q, mimeCategory, searchMode });
		return sendOk(res, result);
	} catch {
		return sendError(res, UploadStatusCode.SERVER_ERROR, undefined, 500);
	}
});

/**
 * 预览 legacy .doc 文件：服务端提取正文并返回 HTML 段落 JSON。
 */
router.get('/files/:filename/preview-doc', async (req, res) => {
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
		if (doc.mimeType !== 'application/msword') {
			return sendError(res, UploadStatusCode.SERVER_ERROR, 'Not a legacy Word document');
		}

		const buffer = await getObjectBuffer(doc.objectKey);
		const html = await docBufferToPreviewHtml(buffer);
		return sendOk(res, { html });
	} catch {
		return sendError(res, UploadStatusCode.SERVER_ERROR, undefined, 500);
	}
});

/**
 * 预览文件：302 重定向到 MinIO 公开 URL 或预签名 URL。
 */
router.get('/files/:filename/preview', async (req, res) => {
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

		const targetUrl = await getPresignedUrl(doc.objectKey);
		return res.redirect(302, targetUrl);
	} catch {
		return sendError(res, UploadStatusCode.SERVER_ERROR, undefined, 500);
	}
});

export default router;
