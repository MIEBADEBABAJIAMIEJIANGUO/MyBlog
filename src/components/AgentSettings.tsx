// 文件说明：Agent 人设与知识库绑定设置页 React 组件。
import { useEffect, useState } from 'react';
import type { AgentConfig, AgentLabels } from '../scripts/agent/labels';
import '../styles/agent-acg-theme.css';
import LottieLoading from './LottieLoading';
import { fetchAgentConfig, fetchFilesForBinding, saveAgentConfig } from '../scripts/agent/api';

interface Props {
	labels: AgentLabels;
	chatHref: string;
}

/**
 * Agent 设置表单：人设编辑 + 文件绑定多选。
 */
export default function AgentSettings({ labels, chatHref }: Props) {
	const [config, setConfig] = useState<AgentConfig | null>(null);
	const [files, setFiles] = useState<
		Array<{ filename: string; originalName: string; indexStatus?: string }>
	>([]);
	const [loading, setLoading] = useState(true);
	const [saving, setSaving] = useState(false);
	const [toast, setToast] = useState('');

	useEffect(() => {
		void (async () => {
			try {
				const [cfg, fileList] = await Promise.all([fetchAgentConfig(), fetchFilesForBinding()]);
				setConfig(cfg);
				setFiles(fileList);
			} finally {
				setLoading(false);
			}
		})();
	}, []);

	const toggleFile = (filename: string) => {
		if (!config) return;
		const set = new Set(config.boundFilenames);
		if (set.has(filename)) set.delete(filename);
		else set.add(filename);
		setConfig({ ...config, boundFilenames: [...set] });
	};

	const handleSave = async () => {
		if (!config) return;
		setSaving(true);
		try {
			const saved = await saveAgentConfig(config);
			setConfig(saved);
			setToast(labels.saved);
		} catch {
			setToast(labels.saveFailed);
		} finally {
			setSaving(false);
			setTimeout(() => setToast(''), 2000);
		}
	};

	if (loading || !config) {
		return (
			<div className="flex items-center justify-center min-h-[300px]">
				<LottieLoading size="md" label={labels.loading} />
			</div>
		);
	}

	const allIndexed = files.filter((f) => f.indexStatus === 'done').map((f) => f.filename);
	const selectAllIndexed = () => setConfig({ ...config, boundFilenames: [...allIndexed] });
	const clearAll = () => setConfig({ ...config, boundFilenames: [] });

	return (
		<div className="agent-settings-panel space-y-6">
			<div className="flex items-center justify-between">
				<h1 className="agent-settings-title">{labels.settingsTitle}</h1>
				<a href={chatHref} className="agent-link-accent">
					{labels.backToChat}
				</a>
			</div>

			<section className="agent-settings-section space-y-4">
				<div>
					<label className="block text-sm font-medium text-gray-700 mb-1">{labels.name}</label>
					<input
						type="text"
						value={config.name}
						onChange={(e) => setConfig({ ...config, name: e.target.value })}
						className="agent-settings-input"
					/>
				</div>
				<div>
					<label className="block text-sm font-medium text-gray-700 mb-1">{labels.persona}</label>
					<textarea
						value={config.persona}
						onChange={(e) => setConfig({ ...config, persona: e.target.value })}
						rows={4}
						className="agent-settings-input"
					/>
				</div>
				<div>
					<label className="block text-sm font-medium text-gray-700 mb-1">{labels.speakingStyle}</label>
					<input
						type="text"
						value={config.speakingStyle}
						onChange={(e) => setConfig({ ...config, speakingStyle: e.target.value })}
						className="agent-settings-input"
					/>
				</div>
				<div>
					<label className="block text-sm font-medium text-gray-700 mb-1">{labels.background}</label>
					<textarea
						value={config.background}
						onChange={(e) => setConfig({ ...config, background: e.target.value })}
						rows={3}
						className="agent-settings-input"
					/>
				</div>
			</section>

			<section className="agent-settings-section">
				<div className="flex items-center justify-between mb-2">
					<h2 className="text-sm font-semibold text-gray-900">{labels.boundFiles}</h2>
					<div className="flex gap-2 text-xs">
						<button type="button" onClick={selectAllIndexed} className="agent-link-accent border-none bg-transparent cursor-pointer p-0">
							{labels.selectAll}
						</button>
						<button type="button" onClick={clearAll} className="text-gray-500 hover:underline border-none bg-transparent cursor-pointer">
							{labels.deselectAll}
						</button>
					</div>
				</div>
				<p className="text-xs text-gray-500 mb-4">{labels.boundFilesHint}</p>
				<div className="max-h-64 overflow-y-auto space-y-2 border border-pink-100 rounded-lg p-3 bg-white/60">
					{files.length === 0 && <p className="text-xs text-gray-400">暂无文件，请先上传</p>}
					{files.map((f) => (
						<label
							key={f.filename}
							className="flex items-center gap-2 text-sm cursor-pointer hover:bg-pink-50/80 rounded px-1 py-0.5"
						>
							<input
								type="checkbox"
								checked={config.boundFilenames.includes(f.filename)}
								onChange={() => toggleFile(f.filename)}
							/>
							<span className="truncate flex-1">{f.originalName}</span>
							<span
								className={`text-xs shrink-0 ${
									f.indexStatus === 'done' ? 'text-green-600' : 'text-gray-400'
								}`}
							>
								{f.indexStatus === 'done' ? labels.indexed : labels.notIndexed}
							</span>
						</label>
					))}
				</div>
			</section>

			<div className="flex items-center gap-3">
				<button
					type="button"
					disabled={saving}
					onClick={() => void handleSave()}
					className="agent-btn-primary agent-btn-primary--compact"
				>
					{labels.save}
				</button>
				{toast && <span className="text-sm text-gray-600">{toast}</span>}
			</div>
		</div>
	);
}
