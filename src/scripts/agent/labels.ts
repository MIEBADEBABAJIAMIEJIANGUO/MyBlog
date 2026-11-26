// 文件说明：Agent 模块中文 UI 文案（不做 i18n）。
export const agentLabels = {
	title: '智能助手',
	subtitle: '逐梦对话 · 知识库与联网，在这里慢慢聊',
	pageDescription: '个人智能助手，支持知识库检索与联网搜索',
	settingsTitle: 'Agent 设置',
	settingsLink: '设置',
	backToChat: '返回聊天',
	newChat: '新对话',
	deleteChat: '删除',
	deleteConfirm: '确定删除该对话？',
	emptySessions: '暂无对话，点击「新对话」开始',
	inputPlaceholder: '输入消息，Enter 发送，Shift+Enter 换行',
	send: '发送',
	sending: '思考中…',
	serverOffline: 'Agent 服务不可用，请检查后端与 DEEPSEEK_API_KEY',
	noApiKey: '未配置 DEEPSEEK_API_KEY，请在 .env 中填写',
	citations: '参考知识库',
	webSearch: '正在联网搜索',
	name: '名称',
	persona: '人设 / 角色定位',
	speakingStyle: '说话风格',
	background: '背景设定',
	boundFiles: '绑定知识库文件',
	boundFilesHint: '仅已索引（indexStatus=done）的文件可用于检索；未索引请先在文件管理中等待或运行 index:content',
	save: '保存',
	saved: '已保存',
	saveFailed: '保存失败',
	loading: '加载中…',
	selectAll: '全选',
	deselectAll: '取消全选',
	indexed: '已索引',
	notIndexed: '未索引',
};

export interface AgentConfig {
	name: string;
	persona: string;
	speakingStyle: string;
	background: string;
	boundFilenames: string[];
	deepseekConfigured?: boolean;
}

export interface ChatSession {
	sessionId: string;
	title: string;
	summary: string;
	createdAt: string;
	updatedAt: string;
}

export interface ChatCitation {
	filename: string;
	originalName: string;
	text: string;
}

export interface ChatMessage {
	messageId: string;
	sessionId: string;
	role: 'user' | 'assistant' | 'system';
	content: string;
	citations?: ChatCitation[];
	createdAt: string;
}

export interface AgentLabels {
	title: string;
	settingsTitle: string;
	settingsLink: string;
	backToChat: string;
	newChat: string;
	deleteChat: string;
	deleteConfirm: string;
	emptySessions: string;
	inputPlaceholder: string;
	send: string;
	sending: string;
	serverOffline: string;
	noApiKey: string;
	citations: string;
	webSearch: string;
	name: string;
	persona: string;
	speakingStyle: string;
	background: string;
	boundFiles: string;
	boundFilesHint: string;
	save: string;
	saved: string;
	saveFailed: string;
	loading: string;
	selectAll: string;
	deselectAll: string;
	indexed: string;
	notIndexed: string;
}
