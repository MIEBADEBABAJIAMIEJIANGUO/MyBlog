// 文件说明：Agent 流式聊天界面 React 组件。
import { useCallback, useEffect, useRef, useState } from 'react';
import type { AgentLabels, ChatCitation, ChatMessage, ChatSession } from '../scripts/agent/labels';
import {
	createSession,
	deleteSession,
	fetchAgentConfig,
	fetchMessages,
	fetchSessions,
	streamChat,
} from '../scripts/agent/api';
import '../styles/agent-scrollbar.css';
import '../styles/agent-acg-theme.css';
import { preloadLottiePlayer } from '../scripts/preloadLottie';
import LottieLoading from './LottieLoading';
import { attachMacScrollbar, revealMacScrollbar } from '../scripts/agent/macScrollbar';

if (!import.meta.env.SSR) void preloadLottiePlayer();

interface Props {
	labels: AgentLabels;
	settingsHref: string;
	/** 聊天消息区背景图 URL */
	chatBgSrc?: string;
}

/**
 * 渲染单条消息气泡。
 */
function MessageBubble({
	msg,
	citationsLabel,
}: {
	msg: ChatMessage & { streaming?: boolean };
	citationsLabel: string;
}) {
	const isUser = msg.role === 'user';
	return (
		<div className={`flex ${isUser ? 'justify-end' : 'justify-start'} mb-3`}>
			<div className={isUser ? 'agent-bubble-user' : 'agent-bubble-assistant'}>
				{msg.content}
				{msg.streaming && <span className="inline-block w-2 h-4 ml-0.5 bg-gray-400 animate-pulse" />}
				{!isUser && msg.citations && msg.citations.length > 0 && (
					<div className="mt-2 pt-2 border-t border-pink-100 text-xs text-gray-500">
						<p className="font-medium mb-1">{citationsLabel}</p>
						{msg.citations.map((c: ChatCitation) => (
							<p key={c.filename} className="truncate">
								· {c.originalName}
							</p>
						))}
					</div>
				)}
			</div>
		</div>
	);
}

/**
 * Agent 聊天主界面：会话列表 + 流式对话。
 */
export default function AgentChat({ labels, settingsHref, chatBgSrc }: Props) {
	const [sessions, setSessions] = useState<ChatSession[]>([]);
	const [activeId, setActiveId] = useState<string | null>(null);
	const [messages, setMessages] = useState<ChatMessage[]>([]);
	const [input, setInput] = useState('');
	const [loading, setLoading] = useState(true);
	const [sending, setSending] = useState(false);
	const [error, setError] = useState('');
	const [noApiKey, setNoApiKey] = useState(false);
	const [toolHint, setToolHint] = useState('');
	const bottomRef = useRef<HTMLDivElement>(null);
	const sessionsScrollRef = useRef<HTMLDivElement>(null);
	const messagesScrollRef = useRef<HTMLDivElement>(null);

	const scrollBottom = useCallback(() => {
		bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
		if (messagesScrollRef.current) revealMacScrollbar(messagesScrollRef.current);
	}, []);

	useEffect(() => {
		void (async () => {
			try {
				const cfg = await fetchAgentConfig();
				setNoApiKey(!cfg.deepseekConfigured);
				const list = await fetchSessions();
				setSessions(list);
				if (list.length > 0) setActiveId(list[0].sessionId);
				else {
					const s = await createSession();
					setSessions([s]);
					setActiveId(s.sessionId);
				}
			} catch {
				setError(labels.serverOffline);
			} finally {
				setLoading(false);
			}
		})();
	}, [labels.serverOffline]);

	useEffect(() => {
		if (!activeId) return;
		void (async () => {
			try {
				const { messages: msgs } = await fetchMessages(activeId);
				setMessages(msgs.filter((m) => m.role === 'user' || m.role === 'assistant'));
				scrollBottom();
			} catch {
				setMessages([]);
			}
		})();
	}, [activeId, scrollBottom]);

	useEffect(() => {
		if (loading) return;
		const cleanups: Array<() => void> = [];
		if (sessionsScrollRef.current) cleanups.push(attachMacScrollbar(sessionsScrollRef.current));
		if (messagesScrollRef.current) cleanups.push(attachMacScrollbar(messagesScrollRef.current));
		return () => cleanups.forEach((cleanup) => cleanup());
	}, [loading]);

	const handleNewChat = async () => {
		try {
			const s = await createSession();
			setSessions((prev) => [s, ...prev]);
			setActiveId(s.sessionId);
			setMessages([]);
		} catch {
			setError(labels.serverOffline);
		}
	};

	const handleDelete = async (sessionId: string) => {
		if (!confirm(labels.deleteConfirm)) return;
		await deleteSession(sessionId);
		const next = sessions.filter((s) => s.sessionId !== sessionId);
		setSessions(next);
		if (activeId === sessionId) {
			if (next.length) setActiveId(next[0].sessionId);
			else void handleNewChat();
		}
	};

	const handleSend = async () => {
		const text = input.trim();
		if (!text || !activeId || sending || noApiKey) return;
		setInput('');
		setSending(true);
		setToolHint('');
		setError('');

		const userMsg: ChatMessage = {
			messageId: `local-${Date.now()}`,
			sessionId: activeId,
			role: 'user',
			content: text,
			createdAt: new Date().toISOString(),
		};
		setMessages((prev) => [...prev, userMsg]);

		const assistantId = `stream-${Date.now()}`;
		let acc = '';
		let citations: ChatCitation[] = [];

		setMessages((prev) => [
			...prev,
			{
				messageId: assistantId,
				sessionId: activeId,
				role: 'assistant',
				content: '',
				citations: [],
				createdAt: new Date().toISOString(),
				streaming: true,
			} as ChatMessage & { streaming?: boolean },
		]);

		try {
			await streamChat(activeId, text, {
				onToken: (token) => {
					acc += token;
					setMessages((prev) =>
						prev.map((m) =>
							m.messageId === assistantId ? { ...m, content: acc, citations } : m,
						),
					);
					scrollBottom();
				},
				onCitations: (c) => {
					citations = c as ChatCitation[];
				},
				onTool: (p) => {
					if (p.name === 'web_search') {
						setToolHint(`${labels.webSearch}：${p.query}`);
					}
				},
				onError: (msg) => setError(msg),
			});
			setMessages((prev) =>
				prev.map((m) =>
					m.messageId === assistantId
						? { ...m, content: acc, citations, streaming: undefined }
						: m,
				),
			);
			const list = await fetchSessions();
			setSessions(list);
		} catch (e) {
			setError(e instanceof Error ? e.message : labels.serverOffline);
			setMessages((prev) => prev.filter((m) => m.messageId !== assistantId));
		} finally {
			setSending(false);
			setToolHint('');
		}
	};

	if (loading) {
		return <LottieLoading size="md" label={labels.loading} className="agent-loading h-full min-h-0" />;
	}

	return (
		// 原样式：border-gray-200 bg-white indigo 按钮
		<div className="agent-chat-root">
			<aside className="agent-chat-sidebar">
				<div className="agent-chat-sidebar-head">
					<button type="button" onClick={() => void handleNewChat()} className="agent-btn-primary">
						{labels.newChat}
					</button>
					<a href={settingsHref} className="agent-link-muted">
						{labels.settingsLink}
					</a>
				</div>
				<div ref={sessionsScrollRef} className="agent-chat-scroll flex-1 overflow-y-auto p-2 space-y-1">
					{sessions.length === 0 && (
						<p className="text-xs text-gray-400 p-2">{labels.emptySessions}</p>
					)}
					{sessions.map((s) => (
						<div key={s.sessionId} className="flex items-center gap-1 group">
							<button
								type="button"
								onClick={() => setActiveId(s.sessionId)}
								className={`agent-session-btn ${
									activeId === s.sessionId ? 'agent-session-btn--active' : ''
								}`}
							>
								{s.title}
							</button>
							<button
								type="button"
								title={labels.deleteChat}
								onClick={() => void handleDelete(s.sessionId)}
								className="opacity-0 group-hover:opacity-100 p-1 text-gray-400 hover:text-red-500 text-xs border-none bg-transparent cursor-pointer"
							>
								×
							</button>
						</div>
					))}
				</div>
			</aside>
			<div className="flex-1 flex flex-col min-w-0 min-h-0">
				{noApiKey && (
					<div className="px-4 py-2 bg-amber-50 text-amber-800 text-xs border-b border-amber-100">
						{labels.noApiKey}
					</div>
				)}
				{error && (
					<div className="px-4 py-2 bg-red-50 text-red-700 text-xs border-b border-red-100">{error}</div>
				)}
				{toolHint && (
					<div className="px-4 py-2 bg-fuchsia-50 text-fuchsia-800 text-xs border-b border-fuchsia-100">
						{toolHint}
					</div>
				)}
				<div className="relative flex-1 min-h-0 overflow-hidden">
					{chatBgSrc && (
						<div
							aria-hidden
							className="pointer-events-none absolute inset-0 bg-cover bg-center bg-no-repeat opacity-40"
							style={{ backgroundImage: `url(${chatBgSrc})` }}
						/>
					)}
					<div ref={messagesScrollRef} className="agent-chat-scroll relative z-[1] h-full min-h-0 overflow-y-auto p-4">
						{messages.map((m) => (
							<MessageBubble key={m.messageId} msg={m} citationsLabel={labels.citations} />
						))}
						<div ref={bottomRef} />
					</div>
				</div>
				<div className="agent-input-area">
					<textarea
						value={input}
						onChange={(e) => setInput(e.target.value)}
						onKeyDown={(e) => {
							if (e.key === 'Enter' && !e.shiftKey) {
								e.preventDefault();
								void handleSend();
							}
						}}
						placeholder={labels.inputPlaceholder}
						rows={2}
						className="agent-textarea"
					/>
					<button
						type="button"
						disabled={sending || noApiKey}
						onClick={() => void handleSend()}
						className="agent-btn-send flex items-center justify-center gap-1 min-w-[4.5rem]"
					>
						{sending ? (
							<LottieLoading size="xs" className="!min-h-0 py-0" />
						) : (
							labels.send
						)}
					</button>
				</div>
			</div>
		</div>
	);
}
