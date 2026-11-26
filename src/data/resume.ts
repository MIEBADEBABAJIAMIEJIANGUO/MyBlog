// 文件说明：简历页唯一数据源（中英双语）。页面组件只负责渲染，改简历内容只需改本文件。
// 约定：所有面向用户的文案都写成 L10n（{ 'zh-CN': ..., en: ... }），由 getResume(lang) 解析成纯字符串后再交给组件。

export type Lang = 'zh-CN' | 'en';

/** 双语字段 */
export type L10n = Record<Lang, string>;

/** 技能掌握深度 */
export type SkillLevel = 'core' | 'pro' | 'know';

/** 经历类型：正式 / 实习 / 外包并行 / 教育 */
export type TimelineKind = 'work' | 'intern' | 'parallel' | 'edu';

export interface Stat {
	value: string;
	label: string;
}

export interface Contact {
	icon: 'mail' | 'phone' | 'pin';
	label: string;
	value: string;
	href?: string;
}

export interface SkillItem {
	name: string;
	level: SkillLevel;
	note?: string;
}

export interface SkillGroup {
	id: string;
	title: string;
	hint: string;
	items: SkillItem[];
}

export interface TimelineEntry {
	id: string;
	period: string;
	kind: TimelineKind;
	title: string;
	org: string;
	summary: string;
	bullets: string[];
	tags: string[];
}

export interface ProjectMetric {
	value: string;
	label: string;
}

export interface ProjectStory {
	background: string;
	mine: string[];
	challenges: string[];
	results: string[];
}

export interface ProjectView {
	id: string;
	name: string;
	subtitle: string;
	period: string;
	role: string;
	company: string;
	tagline: string;
	stack: string[];
	metrics: ProjectMetric[];
	story: ProjectStory;
	link?: { label: string; href: string };
}

export interface Certificate {
	name: string;
	note: string;
}

export interface ResumeUi {
	site: string;
	back: string;
	navResume: string;
	print: string;
	printHint: string;
	copyEmail: string;
	copied: string;
	viewProjects: string;
	sections: {
		profile: string;
		skills: string;
		experience: string;
		projects: string;
		more: string;
	};
	skillHints: Record<SkillLevel, string>;
	drawer: {
		close: string;
		background: string;
		mine: string;
		challenges: string;
		results: string;
		stack: string;
		role: string;
		period: string;
		open: string;
		detail: string;
	};
	printFooter: string;
}

export interface Resume {
	lang: Lang;
	meta: { title: string; description: string };
	ui: ResumeUi;
	name: string;
	nameEn: string;
	role: string;
	eyebrow: string;
	tagline: string;
	contacts: Contact[];
	stats: Stat[];
	skills: SkillGroup[];
	timeline: TimelineEntry[];
	projects: ProjectView[];
	certificates: Certificate[];
	/** 打印版按经历倒序输出，用于静态展开所有项目详情 */
	printOrder: string[];
}

/* ------------------------------------------------------------------ */
/* 原始双语数据                                                         */
/* ------------------------------------------------------------------ */

interface RawProject {
	id: string;
	name: L10n;
	subtitle: L10n;
	period: string;
	role: L10n;
	company: L10n;
	tagline: L10n;
	stack: string[];
	metrics?: { value: string; label: L10n }[];
	story: {
		background: L10n;
		mine: L10n[];
		challenges: L10n[];
		results: L10n[];
	};
	link?: { label: L10n; href: string };
}

const RAW_PROJECTS: RawProject[] = [
	{
		id: 'vmine-platform',
		name: {
			'zh-CN': '船舶智能化中台 · 微前端底座',
			en: 'Ship Intelligence Platform · Micro-frontend Base',
		},
		subtitle: {
			'zh-CN': 'Vue 3.5 + TS + Vite 7 + Module Federation，4 个子系统统一工作台',
			en: 'Vue 3.5 + TS + Vite 7 + Module Federation, one shell for four sub-systems',
		},
		period: '2026.06 – 至今',
		role: { 'zh-CN': '前端开发（中台底座）', en: 'Frontend Engineer (platform base)' },
		company: { 'zh-CN': '上海招商局招商智科', en: 'China Merchants Zhike, Shanghai' },
		tagline: {
			'zh-CN':
				'设计 Host 侧「注册表 + 动态 Loader + 接入契约」，让 4 个子系统独立开发、独立部署，运行时自动注入路由、菜单、国际化与样式。',
			en: 'Designed the host side — registry, dynamic loader and an integration contract — so four sub-systems build and deploy independently while routes, menus, i18n and styles are injected at runtime.',
		},
		stack: ['Vue 3.5', 'TypeScript', 'Vite 7', 'Module Federation', 'Pinia', 'Element Plus', 'Nginx', 'Docker'],
		metrics: [
			{ value: '4', label: { 'zh-CN': '个在线子系统', en: 'live sub-systems' } },
			{ value: '1', label: { 'zh-CN': '套统一接入契约', en: 'shared integration contract' } },
			{ value: '0', label: { 'zh-CN': '改地址需重新打包', en: 'rebuilds to switch a remote' } },
		],
		story: {
			background: {
				'zh-CN':
					'船舶行业的多子系统（智能能效、智能监控、数字化交付、岸船同步）由不同节奏的团队独立开发，需要一个统一工作台承载认证、RBAC 权限、菜单路由、船舶上下文、主题与国际化。中台不只是「页面壳」，还要定义子系统如何接入、如何共享运行时、如何故障隔离。',
				en: 'Several ship-domain sub-systems — energy efficiency, monitoring, digital delivery, shore-ship sync — were built by teams at different cadences. They needed one shell for auth, RBAC, menus and routing, vessel context, theming and i18n. That meant defining how a sub-system plugs in, shares runtime and fails without taking the shell down.',
			},
			mine: [
				{
					'zh-CN':
						'设计 Host 侧「注册表 + 动态 Loader + 接入契约」：不静态声明 remotes，运行时 import(remoteEntry.js) 动态加载，规避 ESM 与 script 加载的兼容与时序问题',
					en: 'Designed the host registry, dynamic loader and integration contract: no static remotes, instead import(remoteEntry.js) at runtime to dodge ESM/script loading conflicts.',
				},
				{
					'zh-CN':
						'实现模块加载状态机 pending / loading / loaded / error 与防重入，HEAD 探活入口，Promise.allSettled 并行加载，单个子系统失败不阻塞主应用',
					en: 'Built a module state machine (pending / loading / loaded / error) with re-entry guards, HEAD liveness probes and Promise.allSettled loading so one failing remote never blocks the shell.',
				},
				{
					'zh-CN':
						'手动构造 shareScope，用 Host 真实运行时版本强制 singleton 共享 Vue / Router / Pinia / i18n / Element Plus，避免子系统自带 Vue 造成的两套响应式与状态割裂',
					en: 'Constructed shareScope by hand, pinning singleton Vue / Router / Pinia / i18n / Element Plus to the host’s real runtime versions so a remote never ships its own Vue.',
				},
				{
					'zh-CN':
						'设计 VmineModuleConfig 接入契约：moduleId / menu / routes / locales / styles / setup 一次声明，Host 自动完成路由注入、菜单注册、i18n 深度合并、CSS 加载与上下文回调',
					en: 'Defined the VmineModuleConfig contract — moduleId / menu / routes / locales / styles / setup — so the host wires routes, menus, i18n and CSS automatically.',
				},
				{
					'zh-CN':
						'修复刷新子系统深链 404：启动时序改为先 initModules 再 router.isReady，路由守卫在模块未就绪时等待 readyPromise 后重新导航',
					en: 'Fixed deep-link 404s on refresh by initialising modules before router.isReady, with guards awaiting a ready promise before re-navigating.',
				},
				{
					'zh-CN':
						'实现运行时配置三级回退（config.js → .env → 默认值）并自动把入口 hostname 替换为当前访问域名，部署后改 Remote 地址无需重新构建',
					en: 'Added three-level runtime config (config.js → .env → defaults) that rewrites the entry hostname to the current domain, so remotes can be repointed post-deploy without a rebuild.',
				},
				{
					'zh-CN':
						'统一权限体系：路由 meta.permissions、菜单树递归过滤、v-permission 按钮级指令、岸端 shoreOnly 双守卫；请求层统一注入 Authorization / X-ShipId / X-UserId / Accept-Language',
					en: 'Unified permissions: route meta, recursive menu filtering, a v-permission directive and shore-only guards, with auth/vessel/user/locale headers injected centrally.',
				},
				{
					'zh-CN': '提供 iframe Bridge 兼容异构子系统：基于 postMessage 的信封协议，同步认证、船舶、语言与主题',
					en: 'Shipped an iframe bridge using a postMessage envelope protocol to sync auth, vessel, locale and theme for legacy sub-systems.',
				},
			],
			challenges: [
				{
					'zh-CN':
						'仅声明 singleton 不足以保证同一运行时：子系统仍可能带入自己的 Vue，必须手动注入 Host 已加载的真实实例',
					en: 'Declaring singleton is not enough: remotes could still bundle Vue, so host instances had to be injected explicitly.',
				},
				{
					'zh-CN': '刷新深链时首屏导航早于 Remote 路由注入，to.matched 为空，直接渲染 404',
					en: 'On refresh, initial navigation ran before remote routes were injected, leaving to.matched empty and rendering a 404.',
				},
				{
					'zh-CN': '子系统样式污染与主题机制不一致：Host 用 html.dark，子系统用 data-theme 与 Element Plus 变量',
					en: 'Style leakage and mismatched theming: the host toggled html.dark while remotes expected data-theme and Element Plus tokens.',
				},
			],
			results: [
				{
					'zh-CN': '4 个子系统解耦，单个 Remote 不可达只标记 error，不影响主应用启动与其他子系统',
					en: 'Four sub-systems decoupled: an unreachable remote is only marked error and never blocks startup.',
				},
				{
					'zh-CN': '刷新任意子系统深链不再 404，菜单 / 语言 / 样式随 Remote 自动装配，用户无感切换',
					en: 'Deep links survive refresh, and menus, languages and styles assemble themselves from the remote.',
				},
				{
					'zh-CN': '新增子系统只需实现一个 module-config 并注册入口，形成可复用的接入规范',
					en: 'Onboarding a new sub-system now means writing one module-config and registering an entry — a reusable integration standard.',
				},
			],
		},
	},
	{
		id: 'vmine-rag',
		name: {
			'zh-CN': '数字化交付 · RAG 智能问答与文档工程',
			en: 'Digital Delivery · RAG Q&A and Document Engineering',
		},
		subtitle: {
			'zh-CN': '文件管理 → 向量化 → 检索 → LLM 流式 → 引用回看',
			en: 'Files → vectorisation → retrieval → streamed LLM → citation jump-back',
		},
		period: '2026.06 – 至今',
		role: { 'zh-CN': '前端开发（子系统 / AI 应用）', en: 'Frontend Engineer (sub-system / AI app)' },
		company: { 'zh-CN': '上海招商局招商智科', en: 'China Merchants Zhike, Shanghai' },
		tagline: {
			'zh-CN':
				'在以 Remote 接入中台的船舶数字化交付子系统里，打通 RAG 问答全链路，并把大文件上传下载做成弱网可用的文档工程能力。',
			en: 'Inside the digital-delivery remote, wired the full RAG chain and turned large-file upload/download into something usable on a bad shipboard network.',
		},
		stack: ['Vue 3', 'TypeScript', 'SSE', 'pdfjs-dist', 'MinIO', 'markdown-it', 'KaTeX', 'Mermaid', 'ASR/TTS'],
		metrics: [
			{ value: '200MB', label: { 'zh-CN': '单文件上传/下载', en: 'single-file upload/download' } },
			{ value: '10MB', label: { 'zh-CN': '分片 · 4 路并发', en: 'chunks · 4-way concurrency' } },
			{ value: 'topK=5', label: { 'zh-CN': '检索片段数', en: 'retrieved passages' } },
		],
		story: {
			background: {
				'zh-CN':
					'岸端数字化交付要管理船舶文档（证书、图纸、说明书），体量大、格式多、网络不稳定；业务还希望直接在这些文档上提问，而不是逐份翻 PDF。子系统以 Module Federation Remote 的形式接入中台，页面、菜单、语言包与样式都随 Remote 注入。',
				en: 'Shore-side delivery had to manage ship documents — certificates, drawings, manuals — that are large, multi-format and often moved over flaky links. Users also wanted to ask the documents questions instead of paging through PDFs. The sub-system plugs into the platform as a Module Federation remote.',
			},
			mine: [
				{
					'zh-CN':
						'打通 RAG 全链路：文件管理导入 MinIO → 向量化任务 → 5s 轮询状态 → topK=5 检索 → Prompt 拼装 → LLM SSE 流式 → Markdown 渲染 → 引用 PDF 页码回看 → 会话落库 / 导出',
					en: 'Connected the RAG chain end to end: import to MinIO → vectorisation job → 5s status polling → topK=5 retrieval → prompt assembly → streamed LLM → markdown rendering → citation jump-back into the PDF → persisted and exportable conversations.',
				},
				{
					'zh-CN':
						'封装 OpenAI 兼容 LLM 客户端（/v1/chat/completions + stream），用 eventsource-parser + ReadableStream 解析 SSE，处理 [DONE]、finish_reason、空响应与异常中断',
					en: 'Wrapped an OpenAI-compatible client (/v1/chat/completions with stream) and parsed SSE via eventsource-parser + ReadableStream, handling [DONE], finish_reason, empty bodies and aborted streams.',
				},
				{
					'zh-CN':
						'Prompt 工程：按界面语言切换 system prompt；有检索结果注入知识片段、无结果走兜底；携带最近 3 轮对话；temperature 按场景取 0.2 / 0.3；用 LLM 把首个问题压缩成 ≤20 字会话标题',
					en: 'Prompt engineering: locale-aware system prompts, retrieved context when available and a fallback when not, the last three turns of history, scenario-based temperature (0.2 / 0.3), and an LLM-generated ≤20-character conversation title.',
				},
				{
					'zh-CN':
						'思维链折叠展示（reasoning_content / <think>），复制、朗读、导出时自动剥离思考过程；引用按 document_id 合并为文件标签并保留多页码',
					en: 'Folded chain-of-thought display (reasoning_content / <think>), stripping it from copy, speech and exports; citations merged per document with multiple page numbers preserved.',
				},
				{
					'zh-CN':
						'向量化轮询治理：请求序号 + 选中库快照丢弃过期响应、页面隐藏暂停、连续 3 次失败熔断、连续 6 轮静默收敛',
					en: 'Tamed vectorisation polling: request sequence numbers plus library snapshots to drop stale responses, pause on hidden tabs, circuit-break after three failures and converge after six quiet rounds.',
				},
				{
					'zh-CN':
						'文档工程：MD5 指纹 + 上传前 probe + 10MB 分片 + 4 路并发 + 秒传与断点续传；流式下载支持 Range 续传、指数退避重试 5 次、AbortController 取消，并校验 ZIP 魔数避免把错误响应落盘成假文件',
					en: 'Document engineering: MD5 fingerprinting, pre-upload probes, 10MB chunks with four-way concurrency, instant re-upload and resume; range-based streaming downloads with five exponential-backoff retries, abort support and ZIP magic-number checks so error payloads never land as files.',
				},
				{
					'zh-CN':
						'PDF 预览：Vite ?worker 打包 pdf.js worker 解决生产环境 .mjs Worker 404，ResizeObserver + 120ms 合并重绘避免拖拽抖动',
					en: 'PDF preview: bundled the pdf.js worker through Vite’s ?worker to avoid the production .mjs 404, with ResizeObserver plus 120ms batched redraws to stop drag jitter.',
				},
				{
					'zh-CN':
						'多模态：MediaRecorder 录音 → 16kHz 单声道 WAV → 自部署 SenseVoice ASR；TTS 自动分段、下一段预取、单例 audio 播放与 AbortController 停止',
					en: 'Multimodal input: MediaRecorder to 16kHz mono WAV and a self-hosted SenseVoice ASR; TTS with automatic segmentation, next-segment prefetch, a single audio element and abort-based stop.',
				},
			],
			challenges: [
				{
					'zh-CN': 'SSE 经 Nginx 默认开启 proxy_buffering，表现为「卡住后一次性吐完」，需关闭缓冲并放宽读超时',
					en: 'Nginx proxy_buffering made SSE stall and then flush in one burst; buffering had to be disabled and read timeouts relaxed.',
				},
				{
					'zh-CN': '向量化轮询与换库、删除并发执行，旧响应会覆盖新状态',
					en: 'Polling raced with library switches and deletions, letting stale responses overwrite fresh state.',
				},
				{
					'zh-CN': '大模型输出必须可核对：回答要能点回原文页码，否则在船舶文档场景不可用',
					en: 'Model output had to be verifiable — answers must jump back to the source page, or they are unusable for ship documentation.',
				},
			],
			results: [
				{
					'zh-CN': '问答从「整段等待」变为逐 token 呈现，首字更快且可随时中止',
					en: 'Answers stream token by token instead of arriving all at once, and can be stopped at any point.',
				},
				{
					'zh-CN': '回答自带引用文件与页码，可回原文核对，明显降低幻觉带来的使用风险',
					en: 'Each answer carries cited files and page numbers, so users can verify against the source and trust it more.',
				},
				{
					'zh-CN': '200MB 文件可稳定上传下载，弱网断线可续传，重复文件秒传，错误响应不会落盘成假文件',
					en: '200MB files upload and download reliably, resume after drops, re-upload instantly when duplicated, and never write error payloads to disk.',
				},
			],
		},
	},
	{
		id: 'report',
		name: {
			'zh-CN': '社群 / 内容电商经营报表自动化',
			en: 'Community Commerce Reporting Automation',
		},
		subtitle: {
			'zh-CN': '吉客云 API + 本地 Excel + 小红书投放 RPA + SMTP 邮件',
			en: 'Jikeyun API + local Excel + Xiaohongshu ad RPA + SMTP mail',
		},
		period: '2025.12 – 2026.03',
		role: { 'zh-CN': '独立开发（Cursor 辅助）', en: 'Solo developer (Cursor-assisted)' },
		company: { 'zh-CN': '内部项目', en: 'Internal project' },
		tagline: {
			'zh-CN': '把散在吉客云订单、本地 Excel 和小红书千帆后台的经营数据，串成「拉数 → 生成报表 → 邮件推送」的自动化链路。',
			en: 'Wired scattered business data — Jikeyun orders, local Excel targets and Xiaohongshu ad exports — into one pipeline: pull, merge, report, mail.',
		},
		stack: ['Python', '吉客云 OpenAPI', 'Playwright', 'pandas', 'openpyxl', 'SMTP', 'Cursor'],
		metrics: [
			{ value: '200', label: { 'zh-CN': '吉客云分页 pageSize', en: 'page size per request' } },
			{ value: '10:00', label: { 'zh-CN': '业务日切分口径', en: 'business-day cutoff' } },
			{ value: '2', label: { 'zh-CN': '运行模式：定时 / 手动', en: 'modes: scheduled / once' } },
		],
		story: {
			background: {
				'zh-CN':
					'社群销售与内容电商（小红书）的经营数据分散在三处：吉客云里的销售订单、本地 Excel 里的月目标 / 成本 / 主播排班、以及小红书千帆投放后台。日报全靠人工导表与汇总，效率低且每组口径不一致。',
				en: 'Business data for community selling and Xiaohongshu content commerce sat in three places: sales orders in Jikeyun, monthly targets / costs / host rosters in local Excel, and ad data in the Qianfan console. Daily reports were assembled by hand, slowly and with inconsistent definitions.',
			},
			mine: [
				{
					'zh-CN':
						'调通吉客云 OpenAPI（oms.trade.fullinfoget）拉取销售订单，自行实现签名与分页（pageSize=200），支持按业务日（10 点切分）的时间窗拉数与补拉',
					en: 'Got the Jikeyun OpenAPI (oms.trade.fullinfoget) working for order sync — implemented signing and pagination (pageSize=200) myself, with time-window pulls and backfills based on a business day that cuts at 10:00.',
				},
				{
					'zh-CN':
						'小红书千帆没有官方投放 API，用 Playwright 模拟登录并自动导出投放 CSV，按日汇总消费数据，提供 --schedule 定时与 --once 手动两种运行模式',
					en: 'Qianfan has no public ad API, so Playwright logs in and drives the export flow to CSV, then sums spend per day; runs either scheduled (--schedule) or once (--once).',
				},
				{
					'zh-CN':
						'用 pandas 整合订单与本地 Excel（月目标、成本表、主播排班），统一日期、店铺名、货品编码等对齐键，生成社群销售进度表、拆团销售 / 单量等报表',
					en: 'Used pandas to merge orders with local Excel (targets, costs, host rosters), normalising date, shop name and SKU code as join keys, producing sales-progress and per-group sales/order reports.',
				},
				{
					'zh-CN':
						'基于 smtplib + MIME 实现带 Excel 附件的自动发信，收件人通过 .env 配置，配合 Windows 任务计划实现每日定时发送',
					en: 'Built automated mailing with smtplib + MIME and Excel attachments, recipients configured via .env, scheduled daily through Windows Task Scheduler.',
				},
				{
					'zh-CN':
						'全程用 Cursor 辅助编写 Python 代码，独立完成需求拆解、口径确认、环境配置与链路调试',
					en: 'Wrote the Python code with Cursor assistance, owning requirement breakdown, definition alignment, environment setup and end-to-end debugging.',
				},
			],
			challenges: [
				{
					'zh-CN':
						'千帆后台没有开放接口，只能靠 Playwright 走页面导出，需处理登录态与导出文件落盘的时序',
					en: 'With no open API on Qianfan, the only path was driving the UI: handling login state and the timing between clicking export and the file landing on disk.',
				},
				{
					'zh-CN':
						'多源数据口径不一致：业务日按 10 点切分，店铺名、货品编码在三个数据源里命名不统一，需要统一对齐键后才能合并',
					en: 'Definitions diverged across sources — a 10:00 business-day boundary and inconsistent shop/SKU naming had to be reconciled before any merge was trustworthy.',
				},
			],
			results: [
				{
					'zh-CN':
						'在本机跑通完整链路并生成过报表：拉订单 → 合并本地 Excel → 生成报表 → 邮件推送，替代了此前手工导表、逐项汇总的重复操作',
					en: 'Ran the full chain end to end on my machine and produced real reports: pull orders → merge Excel → generate → mail, replacing the manual export-and-tally routine.',
				},
				{
					'zh-CN': '口径先写进代码再跑数，业务日、店铺、货品的对齐规则不再依赖个人记忆',
					en: 'Definitions live in code, so business-day, shop and SKU alignment no longer depends on who remembers what.',
				},
			],
		},
	},
	{
		id: 'yfs',
		name: { 'zh-CN': '延锋 YFS 工单系统', en: 'Yanfeng YFS Ticketing System' },
		subtitle: {
			'zh-CN': '四类运维工单接入飞书，全自动流转',
			en: 'Four kinds of ops tickets, auto-routed inside Feishu',
		},
		period: '2025.06 – 2025.12',
		role: { 'zh-CN': '低代码全栈工程师', en: 'Low-code Full-stack Engineer' },
		company: { 'zh-CN': '上海骞行', en: 'Shanghai Qianxing' },
		tagline: {
			'zh-CN': '把 WMS / ISEE / IT 变更 / 服务器上下线四类异常工单接进飞书，实现「触发 → 派单 → 接单 → 回调 → 催办」闭环。',
			en: 'Brought four ticketing streams (WMS, ISEE alarms, IT change, server provisioning) into Feishu and closed the loop: trigger → assign → accept → callback → chase.',
		},
		stack: ['飞书 aPaaS', '云函数', 'Webhook', '流程编排', '飞书卡片'],
		metrics: [
			{ value: '4', label: { 'zh-CN': '类工单统一入口', en: 'ticket streams unified' } },
			{ value: '24h', label: { 'zh-CN': '未接单自动催办', en: 'auto-chase interval' } },
			{ value: '1', label: { 'zh-CN': '次点击完成接单', en: 'click to accept' } },
		],
		story: {
			background: {
				'zh-CN':
					'延锋内部四类运维工单散落在不同系统：WMS 仓储、ISEE 报警、IT 注册配置变更、服务器上下线与虚拟机下线。原先靠群里人工派单和追问状态，漏单、超时都无法追溯。',
				en: 'Four ops ticket streams lived in separate systems — warehouse (WMS), ISEE alarms, IT change requests, and server/VM provisioning. Dispatching happened by hand in chat groups, so dropped and overdue tickets were untraceable.',
			},
			mine: [
				{
					'zh-CN': '在飞书 aPaaS 上独立搭建工单应用：数据表字段设计、表间关联、流程编排、前端权限全部由我完成',
					en: 'Built the app solo on Feishu aPaaS: table schema, relations, workflow orchestration and frontend permissions.',
				},
				{
					'zh-CN': '用 Webhook 拉取异常工单写入 aPaaS 数据库，流程实时监听数据变更，自动定位负责人并推送飞书卡片消息',
					en: 'Pulled abnormal tickets through webhooks into the aPaaS database; the workflow watches changes, resolves the owner and pushes a Feishu card.',
				},
				{
					'zh-CN': '卡片内置「接单」「查看详情」按钮，接单后进入状态机：接单 → 更新状态 → 回调三方平台 HTTP 接口 → 已完成 → 通知负责人',
					en: 'Cards embed Accept / Details actions; accepting drives a state machine: accept → update status → callback the third-party HTTP API → done → notify owner.',
				},
				{
					'zh-CN': '设计 24 小时定时任务扫描未接单工单，按负责人聚合后二次提醒',
					en: 'Scheduled a 24-hour job that scans unaccepted tickets and re-notifies owners in batches.',
				},
				{
					'zh-CN': '后台配置化：消息通知规则、Site 管理、BU 管理等模块，交付后业务侧可自助维护',
					en: 'Made it configurable — notification rules, site management, BU management — so the business runs it without engineering.',
				},
			],
			challenges: [
				{
					'zh-CN': 'aPaaS 云函数运行环境受限、无法引入常规依赖，时间与状态逻辑需手写并用边界用例逐一验证',
					en: 'The aPaaS function runtime is sandboxed with no regular dependencies; date/status logic had to be hand-written and covered by edge-case tests.',
				},
				{
					'zh-CN': '回调链路长，必须保证「状态已更新但回调失败」时可以重放且幂等',
					en: 'Long callback chains meant handling the "status updated, callback failed" case with replay and idempotency.',
				},
			],
			results: [
				{
					'zh-CN': '四类工单从人工派单变为系统自动流转，超时与漏单可追溯',
					en: 'Manual dispatching became automatic routing, with overdue tickets now traceable.',
				},
				{
					'zh-CN': '负责人无需登录后台，在飞书卡片里一次点击完成接单',
					en: 'Owners accept in one click from the Feishu card — no admin console needed.',
				},
			],
		},
	},
	{
		id: 'ccab',
		name: { 'zh-CN': 'CCAB 窗口匹配系统', en: 'CCAB Window Matching System' },
		subtitle: { 'zh-CN': '按基地拆单 + 负责人窗口自动匹配 + 一键拉会', en: 'Auto-split by site, auto-match owner windows, auto-book meetings' },
		period: '2025.06 – 2025.12',
		role: { 'zh-CN': '低代码全栈工程师', en: 'Low-code Full-stack Engineer' },
		company: { 'zh-CN': '上海骞行', en: 'Shanghai Qianxing' },
		tagline: {
			'zh-CN': '把「群里问一圈谁有空」变成系统按负责人窗口时间自动匹配，并一键建群预约飞书会议。',
			en: 'Replaced "ask around in chat" with automatic matching against owner availability, plus one-click group creation and meeting booking.',
		},
		stack: ['飞书 aPaaS', '云函数', '定时任务', '日历窗口', '会议 API'],
		metrics: [
			{ value: '12h', label: { 'zh-CN': '未匹配自动提醒', en: 'unmatched reminder cycle' } },
			{ value: '2', label: { 'zh-CN': '套状态机（申请人/负责人）', en: 'state machines' } },
			{ value: '1', label: { 'zh-CN': '键拉群并预约会议', en: 'click to book' } },
		],
		story: {
			background: {
				'zh-CN':
					'客户申请 CCAB 单（跨基地协作审批）时，需要人工逐个确认各基地负责人的空闲窗口，再约时间开会，一轮沟通往往要几天；窗口时间也没人集中维护。',
				en: 'Every CCAB request (cross-site collaboration approval) required asking each site owner for a free slot and booking a meeting by hand — usually days of back-and-forth, with no central place to maintain availability.',
			},
			mine: [
				{
					'zh-CN': '申请人按基地与类型新建单据，提交后按所选 Site 自动拆分为多张子申请单，并分别通知对应负责人',
					en: 'Requests are created by site and type, then auto-split per site into child requests, each notifying its owner.',
				},
				{
					'zh-CN': '负责人以日历形式维护个人窗口时间与每日时段内容，作为匹配的输入',
					en: 'Owners maintain availability on a calendar (per-day slots) which feeds the matcher.',
				},
				{
					'zh-CN': '用云函数手写匹配逻辑：多负责人、多时段求交，按结果生成申请人侧与负责人侧双状态',
					en: 'Hand-wrote the matching function: intersecting multiple owners across multiple slots, driving separate applicant-side and owner-side statuses.',
				},
				{
					'zh-CN': '匹配成功后一键拉群并预约飞书会议；匹配不上可转单，区分有/无飞书账号两种路径',
					en: 'Successful matches trigger group creation plus meeting booking; failures can be transferred, with paths for owners with and without Feishu accounts.',
				},
				{
					'zh-CN': '12 小时定时任务扫描未匹配成功的单据，提醒负责人维护自身窗口时间',
					en: 'A 12-hour job scans unmatched requests and nudges owners to update their availability.',
				},
				{
					'zh-CN': '已取消单据锁定不可编辑，仅允许重启，避免状态被二次污染',
					en: 'Cancelled requests are locked read-only except for restart, preventing status corruption.',
				},
			],
			challenges: [
				{
					'zh-CN': '跨时区、多负责人的区间求交在云函数里没有现成库，需自行实现区间运算与冲突判定',
					en: 'No interval libraries in the sandbox: timezone-aware interval intersection and conflict detection had to be implemented from scratch.',
				},
				{
					'zh-CN': '取消、重启、转单引入多条回退路径，必须保证双状态机不出现非法跃迁',
					en: 'Cancel / restart / transfer added rollback paths that must not produce illegal transitions in either state machine.',
				},
			],
			results: [
				{
					'zh-CN': '窗口协调从人工询问变为自动匹配，匹配成功即自动建群与预约会议',
					en: 'Coordination shifted from manual polling to automatic matching, with booking on success.',
				},
				{
					'zh-CN': '未匹配单据有定时兜底提醒，负责人窗口维护率与等待时长同步改善',
					en: 'Scheduled reminders keep availability fresh, cutting waiting time on unmatched requests.',
				},
			],
		},
	},
	{
		id: 'contract',
		name: { 'zh-CN': '骞行多维表格合同管理系统', en: 'Contract Management on Bitable' },
		subtitle: { 'zh-CN': '采购 / 销售 / 开票三表联动 + 回款指标自动计算', en: 'Three-table linkage with automated collection metrics' },
		period: '2025.06 – 2025.12',
		role: { 'zh-CN': '低代码全栈工程师', en: 'Low-code Full-stack Engineer' },
		company: { 'zh-CN': '上海骞行', en: 'Shanghai Qianxing' },
		tagline: {
			'zh-CN': '把分散在飞书多维表格里的采购、销售、开票合同搬进系统，三张核心表联动，月度回款指标自动算出。',
			en: 'Moved procurement, sales and invoicing contracts out of scattered bitables into one system: three linked tables and auto-computed monthly collection metrics.',
		},
		stack: ['飞书多维表格', '云函数', 'JavaScript 自定义计算', 'Excel 导入', '数据看板'],
		metrics: [
			{ value: '3', label: { 'zh-CN': '张核心表实时联动', en: 'linked core tables' } },
			{ value: 'EXCEL', label: { 'zh-CN': '单表导入多表数据', en: 'one sheet, many tables' } },
			{ value: '100%', label: { 'zh-CN': '签署到执行数字化', en: 'digital end to end' } },
		],
		story: {
			background: {
				'zh-CN':
					'合同原先记录在飞书多维表格中，采购、销售、开票分散在多张表里，难以集中管理与查询；月度回款情况靠人工核对，口径不统一。',
				en: 'Contracts lived in bitables, with procurement, sales and invoicing spread across sheets. Central management was hard and monthly collections were reconciled by hand, inconsistently.',
			},
			mine: [
				{
					'zh-CN': '参与需求评审，与财务、产品确认数据库字段与表间关联关系，随后独立孵化项目并持续迭代框架',
					en: 'Joined requirement reviews with finance and product to settle schema and relations, then incubated the system solo and kept iterating the framework.',
				},
				{
					'zh-CN': '三张核心表数据联动：开票记录、采购合同的更新实时同步到销售合同表',
					en: 'Three core tables stay in sync — invoicing records and procurement updates propagate into the sales table in real time.',
				},
				{
					'zh-CN': '云函数实现 Excel 导入，支持自定义导入规则与「单表导入多表数据」的拆分逻辑',
					en: 'Cloud functions handle Excel import with custom rules and a single-sheet-to-multiple-tables split.',
				},
				{
					'zh-CN': '用自定义 JS 计算月度回款、未回款等指标，首页放置数据看板统一展示',
					en: 'Custom JS computes monthly collected / outstanding amounts, surfaced on a dashboard on the home page.',
				},
			],
			challenges: [
				{
					'zh-CN': '单表导入要按合同类型与签约主体拆到不同表，还要保证「部分成功」时可回滚或续传',
					en: 'One-sheet imports must be split by contract type and signing entity, with rollback or resume when partly successful.',
				},
				{
					'zh-CN': '多表联动易产生循环更新，需约束写入方向避免互相触发',
					en: 'Cross-table sync easily loops; write direction had to be constrained to avoid mutual triggers.',
				},
			],
			results: [
				{
					'zh-CN': '合同从签署到执行全程数字化、可追溯，同一合同 ID 绑定在统一视图中',
					en: 'Contract lifecycle is digital and traceable, with one contract ID bound across a unified view.',
				},
				{
					'zh-CN': '月度回款指标由人工汇总转为自动计算，数据口径统一',
					en: 'Monthly collection metrics moved from manual roll-up to automatic computation with a single definition.',
				},
			],
		},
	},
	{
		id: 'grid',
		name: { 'zh-CN': '变电设备状态质量管理数字化系统', en: 'Substation Equipment Quality Platform' },
		subtitle: { 'zh-CN': '国家电网送检业务，PC + 移动端 + 数据大屏', en: 'State Grid inspection workflow: web, mobile and dashboard' },
		period: '2023.09 – 2025.04',
		role: { 'zh-CN': '前端开发工程师', en: 'Frontend Engineer' },
		company: { 'zh-CN': '上海思创电器设备有限公司', en: 'Shanghai Sichuang Electric Equipment' },
		tagline: {
			'zh-CN': '与北京电科院对接的国家电网检测平台，从零搭建委托流程、下单、检测到报告生成的整条链路。',
			en: 'A State Grid inspection platform built with Beijing EPRI from scratch: commissioning flow, ordering, testing and report generation.',
		},
		stack: ['Vue 2', 'antd-vue', 'Vant', 'ECharts', 'SignalR', '.NET Core'],
		metrics: [
			{ value: '0→1', label: { 'zh-CN': '项目从零搭建', en: 'built from scratch' } },
			{ value: '3', label: { 'zh-CN': '端形态：PC/移动/大屏', en: 'targets: web/mobile/big screen' } },
			{ value: '7+', label: { 'zh-CN': '一级业务模块', en: 'top-level modules' } },
		],
		story: {
			background: {
				'zh-CN':
					'外部厂家送检变电设备时，需要录入企业与设备信息、申请入院、下单、跟踪试验并领取合格报告，原先依赖线下 Word 委托单与电话沟通，进度不透明。',
				en: 'Manufacturers sending equipment for testing had to register the company and device, apply for site entry, place orders, track tests and collect certificates — all through Word forms and phone calls, with no visibility.',
			},
			mine: [
				{
					'zh-CN': '项目从零搭建，负责用户入口、入库、下单、检测及移动端部分模块',
					en: 'Built the project from zero, owning the customer portal, intake, ordering, testing and parts of the mobile app.',
				},
				{
					'zh-CN': '与业务确认委托单字段，用原生 table 封装表格组件，结构与 Word 表格对齐，并实现导入导出',
					en: 'Aligned commissioning-form fields with the business, then wrapped a native-table component matching the Word layout, with import and export.',
				},
				{
					'zh-CN': '全局封装 formModal：传入 JSON 即可驱动表单虚拟 DOM 生成，统一下单与录入交互',
					en: 'Packaged a global formModal that renders form DOM straight from JSON, unifying ordering and data-entry flows.',
				},
				{
					'zh-CN': '封装表格数据请求 hook（统一 filterParams / spinning / apiName / 分页）与路由监听、日期格式化等 hooks',
					en: 'Wrapped a table-request hook (filterParams / spinning / apiName / pagination) plus routing-watch and date-format hooks.',
				},
				{
					'zh-CN': 'antd-vue 主题定制实现主题色切换与组件样式定制，封装 signalr.js 与 .NET 实时交互',
					en: 'Customised the antd-vue theme for runtime colour switching, and wrapped SignalR for realtime .NET messaging.',
				},
				{
					'zh-CN': '移动端 rem + Vant 独立适配；ECharts 首屏展示试验数据，vue-esign 实现电子签名',
					en: 'Adapted a separate rem-based mobile build with Vant; ECharts for first-screen test data and vue-esign for e-signatures.',
				},
			],
			challenges: [
				{
					'zh-CN': '委托流程每一步由不同角色权限驱动，状态流转与按钮可见性必须严格一致',
					en: 'Each step of the commissioning flow is role-gated, so state transitions and button visibility had to stay exactly in sync.',
				},
				{
					'zh-CN': '大屏列表数据量大，antd 表格自带背景与样式限制，首屏渲染和滚动明显卡顿',
					en: 'The dashboard list was heavy and antd table styling fought the dark big-screen look, causing jank on first paint and scroll.',
				},
			],
			results: [
				{
					'zh-CN': '送检流程线上化，试验完成后按结果自动生成样品合格检测报告',
					en: 'Inspection became fully online, with sample certificates generated automatically once tests finish.',
				},
				{
					'zh-CN': 'PC 与移动端双端覆盖，现场人员可实时查看试品状态与环境数据',
					en: 'Web and mobile coverage lets on-site staff track specimen status and environment data live.',
				},
			],
		},
	},
	{
		id: 'video',
		name: { 'zh-CN': '旗技云视频管理系统', en: 'Qiji Cloud Video Platform' },
		subtitle: { 'zh-CN': '三套子系统 + 大文件切片断点续传', en: 'Three sub-systems plus chunked resumable uploads' },
		period: '2024.02 – 2024.06',
		role: { 'zh-CN': '前端开发工程师（外包并行）', en: 'Frontend Engineer (parallel contract)' },
		company: { 'zh-CN': '外包项目', en: 'Contract project' },
		tagline: {
			'zh-CN': 'Vue3 + TS 三端系统，与后端手写 MD5 实现切片断点续传，多人并发上传时内存稳定在 700MB 以内。',
			en: 'Three Vue 3 + TS sub-systems; a hand-rolled MD5 plus chunked uploads kept memory under 700MB even with concurrent uploaders.',
		},
		stack: ['Vue 3', 'TypeScript', 'Pinia', '动态路由', '切片上传', '媒体开放平台 API'],
		metrics: [
			{ value: '700MB', label: { 'zh-CN': '上传内存上限', en: 'upload memory ceiling' } },
			{ value: '3', label: { 'zh-CN': '套独立系统', en: 'separate consoles' } },
			{ value: '4+', label: { 'zh-CN': '家媒体平台接入', en: 'ad platforms integrated' } },
		],
		story: {
			background: {
				'zh-CN':
					'公司做多平台视频投放业务，需要前台用户端、超管后台、开发者后台三套系统，管理视频推流、剪映工程文件绑定与多家媒体账户；早期多人同时上传大文件会把客户端拖死。',
				en: 'The business ran cross-platform video campaigns and needed three consoles — user-facing, super-admin and developer — to handle streaming, Jianying project files and multiple ad accounts. Early versions froze when several people uploaded large files at once.',
			},
			mine: [
				{
					'zh-CN': '用 Vue3 + TS + Pinia 搭建三套系统，动态路由配合接口下发配置实现细粒度鉴权，超管后台可实时改权限',
					en: 'Built all three consoles on Vue 3 + TS + Pinia, with dynamic routes driven by API-delivered config for fine-grained access control the super-admin can change live.',
				},
				{
					'zh-CN': '与后端约定手写 MD5 加密，实现大文件切片、断点续传与文件夹上传；改为只存切片下标、边传边切、用完即抛',
					en: 'Agreed a hand-written MD5 with the backend and implemented chunking, resume and folder upload — storing only chunk indices and slicing as it streams, then discarding.',
				},
				{
					'zh-CN': '按 navigator.hardwareConcurrency 计算最大并发，降低切片过多导致的丢失与内存膨胀',
					en: 'Derived max concurrency from navigator.hardwareConcurrency to avoid lost chunks and memory blow-up.',
				},
				{
					'zh-CN': '对接腾讯、巨量、磁力、TikTok 等媒体 API，封装账户列表、广告户类型、推送类型与模板配置等共用代码',
					en: 'Integrated Tencent, Ocean Engine, Cili and TikTok APIs, extracting shared templates for accounts, ad-account types, push types and template config.',
				},
				{
					'zh-CN': '性能排查：封面单张超过 30M，视频预览每次请求带 token 的接口；改为 URL + 缓存 + 300ms 防抖',
					en: 'Diagnosed 30MB cover images and per-preview token requests; switched to URLs with caching and 300ms debounced previews.',
				},
			],
			challenges: [
				{
					'zh-CN': '多人并发上传时浏览器卡死：原方案把全部切片留在内存，改为只存下标后内存曲线才平下来',
					en: 'Concurrent uploads froze the browser because every chunk was held in memory; keeping only indices flattened the curve.',
				},
				{
					'zh-CN': '断网或失败后必须依据返回的 chunk_index 从上次位置续传，不能让用户重头再来',
					en: 'After a network drop the client must resume from chunk_index instead of restarting the whole file.',
				},
			],
			results: [
				{
					'zh-CN': '无论文件多大、多少个同时传，内存稳定在 700MB 左右',
					en: 'Memory stays around 700MB regardless of file count or size.',
				},
				{
					'zh-CN': '视频预览改为缓存命中，60 条以上的列表不再出现浏览器卡顿',
					en: 'Previews hit cache, so lists of 60+ videos no longer stutter.',
				},
			],
		},
	},
	{
		id: 'jianyiyun',
		name: { 'zh-CN': '简宜运数字化货代平台', en: 'JianYiYun Freight Platform' },
		subtitle: { 'zh-CN': '官网 + DSCFI + admin/PMS + uni-app 移动端', en: 'Marketing site, DSCFI, admin/PMS and uni-app mobile' },
		period: '2022.08 – 2023.07',
		role: { 'zh-CN': '前端开发实习生', en: 'Frontend Intern' },
		company: { 'zh-CN': '云智能科技', en: 'Yunzhineng Technology' },
		tagline: {
			'zh-CN': '覆盖全球 80% 以上海空港的货代平台：Nuxt 官网查价订舱、DSCFI 价格 K 线、后台价格池与 uni-app 多端。',
			en: 'A freight platform covering 80%+ of global sea and air ports: Nuxt quoting site, DSCFI price charts, admin price pools and a uni-app mobile app.',
		},
		stack: ['Vue 2', 'Nuxt', 'Element UI', 'uni-app', 'i18n', '支付宝支付'],
		metrics: [
			{ value: '4', label: { 'zh-CN': '个子项目', en: 'sub-projects' } },
			{ value: '80%', label: { 'zh-CN': '覆盖全球海空港', en: 'global ports covered' } },
			{ value: '2', label: { 'zh-CN': '端：PC + 小程序/H5', en: 'targets: web + mini/H5' } },
		],
		story: {
			background: {
				'zh-CN':
					'简宜运做数字化货代与供应链可视化：极速门到门运价核算、全航线海陆空订舱、全球货物追踪，并为贸易企业提供 API / IFRAME 接入。实习期间共参与官网、DSCFI、admin/PMS 与移动端四个项目。',
				en: 'JianYiYun digitises freight forwarding and supply-chain visibility: door-to-door pricing, multi-modal booking and global tracking, with API/IFRAME access for trading companies. As an intern I worked across four projects.',
			},
			mine: [
				{
					'zh-CN': '官网基于 Vue2 + Nuxt，实现查价与运输路径查询；参与官方组件库文档编写与维护（国家码筛选、overflow-tip 文字溢出等）',
					en: 'Built the Nuxt site with quoting and route lookup, and contributed to the shared component library docs (country-code filter, overflow tooltip).',
				},
				{
					'zh-CN': '跨境 ToC 端全部接入 i18n 国际化，并接入 AI 智能客服、智能邮箱与支付宝支付',
					en: 'Internationalised every ToC surface with i18n, and integrated AI support, smart mailbox and Alipay payment.',
				},
				{
					'zh-CN': 'admin（Vue2 + Element）覆盖系统设置、行为分析、价格导入与价格池、销售、PMS、DSCFI 管理；轮船路径与港口配置由后台绘制并反映到官网船期查询',
					en: 'Admin (Vue 2 + Element) covered settings, behaviour analytics, price import/pools, sales, PMS and DSCFI; routes and ports configured there feed the public schedule search.',
				},
				{
					'zh-CN': 'DSCFI 以类 K 线形式呈现船公司船期与价格浮动，把抓取数据直接变成可读的趋势',
					en: 'DSCFI renders carrier schedules and price movements as candlestick-style charts, turning scraped data into readable trends.',
				},
				{
					'zh-CN': 'uni-app 移动端：地址选择与首页跳转、uni.$on/$emit 跨页传参、getLocation + chooseLocation 地图选点、全局请求拦截器、scroll-view 分页与本地缓存优化',
					en: 'Mobile in uni-app: address picker and navigation, cross-page events, geolocation + map picking, a global request interceptor, scroll-view pagination and local caching.',
				},
			],
			challenges: [
				{
					'zh-CN': '跨境业务涉及多语言、多币种与多船司数据格式，接口字段差异需要在前端统一收口',
					en: 'Cross-border work spans languages, currencies and carriers whose payloads differ — normalising them had to happen in the frontend.',
				},
				{
					'zh-CN': '小程序与 H5 共用一套代码，地图、下载、上传等能力在两端表现不一致',
					en: 'One codebase served mini-program and H5, where maps, downloads and uploads behave differently.',
				},
			],
			results: [
				{
					'zh-CN': '官网具备在线查价与订舱入口，ToC 全站支持中英双语',
					en: 'The site offers online quoting and booking entry points with bilingual ToC pages.',
				},
				{
					'zh-CN': '销售与运营在同一后台维护价格、航线与客户关系，数据口径一致',
					en: 'Sales and ops maintain pricing, routes and customer relations in one console with consistent data.',
				},
			],
		},
		link: { label: { 'zh-CN': '官网演示', en: 'Live site' }, href: 'https://jianyiyun.com/' },
	},
];

const RAW_SKILLS: { id: string; title: L10n; hint: L10n; items: { name: string; level: SkillLevel; note?: L10n }[] }[] = [
	{
		id: 'language',
		title: { 'zh-CN': '语言与基础', en: 'Language & Fundamentals' },
		hint: { 'zh-CN': '能写可维护的代码，也懂浏览器底层行为', en: 'Maintainable code, plus how browsers actually behave' },
		items: [
			{ name: 'JavaScript (ES5 / ES6+)', level: 'core', note: { 'zh-CN': '原生 DOM、事件机制、异步模型', en: 'Native DOM, events, async model' } },
			{ name: 'TypeScript', level: 'pro', note: { 'zh-CN': '类型建模、泛型、规范化开发', en: 'Type modelling, generics' } },
			{ name: 'HTML5 / CSS3', level: 'core', note: { 'zh-CN': 'Flexbox、Grid、响应式与兼容', en: 'Flexbox, Grid, responsive' } },
			{ name: 'Sass / Less / BEM', level: 'pro', note: { 'zh-CN': 'CSS 模块化与代码组织', en: 'Modular CSS organisation' } },
		],
	},
	{
		id: 'framework',
		title: { 'zh-CN': '框架与状态', en: 'Frameworks & State' },
		hint: { 'zh-CN': 'Vue 为主线，React 生态可上手', en: 'Vue-first, comfortable in the React ecosystem' },
		items: [
			{ name: 'Vue 2 / Vue 3', level: 'core', note: { 'zh-CN': 'Options API、Composition API', en: 'Options & Composition API' } },
			{ name: 'Pinia / Vuex', level: 'core', note: { 'zh-CN': '状态分层与鉴权落点', en: 'State layering and auth' } },
			{ name: 'React / Hooks', level: 'know', note: { 'zh-CN': '可读改，能维护既有项目', en: 'Reads and maintains existing code' } },
			{ name: '通用组件库', level: 'pro', note: { 'zh-CN': '设计通用组件与业务 Hooks', en: 'Shared components & hooks' } },
		],
	},
	{
		id: 'micro',
		title: { 'zh-CN': '微前端与架构', en: 'Micro-frontend & Architecture' },
		hint: { 'zh-CN': '能把多个团队的系统装进一个壳里', en: 'Fitting many teams’ systems into one shell' },
		items: [
			{ name: 'Module Federation', level: 'core', note: { 'zh-CN': 'Host / Remote、运行时加载', en: 'Host/Remote, runtime loading' } },
			{ name: 'shareScope 单例共享', level: 'core', note: { 'zh-CN': '手动注入真实运行时版本', en: 'Manual runtime-version injection' } },
			{ name: '接入契约与动态注入', level: 'pro', note: { 'zh-CN': '路由、菜单、i18n、样式', en: 'Routes, menus, i18n, styles' } },
			{ name: 'iframe postMessage 桥接', level: 'pro', note: { 'zh-CN': '兼容异构子系统', en: 'Bridging legacy systems' } },
		],
	},
	{
		id: 'ai-app',
		title: { 'zh-CN': 'AI 应用', en: 'AI Applications' },
		hint: { 'zh-CN': 'RAG 问答、流式输出与可核对引用', en: 'RAG Q&A, streaming and verifiable citations' },
		items: [
			{ name: 'RAG 知识库 / 检索', level: 'pro', note: { 'zh-CN': '导入、向量化状态、topK', en: 'Import, vectorisation, topK' } },
			{ name: 'LLM SSE 流式', level: 'pro', note: { 'zh-CN': 'OpenAI 兼容、中断与重试', en: 'OpenAI-compatible, abort & retry' } },
			{ name: 'Prompt 工程', level: 'pro', note: { 'zh-CN': '多轮上下文、兜底与标题生成', en: 'Context, fallback, titles' } },
			{ name: '引用溯源 / ASR·TTS', level: 'know', note: { 'zh-CN': '页码回看、语音输入与朗读', en: 'Page citations, voice in/out' } },
		],
	},
	{
		id: 'engineering',
		title: { 'zh-CN': '工程化与性能', en: 'Engineering & Performance' },
		hint: { 'zh-CN': '构建、规范、优化，从配置到度量', en: 'Build, lint and optimise with measurement' },
		items: [
			{ name: 'Webpack / Vite', level: 'pro', note: { 'zh-CN': '按需引入、分包与构建提速', en: 'Code splitting, faster builds' } },
			{ name: 'Babel / ESLint / Prettier', level: 'pro', note: { 'zh-CN': '统一团队代码风格', en: 'Team-wide code standards' } },
			{ name: '性能优化', level: 'core', note: { 'zh-CN': '懒加载、缓存、并发与内存控制', en: 'Lazy load, cache, concurrency, memory' } },
			{ name: 'Git / SVN / CI-CD', level: 'pro', note: { 'zh-CN': 'Git Flow、Code Review', en: 'Git Flow, code review' } },
			{ name: 'Nginx / Docker', level: 'pro', note: { 'zh-CN': '同源反代、SSE 透传、部署', en: 'Same-origin proxy, SSE, deploy' } },
		],
	},
	{
		id: 'cross',
		title: { 'zh-CN': '跨端与多端适配', en: 'Cross-platform' },
		hint: { 'zh-CN': '一套代码跑 H5 / 小程序 / App', en: 'One codebase for H5, mini-program and app' },
		items: [
			{ name: 'uni-app', level: 'core', note: { 'zh-CN': '多端发布与条件编译', en: 'Multi-target builds' } },
			{ name: '微信小程序', level: 'pro', note: { 'zh-CN': '生命周期、API、web-view', en: 'Lifecycle, APIs, web-view' } },
			{ name: '响应式适配', level: 'pro', note: { 'zh-CN': 'rem / 视口 / 大屏自适应', en: 'rem, viewport, big screens' } },
			{ name: '数据可视化', level: 'pro', note: { 'zh-CN': 'ECharts、大屏、K 线图', en: 'ECharts, dashboards, candlesticks' } },
		],
	},
	{
		id: 'lowcode',
		title: { 'zh-CN': '低代码与全栈协作', en: 'Low-code & Full-stack' },
		hint: { 'zh-CN': '不只会用平台，能独立交付一整套系统', en: 'Not just a platform user — ships whole systems alone' },
		items: [
			{ name: '飞书 aPaaS', level: 'core', note: { 'zh-CN': '表结构、流程、权限、交付', en: 'Schema, workflow, permissions' } },
			{ name: '多维表格 / 云函数', level: 'pro', note: { 'zh-CN': '业务逻辑与数据联动', en: 'Business logic, table linkage' } },
			{ name: 'Webhook / 接口回调', level: 'pro', note: { 'zh-CN': '第三方系统双向同步', en: 'Two-way third-party sync' } },
			{ name: 'RESTful / Mock', level: 'pro', note: { 'zh-CN': '接口设计与联调', en: 'API design and integration' } },
			{ name: 'Python / pandas', level: 'know', note: { 'zh-CN': '脚本、报表与 API 对接（Cursor 辅助）', en: 'Scripts, reports, API glue (Cursor-assisted)' } },
		],
	},
	{
		id: 'ai',
		title: { 'zh-CN': 'AI 辅助开发', en: 'AI-assisted Development' },
		hint: { 'zh-CN': '把模糊需求翻译成可验证的代码', en: 'Turning vague asks into verifiable code' },
		items: [
			{ name: 'Trae / Cursor', level: 'core', note: { 'zh-CN': '代码生成、重构、补测试', en: 'Generation, refactor, tests' } },
			{ name: 'Prompt Engineering', level: 'pro', note: { 'zh-CN': '需求拆解与约束表达', en: 'Decomposition and constraints' } },
			{ name: 'vibe coding 工作流', level: 'pro', note: { 'zh-CN': '快速验证到落地交付', en: 'Prototype to delivery' } },
		],
	},
];

const RAW_TIMELINE: {
	id: string;
	period: string;
	kind: TimelineKind;
	title: L10n;
	org: L10n;
	summary: L10n;
	bullets: L10n[];
	tags: string[];
}[] = [
	{
		id: 'vmine',
		period: '2026.06 – 至今',
		kind: 'work',
		title: { 'zh-CN': '前端开发 · 中台底座 / AI 应用', en: 'Frontend Engineer · Platform & AI' },
		org: { 'zh-CN': '上海招商局招商智科', en: 'China Merchants Zhike, Shanghai' },
		summary: {
			'zh-CN':
				'负责船舶智能化中台的 Vue 3 微前端底座与「数字化交付」子系统，打通 Module Federation 接入、权限 / 船舶 / 主题上下文、复杂文档工程与 RAG 智能问答全链路。',
			en: 'Own the Vue 3 micro-frontend base of the ship-intelligence platform and its digital-delivery sub-system, covering Module Federation onboarding, permission/vessel/theme context, document engineering and RAG Q&A.',
		},
		bullets: [
			{
				'zh-CN': '设计注册表 + 动态 Loader + 接入契约，支撑 4 个子系统独立开发与部署，单个 Remote 失败不阻塞主应用',
				en: 'Designed the registry, dynamic loader and integration contract so four sub-systems ship independently and one failure never blocks the shell',
			},
			{
				'zh-CN': '手动构造 shareScope 强制框架单例共享，解决刷新深链 404、样式污染、主题不一致等微前端典型问题',
				en: 'Hand-built shareScope for framework singletons; fixed deep-link 404s, style leakage and theme mismatches',
			},
			{
				'zh-CN': '实现 RAG 问答全链路：知识库导入、向量化状态、topK 检索、LLM SSE 流式、引用页码回看、会话导出',
				en: 'Built the RAG chain: knowledge import, vectorisation status, topK retrieval, streamed LLM, page-level citations and export',
			},
			{
				'zh-CN': '建设文档工程能力：200MB 分片续传/秒传、Range 下载、PDF.js 预览与请求取消治理',
				en: 'Built document handling: 200MB chunked resumable uploads, range downloads, PDF.js preview and request-cancellation governance',
			},
		],
		tags: ['Vue 3.5', 'Module Federation', 'RAG / SSE'],
	},
	{
		id: 'report-ops',
		period: '2025.12 – 2026.03',
		kind: 'work',
		title: { 'zh-CN': '独立开发 · 数据自动化', en: 'Solo Developer · Data Automation' },
		org: { 'zh-CN': '内部项目（社群 / 内容电商）', en: 'Internal project (community & content commerce)' },
		summary: {
			'zh-CN':
				'用 Python 把吉客云订单、本地 Excel 与小红书投放数据串成日报自动化链路，Cursor 辅助开发，独立完成口径确认与链路调试。',
			en: 'Connected Jikeyun orders, local Excel and Xiaohongshu ad data into an automated daily-report pipeline in Python, built with Cursor assistance and owned end to end.',
		},
		bullets: [
			{
				'zh-CN': '对接吉客云 OpenAPI 拉订单，自行实现签名与分页，按业务日（10 点切分）补拉数据',
				en: 'Integrated the Jikeyun OpenAPI with self-implemented signing and pagination, backfilling by business day (10:00 cutoff)',
			},
			{
				'zh-CN': '用 Playwright 自动化小红书千帆投放导出，按日汇总消费',
				en: 'Automated Xiaohongshu Qianfan ad exports with Playwright and aggregated spend per day',
			},
			{
				'zh-CN': 'pandas 合并多源数据生成报表，smtplib 发带附件的邮件，任务计划定时执行',
				en: 'Merged sources with pandas into reports, mailed attachments via smtplib, scheduled with Task Scheduler',
			},
		],
		tags: ['Python', '吉客云 API', 'Playwright'],
	},
	{
		id: 'qianxing',
		period: '2025.06 – 2025.12',
		kind: 'work',
		title: { 'zh-CN': '低代码全栈工程师', en: 'Low-code Full-stack Engineer' },
		org: { 'zh-CN': '上海骞行', en: 'Shanghai Qianxing' },
		summary: {
			'zh-CN': '在飞书 aPaaS 上独立交付三套系统，覆盖需求评审、表结构、云函数、权限到上线维护的完整链路。',
			en: 'Delivered three systems solo on Feishu aPaaS, owning the whole chain from requirement review and schema to cloud functions, permissions and post-launch support.',
		},
		bullets: [
			{ 'zh-CN': '独立完成 YFS 工单、CCAB 窗口匹配、多维表格合同管理三套系统的设计与开发', en: 'Designed and built YFS ticketing, CCAB matching and contract management end to end' },
			{ 'zh-CN': '负责数据表字段与关联设计、流程编排、前端权限与移动端开发', en: 'Owned schema and relations, workflow orchestration, frontend permissions and mobile' },
			{ 'zh-CN': '与后端对接 Webhook 与接口回调，编写云函数实现匹配与统计逻辑', en: 'Integrated webhooks and callbacks; wrote cloud functions for matching and metrics' },
			{ 'zh-CN': '组织前端周会，推进从设计、交付到完整上线', en: 'Ran the weekly frontend sync and drove design-to-launch delivery' },
		],
		tags: ['飞书 aPaaS', '云函数', '流程编排'],
	},
	{
		id: 'outsource',
		period: '2024.02 – 2024.06',
		kind: 'parallel',
		title: { 'zh-CN': '前端开发工程师（外包）', en: 'Frontend Engineer (contract)' },
		org: { 'zh-CN': '外包项目 · 旗技云视频', en: 'Contract project · Qiji Cloud Video' },
		summary: {
			'zh-CN': '在职期间以外部协作方式承接云视频系统，负责三套子系统的前端重构与大文件上传方案。',
			en: 'Took on the cloud video platform alongside my day job, rebuilding three consoles and the large-file upload pipeline.',
		},
		bullets: [
			{ 'zh-CN': 'Vue3 + TS + Pinia 重构三套系统，动态路由 + 接口配置实现鉴权', en: 'Rebuilt three consoles on Vue 3 + TS + Pinia with config-driven dynamic routing' },
			{ 'zh-CN': '实现切片上传、断点续传与文件夹上传，内存稳定在 700MB 内', en: 'Shipped chunked, resumable and folder uploads with memory held under 700MB' },
			{ 'zh-CN': '对接腾讯、巨量、磁力、TikTok 等媒体平台投放 API', en: 'Integrated Tencent, Ocean Engine, Cili and TikTok ad APIs' },
			{ 'zh-CN': '排查封面体积与视频预览请求，解决 60+ 条列表卡顿', en: 'Fixed cover-image weight and preview requests to stop 60+ item lists from stuttering' },
		],
		tags: ['Vue 3', 'TypeScript', '断点续传'],
	},
	{
		id: 'sichuang',
		period: '2023.09 – 2025.04',
		kind: 'work',
		title: { 'zh-CN': '前端开发工程师', en: 'Frontend Engineer' },
		org: { 'zh-CN': '上海思创电器设备有限公司', en: 'Shanghai Sichuang Electric Equipment' },
		summary: {
			'zh-CN': '与北京电科院对接的国家电网变电设备检测平台，从零搭建 PC 端、移动端与数据大屏。',
			en: 'Built the State Grid substation-equipment testing platform with Beijing EPRI from scratch: web, mobile and a data wall.',
		},
		bullets: [
			{ 'zh-CN': '负责客户入口、入库、下单、检测与移动端模块', en: 'Owned the customer portal, intake, ordering, testing and mobile modules' },
			{ 'zh-CN': '封装 table / formModal / 请求 hook 等通用能力，统一开发范式', en: 'Packaged table, formModal and request hooks into a shared development pattern' },
			{ 'zh-CN': 'antd-vue 主题定制、SignalR 实时通信、ECharts 可视化与自研大屏表格', en: 'antd-vue theming, SignalR realtime, ECharts and a bespoke dashboard table' },
			{ 'zh-CN': '试验完成后按结果自动生成样品合格检测报告', en: 'Auto-generated sample certificates once tests completed' },
		],
		tags: ['Vue 2', 'antd-vue', 'SignalR'],
	},
	{
		id: 'intern',
		period: '2022.08 – 2023.07',
		kind: 'intern',
		title: { 'zh-CN': '前端开发实习生', en: 'Frontend Intern' },
		org: { 'zh-CN': '云智能科技 · 简宜运', en: 'Yunzhineng Technology · JianYiYun' },
		summary: {
			'zh-CN': '参与数字化货代平台的官网、后台、DSCFI 与 uni-app 移动端开发，并维护官方组件库文档。',
			en: 'Contributed to the freight platform’s site, admin, DSCFI and uni-app mobile app, and maintained the component-library docs.',
		},
		bullets: [
			{ 'zh-CN': 'Nuxt 官网查价与运输路径查询，ToC 全站 i18n 国际化', en: 'Nuxt quoting and route lookup with i18n across all ToC pages' },
			{ 'zh-CN': 'admin / PMS 后台模块开发，含价格池与航线配置', en: 'Admin/PMS modules including price pools and route configuration' },
			{ 'zh-CN': 'uni-app 移动端：地图选点、分页加载、跨页传参与缓存优化', en: 'uni-app mobile: map picking, pagination, cross-page events and caching' },
			{ 'zh-CN': '接入 AI 智能客服、智能邮箱与支付宝支付', en: 'Integrated AI support, smart mailbox and Alipay' },
		],
		tags: ['Nuxt', 'uni-app', 'i18n'],
	},
	{
		id: 'edu',
		period: '2019.09 – 2023.06',
		kind: 'edu',
		title: { 'zh-CN': '软件工程 · 本科', en: 'B.Eng. in Software Engineering' },
		org: { 'zh-CN': '广东白云学院', en: 'Guangdong Baiyun University' },
		summary: {
			'zh-CN': 'GPA 4.0（专业前 5%）；主修软件工程、数据结构与算法、线性代数、离散数学。',
			en: 'GPA 4.0 (top 5% of major); coursework in software engineering, data structures and algorithms, linear algebra and discrete mathematics.',
		},
		bullets: [],
		tags: ['GPA 4.0', '专业前 5%'],
	},
];

const RAW_CERTIFICATES: { name: L10n; note: L10n }[] = [
	{ name: { 'zh-CN': 'CET-4', en: 'CET-4' }, note: { 'zh-CN': '大学英语四级', en: 'College English Test Band 4' } },
	{ name: { 'zh-CN': 'CET-6', en: 'CET-6' }, note: { 'zh-CN': '大学英语六级', en: 'College English Test Band 6' } },
	{ name: { 'zh-CN': '普通话二级甲等', en: 'Mandarin Grade II-A' }, note: { 'zh-CN': '国家普通话水平测试', en: 'National Mandarin Proficiency Test' } },
];

const UI_TEXT: Record<Lang, ResumeUi> = {
	'zh-CN': {
		site: 'Eccentric Event',
		back: '返回站点',
		navResume: '简历',
		print: '打印 / 存为 PDF',
		printHint: '使用浏览器打印即可导出 A4 简历',
		copyEmail: '复制邮箱',
		copied: '邮箱已复制',
		viewProjects: '查看项目详情',
		sections: {
			profile: '个人简介',
			skills: '技能矩阵',
			experience: '经历',
			projects: '项目',
			more: '教育与证书',
		},
		skillHints: { core: '主力', pro: '熟练', know: '了解' },
		drawer: {
			close: '关闭',
			background: '项目背景',
			mine: '我做了什么',
			challenges: '技术难点',
			results: '结果',
			stack: '技术栈',
			role: '角色',
			period: '时间',
			open: '查看详情',
			detail: '项目详情',
		},
		printFooter: '本页为在线简历，打印版本由浏览器生成',
	},
	en: {
		site: 'Eccentric Event',
		back: 'Back to site',
		navResume: 'Resume',
		print: 'Print / Save as PDF',
		printHint: 'Use your browser print dialog to export an A4 resume',
		copyEmail: 'Copy email',
		copied: 'Email copied',
		viewProjects: 'View project details',
		sections: {
			profile: 'Profile',
			skills: 'Skills',
			experience: 'Experience',
			projects: 'Projects',
			more: 'Education & Certificates',
		},
		skillHints: { core: 'Core', pro: 'Proficient', know: 'Familiar' },
		drawer: {
			close: 'Close',
			background: 'Context',
			mine: 'What I did',
			challenges: 'Hard parts',
			results: 'Outcome',
			stack: 'Stack',
			role: 'Role',
			period: 'Period',
			open: 'Details',
			detail: 'Project details',
		},
		printFooter: 'Online resume — the printed version is generated by your browser',
	},
};

const PROFILE: Record<
	Lang,
	{ name: string; nameEn: string; role: string; eyebrow: string; tagline: string; description: string; title: string }
> = {
	'zh-CN': {
		name: '唐文轩',
		nameEn: 'Wenxuan Tang',
		role: '前端开发工程师 · 微前端 / AI 应用',
		eyebrow: 'FRONTEND ENGINEER / ARCHITECTURE · AI',
		tagline:
			'近四年前端经验，横跨工业软件、低代码与 AI 应用：在船舶智能化中台做 Vue 3 微前端底座与数字化交付子系统，也在飞书 aPaaS 上独立交付过工单、窗口匹配与合同系统。擅长把复杂业务与多方接入拆成结构清晰、可持续演进的前端架构。',
		description:
			'唐文轩的在线简历：前端开发工程师，近四年经验，专注微前端架构与 AI 应用（Vue 3 + Module Federation + RAG），含项目详情与可打印版本。',
		title: '唐文轩 · 前端开发工程师',
	},
	en: {
		name: 'Wenxuan Tang',
		nameEn: 'Marco Tang',
		role: 'Frontend Engineer · Micro-frontend & AI',
		eyebrow: 'FRONTEND ENGINEER / ARCHITECTURE · AI',
		tagline:
			'Four years across industrial software, low-code and AI applications: building the Vue 3 micro-frontend base and digital-delivery sub-system for a ship-intelligence platform, and shipping ticketing, window-matching and contract systems solo on Feishu aPaaS. I turn tangled business flows and multi-team integrations into clear, evolvable frontend architecture.',
		description:
			'Online resume of Wenxuan Tang, a frontend engineer with four years of experience in micro-frontend architecture and AI applications (Vue 3, Module Federation, RAG).',
		title: 'Wenxuan Tang · Frontend Engineer',
	},
};

const CONTACTS: { icon: Contact['icon']; label: L10n; value: string; valueEn?: string; href?: string }[] = [
	{ icon: 'mail', label: { 'zh-CN': '邮箱', en: 'Email' }, value: 'marcoustang@gmail.com', href: 'mailto:marcoustang@gmail.com' },
	{ icon: 'phone', label: { 'zh-CN': '手机', en: 'Phone' }, value: '182-6032-9723', href: 'tel:18260329723' },
	{ icon: 'pin', label: { 'zh-CN': '城市', en: 'Location' }, value: '上海', valueEn: 'Shanghai' },
];

/* ------------------------------------------------------------------ */
/* 解析：把双语数据打平成当前语言可直接渲染的结构                        */
/* ------------------------------------------------------------------ */

const pick = (node: L10n, lang: Lang): string => node[lang];
const pickAll = (nodes: L10n[], lang: Lang): string[] => nodes.map((n) => n[lang]);

/**
 * 技术栈 / 标签 / 技能名这类「术语」多为中英混排的短词，逐个写 L10n 太啰嗦，
 * 这里用一张对照表在英文页做替换；表里没有的原样保留（如 Vue 3、Playwright）。
 */
const TERM_EN: Record<string, string> = {
	通用组件库: 'Component library',
	'shareScope 单例共享': 'shareScope singletons',
	接入契约与动态注入: 'Module contract & injection',
	'iframe postMessage 桥接': 'iframe postMessage bridge',
	'RAG 知识库 / 检索': 'RAG knowledge base',
	'LLM SSE 流式': 'LLM SSE streaming',
	'Prompt 工程': 'Prompt engineering',
	'引用溯源 / ASR·TTS': 'Citations · ASR/TTS',
	性能优化: 'Performance tuning',
	微信小程序: 'WeChat mini-program',
	响应式适配: 'Responsive layout',
	数据可视化: 'Data visualisation',
	'飞书 aPaaS': 'Feishu aPaaS',
	'多维表格 / 云函数': 'Bitable / cloud functions',
	'Webhook / 接口回调': 'Webhook / callbacks',
	'vibe coding 工作流': 'vibe coding workflow',
	云函数: 'Cloud functions',
	流程编排: 'Workflow orchestration',
	断点续传: 'Resumable upload',
	'专业前 5%': 'Top 5%',
	'吉客云 OpenAPI': 'Jikeyun OpenAPI',
	'吉客云 API': 'Jikeyun API',
	飞书卡片: 'Feishu cards',
	定时任务: 'Scheduled jobs',
	日历窗口: 'Calendar slots',
	'会议 API': 'Meeting API',
	'飞书多维表格': 'Feishu Bitable',
	'JavaScript 自定义计算': 'Custom JS calculation',
	'Excel 导入': 'Excel import',
	数据看板: 'Dashboard',
	动态路由: 'Dynamic routing',
	切片上传: 'Chunked upload',
	'媒体开放平台 API': 'Ad platform APIs',
	支付宝支付: 'Alipay',
	'.NET Core': '.NET Core',
};

const localizeTerm = (term: string, lang: Lang): string =>
	lang === 'en' ? (TERM_EN[term] ?? term) : term;

/** 时间段里的中文「至今」在英文页替换为 Present，日期本身保持原样 */
const localizePeriod = (period: string, lang: Lang): string =>
	lang === 'en' ? period.replace('至今', 'Present') : period;

const PROJECT_IDS = RAW_PROJECTS.map((p) => p.id);

/** 按语言解析出完整简历数据 */
export function getResume(lang: Lang): Resume {
	const profile = PROFILE[lang];
	const ui = UI_TEXT[lang];

	return {
		lang,
		meta: { title: profile.title, description: profile.description },
		ui,
		name: profile.name,
		nameEn: profile.nameEn,
		role: profile.role,
		eyebrow: profile.eyebrow,
		tagline: profile.tagline,
		contacts: CONTACTS.map((c) => ({
			icon: c.icon,
			label: pick(c.label, lang),
			value: lang === 'en' ? (c.valueEn ?? c.value) : c.value,
			href: c.href,
		})),
		stats: [
			{ value: '4', label: lang === 'zh-CN' ? '年前端经验' : 'years of frontend' },
			{ value: '9', label: lang === 'zh-CN' ? '个已交付项目' : 'shipped projects' },
			{ value: '4', label: lang === 'zh-CN' ? '个子系统接入中台' : 'sub-systems on one shell' },
			{ value: '4.0', label: lang === 'zh-CN' ? 'GPA · 专业前 5%' : 'GPA · top 5%' },
		],
		skills: RAW_SKILLS.map((group) => ({
			id: group.id,
			title: pick(group.title, lang),
			hint: pick(group.hint, lang),
			items: group.items.map((item) => ({
				name: localizeTerm(item.name, lang),
				level: item.level,
				note: item.note ? pick(item.note, lang) : undefined,
			})),
		})),
		timeline: RAW_TIMELINE.map((entry) => ({
			id: entry.id,
			period: localizePeriod(entry.period, lang),
			kind: entry.kind,
			title: pick(entry.title, lang),
			org: pick(entry.org, lang),
			summary: pick(entry.summary, lang),
			bullets: pickAll(entry.bullets, lang),
			tags: entry.tags.map((tag) => localizeTerm(tag, lang)),
		})),
		projects: RAW_PROJECTS.map((project) => ({
			id: project.id,
			name: pick(project.name, lang),
			subtitle: pick(project.subtitle, lang),
			period: localizePeriod(project.period, lang),
			role: pick(project.role, lang),
			company: pick(project.company, lang),
			tagline: pick(project.tagline, lang),
			stack: project.stack.map((tech) => localizeTerm(tech, lang)),
			metrics: (project.metrics ?? []).map((m) => ({ value: m.value, label: pick(m.label, lang) })),
			story: {
				background: pick(project.story.background, lang),
				mine: pickAll(project.story.mine, lang),
				challenges: pickAll(project.story.challenges, lang),
				results: pickAll(project.story.results, lang),
			},
			link: project.link ? { label: pick(project.link.label, lang), href: project.link.href } : undefined,
		})),
		certificates: RAW_CERTIFICATES.map((cert) => ({ name: pick(cert.name, lang), note: pick(cert.note, lang) })),
		printOrder: PROJECT_IDS,
	};
}

/** 简历页面文案（用于导航等站点级引用） */
export const resumeUi = UI_TEXT;
