// 文件说明：简历页的轻量交互脚本——滚动入场、项目详情触发、复制邮箱、打印。
// 只由 ResumeLayout 引入，不影响站点其它页面。
import { RESUME_PROJECT_EVENT } from './resumeEvents';

const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/** 滚动到视口后淡入上移，只做一次 */
function initReveal(): void {
	const items = Array.from(document.querySelectorAll<HTMLElement>('.rz-reveal'));
	if (!items.length) return;

	if (reduceMotion || !('IntersectionObserver' in window)) {
		items.forEach((el) => el.classList.add('is-in'));
		return;
	}

	const observer = new IntersectionObserver(
		(entries) => {
			for (const entry of entries) {
				if (!entry.isIntersecting) continue;
				entry.target.classList.add('is-in');
				observer.unobserve(entry.target);
			}
		},
		{ rootMargin: '0px 0px -12% 0px', threshold: 0.08 },
	);

	items.forEach((el) => observer.observe(el));
}

/** 卡片点击 → 通知 React 抽屉打开对应项目 */
function initProjectTriggers(): void {
	const cards = document.querySelectorAll<HTMLElement>('[data-project-id]');
	cards.forEach((card) => {
		const open = () => {
			const id = card.dataset.projectId;
			if (!id) return;
			window.dispatchEvent(new CustomEvent<string>(RESUME_PROJECT_EVENT, { detail: id }));
		};

		card.addEventListener('click', open);
		card.addEventListener('keydown', (event) => {
			if (event.key === 'Enter' || event.key === ' ') {
				event.preventDefault();
				open();
			}
		});
	});
}

/** 复制邮箱，带降级方案（非 https 环境下 clipboard 不可用） */
function initCopyEmail(): void {
	const buttons = document.querySelectorAll<HTMLElement>('[data-copy-email]');

	buttons.forEach((button) => {
		button.addEventListener('click', async () => {
			const email = button.dataset.copyEmail ?? '';
			if (!email) return;

			try {
				await navigator.clipboard.writeText(email);
			} catch {
				const helper = document.createElement('textarea');
				helper.value = email;
				helper.setAttribute('readonly', '');
				helper.style.position = 'fixed';
				helper.style.opacity = '0';
				document.body.appendChild(helper);
				helper.select();
				document.execCommand('copy');
				document.body.removeChild(helper);
			}

			const original = button.dataset.label ?? button.textContent ?? '';
			button.dataset.label = original;
			button.textContent = button.dataset.copiedLabel ?? original;
			button.classList.add('is-copied');
			window.setTimeout(() => {
				button.textContent = original;
				button.classList.remove('is-copied');
			}, 1800);
		});
	});
}

/** 打印 / 存为 PDF：直接调浏览器打印，A4 版式由 resume.css 的 @media print 控制 */
function initPrint(): void {
	document.querySelectorAll<HTMLElement>('[data-resume-print]').forEach((button) => {
		button.addEventListener('click', () => window.print());
	});
}

initReveal();
initProjectTriggers();
initCopyEmail();
initPrint();
