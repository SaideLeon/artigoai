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
      metalness: 0.03,
      clearcoat: 0.88,
      clearcoatRoughness: 0.1,
      envMapIntensity: 0.58,
      ior: 1.48,
    })
  );

  const softTrimMat = trackMat(
    new THREE.MeshPhysicalMaterial({
      color: 0xdbe4f0,
      roughness: 0.28,
      metalness: 0.12,
      clearcoat: 0.45,
      envMapIntensity: 0.5,
    })
  );

  const jointDarkMat = trackMat(
    new THREE.MeshPhysicalMaterial({
      color: 0x161f30,
      roughness: 0.32,
      metalness: 0.42,
      clearcoat: 0.45,
      clearcoatRoughness: 0.2,
      envMapIntensity: 0.65,
    })
  );

  const electricBlueMat = trackMat(
    new THREE.MeshPhysicalMaterial({
      color: 0x0ea5e9,
      roughness: 0.22,
      metalness: 0.18,
      clearcoat: 0.85,
      clearcoatRoughness: 0.12,
      envMapIntensity: 0.72,
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
      color: 0x050914,
      roughness: 0.09,
      metalness: 0.06,
      clearcoat: 0.95,
      clearcoatRoughness: 0.05,
      envMapIntensity: 0.35,
      reflectivity: 0.8,
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
      emissiveIntensity: 1.18,
      roughness: 0.18,
      metalness: 0.0,
    })
  );

  const rightEyeMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0x00d8ff,
      emissive: 0x0095ff,
      emissiveIntensity: 1.18,
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
      color: 0x38bdf8,
      emissive: 0x0284c7,
      emissiveIntensity: 1.25,
      roughness: 0.15,
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

  // Contact shadow disc grounded under boots at y = -1.10
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
    trackGeo(new THREE.PlaneGeometry(2.1, 2.1)),
    shadowMat
  );
  shadowPlane.rotation.x = -Math.PI / 2;
  shadowPlane.position.y = -1.10;
  root.add(shadowPlane);

  // Main floating body pivot
  const bodyPivot = new THREE.Group();
  bodyPivot.position.y = 0;
  root.add(bodyPivot);

  // --- SCULPTED CHEST ARMOR + ARTICULATED DARK WAIST + PELVIS ---
  // Rounded sculpted chest armor shell (wider at top shoulders, tapers slightly into waist)
  const torso = new THREE.Mesh(
    trackGeo(new THREE.SphereGeometry(0.32, 36, 30)),
    whiteShellMat
  );
  torso.scale.set(1.06, 0.84, 0.78);
  torso.position.set(0, 0.08, 0);
  torso.castShadow = true;
  torso.receiveShadow = true;
  bodyPivot.add(torso);

  // Subtle purple/blue collar trim ring at top of chestplate
  const collar = new THREE.Mesh(
    trackGeo(new THREE.TorusGeometry(0.175, 0.026, 14, 36)),
    royalPurpleMat
  );
  collar.rotation.x = Math.PI / 2;
  collar.position.set(0, 0.305, 0);
  collar.castShadow = true;
  bodyPivot.add(collar);

  // Glowing electric-blue / cyan chest core emblem with purple outer ring
  const chestBezel = new THREE.Mesh(
    trackGeo(new THREE.TorusGeometry(0.118, 0.022, 16, 36)),
    electricBlueMat
  );
  chestBezel.position.set(0, 0.08, 0.232);
  bodyPivot.add(chestBezel);

  const chestCore = new THREE.Mesh(
    trackGeo(new THREE.SphereGeometry(0.098, 24, 24)),
    chestCoreMat
  );
  chestCore.scale.set(1, 1, 0.34);
  chestCore.position.set(0, 0.08, 0.236);
  bodyPivot.add(chestCore);

  // Subtle purple luminous accent bars flanking upper chest
  const chestBars: THREE.Mesh[] = [];
  const barGeo = trackGeo(new RoundedBoxGeometry(0.065, 0.02, 0.02, 2, 0.008));
  [-0.19, 0.19].forEach((xOffset, i) => {
    const bar = new THREE.Mesh(barGeo, chestBarMat);
    bar.position.set(xOffset, 0.18, 0.21);
    bar.rotation.y = i === 0 ? -0.35 : 0.35;
    chestBars.push(bar);
    bodyPivot.add(bar);
  });

  // Back jet/power pack accent for 360° polish
  const backPack = new THREE.Mesh(
    trackGeo(new RoundedBoxGeometry(0.32, 0.28, 0.12, 4, 0.05)),
    softTrimMat
  );
  backPack.position.set(0, 0.1, -0.22);
  backPack.castShadow = true;
  bodyPivot.add(backPack);

  const backStrip = new THREE.Mesh(
    trackGeo(new RoundedBoxGeometry(0.18, 0.045, 0.03, 2, 0.015)),
    electricBlueMat
  );
  backStrip.position.set(0, 0.16, -0.275);
  bodyPivot.add(backStrip);

  // Tapered dark mechanical abdomen (segmented robotic waist like reference)
  const abdomenUpper = new THREE.Mesh(
    trackGeo(new THREE.CylinderGeometry(0.21, 0.165, 0.14, 28)),
    jointDarkMat
  );
  abdomenUpper.position.set(0, -0.17, 0);
  abdomenUpper.castShadow = true;
  bodyPivot.add(abdomenUpper);

  const abdomenRib = new THREE.Mesh(
    trackGeo(new THREE.TorusGeometry(0.162, 0.018, 12, 32)),
    jointDarkMat
  );
  abdomenRib.rotation.x = Math.PI / 2;
  abdomenRib.position.set(0, -0.23, 0);
  bodyPivot.add(abdomenRib);

  const abdomenLower = new THREE.Mesh(
    trackGeo(new THREE.CylinderGeometry(0.165, 0.185, 0.11, 28)),
    jointDarkMat
  );
  abdomenLower.position.set(0, -0.27, 0);
  bodyPivot.add(abdomenLower);

  // Sculpted white pelvis armor cup
  const pelvis = new THREE.Mesh(
    trackGeo(new THREE.SphereGeometry(0.22, 28, 24)),
    whiteShellMat
  );
  pelvis.scale.set(1.06, 0.62, 0.84);
  pelvis.position.set(0, -0.36, 0);
  pelvis.castShadow = true;
  pelvis.receiveShadow = true;
  bodyPivot.add(pelvis);

  // Subtle waist accent line on pelvis top
  const pelvisBelt = new THREE.Mesh(
    trackGeo(new THREE.TorusGeometry(0.175, 0.014, 10, 32)),
    royalPurpleMat
  );
  pelvisBelt.rotation.x = Math.PI / 2;
  pelvisBelt.scale.set(1.12, 0.88, 1);
  pelvisBelt.position.set(0, -0.305, 0);
  bodyPivot.add(pelvisBelt);

  // --- NECK & HEAD ---
  const neck = new THREE.Mesh(
    trackGeo(new THREE.CylinderGeometry(0.105, 0.13, 0.14, 24)),
    jointDarkMat
  );
  neck.position.set(0, 0.35, 0);
  bodyPivot.add(neck);

  const headPivot = new THREE.Group();
  headPivot.position.set(0, 0.78, 0);
  bodyPivot.add(headPivot);

  // Rounded oversized white helmet shell
  const headGeo = trackGeo(new THREE.SphereGeometry(0.54, 44, 38));
  const headShell = new THREE.Mesh(headGeo, whiteShellMat);
  headShell.scale.set(1.12, 0.94, 0.92);
  headShell.castShadow = true;
  headShell.receiveShadow = true;
  headPivot.add(headShell);

  // Smooth curved glossy black OLED visor dome molded cleanly into the white helmet
  const visor = new THREE.Mesh(
    trackGeo(new THREE.SphereGeometry(0.47, 40, 34)),
    visorGlassMat
  );
  visor.scale.set(0.96, 0.75, 0.62);
  visor.position.set(0, -0.01, 0.23);
  headPivot.add(visor);

  // Subtle sleek purple/indigo accent ring framing the visor perimeter
  const visorRim = new THREE.Mesh(
    trackGeo(new THREE.TorusGeometry(0.39, 0.014, 12, 48)),
    royalPurpleMat
  );
  visorRim.scale.set(1.06, 0.81, 0.7);
  visorRim.position.set(0, -0.01, 0.395);
  headPivot.add(visorRim);

  // --- EXPRESSIVE DIGITAL FACE (curved cleanly along visor surface) ---
  const createEyeGroup = (
    x: number,
    eyeMat: THREE.MeshStandardMaterial
  ): { group: THREE.Group; ring: THREE.Mesh } => {
    const group = new THREE.Group();
    group.position.set(x, 0.02, 0.512);
    group.rotation.y = x < 0 ? -0.14 : 0.14;

    const ring = new THREE.Mesh(
      trackGeo(new THREE.TorusGeometry(0.102, 0.014, 14, 32)),
      eyeMat
    );
    group.add(ring);

    const eyeCore = new THREE.Mesh(
      trackGeo(new THREE.SphereGeometry(0.08, 24, 24)),
      eyeMat
    );
    eyeCore.scale.set(0.94, 1.1, 0.22);
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

  const leftEyeObj = createEyeGroup(-0.168, leftEyeMat);
  const rightEyeObj = createEyeGroup(0.168, rightEyeMat);

  // Subtle expressive eyebrows
  const browGeo = trackGeo(new RoundedBoxGeometry(0.115, 0.022, 0.02, 2, 0.01));
  const leftEyebrow = new THREE.Mesh(browGeo, leftEyeMat);
  leftEyebrow.position.set(-0.168, 0.155, 0.482);
  leftEyebrow.rotation.x = -0.24;
  leftEyebrow.rotation.y = -0.14;
  headPivot.add(leftEyebrow);

  const rightEyebrow = new THREE.Mesh(browGeo, rightEyeMat);
  rightEyebrow.position.set(0.168, 0.155, 0.482);
  rightEyebrow.rotation.x = -0.24;
  rightEyebrow.rotation.y = 0.14;
  headPivot.add(rightEyebrow);

  // Digital smile arc
  const smileArc = new THREE.Mesh(
    trackGeo(new THREE.TorusGeometry(0.075, 0.014, 12, 24, Math.PI)),
    smileMat
  );
  smileArc.rotation.z = Math.PI;
  smileArc.rotation.x = 0.16;
  smileArc.position.set(0, -0.095, 0.518);
  headPivot.add(smileArc);

  // --- FUTURISTIC INTEGRATED HEADPHONES, TOP CREST & ANTENNAS ---
  const headband = new THREE.Mesh(
    trackGeo(new THREE.TorusGeometry(0.585, 0.032, 16, 48, Math.PI)),
    electricBlueMat
  );
  headband.position.set(0, 0.02, 0);
  headband.castShadow = true;
  headPivot.add(headband);

  // Sleek top crest fin matching reference silhouette
  const topCrest = new THREE.Mesh(
    trackGeo(new RoundedBoxGeometry(0.065, 0.07, 0.24, 4, 0.03)),
    royalPurpleMat
  );
  topCrest.position.set(0, 0.535, -0.02);
  headPivot.add(topCrest);

  const createEarUnit = (
    side: -1 | 1,
    tipMat: THREE.MeshStandardMaterial
  ): THREE.Group => {
    const ear = new THREE.Group();
    ear.position.set(side * 0.59, 0.0, 0);

    const cup = new THREE.Mesh(
      trackGeo(new THREE.CylinderGeometry(0.155, 0.155, 0.105, 28)),
      electricBlueMat
    );
    cup.rotation.z = Math.PI / 2;
    cup.castShadow = true;
    ear.add(cup);

    const cupInner = new THREE.Mesh(
      trackGeo(new THREE.CylinderGeometry(0.115, 0.115, 0.12, 24)),
      jointDarkMat
    );
    cupInner.rotation.z = Math.PI / 2;
    ear.add(cupInner);

    const glowRing = new THREE.Mesh(
      trackGeo(new THREE.TorusGeometry(0.105, 0.016, 12, 28)),
      royalPurpleMat
    );
    glowRing.rotation.y = Math.PI / 2;
    glowRing.position.x = side * 0.06;
    ear.add(glowRing);

    // Sleek futuristic antenna extending upwards
    const stem = new THREE.Mesh(
      trackGeo(new THREE.CapsuleGeometry(0.015, 0.16, 6, 12)),
      softTrimMat
    );
    stem.position.set(side * 0.02, 0.21, -0.02);
    stem.rotation.z = -side * 0.12;
    ear.add(stem);

    const tip = new THREE.Mesh(
      trackGeo(new THREE.SphereGeometry(0.04, 16, 16)),
      tipMat
    );
    tip.position.set(side * 0.032, 0.32, -0.02);
    ear.add(tip);

    headPivot.add(ear);
    return ear;
  };

  createEarUnit(-1, leftAntennaTipMat);
  createEarUnit(1, rightAntennaTipMat);

  // --- ARTICULATED ARMS (Shoulder Pad + Dark Bicep + White Forearm Gauntlet + Dark Articulated Hand) ---
  const createArm = (side: -1 | 1) => {
    const shoulder = new THREE.Group();
    shoulder.position.set(side * 0.355, 0.19, 0);
    bodyPivot.add(shoulder);

    // Dark mechanical shoulder ball
    const shoulderJoint = new THREE.Mesh(
      trackGeo(new THREE.SphereGeometry(0.082, 20, 20)),
      jointDarkMat
    );
    shoulderJoint.castShadow = true;
    shoulder.add(shoulderJoint);

    // Sculpted white shoulder armor pad (pauldron)
    const pauldron = new THREE.Mesh(
      trackGeo(new THREE.SphereGeometry(0.108, 22, 18)),
      whiteShellMat
    );
    pauldron.scale.set(1.05, 0.68, 0.94);
    pauldron.position.set(side * 0.035, 0.055, 0);
    pauldron.rotation.z = -side * 0.35;
    pauldron.castShadow = true;
    shoulder.add(pauldron);

    // Sleek dark robotic upper arm (bicep)
    const upperArm = new THREE.Mesh(
      trackGeo(new THREE.CapsuleGeometry(0.052, 0.16, 8, 16)),
      jointDarkMat
    );
    upperArm.position.set(0, -0.135, 0);
    upperArm.castShadow = true;
    shoulder.add(upperArm);

    const elbow = new THREE.Group();
    elbow.position.set(0, -0.255, 0);
    shoulder.add(elbow);

    // Dark mechanical elbow ball
    const elbowJoint = new THREE.Mesh(
      trackGeo(new THREE.SphereGeometry(0.06, 18, 18)),
      jointDarkMat
    );
    elbowJoint.castShadow = true;
    elbow.add(elbowJoint);

    // Flared white forearm armor gauntlet
    const forearm = new THREE.Mesh(
      trackGeo(new THREE.CylinderGeometry(0.062, 0.086, 0.2, 24)),
      whiteShellMat
    );
    forearm.position.set(0, -0.13, 0);
    forearm.castShadow = true;
    forearm.receiveShadow = true;
    elbow.add(forearm);

    // Subtle upper forearm accent notch (blue/purple)
    const forearmAccent = new THREE.Mesh(
      trackGeo(new THREE.TorusGeometry(0.063, 0.012, 10, 24)),
      side === -1 ? royalPurpleMat : electricBlueMat
    );
    forearmAccent.rotation.x = Math.PI / 2;
    forearmAccent.position.set(0, -0.04, 0);
    elbow.add(forearmAccent);

    // Electric-blue wrist cuff
    const wristCuff = new THREE.Mesh(
      trackGeo(new THREE.TorusGeometry(0.083, 0.015, 10, 24)),
      electricBlueMat
    );
    wristCuff.rotation.x = Math.PI / 2;
    wristCuff.position.set(0, -0.228, 0);
    elbow.add(wristCuff);

    // Dark articulated robotic hand + distinct fingers
    const hand = new THREE.Group();
    hand.position.set(0, -0.285, 0);
    elbow.add(hand);

    const palm = new THREE.Mesh(
      trackGeo(new RoundedBoxGeometry(0.105, 0.095, 0.066, 3, 0.03)),
      jointDarkMat
    );
    palm.castShadow = true;
    hand.add(palm);

    // Thumb (dark metallic)
    const thumb = new THREE.Mesh(
      trackGeo(new THREE.CapsuleGeometry(0.018, 0.048, 6, 10)),
      jointDarkMat
    );
    thumb.position.set(-side * 0.058, -0.012, 0.02);
    thumb.rotation.z = side * 0.58;
    hand.add(thumb);

    // Index finger (independent for pointing)
    const indexFingerGroup = new THREE.Group();
    indexFingerGroup.position.set(-side * 0.034, -0.048, 0.012);
    hand.add(indexFingerGroup);

    const indexFinger = new THREE.Mesh(
      trackGeo(new THREE.CapsuleGeometry(0.017, 0.06, 6, 10)),
      jointDarkMat
    );
    indexFinger.position.set(0, -0.036, 0);
    indexFingerGroup.add(indexFinger);

    // Remaining 3 articulated fingers
    const otherFingersGroup = new THREE.Group();
    otherFingersGroup.position.set(0, -0.048, 0);
    hand.add(otherFingersGroup);

    [-0.004, 0.024, 0.048].forEach((offset, idx) => {
      const len = idx === 0 ? 0.064 : idx === 1 ? 0.058 : 0.046;
      const finger = new THREE.Mesh(
        trackGeo(new THREE.CapsuleGeometry(0.016, len, 6, 10)),
        jointDarkMat
      );
      finger.position.set(side * offset, -0.035, 0.004);
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

  // --- ARTICULATED LEGS + KNEECAPS + CHUNKY FUTURISTIC BOOTS ---
  const createLeg = (side: -1 | 1) => {
    const hip = new THREE.Group();
    hip.position.set(side * 0.165, -0.4, 0);
    bodyPivot.add(hip);

    // Dark hip ball joint nested into white pelvis
    const hipJoint = new THREE.Mesh(
      trackGeo(new THREE.SphereGeometry(0.076, 18, 18)),
      jointDarkMat
    );
    hip.add(hipJoint);

    // Sleek dark metallic thigh
    const thigh = new THREE.Mesh(
      trackGeo(new THREE.CapsuleGeometry(0.058, 0.16, 8, 14)),
      jointDarkMat
    );
    thigh.position.set(0, -0.135, 0);
    thigh.castShadow = true;
    hip.add(thigh);

    const knee = new THREE.Group();
    knee.position.set(0, -0.27, 0);
    hip.add(knee);

    // Dark mechanical knee sphere
    const kneeJoint = new THREE.Mesh(
      trackGeo(new THREE.SphereGeometry(0.066, 18, 18)),
      jointDarkMat
    );
    knee.add(kneeJoint);

    // Rounded white kneecap armor pad on front of knee
    const kneecap = new THREE.Mesh(
      trackGeo(new THREE.SphereGeometry(0.072, 18, 16)),
      whiteShellMat
    );
    kneecap.scale.set(0.95, 1.15, 0.62);
    kneecap.position.set(0, 0.01, 0.05);
    kneecap.castShadow = true;
    knee.add(kneecap);

    // Flared white shin / greave armor widening toward boot
    const shin = new THREE.Mesh(
      trackGeo(new THREE.CylinderGeometry(0.072, 0.116, 0.19, 24)),
      whiteShellMat
    );
    shin.position.set(0, -0.135, 0);
    shin.castShadow = true;
    shin.receiveShadow = true;
    knee.add(shin);

    // Dark ankle cuff ring
    const ankleCollar = new THREE.Mesh(
      trackGeo(new THREE.TorusGeometry(0.095, 0.014, 10, 24)),
      jointDarkMat
    );
    ankleCollar.rotation.x = Math.PI / 2;
    ankleCollar.position.set(0, -0.225, 0);
    knee.add(ankleCollar);

    // Chunky sculpted white boot upper + rounded toe
    const bootUpper = new THREE.Mesh(
      trackGeo(new RoundedBoxGeometry(0.205, 0.13, 0.285, 5, 0.055)),
      whiteShellMat
    );
    bootUpper.position.set(0, -0.305, 0.045);
    bootUpper.castShadow = true;
    bootUpper.receiveShadow = true;
    knee.add(bootUpper);

    // Dark metallic instep accent on top of boot
    const bootInstep = new THREE.Mesh(
      trackGeo(new RoundedBoxGeometry(0.115, 0.036, 0.115, 3, 0.016)),
      jointDarkMat
    );
    bootInstep.position.set(0, -0.245, 0.09);
    bootInstep.rotation.x = 0.2;
    knee.add(bootInstep);

    // Side ankle mechanical detail dots
    [-0.01, 0.04].forEach((zOff) => {
      const dot = new THREE.Mesh(
        trackGeo(new THREE.CylinderGeometry(0.018, 0.018, 0.02, 14)),
        jointDarkMat
      );
      dot.rotation.z = Math.PI / 2;
      dot.position.set(side * 0.102, -0.295, zOff);
      knee.add(dot);
    });

    // Electric-blue wrap-around boot sole
    const sole = new THREE.Mesh(
      trackGeo(new RoundedBoxGeometry(0.215, 0.046, 0.302, 4, 0.022)),
      electricBlueMat
    );
    sole.position.set(0, -0.382, 0.048);
    sole.castShadow = true;
    knee.add(sole);

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
