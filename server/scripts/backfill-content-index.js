// 文件说明：回填历史文件的正文索引（OCR + 文本提取），供 OCR 搜索使用。
import 'dotenv/config';
import { connectMongo, closeMongo } from '../db/mongo.js';
import { ensureFileIndexes } from '../models/fileRecord.js';
import { getDb } from '../db/mongo.js';
import { listFilesPendingIndex } from '../repositories/fileRepository.js';
import { indexFileContent } from '../services/contentIndexer.js';

/** 并发索引数量上限 */
const CONCURRENCY = 2;

/**
 * 以有限并发执行正文索引任务。
 */
async function runWithConcurrency(items, worker) {
	let index = 0;
	async function runNext() {
		while (index < items.length) {
			const current = index++;
			await worker(items[current]);
		}
	}
	const runners = Array.from({ length: Math.min(CONCURRENCY, items.length) }, () => runNext());
	await Promise.all(runners);
}

/**
 * 为缺少 indexStatus 字段的旧记录补全 pending 状态。
 */
async function normalizeLegacyRecords() {
	const collection = getDb().collection('files');
	await collection.updateMany(
		{ indexStatus: { $exists: false } },
		{ $set: { contentIndex: '', indexStatus: 'pending', indexedAt: null } },
	);
}

/**
 * 扫描待索引文件并依次建立 contentIndex。
 */
async function backfill() {
	await connectMongo();
	await ensureFileIndexes(getDb());

	await normalizeLegacyRecords();

	const pending = await listFilesPendingIndex(5000);
	console.log(`[index:content] ${pending.length} file(s) to index`);

	let done = 0;
	await runWithConcurrency(pending, async (doc) => {
		await indexFileContent(doc.filename);
		done++;
		if (done % 10 === 0 || done === pending.length) {
			console.log(`[index:content] progress ${done}/${pending.length}`);
		}
	});

	console.log('[index:content] complete');
	await closeMongo();
}

backfill().catch((err) => {
	console.error('[index:content] failed:', err);
	process.exit(1);
});
