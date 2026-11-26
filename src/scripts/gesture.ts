// 文件说明：手势粒子光感特效的客户端核心逻辑（增强版）。
// 在原版本基础上新增：10 种可循环切换的粒子特效（挥手触发）、
// 自定义粒子着色器（支持逐粒子大小/透明度）、拖尾与连线几何、
// InstancedMesh 镜头光晕、动态泛光、特效切换过渡动画、画中画窗口、
// FPS 自适应降级与后台标签页降频。
// 保留原有全部功能：手部追踪、手掌光晕指示器、鼠标/触屏回退、响应式适配。
// 原代码说明：旧版单一特效逻辑已整体升级重构，行为与外观为本文件所定义。
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { FilesetResolver, HandLandmarker } from '@mediapipe/tasks-vision';

// 翻译文案结构：由页面通过 data-labels JSON 注入
interface Labels {
	statusWaiting: string;
	statusSpread: string;
	statusFist: string;
	statusPinch: string;
	statusRotate: string;
	statusFallback: string;
	statusNoHand: string;
	statusTracking: string;
	statusCurrentEffect: string;
	statusMovement: string;
	dirLeft: string;
	dirRight: string;
	snapNotify: string;
	snapIdle: string;
	snapApproach: string;
	snapSnap: string;
	snapTriggered: string;
	debugTitle: string;
	debugDistance: string;
	debugState: string;
	debugApproachTime: string;
	debugCooldown: string;
	debugCount: string;
	debugTimes: string;
	debugCurrentEffect: string;
	debugHand: string;
	debugDetected: string;
	debugNotDetected: string;
	debugFps: string;
	statusOpenness: string;
	statusRotation: string;
	rotationClockwise: string;
	rotationCounterclockwise: string;
	rotationStop: string;
	hintStart: string;
	hintCamera: string;
	hintDenied: string;
	hintControls: string;
	hintFallback: string;
	hintWave: string;
	effectNames: string[];
}

// 特效模式枚举
// 原代码注释：已删除 smoke/grow/lens/rain 四种特效模式
/*
type Mode =
	| 'star'
	| 'trail'
	| 'explode'
	| 'breathe'
	| 'spiral'
	| 'smoke'
	| 'grow'
	| 'lens'
	| 'rain'
	| 'firefly';
*/
type Mode =
	| 'star'
	| 'trail'
	| 'explode'
	| 'breathe'
	| 'spiral'
	| 'firefly';

// 特效配置：名称/图标/粒子数/尺寸区间/透明度区间/泛光参数/主色带/渲染模式
interface EffectDef {
	name: string;
	icon: string;
	count: number;
	sizeRange: [number, number];
	opacityRange: [number, number];
	bloom: { strength: number; radius: number; threshold: number };
	palette: THREE.Color[];
	mode: Mode;
}

// 手部关键点索引常量
const WRIST = 0;
const THUMB_TIP = 4;
const INDEX_MCP = 5;
const INDEX_TIP = 8;
const MIDDLE_MCP = 9;
const MIDDLE_TIP = 12;
const RING_TIP = 16;
const PINKY_MCP = 17;
const PINKY_TIP = 20;

// 特效总数与过渡时长
// 原代码注释：EFFECT_COUNT 原为 10，已删除 4 种特效
const EFFECT_COUNT = 6;
// 打响指识别与调试配置（集中管理，便于调参）
const SNAP_CONFIG = {
	minApproachDist: 0.06, // 靠近阈值（拇指-中指归一化距离）
	snapTriggerDist: 0.12, // 弹开触发阈值
	approachMinTime: 0.15, // 最小靠近保持时间（秒）
	approachTimeout: 1.0, // 靠近超时时间（秒）
	cooldownTime: 0.8, // 冷却时间（秒）
	speedThreshold: 0.04, // 弹开速度阈值（每帧距离变化）
	flashDuration: 0.08, // 闪屏持续时间（秒）
	burstRadius: 2.0, // 冲击波扩散半径
	transitionDuration: 0.4, // 特效切换过渡时间（秒）
	hintDisplayDuration: 1.5, // 提示文字显示时间（秒）
	debugMode: false, // 默认关闭调试
	logToConsole: true, // 是否输出控制台日志
};
// 手指开合与旋转控制配置（集中管理，便于调参）
const HAND_CONFIG = {
	minOpenness: 0, // 开合度下限（0-1）
	maxOpenness: 1, // 开合度上限（0-1）
	minRadius: 0.3, // 粒子收缩时的半径系数
	maxRadius: 4.5, // 粒子张开时的半径系数
	lerpSpeed: 0.08, // 开合度平滑速度
	// 原代码注释：rotationSpeed: 0.4, // 旋转速度（弧度/秒，固定自转，已改为手势角速度驱动）
	// 原代码注释：rotationDirection: 1, // 旋转方向：1=顺时针，-1=逆时针（已改为运行时由角速度符号决定）
	rotationGain: 1.6, // 手掌角速度放大系数
	rotationThreshold: 0.6, // 触发旋转的开合度阈值
	rotationDeadzone: 0.005, // 角速度死区（弧度/帧），低于此值视为停止
	rotationSmooth: 0.25, // 角速度低通平滑系数
	minParticleSize: 0.1, // 粒子最小尺寸系数
	maxParticleSize: 0.6, // 粒子最大尺寸系数
	defaultOpenness: 0.4, // 无手时的默认开合度
	minFingerDist: 0.03, // 指尖到手腕最小距离（归一化映射）
	maxFingerDist: 0.35, // 指尖到手腕最大距离（归一化映射）
	fistClusterRadius: 0.45, // 握拳聚合后粒子活动最大半径
	fistAttractStrength: 0.12, // 向中心吸引强度
	fistJitterAmp: 0.25, // 不规则涌动振幅
	fistJitterSpeed: 1.8, // 涌动频率（结合 seed/phase 差异化）
	fistDamping: 0.86, // 速度阻尼
	fistBoundaryPull: 0.15, // 超出半径时的回拉力度
};
// 特效切换淡出/淡入时长沿用配置中的过渡时间
const FADE_OUT = SNAP_CONFIG.transitionDuration;
const FADE_IN = SNAP_CONFIG.transitionDuration;
// 拖尾每粒子历史点数
const TRAIL_LEN = 8;
// 螺旋星系短拖尾历史点数
const SPIRAL_TRAIL_LEN = 4;
// 使用连线几何的特效模式列表
const LINE_EFFECT_MODES: Mode[] = ['trail', 'explode', 'breathe', 'spiral', 'firefly'];
// 渲染原语最大容量（按需求表最大特效 2500 粒子 + 余量扩容）
const MAX_PARTICLES = 2600;
const MAX_LINE_VERTS = 12500;
// 原代码注释：MAX_LENS 镜头光晕专用容量（已删除该特效）
// const MAX_LENS = 850;

// 手势状态枚举
type GestureState = 'waiting' | 'spread' | 'fist' | 'pinch' | 'rotate' | 'fallback' | 'noHand';

// 单个粒子的运动状态
interface Particle {
	dir: THREE.Vector3; // 随机基准方向
	seed: number; // 0..1 随机种子
	phase: number; // 随机相位
	vel: THREE.Vector3; // 当前速度（弹簧/流动缓动）
	baseColor: THREE.Color; // 特效色带基准色
	size: number; // 当前尺寸
	alpha: number; // 当前透明度
	life: number; // 爆炸/生命周期
	maxLife: number;
	progress: number; // 生长/呼吸进度
	speed: number; // 个体速度系数
	rain: boolean; // 雨雪特效中的类型（true=雨丝）
	history: THREE.Vector3[]; // 拖尾历史点
}

// 三维向量二维距离
const dist2d = (a: { x: number; y: number }, b: { x: number; y: number }) =>
	Math.hypot(a.x - b.x, a.y - b.y);

/**
 * 根据色带数组在 t(0..1) 处插值取色。
 */
function paletteColor(palette: THREE.Color[], t: number, out: THREE.Color): THREE.Color {
	const n = palette.length;
	const clamped = THREE.MathUtils.clamp(t, 0, 0.9999);
	const seg = clamped * (n - 1);
	const i = Math.floor(seg);
	const f = seg - i;
	return out.copy(palette[i]).lerp(palette[Math.min(i + 1, n - 1)], f);
}

/**
 * 初始化手势交互体验：读取文案、创建场景与检测器、绑定事件并启动渲染循环。
 */
export async function initGestureExperience(root: HTMLElement): Promise<void> {
	const labels = readLabels(root);
	const canvas = root.querySelector<HTMLCanvasElement>('#gesture-canvas');
	const statusEl = root.querySelector<HTMLDivElement>('#gesture-status');
	const effectLine = root.querySelector<HTMLDivElement>('.effect-line');
	const gestureLine = root.querySelector<HTMLDivElement>('.gesture-line');
	const opennessLine = root.querySelector<HTMLDivElement>('.openness-line');
	const hintEl = root.querySelector<HTMLDivElement>('#gesture-hint');
	const titleEl = root.querySelector<HTMLDivElement>('#gesture-title');
	const flashEl = root.querySelector<HTMLDivElement>('#gesture-flash');
	const dotsEl = root.querySelector<HTMLDivElement>('#gesture-dots');
	const pipEl = root.querySelector<HTMLDivElement>('#gesture-pip');
	const snapStatusEl = root.querySelector<HTMLDivElement>('#gesture-snap-status');
	const debugEl = root.querySelector<HTMLDivElement>('#gesture-debug');
	const whiteFlashEl = root.querySelector<HTMLDivElement>('#gesture-whiteflash');
	const startOverlay = root.querySelector<HTMLDivElement>('#gesture-start');
	const startBtn = root.querySelector<HTMLButtonElement>('#gesture-start-btn');
	const video = root.querySelector<HTMLVideoElement>('#gesture-video');

	// 补充初始文案
	if (startBtn) startBtn.textContent = labels.hintStart;
	if (hintEl) hintEl.textContent = labels.hintControls;
	if (effectLine) effectLine.textContent = '';
	if (gestureLine) gestureLine.textContent = labels.statusWaiting;
	if (debugEl) debugEl.hidden = !SNAP_CONFIG.debugMode;

	// 生成特效配置数组（名称来自 i18n）
	const EFFECTS: EffectDef[] = makeEffects(labels.effectNames);

	// ---------- Three.js 场景 ----------
	const scene = new THREE.Scene();
	scene.background = new THREE.Color('#04050c');

	const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 100);
	camera.position.set(0, 0, 8);

	const renderer = new THREE.WebGLRenderer({
		canvas: canvas ?? undefined,
		antialias: true,
		powerPreference: 'high-performance',
	});
	renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
	renderer.setSize(window.innerWidth, window.innerHeight);

	// 泛光合成器
	const composer = new EffectComposer(renderer);
	composer.addPass(new RenderPass(scene, camera));
	const bloomPass = new UnrealBloomPass(
		new THREE.Vector2(window.innerWidth, window.innerHeight),
		1.1,
		0.7,
		0.25,
	);
	composer.addPass(bloomPass);

	// 生成纹理：径向发光圆点 + 十字星芒
	const glowTexture = makeGlowTexture();
	// 原代码注释：starTexture 十字星芒纹理仅镜头光晕使用（已删除该特效）
	// const starTexture = makeStarTexture();

	// ---------- 粒子缓冲（复用 BufferGeometry，只更新属性） ----------
	const positions = new Float32Array(MAX_PARTICLES * 3);
	const pColors = new Float32Array(MAX_PARTICLES * 3);
	const pSizes = new Float32Array(MAX_PARTICLES);
	const pAlphas = new Float32Array(MAX_PARTICLES);
	const particles: Particle[] = [];

	const geo = new THREE.BufferGeometry();
	geo.setAttribute('position', new THREE.BufferAttribute(positions, 3).setUsage(THREE.DynamicDrawUsage));
	geo.setAttribute('aColor', new THREE.BufferAttribute(pColors, 3).setUsage(THREE.DynamicDrawUsage));
	geo.setAttribute('size', new THREE.BufferAttribute(pSizes, 1).setUsage(THREE.DynamicDrawUsage));
	geo.setAttribute('alpha', new THREE.BufferAttribute(pAlphas, 1).setUsage(THREE.DynamicDrawUsage));

	for (let i = 0; i < MAX_PARTICLES; i++) {
		const dir = new THREE.Vector3(Math.random() * 2 - 1, Math.random() * 2 - 1, Math.random() * 2 - 1);
		if (dir.lengthSq() < 0.0001) dir.set(0, 1, 0);
		dir.normalize();
		particles.push({
			dir,
			seed: Math.random(),
			phase: Math.random() * Math.PI * 2,
			vel: new THREE.Vector3(),
			baseColor: new THREE.Color(),
			size: 0.1,
			alpha: 0,
			life: 0,
			maxLife: 1,
			progress: 0,
			speed: 0.5 + Math.random() * 1.5,
			rain: Math.random() < 0.5,
			history: Array.from({ length: TRAIL_LEN }, () => new THREE.Vector3()),
		});
		positions[i * 3] = 9999;
		positions[i * 3 + 1] = 9999;
		positions[i * 3 + 2] = 9999;
		pAlphas[i] = 0;
	}

	// 自定义粒子着色器材质（支持逐粒子大小/透明度/颜色）
	const pointsUniforms = {
		uTexture: { value: glowTexture },
		uOpacity: { value: 1 },
	};
	const pointsMaterial = new THREE.ShaderMaterial({
		vertexShader: `
			attribute float size;
			attribute float alpha;
			attribute vec3 aColor;
			varying float vAlpha;
			varying vec3 vColor;
			void main() {
				vColor = aColor;
				vAlpha = alpha;
				vec4 mv = modelViewMatrix * vec4(position, 1.0);
				gl_PointSize = size * (260.0 / max(-mv.z, 0.1));
				gl_Position = projectionMatrix * mv;
			}
		`,
		fragmentShader: `
			uniform sampler2D uTexture;
			uniform float uOpacity;
			varying float vAlpha;
			varying vec3 vColor;
			void main() {
				vec4 tex = texture2D(uTexture, gl_PointCoord);
				gl_FragColor = vec4(vColor, tex.a * vAlpha * uOpacity);
			}
		`,
		uniforms: pointsUniforms,
		transparent: true,
		depthWrite: false,
		blending: THREE.AdditiveBlending,
	});
	const points = new THREE.Points(geo, pointsMaterial);
	points.frustumCulled = false;
	scene.add(points);

	// ---------- 连线几何（拖尾 / 雨丝 / 生长连接） ----------
	const linePos = new Float32Array(MAX_LINE_VERTS * 3);
	const lineCol = new Float32Array(MAX_LINE_VERTS * 3);
	const lineGeo = new THREE.BufferGeometry();
	lineGeo.setAttribute('position', new THREE.BufferAttribute(linePos, 3).setUsage(THREE.DynamicDrawUsage));
	lineGeo.setAttribute('aColor', new THREE.BufferAttribute(lineCol, 3).setUsage(THREE.DynamicDrawUsage));
	const lineUniforms = { uOpacity: { value: 1 } };
	const lineMaterial = new THREE.ShaderMaterial({
		vertexShader: `
			attribute vec3 aColor;
			varying vec3 vColor;
			void main() {
				vColor = aColor;
				gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
			}
		`,
		fragmentShader: `
			uniform float uOpacity;
			varying vec3 vColor;
			void main() {
				gl_FragColor = vec4(vColor, uOpacity);
			}
		`,
		uniforms: lineUniforms,
		transparent: true,
		depthWrite: false,
		blending: THREE.AdditiveBlending,
	});
	const lineMesh = new THREE.LineSegments(lineGeo, lineMaterial);
	lineMesh.frustumCulled = false;
	lineMesh.visible = false;
	scene.add(lineMesh);

	// 原代码注释：InstancedMesh 镜头光晕（十字星芒片元）已删除该特效，整块废弃
	/*
	// ---------- InstancedMesh 镜头光晕（十字星芒片元） ----------
	const lensGeo = new THREE.PlaneGeometry(1, 1);
	const lensMat = new THREE.MeshBasicMaterial({
		map: starTexture,
		transparent: true,
		depthWrite: false,
		side: THREE.DoubleSide,
		blending: THREE.AdditiveBlending,
	});
	const lensMesh = new THREE.InstancedMesh(lensGeo, lensMat, MAX_LENS);
	lensMesh.frustumCulled = false;
	lensMesh.visible = false;
	const lensPositions = new Float32Array(MAX_LENS * 3);
	const lensMat4 = new THREE.Matrix4();
	const lensQuat = new THREE.Quaternion();
	const lensScale = new THREE.Vector3();
	const lensPosVec = new THREE.Vector3();
	const lensColor = new THREE.Color();
	scene.add(lensMesh);
	*/

	// ---------- 打响指冲击波（环形扩散粒子环） ----------
	const BURST_N = 72;
	const burstPos = new Float32Array(BURST_N * 3);
	const burstAlpha = new Float32Array(BURST_N);
	const burstSizes = new Float32Array(BURST_N);
	const burstColors = new Float32Array(BURST_N * 3);
	const burstGeo = new THREE.BufferGeometry();
	burstGeo.setAttribute('position', new THREE.BufferAttribute(burstPos, 3).setUsage(THREE.DynamicDrawUsage));
	burstGeo.setAttribute('size', new THREE.BufferAttribute(burstSizes, 1).setUsage(THREE.DynamicDrawUsage));
	burstGeo.setAttribute('alpha', new THREE.BufferAttribute(burstAlpha, 1).setUsage(THREE.DynamicDrawUsage));
	burstGeo.setAttribute('aColor', new THREE.BufferAttribute(burstColors, 3).setUsage(THREE.DynamicDrawUsage));
	const burstMat = new THREE.ShaderMaterial({
		vertexShader: `
			attribute float size;
			attribute float alpha;
			attribute vec3 aColor;
			varying float vAlpha;
			varying vec3 vColor;
			void main() {
				vColor = aColor;
				vAlpha = alpha;
				vec4 mv = modelViewMatrix * vec4(position, 1.0);
				gl_PointSize = size * (260.0 / max(-mv.z, 0.1));
				gl_Position = projectionMatrix * mv;
			}
		`,
		fragmentShader: `
			uniform sampler2D uTexture;
			uniform float uOpacity;
			varying float vAlpha;
			varying vec3 vColor;
			void main() {
				vec4 tex = texture2D(uTexture, gl_PointCoord);
				gl_FragColor = vec4(vColor, tex.a * vAlpha * uOpacity);
			}
		`,
		uniforms: { uTexture: { value: glowTexture }, uOpacity: { value: 1 } },
		transparent: true,
		depthWrite: false,
		blending: THREE.AdditiveBlending,
	});
	const burstPoints = new THREE.Points(burstGeo, burstMat);
	burstPoints.frustumCulled = false;
	burstPoints.visible = false;
	scene.add(burstPoints);

	// ---------- 星空背景（环境层） ----------
	const starCount = 220;
	const starPos = new Float32Array(starCount * 3);
	const starGeo = new THREE.BufferGeometry();
	for (let i = 0; i < starCount; i++) {
		const theta = Math.random() * Math.PI * 2;
		const phi = Math.acos(2 * Math.random() - 1);
		const r = 28 + Math.random() * 14;
		starPos[i * 3] = r * Math.sin(phi) * Math.cos(theta);
		starPos[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
		starPos[i * 3 + 2] = r * Math.cos(phi);
	}
	starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3));
	const stars = new THREE.Points(
		starGeo,
		new THREE.PointsMaterial({
			size: 0.06,
			color: new THREE.Color('#8fb4ff'),
			transparent: true,
			opacity: 0.7,
			depthWrite: false,
			sizeAttenuation: true,
		}),
	);
	scene.add(stars);

	// ---------- 手掌光晕指示器（光环 + 光球） ----------
	const ringMat = new THREE.MeshBasicMaterial({
		color: new THREE.Color('#66b3ff'),
		transparent: true,
		opacity: 0.85,
		blending: THREE.AdditiveBlending,
		depthWrite: false,
	});
	const coreMat = new THREE.MeshBasicMaterial({
		color: new THREE.Color('#cfe8ff'),
		transparent: true,
		opacity: 0.95,
		blending: THREE.AdditiveBlending,
		depthWrite: false,
	});
	const ring = new THREE.Mesh(new THREE.RingGeometry(0.3, 0.38, 48), ringMat);
	const core = new THREE.Mesh(new THREE.SphereGeometry(0.14, 24, 24), coreMat);
	const indicator = new THREE.Group();
	indicator.add(ring, core);
	scene.add(indicator);

	// ---------- 全局交互状态 ----------
	const palmTarget = new THREE.Vector3(0, 0, 0);
	const palmCurrent = new THREE.Vector3(0, 0, 0);
	const palmProj = new THREE.Vector3(); // 手掌投影到屏幕坐标（状态文字跟随）
	// 手势控制变量（平滑后）
	let gestureSpread = 1; // 张开/收缩系数
	let gesturePinch = 1; // 捏合连续控制
	let vertScale = 1; // 手掌上下 → 垂直分布
	let depthScale = 1; // 手掌前后 → 景深
	let swirlValue = 0;
	let currentState: GestureState = 'waiting';
	// 手指开合度（0-1，平滑后）与旋转状态
	let handOpenness = HAND_CONFIG.defaultOpenness; // 平滑后的开合度
	let rawOpenness = HAND_CONFIG.defaultOpenness; // 本帧检测原始开合度
	let hasHand = false; // 当前帧是否检测到手部
	const rotationState = {
		isRotating: false, // 是否旋转中
		direction: 1, // 旋转方向：1=顺时针，-1=逆时针
		angle: 0, // 当前累积旋转角
		cosA: 1, // 旋转角余弦（每帧预计算）
		sinA: 0, // 旋转角正弦（每帧预计算）
	};
	// 原代码注释：let handTilt = 0; // 手掌倾斜方向（手腕→中指根 x 差，已改为食指 MCP→小指 MCP 转角检测）
	let lastPalmAngle: number | null = null; // 上一帧手掌朝向角（弧度）
	let palmAngularVelocity = 0; // 平滑后的手掌角速度（弧度/帧）

	// 特效切换状态
	let effectIndex = 0;
	let pendingIndex = 0;
	let fadePhase: 'idle' | 'out' | 'in' = 'idle';
	let fadeTimer = 0;
	let fadeAlpha = 1;
	// 过渡期间的排队切换方向（保证连续触发不丢）
	let queuedDir: 1 | -1 | null = null;
	let activeCount = EFFECTS[0].count;
	let qualityScale = 1;

	// 打响指检测状态机：idle → approaching → snapping → (triggered)
	let snapState: 'idle' | 'approaching' | 'snapping' | 'triggered' = 'idle';
	let snapApproachStart = 0;
	let snapCooldown = 0;
	let snapLastDist = 0;
	let snapTriggerCount = 0;
	// 打响指视觉反馈状态
	let haloPulse = 0; // 光晕爆炸计时（秒）
	let burstTimer = 0; // 冲击波计时（秒）
	let snapVisual: 'idle' | 'approach' | 'snap' = 'idle'; // 手掌上方状态文字
	let snapVisualTimer: number | null = null;
	let snapNotifTimer: number | null = null; // 状态行打响指通知计时
	// 移动方向提示（右手检测到手部移动时显示）
	let moveDirLabel: string | null = null;
	let moveDirTimer: number | null = null;
	// 调试模式开关（按 D 切换）
	let debugMode = SNAP_CONFIG.debugMode;
	// 挥手检测状态（保留调试框架，用于后续扩展，不再触发切换）
	let lastWristX: number | null = null;
	let lastSign = 0;
	let waveFlips = 0;
	let waveDebug = { flips: 0, lastDir: '' };

	// 摄像头 / 检测
	let handLandmarker: HandLandmarker | null = null;
	let videoStream: MediaStream | null = null;
	let detectionTimer: number | null = null;
	let cameraError = false;
	let fallbackActive = false;
	let mousePressed = false;
	const touches = new Map<number, { x: number; y: number }>();

	// FPS 监控
	let fpsAccum = 0;
	let fpsFrames = 0;
	let fpsBadCount = 0;
	let fpsGoodCount = 0;
	let titleTimer: number | null = null;
	let flashTimer: number | null = null;

	// 尺寸辅助
	const visibleHeightAtZ0 = () =>
		2 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * camera.position.z;
	const visibleWidthAtZ0 = () => visibleHeightAtZ0() * camera.aspect;

	/**
	 * 将归一化关键点映射为 3D 世界坐标（水平镜像）。
	 */
	const landmarkToWorld = (lm: { x: number; y: number; z: number }, out: THREE.Vector3) => {
		out.x = (1 - lm.x - 0.5) * visibleWidthAtZ0();
		out.y = (0.5 - lm.y) * visibleHeightAtZ0();
		out.z = lm.z * 4;
		return out;
	};

	/**
	 * 将窗口像素坐标映射为 z=0 平面世界坐标。
	 */
	const screenToWorld = (clientX: number, clientY: number, out: THREE.Vector3) => {
		const rect = renderer.domElement.getBoundingClientRect();
		const nx = ((clientX - rect.left) / rect.width) * 2 - 1;
		const ny = -(((clientY - rect.top) / rect.height) * 2 - 1);
		out.x = nx * visibleWidthAtZ0() * 0.5;
		out.y = ny * visibleHeightAtZ0() * 0.5;
		out.z = 0;
		return out;
	};

	/**
	 * 重置单个粒子的基础状态（方向/种子/相位/颜色）。
	 */
	const resetParticle = (i: number, eff: EffectDef) => {
		const p = particles[i];
		p.seed = Math.random();
		p.phase = Math.random() * Math.PI * 2;
		p.speed = 0.5 + Math.random() * 1.5;
		p.rain = Math.random() < 0.5;
		p.life = Math.random();
		p.maxLife = 1;
		p.progress = Math.random();
		p.vel.set(0, 0, 0);
		paletteColor(eff.palette, p.seed, p.baseColor);
		p.size = eff.sizeRange[0] + (eff.sizeRange[1] - eff.sizeRange[0]) * Math.random();
		p.alpha = eff.opacityRange[0] + (eff.opacityRange[1] - eff.opacityRange[0]) * Math.random();
	};

	/**
	 * 激活指定特效：切换配置、重置粒子并更新渲染原语可见性与绘制范围。
	 */
	const applyEffect = (index: number) => {
		effectIndex = index;
		const eff = EFFECTS[effectIndex];
		// 原代码注释：activeCount = Math.max(60, Math.round(eff.count * qualityScale));
		// 粒子数量下限提高至 800，确保视觉效果充足
		activeCount = Math.max(800, Math.round(eff.count * qualityScale));
		for (let i = 0; i < activeCount; i++) resetParticle(i, eff);
		for (let i = activeCount; i < MAX_PARTICLES; i++) {
			positions[i * 3] = 9999;
			positions[i * 3 + 1] = 9999;
			positions[i * 3 + 2] = 9999;
			pAlphas[i] = 0;
		}
		geo.setDrawRange(0, activeCount);

		// 渲染原语可见性
		// 原代码注释：旧版支持 trail/grow/rain 连线与 lens 镜头光晕
		/*
		const useLines = eff.mode === 'trail' || eff.mode === 'grow' || eff.mode === 'rain';
		const useLens = eff.mode === 'lens';
		points.visible = !useLens;
		lineMesh.visible = useLines;
		lensMesh.visible = useLens;
		if (useLens) {
			lensMesh.count = Math.min(activeCount, MAX_LENS);
			for (let i = 0; i < lensMesh.count; i++) {
				lensPositions[i * 3] = palmTarget.x + (Math.random() - 0.5) * 2;
				lensPositions[i * 3 + 1] = palmTarget.y + (Math.random() - 0.5) * 2;
				lensPositions[i * 3 + 2] = palmTarget.z + (Math.random() - 0.5) * 2;
			}
		}
		*/
		// 原代码注释：仅剩流光拖尾使用连线几何
		// const useLines = eff.mode === 'trail';
		const useLines = LINE_EFFECT_MODES.includes(eff.mode);
		points.visible = true;
		lineMesh.visible = useLines;
		pointsUniforms.uTexture.value = glowTexture;

		updateDots(effectIndex);
		updateStatusEffect(effectIndex);
	};

	/**
	 * 触发切换到相邻特效（带淡出/淡入过渡）。
	 */
	const switchEffect = (dir: 1 | -1 = 1) => {
		// 原代码注释：旧版仅支持向下一种特效切换
		/*
		const switchEffect = () => {
			if (fadePhase !== 'idle') return;
			pendingIndex = (effectIndex + 1) % EFFECT_COUNT;
			fadePhase = 'out';
			fadeTimer = FADE_OUT;
			showTitle(pendingIndex);
			flashEdge();
			updateStatusEffect(pendingIndex);
		};
		*/
		if (fadePhase !== 'idle') {
			// 过渡中：排队方向，过渡完成后立即执行
			queuedDir = dir;
			return;
		}
		pendingIndex = (effectIndex + dir + EFFECT_COUNT) % EFFECT_COUNT;
		fadePhase = 'out';
		fadeTimer = FADE_OUT;
		showTitle(pendingIndex);
		flashEdge();
		updateStatusEffect(pendingIndex);
		if (SNAP_CONFIG.logToConsole) {
			console.log(`[Effect] 切换到: ${EFFECTS[pendingIndex].name} (${pendingIndex + 1}/${EFFECT_COUNT})`);
		}
	};

	/**
	 * 循环切换下一种特效（10 → 1 → 2 → …）。
	 */
	const nextEffect = () => switchEffect(1);

	/**
	 * 循环切换上一种特效（1 → 10 → 9 → …）。
	 */
	const prevEffect = () => switchEffect(-1);

	// ---------- UI 更新辅助 ----------
	/**
	 * 屏幕中央大标题：切换特效时显示，1.5 秒后淡出。
	 */
	const showTitle = (index: number) => {
		// 原代码注释：旧版单行标题（图标+名称+序号），2 秒后淡出
		/*
		titleEl.textContent = `${eff.icon} ${eff.name} ${index + 1}/${EFFECT_COUNT}`;
		titleTimer = window.setTimeout(() => titleEl.classList.remove('show'), 2000);
		*/
		if (!titleEl) return;
		const eff = EFFECTS[index];
		titleEl.innerHTML = `${eff.icon} ${eff.name}<br/><span class="title-index">${index + 1} / ${EFFECT_COUNT}</span>`;
		titleEl.classList.add('show');
		if (titleTimer !== null) window.clearTimeout(titleTimer);
		titleTimer = window.setTimeout(() => titleEl.classList.remove('show'), SNAP_CONFIG.hintDisplayDuration * 1000);
	};

	/**
	 * 屏幕边缘光晕闪烁过渡。
	 */
	const flashEdge = () => {
		if (!flashEl) return;
		flashEl.classList.add('flash');
		if (flashTimer !== null) window.clearTimeout(flashTimer);
		flashTimer = window.setTimeout(() => flashEl.classList.remove('flash'), 650);
	};

	/**
	 * 更新底部 10 个特效进度圆点。
	 */
	const updateDots = (index: number) => {
		if (!dotsEl) return;
		dotsEl.innerHTML = '';
		for (let i = 0; i < EFFECT_COUNT; i++) {
			const dot = document.createElement('span');
			dot.className = 'dot' + (i === index ? ' active' : '');
			dotsEl.appendChild(dot);
		}
	};

	/**
	 * 更新右上角状态指示器的特效信息行。
	 */
	const updateStatusEffect = (index: number) => {
		if (!effectLine) return;
		const eff = EFFECTS[index];
		effectLine.textContent = `${labels.statusCurrentEffect}: ${eff.icon} ${eff.name} (${index + 1}/${EFFECT_COUNT})`;
	};

	/**
	 * 更新状态栏的手指开合度进度条与旋转状态显示。
	 */
	const updateOpennessUI = () => {
		if (!opennessLine) return;
		const pct = Math.round(handOpenness * 100);
		const filled = Math.round(handOpenness * 10);
		const bar = '█'.repeat(filled) + '░'.repeat(10 - filled);
		let rotText: string;
		if (rotationState.isRotating) {
			rotText = rotationState.direction > 0 ? labels.rotationClockwise : labels.rotationCounterclockwise;
		} else {
			rotText = labels.rotationStop;
		}
		opennessLine.innerHTML = `${labels.statusOpenness}: ${bar} ${pct}% · <span class="rot">${labels.statusRotation}: 🔄 ${rotText}</span>`;
	};

	/**
	 * 刷新状态指示器的手势状态行：默认显示跟踪状态，按需附加移动方向。
	 */
	const refreshTrackingLine = () => {
		if (!gestureLine) return;
		// 打响指通知展示期间不覆盖
		if (snapNotifTimer !== null) return;
		let text: string;
		if (currentState === 'noHand') text = labels.statusNoHand;
		else if (fallbackActive) text = labels.statusFallback;
		else if (currentState === 'waiting') text = labels.statusWaiting;
		else text = labels.statusTracking;
		if (moveDirLabel) text += ` · ${labels.statusMovement}: ${moveDirLabel === labels.dirRight ? '→' : '←'} ${moveDirLabel}`;
		gestureLine.textContent = text;
	};

	/**
	 * 更新右上角状态指示器的手势状态行。
	 */
	const updateStatusGesture = (state: GestureState) => {
		// 原代码注释：旧版按手势状态显示对应文案
		/*
		if (!gestureLine) return;
		let label = labels.statusWaiting;
		if (state === 'spread') label = labels.statusSpread;
		else if (state === 'fist') label = labels.statusFist;
		else if (state === 'pinch') label = labels.statusPinch;
		else if (state === 'rotate') label = labels.statusRotate;
		else if (state === 'fallback') label = labels.statusFallback;
		else if (state === 'noHand') label = labels.statusNoHand;
		gestureLine.textContent = label;
		statusEl?.setAttribute('data-state', state);
		*/
		currentState = state;
		statusEl?.setAttribute('data-state', state);
		refreshTrackingLine();
	};

	/**
	 * 打响指通知：状态行短暂显示 "👌 打响指！→ 新特效名称" 后恢复。
	 */
	const showSnapNotification = (index: number) => {
		if (!gestureLine) return;
		const eff = EFFECTS[index];
		gestureLine.textContent = `${labels.snapNotify} ${eff.icon} ${eff.name}`;
		if (snapNotifTimer !== null) window.clearTimeout(snapNotifTimer);
		snapNotifTimer = window.setTimeout(() => {
			snapNotifTimer = null;
			refreshTrackingLine();
		}, SNAP_CONFIG.hintDisplayDuration * 1000);
	};

	/**
	 * 切换手掌上方的打响指状态文字（空闲/靠近/弹开）。
	 */
	const setSnapVisual = (v: 'idle' | 'approach' | 'snap') => {
		snapVisual = v;
		if (snapVisualTimer !== null) window.clearTimeout(snapVisualTimer);
		if (v === 'snap') snapVisualTimer = window.setTimeout(() => setSnapVisual('idle'), 400);
	};

	/**
	 * 触发冲击波环形粒子扩散。
	 */
	const triggerBurst = () => {
		burstTimer = 0.45;
		for (let i = 0; i < BURST_N; i++) {
			const a = (i / BURST_N) * Math.PI * 2;
			burstPos[i * 3] = palmCurrent.x + Math.cos(a) * 0.2;
			burstPos[i * 3 + 1] = palmCurrent.y + Math.sin(a) * 0.2;
			burstPos[i * 3 + 2] = palmCurrent.z;
			burstAlpha[i] = 1;
			burstSizes[i] = 0.5;
			burstColors[i * 3] = 1;
			burstColors[i * 3 + 1] = 1;
			burstColors[i * 3 + 2] = 1;
		}
		burstPoints.visible = true;
	};

	/**
	 * 白色闪屏：瞬间变亮后快速恢复。
	 */
	const flashScreen = () => {
		if (!whiteFlashEl) return;
		whiteFlashEl.style.transition = 'none';
		whiteFlashEl.style.opacity = '0.9';
		void whiteFlashEl.offsetWidth;
		whiteFlashEl.style.transition = `opacity ${SNAP_CONFIG.flashDuration}s ease`;
		whiteFlashEl.style.opacity = '0';
	};

	/**
	 * 打响指成功：视觉反馈（光晕爆炸/冲击波/白闪/通知）并切换到下一特效。
	 */
	const triggerSnap = () => {
		snapTriggerCount++;
		snapCooldown = SNAP_CONFIG.cooldownTime;
		haloPulse = 0.3;
		triggerBurst();
		flashScreen();
		setSnapVisual('snap');
		// 循环切换下一特效（含第 10 → 第 1）
		const target = (effectIndex + 1) % EFFECT_COUNT;
		nextEffect();
		showSnapNotification(target);
		if (SNAP_CONFIG.logToConsole) {
			console.log(`[Snap] ✅ 打响指！切换特效: ${EFFECTS[target].name} (${target + 1}/${EFFECT_COUNT})`);
			console.log(`[Snap] 冷却中: ${SNAP_CONFIG.cooldownTime}s`);
		}
	};

	/**
	 * 判断摄像头手势模式是否激活。
	 */
	const isCameraActive = () => handLandmarker !== null && !cameraError;

	/**
	 * 处理 MediaPipe 手部关键点：计算手势指标、挥手检测并更新控制变量。
	 */
	const processLandmarks = (landmarks: { x: number; y: number; z: number }[]) => {
		const wrist = landmarks[WRIST];
		const thumbTip = landmarks[THUMB_TIP];
		const indexTip = landmarks[INDEX_TIP];
		const middleMcp = landmarks[MIDDLE_MCP];

		const palmSize = Math.max(dist2d(wrist, middleMcp), 0.0001);
		const openness =
			(dist2d(indexTip, wrist) +
				dist2d(landmarks[MIDDLE_TIP], wrist) +
				dist2d(landmarks[RING_TIP], wrist) +
				dist2d(landmarks[PINKY_TIP], wrist)) /
			(4 * palmSize);
		const pinch = dist2d(thumbTip, indexTip) / palmSize;

		// 手势状态与连续控制量
		let state: GestureState = 'spread';
		// 原代码注释：旧版直接由 openness 计算扩散系数（已改为由开合度线性映射）
		// 张开 → 扩散系数大；握拳 → 收缩系数小
		// gestureSpread = THREE.MathUtils.clamp(0.4 + openness * 0.8, 0.4, 1.9);
		// 手指开合度：五指尖到手腕平均距离归一化到 0-1
		hasHand = true;
		const avgFingerDist =
			(dist2d(indexTip, wrist) +
				dist2d(landmarks[MIDDLE_TIP], wrist) +
				dist2d(landmarks[RING_TIP], wrist) +
				dist2d(landmarks[PINKY_TIP], wrist) +
				dist2d(thumbTip, wrist)) /
			5;
		rawOpenness = THREE.MathUtils.clamp(
			(avgFingerDist - HAND_CONFIG.minFingerDist) /
				(HAND_CONFIG.maxFingerDist - HAND_CONFIG.minFingerDist),
			0,
			1,
		);
		handOpenness += (rawOpenness - handOpenness) * HAND_CONFIG.lerpSpeed;
		// 张开 → 扩散系数大；握拳 → 收缩系数小（开合度 0-1 线性映射到半径系数）
		gestureSpread =
			HAND_CONFIG.minRadius + (HAND_CONFIG.maxRadius - HAND_CONFIG.minRadius) * handOpenness;
		// 指尖距离 → 连续控制粒子大小/透明度/速度
		gesturePinch = THREE.MathUtils.clamp(pinch / 0.55, 0.1, 1);
		if (openness < 0.38) state = 'fist';
		else if (pinch < 0.55) state = 'pinch';
		currentState = state;

		// 手掌上下 → 垂直分布范围
		vertScale = THREE.MathUtils.clamp(0.5 + wrist.y * 1.6, 0.5, 1.8);
		// 手掌前后（掌距为代理）→ 景深
		depthScale = THREE.MathUtils.clamp(0.5 + (palmSize / 0.22), 0.5, 1.9);

		landmarkToWorld(wrist, palmTarget);
		palmTarget.z = THREE.MathUtils.clamp((0.16 - palmSize) * 24, -3.5, 3);

		// 手掌朝向角检测：食指 MCP → 小指 MCP 向量，用于五指张开时的顺/逆时针转动
		const indexMcp = landmarks[INDEX_MCP];
		const pinkyMcp = landmarks[PINKY_MCP];
		const palmAngle = Math.atan2(pinkyMcp.y - indexMcp.y, pinkyMcp.x - indexMcp.x);
		const canRotateByGesture = state === 'spread' && handOpenness > HAND_CONFIG.rotationThreshold;
		if (canRotateByGesture) {
			if (lastPalmAngle !== null) {
				let delta = palmAngle - lastPalmAngle;
				delta = Math.atan2(Math.sin(delta), Math.cos(delta));
				palmAngularVelocity += (delta - palmAngularVelocity) * HAND_CONFIG.rotationSmooth;
			}
			lastPalmAngle = palmAngle;
		} else {
			palmAngularVelocity *= 0.85;
			lastPalmAngle = null;
		}
		// 原代码注释：手掌倾斜 → 旋转方向（已改为上方手掌转角检测驱动粒子旋转）
		// handTilt += (landmarks[MIDDLE_MCP].x - wrist.x - handTilt) * 0.3;
		// rotationState.direction = handTilt > 0.02 ? 1 : handTilt < -0.02 ? -1 : HAND_CONFIG.rotationDirection;

		// 打响指检测（拇指与中指指尖 3D 距离状态机）
		const middleTip = landmarks[MIDDLE_TIP];
		const snapDist = Math.hypot(
			thumbTip.x - middleTip.x,
			thumbTip.y - middleTip.y,
			thumbTip.z - middleTip.z,
		);
		const snapNow = performance.now() / 1000;
		const snapSpeed = Math.abs(snapDist - snapLastDist);
		if (snapCooldown > 0) {
			snapCooldown -= 0.066;
			if (snapCooldown < 0) snapCooldown = 0;
		} else {
			switch (snapState) {
				case 'idle':
					if (snapDist < SNAP_CONFIG.minApproachDist) {
						snapState = 'approaching';
						snapApproachStart = snapNow;
						setSnapVisual('approach');
						if (SNAP_CONFIG.debugMode && SNAP_CONFIG.logToConsole) {
							console.log(`[Snap] 拇指靠近中指，距离: ${snapDist.toFixed(3)}`);
						}
					}
					break;
				case 'approaching':
					if (snapDist < 0.04) {
						if (snapNow - snapApproachStart >= SNAP_CONFIG.approachMinTime) {
							snapState = 'snapping';
							setSnapVisual('snap');
							if (SNAP_CONFIG.debugMode && SNAP_CONFIG.logToConsole) console.log('[Snap] 准备弹开...');
						}
					} else if (snapDist > 0.08 && snapNow - snapApproachStart < SNAP_CONFIG.approachMinTime) {
						// 误触重置
						snapState = 'idle';
						setSnapVisual('idle');
					}
					break;
				case 'snapping':
					if (snapDist > SNAP_CONFIG.snapTriggerDist && snapSpeed > SNAP_CONFIG.speedThreshold) {
						snapState = 'idle';
						triggerSnap();
					} else if (snapNow - snapApproachStart > SNAP_CONFIG.approachTimeout) {
						snapState = 'idle';
						setSnapVisual('idle');
						if (SNAP_CONFIG.debugMode && SNAP_CONFIG.logToConsole) console.log('[Snap] 超时重置');
					}
					break;
			}
		}
		snapLastDist = snapDist;

		// 原代码注释：旧版挥手切换特效逻辑（已由打响指状态机替换）
	/*
	const dx = lastWristX === null ? 0 : wrist.x - lastWristX;
	lastWristX = wrist.x;
	if (Math.abs(dx) > 0.12) {
		const s = Math.sign(dx);
		if (s !== lastSign && lastSign !== 0) {
			waveFlips++;
			if (waveFlips >= 2) {
				waveFlips = 0;
				switchEffect();
			}
		}
		lastSign = s;
	} else {
		lastSign = 0;
		waveFlips = 0;
	}
	*/
	// 移动方向提示（仅在手部水平移动明显时显示）
		const moveDx = wrist.x - (lastWristX ?? wrist.x);
		lastWristX = wrist.x;
		if (Math.abs(moveDx) > 0.012) {
			moveDirLabel = moveDx > 0 ? labels.dirRight : labels.dirLeft;
			if (moveDirTimer !== null) window.clearTimeout(moveDirTimer);
			moveDirTimer = window.setTimeout(() => {
				moveDirLabel = null;
				refreshTrackingLine();
			}, 1000);
			refreshTrackingLine();
		}

		// 挥手检测（保留调试框架，用于后续扩展，不再触发切换）
		if (Math.abs(moveDx) > 0.12) {
			const s = Math.sign(moveDx);
			if (s !== lastSign && lastSign !== 0) {
				waveFlips++;
				waveDebug = { flips: waveFlips, lastDir: s > 0 ? 'right' : 'left' };
				if (SNAP_CONFIG.debugMode && SNAP_CONFIG.logToConsole) {
					console.log(`[Wave] 挥手翻转 ${waveFlips} 次，方向: ${waveDebug.lastDir}`);
				}
			}
			lastSign = s;
		} else {
			lastSign = 0;
			waveFlips = 0;
		}
	};

	/**
	 * 处理检测结果，取第一只手进行控制。
	 */
	const handleDetection = (result: import('@mediapipe/tasks-vision').HandLandmarkerResult) => {
		const hands = result.landmarks;
		if (hands && hands.length > 0 && hands[0].length > 0) {
			fallbackActive = false;
			processLandmarks(hands[0]);
		} else if (!fallbackActive) {
			currentState = 'noHand';
			hasHand = false;
			lastPalmAngle = null;
			palmAngularVelocity = 0;
		}
		updateStatusGesture(currentState);
	};

	// ---------- 摄像头与检测 ----------
	/**
	 * 请求摄像头并启动 MediaPipe 手部检测。
	 */
	const startCamera = async () => {
		try {
			videoStream = await navigator.mediaDevices.getUserMedia({
				video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: 'user' },
				audio: false,
			});
			video.srcObject = videoStream;
			video.muted = true;
			video.playsInline = true;
			await video.play();
			initHandLandmarker();
			startOverlay?.remove();
		} catch (err) {
			console.warn('Camera permission denied:', err);
			cameraError = true;
			fallbackActive = true;
			currentState = 'fallback';
			if (hintEl) hintEl.textContent = labels.hintDenied + '｜' + labels.hintFallback;
			updateStatusGesture('fallback');
			startOverlay?.remove();
		}
	};

	/**
	 * 初始化 MediaPipe HandLandmarker（本地 WASM + 模型，失败时回退 CDN）。
	 */
	const initHandLandmarker = async () => {
		const tryCreate = async (modelUrl: string) => {
			const vision = await FilesetResolver.forVisionTasks('/wasm');
			return HandLandmarker.createFromOptions(vision, {
				baseOptions: { modelAssetPath: modelUrl, delegate: 'GPU' },
				runningMode: 'VIDEO',
				numHands: 1,
			});
		};
		const candidates = [
			'/models/hand_landmarker.task',
			'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.21/wasm/hand_landmarker.task',
		];
		for (const url of candidates) {
			try {
				handLandmarker = await tryCreate(url);
				break;
			} catch (err) {
				console.warn('HandLandmarker init failed with', url, err);
			}
		}
		if (!handLandmarker) {
			cameraError = true;
			fallbackActive = true;
			currentState = 'fallback';
			if (hintEl) hintEl.textContent = labels.hintDenied + '｜' + labels.hintFallback;
			updateStatusGesture('fallback');
		}
		detectionTimer = window.setInterval(() => {
			if (document.hidden || !handLandmarker || video.readyState < 2) return;
			handleDetection(handLandmarker.detectForVideo(video, performance.now()));
		}, 66);
	};

	// ---------- 回退输入事件 ----------
	/**
	 * 处理鼠标移动：仅当摄像头不可用时更新手掌目标位置与垂直分布。
	 */
	const onPointerMove = (e: PointerEvent) => {
		if (isCameraActive()) return;
		fallbackActive = true;
		currentState = 'fallback';
		screenToWorld(e.clientX, e.clientY, palmTarget);
		vertScale = THREE.MathUtils.clamp(0.5 + (e.clientY / window.innerHeight) * 1.6, 0.5, 1.8);
		gestureSpread = mousePressed ? 0.4 : 1.4;
		updateStatusGesture('fallback');
	};

	/**
	 * 处理鼠标按住：收缩粒子。
	 */
	const onPointerDown = (e: PointerEvent) => {
		if (isCameraActive()) return;
		if (e.pointerType === 'mouse') {
			mousePressed = true;
			gestureSpread = 0.4;
		}
	};

	/**
	 * 处理鼠标松开：恢复扩散。
	 */
	const onPointerUp = () => {
		if (mousePressed) {
			mousePressed = false;
			gestureSpread = 1.4;
		}
	};

	/**
	 * 处理滚轮：调节流动/旋转强度。
	 */
	const onWheel = (e: WheelEvent) => {
		if (isCameraActive()) return;
		fallbackActive = true;
		swirlValue = THREE.MathUtils.clamp(swirlValue + e.deltaY * 0.0004, 0, 1.6);
		currentState = 'rotate';
		updateStatusGesture('rotate');
	};

	/**
	 * 处理触屏单指移动与双指捏合。
	 */
	const onTouchMove = (e: TouchEvent) => {
		if (isCameraActive()) return;
		fallbackActive = true;
		currentState = 'fallback';
		touches.clear();
		for (let i = 0; i < e.touches.length; i++) {
			touches.set(e.touches[i].identifier, { x: e.touches[i].clientX, y: e.touches[i].clientY });
		}
		if (touches.size === 1) {
			const t = touches.values().next().value as { x: number; y: number };
			screenToWorld(t.x, t.y, palmTarget);
			vertScale = THREE.MathUtils.clamp(0.5 + (t.y / window.innerHeight) * 1.6, 0.5, 1.8);
		} else if (touches.size === 2) {
			const [a, b] = [...touches.values()];
			const dist = Math.hypot(a.x - b.x, a.y - b.y);
			gestureSpread = THREE.MathUtils.clamp(0.4 + (dist / 400) * 1.2, 0.4, 1.8);
			gesturePinch = THREE.MathUtils.clamp(dist / 400, 0.1, 1);
		}
		updateStatusGesture('fallback');
	};

	/**
	 * 处理触屏结束：恢复默认。
	 */
	const onTouchEnd = () => {
		touches.clear();
		gestureSpread = 1.4;
	};

	// 绑定回退输入与画中画事件
	window.addEventListener('pointermove', onPointerMove);
	window.addEventListener('pointerdown', onPointerDown);
	window.addEventListener('pointerup', onPointerUp);
	window.addEventListener('wheel', onWheel, { passive: true });
	window.addEventListener('touchmove', onTouchMove, { passive: true });
	window.addEventListener('touchend', onTouchEnd);
	startBtn?.addEventListener('click', startCamera);
	pipEl?.addEventListener('click', () => pipEl.classList.toggle('expanded'));

	// 备用键盘快捷键：→/Space 下一特效，← 上一特效，S 模拟打响指，D 调试面板，R 重置粒子
	const onKeyDown = (e: KeyboardEvent) => {
		const k = e.key;
		if (k === 'ArrowRight' || k === 'ArrowLeft' || k === ' ') e.preventDefault();
		if (k === 'ArrowRight' || k === ' ') nextEffect();
		else if (k === 'ArrowLeft') prevEffect();
		else if (k === 's' || k === 'S') triggerSnap();
		else if (k === 'd' || k === 'D') {
			debugMode = !debugMode;
			if (debugEl) debugEl.hidden = !debugMode;
		} else if (k === 'r' || k === 'R') {
			applyEffect(effectIndex);
			updateDots(effectIndex);
			updateStatusEffect(effectIndex);
		}
	};
	window.addEventListener('keydown', onKeyDown);

	// ---------- 各特效粒子更新逻辑 ----------
	const t0 = performance.now();

	/**
	 * 星空粒子：闪烁圆点、随机大小、微视差运动。
	 */
	const updateStar = (i: number, eff: EffectDef, t: number, dt: number) => {
		const p = particles[i];
		const r = (0.6 + p.seed * 2.2) * gestureSpread;
		// 漩涡旋转：目标方向绕手掌旋转
		const dx = p.dir.x * rotationState.cosA - p.dir.y * rotationState.sinA;
		const dy = p.dir.x * rotationState.sinA + p.dir.y * rotationState.cosA;
		const tx = palmTarget.x + dx * r;
		const ty = palmTarget.y + dy * r * vertScale;
		const tz = palmTarget.z + p.dir.z * r * 0.4 * depthScale;
		p.vel.x += (tx - positions[i * 3]) * 0.03;
		p.vel.y += (ty - positions[i * 3 + 1]) * 0.03;
		p.vel.z += (tz - positions[i * 3 + 2]) * 0.03;
		p.vel.multiplyScalar(0.86);
		positions[i * 3] += p.vel.x;
		positions[i * 3 + 1] += p.vel.y;
		positions[i * 3 + 2] += p.vel.z;
		const tw = 0.7 + 0.3 * Math.sin(t * (0.5 + p.speed) + p.phase);
		pSizes[i] = p.size * tw * gesturePinch;
		pAlphas[i] = p.alpha * tw;
		pColors[i * 3] = p.baseColor.r;
		pColors[i * 3 + 1] = p.baseColor.g;
		pColors[i * 3 + 2] = p.baseColor.b;
	};

	/**
	 * 流光拖尾：粒子沿曲线游走并留下霓虹光带（线段）。
	 */
	const updateTrail = (i: number, eff: EffectDef, t: number, dt: number) => {
		const p = particles[i];
		// 漩涡旋转：轨道角叠加旋转角
		const ang = p.phase + rotationState.angle + t * (0.4 + p.seed * 0.6) * gesturePinch;
		const rr = (0.8 + 0.9 * Math.sin(p.phase * 3 + t * 0.5)) * gestureSpread;
		const tx = palmTarget.x + Math.cos(ang) * rr;
		const ty = palmTarget.y + Math.sin(ang) * rr * vertScale;
		const tz = palmTarget.z + Math.sin(p.phase * 2 + t * 0.3) * 1.2 * depthScale;
		p.vel.x += (tx - positions[i * 3]) * 0.02;
		p.vel.y += (ty - positions[i * 3 + 1]) * 0.02;
		p.vel.z += (tz - positions[i * 3 + 2]) * 0.02;
		p.vel.multiplyScalar(0.9);
		positions[i * 3] += p.vel.x;
		positions[i * 3 + 1] += p.vel.y;
		positions[i * 3 + 2] += p.vel.z;

		// 写入拖尾线段顶点（当前点 + 历史点）
		const base = i * TRAIL_LEN * 3;
		p.history.unshift(new THREE.Vector3(positions[i * 3], positions[i * 3 + 1], positions[i * 3 + 2]));
		p.history.pop();
		for (let s = 0; s < TRAIL_LEN; s++) {
			const h = p.history[s];
			const idx = base + s * 3;
			linePos[idx] = h.x;
			linePos[idx + 1] = h.y;
			linePos[idx + 2] = h.z;
			const fade = 1 - s / TRAIL_LEN;
			lineCol[idx] = p.baseColor.r * fade;
			lineCol[idx + 1] = p.baseColor.g * fade;
			lineCol[idx + 2] = p.baseColor.b * fade;
		}
		pSizes[i] = p.size * gesturePinch;
		pAlphas[i] = p.alpha;
		pColors[i * 3] = p.baseColor.r;
		pColors[i * 3 + 1] = p.baseColor.g;
		pColors[i * 3 + 2] = p.baseColor.b;
	};

	/**
	 * 写入一条两点线段到 linePos / lineCol 缓冲区。
	 */
	const writeLineSegment = (
		vertexIndex: number,
		x1: number,
		y1: number,
		z1: number,
		x2: number,
		y2: number,
		z2: number,
		color: THREE.Color,
		fade: number,
	) => {
		const vi = vertexIndex * 3;
		linePos[vi] = x1;
		linePos[vi + 1] = y1;
		linePos[vi + 2] = z1;
		linePos[vi + 3] = x2;
		linePos[vi + 4] = y2;
		linePos[vi + 5] = z2;
		lineCol[vi] = color.r * fade;
		lineCol[vi + 1] = color.g * fade;
		lineCol[vi + 2] = color.b * fade;
		lineCol[vi + 3] = color.r * fade * 0.35;
		lineCol[vi + 4] = color.g * fade * 0.35;
		lineCol[vi + 5] = color.b * fade * 0.35;
	};

	/**
	 * 爆炸碎裂：慢衰减、分档速度、重力下坠，并绘制火花拖尾线段。
	 */
	const updateExplode = (i: number, eff: EffectDef, t: number, dt: number) => {
		const p = particles[i];
		p.life -= dt * (0.45 + p.speed * 0.25);
		if (p.life <= 0) {
			resetParticle(i, eff);
			p.life = 1;
			const fast = p.seed > 0.55;
			const speedMul = fast ? 1.35 : 0.65;
			p.vel.set(
				p.dir.x * (4 + p.seed * 12) * gestureSpread * speedMul,
				p.dir.y * (4 + p.seed * 12) * gestureSpread * speedMul,
				p.dir.z * (3 + p.seed * 9) * depthScale * speedMul,
			);
			positions[i * 3] = palmTarget.x;
			positions[i * 3 + 1] = palmTarget.y;
			positions[i * 3 + 2] = palmTarget.z;
		}
		p.vel.y -= 0.8 * dt;
		p.vel.multiplyScalar(0.975);
		positions[i * 3] += p.vel.x * dt;
		positions[i * 3 + 1] += p.vel.y * dt;
		positions[i * 3 + 2] += p.vel.z * dt;
		const ox = positions[i * 3] - palmTarget.x;
		const oy = positions[i * 3 + 1] - palmTarget.y;
		positions[i * 3] = palmTarget.x + ox * rotationState.cosA - oy * rotationState.sinA;
		positions[i * 3 + 1] = palmTarget.y + ox * rotationState.sinA + oy * rotationState.cosA;
		const life = Math.max(p.life, 0);
		const lifeVis = Math.sqrt(life);
		pSizes[i] = p.size * (0.35 + lifeVis * 1.0) * gesturePinch;
		pAlphas[i] = p.alpha * lifeVis;
		const bright = 0.55 + lifeVis * 0.45;
		pColors[i * 3] = p.baseColor.r * bright;
		pColors[i * 3 + 1] = p.baseColor.g * bright;
		pColors[i * 3 + 2] = p.baseColor.b * bright;
		const px = positions[i * 3];
		const py = positions[i * 3 + 1];
		const pz = positions[i * 3 + 2];
		const vl = Math.max(Math.hypot(p.vel.x, p.vel.y, p.vel.z), 0.001);
		const streak = Math.min(0.55, vl * 0.08) * lifeVis;
		writeLineSegment(
			i * 2,
			px,
			py,
			pz,
			px - (p.vel.x / vl) * streak,
			py - (p.vel.y / vl) * streak,
			pz - (p.vel.z / vl) * streak,
			p.baseColor,
			lifeVis,
		);
	};

	/**
	 * 聚集消散：强化呼吸脉冲，并绘制中心到粒子的径向脉冲线。
	 */
	const updateBreathe = (i: number, eff: EffectDef, t: number, dt: number) => {
		const p = particles[i];
		const period = 2.6 + p.seed * 2.4;
		const wave = 0.5 + 0.5 * Math.sin((t / period) * Math.PI * 2 + p.phase);
		const baseR = (0.4 + wave * 4.2) * gestureSpread;
		const r = baseR * (0.3 + wave * 0.7);
		const ang = p.phase + rotationState.angle + t * (0.25 + p.seed * 0.15);
		const tx = palmTarget.x + Math.cos(ang) * r;
		const ty = palmTarget.y + Math.sin(ang) * r * vertScale;
		const tz = palmTarget.z + Math.sin(p.phase * 2 + t * 0.25) * 0.9 * depthScale;
		p.vel.x += (tx - positions[i * 3]) * 0.05;
		p.vel.y += (ty - positions[i * 3 + 1]) * 0.05;
		p.vel.z += (tz - positions[i * 3 + 2]) * 0.05;
		p.vel.multiplyScalar(0.84);
		positions[i * 3] += p.vel.x;
		positions[i * 3 + 1] += p.vel.y;
		positions[i * 3 + 2] += p.vel.z;
		pSizes[i] = p.size * (0.5 + wave * 1.2) * gesturePinch;
		pAlphas[i] = p.alpha * (0.4 + wave * 0.6);
		pColors[i * 3] = p.baseColor.r;
		pColors[i * 3 + 1] = p.baseColor.g;
		pColors[i * 3 + 2] = p.baseColor.b;
		const lineFade = wave * 0.85;
		writeLineSegment(
			i * 2,
			palmTarget.x,
			palmTarget.y,
			palmTarget.z,
			positions[i * 3],
			positions[i * 3 + 1],
			positions[i * 3 + 2],
			p.baseColor,
			lineFade,
		);
	};

	/**
	 * 螺旋星系：4 条旋臂对数螺旋 + 短拖尾尘带。
	 */
	const updateSpiral = (i: number, eff: EffectDef, t: number, dt: number) => {
		const p = particles[i];
		const armIndex = i % 4;
		const armOffset = armIndex * (Math.PI / 2);
		const armSpeed = 0.35 + p.seed * 0.45;
		const r = (0.4 + p.seed * 3.2) * gestureSpread;
		const theta = armOffset + p.phase * 0.35 + rotationState.angle + t * armSpeed * gesturePinch;
		const tx = palmTarget.x + Math.cos(theta) * r;
		const ty = palmTarget.y + Math.sin(theta) * r * vertScale;
		const tz = palmTarget.z + Math.sin(theta * 3 + p.phase) * 1.8 * depthScale;
		p.vel.x += (tx - positions[i * 3]) * 0.065;
		p.vel.y += (ty - positions[i * 3 + 1]) * 0.065;
		p.vel.z += (tz - positions[i * 3 + 2]) * 0.065;
		p.vel.multiplyScalar(0.83);
		positions[i * 3] += p.vel.x;
		positions[i * 3 + 1] += p.vel.y;
		positions[i * 3 + 2] += p.vel.z;
		pSizes[i] = p.size * (0.65 + p.seed * 0.85) * gesturePinch;
		pAlphas[i] = p.alpha * (0.75 + p.seed * 0.25);
		pColors[i * 3] = p.baseColor.r;
		pColors[i * 3 + 1] = p.baseColor.g;
		pColors[i * 3 + 2] = p.baseColor.b;
		const base = i * SPIRAL_TRAIL_LEN * 3;
		p.history.unshift(new THREE.Vector3(positions[i * 3], positions[i * 3 + 1], positions[i * 3 + 2]));
		p.history.pop();
		for (let s = 0; s < SPIRAL_TRAIL_LEN; s++) {
			const h = p.history[s];
			const idx = base + s * 3;
			linePos[idx] = h.x;
			linePos[idx + 1] = h.y;
			linePos[idx + 2] = h.z;
			const fade = 1 - s / SPIRAL_TRAIL_LEN;
			lineCol[idx] = p.baseColor.r * fade;
			lineCol[idx + 1] = p.baseColor.g * fade;
			lineCol[idx + 2] = p.baseColor.b * fade;
		}
	};

	/**
	 * 获取萤火浮游巢穴锚点（3 个缓慢漂移的吸引中心）。
	 */
	const getFireflyNest = (nestIdx: number, time: number) => {
		const angle = time * 0.15 + nestIdx * ((Math.PI * 2) / 3);
		const r = 1.2 * gestureSpread;
		return {
			x: palmTarget.x + Math.cos(angle) * r,
			y: palmTarget.y + Math.sin(angle) * r * vertScale,
			z: palmTarget.z + Math.sin(time * 0.3 + nestIdx) * 0.5 * depthScale,
		};
	};

	/**
	 * 萤火浮游：巢穴锚点吸引 + 偶发亮闪与短拖尾。
	 */
	const updateFirefly = (i: number, eff: EffectDef, t: number, dt: number) => {
		const p = particles[i];
		const nest = getFireflyNest(i % 3, t);
		const px = positions[i * 3];
		const py = positions[i * 3 + 1];
		const pz = positions[i * 3 + 2];
		p.vel.x += (nest.x - px) * 0.018 + (palmTarget.x - px) * 0.006;
		p.vel.y += (nest.y - py) * 0.018 + (palmTarget.y - py) * 0.006;
		p.vel.z += (nest.z - pz) * 0.018 + (palmTarget.z - pz) * 0.006;
		p.vel.x += Math.sin(t * 0.35 + p.phase) * 0.014;
		p.vel.y += Math.cos(t * 0.28 + p.phase * 1.3) * 0.014;
		p.vel.z += Math.sin(t * 0.4 + p.phase * 0.7) * 0.01;
		p.vel.multiplyScalar(0.93);
		positions[i * 3] += p.vel.x * gesturePinch;
		positions[i * 3 + 1] += p.vel.y * gesturePinch;
		positions[i * 3 + 2] += p.vel.z * gesturePinch;
		const ox = positions[i * 3] - palmTarget.x;
		const oy = positions[i * 3 + 1] - palmTarget.y;
		positions[i * 3] = palmTarget.x + ox * rotationState.cosA - oy * rotationState.sinA;
		positions[i * 3 + 1] = palmTarget.y + ox * rotationState.sinA + oy * rotationState.cosA;
		const sinF = Math.sin(t * (0.5 + p.speed * 0.6) + p.phase);
		const flick = Math.pow(Math.max(0, sinF), 8);
		const flickVis = 0.25 + flick * 0.75;
		pSizes[i] = p.size * (0.35 + flickVis * 1.65) * gesturePinch;
		pAlphas[i] = p.alpha * (0.35 + flickVis * 0.65);
		pColors[i * 3] = p.baseColor.r;
		pColors[i * 3 + 1] = p.baseColor.g;
		pColors[i * 3 + 2] = p.baseColor.b;
		if (flick > 0.6) {
			const npx = positions[i * 3];
			const npy = positions[i * 3 + 1];
			const npz = positions[i * 3 + 2];
			const vl = Math.max(Math.hypot(p.vel.x, p.vel.y, p.vel.z), 0.001);
			const streak = 0.22;
			writeLineSegment(
				i * 2,
				npx,
				npy,
				npz,
				npx - (p.vel.x / vl) * streak,
				npy - (p.vel.y / vl) * streak,
				npz - (p.vel.z / vl) * streak,
				p.baseColor,
				flick,
			);
		} else {
			writeLineSegment(i * 2, px, py, pz, px, py, pz, p.baseColor, 0);
		}
	};

	// 原代码注释：旧版 explode / breathe / spiral / firefly 更新逻辑（已升级视觉与连线辅助）
	/*
	const updateExplode = (i: number, eff: EffectDef, t: number, dt: number) => { ... };
	const updateBreathe = (i: number, eff: EffectDef, t: number, dt: number) => { ... };
	const updateSpiral = (i: number, eff: EffectDef, t: number, dt: number) => { ... };
	const updateFirefly = (i: number, eff: EffectDef, t: number, dt: number) => { ... };
	*/

	// 原代码注释：已删除流体烟雾/生长蔓延/镜头光晕/雨雪飘落四种特效的更新函数
	/*
	流体烟雾：粒子密集半透明、缓慢柔和漂移。
	const updateSmoke = (i: number, eff: EffectDef, t: number, dt: number) => {
		const p = particles[i];
		p.vel.x += Math.sin(t * 0.5 + p.phase) * 0.02;
		p.vel.y += Math.cos(t * 0.4 + p.phase * 2) * 0.02 + 0.04;
		p.vel.z += Math.sin(t * 0.45 + p.phase * 1.3) * 0.015;
		p.vel.multiplyScalar(0.96);
		positions[i * 3] += p.vel.x * gesturePinch;
		positions[i * 3 + 1] += p.vel.y * gesturePinch;
		positions[i * 3 + 2] += p.vel.z * gesturePinch;
		const dx = positions[i * 3] - palmTarget.x;
		const dy = positions[i * 3 + 1] - palmTarget.y;
		const dz = positions[i * 3 + 2] - palmTarget.z;
		if (Math.hypot(dx, dy, dz) > 5.5) {
			positions[i * 3] = palmTarget.x + (Math.random() - 0.5) * 2;
			positions[i * 3 + 1] = palmTarget.y + (Math.random() - 0.5) * 2;
			positions[i * 3 + 2] = palmTarget.z + (Math.random() - 0.5) * 2;
			p.vel.multiplyScalar(0.2);
		}
		pSizes[i] = p.size * (2 + Math.sin(t + p.phase) * 0.8) * gesturePinch;
		pAlphas[i] = p.alpha * (0.7 + 0.3 * Math.sin(t * 0.7 + p.phase));
		pColors[i * 3] = p.baseColor.r;
		pColors[i * 3 + 1] = p.baseColor.g;
		pColors[i * 3 + 2] = p.baseColor.b;
	};

	生长蔓延：粒子沿随机路径逐步生长，并连接相邻粒子成网络。
	const updateGrow = (i: number, eff: EffectDef, t: number, dt: number) => {
		const p = particles[i];
		p.progress += dt * (0.02 + p.seed * 0.03) * gesturePinch;
		if (p.progress >= 1) {
			resetParticle(i, eff);
			p.progress = 0;
			positions[i * 3] = palmTarget.x;
			positions[i * 3 + 1] = palmTarget.y;
			positions[i * 3 + 2] = palmTarget.z;
		}
		const eased = 1 - Math.pow(1 - p.progress, 3);
		const maxLen = 2.6 * gestureSpread;
		positions[i * 3] = palmTarget.x + p.dir.x * maxLen * eased;
		positions[i * 3 + 1] = palmTarget.y + p.dir.y * maxLen * eased * vertScale;
		positions[i * 3 + 2] = palmTarget.z + p.dir.z * maxLen * eased * 0.6 * depthScale;
		pSizes[i] = p.size * (0.3 + p.progress * 0.9) * gesturePinch;
		pAlphas[i] = p.alpha * (0.4 + p.progress * 0.6);
		pColors[i * 3] = p.baseColor.r;
		pColors[i * 3 + 1] = p.baseColor.g;
		pColors[i * 3 + 2] = p.baseColor.b;

		// 连接相邻粒子（每对预定义链接）
		const pair = i & ~1;
		const j = pair + 1 < activeCount ? pair + 1 : pair;
		const ax = positions[pair * 3];
		const ay = positions[pair * 3 + 1];
		const bx = positions[j * 3];
		const by = positions[j * 3 + 1];
		const dist = Math.hypot(ax - bx, ay - by);
		const vi = pair * 6;
		linePos[vi] = ax;
		linePos[vi + 1] = ay;
		linePos[vi + 2] = positions[pair * 3 + 2];
		linePos[vi + 3] = bx;
		linePos[vi + 4] = by;
		linePos[vi + 5] = positions[j * 3 + 2];
		const link = Math.max(0, 1 - dist / 1.5);
		const c = p.baseColor.r * link;
		lineCol[vi] = c;
		lineCol[vi + 1] = p.baseColor.g * link;
		lineCol[vi + 2] = p.baseColor.b * link;
		lineCol[vi + 3] = c;
		lineCol[vi + 4] = p.baseColor.g * link;
		lineCol[vi + 5] = p.baseColor.b * link;
	};

	镜头光晕：InstancedMesh 十字星芒，高亮度、缓慢环绕。
	const updateLens = (i: number, eff: EffectDef, t: number, dt: number) => {
		const p = particles[i];
		const ang = p.phase + t * (0.2 + p.seed * 0.3);
		const r = (1.2 + p.seed * 2.2) * gestureSpread;
		const tx = palmTarget.x + Math.cos(ang) * r;
		const ty = palmTarget.y + Math.sin(ang) * r * vertScale;
		const tz = palmTarget.z + Math.sin(p.phase * 2 + t * 0.2) * 0.8 * depthScale;
		p.vel.x += (tx - lensPositions[i * 3]) * 0.02;
		p.vel.y += (ty - lensPositions[i * 3 + 1]) * 0.02;
		p.vel.z += (tz - lensPositions[i * 3 + 2]) * 0.02;
		p.vel.multiplyScalar(0.9);
		lensPositions[i * 3] += p.vel.x;
		lensPositions[i * 3 + 1] += p.vel.y;
		lensPositions[i * 3 + 2] += p.vel.z;
		const scale = p.size * (0.8 + 0.6 * Math.sin(t + p.phase)) * gesturePinch;
		lensQuat.copy(camera.quaternion);
		lensPosVec.set(lensPositions[i * 3], lensPositions[i * 3 + 1], lensPositions[i * 3 + 2]);
		lensMat4.compose(lensPosVec, lensQuat, lensScale.setScalar(scale));
		lensMesh.setMatrixAt(i, lensMat4);
		lensColor.setRGB(p.baseColor.r, p.baseColor.g, p.baseColor.b);
		lensMesh.setColorAt(i, lensColor);
	};

	雨雪飘落：雨丝为快速下落短线（线段），雪花为缓慢飘落圆点。
	const updateRain = (i: number, eff: EffectDef, t: number, dt: number) => {
		const p = particles[i];
		if (p.rain) {
			// 雨丝：快速下落
			positions[i * 3] += Math.sin(t * 2 + p.phase) * 0.3 * dt;
			positions[i * 3 + 1] -= (7 + p.seed * 8) * dt * gesturePinch;
			positions[i * 3 + 2] += p.dir.z * 0.2 * dt;
			if (positions[i * 3 + 1] < palmTarget.y - 4) {
				positions[i * 3] = palmTarget.x + (Math.random() - 0.5) * 8;
				positions[i * 3 + 1] = palmTarget.y + 4 + Math.random() * 2;
				positions[i * 3 + 2] = palmTarget.z;
			}
			// 雨丝短线
			const vi = i * 6;
			linePos[vi] = positions[i * 3];
			linePos[vi + 1] = positions[i * 3 + 1];
			linePos[vi + 2] = positions[i * 3 + 2];
			linePos[vi + 3] = positions[i * 3];
			linePos[vi + 4] = positions[i * 3 + 1] - 0.18;
			linePos[vi + 5] = positions[i * 3 + 2];
			lineCol[vi] = p.baseColor.r;
			lineCol[vi + 1] = p.baseColor.g;
			lineCol[vi + 2] = p.baseColor.b;
			lineCol[vi + 3] = p.baseColor.r;
			lineCol[vi + 4] = p.baseColor.g;
			lineCol[vi + 5] = p.baseColor.b;
			pAlphas[i] = p.alpha;
			pSizes[i] = p.size;
		} else {
			// 雪花：缓慢飘落、左右摇摆
			positions[i * 3] += Math.sin(t * 1.5 + p.phase) * 0.4 * dt;
			positions[i * 3 + 1] -= (0.5 + p.seed * 1.2) * dt * gesturePinch;
			positions[i * 3 + 2] += Math.cos(t * 1.2 + p.phase) * 0.2 * dt;
			if (positions[i * 3 + 1] < palmTarget.y - 4.5) {
				positions[i * 3] = palmTarget.x + (Math.random() - 0.5) * 8;
				positions[i * 3 + 1] = palmTarget.y + 4.5;
				positions[i * 3 + 2] = palmTarget.z + (Math.random() - 0.5) * 2;
			}
			pSizes[i] = p.size * (0.5 + 0.5 * Math.sin(t + p.phase)) * gesturePinch;
			pAlphas[i] = p.alpha;
		}
		pColors[i * 3] = p.baseColor.r;
		pColors[i * 3 + 1] = p.baseColor.g;
		pColors[i * 3 + 2] = p.baseColor.b;
	};
	*/

	/**
	 * 握拳聚合模式：全部粒子向手掌中心吸引，并在小范围内做不规则涌动。
	 */
	const updateFistCluster = (i: number, eff: EffectDef, t: number, dt: number) => {
		const p = particles[i];
		const cfg = HAND_CONFIG;
		const jx = Math.sin(t * cfg.fistJitterSpeed * (0.8 + p.seed) + p.phase) * cfg.fistJitterAmp;
		const jy = Math.cos(t * cfg.fistJitterSpeed * (1.1 + p.speed) + p.phase * 2.1) * cfg.fistJitterAmp;
		const jz = Math.sin(t * cfg.fistJitterSpeed * (0.7 + p.seed * 1.3) + p.phase * 0.7) * cfg.fistJitterAmp * 0.6;
		const tx = palmTarget.x + jx;
		const ty = palmTarget.y + jy;
		const tz = palmTarget.z + jz;
		const px = positions[i * 3];
		const py = positions[i * 3 + 1];
		const pz = positions[i * 3 + 2];
		p.vel.x += (tx - px) * cfg.fistAttractStrength;
		p.vel.y += (ty - py) * cfg.fistAttractStrength;
		p.vel.z += (tz - pz) * cfg.fistAttractStrength;
		const dx = px - palmTarget.x;
		const dy = py - palmTarget.y;
		const dz = pz - palmTarget.z;
		const dist = Math.hypot(dx, dy, dz);
		if (dist > cfg.fistClusterRadius) {
			const over = dist - cfg.fistClusterRadius;
			p.vel.x -= (dx / dist) * over * cfg.fistBoundaryPull;
			p.vel.y -= (dy / dist) * over * cfg.fistBoundaryPull;
			p.vel.z -= (dz / dist) * over * cfg.fistBoundaryPull;
		}
		p.vel.multiplyScalar(cfg.fistDamping);
		positions[i * 3] += p.vel.x;
		positions[i * 3 + 1] += p.vel.y;
		positions[i * 3 + 2] += p.vel.z;
		const tw = 0.75 + 0.25 * Math.sin(t * (1.2 + p.speed) + p.phase);
		pSizes[i] = p.size * 0.75 * tw * gesturePinch;
		pAlphas[i] = Math.min(1, p.alpha * 1.15 * tw);
		pColors[i * 3] = p.baseColor.r;
		pColors[i * 3 + 1] = p.baseColor.g;
		pColors[i * 3 + 2] = p.baseColor.b;
		if (eff.mode === 'trail') {
			const base = i * TRAIL_LEN * 3;
			p.history.unshift(new THREE.Vector3(positions[i * 3], positions[i * 3 + 1], positions[i * 3 + 2]));
			p.history.pop();
			for (let s = 0; s < TRAIL_LEN; s++) {
				const h = p.history[s];
				const idx = base + s * 3;
				linePos[idx] = h.x;
				linePos[idx + 1] = h.y;
				linePos[idx + 2] = h.z;
				const fade = 1 - s / TRAIL_LEN;
				lineCol[idx] = p.baseColor.r * fade;
				lineCol[idx + 1] = p.baseColor.g * fade;
				lineCol[idx + 2] = p.baseColor.b * fade;
			}
		}
	};

	/**
	 * 更新当前特效的全部粒子并写回缓冲区。
	 */
	const updateEffect = (dt: number) => {
		const eff = EFFECTS[effectIndex];
		const t = (performance.now() - t0) / 1000;
		const count = activeCount;
		// 无手 / 回退模式：开合度缓慢回归默认值，粒子回到默认扩散状态
		if (!hasHand || fallbackActive) {
			handOpenness += (HAND_CONFIG.defaultOpenness - handOpenness) * 0.05;
			if (!fallbackActive) {
				gestureSpread = HAND_CONFIG.minRadius + (HAND_CONFIG.maxRadius - HAND_CONFIG.minRadius) * handOpenness;
			}
		}
		// 旋转状态：五指张开时按手掌角速度驱动粒子绕中心旋转；停止转动时保持当前角度
		// 原代码注释：开合度超过阈值则固定速度自转，停止后 angle *= 0.92 回正
		// rotationState.isRotating = hasHand && handOpenness > HAND_CONFIG.rotationThreshold && !fallbackActive;
		// if (rotationState.isRotating) {
		// 	rotationState.angle += HAND_CONFIG.rotationSpeed * rotationState.direction * dt;
		// } else {
		// 	rotationState.angle *= 0.92;
		// }
		if (!hasHand || fallbackActive) {
			lastPalmAngle = null;
			palmAngularVelocity = 0;
		}
		const canDriveRotation =
			hasHand &&
			!fallbackActive &&
			handOpenness > HAND_CONFIG.rotationThreshold &&
			currentState === 'spread';
		if (canDriveRotation) {
			rotationState.angle += palmAngularVelocity * HAND_CONFIG.rotationGain;
			rotationState.isRotating = Math.abs(palmAngularVelocity) > HAND_CONFIG.rotationDeadzone;
			rotationState.direction = palmAngularVelocity >= 0 ? 1 : -1;
		} else {
			rotationState.isRotating = false;
		}
		rotationState.cosA = Math.cos(rotationState.angle);
		rotationState.sinA = Math.sin(rotationState.angle);
		const isFistMode =
			(!fallbackActive && hasHand && currentState === 'fist') ||
			(fallbackActive && mousePressed);
		if (isFistMode) {
			for (let i = 0; i < count; i++) updateFistCluster(i, eff, t, dt);
			if (eff.mode === 'trail') lineGeo.setDrawRange(0, count * TRAIL_LEN);
		} else {
		switch (eff.mode) {
			case 'star':
				for (let i = 0; i < count; i++) updateStar(i, eff, t, dt);
				break;
			case 'trail':
				for (let i = 0; i < count; i++) updateTrail(i, eff, t, dt);
				lineGeo.setDrawRange(0, count * TRAIL_LEN);
				break;
			case 'explode':
				for (let i = 0; i < count; i++) updateExplode(i, eff, t, dt);
				lineGeo.setDrawRange(0, count * 2);
				break;
			case 'breathe':
				for (let i = 0; i < count; i++) updateBreathe(i, eff, t, dt);
				lineGeo.setDrawRange(0, count * 2);
				break;
			case 'spiral':
				for (let i = 0; i < count; i++) updateSpiral(i, eff, t, dt);
				lineGeo.setDrawRange(0, count * SPIRAL_TRAIL_LEN);
				break;
			// 原代码注释：已删除 smoke/grow/lens/rain 四种特效分支
			/*
			case 'smoke':
				for (let i = 0; i < count; i++) updateSmoke(i, eff, t, dt);
				break;
			case 'grow':
				for (let i = 0; i < count; i++) updateGrow(i, eff, t, dt);
				lineGeo.setDrawRange(0, (count >> 1) * 2);
				break;
			case 'lens':
				for (let i = 0; i < count; i++) updateLens(i, eff, t, dt);
				lensMesh.instanceMatrix.needsUpdate = true;
				if (lensMesh.instanceColor) lensMesh.instanceColor.needsUpdate = true;
				break;
			case 'rain':
				for (let i = 0; i < count; i++) updateRain(i, eff, t, dt);
				lineGeo.setDrawRange(0, count * 2);
				break;
			*/
			case 'firefly':
				for (let i = 0; i < count; i++) updateFirefly(i, eff, t, dt);
				lineGeo.setDrawRange(0, count * 2);
				break;
		}
		}
		// 开合度联动：粒子大小随开合度线性缩放（握拳小、张开大）
		if (!isFistMode) {
			const opennessSize = HAND_CONFIG.minParticleSize + (HAND_CONFIG.maxParticleSize - HAND_CONFIG.minParticleSize) * handOpenness;
			for (let i = 0; i < count; i++) {
				pSizes[i] *= opennessSize;
			}
		}
		geo.attributes.position.needsUpdate = true;
		geo.attributes.aColor.needsUpdate = true;
		geo.attributes.size.needsUpdate = true;
		geo.attributes.alpha.needsUpdate = true;
		if (lineMesh.visible) {
			lineGeo.attributes.position.needsUpdate = true;
			lineGeo.attributes.aColor.needsUpdate = true;
		}
	};

	/**
	 * 更新手掌光晕指示器（支持打响指时的白色爆炸扩张）。
	 */
	const updateIndicator = (dt: number) => {
		palmCurrent.lerp(palmTarget, 0.12);
		indicator.position.copy(palmCurrent);
		const s = 0.8 + gestureSpread * 0.6;
		if (haloPulse > 0) {
			haloPulse = Math.max(0, haloPulse - dt);
			const k = 1 - haloPulse / 0.3;
			// 光晕爆炸：半径放大、颜色转白、透明度衰减
			ringMat.color.setRGB(1, 1, 1);
			coreMat.color.setRGB(1, 1, 1);
			indicator.scale.setScalar(s * (1 + k * 1.6));
			ringMat.opacity = Math.max(0, (0.85 - gestureSpread * 0.2) * (1 - k));
			coreMat.opacity = Math.max(0, (0.95 - gestureSpread * 0.12) * (1 - k));
		} else {
			ringMat.color.set('#66b3ff');
			coreMat.color.set('#cfe8ff');
			indicator.scale.setScalar(s);
			ringMat.opacity = 0.85 - gestureSpread * 0.2;
			coreMat.opacity = 0.95 - gestureSpread * 0.12;
		}
	};

	/**
	 * 更新手掌上方的打响指状态文字与位置（跟随手掌投影）。
	 */
	const updateSnapStatus = () => {
		if (!snapStatusEl) return;
		const cameraOn = isCameraActive() && !fallbackActive;
		if (!cameraOn || !handLandmarker) {
			snapStatusEl.style.display = 'none';
			return;
		}
		palmProj.copy(palmCurrent).project(camera);
		const px = (palmProj.x * 0.5 + 0.5) * window.innerWidth;
		const py = (-palmProj.y * 0.5 + 0.5) * window.innerHeight;
		snapStatusEl.style.left = `${px}px`;
		snapStatusEl.style.top = `${py - 70}px`;
		snapStatusEl.style.display = 'block';
		let text = labels.snapIdle;
		let color = '#ffffff';
		if (snapVisual === 'approach') {
			text = labels.snapApproach;
			color = '#ffe14d';
		} else if (snapVisual === 'snap') {
			text = labels.snapSnap;
			color = '#ff4d6a';
		}
		snapStatusEl.textContent = text;
		snapStatusEl.style.color = color;
	};

	/**
	 * 更新调试面板内容（按 D 开启）。
	 */
	const updateDebug = () => {
		if (!debugEl || !debugMode) return;
		const handOk = isCameraActive() && !fallbackActive;
		const fps = fpsFrames > 0 ? fpsFrames / Math.max(fpsAccum, 1e-6) : 0;
		const approachTime = snapApproachStart > 0 ? Math.max(0, performance.now() / 1000 - snapApproachStart) : 0;
		debugEl.innerHTML = [
			`<div class="db-title">${labels.debugTitle}</div>`,
			`${labels.debugDistance}: ${snapLastDist.toFixed(3)}`,
			`${labels.debugState}: ${snapState}`,
			`${labels.debugApproachTime}: ${approachTime.toFixed(2)}s`,
			`${labels.debugCooldown}: ${Math.max(0, snapCooldown).toFixed(2)}s`,
			`${labels.debugCount}: ${snapTriggerCount} ${labels.debugTimes}`,
			`${labels.debugCurrentEffect}: ${EFFECTS[effectIndex].name} (${effectIndex + 1}/${EFFECT_COUNT})`,
			`${labels.debugHand}: ${handOk ? '✅ ' + labels.debugDetected : '❌ ' + labels.debugNotDetected}`,
			`${labels.debugFps}: ${Math.round(fps)}`,
			`${labels.statusOpenness}: ${Math.round(handOpenness * 100)}%`,
			`${labels.statusRotation}: ${rotationState.isRotating ? (rotationState.direction > 0 ? labels.rotationClockwise : labels.rotationCounterclockwise) : labels.rotationStop}`,
		].join('<br/>');
	};

	/**
	 * 处理窗口尺寸变化。
	 */
	const onResize = () => {
		const w = window.innerWidth;
		const h = window.innerHeight;
		camera.aspect = w / h;
		camera.updateProjectionMatrix();
		renderer.setSize(w, h);
		composer.setSize(w, h);
	};

	// 后台标签页降频：隐藏时暂停检测，恢复时重置时间基准
	document.addEventListener('visibilitychange', () => {
		if (!document.hidden) lastFrame = performance.now();
	});

	/**
	 * 释放摄像头、定时器与 WebGL 资源。
	 */
	const dispose = () => {
		if (detectionTimer !== null) window.clearInterval(detectionTimer);
		if (titleTimer !== null) window.clearTimeout(titleTimer);
		if (flashTimer !== null) window.clearTimeout(flashTimer);
		if (snapVisualTimer !== null) window.clearTimeout(snapVisualTimer);
		if (snapNotifTimer !== null) window.clearTimeout(snapNotifTimer);
		if (moveDirTimer !== null) window.clearTimeout(moveDirTimer);
		window.removeEventListener('keydown', onKeyDown);
		videoStream?.getTracks().forEach((t) => t.stop());
		geo.dispose();
		lineGeo.dispose();
		// 原代码注释：lensGeo.dispose();（镜头光晕已删除）
		burstGeo.dispose();
		pointsMaterial.dispose();
		lineMaterial.dispose();
		// 原代码注释：lensMat.dispose();（镜头光晕已删除）
		burstMat.dispose();
		glowTexture.dispose();
		// 原代码注释：starTexture.dispose();（十字星芒纹理已删除）
		renderer.dispose();
	};

	window.addEventListener('beforeunload', dispose);
	window.addEventListener('resize', onResize);

	// ---------- 渲染主循环 ----------
	let lastFrame = performance.now();

	/**
	 * 渲染主循环：更新粒子、指示器、特效切换过渡、泛光与 UI。
	 */
	const animate = (now: number) => {
		const dt = Math.min((now - lastFrame) / 1000, 0.05);
		lastFrame = now;

		// 特效切换过渡
		if (fadePhase === 'out') {
			fadeTimer -= dt;
			fadeAlpha = Math.max(0, fadeTimer / FADE_OUT);
			if (fadeTimer <= 0) {
				applyEffect(pendingIndex);
				fadePhase = 'in';
				fadeTimer = FADE_IN;
				fadeAlpha = 0;
			}
		} else if (fadePhase === 'in') {
			fadeTimer -= dt;
			fadeAlpha = Math.min(1, 1 - fadeTimer / FADE_IN);
			if (fadeTimer <= 0) {
				fadePhase = 'idle';
				fadeAlpha = 1;
				// 过渡期间排队的切换立即生效（支持连续打响指/按键）
				if (queuedDir !== null) {
					const d = queuedDir;
					queuedDir = null;
					switchEffect(d);
				}
			}
		}
		pointsUniforms.uOpacity.value = fadeAlpha;
		lineUniforms.uOpacity.value = fadeAlpha;
		// 原代码注释：lensMat.opacity = fadeAlpha;（镜头光晕已删除）

		// 后台标签页自动降频：隐藏时跳过渲染
		if (!document.hidden) {
			updateEffect(dt);
			updateIndicator(dt);
			// 打响指冲击波环形扩散
			if (burstTimer > 0) {
				burstTimer = Math.max(0, burstTimer - dt);
				const k = 1 - burstTimer / 0.45;
				const r = 0.2 + k * SNAP_CONFIG.burstRadius;
				const fade = Math.max(0, 1 - k);
				for (let i = 0; i < BURST_N; i++) {
					const a = (i / BURST_N) * Math.PI * 2;
					burstPos[i * 3] = palmCurrent.x + Math.cos(a) * r;
					burstPos[i * 3 + 1] = palmCurrent.y + Math.sin(a) * r;
					burstPos[i * 3 + 2] = palmCurrent.z;
					burstAlpha[i] = fade;
				}
				burstGeo.attributes.position.needsUpdate = true;
				burstGeo.attributes.alpha.needsUpdate = true;
				burstPoints.visible = true;
			} else {
				burstPoints.visible = false;
			}
			updateSnapStatus();
			updateDebug();
			updateOpennessUI();
			// 特效泛光参数平滑过渡
			const b = EFFECTS[effectIndex].bloom;
			bloomPass.strength += (b.strength * (0.3 + gestureSpread * 0.8) - bloomPass.strength) * 0.06;
			bloomPass.radius += (b.radius - bloomPass.radius) * 0.06;
			bloomPass.threshold += (b.threshold - bloomPass.threshold) * 0.06;
			stars.rotation.y += 0.0002;
			composer.render();
		}

		// FPS 监控：持续低于 30 帧时适度降低粒子数量，恢复流畅后自动回升
		fpsAccum += dt;
		fpsFrames++;
		if (fpsAccum >= 1) {
			const fps = fpsFrames / fpsAccum;
			// 原代码注释：旧版仅降不升，质量降至 0.6 后粒子永久偏少
			/*
			if (fps < 30) fpsBadCount++;
			else fpsBadCount = 0;
			if (fpsBadCount > 3 && qualityScale > 0.6) {
				qualityScale = 0.6;
				applyEffect(effectIndex);
			}
			*/
			if (fps < 30) fpsBadCount++;
			else fpsBadCount = 0;
			if (fps >= 45) fpsGoodCount++;
			else fpsGoodCount = 0;
			if (fpsBadCount > 5 && qualityScale > 0.85) {
				qualityScale = 0.85;
				applyEffect(effectIndex);
			} else if (fpsGoodCount > 8 && qualityScale < 1) {
				qualityScale = 1;
				applyEffect(effectIndex);
			}
			fpsAccum = 0;
			fpsFrames = 0;
		}

		requestAnimationFrame(animate);
	};
	applyEffect(0);
	updateDots(0);
	updateStatusEffect(0);
	requestAnimationFrame(animate);
}

/**
 * 从根元素 data-labels 属性读取翻译文案。
 */
function readLabels(root: HTMLElement): Labels {
	try {
		return JSON.parse(root.dataset.labels ?? '{}') as Labels;
	} catch {
		return {} as Labels;
	}
}

/**
 * 由 i18n 名称生成 6 种特效配置数组。
 */
function makeEffects(names: string[]): EffectDef[] {
	// 颜色亮度补偿：将每套色带主通道提升至 0.92，确保颜色鲜艳不暗淡
	const mk = (palette: string[]): THREE.Color[] => {
		const cs = palette.map((c) => new THREE.Color(c));
		for (const c of cs) {
			const mx = Math.max(c.r, c.g, c.b);
			if (mx > 0.01) {
				const s = 0.92 / mx;
				c.r = Math.min(1, c.r * s);
				c.g = Math.min(1, c.g * s);
				c.b = Math.min(1, c.b * s);
			}
		}
		return cs;
	};
	// 原代码注释：旧版 10 种特效，已删除流体烟雾/生长蔓延/镜头光晕/雨雪飘落
	const defs: Omit<EffectDef, 'name' | 'icon' | 'palette'>[] = [
		{ count: 2000, sizeRange: [0.1, 0.8], opacityRange: [0.6, 1], bloom: { strength: 0.6, radius: 0.6, threshold: 0.25 }, mode: 'star' },
		{ count: 1500, sizeRange: [0.2, 0.6], opacityRange: [0.7, 1], bloom: { strength: 1.2, radius: 0.8, threshold: 0.2 }, mode: 'trail' },
		// 原代码注释：explode count:1200 size:[0.1,1.2] bloom:1.5
		{ count: 1400, sizeRange: [0.15, 1.4], opacityRange: [0.85, 1], bloom: { strength: 1.8, radius: 0.65, threshold: 0.16 }, mode: 'explode' },
		// 原代码注释：breathe count:1800 size:[0.1,0.5] bloom:0.8
		{ count: 1800, sizeRange: [0.12, 0.7], opacityRange: [0.65, 1], bloom: { strength: 1.1, radius: 0.75, threshold: 0.18 }, mode: 'breathe' },
		// 原代码注释：spiral count:2000 size:[0.1,0.7] bloom:1.0
		{ count: 2200, sizeRange: [0.12, 0.9], opacityRange: [0.75, 1], bloom: { strength: 1.3, radius: 0.65, threshold: 0.18 }, mode: 'spiral' },
		// 原代码注释：firefly count:1200 size:[0.1,0.4] opacity:[0.4,0.9] bloom:0.7
		{ count: 1600, sizeRange: [0.15, 0.8], opacityRange: [0.6, 1], bloom: { strength: 1.0, radius: 0.75, threshold: 0.18 }, mode: 'firefly' },
	];
	const icons = ['🌌', '✨', '💥', '🌀', '🌊', '🪲'];
	const palettes = [
		['#8fb4ff', '#cfe8ff', '#5b7dff'],
		['#ff4d8d', '#ff8c3a', '#ffd34d', '#2de0c0', '#7b3ff2'],
		['#ffd34d', '#ff8c3a', '#ff4d8d'],
		['#3a5cff', '#7b3ff2', '#2de0c0'],
		['#7b3ff2', '#ff4d8d', '#2de0c0'],
		// 原代码注释：['#ffe9a8', '#fff6d8', '#d4f76a']
		['#ffe066', '#fff4b0', '#ffb347'],
	];
	return defs.map((d, i) => ({
		...d,
		name: names[i] ?? `Effect ${i + 1}`,
		icon: icons[i],
		palette: mk(palettes[i]),
	}));
}

/**
 * 生成径向渐变发光纹理。
 */
function makeGlowTexture(): THREE.Texture {
	const size = 64;
	const c = document.createElement('canvas');
	c.width = size;
	c.height = size;
	const ctx = c.getContext('2d');
	if (ctx) {
		const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
		g.addColorStop(0, 'rgba(255,255,255,1)');
		g.addColorStop(0.3, 'rgba(255,255,255,0.6)');
		g.addColorStop(1, 'rgba(255,255,255,0)');
		ctx.fillStyle = g;
		ctx.fillRect(0, 0, size, size);
	}
	const tex = new THREE.CanvasTexture(c);
	tex.needsUpdate = true;
	return tex;
}

// 原代码注释：makeStarTexture 十字星芒纹理函数（镜头光晕已删除，整块废弃）
/*
function makeStarTexture(): THREE.Texture {
	const size = 128;
	const c = document.createElement('canvas');
	c.width = size;
	c.height = size;
	const ctx = c.getContext('2d');
	if (ctx) {
		ctx.clearRect(0, 0, size, size);
		const cx = size / 2;
		const cy = size / 2;
		// 中心光斑
		const core = ctx.createRadialGradient(cx, cy, 0, cx, cy, size * 0.18);
		core.addColorStop(0, 'rgba(255,255,255,1)');
		core.addColorStop(1, 'rgba(255,255,255,0)');
		ctx.fillStyle = core;
		ctx.fillRect(0, 0, size, size);
		// 水平与垂直星芒
		ctx.globalCompositeOperation = 'lighter';
		const hg = ctx.createLinearGradient(0, cy, size, cy);
		hg.addColorStop(0, 'rgba(255,255,255,0)');
		hg.addColorStop(0.5, 'rgba(255,255,255,0.85)');
		hg.addColorStop(1, 'rgba(255,255,255,0)');
		ctx.fillStyle = hg;
		ctx.fillRect(0, cy - size * 0.012, size, size * 0.024);
		const vg = ctx.createLinearGradient(cx, 0, cx, size);
		vg.addColorStop(0, 'rgba(255,255,255,0)');
		vg.addColorStop(0.5, 'rgba(255,255,255,0.85)');
		vg.addColorStop(1, 'rgba(255,255,255,0)');
		ctx.fillStyle = vg;
		ctx.fillRect(cx - size * 0.012, 0, size * 0.024, size);
		// 对角小星芒
		const dg1 = ctx.createLinearGradient(cx - size * 0.5, cy - size * 0.5, cx + size * 0.5, cy + size * 0.5);
		dg1.addColorStop(0, 'rgba(255,255,255,0)');
		dg1.addColorStop(0.5, 'rgba(255,255,255,0.35)');
		dg1.addColorStop(1, 'rgba(255,255,255,0)');
		ctx.fillStyle = dg1;
		ctx.fillRect(0, 0, size, size);
	}
	const tex = new THREE.CanvasTexture(c);
	tex.needsUpdate = true;
	return tex;
}
*/