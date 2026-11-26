// 文件说明：将 MediaPipe Pose 关键点映射为火柴人关节位置，含 EMA 平滑与 T-pose 回退。
import * as THREE from 'three';
import type { NormalizedLandmark } from '@mediapipe/tasks-vision';
import {
	alignBone,
	BONE_DEFS,
	type JointKey,
	type StickmanRig,
} from './model';
import { EmaVector3 } from './smoothing';

/** MediaPipe Pose 上半身关键点索引 */
export const POSE = {
	NOSE: 0,
	L_SHOULDER: 11,
	R_SHOULDER: 12,
	L_ELBOW: 13,
	R_ELBOW: 14,
	L_WRIST: 15,
	R_WRIST: 16,
	L_HIP: 23,
	R_HIP: 24,
} as const;

/** 关节位置目标（检测循环写入） */
export interface JointPositions {
	detected: boolean;
	joints: Record<JointKey, THREE.Vector3>;
}

/** 平滑后的关节状态（渲染循环读取） */
export interface SmoothedJoints {
	joints: Record<JointKey, EmaVector3>;
}

const JOINT_KEYS: JointKey[] = [
	'head',
	'lShoulder',
	'rShoulder',
	'lElbow',
	'rElbow',
	'lWrist',
	'rWrist',
	'lHip',
	'rHip',
	'shoulderCenter',
];

const VIS_THRESHOLD = 0.5;
const SCALE = 1.8;
const MIN_BONE_LEN = 0.02;
/** 肘/腕相对肩部的幅度增益，补偿映射后的偏小感 */
const ARM_GAIN = 1.18;

/** 手臂相关关节（使用更高 EMA 系数以跟上快速摆动） */
const ARM_JOINT_KEYS: JointKey[] = ['lShoulder', 'rShoulder', 'lElbow', 'rElbow', 'lWrist', 'rWrist'];

/** EMA 平滑系数 */
export const SMOOTH_ALPHA = {
	// 原代码注释：joint: 0.18,
	torso: 0.22,
	arm: 0.48,
	tPoseReturn: 0.06,
} as const;

const TMP_V3 = new THREE.Vector3();

/**
 * 判断关键点是否可见且有效。
 */
function isVisible(lm: NormalizedLandmark | undefined): lm is NormalizedLandmark {
	return !!lm && (lm.visibility ?? 1) >= VIS_THRESHOLD;
}

/**
 * 将 MediaPipe 归一化坐标转为 Three.js 空间坐标（镜像 x 以匹配前置摄像头）。
 */
function lmToVec3(lm: NormalizedLandmark, out = new THREE.Vector3()): THREE.Vector3 {
	out.set((0.5 - lm.x) * SCALE, (0.5 - lm.y) * SCALE, (0.5 - lm.z) * SCALE * 0.5);
	return out;
}

/**
 * 以肩部为锚点放大肘/腕偏移，使摆动幅度更接近真人。
 */
function amplifyFromShoulder(
	joint: THREE.Vector3,
	shoulder: THREE.Vector3,
	gain: number,
	out = new THREE.Vector3(),
): THREE.Vector3 {
	return out.copy(joint).sub(shoulder).multiplyScalar(gain).add(shoulder);
}

/**
 * 判断是否为手臂关节（需更快 EMA 响应）。
 */
function isArmJoint(key: JointKey): boolean {
	return ARM_JOINT_KEYS.includes(key);
}
export function createSmoothedJoints(defaultJoints: Record<JointKey, THREE.Vector3>): SmoothedJoints {
	const joints = {} as Record<JointKey, EmaVector3>;
	for (const key of JOINT_KEYS) {
		const ema = new EmaVector3();
		ema.reset(defaultJoints[key]);
		joints[key] = ema;
	}
	return { joints };
}

/**
 * 从默认 T-pose 构建未检测时的关节目标。
 */
export function defaultJointPositions(
	defaultJoints: Record<JointKey, THREE.Vector3>,
): JointPositions {
	const joints = {} as Record<JointKey, THREE.Vector3>;
	for (const key of JOINT_KEYS) {
		joints[key] = defaultJoints[key].clone();
	}
	return { detected: false, joints };
}

/**
 * 将 MediaPipe 关键点解析为火柴人关节位置；肩/髋/鼻不足时返回 null。
 */
export function landmarksToJointPositions(
	landmarks: NormalizedLandmark[],
	defaultJoints: Record<JointKey, THREE.Vector3>,
): JointPositions | null {
	const nose = landmarks[POSE.NOSE];
	const lShoulder = landmarks[POSE.L_SHOULDER];
	const rShoulder = landmarks[POSE.R_SHOULDER];
	const lElbow = landmarks[POSE.L_ELBOW];
	const rElbow = landmarks[POSE.R_ELBOW];
	const lWrist = landmarks[POSE.L_WRIST];
	const rWrist = landmarks[POSE.R_WRIST];
	const lHip = landmarks[POSE.L_HIP];
	const rHip = landmarks[POSE.R_HIP];

	if (!isVisible(nose) || !isVisible(lShoulder) || !isVisible(rShoulder)) return null;
	if (!isVisible(lHip) || !isVisible(rHip)) return null;

	const lShoulder3 = lmToVec3(lShoulder, new THREE.Vector3());
	const rShoulder3 = lmToVec3(rShoulder, new THREE.Vector3());
	const lHip3 = lmToVec3(lHip, new THREE.Vector3());
	const rHip3 = lmToVec3(rHip, new THREE.Vector3());
	const nose3 = lmToVec3(nose, new THREE.Vector3());

	const hipCenterDetected = TMP_V3.copy(lHip3).add(rHip3).multiplyScalar(0.5);
	const defaultHipCenter = defaultJoints.lHip.clone().add(defaultJoints.rHip).multiplyScalar(0.5);

	/**
	 * 将检测坐标转为火柴人局部空间：以髋中心为锚点对齐默认 T-pose。
	 */
	const toLocal = (v: THREE.Vector3, out = new THREE.Vector3()): THREE.Vector3 => {
		return out.copy(v).sub(hipCenterDetected).add(defaultHipCenter);
	};

	const joints = {} as Record<JointKey, THREE.Vector3>;
	joints.head = toLocal(nose3, new THREE.Vector3());
	joints.lShoulder = toLocal(lShoulder3, new THREE.Vector3());
	joints.rShoulder = toLocal(rShoulder3, new THREE.Vector3());
	joints.lHip = toLocal(lHip3, new THREE.Vector3());
	joints.rHip = toLocal(rHip3, new THREE.Vector3());
	joints.shoulderCenter = joints.lShoulder.clone().add(joints.rShoulder).multiplyScalar(0.5);

	joints.lElbow = isVisible(lElbow)
		? amplifyFromShoulder(
				toLocal(lmToVec3(lElbow, new THREE.Vector3()), new THREE.Vector3()),
				joints.lShoulder,
				ARM_GAIN,
				new THREE.Vector3(),
			)
		: defaultJoints.lElbow.clone();
	joints.rElbow = isVisible(rElbow)
		? amplifyFromShoulder(
				toLocal(lmToVec3(rElbow, new THREE.Vector3()), new THREE.Vector3()),
				joints.rShoulder,
				ARM_GAIN,
				new THREE.Vector3(),
			)
		: defaultJoints.rElbow.clone();
	joints.lWrist = isVisible(lWrist)
		? amplifyFromShoulder(
				toLocal(lmToVec3(lWrist, new THREE.Vector3()), new THREE.Vector3()),
				joints.lElbow,
				ARM_GAIN,
				new THREE.Vector3(),
			)
		: defaultJoints.lWrist.clone();
	joints.rWrist = isVisible(rWrist)
		? amplifyFromShoulder(
				toLocal(lmToVec3(rWrist, new THREE.Vector3()), new THREE.Vector3()),
				joints.rElbow,
				ARM_GAIN,
				new THREE.Vector3(),
			)
		: defaultJoints.rWrist.clone();

	return { detected: true, joints };
}

/**
 * 用 JointPositions 更新平滑关节；未检测时向默认 T-pose 插值回退。
 */
export function updateSmoothedJoints(
	smoothed: SmoothedJoints,
	target: JointPositions,
	defaultJoints: Record<JointKey, THREE.Vector3>,
): void {
	const fallback = defaultJointPositions(defaultJoints);
	for (const key of JOINT_KEYS) {
		const goal = target.detected ? target.joints[key] : fallback.joints[key];
		const alpha = target.detected
			? isArmJoint(key)
				? SMOOTH_ALPHA.arm
				: SMOOTH_ALPHA.torso
			: SMOOTH_ALPHA.tPoseReturn;
		smoothed.joints[key].update(goal, alpha);
	}
}

/**
 * 将平滑后的关节位置应用到火柴人模型（更新球体位置与圆柱骨骼对齐）。
 */
export function applyStickmanPose(rig: StickmanRig, smoothed: SmoothedJoints): void {
	const pos = {} as Record<JointKey, THREE.Vector3>;
	for (const key of JOINT_KEYS) {
		pos[key] = smoothed.joints[key].ref();
		rig.joints[key].position.copy(pos[key]);
	}

	for (const def of BONE_DEFS) {
		const bone = rig.bones[def.key];
		const from = pos[def.from];
		const to = pos[def.to];
		if (from.distanceTo(to) < MIN_BONE_LEN) {
			bone.visible = false;
			continue;
		}
		alignBone(bone, from, to);
	}
}

/*
// 原代码注释：钢铁侠旋转/偏移驱动（已替换为关节位置驱动）
// export interface PoseTarget { rootYaw, armLQuat, forearmLBend, ... }
// export function landmarksToPoseTarget(landmarks): PoseTarget | null { ... }
// export function applySmoothedPose(rig: CharacterRig, smoothed, defaultPose): void { ... }
*/
