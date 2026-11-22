import * as THREE from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import {
  applyHandPose,
  createArticulatedHand,
} from "@/components/mascot/RobotHandBuilder";

export type FloatingQuestionMark = {
  group: THREE.Group;
  material: THREE.MeshStandardMaterial;
  basePos: THREE.Vector3;
  baseRotZ: number;
  phaseOffset: number;
};

export type LostMascotRig = {
  root: THREE.Group;
  scenePivot: THREE.Group;
  bodyPivot: THREE.Group;
  headPivot: THREE.Group;
  leftEye: THREE.Group;
  rightEye: THREE.Group;
  leftBrow: THREE.Mesh;
  rightBrow: THREE.Mesh;
  mouthGroup: THREE.Group;
  leftEyeMat: THREE.MeshStandardMaterial;
  rightEyeMat: THREE.MeshStandardMaterial;
  mouthMat: THREE.MeshStandardMaterial;
  chestCoreMat: THREE.MeshStandardMaterial;
  leftArmPivot: THREE.Group;
  leftForearmPivot: THREE.Group;
  rightArmPivot: THREE.Group;
  rightForearmPivot: THREE.Group;
  rightHand: THREE.Group;
  mapGroup: THREE.Group;
  signpostGroup: THREE.Group;
  questionMarks: FloatingQuestionMark[];
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

function createMapTexture(maxAnisotropy: number): THREE.CanvasTexture {
  const w = 512;
  const h = 360;
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");

  if (ctx) {
    // Warm cream parchment paper
    ctx.fillStyle = "#fef9ee";
    ctx.fillRect(0, 0, w, h);

    // Subtle map regions
    ctx.fillStyle = "#e0f2fe";
    ctx.beginPath();
    ctx.ellipse(95, 250, 75, 52, -0.3, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "#dcfce7";
    ctx.beginPath();
    ctx.ellipse(390, 95, 85, 58, 0.2, 0, Math.PI * 2);
    ctx.fill();

    // Subtle cartography grid
    ctx.strokeStyle = "rgba(148, 163, 184, 0.28)";
    ctx.lineWidth = 1.5;
    for (let x = 40; x < w; x += 56) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, h);
      ctx.stroke();
    }
    for (let y = 40; y < h; y += 56) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
      ctx.stroke();
    }

    // Fold crease shadows separating the 3 panels
    const foldGrad1 = ctx.createLinearGradient(w / 3 - 10, 0, w / 3 + 10, 0);
    foldGrad1.addColorStop(0, "rgba(15, 23, 42, 0)");
    foldGrad1.addColorStop(0.5, "rgba(15, 23, 42, 0.14)");
    foldGrad1.addColorStop(1, "rgba(15, 23, 42, 0)");
    ctx.fillStyle = foldGrad1;
    ctx.fillRect(w / 3 - 10, 0, 20, h);

    const foldGrad2 = ctx.createLinearGradient(
      (2 * w) / 3 - 10,
      0,
      (2 * w) / 3 + 10,
      0
    );
    foldGrad2.addColorStop(0, "rgba(15, 23, 42, 0)");
    foldGrad2.addColorStop(0.5, "rgba(15, 23, 42, 0.14)");
    foldGrad2.addColorStop(1, "rgba(15, 23, 42, 0)");
    ctx.fillStyle = foldGrad2;
    ctx.fillRect((2 * w) / 3 - 10, 0, 20, h);

    // Loopy confused dashed route going in circles
    ctx.strokeStyle = "#4f46e5";
    ctx.lineWidth = 5;
    ctx.setLineDash([12, 9]);
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(64, 280);
    ctx.bezierCurveTo(135, 190, 210, 285, 248, 175);
    ctx.bezierCurveTo(286, 65, 165, 95, 225, 165);
    ctx.bezierCurveTo(285, 235, 360, 120, 412, 185);
    ctx.stroke();
    ctx.setLineDash([]);

    // Starting dot
    ctx.fillStyle = "#0ea5e9";
    ctx.beginPath();
    ctx.arc(64, 280, 9, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 3;
    ctx.stroke();

    // Red X + 404? marker
    ctx.strokeStyle = "#ef4444";
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.moveTo(400, 172);
    ctx.lineTo(426, 198);
    ctx.moveTo(426, 172);
    ctx.lineTo(400, 198);
    ctx.stroke();

    ctx.fillStyle = "#dc2626";
    ctx.font = "bold 28px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("404?", 413, 154);

    // Compass rose in top-left panel
    ctx.strokeStyle = "#64748b";
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(68, 74, 24, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = "#ef4444";
    ctx.beginPath();
    ctx.moveTo(68, 44);
    ctx.lineTo(75, 74);
    ctx.lineTo(61, 74);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "#334155";
    ctx.beginPath();
    ctx.moveTo(68, 104);
    ctx.lineTo(75, 74);
    ctx.lineTo(61, 74);
    ctx.closePath();
    ctx.fill();
    ctx.font = "bold 16px sans-serif";
    ctx.fillText("?", 68, 38);

    // Subtle paper border frame
    ctx.strokeStyle = "rgba(180, 150, 105, 0.45)";
    ctx.lineWidth = 6;
    ctx.strokeRect(8, 8, w - 16, h - 16);
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = maxAnisotropy;
  return tex;
}

function createSignboardTexture(
  label: string,
  bgHex: string,
  borderHex: string,
  textHex: string,
  maxAnisotropy: number
): THREE.CanvasTexture {
  const w = 320;
  const h = 112;
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");

  if (ctx) {
    ctx.fillStyle = bgHex;
    ctx.fillRect(0, 0, w, h);

    ctx.strokeStyle = borderHex;
    ctx.lineWidth = 8;
    ctx.strokeRect(6, 6, w - 12, h - 12);

    ctx.fillStyle = textHex;
    ctx.font = "900 44px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(label, w / 2, h / 2 + 2);
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = maxAnisotropy;
  return tex;
}

function createQuestionHookShape(): THREE.Shape {
  // Creates a smooth extruded "?" hook glyph centered horizontally around x=0
  const shape = new THREE.Shape();
  shape.moveTo(-0.042, 0.068);
  shape.bezierCurveTo(-0.048, 0.118, 0.048, 0.125, 0.052, 0.072);
  shape.bezierCurveTo(0.054, 0.036, 0.012, 0.025, 0.012, -0.008);
  shape.lineTo(0.012, -0.022);
  shape.lineTo(-0.012, -0.022);
  shape.lineTo(-0.012, -0.004);
  shape.bezierCurveTo(-0.012, 0.036, 0.026, 0.046, 0.024, 0.072);
  shape.bezierCurveTo(0.022, 0.095, -0.02, 0.094, -0.018, 0.068);
  shape.closePath();
  return shape;
}

export function createLostMascot(maxAnisotropy = 4): {
  rig: LostMascotRig;
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

  // --- Shared PBR Materials (matching Mulébi's exact Artigen finish) ---
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

  const mouthMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0x67e8f9,
      emissive: 0x0ea5e9,
      emissiveIntensity: 1.45,
      roughness: 0.15,
    })
  );

  const chestCoreMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0x38bdf8,
      emissive: 0x4f46e5,
      emissiveIntensity: 1.1,
      roughness: 0.18,
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

  const mapTexture = trackTex(createMapTexture(maxAnisotropy));
  const mapPaperFrontMat = trackMat(
    new THREE.MeshStandardMaterial({
      map: mapTexture,
      roughness: 0.82,
      metalness: 0.0,
    })
  );
  const mapPaperBackMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0xf1e8d6,
      roughness: 0.85,
      metalness: 0.0,
    })
  );

  const signpostMetalMat = trackMat(
    new THREE.MeshPhysicalMaterial({
      color: 0x334155,
      roughness: 0.48,
      metalness: 0.45,
      clearcoat: 0.2,
    })
  );

  const sign404Tex = trackTex(
    createSignboardTexture(
      "404 →",
      "#4f46e5",
      "#a5b4fc",
      "#ffffff",
      maxAnisotropy
    )
  );
  const sign404Mat = trackMat(
    new THREE.MeshStandardMaterial({
      map: sign404Tex,
      roughness: 0.38,
      metalness: 0.1,
    })
  );

  const signUnknownTex = trackTex(
    createSignboardTexture(
      "← ???",
      "#f59e0b",
      "#fef3c7",
      "#0f172a",
      maxAnisotropy
    )
  );
  const signUnknownMat = trackMat(
    new THREE.MeshStandardMaterial({
      map: signUnknownTex,
      roughness: 0.38,
      metalness: 0.1,
    })
  );

  // --- Root & Grounded Pivot ---
  const root = new THREE.Group();
  root.name = "MulebiLostMascotRoot";

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
    trackGeo(new THREE.PlaneGeometry(2.55, 1.95)),
    shadowMat
  );
  shadowPlane.rotation.x = -Math.PI / 2;
  shadowPlane.position.set(0.12, 0.002, 0);
  scenePivot.add(shadowPlane);

  const bodyPivot = new THREE.Group();
  bodyPivot.position.set(-0.14, 0, 0);
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

  // --- PELVIS + TORSO + CHEST CORE ---
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
    trackGeo(new THREE.TorusGeometry(0.075, 0.016, 12, 28)),
    jointDarkMat
  );
  chestBezel.position.set(0, 0.81, 0.228);
  bodyPivot.add(chestBezel);

  const chestCore = new THREE.Mesh(
    trackGeo(new THREE.CircleGeometry(0.064, 24)),
    chestCoreMat
  );
  chestCore.position.set(0, 0.81, 0.23);
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

  // --- OVERSIZED HEAD + HEADPHONES + ASYMMETRIC CONFUSED VISOR FACE ---
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

  // Left Eye: Wide dazed spiral-ring eye
  const leftEye = new THREE.Group();
  leftEye.position.set(-0.145, 0.012, 0.468);
  leftEye.rotation.y = -0.15;
  const leftOuterRing = new THREE.Mesh(
    trackGeo(new THREE.TorusGeometry(0.064, 0.015, 14, 28)),
    leftEyeMat
  );
  leftEye.add(leftOuterRing);
  const leftInnerRing = new THREE.Mesh(
    trackGeo(new THREE.TorusGeometry(0.032, 0.012, 12, 22, Math.PI * 1.45)),
    leftEyeMat
  );
  leftInnerRing.rotation.z = 0.5;
  leftEye.add(leftInnerRing);
  const leftPupil = new THREE.Mesh(
    trackGeo(new THREE.SphereGeometry(0.014, 12, 12)),
    leftEyeMat
  );
  leftEye.add(leftPupil);
  headPivot.add(leftEye);

  // Right Eye: Tilted squinted confused arc
  const rightEye = new THREE.Group();
  rightEye.position.set(0.145, 0.02, 0.468);
  rightEye.rotation.y = 0.15;
  rightEye.rotation.z = -0.18;
  const rEyeR = 0.058;
  const rEyeTube = 0.017;
  const rightArc = new THREE.Mesh(
    trackGeo(new THREE.TorusGeometry(rEyeR, rEyeTube, 14, 26, Math.PI)),
    rightEyeMat
  );
  rightEye.add(rightArc);
  const rCapGeo = trackGeo(new THREE.SphereGeometry(rEyeTube, 12, 12));
  const rCapL = new THREE.Mesh(rCapGeo, rightEyeMat);
  rCapL.position.set(-rEyeR, 0, 0);
  rightEye.add(rCapL);
  const rCapR = new THREE.Mesh(rCapGeo, rightEyeMat);
  rCapR.position.set(rEyeR, 0, 0);
  rightEye.add(rCapR);
  headPivot.add(rightEye);

  // Asymmetric worried eyebrows
  const browGeo = trackGeo(new RoundedBoxGeometry(0.11, 0.02, 0.016, 2, 0.008));
  const leftBrow = new THREE.Mesh(browGeo, leftEyeMat);
  leftBrow.position.set(-0.148, 0.115, 0.458);
  leftBrow.rotation.set(-0.08, -0.15, -0.26);
  headPivot.add(leftBrow);

  const rightBrow = new THREE.Mesh(browGeo, rightEyeMat);
  rightBrow.position.set(0.148, 0.105, 0.458);
  rightBrow.rotation.set(-0.08, 0.15, 0.32);
  headPivot.add(rightBrow);

  // Wavy confused mouth ("hmm... onde estou?")
  const mouthGroup = new THREE.Group();
  mouthGroup.position.set(0, -0.09, 0.48);
  const mouthCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-0.068, -0.004, 0),
    new THREE.Vector3(-0.032, 0.014, 0.005),
    new THREE.Vector3(0.0, -0.012, 0.007),
    new THREE.Vector3(0.034, 0.014, 0.005),
    new THREE.Vector3(0.068, -0.005, 0),
  ]);
  const mouthGeo = trackGeo(new THREE.TubeGeometry(mouthCurve, 28, 0.012, 10, false));
  const mouthMesh = new THREE.Mesh(mouthGeo, mouthMat);
  mouthGroup.add(mouthMesh);
  const mouthCapGeo = trackGeo(new THREE.SphereGeometry(0.012, 10, 10));
  const mCapL = new THREE.Mesh(mouthCapGeo, mouthMat);
  mCapL.position.set(-0.068, -0.004, 0);
  mouthGroup.add(mCapL);
  const mCapR = new THREE.Mesh(mouthCapGeo, mouthMat);
  mCapR.position.set(0.068, -0.005, 0);
  mouthGroup.add(mCapR);
  headPivot.add(mouthGroup);

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

  // --- ARTICULATED ARMS ---
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

    const hand = new THREE.Group();
    hand.position.set(0, -0.205, 0.01);
    forearmPivot.add(hand);

    const handRig = createArticulatedHand({
      side,
      scale: 1.0,
      whiteShellMat,
      jointDarkMat,
      trackGeo,
    });
    hand.add(handRig.handGroup);

    return { shoulder, forearmPivot, hand, handRig };
  };

  const leftArm = buildArm(-1);
  const rightArm = buildArm(1);

  // Left arm holds the unfolded 3-panel map forward at reading height
  leftArm.shoulder.rotation.set(-0.75, 0.25, -0.28);
  leftArm.forearmPivot.rotation.set(-0.92, -0.12, 0.35);
  leftArm.handRig.handGroup.rotation.set(0.1, 0.3, -0.15);
  applyHandPose(leftArm.handRig, -1, "grip");

  // Right arm raised up so fingers curl naturally near right temple/headphone scratching head
  rightArm.shoulder.rotation.set(-0.48, 0.22, 2.25);
  rightArm.forearmPivot.rotation.set(-0.22, 0.15, 0.95);
  rightArm.hand.rotation.set(0.25, -0.2, 0.18);
  rightArm.handRig.handGroup.rotation.set(0.15, -0.45, 0);
  applyHandPose(rightArm.handRig, 1, "relaxed");

  // --- UNFOLDED 3-PANEL PAPER MAP HELD IN LEFT HAND ---
  const mapGroup = new THREE.Group();
  mapGroup.position.set(0.12, 0.02, 0.04);
  mapGroup.rotation.set(0.45, 0.28, -0.12);
  leftArm.handRig.gripAnchor.add(mapGroup);

  const panelW = 0.22;
  const panelH = 0.36;
  const panelDepth = 0.008;

  const buildMapPanel = (uStart: number, uEnd: number) => {
    const geo = trackGeo(new THREE.BoxGeometry(panelW, panelH, panelDepth));
    const uvAttr = geo.attributes.uv;
    if (uvAttr) {
      // Face +Z is vertices 16..19 on BoxGeometry
      for (let i = 16; i < 20; i++) {
        const u = uvAttr.getX(i);
        uvAttr.setX(i, THREE.MathUtils.lerp(uStart, uEnd, u));
      }
      uvAttr.needsUpdate = true;
    }
    return new THREE.Mesh(geo, [
      mapPaperBackMat,
      mapPaperBackMat,
      mapPaperBackMat,
      mapPaperBackMat,
      mapPaperFrontMat,
      mapPaperBackMat,
    ]);
  };

  const centerPanel = buildMapPanel(1 / 3, 2 / 3);
  centerPanel.castShadow = true;
  mapGroup.add(centerPanel);

  const leftWing = buildMapPanel(0, 1 / 3);
  leftWing.position.set(-panelW * 0.96, 0, 0.025);
  leftWing.rotation.y = 0.24;
  leftWing.castShadow = true;
  mapGroup.add(leftWing);

  const rightWing = buildMapPanel(2 / 3, 1);
  rightWing.position.set(panelW * 0.96, 0, 0.025);
  rightWing.rotation.y = -0.24;
  rightWing.castShadow = true;
  mapGroup.add(rightWing);

  // --- FLOATING 3D QUESTION MARKS (?) ABOVE HEAD ---
  const questionMarks: FloatingQuestionMark[] = [];
  const hookGeo = trackGeo(
    new THREE.ExtrudeGeometry(createQuestionHookShape(), {
      depth: 0.028,
      bevelEnabled: true,
      bevelThickness: 0.007,
      bevelSize: 0.006,
      bevelSegments: 3,
      curveSegments: 16,
    })
  );
  hookGeo.center();
  const dotGeo = trackGeo(new THREE.SphereGeometry(0.018, 12, 12));

  const qSpecs = [
    {
      pos: new THREE.Vector3(-0.42, 0.68, 0.08),
      rotZ: 0.24,
      scale: 1.05,
      color: 0x38bdf8,
      emissive: 0x0ea5e9,
      phase: 0,
    },
    {
      pos: new THREE.Vector3(0.05, 0.82, -0.05),
      rotZ: -0.08,
      scale: 1.25,
      color: 0xfbbf24,
      emissive: 0xd97706,
      phase: 2.1,
    },
    {
      pos: new THREE.Vector3(0.46, 0.64, 0.12),
      rotZ: -0.28,
      scale: 0.95,
      color: 0xa78bfa,
      emissive: 0x6366f1,
      phase: 4.2,
    },
  ];

  qSpecs.forEach((spec) => {
    const qGroup = new THREE.Group();
    qGroup.position.copy(spec.pos);
    qGroup.rotation.z = spec.rotZ;
    qGroup.scale.setScalar(spec.scale);

    const mat = trackMat(
      new THREE.MeshStandardMaterial({
        color: spec.color,
        emissive: spec.emissive,
        emissiveIntensity: 1.15,
        roughness: 0.22,
        metalness: 0.1,
      })
    );

    const hookMesh = new THREE.Mesh(hookGeo, mat);
    hookMesh.position.set(0, 0.04, 0);
    qGroup.add(hookMesh);

    const dotMesh = new THREE.Mesh(dotGeo, mat);
    dotMesh.position.set(0, -0.058, 0);
    qGroup.add(dotMesh);

    headPivot.add(qGroup);
    questionMarks.push({
      group: qGroup,
      material: mat,
      basePos: spec.pos.clone(),
      baseRotZ: spec.rotZ,
      phaseOffset: spec.phase,
    });
  });

  // --- CROOKED "404 / ???" CROSSROADS SIGNPOST GROUNDED NEXT TO MULÉBI ---
  const signpostGroup = new THREE.Group();
  signpostGroup.position.set(0.74, 0, -0.14);
  signpostGroup.rotation.set(0.02, -0.28, -0.055);
  scenePivot.add(signpostGroup);

  const baseCollar = new THREE.Mesh(
    trackGeo(new THREE.CylinderGeometry(0.068, 0.092, 0.055, 20)),
    jointDarkMat
  );
  baseCollar.position.set(0, 0.028, 0);
  baseCollar.castShadow = true;
  signpostGroup.add(baseCollar);

  const postPole = new THREE.Mesh(
    trackGeo(new THREE.CylinderGeometry(0.036, 0.044, 1.38, 18)),
    signpostMetalMat
  );
  postPole.position.set(0, 0.69, 0);
  postPole.castShadow = true;
  signpostGroup.add(postPole);

  const postFinial = new THREE.Mesh(
    trackGeo(new THREE.SphereGeometry(0.05, 16, 14)),
    sneakerBlueMat
  );
  postFinial.position.set(0, 1.4, 0);
  signpostGroup.add(postFinial);

  const buildArrowSign = (
    dir: -1 | 1,
    y: number,
    rotZ: number,
    rotY: number,
    mat: THREE.MeshStandardMaterial
  ) => {
    const signBoard = new THREE.Group();
    signBoard.position.set(dir * 0.08, y, 0.032);
    signBoard.rotation.set(0, rotY, rotZ);

    const plank = new THREE.Mesh(
      trackGeo(new RoundedBoxGeometry(0.56, 0.19, 0.036, 2, 0.01)),
      signpostMetalMat
    );
    plank.castShadow = true;
    signBoard.add(plank);

    const facePlate = new THREE.Mesh(
      trackGeo(new THREE.PlaneGeometry(0.52, 0.165)),
      mat
    );
    facePlate.position.set(0, 0, 0.02);
    signBoard.add(facePlate);

    const pointerHead = new THREE.Mesh(
      trackGeo(new THREE.ConeGeometry(0.115, 0.16, 4)),
      mat
    );
    pointerHead.rotation.z = dir > 0 ? -Math.PI / 2 : Math.PI / 2;
    pointerHead.rotation.x = Math.PI / 4;
    pointerHead.scale.set(0.95, 1, 0.28);
    pointerHead.position.set(dir * 0.34, 0, 0);
    pointerHead.castShadow = true;
    signBoard.add(pointerHead);

    signpostGroup.add(signBoard);
  };

  buildArrowSign(1, 1.18, 0.09, -0.08, sign404Mat);
  buildArrowSign(-1, 0.92, -0.11, 0.12, signUnknownMat);

  const rig: LostMascotRig = {
    root,
    scenePivot,
    bodyPivot,
    headPivot,
    leftEye,
    rightEye,
    leftBrow,
    rightBrow,
    mouthGroup,
    leftEyeMat,
    rightEyeMat,
    mouthMat,
    chestCoreMat,
    leftArmPivot: leftArm.shoulder,
    leftForearmPivot: leftArm.forearmPivot,
    rightArmPivot: rightArm.shoulder,
    rightForearmPivot: rightArm.forearmPivot,
    rightHand: rightArm.hand,
    mapGroup,
    signpostGroup,
    questionMarks,
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
