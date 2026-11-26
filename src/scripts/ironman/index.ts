// 文件说明：钢铁侠实时姿态同步体验的主入口，负责 Three.js 场景、双循环与 UI 状态更新。
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { createStickman } from './model';
import {
	initPoseLandmarker,
	setupCamera,
	startPoseDetectionLoop,
	stopCamera,
	NO_POSE_FRAME_THRESHOLD,
} from './pose';
import {
	applyStickmanPose,
	createSmoothedJoints,
	defaultJointPositions,
	landmarksToJointPositions,
	updateSmoothedJoints,
	type JointPositions,
} from './rig';
import { drawPoseSkeleton, resizePipOverlay } from './skeletonOverlay';

/** 页面注入的 i18n 文案结构 */
interface IronManLabels {
	statusLoading: string;
	statusTracking: string;
	statusNoPose: string;
	statusCameraDenied: string;
	statusLowFps: string;
	hintStart: string;
	hintCamera: string;
	fpsLabel: string;
	infoTitle: string;
}

/**
 * 从根元素 data-labels 读取翻译文案。
 */
function readLabels(root: HTMLElement): IronManLabels {
	const raw = root.dataset.labels;
	if (!raw) throw new Error('Missing data-labels on ironman-app');
	return JSON.parse(raw) as IronManLabels;
}

/**
 * 初始化姿态同步体验：场景、火柴人、摄像头、检测与渲染双循环。
 */
export async function initIronManExperience(root: HTMLElement): Promise<void> {
	const labels = readLabels(root);
	const canvas = root.querySelector<HTMLCanvasElement>('#ironman-canvas');
	const statusEl = root.querySelector<HTMLDivElement>('#ironman-status');
	const statusLine = root.querySelector<HTMLDivElement>('.status-line');
	const fpsLine = root.querySelector<HTMLDivElement>('.fps-line');
	const hintEl = root.querySelector<HTMLDivElement>('#ironman-hint');
	const infoEl = root.querySelector<HTMLDivElement>('#ironman-info');
	const startOverlay = root.querySelector<HTMLDivElement>('#ironman-start');
	const startBtn = root.querySelector<HTMLButtonElement>('#ironman-start-btn');
	const pipEl = root.querySelector<HTMLDivElement>('#ironman-pip');
	const video = root.querySelector<HTMLVideoElement>('#ironman-video');
	const pipOverlay = root.querySelector<HTMLCanvasElement>('#ironman-pip-overlay');
	const pipCtx = pipOverlay?.getContext('2d') ?? null;

	if (!canvas || !video) return;

	if (startBtn) startBtn.textContent = labels.hintStart;
	if (hintEl) hintEl.textContent = labels.hintCamera;
	if (infoEl) infoEl.textContent = labels.infoTitle;
	if (statusLine) statusLine.textContent = labels.statusLoading;

	const scene = new THREE.Scene();
	// 原代码注释：scene.background = new THREE.Color(0x111122);
	scene.background = new THREE.Color(0x050508);

	const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 100);
	camera.position.set(2.5, 2.0, 4.5);
	camera.lookAt(0, 1.0, 0);

	const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
	renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
	renderer.setSize(window.innerWidth, window.innerHeight);
	renderer.shadowMap.enabled = true;
	renderer.shadowMap.type = THREE.PCFSoftShadowMap;

	const controls = new OrbitControls(camera, renderer.domElement);
	controls.target.set(0, 1.0, 0);
	controls.enableDamping = true;
	controls.dampingFactor = 0.05;

	// 原代码注释：scene.add(new THREE.AmbientLight(0x404060, 0.6));
	scene.add(new THREE.AmbientLight(0x606080, 0.8));

	const mainLight = new THREE.DirectionalLight(0xffeedd, 1.8);
	mainLight.position.set(2, 5, 3);
	mainLight.castShadow = true;
	scene.add(mainLight);

	const fillLight = new THREE.DirectionalLight(0x4488ff, 0.5);
	fillLight.position.set(-2, 1, 2);
	scene.add(fillLight);

	const backLight = new THREE.DirectionalLight(0xff8844, 0.4);
	backLight.position.set(0, 2, -4);
	scene.add(backLight);

	// 原代码注释：网格地面已移除，突出红色火柴人
	// const grid = new THREE.GridHelper(4, 12, 0x4488ff, 0x2255aa);
	// grid.position.y = -0.1;
	// scene.add(grid);

	// 原代码注释：const rig = createPlaceholderIronMan();
	const rig = createStickman();
	scene.add(rig.root);

	const smoothed = createSmoothedJoints(rig.defaultJoints);
	let currentTarget: JointPositions = defaultJointPositions(rig.defaultJoints);
	let noPoseFrames = NO_POSE_FRAME_THRESHOLD;
	let detectFps = 0;
	let stopDetection: (() => void) | null = null;
	let rafId = 0;
	let latestLandmarks: import('@mediapipe/tasks-vision').NormalizedLandmark[] | null = null;

	/**
	 * 更新状态栏文案与样式。
	 */
	const updateStatus = (state: 'loading' | 'tracking' | 'noPose' | 'denied' | 'lowFps') => {
		if (!statusEl || !statusLine) return;
		statusEl.dataset.state = state;
		if (state === 'tracking') statusLine.textContent = labels.statusTracking;
		else if (state === 'noPose') statusLine.textContent = labels.statusNoPose;
		else if (state === 'denied') statusLine.textContent = labels.statusCameraDenied;
		else if (state === 'lowFps') statusLine.textContent = labels.statusLowFps;
		else statusLine.textContent = labels.statusLoading;
		if (fpsLine) {
			fpsLine.textContent = labels.fpsLabel.replace('{fps}', String(detectFps));
		}
	};

	/**
	 * 渲染循环：平滑关节并绘制场景。
	 */
	const renderLoop = () => {
		updateSmoothedJoints(smoothed, currentTarget, rig.defaultJoints);
		applyStickmanPose(rig, smoothed);
		controls.update();
		renderer.render(scene, camera);
		if (pipOverlay && pipCtx && pipEl) {
			resizePipOverlay(pipOverlay, pipEl);
			drawPoseSkeleton(pipCtx, pipOverlay, latestLandmarks);
		}
		rafId = requestAnimationFrame(renderLoop);
	};

	/**
	 * 处理姿态检测结果，更新关节目标与 UI 状态。
	 */
	const onPoseResult = (landmarks: import('@mediapipe/tasks-vision').NormalizedLandmark[] | null, fps: number) => {
		detectFps = fps;
		latestLandmarks = landmarks;
		if (landmarks && landmarks.length >= 25) {
			const parsed = landmarksToJointPositions(landmarks, rig.defaultJoints);
			if (parsed) {
				currentTarget = parsed;
				noPoseFrames = 0;
				updateStatus(fps < 15 && fps > 0 ? 'lowFps' : 'tracking');
				return;
			}
		}
		noPoseFrames++;
		if (noPoseFrames >= NO_POSE_FRAME_THRESHOLD) {
			currentTarget = defaultJointPositions(rig.defaultJoints);
			latestLandmarks = null;
			updateStatus(fps < 15 && fps > 0 ? 'lowFps' : 'noPose');
		} else if (fps < 15 && fps > 0) {
			updateStatus('lowFps');
		}
	};

	/**
	 * 启动摄像头与 PoseLandmarker 检测。
	 */
	const startExperience = async () => {
		updateStatus('loading');
		const camOk = await setupCamera(video);
		if (!camOk) {
			updateStatus('denied');
			if (hintEl) hintEl.textContent = labels.statusCameraDenied;
			startOverlay?.remove();
			return;
		}

		const landmarker = await initPoseLandmarker();
		if (!landmarker) {
			updateStatus('denied');
			if (hintEl) hintEl.textContent = labels.statusCameraDenied;
			startOverlay?.remove();
			return;
		}

		stopDetection = startPoseDetectionLoop(video, landmarker, onPoseResult);
		if (hintEl) hintEl.textContent = labels.hintCamera;
		startOverlay?.remove();
	};

	pipEl?.addEventListener('click', () => pipEl.classList.toggle('expanded'));

	startBtn?.addEventListener('click', () => void startExperience());

	const onResize = () => {
		camera.aspect = window.innerWidth / window.innerHeight;
		camera.updateProjectionMatrix();
		renderer.setSize(window.innerWidth, window.innerHeight);
	};
	window.addEventListener('resize', onResize);

	renderLoop();

	window.addEventListener('beforeunload', () => {
		cancelAnimationFrame(rafId);
		stopDetection?.();
		stopCamera(video);
	});
}
