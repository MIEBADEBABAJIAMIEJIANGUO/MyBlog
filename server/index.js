// 文件说明：Express 上传服务入口，监听 3001 端口，集成 MongoDB 与 MinIO。
import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import path from 'path';
import { fileURLToPath } from 'url';
import uploadRouter from './routes/upload.js';
import filesRouter from './routes/files.js';
import agentRouter from './routes/agent.js';
import { CHUNK_SESSION_MAX_AGE_MS } from './constants/upload.js';
import { connectMongo, closeMongo } from './db/mongo.js';
import { ensureFileIndexes } from './models/fileRecord.js';
import { ensureAgentIndexes } from './models/agentRecord.js';
import { initMinio, isMinioReady } from './storage/minio.js';
import { cleanupOrphanChunkSessions } from './utils/chunkStorage.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const uploadsDir = path.resolve(__dirname, '../uploads');
const PORT = 3001;

const app = express();

// 允许的跨域来源：生产走 nginx 同源反代时其实用不到；
// 直连 :3001 调试或独立域名部署时，用 CORS_ORIGINS 覆盖（逗号分隔）。
const allowedOrigins = (process.env.CORS_ORIGINS ?? 'http://localhost:4321,http://127.0.0.1:4321')
	.split(',')
	.map((origin) => origin.trim())
	.filter(Boolean);

app.use(
	cors({
		origin: allowedOrigins,
	}),
);
app.use(express.json());
app.use(morgan('dev'));

/**
 * 健康检查：返回依赖组件状态，便于前端/脚本判断上传功能是否可用。
 * 放在 MongoDB 前置中间件之前，依赖异常时也能正常响应。
 */
app.get('/api/health', async (_req, res) => {
	let mongo = true;
	try {
		await connectMongo();
	} catch {
		mongo = false;
	}
	res.status(mongo ? 200 : 503).json({
		code: 0,
		success: mongo,
		message: mongo ? 'ok' : 'MongoDB unavailable',
		data: { mongo, minio: isMinioReady() },
	});
});

/**
 * 每个 API 请求前确认 MongoDB 可用（Docker 重启后自动重连，避免查库挂死）。
 */
app.use('/api', async (_req, _res, next) => {
	try {
		await connectMongo();
		next();
	} catch (err) {
		next(err);
	}
});

// 原代码注释：本地静态文件服务（已改用 MinIO 存储，保留作降级）
// app.use('/uploads', express.static(uploadsDir));

app.use('/api', uploadRouter);
app.use('/api', filesRouter);
app.use('/api', agentRouter);

/**
 * 统一错误出口：MinIO 不可用等依赖错误返回 503 + 可读原因，避免 Express 默认 500 页面。
 */
app.use((err, _req, res, _next) => {
	const status = err?.status ?? 500;
	if (status >= 500) {
		console.error('[upload-server] request failed:', err?.message ?? err);
	}
	if (res.headersSent) return res.end();
	return res.status(status).json({
		code: status,
		success: false,
		message: err?.message ?? 'Internal Server Error',
	});
});

/** 分片孤儿目录清理间隔（1 小时） */
const CHUNK_CLEANUP_INTERVAL_MS = 60 * 60 * 1000;

/**
 * 执行孤儿分片清理并输出日志。
 */
function runChunkCleanup() {
	const { count } = cleanupOrphanChunkSessions(uploadsDir, CHUNK_SESSION_MAX_AGE_MS);
	if (count > 0) {
		console.log(`[upload-server] chunk cleanup: removed ${count} sessions`);
	}
}

/** MinIO 未就绪时的重试间隔（容器晚于服务启动时自动恢复） */
const MINIO_RETRY_INTERVAL_MS = 15_000;

/**
 * 尝试初始化 MinIO：失败只告警，不阻断服务启动。
 * 这样 MongoDB 正常时接口可用，上传相关接口在 MinIO 恢复后自动生效。
 */
async function tryInitMinio() {
	if (isMinioReady()) return true;
	try {
		await initMinio();
		return true;
	} catch (err) {
		console.warn(
			`[upload-server] MinIO unavailable at ${process.env.MINIO_ENDPOINT || '127.0.0.1'}:${process.env.MINIO_PORT || 9000}` +
				` (${err.message}) — uploads disabled, retrying every ${MINIO_RETRY_INTERVAL_MS / 1000}s.` +
				' Start it with: docker compose up -d minio',
		);
		return false;
	}
}

/**
 * 启动服务：连接 MongoDB、初始化 MinIO 后监听端口。
 * MongoDB 是硬依赖（失败退出），MinIO 是软依赖（失败降级 + 后台重试）。
 */
async function startServer() {
	const db = await connectMongo();
	await ensureFileIndexes(db);
	await ensureAgentIndexes(db);
	await tryInitMinio();

	// MinIO 未就绪时后台重试，直到成功；就绪后定时器自行空转退出。
	setInterval(async () => {
		if (!isMinioReady()) await tryInitMinio();
	}, MINIO_RETRY_INTERVAL_MS);

	runChunkCleanup();
	setInterval(runChunkCleanup, CHUNK_CLEANUP_INTERVAL_MS);

	app.listen(PORT, () => {
		console.log(`[upload-server] running at http://localhost:${PORT} (pid ${process.pid})`);
		console.log('[upload-server] watching for changes via nodemon');
	});
}

startServer().catch((err) => {
	console.error('[upload-server] startup failed:', err);
	process.exit(1);
});

/** MongoDB 心跳间隔（Docker 重启后主动探测并重连） */
const MONGO_PING_INTERVAL_MS = 30_000;

setInterval(async () => {
	try {
		await connectMongo();
	} catch (err) {
		console.warn('[upload-server] MongoDB heartbeat failed:', err.message);
		await closeMongo();
	}
}, MONGO_PING_INTERVAL_MS);

process.on('SIGINT', async () => {
	await closeMongo();
	process.exit(0);
});

process.on('SIGTERM', async () => {
	await closeMongo();
	process.exit(0);
});

process.on('uncaughtException', (err) => {
	console.error('[upload-server] uncaughtException:', err);
});

process.on('unhandledRejection', (reason) => {
	console.error('[upload-server] unhandledRejection:', reason);
});
