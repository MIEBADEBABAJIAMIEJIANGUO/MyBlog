// 文件说明：Agent 模块环境变量与默认配置。
/**
 * 读取环境变量，未设置时返回默认值。
 */
function env(key, fallback) {
	const value = process.env[key];
	return value !== undefined && value !== '' ? value : fallback;
}

export const deepseekConfig = {
	apiKey: env('DEEPSEEK_API_KEY', ''),
	baseUrl: env('DEEPSEEK_BASE_URL', 'https://api.deepseek.com').replace(/\/$/, ''),
	model: env('DEEPSEEK_MODEL', 'deepseek-chat'),
};

export const tavilyConfig = {
	apiKey: env('TAVILY_API_KEY', ''),
};

/** 上下文内保留的最近消息条数 */
export const agentMemoryMaxMessages = Number(env('AGENT_MEMORY_MAX_MESSAGES', '20'));

/** 每 N 轮用户消息后更新会话摘要 */
export const agentSummaryEveryN = Number(env('AGENT_SUMMARY_EVERY_N', '10'));

/** RAG 检索最多返回片段数 */
export const agentRagMaxChunks = Number(env('AGENT_RAG_MAX_CHUNKS', '5'));

/** 单 Agent 配置文档 ID */
export const AGENT_CONFIG_ID = 'default';
