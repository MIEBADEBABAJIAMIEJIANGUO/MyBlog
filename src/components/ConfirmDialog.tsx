// 文件说明：基于 Radix Alert Dialog 的删除确认弹窗，替代浏览器 confirm。
import * as AlertDialog from '@radix-ui/react-alert-dialog';
import { useCallback, useEffect, useState } from 'react';
import {
	CONFIRM_DIALOG_EVENT,
	settleConfirm,
	type ConfirmDialogLabels,
	type ConfirmDialogPayload,
} from '../scripts/confirmDialog';

interface Props {
	labels: ConfirmDialogLabels;
}

/**
 * 挂载于文件管理页，监听确认事件并展示 Radix 确认框。
 */
export default function ConfirmDialog({ labels }: Props) {
	const [open, setOpen] = useState(false);
	const [message, setMessage] = useState('');

	const handleOpenChange = useCallback((next: boolean) => {
		setOpen(next);
		if (!next) settleConfirm(false);
	}, []);

	useEffect(() => {
		const handler = (event: Event) => {
			const detail = (event as CustomEvent<ConfirmDialogPayload>).detail;
			if (!detail?.message) return;
			setMessage(detail.message);
			setOpen(true);
		};

		window.addEventListener(CONFIRM_DIALOG_EVENT, handler);
		return () => window.removeEventListener(CONFIRM_DIALOG_EVENT, handler);
	}, []);

	return (
		<AlertDialog.Root open={open} onOpenChange={handleOpenChange}>
			<AlertDialog.Portal>
				<AlertDialog.Overlay className="fixed inset-0 bg-black/50 z-[80]" />
				<AlertDialog.Content className="fixed left-1/2 top-1/2 z-[90] w-[min(420px,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 rounded-xl bg-white shadow-xl p-6 outline-none">
					<AlertDialog.Title className="sr-only">{labels.confirm}</AlertDialog.Title>
					<AlertDialog.Description className="text-sm text-gray-700 leading-relaxed">
						{message}
					</AlertDialog.Description>
					<div className="mt-6 flex justify-end gap-3">
						<AlertDialog.Cancel className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 text-gray-700">
							{labels.cancel}
						</AlertDialog.Cancel>
						<AlertDialog.Action
							className="px-4 py-2 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700"
							onClick={() => settleConfirm(true)}
						>
							{labels.confirm}
						</AlertDialog.Action>
					</div>
				</AlertDialog.Content>
			</AlertDialog.Portal>
		</AlertDialog.Root>
	);
}
