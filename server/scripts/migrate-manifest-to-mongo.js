// 文件说明：将历史 manifest.json 与本地 uploads 文件迁移到 MongoDB + MinIO。
import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { connectMongo, closeMongo } from '../db/mongo.js';
import { ensureFileIndexes } from '../models/fileRecord.js';
import { initMinio, putObject } from '../storage/minio.js';
import { buildFileRecord, buildObjectKey } from '../utils/fileEntry.js';
import { fileExists, createFileRecord } from '../repositories/fileRepository.js';
import { readManifest } from '../utils/manifest.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const uploadsDir = path.resolve(__dirname, '../../uploads');

/**
 * 根据 manifest 条目推断 MIME 类型。
 */
function guessMimeType(filename) {
	const ext = path.extname(filename).toLowerCase();
	const map = {
		'.jpg': 'image/jpeg',
		'.jpeg': 'image/jpeg',
		'.png': 'image/png',
		'.gif': 'image/gif',
		'.webp': 'image/webp',
		'.svg': 'image/svg+xml',
		'.pdf': 'application/pdf',
		'.txt': 'text/plain',
		'.doc': 'application/msword',
		'.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
	};
	return map[ext] || 'application/octet-stream';
}

/**
 * 执行 manifest 到 MongoDB + MinIO 的迁移。
 */
async function migrate() {
	const db = await connectMongo();
	await ensureFileIndexes(db);
	await initMinio();

	const list = readManifest(uploadsDir);
	let migrated = 0;
	let skipped = 0;
	let failed = 0;

	for (const item of list) {
		if (await fileExists(item.filename)) {
			skipped++;
			continue;
		}

		const filePath = path.join(uploadsDir, item.filename);
		if (!fs.existsSync(filePath)) {
			console.warn(`[migrate] skip missing file: ${item.filename}`);
			skipped++;
			continue;
		}

		try {
			const buffer = fs.readFileSync(filePath);
			const objectKey = buildObjectKey(item.filename);
			const mimeType = guessMimeType(item.originalName || item.filename);

			await putObject(objectKey, buffer, buffer.length, {
				'Content-Type': mimeType,
			});

			const record = buildFileRecord({
				filename: item.filename,
				originalName: item.originalName,
				mimeType,
				size: item.size ?? buffer.length,
			});
			if (item.uploadedAt) {
				record.uploadedAt = new Date(item.uploadedAt);
			}

			await createFileRecord(record);
			migrated++;
			console.log(`[migrate] ok: ${item.filename}`);
		} catch (err) {
			failed++;
			console.error(`[migrate] failed: ${item.filename}`, err.message);
		}
	}

	console.log(`[migrate] done — migrated: ${migrated}, skipped: ${skipped}, failed: ${failed}`);
	await closeMongo();
}

migrate().catch((err) => {
	console.error('[migrate] fatal:', err);
	process.exit(1);
});
