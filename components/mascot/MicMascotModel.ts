import * as THREE from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import {
  applyHandPose,
  createArticulatedHand,
  type ArticulatedHandRig,
} from "@/components/mascot/RobotHandBuilder";

export type WaveRingItem = {
  group: THREE.Group;
  material: THREE.MeshStandardMaterial;
  baseX: number;
  dirX: number; // -1 left, +1 right, 0 radial
};

export type MicMascotRig = {
  root: THREE.Group;
  scenePivot: THREE.Group;
  bodyPivot: THREE.Group;
  headPivot: THREE.Group;
  leftEye: THREE.Group;
  rightEye: THREE.Group;
  leftEyeMat: THREE.MeshStandardMaterial;
  rightEyeMat: THREE.MeshStandardMaterial;
  smileArc: THREE.Group;
  smileMat: THREE.MeshStandardMaterial;
  chestCoreMat: THREE.MeshStandardMaterial;
  leftArmPivot: THREE.Group;
  leftForearmPivot: THREE.Group;
  leftHandRig: ArticulatedHandRig;
  rightArmPivot: THREE.Group;
  rightForearmPivot: THREE.Group;
  rightHandRig: ArticulatedHandRig;
  micGroup: THREE.Group;
  micLedMat: THREE.MeshStandardMaterial;
  sideWaves: WaveRingItem[];
  floorRingMat: THREE.MeshStandardMaterial;
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
      size * 0.08,
      size / 2,
      size / 2,
      size * 0.48
    );
    grad.addColorStop(0, "rgba(49, 46, 129, 0.34)");
    grad.addColorStop(0.55, "rgba(79, 70, 229, 0.14)");
    grad.addColorStop(1, "rgba(49, 46, 129, 0)");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, size, size);
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function createMicFoamTexture(maxAnisotropy: number): THREE.CanvasTexture {
  const size = 256;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (ctx) {
    ctx.fillStyle = "#1e2433";
    ctx.fillRect(0, 0, size, size);
    // Deterministic fine acoustic foam micro-pore grain
    let seed = 1337;
    const rand = () => {
      seed = (seed * 16807) % 2147483647;
      return (seed - 1) / 2147483646;
    };
    for (let i = 0; i < 2400; i++) {
      const x = rand() * size;
      const y = rand() * size;
      const r = 0.8 + rand() * 1.4;
      ctx.fillStyle =
        rand() > 0.48 ? "rgba(15, 23, 42, 0.65)" : "rgba(148, 163, 184, 0.14)";
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(3, 3);
  tex.anisotropy = maxAnisotropy;
  return tex;
}

function createChestMicIconTexture(maxAnisotropy: number): THREE.CanvasTexture {
  const size = 256;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (ctx) {
    // Deep indigo-blue illuminated badge background
    const grad = ctx.createRadialGradient(128, 128, 14, 128, 128, 124);
    grad.addColorStop(0, "#1d4ed8");
    grad.addColorStop(0.65, "#1e1b4b");
    grad.addColorStop(1, "#0f172a");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, size, size);

    // Crisp glowing cyan microphone glyph in center
    ctx.strokeStyle = "#67e8f9";
    ctx.fillStyle = "#67e8f9";
    ctx.lineWidth = 14;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    // Mic capsule
    ctx.beginPath();
    ctx.roundRect(102, 54, 52, 82, 26);
    ctx.fill();

    // U-cradle arc
    ctx.beginPath();
    ctx.arc(128, 114, 46, 0.15, Math.PI - 0.15);
    ctx.stroke();

    // Stand stem & base
    ctx.beginPath();
    ctx.moveTo(128, 160);
    ctx.lineTo(128, 194);
    ctx.moveTo(98, 194);
    ctx.lineTo(158, 194);
    ctx.stroke();
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = maxAnisotropy;
  return tex;
}

export function createMicMascot(maxAnisotropy = 4): {
  rig: MicMascotRig;
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
  const trackTex = <T extends THREE.Texture>(t: T): T => {
    textures.push(t);
    return t;
  };

  // --- Shared PBR Materials ---
  const whiteShellMat = trackMat(
    new THREE.MeshPhysicalMaterial({
      color: 0xf8fafc,
      roughness: 0.16,
      metalness: 0.02,
      clearcoat: 0.94,
      clearcoatRoughness: 0.08,
      envMapIntensity: 0.72,
      ior: 1.48,
    })
  );

  const jointDarkMat = trackMat(
    new THREE.MeshPhysicalMaterial({
      color: 0x111827,
      roughness: 0.36,
      metalness: 0.34,
      clearcoat: 0.4,
      clearcoatRoughness: 0.2,
      envMapIntensity: 0.58,
    })
  );

  const visorMat = trackMat(
    new THREE.MeshPhysicalMaterial({
      color: 0x050914,
      roughness: 0.06,
      metalness: 0.05,
      clearcoat: 1.0,
      clearcoatRoughness: 0.04,
      envMapIntensity: 0.48,
      reflectivity: 0.85,
    })
  );

  const headphoneCupMat = trackMat(
    new THREE.MeshPhysicalMaterial({
      color: 0x6366f1,
      roughness: 0.22,
      metalness: 0.14,
      clearcoat: 0.84,
      clearcoatRoughness: 0.12,
      envMapIntensity: 0.65,
    })
  );

  const headphoneAccentMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0x38bdf8,
      emissive: 0x6366f1,
      emissiveIntensity: 1.15,
      roughness: 0.2,
    })
  );

  const headbandTrimMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0x7c3aed,
      emissive: 0x4f46e5,
      emissiveIntensity: 0.65,
      roughness: 0.25,
    })
  );

  const leftEyeMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0x67e8f9,
      emissive: 0x0ea5e9,
      emissiveIntensity: 1.55,
      roughness: 0.15,
    })
  );

  const rightEyeMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0x67e8f9,
      emissive: 0x0ea5e9,
      emissiveIntensity: 1.55,
      roughness: 0.15,
    })
  );

  const smileMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0x67e8f9,
      emissive: 0x0ea5e9,
      emissiveIntensity: 1.45,
      roughness: 0.15,
    })
  );

  const chestTex = trackTex(createChestMicIconTexture(maxAnisotropy));
  const chestCoreMat = trackMat(
    new THREE.MeshStandardMaterial({
      map: chestTex,
      emissiveMap: chestTex,
      emissive: 0x38bdf8,
      emissiveIntensity: 1.1,
      roughness: 0.18,
    })
  );

  const chestRimMat = trackMat(
    new THREE.MeshPhysicalMaterial({
      color: 0x6366f1,
      roughness: 0.22,
      metalness: 0.18,
      clearcoat: 0.8,
    })
  );

  const sneakerBlueMat = trackMat(
    new THREE.MeshPhysicalMaterial({
      color: 0x4f46e5,
      roughness: 0.28,
      metalness: 0.08,
      clearcoat: 0.65,
      clearcoatRoughness: 0.16,
    })
  );

  const micHandleMat = trackMat(
    new THREE.MeshPhysicalMaterial({
      color: 0x111827,
      roughness: 0.36,
      metalness: 0.35,
      clearcoat: 0.38,
      clearcoatRoughness: 0.22,
    })
  );

  const micMetalMat = trackMat(
    new THREE.MeshPhysicalMaterial({
      color: 0xcbd5e1,
      roughness: 0.22,
      metalness: 0.86,
      clearcoat: 0.4,
      envMapIntensity: 0.95,
    })
  );

  const micFoamTex = trackTex(createMicFoamTexture(maxAnisotropy));
  const micFoamMat = trackMat(
    new THREE.MeshStandardMaterial({
      map: micFoamTex,
      color: 0x2a3142,
      roughness: 0.88,
      metalness: 0.02,
    })
  );

  const micLedMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0x38bdf8,
      emissive: 0x0ea5e9,
      emissiveIntensity: 1.45,
      roughness: 0.15,
    })
  );

  // --- Root & Grounded Pivot ---
  const root = new THREE.Group();
  root.name = "MulebiMicMascotRoot";

  const scenePivot = new THREE.Group();
  scenePivot.position.set(0, -1.04, 0);
  root.add(scenePivot);

  const shadowTex = trackTex(createContactShadowTexture());
  const shadowMat = trackMat(
    new THREE.MeshBasicMaterial({
      map: shadowTex,
      transparent: true,
      depthWrite: false,
      opacity: 0.65,
    })
  );
  const shadowPlane = new THREE.Mesh(
    trackGeo(new THREE.PlaneGeometry(2.2, 1.85)),
    shadowMat
  );
  shadowPlane.rotation.x = -Math.PI / 2;
  shadowPlane.position.set(0, 0.002, 0);
  scenePivot.add(shadowPlane);

  // Subtle glowing floor halo ring matching reference platform
  const floorRingMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0x818cf8,
      emissive: 0x4f46e5,
      emissiveIntensity: 0.85,
      transparent: true,
      opacity: 0.42,
      roughness: 0.25,
    })
  );
  const floorRing = new THREE.Mesh(
    trackGeo(new THREE.TorusGeometry(0.68, 0.008, 10, 64)),
    floorRingMat
  );
  floorRing.rotation.x = Math.PI / 2;
  floorRing.position.set(0, 0.006, 0.02);
  scenePivot.add(floorRing);

  const bodyPivot = new THREE.Group();
  scenePivot.add(bodyPivot);

  // --- STANDING LEGS & SNEAKERS ---
  const buildStandingLeg = (side: -1 | 1) => {
    const legGroup = new THREE.Group();
    legGroup.position.set(side * 0.175, 0.44, 0);
    bodyPivot.add(legGroup);

    const hip = new THREE.Mesh(
      trackGeo(new THREE.SphereGeometry(0.068, 16, 16)),
      jointDarkMat
    );
    legGroup.add(hip);

    const thigh = new THREE.Mesh(
      trackGeo(new THREE.CapsuleGeometry(0.068, 0.14, 8, 14)),
      whiteShellMat
    );
    thigh.position.set(0, -0.1, 0);
    thigh.castShadow = true;
    legGroup.add(thigh);

    const knee = new THREE.Mesh(
      trackGeo(new THREE.SphereGeometry(0.062, 16, 16)),
      jointDarkMat
    );
    knee.position.set(0, -0.2, 0);
    legGroup.add(knee);

    const shin = new THREE.Mesh(
      trackGeo(new THREE.CylinderGeometry(0.064, 0.08, 0.14, 18)),
      whiteShellMat
    );
    shin.position.set(0, -0.3, 0);
    shin.castShadow = true;
    legGroup.add(shin);

    const shoeUpper = new THREE.Mesh(
      trackGeo(new RoundedBoxGeometry(0.17, 0.105, 0.245, 4, 0.048)),
      whiteShellMat
    );
    shoeUpper.position.set(0, -0.385, 0.035);
    shoeUpper.castShadow = true;
    legGroup.add(shoeUpper);

    const shoeSole = new THREE.Mesh(
      trackGeo(new RoundedBoxGeometry(0.184, 0.042, 0.26, 4, 0.02)),
      sneakerBlueMat
    );
    shoeSole.position.set(0, -0.435, 0.035);
    shoeSole.castShadow = true;
    legGroup.add(shoeSole);

    const shoeCollar = new THREE.Mesh(
      trackGeo(new THREE.TorusGeometry(0.07, 0.015, 10, 20)),
      sneakerBlueMat
    );
    shoeCollar.rotation.x = Math.PI / 2;
    shoeCollar.position.set(0, -0.335, 0);
    legGroup.add(shoeCollar);
  };

  buildStandingLeg(-1);
  buildStandingLeg(1);

  // --- PELVIS + TORSO + CHEST MICROPHONE BADGE ---
  const pelvis = new THREE.Mesh(
    trackGeo(new THREE.SphereGeometry(0.22, 28, 22)),
    whiteShellMat
  );
  pelvis.scale.set(1.06, 0.62, 0.88);
  pelvis.position.set(0, 0.48, 0);
  pelvis.castShadow = true;
  pelvis.receiveShadow = true;
  bodyPivot.add(pelvis);

  const waistRing = new THREE.Mesh(
    trackGeo(new THREE.CylinderGeometry(0.16, 0.175, 0.11, 24)),
    jointDarkMat
  );
  waistRing.position.set(0, 0.59, 0);
  bodyPivot.add(waistRing);

  const torso = new THREE.Mesh(
    trackGeo(new THREE.SphereGeometry(0.278, 34, 28)),
    whiteShellMat
  );
  torso.scale.set(1.05, 0.92, 0.84);
  torso.position.set(0, 0.8, 0);
  torso.castShadow = true;
  torso.receiveShadow = true;
  bodyPivot.add(torso);

  const chestBezel = new THREE.Mesh(
    trackGeo(new THREE.TorusGeometry(0.088, 0.017, 14, 32)),
    chestRimMat
  );
  chestBezel.position.set(0, 0.81, 0.228);
  bodyPivot.add(chestBezel);

  const chestCore = new THREE.Mesh(
    trackGeo(new THREE.CircleGeometry(0.076, 28)),
    chestCoreMat
  );
  chestCore.position.set(0, 0.81, 0.232);
  bodyPivot.add(chestCore);

  const collar = new THREE.Mesh(
    trackGeo(new THREE.TorusGeometry(0.15, 0.022, 12, 32)),
    jointDarkMat
  );
  collar.rotation.x = Math.PI / 2;
  collar.position.set(0, 1.02, 0);
  bodyPivot.add(collar);

  const neck = new THREE.Mesh(
    trackGeo(new THREE.CylinderGeometry(0.108, 0.125, 0.12, 22)),
    jointDarkMat
  );
  neck.position.set(0, 1.06, 0);
  bodyPivot.add(neck);

  // --- OVERSIZED HEAD + HEADPHONES + VISOR ---
  const headPivot = new THREE.Group();
  headPivot.position.set(0, 1.46, 0.01);
  bodyPivot.add(headPivot);

  const headShell = new THREE.Mesh(
    trackGeo(new THREE.SphereGeometry(0.49, 44, 38)),
    whiteShellMat
  );
  headShell.scale.set(1.16, 0.94, 0.94);
  headShell.castShadow = true;
  headShell.receiveShadow = true;
  headPivot.add(headShell);

  const visor = new THREE.Mesh(
    trackGeo(new THREE.SphereGeometry(0.42, 40, 32)),
    visorMat
  );
  visor.scale.set(0.96, 0.67, 0.48);
  visor.position.set(0, -0.02, 0.27);
  headPivot.add(visor);

  const buildHappyEye = (
    x: number,
    mat: THREE.MeshStandardMaterial
  ): THREE.Group => {
    const g = new THREE.Group();
    g.position.set(x, 0.018, 0.468);
    g.rotation.y = x < 0 ? -0.15 : 0.15;

    const r = 0.066;
    const tube = 0.019;
    const arc = new THREE.Mesh(
      trackGeo(new THREE.TorusGeometry(r, tube, 14, 28, Math.PI)),
      mat
    );
    g.add(arc);

    const capGeo = trackGeo(new THREE.SphereGeometry(tube, 12, 12));
    const capL = new THREE.Mesh(capGeo, mat);
    capL.position.set(-r, 0, 0);
    g.add(capL);

    const capR = new THREE.Mesh(capGeo, mat);
    capR.position.set(r, 0, 0);
    g.add(capR);

    headPivot.add(g);
    return g;
  };

  const leftEye = buildHappyEye(-0.145, leftEyeMat);
  const rightEye = buildHappyEye(0.145, rightEyeMat);

  const smileArc = new THREE.Group();
  smileArc.position.set(0, -0.075, 0.484);
  smileArc.rotation.x = 0.14;
  const smileR = 0.048;
  const smileTube = 0.014;
  const smileMesh = new THREE.Mesh(
    trackGeo(new THREE.TorusGeometry(smileR, smileTube, 12, 24, Math.PI)),
    smileMat
  );
  smileMesh.rotation.z = Math.PI;
  smileArc.add(smileMesh);
  const smileCapGeo = trackGeo(new THREE.SphereGeometry(smileTube, 10, 10));
  const smileCapL = new THREE.Mesh(smileCapGeo, smileMat);
  smileCapL.position.set(-smileR, 0, 0);
  smileArc.add(smileCapL);
  const smileCapR = new THREE.Mesh(smileCapGeo, smileMat);
  smileCapR.position.set(smileR, 0, 0);
  smileArc.add(smileCapR);
  headPivot.add(smileArc);

  // Headphones
  const headbandOuter = new THREE.Mesh(
    trackGeo(new THREE.TorusGeometry(0.555, 0.042, 16, 48, Math.PI)),
    whiteShellMat
  );
  headbandOuter.position.set(0, 0.02, -0.01);
  headbandOuter.scale.set(1.04, 0.96, 1.15);
  headbandOuter.castShadow = true;
  headPivot.add(headbandOuter);

  const headbandInner = new THREE.Mesh(
    trackGeo(new THREE.TorusGeometry(0.525, 0.024, 12, 44, Math.PI)),
    headbandTrimMat
  );
  headbandInner.position.set(0, 0.02, -0.01);
  headbandInner.scale.set(1.04, 0.96, 1.0);
  headPivot.add(headbandInner);

  [-1, 1].forEach((side) => {
    const ear = new THREE.Group();
    ear.position.set(side * 0.565, -0.02, -0.01);
    headPivot.add(ear);

    const cushion = new THREE.Mesh(
      trackGeo(new THREE.CylinderGeometry(0.155, 0.155, 0.07, 26)),
      jointDarkMat
    );
    cushion.rotation.z = Math.PI / 2;
    ear.add(cushion);

    const cupShell = new THREE.Mesh(
      trackGeo(new THREE.SphereGeometry(0.175, 28, 22)),
      headphoneCupMat
    );
    cupShell.scale.set(0.56, 1.04, 0.98);
    cupShell.position.set(side * 0.03, 0, 0);
    cupShell.castShadow = true;
    ear.add(cupShell);

    const glowRing = new THREE.Mesh(
      trackGeo(new THREE.TorusGeometry(0.115, 0.018, 14, 30)),
      headphoneAccentMat
    );
    glowRing.rotation.y = Math.PI / 2;
    glowRing.position.set(side * 0.095, 0, 0);
    ear.add(glowRing);

    const centerCap = new THREE.Mesh(
      trackGeo(new THREE.CylinderGeometry(0.072, 0.072, 0.028, 22)),
      headphoneCupMat
    );
    centerCap.rotation.z = Math.PI / 2;
    centerCap.position.set(side * 0.105, 0, 0);
    ear.add(centerCap);

    const hinge = new THREE.Mesh(
      trackGeo(new RoundedBoxGeometry(0.045, 0.08, 0.055, 2, 0.015)),
      whiteShellMat
    );
    hinge.position.set(side * 0.015, 0.15, 0);
    ear.add(hinge);
  });

  // --- ARTICULATED ARMS WITH SCULPTED WHITE-SHELL HANDS ---
  const buildArm = (side: -1 | 1) => {
    const shoulder = new THREE.Group();
    shoulder.position.set(side * 0.315, 0.89, 0.02);
    bodyPivot.add(shoulder);

    const shoulderJoint = new THREE.Mesh(
      trackGeo(new THREE.SphereGeometry(0.068, 18, 18)),
      jointDarkMat
    );
    shoulder.add(shoulderJoint);

    const upperArm = new THREE.Mesh(
      trackGeo(new THREE.CapsuleGeometry(0.056, 0.16, 8, 14)),
      whiteShellMat
    );
    upperArm.position.set(0, -0.11, 0);
    upperArm.castShadow = true;
    shoulder.add(upperArm);

    const forearmPivot = new THREE.Group();
    forearmPivot.position.set(0, -0.22, 0);
    shoulder.add(forearmPivot);

    const elbowJoint = new THREE.Mesh(
      trackGeo(new THREE.SphereGeometry(0.052, 16, 16)),
      jointDarkMat
    );
    forearmPivot.add(elbowJoint);

    const forearm = new THREE.Mesh(
      trackGeo(new THREE.CylinderGeometry(0.054, 0.064, 0.18, 18)),
      whiteShellMat
    );
    forearm.position.set(0, -0.1, 0);
    forearm.castShadow = true;
    forearmPivot.add(forearm);

    const wristRing = new THREE.Mesh(
      trackGeo(new THREE.TorusGeometry(0.056, 0.012, 10, 20)),
      jointDarkMat
    );
    wristRing.rotation.x = Math.PI / 2;
    wristRing.position.set(0, -0.185, 0);
    forearmPivot.add(wristRing);

    const handRig = createArticulatedHand({
      side,
      scale: 1.05,
      whiteShellMat,
      jointDarkMat,
      trackGeo,
    });
    handRig.handGroup.position.set(0, -0.205, 0.006);
    forearmPivot.add(handRig.handGroup);

    return { shoulder, forearmPivot, handRig };
  };

  // Viewer's LEFT arm (side = -1): bends inward in front of chest gripping the mic upright!
  const leftArm = buildArm(-1);
  // Viewer's RIGHT arm (side = +1): extends outward with friendly open welcoming palm!
  const rightArm = buildArm(1);

  // Exact ergonomic grip pose matching reference photo
  leftArm.shoulder.rotation.set(-0.38, 0.14, -0.26);
  leftArm.forearmPivot.rotation.set(-1.72, 0.88, 0.0);
  leftArm.handRig.handGroup.rotation.set(0.14, 1.48, -0.22);
  applyHandPose(leftArm.handRig, -1, "grip");

  // Exact open welcoming palm pose on viewer's right matching reference photo
  rightArm.shoulder.rotation.set(-0.22, -0.1, 0.52);
  rightArm.forearmPivot.rotation.set(-0.98, -0.16, 0.34);
  rightArm.handRig.handGroup.rotation.set(-0.28, 0.28, 0.42);
  applyHandPose(rightArm.handRig, 1, "open");

  // --- DETAILED STUDIO HANDHELD MICROPHONE GRIPPED SNUGLY BY LEFT-SIDE HAND ---
  const micGroup = new THREE.Group();
  // Oriented inside gripAnchor so handle sits along hand's X axis and foam head points toward thumb/index (-X -> World +Y)
  micGroup.position.set(-0.015, 0.008, -0.016);
  micGroup.rotation.set(0, -0.12, Math.PI / 2);
  leftArm.handRig.gripAnchor.add(micGroup);

  const micHandle = new THREE.Mesh(
    trackGeo(new THREE.CylinderGeometry(0.036, 0.026, 0.33, 24)),
    micHandleMat
  );
  micHandle.position.set(0, 0.0, 0);
  micHandle.castShadow = true;
  micGroup.add(micHandle);

  const micBottomRim = new THREE.Mesh(
    trackGeo(new THREE.CylinderGeometry(0.028, 0.022, 0.028, 20)),
    micMetalMat
  );
  micBottomRim.position.set(0, -0.172, 0);
  micGroup.add(micBottomRim);

  // Glowing cyan LED ring & silver collar ring right under the foam capsule
  const micLedRing = new THREE.Mesh(
    trackGeo(new THREE.CylinderGeometry(0.044, 0.041, 0.026, 28)),
    micLedMat
  );
  micLedRing.position.set(0, 0.168, 0);
  micGroup.add(micLedRing);

  const micCollar = new THREE.Mesh(
    trackGeo(new THREE.CylinderGeometry(0.056, 0.044, 0.034, 26)),
    micMetalMat
  );
  micCollar.position.set(0, 0.194, 0);
  micGroup.add(micCollar);

  // Matte dark-charcoal elongated acoustic foam windscreen head (exact match to photo!)
  const micFoamHead = new THREE.Mesh(
    trackGeo(new THREE.CapsuleGeometry(0.088, 0.115, 16, 28)),
    micFoamMat
  );
  micFoamHead.position.set(0, 0.305, 0);
  micFoamHead.castShadow = true;
  micGroup.add(micFoamHead);

  // --- CURVED BLUE ACOUSTIC SOUND WAVE ARCS FLANKING MULÉBI (LEFT & RIGHT) ---
  const sideWaves: WaveRingItem[] = [];
  const arcConfigs = [
    { radius: 0.16, tube: 0.015, span: Math.PI * 0.56, offset: 0.0 },
    { radius: 0.25, tube: 0.013, span: Math.PI * 0.62, offset: 0.05 },
    { radius: 0.34, tube: 0.011, span: Math.PI * 0.68, offset: 0.1 },
  ];

  [-1, 1].forEach((dirX) => {
    const baseX = dirX * 0.56;
    arcConfigs.forEach((cfg) => {
      const waveGroup = new THREE.Group();
      waveGroup.position.set(baseX + dirX * cfg.offset, 0.94, 0.02);

      const mat = trackMat(
        new THREE.MeshStandardMaterial({
          color: 0x38bdf8,
          emissive: 0x0ea5e9,
          emissiveIntensity: 1.45,
          transparent: true,
          opacity: 0.85,
          roughness: 0.2,
          depthWrite: false,
        })
      );

      const arc = new THREE.Mesh(
        trackGeo(new THREE.TorusGeometry(cfg.radius, cfg.tube, 12, 32, cfg.span)),
        mat
      );
      // Center arc outward to left (-X) or right (+X)
      arc.rotation.z =
        dirX < 0 ? Math.PI - cfg.span / 2 : -cfg.span / 2;
      waveGroup.add(arc);

      // Rounded spherical endcaps for crisp graphic look matching the image
      const capGeo = trackGeo(new THREE.SphereGeometry(cfg.tube, 10, 10));
      const a0 = arc.rotation.z;
      const a1 = arc.rotation.z + cfg.span;
      const cap0 = new THREE.Mesh(capGeo, mat);
      cap0.position.set(
        Math.cos(a0) * cfg.radius,
        Math.sin(a0) * cfg.radius,
        0
      );
      waveGroup.add(cap0);
      const cap1 = new THREE.Mesh(capGeo, mat);
      cap1.position.set(
        Math.cos(a1) * cfg.radius,
        Math.sin(a1) * cfg.radius,
        0
      );
      waveGroup.add(cap1);

      scenePivot.add(waveGroup);
      sideWaves.push({
        group: waveGroup,
        material: mat,
        baseX,
        dirX,
      });
    });
  });

  const rig: MicMascotRig = {
    root,
    scenePivot,
    bodyPivot,
    headPivot,
    leftEye,
    rightEye,
    leftEyeMat,
    rightEyeMat,
    smileArc,
    smileMat,
    chestCoreMat,
    leftArmPivot: leftArm.shoulder,
    leftForearmPivot: leftArm.forearmPivot,
    leftHandRig: leftArm.handRig,
    rightArmPivot: rightArm.shoulder,
    rightForearmPivot: rightArm.forearmPivot,
    rightHandRig: rightArm.handRig,
    micGroup,
    micLedMat,
    sideWaves,
    floorRingMat,
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
