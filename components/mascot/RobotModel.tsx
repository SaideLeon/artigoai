import * as THREE from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";

export type RobotRig = {
  root: THREE.Group;
  bodyPivot: THREE.Group;
  torso: THREE.Mesh;
  chestCore: THREE.Mesh;
  chestCoreMat: THREE.MeshStandardMaterial;
  chestBars: THREE.Mesh[];
  neck: THREE.Mesh;
  headPivot: THREE.Group;
  visor: THREE.Mesh;
  leftEye: THREE.Group;
  rightEye: THREE.Group;
  leftEyeMat: THREE.MeshStandardMaterial;
  rightEyeMat: THREE.MeshStandardMaterial;
  leftEyeRing: THREE.Mesh;
  rightEyeRing: THREE.Mesh;
  leftEyebrow: THREE.Mesh;
  rightEyebrow: THREE.Mesh;
  smileArc: THREE.Mesh;
  smileMat: THREE.MeshStandardMaterial;
  leftAntennaTipMat: THREE.MeshStandardMaterial;
  rightAntennaTipMat: THREE.MeshStandardMaterial;
  leftShoulder: THREE.Group;
  leftElbow: THREE.Group;
  leftHand: THREE.Group;
  leftFingersGroup: THREE.Group;
  rightShoulder: THREE.Group;
  rightElbow: THREE.Group;
  rightHand: THREE.Group;
  rightIndexFinger: THREE.Group;
  rightOtherFingers: THREE.Group;
  leftHip: THREE.Group;
  leftKnee: THREE.Group;
  rightHip: THREE.Group;
  rightKnee: THREE.Group;
  shadowPlane: THREE.Mesh;
  shadowMat: THREE.MeshBasicMaterial;
};

function createContactShadowTexture(): THREE.CanvasTexture {
  const size = 256;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (ctx) {
    const grad = ctx.createRadialGradient(
      size / 2,
      size / 2,
      size * 0.06,
      size / 2,
      size / 2,
      size * 0.48
    );
    grad.addColorStop(0, "rgba(15, 23, 42, 0.42)");
    grad.addColorStop(0.55, "rgba(30, 41, 59, 0.16)");
    grad.addColorStop(1, "rgba(15, 23, 42, 0)");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, size, size);
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function createArtigenRobot(): {
  rig: RobotRig;
  dispose: () => void;
} {
  const geometries: THREE.BufferGeometry[] = [];
  const materials: THREE.Material[] = [];
  const textures: THREE.Texture[] = [];

  const trackGeo = <T extends THREE.BufferGeometry>(g: T): T => {
    geometries.push(g);
    return g;
  };
  const trackMat = <T extends THREE.Material>(m: T): T => {
    materials.push(m);
    return m;
  };

  // --- Shared Premium Materials ---
  const whiteShellMat = trackMat(
    new THREE.MeshPhysicalMaterial({
      color: 0xf4f7fb,
      roughness: 0.22,
      metalness: 0.02,
      clearcoat: 0.85,
      clearcoatRoughness: 0.12,
      envMapIntensity: 0.55,
      ior: 1.48,
    })
  );

  const softTrimMat = trackMat(
    new THREE.MeshPhysicalMaterial({
      color: 0xdbe4f0,
      roughness: 0.3,
      metalness: 0.1,
      clearcoat: 0.4,
      envMapIntensity: 0.5,
    })
  );

  const jointDarkMat = trackMat(
    new THREE.MeshPhysicalMaterial({
      color: 0x1e293b,
      roughness: 0.35,
      metalness: 0.45,
      clearcoat: 0.3,
      envMapIntensity: 0.6,
    })
  );

  const electricBlueMat = trackMat(
    new THREE.MeshPhysicalMaterial({
      color: 0x2563eb,
      roughness: 0.22,
      metalness: 0.2,
      clearcoat: 0.85,
      clearcoatRoughness: 0.12,
      envMapIntensity: 0.7,
    })
  );

  const royalPurpleMat = trackMat(
    new THREE.MeshPhysicalMaterial({
      color: 0x6d28d9,
      roughness: 0.24,
      metalness: 0.18,
      clearcoat: 0.82,
      clearcoatRoughness: 0.12,
      envMapIntensity: 0.7,
    })
  );

  const visorGlassMat = trackMat(
    new THREE.MeshPhysicalMaterial({
      color: 0x050814,
      roughness: 0.1,
      metalness: 0.05,
      clearcoat: 0.9,
      clearcoatRoughness: 0.06,
      envMapIntensity: 0.32,
      reflectivity: 0.75,
    })
  );

  const eyePupilMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0x020617,
      roughness: 0.15,
      metalness: 0.1,
    })
  );

  const leftEyeMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0x00d8ff,
      emissive: 0x0095ff,
      emissiveIntensity: 1.15,
      roughness: 0.18,
      metalness: 0.0,
    })
  );

  const rightEyeMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0x00d8ff,
      emissive: 0x0095ff,
      emissiveIntensity: 1.15,
      roughness: 0.18,
      metalness: 0.0,
    })
  );

  const smileMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0x00d8ff,
      emissive: 0x00a6ff,
      emissiveIntensity: 1.1,
      roughness: 0.2,
    })
  );

  const chestCoreMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0x00d8ff,
      emissive: 0x0095ff,
      emissiveIntensity: 1.15,
      roughness: 0.18,
    })
  );

  const chestBarMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0x8b5cf6,
      emissive: 0x6d28d9,
      emissiveIntensity: 1.05,
      roughness: 0.2,
    })
  );

  const leftAntennaTipMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0x9333ea,
      emissive: 0x7e22ce,
      emissiveIntensity: 1.15,
      roughness: 0.18,
    })
  );

  const rightAntennaTipMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0x0ea5e9,
      emissive: 0x0284c7,
      emissiveIntensity: 1.15,
      roughness: 0.18,
    })
  );

  // --- Root Assembly ---
  const root = new THREE.Group();
  root.name = "ArtigenRobotRoot";

  // Contact shadow disc grounded at y = -1.16
  const shadowTex = createContactShadowTexture();
  textures.push(shadowTex);
  const shadowMat = trackMat(
    new THREE.MeshBasicMaterial({
      map: shadowTex,
      transparent: true,
      depthWrite: false,
      opacity: 0.55,
    })
  );
  const shadowPlane = new THREE.Mesh(
    trackGeo(new THREE.PlaneGeometry(2.15, 2.15)),
    shadowMat
  );
  shadowPlane.rotation.x = -Math.PI / 2;
  shadowPlane.position.y = -1.16;
  root.add(shadowPlane);

  // Main floating body pivot
  const bodyPivot = new THREE.Group();
  bodyPivot.position.y = 0;
  root.add(bodyPivot);

  // --- TORSO ---
  const torsoGeo = trackGeo(new RoundedBoxGeometry(0.76, 0.78, 0.54, 5, 0.2));
  const torso = new THREE.Mesh(torsoGeo, whiteShellMat);
  torso.position.set(0, -0.04, 0);
  torso.castShadow = true;
  torso.receiveShadow = true;
  bodyPivot.add(torso);

  // Upper collar accent ring
  const collar = new THREE.Mesh(
    trackGeo(new THREE.TorusGeometry(0.24, 0.045, 16, 36)),
    royalPurpleMat
  );
  collar.rotation.x = Math.PI / 2;
  collar.position.set(0, 0.34, 0);
  collar.castShadow = true;
  bodyPivot.add(collar);

  // Waist belt accent
  const waistBelt = new THREE.Mesh(
    trackGeo(new RoundedBoxGeometry(0.68, 0.11, 0.5, 4, 0.05)),
    electricBlueMat
  );
  waistBelt.position.set(0, -0.34, 0);
  waistBelt.castShadow = true;
  bodyPivot.add(waistBelt);

  // Pelvis base
  const pelvis = new THREE.Mesh(
    trackGeo(new RoundedBoxGeometry(0.62, 0.24, 0.46, 4, 0.11)),
    whiteShellMat
  );
  pelvis.position.set(0, -0.46, 0);
  pelvis.castShadow = true;
  pelvis.receiveShadow = true;
  bodyPivot.add(pelvis);

  // Chest reactor housing + luminous core
  const chestRing = new THREE.Mesh(
    trackGeo(new THREE.TorusGeometry(0.145, 0.028, 16, 36)),
    royalPurpleMat
  );
  chestRing.position.set(0, 0.03, 0.268);
  bodyPivot.add(chestRing);

  const chestCore = new THREE.Mesh(
    trackGeo(new THREE.SphereGeometry(0.115, 24, 24)),
    chestCoreMat
  );
  chestCore.scale.set(1, 1, 0.32);
  chestCore.position.set(0, 0.03, 0.268);
  bodyPivot.add(chestCore);

  // Small luminous chest bars
  const chestBars: THREE.Mesh[] = [];
  const barGeo = trackGeo(new RoundedBoxGeometry(0.08, 0.025, 0.02, 2, 0.01));
  [-0.2, 0.2].forEach((xOffset) => {
    const bar = new THREE.Mesh(barGeo, chestBarMat);
    bar.position.set(xOffset, 0.14, 0.268);
    chestBars.push(bar);
    bodyPivot.add(bar);
  });

  // Back jet/battery pack accent for 360° silhouette polish
  const backPack = new THREE.Mesh(
    trackGeo(new RoundedBoxGeometry(0.46, 0.44, 0.16, 4, 0.07)),
    softTrimMat
  );
  backPack.position.set(0, -0.02, -0.28);
  backPack.castShadow = true;
  bodyPivot.add(backPack);

  const backStrip = new THREE.Mesh(
    trackGeo(new RoundedBoxGeometry(0.28, 0.06, 0.04, 2, 0.02)),
    electricBlueMat
  );
  backStrip.position.set(0, 0.08, -0.35);
  bodyPivot.add(backStrip);

  // --- NECK & HEAD ---
  const neck = new THREE.Mesh(
    trackGeo(new THREE.CylinderGeometry(0.13, 0.16, 0.16, 24)),
    jointDarkMat
  );
  neck.position.set(0, 0.41, 0);
  bodyPivot.add(neck);

  const headPivot = new THREE.Group();
  headPivot.position.set(0, 0.85, 0);
  bodyPivot.add(headPivot);

  // Rounded oversized white helmet shell (shifted back slightly so visor sits cleanly proud in front)
  const headGeo = trackGeo(new THREE.SphereGeometry(0.56, 40, 36));
  const headShell = new THREE.Mesh(headGeo, whiteShellMat);
  headShell.scale.set(1.08, 0.92, 0.8);
  headShell.position.set(0, 0, -0.05);
  headShell.castShadow = true;
  headShell.receiveShadow = true;
  headPivot.add(headShell);

  // Subtle dark neck/chin collar under head for clean silhouette
  const headRimRing = new THREE.Mesh(
    trackGeo(new THREE.TorusGeometry(0.46, 0.022, 12, 36)),
    softTrimMat
  );
  headRimRing.rotation.x = Math.PI / 2;
  headRimRing.position.set(0, -0.34, -0.03);
  headPivot.add(headRimRing);

  // Visor outer metallic purple bezel (front at z = 0.36 + 0.11 = 0.47, well clear of headShell front z = 0.398)
  const visorBezel = new THREE.Mesh(
    trackGeo(new RoundedBoxGeometry(0.92, 0.56, 0.22, 8, 0.13)),
    royalPurpleMat
  );
  visorBezel.position.set(0, -0.01, 0.36);
  visorBezel.castShadow = true;
  headPivot.add(visorBezel);

  // Dark glossy digital OLED visor screen (front at z = 0.382 + 0.11 = 0.492)
  const visor = new THREE.Mesh(
    trackGeo(new RoundedBoxGeometry(0.84, 0.48, 0.22, 8, 0.11)),
    visorGlassMat
  );
  visor.position.set(0, -0.01, 0.382);
  headPivot.add(visor);

  // --- EXPRESSIVE DIGITAL FACE (proud of visor front z = 0.492) ---
  const createEyeGroup = (
    x: number,
    eyeMat: THREE.MeshStandardMaterial
  ): { group: THREE.Group; ring: THREE.Mesh } => {
    const group = new THREE.Group();
    group.position.set(x, 0.02, 0.502);

    const ring = new THREE.Mesh(
      trackGeo(new THREE.TorusGeometry(0.106, 0.014, 14, 32)),
      eyeMat
    );
    group.add(ring);

    const eyeCore = new THREE.Mesh(
      trackGeo(new THREE.SphereGeometry(0.082, 24, 24)),
      eyeMat
    );
    eyeCore.scale.set(0.94, 1.12, 0.22);
    group.add(eyeCore);

    const pupil = new THREE.Mesh(
      trackGeo(new THREE.SphereGeometry(0.036, 18, 18)),
      eyePupilMat
    );
    pupil.scale.set(0.92, 1.04, 0.25);
    pupil.position.set(0, 0, 0.015);
    group.add(pupil);

    headPivot.add(group);
    return { group, ring };
  };

  const leftEyeObj = createEyeGroup(-0.185, leftEyeMat);
  const rightEyeObj = createEyeGroup(0.185, rightEyeMat);

  // Subtle expressive eyebrows
  const browGeo = trackGeo(new RoundedBoxGeometry(0.125, 0.024, 0.02, 2, 0.01));
  const leftEyebrow = new THREE.Mesh(browGeo, leftEyeMat);
  leftEyebrow.position.set(-0.185, 0.165, 0.505);
  headPivot.add(leftEyebrow);

  const rightEyebrow = new THREE.Mesh(browGeo, rightEyeMat);
  rightEyebrow.position.set(0.185, 0.165, 0.505);
  headPivot.add(rightEyebrow);

  // Digital smile arc (half torus rotated downward)
  const smileArc = new THREE.Mesh(
    trackGeo(new THREE.TorusGeometry(0.082, 0.015, 12, 24, Math.PI)),
    smileMat
  );
  smileArc.rotation.z = Math.PI;
  smileArc.position.set(0, -0.095, 0.505);
  headPivot.add(smileArc);

  // --- FUTURISTIC INTEGRATED HEADPHONES & ANTENNAS ---
  const headband = new THREE.Mesh(
    trackGeo(new THREE.TorusGeometry(0.595, 0.036, 16, 48, Math.PI)),
    electricBlueMat
  );
  headband.position.set(0, 0.02, -0.04);
  headband.castShadow = true;
  headPivot.add(headband);

  const createEarUnit = (
    side: -1 | 1,
    tipMat: THREE.MeshStandardMaterial
  ): THREE.Group => {
    const ear = new THREE.Group();
    ear.position.set(side * 0.6, 0.0, -0.04);

    const cup = new THREE.Mesh(
      trackGeo(new THREE.CylinderGeometry(0.16, 0.16, 0.11, 28)),
      electricBlueMat
    );
    cup.rotation.z = Math.PI / 2;
    cup.castShadow = true;
    ear.add(cup);

    const cupInner = new THREE.Mesh(
      trackGeo(new THREE.CylinderGeometry(0.12, 0.12, 0.125, 24)),
      jointDarkMat
    );
    cupInner.rotation.z = Math.PI / 2;
    ear.add(cupInner);

    const glowRing = new THREE.Mesh(
      trackGeo(new THREE.TorusGeometry(0.11, 0.018, 12, 28)),
      royalPurpleMat
    );
    glowRing.rotation.y = Math.PI / 2;
    glowRing.position.x = side * 0.062;
    ear.add(glowRing);

    // Sleek futuristic antenna extending upwards
    const stem = new THREE.Mesh(
      trackGeo(new THREE.CapsuleGeometry(0.016, 0.18, 6, 12)),
      softTrimMat
    );
    stem.position.set(side * 0.02, 0.22, -0.02);
    stem.rotation.z = -side * 0.12;
    ear.add(stem);

    const tip = new THREE.Mesh(
      trackGeo(new THREE.SphereGeometry(0.042, 16, 16)),
      tipMat
    );
    tip.position.set(side * 0.035, 0.34, -0.02);
    ear.add(tip);

    headPivot.add(ear);
    return ear;
  };

  createEarUnit(-1, leftAntennaTipMat);
  createEarUnit(1, rightAntennaTipMat);

  // --- ARTICULATED ARMS ---
  const createArm = (side: -1 | 1) => {
    const shoulder = new THREE.Group();
    shoulder.position.set(side * 0.45, 0.21, 0);
    bodyPivot.add(shoulder);

    const shoulderJoint = new THREE.Mesh(
      trackGeo(new THREE.SphereGeometry(0.11, 20, 20)),
      jointDarkMat
    );
    shoulderJoint.castShadow = true;
    shoulder.add(shoulderJoint);

    const shoulderTrim = new THREE.Mesh(
      trackGeo(new THREE.TorusGeometry(0.105, 0.018, 12, 24)),
      side === -1 ? royalPurpleMat : electricBlueMat
    );
    shoulderTrim.rotation.y = Math.PI / 2;
    shoulder.add(shoulderTrim);

    const upperArm = new THREE.Mesh(
      trackGeo(new THREE.CapsuleGeometry(0.075, 0.19, 8, 16)),
      whiteShellMat
    );
    upperArm.position.set(0, -0.17, 0);
    upperArm.castShadow = true;
    shoulder.add(upperArm);

    const elbow = new THREE.Group();
    elbow.position.set(0, -0.34, 0);
    shoulder.add(elbow);

    const elbowJoint = new THREE.Mesh(
      trackGeo(new THREE.SphereGeometry(0.078, 18, 18)),
      electricBlueMat
    );
    elbowJoint.castShadow = true;
    elbow.add(elbowJoint);

    const forearm = new THREE.Mesh(
      trackGeo(new THREE.CapsuleGeometry(0.08, 0.18, 8, 16)),
      whiteShellMat
    );
    forearm.position.set(0, -0.16, 0);
    forearm.castShadow = true;
    elbow.add(forearm);

    const wristCuff = new THREE.Mesh(
      trackGeo(new THREE.TorusGeometry(0.082, 0.016, 10, 24)),
      royalPurpleMat
    );
    wristCuff.rotation.x = Math.PI / 2;
    wristCuff.position.set(0, -0.26, 0);
    elbow.add(wristCuff);

    // Hand + simplified articulated fingers
    const hand = new THREE.Group();
    hand.position.set(0, -0.33, 0);
    elbow.add(hand);

    const palm = new THREE.Mesh(
      trackGeo(new RoundedBoxGeometry(0.125, 0.12, 0.085, 3, 0.035)),
      jointDarkMat
    );
    palm.castShadow = true;
    hand.add(palm);

    const thumb = new THREE.Mesh(
      trackGeo(new THREE.CapsuleGeometry(0.022, 0.055, 6, 10)),
      whiteShellMat
    );
    thumb.position.set(-side * 0.065, -0.02, 0.025);
    thumb.rotation.z = side * 0.55;
    hand.add(thumb);

    const indexFingerGroup = new THREE.Group();
    indexFingerGroup.position.set(-side * 0.035, -0.06, 0.015);
    hand.add(indexFingerGroup);

    const indexFinger = new THREE.Mesh(
      trackGeo(new THREE.CapsuleGeometry(0.02, 0.068, 6, 10)),
      whiteShellMat
    );
    indexFinger.position.set(0, -0.04, 0);
    indexFingerGroup.add(indexFinger);

    const otherFingersGroup = new THREE.Group();
    otherFingersGroup.position.set(0, -0.06, 0);
    hand.add(otherFingersGroup);

    [0.005, 0.042].forEach((offset, idx) => {
      const finger = new THREE.Mesh(
        trackGeo(
          new THREE.CapsuleGeometry(0.019, idx === 0 ? 0.065 : 0.055, 6, 10)
        ),
        whiteShellMat
      );
      finger.position.set(side * offset, -0.038, 0.005);
      otherFingersGroup.add(finger);
    });

    return {
      shoulder,
      elbow,
      hand,
      indexFingerGroup,
      otherFingersGroup,
    };
  };

  const leftArm = createArm(-1);
  const rightArm = createArm(1);

  // --- PROPORTIONAL SMALL LEGS ---
  const createLeg = (side: -1 | 1) => {
    const hip = new THREE.Group();
    hip.position.set(side * 0.19, -0.57, 0);
    bodyPivot.add(hip);

    const hipJoint = new THREE.Mesh(
      trackGeo(new THREE.SphereGeometry(0.09, 18, 18)),
      jointDarkMat
    );
    hip.add(hipJoint);

    const thigh = new THREE.Mesh(
      trackGeo(new THREE.CapsuleGeometry(0.075, 0.14, 8, 14)),
      whiteShellMat
    );
    thigh.position.set(0, -0.12, 0);
    thigh.castShadow = true;
    hip.add(thigh);

    const knee = new THREE.Group();
    knee.position.set(0, -0.24, 0);
    hip.add(knee);

    const kneeJoint = new THREE.Mesh(
      trackGeo(new THREE.SphereGeometry(0.072, 16, 16)),
      electricBlueMat
    );
    knee.add(kneeJoint);

    const shin = new THREE.Mesh(
      trackGeo(new THREE.CapsuleGeometry(0.072, 0.13, 8, 14)),
      whiteShellMat
    );
    shin.position.set(0, -0.11, 0);
    shin.castShadow = true;
    knee.add(shin);

    // Boot / hover foot
    const foot = new THREE.Mesh(
      trackGeo(new RoundedBoxGeometry(0.17, 0.1, 0.25, 4, 0.045)),
      electricBlueMat
    );
    foot.position.set(0, -0.24, 0.04);
    foot.castShadow = true;
    knee.add(foot);

    const soleGlow = new THREE.Mesh(
      trackGeo(new RoundedBoxGeometry(0.13, 0.025, 0.2, 2, 0.01)),
      leftEyeMat
    );
    soleGlow.position.set(0, -0.285, 0.04);
    knee.add(soleGlow);

    return { hip, knee };
  };

  const leftLeg = createLeg(-1);
  const rightLeg = createLeg(1);

  const rig: RobotRig = {
    root,
    bodyPivot,
    torso,
    chestCore,
    chestCoreMat,
    chestBars,
    neck,
    headPivot,
    visor,
    leftEye: leftEyeObj.group,
    rightEye: rightEyeObj.group,
    leftEyeMat,
    rightEyeMat,
    leftEyeRing: leftEyeObj.ring,
    rightEyeRing: rightEyeObj.ring,
    leftEyebrow,
    rightEyebrow,
    smileArc,
    smileMat,
    leftAntennaTipMat,
    rightAntennaTipMat,
    leftShoulder: leftArm.shoulder,
    leftElbow: leftArm.elbow,
    leftHand: leftArm.hand,
    leftFingersGroup: leftArm.otherFingersGroup,
    rightShoulder: rightArm.shoulder,
    rightElbow: rightArm.elbow,
    rightHand: rightArm.hand,
    rightIndexFinger: rightArm.indexFingerGroup,
    rightOtherFingers: rightArm.otherFingersGroup,
    leftHip: leftLeg.hip,
    leftKnee: leftLeg.knee,
    rightHip: rightLeg.hip,
    rightKnee: rightLeg.knee,
    shadowPlane,
    shadowMat,
  };

  const dispose = () => {
    geometries.forEach((g) => g.dispose());
    materials.forEach((m) => m.dispose());
    textures.forEach((t) => t.dispose());
  };

  return { rig, dispose };
}
