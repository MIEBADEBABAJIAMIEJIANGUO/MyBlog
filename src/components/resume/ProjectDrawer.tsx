// 文件说明：项目详情抽屉（Radix Dialog）。作为 React 岛屿挂在简历页，
// 通过订阅 RESUME_PROJECT_EVENT 打开对应项目，避免把整个项目列表变成客户端组件。
import * as Dialog from '@radix-ui/react-dialog';
import { useEffect, useState } from 'react';
import type { ProjectView, ResumeUi } from '../../data/resume';
import { RESUME_PROJECT_EVENT } from '../../scripts/resumeEvents';

interface Props {
	projects: ProjectView[];
	labels: ResumeUi['drawer'];
}

export default function ProjectDrawer({ projects, labels }: Props) {
	const [activeId, setActiveId] = useState<string | null>(null);
	const [open, setOpen] = useState(false);

	useEffect(() => {
		const onOpen = (event: Event) => {
			const id = (event as CustomEvent<string>).detail;
			if (!id) return;
			setActiveId(id);
			setOpen(true);
		};

		window.addEventListener(RESUME_PROJECT_EVENT, onOpen);
		return () => window.removeEventListener(RESUME_PROJECT_EVENT, onOpen);
	}, []);

	const project = projects.find((item) => item.id === activeId);

	return (
		<Dialog.Root open={open} onOpenChange={setOpen}>
			<Dialog.Portal>
				<Dialog.Overlay className="rz-drawer-overlay" />
				<Dialog.Content
					className="rz-drawer"
					aria-describedby={undefined}
					onOpenAutoFocus={(event) => event.preventDefault()}
				>
					{project && (
						<>
							<div className="rz-drawer-head">
								<div>
									<span className="rz-drawer-index">
										{labels.detail.toUpperCase()} / {project.period}
									</span>
									<Dialog.Title className="rz-drawer-title">{project.name}</Dialog.Title>
									<p className="rz-drawer-sub">{project.subtitle}</p>
									<p className="rz-drawer-meta">
										<span>{project.company}</span>
										<span>
											{labels.role}：{project.role}
										</span>
										<span>
											{labels.period}：{project.period}
										</span>
									</p>
								</div>
								<Dialog.Close className="rz-drawer-close" aria-label={labels.close}>
									<svg
										viewBox="0 0 24 24"
										width="16"
										height="16"
										fill="none"
										stroke="currentColor"
										strokeWidth="1.8"
										aria-hidden="true"
									>
										<path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" />
									</svg>
								</Dialog.Close>
							</div>

							<div className="rz-drawer-body">
								{project.metrics.length > 0 && (
									<ul className="rz-drawer-metrics">
										{project.metrics.map((metric) => (
											<li className="rz-drawer-metric" key={metric.label}>
												<strong>{metric.value}</strong>
												<span>{metric.label}</span>
											</li>
										))}
									</ul>
								)}

								<section className="rz-drawer-section">
									<h4 className="rz-drawer-label">{labels.background}</h4>
									<p className="rz-drawer-text">{project.story.background}</p>
								</section>

								<section className="rz-drawer-section">
									<h4 className="rz-drawer-label">{labels.mine}</h4>
									<ul className="rz-drawer-list">
										{project.story.mine.map((item) => (
											<li key={item}>{item}</li>
										))}
									</ul>
								</section>

								{project.story.challenges.length > 0 && (
									<section className="rz-drawer-section">
										<h4 className="rz-drawer-label">{labels.challenges}</h4>
										<ul className="rz-drawer-list">
											{project.story.challenges.map((item) => (
												<li key={item}>{item}</li>
											))}
										</ul>
									</section>
								)}

								{project.story.results.length > 0 && (
									<section className="rz-drawer-section">
										<h4 className="rz-drawer-label">{labels.results}</h4>
										<ul className="rz-drawer-list rz-drawer-list--result">
											{project.story.results.map((item) => (
												<li key={item}>{item}</li>
											))}
										</ul>
									</section>
								)}

								<section className="rz-drawer-section">
									<h4 className="rz-drawer-label">{labels.stack}</h4>
									<ul className="rz-drawer-stack">
										{project.stack.map((tech) => (
											<li key={tech}>{tech}</li>
										))}
									</ul>
									{project.link && (
										<a
											className="rz-drawer-link"
											href={project.link.href}
											target="_blank"
											rel="noreferrer noopener"
										>
											{project.link.label} ↗
										</a>
									)}
								</section>
							</div>
						</>
					)}
				</Dialog.Content>
			</Dialog.Portal>
		</Dialog.Root>
	);
}
