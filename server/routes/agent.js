// 文件说明：Agent 配置、会话管理与流式聊天 API 路由。
import express from 'express';
import { UploadStatusCode } from '../constants/upload.js';
import { sendOk, sendError } from '../utils/response.js';
import { isDeepseekConfigured } from '../services/llm/deepseek.js';
import { runAgentChatStream } from '../services/agent/orchestrator.js';
import {
	getAgentConfig,
	updateAgentConfig,
	listChatSessions,
	createChatSession,
	getChatSession,
	deleteChatSession,
	listChatMessages,
	listUserMemory,
} from '../repositories/agentRepository.js';

const router = express.Router();

/**
 * 获取 Agent 配置与 API 就绪状态。
 */
router.get('/agent/config', async (_req, res) => {
	try {
		const config = await getAgentConfig();
		return sendOk(res, {
			...config,
			deepseekConfigured: isDeepseekConfigured(),
		});
	} catch (err) {
		return sendError(res, UploadStatusCode.SERVER_ERROR, err.message, 500);
	}
});

/**
 * 更新 Agent 人设与知识库绑定。
 */
router.put('/agent/config', express.json(), async (req, res) => {
	try {
		const config = await updateAgentConfig(req.body ?? {});
		return sendOk(res, config);
	} catch (err) {
		return sendError(res, UploadStatusCode.SERVER_ERROR, err.message, 500);
	}
});

/**
 * 列出会话。
 */
router.get('/agent/sessions', async (_req, res) => {
	try {
		const sessions = await listChatSessions();
		return sendOk(res, { sessions });
	} catch (err) {
		return sendError(res, UploadStatusCode.SERVER_ERROR, err.message, 500);
	}
});

/**
 * 创建新会话。
 */
router.post('/agent/sessions', express.json(), async (req, res) => {
	try {
		const title = req.body?.title;
		const session = await createChatSession(title);
		return sendOk(res, session);
	} catch (err) {
		return sendError(res, UploadStatusCode.SERVER_ERROR, err.message, 500);
	}
});

/**
 * 删除会话。
 */
router.delete('/agent/sessions/:sessionId', async (req, res) => {
	try {
		await deleteChatSession(req.params.sessionId);
		return sendOk(res, { sessionId: req.params.sessionId });
	} catch (err) {
		return sendError(res, UploadStatusCode.SERVER_ERROR, err.message, 500);
	}
});

/**
 * 获取会话消息历史。
 */
router.get('/agent/sessions/:sessionId/messages', async (req, res) => {
	try {
		const session = await getChatSession(req.params.sessionId);
		if (!session) return sendError(res, UploadStatusCode.NO_FILE, '会话不存在', 404);
		const messages = await listChatMessages(req.params.sessionId);
		return sendOk(res, { session, messages });
	} catch (err) {
		return sendError(res, UploadStatusCode.SERVER_ERROR, err.message, 500);
	}
});

/**
 * 获取用户长期记忆列表。
 */
router.get('/agent/memory', async (_req, res) => {
	try {
		const memories = await listUserMemory();
		return sendOk(res, { memories });
	} catch (err) {
		return sendError(res, UploadStatusCode.SERVER_ERROR, err.message, 500);
	}
});

/**
 * SSE 流式聊天。
 */
router.post('/agent/chat', express.json(), async (req, res) => {
	const { sessionId, message } = req.body ?? {};
	if (!sessionId || !message?.trim()) {
		return sendError(res, UploadStatusCode.CHUNK_INIT_FAILED, '缺少 sessionId 或 message');
	}
	if (!isDeepseekConfigured()) {
		return sendError(res, UploadStatusCode.SERVER_ERROR, '未配置 DEEPSEEK_API_KEY', 503);
	}

	res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
	res.setHeader('Cache-Control', 'no-cache, no-transform');
	res.setHeader('Connection', 'keep-alive');
	res.flushHeaders?.();

	try {
		await runAgentChatStream({
			sessionId,
			userMessage: String(message).trim(),
			res,
		});
	} catch (err) {
		res.write(`event: error\ndata: ${JSON.stringify({ message: err.message })}\n\n`);
		res.end();
	}
});

export default router;
