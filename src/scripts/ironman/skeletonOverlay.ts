// 文件说明：PiP 小窗姿态骨架 2D 叠加绘制，在视频上方绘制 MediaPipe Pose 上半身红色骨架。
import type { NormalizedLandmark } from '@mediapipe/tasks-vision';

/** 骨架线条颜色（纯红） */
const SKELETON_COLOR = 'rgb(255, 0, 0)';
/** 骨架连线宽度（2-3 像素） */
const LINE_WIDTH = 2.5;
/** 关节圆点半径（4-6 像素） */
const JOINT_RADIUS = 5;
/** 关键点可见性阈值 */
const VIS_THRESHOLD = 0.5;

/** MediaPipe Pose 上半身连接关系 */
export const UPPER_BODY_CONNECTIONS: [number, number][] = [
	[2, 5],
	[2, 0],
	[5, 0],
	[7, 2],
	[8, 5],
	[11, 12],
	[11, 23],
	[12, 24],
	[11, 13],
	[13, 15],
	[12, 14],
	[14, 16],
];

/** 上半身需要绘制圆点的关节索引（去重） */
export const UPPER_BODY_LANDMARKS: number[] = [
	0, 2, 5, 7, 8, 11, 12, 13, 14, 15, 16, 23, 24,
];

let lastPipWidth = 0;
let lastPipHeight = 0;

/**
 * 判断关键点是否可见且可用于绘制。
 */
function isDrawable(lm: NormalizedLandmark | undefined): lm is NormalizedLandmark {
	return !!lm && (lm.visibility ?? 1) >= VIS_THRESHOLD;
}

/**
 * 将归一化坐标映射到 canvas 像素坐标（镜像由 CSS scaleX(-1) 处理）。
 */
function toCanvasPoint(
	lm: NormalizedLandmark,
	canvas: HTMLCanvasElement,
): { x: number; y: number } {
	return {
		x: lm.x * canvas.width,
		y: lm.y * canvas.height,
	};
}

/**
 * 同步 overlay canvas 像素尺寸与 PiP 容器（考虑 devicePixelRatio，仅在尺寸变化时更新）。
 */
export function resizePipOverlay(canvas: HTMLCanvasElement, pipEl: HTMLElement): void {
	const rect = pipEl.getBoundingClientRect();
	const dpr = Math.min(window.devicePixelRatio || 1, 2);
	const w = Math.max(1, Math.round(rect.width * dpr));
	const h = Math.max(1, Math.round(rect.height * dpr));
	if (w === lastPipWidth && h === lastPipHeight) return;
	canvas.width = w;
	canvas.height = h;
	lastPipWidth = w;
	lastPipHeight = h;
}

/**
 * 在 PiP overlay 上清除并重绘姿态骨架；landmarks 为 null 时仅清除画布。
 */
export function drawPoseSkeleton(
	ctx: CanvasRenderingContext2D,
	canvas: HTMLCanvasElement,
	landmarks: NormalizedLandmark[] | null,
): void {
	ctx.clearRect(0, 0, canvas.width, canvas.height);
	if (!landmarks || landmarks.length === 0) return;

	ctx.strokeStyle = SKELETON_COLOR;
	ctx.fillStyle = SKELETON_COLOR;
	ctx.lineWidth = LINE_WIDTH;
	ctx.lineCap = 'round';
	ctx.lineJoin = 'round';

	for (const [aIdx, bIdx] of UPPER_BODY_CONNECTIONS) {
		const a = landmarks[aIdx];
		const b = landmarks[bIdx];
		if (!isDrawable(a) || !isDrawable(b)) continue;
		const pa = toCanvasPoint(a, canvas);
		const pb = toCanvasPoint(b, canvas);
		ctx.beginPath();
		ctx.moveTo(pa.x, pa.y);
		ctx.lineTo(pb.x, pb.y);
		ctx.stroke();
	}

	for (const idx of UPPER_BODY_LANDMARKS) {
		const lm = landmarks[idx];
		if (!isDrawable(lm)) continue;
		const p = toCanvasPoint(lm, canvas);
		ctx.beginPath();
		ctx.arc(p.x, p.y, JOINT_RADIUS, 0, Math.PI * 2);
		ctx.fill();
	}
}
