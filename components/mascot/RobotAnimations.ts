import * as THREE from "three";
import type { RobotRig } from "@/components/mascot/RobotModel";

export type RobotAnimationState =
  | "idle"
  | "greeting"
  | "thinking"
  | "excited"
  | "pointing"
  | "sleeping";

export type RobotExpression =
  | "neutral"
  | "happy"
  | "curious"
  | "wink"
  | "excited"
  | "sleepy";

export type RobotAnimatorParams = {
  animation: RobotAnimationState;
  expression: RobotExpression;
  pointerX: number; // -1..1 normalized
  pointerY: number; // -1..1 normalized
  manualRotationY: number; // radians
  targetScale: number;
  paused: boolean;
  reducedMotion: boolean;
};

export class RobotAnimator {
  private elapsed = 0;
  private blinkTimer = 2.6;
  private blinkProgress = 0;
  private isBlinking = false;

  public triggerBlink() {
    if (!this.isBlinking) {
      this.isBlinking = true;
      this.blinkProgress = 0;
    }
  }

  public update(rig: RobotRig, dt: number, params: RobotAnimatorParams) {
    const safeDt = Math.min(dt, 0.05);
    const {
      animation,
      expression,
      pointerX,
      pointerY,
      manualRotationY,
      targetScale,
      paused,
      reducedMotion,
    } = params;

    if (!paused && !reducedMotion) {
      this.elapsed += safeDt;
    }

    const t = this.elapsed;
    const dampLambda = reducedMotion ? 24 : 8.5;

    // --- Natural Blinking Layer ---
    if (!paused && !reducedMotion && animation !== "sleeping") {
      this.blinkTimer -= safeDt;
      if (this.blinkTimer <= 0 && !this.isBlinking) {
        this.isBlinking = true;
        this.blinkProgress = 0;
        this.blinkTimer = 2.4 + ((Math.sin(t * 17.3) + 1) * 0.5) * 2.2;
      }
      if (this.isBlinking) {
        this.blinkProgress += safeDt * 7.2;
        if (this.blinkProgress >= 1) {
          this.isBlinking = false;
          this.blinkProgress = 0;
        }
      }
    } else if (animation === "sleeping") {
      this.isBlinking = false;
      this.blinkProgress = 0;
    }

    const blinkFactor = this.isBlinking
      ? Math.sin(this.blinkProgress * Math.PI)
      : 0;

    // --- Default Pose Targets ---
    let bodyY = Math.sin(t * 2.0) * 0.055;
    let bodyRotX = 0;
    let bodyRotY = Math.sin(t * 0.9) * 0.04;
    let bodyRotZ = 0;

    let headRotX = -pointerY * 0.16;
    let headRotY = pointerX * 0.28;
    let headRotZ = 0;

    // Left Arm (-1)
    let lShoulderX = 0.06;
    const lShoulderY = 0;
    let lShoulderZ = -0.18 - Math.sin(t * 2.0) * 0.03;
    let lElbowX = -0.25;
    let lElbowZ = 0.08;
    const lHandRotY = 0;

    // Right Arm (+1)
    let rShoulderX = 0.06;
    let rShoulderY = 0;
    let rShoulderZ = 0.18 + Math.sin(t * 2.0) * 0.03;
    let rElbowX = -0.25;
    let rElbowZ = -0.08;
    let rHandRotY = 0;
    let rOtherFingersCurl = 0;

    // Legs
    let lHipX = 0.05 + Math.sin(t * 2.0) * 0.03;
    let lKneeX = 0.08;
    let rHipX = 0.05 - Math.sin(t * 2.0) * 0.03;
    let rKneeX = 0.08;

    let chestEmissive = 1.15 + Math.sin(t * 3.0) * 0.2;

    // --- Pose State Overrides ---
    switch (animation) {
      case "idle": {
        headRotX += Math.sin(t * 1.4) * 0.035;
        headRotZ = Math.sin(t * 0.8) * 0.03;
        break;
      }

      case "greeting": {
        bodyY = Math.sin(t * 2.6) * 0.055 + 0.03;
        bodyRotZ = -0.04;
        headRotZ = -0.09;
        headRotY = pointerX * 0.22 + 0.06;

        // Right arm raised waving warmly
        rShoulderX = -0.22;
        rShoulderZ = 2.28;
        rElbowX = -0.2;
        rElbowZ = -0.38 + Math.sin(t * 7.2) * 0.32;
        rHandRotY = Math.sin(t * 7.2) * 0.16;

        // Left hand resting confidently on hip (matching reference silhouette)
        lShoulderX = 0.1;
        lShoulderZ = -0.52;
        lElbowX = -0.58;
        lElbowZ = 0.56;
        break;
      }

      case "thinking": {
        bodyY = Math.sin(t * 1.5) * 0.035;
        bodyRotY = -0.12 + pointerX * 0.06;
        headRotX = 0.12 - pointerY * 0.08;
        headRotY = 0.16 + pointerX * 0.12;
        headRotZ = 0.14;

        // Right arm bent bringing hand toward chin
        rShoulderX = -1.05;
        rShoulderY = 0.42;
        rShoulderZ = 0.35;
        rElbowX = -1.62;
        rElbowZ = 0.52;
        rHandRotY = -0.42;

        // Left arm tucked across lower chest
        lShoulderX = -0.45;
        lShoulderZ = -0.22;
        lElbowX = -1.15;
        lElbowZ = -0.65;
        chestEmissive = 1.45 + Math.sin(t * 5.2) * 0.35;
        break;
      }

      case "excited": {
        // Celebratory bounce
        const bounce = Math.abs(Math.sin(t * 5.4));
        bodyY = bounce * 0.16;
        bodyRotX = -0.05;
        headRotX = -0.1 + bounce * 0.05;
        headRotZ = Math.sin(t * 5.4) * 0.08;

        // Both arms raised high
        lShoulderX = -0.35;
        lShoulderZ = -2.42 - Math.sin(t * 7.5) * 0.14;
        lElbowX = -0.25;
        lElbowZ = 0.25;

        rShoulderX = -0.35;
        rShoulderZ = 2.42 + Math.sin(t * 7.5) * 0.14;
        rElbowX = -0.25;
        rElbowZ = -0.25;

        // Slight celebratory kick
        lHipX = -0.12 - bounce * 0.12;
        lKneeX = 0.28;
        rHipX = -0.05 + bounce * 0.08;
        rKneeX = 0.22;

        chestEmissive = 1.55 + Math.sin(t * 8.0) * 0.35;
        break;
      }

      case "pointing": {
        bodyRotY = 0.18;
        headRotY = -0.24 + pointerX * 0.16;
        headRotZ = -0.05;

        // Right arm extends outward/forward pointing at UI elements
        rShoulderX = -0.82;
        rShoulderY = 0.15;
        rShoulderZ = 1.08;
        rElbowX = -0.18;
        rElbowZ = -0.08;
        rHandRotY = -0.3;
        rOtherFingersCurl = 1.25;

        // Left hand resting confidently near hip
        lShoulderX = 0.12;
        lShoulderZ = -0.45;
        lElbowX = -0.65;
        lElbowZ = -0.45;
        break;
      }

      case "sleeping": {
        bodyY = -0.12 + Math.sin(t * 1.1) * 0.025;
        bodyRotX = 0.08;
        headRotX = 0.26 + Math.sin(t * 1.1) * 0.03;
        headRotY = 0;
        headRotZ = 0.08;

        lShoulderX = 0.12;
        lShoulderZ = -0.12;
        lElbowX = -0.15;
        rShoulderX = 0.12;
        rShoulderZ = 0.12;
        rElbowX = -0.15;

        lHipX = 0.02;
        rHipX = 0.02;
        chestEmissive = 0.55 + Math.sin(t * 1.1) * 0.2;
        break;
      }
    }

    if (reducedMotion) {
      bodyY = animation === "sleeping" ? -0.12 : 0;
      bodyRotY = 0;
    }

    // --- Apply Damped Skeletal Transforms ---
    rig.root.rotation.y = THREE.MathUtils.damp(
      rig.root.rotation.y,
      manualRotationY,
      10,
      safeDt
    );
    const currentScale = THREE.MathUtils.damp(
      rig.root.scale.x,
      targetScale,
      10,
      safeDt
    );
    rig.root.scale.setScalar(currentScale);

    rig.bodyPivot.position.y = THREE.MathUtils.damp(
      rig.bodyPivot.position.y,
      bodyY,
      dampLambda,
      safeDt
    );
    rig.bodyPivot.rotation.x = THREE.MathUtils.damp(
      rig.bodyPivot.rotation.x,
      bodyRotX,
      dampLambda,
      safeDt
    );
    rig.bodyPivot.rotation.y = THREE.MathUtils.damp(
      rig.bodyPivot.rotation.y,
      bodyRotY,
      dampLambda,
      safeDt
    );
    rig.bodyPivot.rotation.z = THREE.MathUtils.damp(
      rig.bodyPivot.rotation.z,
      bodyRotZ,
      dampLambda,
      safeDt
    );

    rig.headPivot.rotation.x = THREE.MathUtils.damp(
      rig.headPivot.rotation.x,
      headRotX,
      dampLambda,
      safeDt
    );
    rig.headPivot.rotation.y = THREE.MathUtils.damp(
      rig.headPivot.rotation.y,
      headRotY,
      dampLambda,
      safeDt
    );
    rig.headPivot.rotation.z = THREE.MathUtils.damp(
      rig.headPivot.rotation.z,
      headRotZ,
      dampLambda,
      safeDt
    );

    // Left arm
    rig.leftShoulder.rotation.x = THREE.MathUtils.damp(
      rig.leftShoulder.rotation.x,
      lShoulderX,
      dampLambda,
      safeDt
    );
    rig.leftShoulder.rotation.y = THREE.MathUtils.damp(
      rig.leftShoulder.rotation.y,
      lShoulderY,
      dampLambda,
      safeDt
    );
    rig.leftShoulder.rotation.z = THREE.MathUtils.damp(
      rig.leftShoulder.rotation.z,
      lShoulderZ,
      dampLambda,
      safeDt
    );
    rig.leftElbow.rotation.x = THREE.MathUtils.damp(
      rig.leftElbow.rotation.x,
      lElbowX,
      dampLambda,
      safeDt
    );
    rig.leftElbow.rotation.z = THREE.MathUtils.damp(
      rig.leftElbow.rotation.z,
      lElbowZ,
      dampLambda,
      safeDt
    );
    rig.leftHand.rotation.y = THREE.MathUtils.damp(
      rig.leftHand.rotation.y,
      lHandRotY,
      dampLambda,
      safeDt
    );

    // Right arm
    rig.rightShoulder.rotation.x = THREE.MathUtils.damp(
      rig.rightShoulder.rotation.x,
      rShoulderX,
      dampLambda,
      safeDt
    );
    rig.rightShoulder.rotation.y = THREE.MathUtils.damp(
      rig.rightShoulder.rotation.y,
      rShoulderY,
      dampLambda,
      safeDt
    );
    rig.rightShoulder.rotation.z = THREE.MathUtils.damp(
      rig.rightShoulder.rotation.z,
      rShoulderZ,
      dampLambda,
      safeDt
    );
    rig.rightElbow.rotation.x = THREE.MathUtils.damp(
      rig.rightElbow.rotation.x,
      rElbowX,
      dampLambda,
      safeDt
    );
    rig.rightElbow.rotation.z = THREE.MathUtils.damp(
      rig.rightElbow.rotation.z,
      rElbowZ,
      dampLambda,
      safeDt
    );
    rig.rightHand.rotation.y = THREE.MathUtils.damp(
      rig.rightHand.rotation.y,
      rHandRotY,
      dampLambda,
      safeDt
    );
    rig.rightOtherFingers.rotation.x = THREE.MathUtils.damp(
      rig.rightOtherFingers.rotation.x,
      rOtherFingersCurl,
      dampLambda,
      safeDt
    );

    // Legs
    rig.leftHip.rotation.x = THREE.MathUtils.damp(
      rig.leftHip.rotation.x,
      lHipX,
      dampLambda,
      safeDt
    );
    rig.leftKnee.rotation.x = THREE.MathUtils.damp(
      rig.leftKnee.rotation.x,
      lKneeX,
      dampLambda,
      safeDt
    );
    rig.rightHip.rotation.x = THREE.MathUtils.damp(
      rig.rightHip.rotation.x,
      rHipX,
      dampLambda,
      safeDt
    );
    rig.rightKnee.rotation.x = THREE.MathUtils.damp(
      rig.rightKnee.rotation.x,
      rKneeX,
      dampLambda,
      safeDt
    );

    // --- Facial Expression & Eye Blinking ---
    const effectiveExpr: RobotExpression =
      animation === "sleeping"
        ? "sleepy"
        : expression !== "neutral"
        ? expression
        : animation === "excited"
        ? "excited"
        : animation === "greeting"
        ? "happy"
        : animation === "thinking"
        ? "curious"
        : "neutral";

    let targetLeftEyeScaleY = 1.0;
    let targetRightEyeScaleY = 1.0;
    let targetLeftBrowZ = 0;
    let targetRightBrowZ = 0;
    let targetSmileScale = 1.0;
    let targetSmileY = -0.095;
    let targetEyeGlow = 1.15;

    switch (effectiveExpr) {
      case "happy":
        targetLeftEyeScaleY = 0.85;
        targetRightEyeScaleY = 0.85;
        targetLeftBrowZ = 0.12;
        targetRightBrowZ = -0.12;
        targetSmileScale = 1.28;
        targetEyeGlow = 1.3;
        break;
      case "excited":
        targetLeftEyeScaleY = 1.18;
        targetRightEyeScaleY = 1.18;
        targetLeftBrowZ = 0.16;
        targetRightBrowZ = -0.16;
        targetSmileScale = 1.4;
        targetEyeGlow = 1.5;
        break;
      case "curious":
        targetLeftEyeScaleY = 0.82;
        targetRightEyeScaleY = 1.12;
        targetLeftBrowZ = -0.16;
        targetRightBrowZ = 0.22;
        targetSmileScale = 0.55;
        targetSmileY = -0.105;
        break;
      case "wink":
        targetLeftEyeScaleY = 1.05;
        targetRightEyeScaleY = 0.12;
        targetLeftBrowZ = 0.1;
        targetRightBrowZ = -0.22;
        targetSmileScale = 1.25;
        break;
      case "sleepy":
        targetLeftEyeScaleY = 0.08;
        targetRightEyeScaleY = 0.08;
        targetLeftBrowZ = -0.1;
        targetRightBrowZ = 0.1;
        targetSmileScale = 0.35;
        targetEyeGlow = 0.45;
        break;
      default:
        break;
    }

    const blinkMult = 1 - blinkFactor * 0.92;
    rig.leftEye.scale.y = THREE.MathUtils.damp(
      rig.leftEye.scale.y,
      targetLeftEyeScaleY * blinkMult,
      20,
      safeDt
    );
    rig.rightEye.scale.y = THREE.MathUtils.damp(
      rig.rightEye.scale.y,
      targetRightEyeScaleY * blinkMult,
      20,
      safeDt
    );

    // Subtle eye tracking on visor
    const eyeTrackX = pointerX * 0.016;
    const eyeTrackY = pointerY * 0.012;
    rig.leftEye.position.x = THREE.MathUtils.damp(
      rig.leftEye.position.x,
      -0.168 + eyeTrackX,
      12,
      safeDt
    );
    rig.rightEye.position.x = THREE.MathUtils.damp(
      rig.rightEye.position.x,
      0.168 + eyeTrackX,
      12,
      safeDt
    );
    rig.leftEye.position.y = THREE.MathUtils.damp(
      rig.leftEye.position.y,
      0.02 + eyeTrackY,
      12,
      safeDt
    );
    rig.rightEye.position.y = THREE.MathUtils.damp(
      rig.rightEye.position.y,
      0.02 + eyeTrackY,
      12,
      safeDt
    );

    rig.leftEyebrow.rotation.z = THREE.MathUtils.damp(
      rig.leftEyebrow.rotation.z,
      targetLeftBrowZ,
      12,
      safeDt
    );
    rig.rightEyebrow.rotation.z = THREE.MathUtils.damp(
      rig.rightEyebrow.rotation.z,
      targetRightBrowZ,
      12,
      safeDt
    );
    rig.smileArc.scale.setScalar(
      THREE.MathUtils.damp(rig.smileArc.scale.x, targetSmileScale, 12, safeDt)
    );
    rig.smileArc.position.y = THREE.MathUtils.damp(
      rig.smileArc.position.y,
      targetSmileY,
      12,
      safeDt
    );

    rig.leftEyeMat.emissiveIntensity = THREE.MathUtils.damp(
      rig.leftEyeMat.emissiveIntensity,
      targetEyeGlow,
      10,
      safeDt
    );
    rig.rightEyeMat.emissiveIntensity = THREE.MathUtils.damp(
      rig.rightEyeMat.emissiveIntensity,
      targetEyeGlow,
      10,
      safeDt
    );
    rig.smileMat.emissiveIntensity = THREE.MathUtils.damp(
      rig.smileMat.emissiveIntensity,
      effectiveExpr === "sleepy" ? 0.25 : 1.1,
      10,
      safeDt
    );

    // Chest reactor glow + contact shadow responsiveness
    rig.chestCoreMat.emissiveIntensity = THREE.MathUtils.damp(
      rig.chestCoreMat.emissiveIntensity,
      chestEmissive,
      10,
      safeDt
    );

    const shadowScale = 1 - rig.bodyPivot.position.y * 0.55;
    rig.shadowPlane.scale.setScalar(THREE.MathUtils.clamp(shadowScale, 0.72, 1.15));
    rig.shadowMat.opacity = THREE.MathUtils.clamp(
      0.56 - rig.bodyPivot.position.y * 0.85,
      0.28,
      0.65
    );
  }
}
