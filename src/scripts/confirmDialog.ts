// 文件说明：删除确认弹窗的事件桥接，替代浏览器原生 confirm。
export const CONFIRM_DIALOG_EVENT = 'confirm-dialog-open';

/** 确认弹窗文案 */
export interface ConfirmDialogLabels {
	cancel: string;
	confirm: string;
}

/** 打开确认弹窗时传递的文案 */
export interface ConfirmDialogPayload {
	message: string;
}

let pendingResolve: ((confirmed: boolean) => void) | null = null;

/**
 * 弹出确认框并返回用户是否确认。
 */
export function requestConfirm(message: string): Promise<boolean> {
	if (pendingResolve) {
		pendingResolve(false);
		pendingResolve = null;
	}
	return new Promise((resolve) => {
		pendingResolve = resolve;
		window.dispatchEvent(
			new CustomEvent(CONFIRM_DIALOG_EVENT, { detail: { message } satisfies ConfirmDialogPayload }),
		);
	});
}

/**
 * 由 ConfirmDialog 组件调用，结束当前确认流程。
 */
export function settleConfirm(confirmed: boolean): void {
	if (pendingResolve) {
		pendingResolve(confirmed);
		pendingResolve = null;
	}
}
