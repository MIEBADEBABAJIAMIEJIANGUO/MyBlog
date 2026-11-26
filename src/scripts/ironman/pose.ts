// 文件说明：MediaPipe Pose Landmarker 初始化、摄像头接入与姿态检测循环。
import { FilesetResolver, PoseLandmarker, type NormalizedLandmark } from '@mediapipe/tasks-vision';

/** 检测间隔（毫秒），约 30fps，提升手臂快速动作响应 */
// 原代码注释：export const DETECTION_INTERVAL_MS = 66; // 约 15fps
export const DETECTION_INTERVAL_MS = 33;

/** 连续未检测帧数阈值，超过后触发 T-pose 回退 */
export const NO_POSE_FRAME_THRESHOLD = 30;

/** 姿态检测回调 */
export type PoseDetectionCallback = (landmarks: NormalizedLandmark[] | null, fps: number) => void;

/** PoseLandmarker 检测结果（仅用到 landmarks 字段） */
interface PoseLandmarkerResult {
	landmarks?: NormalizedLandmark[][];
}

/**
 * 从多人检测结果中选取平均 visibility 最高的一组关键点。
 */
export function selectBestPose(results: PoseLandmarkerResult): NormalizedLandmark[] | null {
	const poses = results.landmarks;
	if (!poses || poses.length === 0) return null;
	if (poses.length === 1) return poses[0] ?? null;

	let best: NormalizedLandmark[] | null = null;
	let bestScore = -1;
	for (const pose of poses) {
		if (!pose || pose.length === 0) continue;
		let sum = 0;
		let count = 0;
		for (const lm of pose) {
			sum += lm.visibility ?? 1;
			count++;
		}
		const score = count > 0 ? sum / count : 0;
		if (score > bestScore) {
			bestScore = score;
			best = pose;
		}
	}
	return best;
}

/**
 * 初始化 PoseLandmarker，本地 WASM + 多级模型 URL 回退。
 */
export async function initPoseLandmarker(): Promise<PoseLandmarker | null> {
	const tryCreate = async (modelUrl: string) => {
		const vision = await FilesetResolver.forVisionTasks('/wasm');
		return PoseLandmarker.createFromOptions(vision, {
			baseOptions: { modelAssetPath: modelUrl, delegate: 'GPU' },
			runningMode: 'VIDEO',
			numPoses: 3,
			minPoseDetectionConfidence: 0.5,
			minPosePresenceConfidence: 0.5,
			minTrackingConfidence: 0.5,
		});
	};

	const candidates = [
		'/models/pose_landmarker.task',
		'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task',
		'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.21/wasm/pose_landmarker_lite.task',
	];

	for (const url of candidates) {
		try {
			return await tryCreate(url);
		} catch (err) {
			console.warn('PoseLandmarker init failed with', url, err);
		}
	}
	return null;
}

/**
 * 请求前置摄像头并绑定到 video 元素。
 */
export async function setupCamera(video: HTMLVideoElement): Promise<boolean> {
	try {
		const stream = await navigator.mediaDevices.getUserMedia({
			video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: 'user' },
			audio: false,
		});
		video.srcObject = stream;
		video.muted = true;
		video.playsInline = true;
		await video.play();
		return true;
	} catch (err) {
		console.warn('Camera setup failed:', err);
		return false;
	}
}

/**
 * 停止摄像头流并释放资源。
 */
export function stopCamera(video: HTMLVideoElement): void {
	const stream = video.srcObject as MediaStream | null;
	if (stream) {
		for (const track of stream.getTracks()) track.stop();
	}
	video.srcObject = null;
}

/**
 * 启动定频姿态检测循环，返回清除函数。
 */
export function startPoseDetectionLoop(
	video: HTMLVideoElement,
	landmarker: PoseLandmarker,
	onResult: PoseDetectionCallback,
): () => void {
	let lastFpsTime = performance.now();
	let frameCount = 0;
	let currentFps = 0;

	const timer = window.setInterval(() => {
		if (document.hidden || video.readyState < 2) return;

		const results = landmarker.detectForVideo(video, performance.now());
		frameCount++;

		const now = performance.now();
		if (now - lastFpsTime >= 1000) {
			currentFps = frameCount;
			frameCount = 0;
			lastFpsTime = now;
		}

		const landmarks = selectBestPose(results);
		onResult(landmarks, currentFps);
	}, DETECTION_INTERVAL_MS);

	return () => clearInterval(timer);
}
