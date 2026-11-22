import * as THREE from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import {
  applyHandPose,
  createArticulatedHand,
} from "@/components/mascot/RobotHandBuilder";

export type WritingMascotRig = {
  root: THREE.Group;
  scenePivot: THREE.Group;
  robotGroup: THREE.Group;
  bodyPivot: THREE.Group;
  headPivot: THREE.Group;
  leftEye: THREE.Group;
  rightEye: THREE.Group;
  leftEyeMat: THREE.MeshStandardMaterial;
  rightEyeMat: THREE.MeshStandardMaterial;
  smileArc: THREE.Group;
  leftArmPivot: THREE.Group;
  leftForearmPivot: THREE.Group;
  leftHand: THREE.Group;
  rightArmPivot: THREE.Group;
  rightForearmPivot: THREE.Group;
  rightHand: THREE.Group;
  lightbulbGroup: THREE.Group;
  bulbGlassMat: THREE.MeshStandardMaterial;
  bulbRayMats: THREE.MeshStandardMaterial[];
  screenGlowMat: THREE.MeshStandardMaterial;
  screenLight: THREE.PointLight;
  shadowPlane: THREE.Mesh;
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
    grad.addColorStop(0, "rgba(49, 46, 129, 0.36)");
    grad.addColorStop(0.55, "rgba(67, 56, 202, 0.14)");
    grad.addColorStop(1, "rgba(49, 46, 129, 0)");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, size, size);
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function createBookPagesTexture(): THREE.CanvasTexture {
  const w = 256;
  const h = 128;
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (ctx) {
    ctx.fillStyle = "#f1f5f9";
    ctx.fillRect(0, 0, w, h);
    for (let y = 0; y < h; y += 6) {
      ctx.fillStyle = y % 12 === 0 ? "#cbd5e1" : "#e2e8f0";
      ctx.fillRect(0, y, w, 2);
    }
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function createLaptopLogoTexture(maxAnisotropy: number): THREE.CanvasTexture {
  const size = 512;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (ctx) {
    ctx.clearRect(0, 0, size, size);

    // Subtle radial bloom behind the A emblem
    const glow = ctx.createRadialGradient(
      size * 0.5,
      size * 0.52,
      16,
      size * 0.5,
      size * 0.52,
      200
    );
    glow.addColorStop(0, "rgba(124, 58, 237, 0.42)");
    glow.addColorStop(0.55, "rgba(56, 189, 248, 0.18)");
    glow.addColorStop(1, "rgba(56, 189, 248, 0)");
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, size, size);

    const grad = ctx.createLinearGradient(120, 90, 390, 410);
    grad.addColorStop(0, "#7c3aed");
    grad.addColorStop(0.52, "#4f46e5");
    grad.addColorStop(1, "#38bdf8");

    ctx.fillStyle = grad;
    ctx.strokeStyle = "#a78bfa";
    ctx.lineWidth = 6;
    ctx.lineJoin = "round";
    ctx.lineCap = "round";

    // Stylized sleek geometric "A" matching Artigen branding
    ctx.beginPath();
    ctx.moveTo(256, 92);
    ctx.lineTo(394, 412);
    ctx.lineTo(332, 412);
    ctx.lineTo(302, 336);
    ctx.lineTo(210, 336);
    ctx.lineTo(180, 412);
    ctx.lineTo(118, 412);
    ctx.closePath();

    // Inner triangular cutout
    ctx.moveTo(256, 188);
    ctx.lineTo(226, 282);
    ctx.lineTo(286, 282);
    ctx.closePath();

    ctx.fill("evenodd");
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = maxAnisotropy;
  return tex;
}

export function createWritingMascot(maxAnisotropy = 4): {
  rig: WritingMascotRig;
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

  // --- Shared Materials ---
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
      roughness: 0.34,
      metalness: 0.36,
      clearcoat: 0.42,
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
      roughness: 0.2,
      metalness: 0.12,
      clearcoat: 0.85,
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

  const sneakerBlueMat = trackMat(
    new THREE.MeshPhysicalMaterial({
      color: 0x4f46e5,
      roughness: 0.26,
      metalness: 0.08,
      clearcoat: 0.65,
      clearcoatRoughness: 0.16,
    })
  );

  const purpleBookMat = trackMat(
    new THREE.MeshPhysicalMaterial({
      color: 0x6d28d9,
      roughness: 0.34,
      metalness: 0.05,
      clearcoat: 0.38,
      clearcoatRoughness: 0.24,
    })
  );

  const blueBookMat = trackMat(
    new THREE.MeshPhysicalMaterial({
      color: 0x4f46e5,
      roughness: 0.32,
      metalness: 0.06,
      clearcoat: 0.42,
      clearcoatRoughness: 0.22,
    })
  );

  const pagesTex = trackTex(createBookPagesTexture());
  const pagesMat = trackMat(
    new THREE.MeshStandardMaterial({
      map: pagesTex,
      color: 0xf8fafc,
      roughness: 0.72,
      metalness: 0.0,
    })
  );

  const laptopAluminumMat = trackMat(
    new THREE.MeshPhysicalMaterial({
      color: 0xdbe4f0,
      roughness: 0.22,
      metalness: 0.78,
      clearcoat: 0.45,
      clearcoatRoughness: 0.18,
      envMapIntensity: 0.95,
    })
  );

  const keyboardWellMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0x1e293b,
      roughness: 0.48,
      metalness: 0.2,
      emissive: 0x1e40af,
      emissiveIntensity: 0.25,
    })
  );

  const screenGlowMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0x93c5fd,
      emissive: 0x3b82f6,
      emissiveIntensity: 1.1,
      roughness: 0.15,
    })
  );

  const logoTex = trackTex(createLaptopLogoTexture(maxAnisotropy));
  const logoMat = trackMat(
    new THREE.MeshStandardMaterial({
      map: logoTex,
      emissiveMap: logoTex,
      emissive: 0xffffff,
      emissiveIntensity: 1.25,
      transparent: true,
      roughness: 0.2,
      polygonOffset: true,
      polygonOffsetFactor: -1,
      polygonOffsetUnits: -1,
    })
  );

  const bulbGlassMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0xa5b4fc,
      emissive: 0x6366f1,
      emissiveIntensity: 1.35,
      roughness: 0.16,
      metalness: 0.05,
    })
  );

  const bulbBaseMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0x4f46e5,
      emissive: 0x4338ca,
      emissiveIntensity: 0.55,
      roughness: 0.32,
      metalness: 0.5,
    })
  );

  // --- Root & Scene Pivot ---
  const root = new THREE.Group();
  root.name = "ArtigenWritingMascotRoot";

  const scenePivot = new THREE.Group();
  scenePivot.position.set(-0.04, -0.98, 0);
  root.add(scenePivot);

  // Soft contact shadow directly under stacked books
  const shadowTex = trackTex(createContactShadowTexture());
  const shadowMat = trackMat(
    new THREE.MeshBasicMaterial({
      map: shadowTex,
      transparent: true,
      depthWrite: false,
      opacity: 0.72,
    })
  );
  const shadowPlane = new THREE.Mesh(
    trackGeo(new THREE.PlaneGeometry(2.35, 1.85)),
    shadowMat
  );
  shadowPlane.rotation.x = -Math.PI / 2;
  shadowPlane.position.set(0.02, 0.002, 0.02);
  scenePivot.add(shadowPlane);

  // --- TWO STACKED HARDCOVER BOOKS ---
  const buildHardcoverBook = (
    coverMat: THREE.MeshPhysicalMaterial,
    w: number,
    h: number,
    d: number
  ) => {
    const book = new THREE.Group();
    const boardH = 0.036;
    const pageH = h - boardH * 2 + 0.004;

    const bottomCover = new THREE.Mesh(
      trackGeo(new RoundedBoxGeometry(w, boardH, d, 3, 0.016)),
      coverMat
    );
    bottomCover.position.set(0, boardH / 2, 0);
    bottomCover.castShadow = true;
    bottomCover.receiveShadow = true;
    book.add(bottomCover);

    const topCover = new THREE.Mesh(
      trackGeo(new RoundedBoxGeometry(w, boardH, d, 3, 0.016)),
      coverMat
    );
    topCover.position.set(0, h - boardH / 2, 0);
    topCover.castShadow = true;
    topCover.receiveShadow = true;
    book.add(topCover);

    // Curved spine on the left (-X)
    const spine = new THREE.Mesh(
      trackGeo(
        new THREE.CylinderGeometry(
          h * 0.51,
          h * 0.51,
          d - 0.015,
          20,
          1,
          false,
          0,
          Math.PI
        )
      ),
      coverMat
    );
    spine.rotation.x = Math.PI / 2;
    spine.rotation.z = Math.PI;
    spine.position.set(-w / 2 + 0.02, h / 2, 0);
    spine.castShadow = true;
    spine.receiveShadow = true;
    book.add(spine);

    // Recessed cream-white page block
    const pages = new THREE.Mesh(
      trackGeo(new RoundedBoxGeometry(w - 0.08, pageH, d - 0.075, 2, 0.012)),
      pagesMat
    );
    pages.position.set(0.028, h / 2, 0);
    pages.castShadow = true;
    pages.receiveShadow = true;
    book.add(pages);

    return book;
  };

  // Bottom book (Rich Purple)
  const bottomBook = buildHardcoverBook(purpleBookMat, 1.44, 0.19, 1.02);
  bottomBook.position.set(-0.02, 0, 0.0);
  bottomBook.rotation.y = 0.24;
  scenePivot.add(bottomBook);

  // Top book (Indigo/Blue)
  const topBook = buildHardcoverBook(blueBookMat, 1.3, 0.18, 0.94);
  topBook.position.set(0.01, 0.19, 0.02);
  topBook.rotation.y = 0.06;
  scenePivot.add(topBook);

  // --- ROBOT GROUP (Seated on Top Book at y = 0.37, 3/4 view toward front-right) ---
  const robotGroup = new THREE.Group();
  robotGroup.position.set(-0.06, 0.37, -0.02);
  robotGroup.rotation.y = 0.32;
  scenePivot.add(robotGroup);

  const bodyPivot = new THREE.Group();
  robotGroup.add(bodyPivot);

  // --- PELVIS & SEATED LEGS + SNEAKERS ---
  const pelvis = new THREE.Mesh(
    trackGeo(new THREE.SphereGeometry(0.23, 28, 22)),
    whiteShellMat
  );
  pelvis.scale.set(1.08, 0.62, 0.92);
  pelvis.position.set(0, 0.14, 0);
  pelvis.castShadow = true;
  pelvis.receiveShadow = true;
  bodyPivot.add(pelvis);

  const waistRing = new THREE.Mesh(
    trackGeo(new THREE.CylinderGeometry(0.165, 0.175, 0.11, 24)),
    jointDarkMat
  );
  waistRing.position.set(0, 0.26, 0);
  bodyPivot.add(waistRing);

  const buildSeatedLeg = (side: -1 | 1) => {
    const legGroup = new THREE.Group();
    legGroup.position.set(side * 0.17, 0.14, 0.06);
    legGroup.rotation.y = side * 0.14;
    bodyPivot.add(legGroup);

    const hipBall = new THREE.Mesh(
      trackGeo(new THREE.SphereGeometry(0.068, 16, 16)),
      jointDarkMat
    );
    legGroup.add(hipBall);

    // Thigh extending forward on top of blue book
    const thigh = new THREE.Mesh(
      trackGeo(new THREE.CapsuleGeometry(0.068, 0.18, 8, 14)),
      whiteShellMat
    );
    thigh.rotation.x = Math.PI / 2;
    thigh.position.set(0, -0.01, 0.15);
    thigh.castShadow = true;
    legGroup.add(thigh);

    // Dark knee joint right near book front edge
    const knee = new THREE.Mesh(
      trackGeo(new THREE.SphereGeometry(0.062, 16, 16)),
      jointDarkMat
    );
    knee.position.set(0, -0.01, 0.3);
    legGroup.add(knee);

    // Lower shin hanging slightly downward over front of upper book
    const shinPivot = new THREE.Group();
    shinPivot.position.set(0, -0.01, 0.3);
    shinPivot.rotation.x = -0.35;
    legGroup.add(shinPivot);

    const shin = new THREE.Mesh(
      trackGeo(new THREE.CylinderGeometry(0.062, 0.078, 0.16, 18)),
      whiteShellMat
    );
    shin.position.set(0, -0.1, 0.03);
    shin.castShadow = true;
    shinPivot.add(shin);

    // Chunky cute white & blue sneaker
    const sneakerGroup = new THREE.Group();
    sneakerGroup.position.set(0, -0.21, 0.08);
    sneakerGroup.rotation.x = 0.25;
    shinPivot.add(sneakerGroup);

    const shoeUpper = new THREE.Mesh(
      trackGeo(new RoundedBoxGeometry(0.165, 0.11, 0.24, 4, 0.048)),
      whiteShellMat
    );
    shoeUpper.position.set(0, 0.02, 0.02);
    shoeUpper.castShadow = true;
    sneakerGroup.add(shoeUpper);

    const shoeSole = new THREE.Mesh(
      trackGeo(new RoundedBoxGeometry(0.178, 0.042, 0.256, 4, 0.02)),
      sneakerBlueMat
    );
    shoeSole.position.set(0, -0.036, 0.02);
    shoeSole.castShadow = true;
    sneakerGroup.add(shoeSole);

    const shoeCollar = new THREE.Mesh(
      trackGeo(new THREE.TorusGeometry(0.068, 0.016, 10, 20)),
      sneakerBlueMat
    );
    shoeCollar.rotation.x = Math.PI / 2;
    shoeCollar.position.set(0, 0.072, -0.02);
    sneakerGroup.add(shoeCollar);
  };

  buildSeatedLeg(-1);
  buildSeatedLeg(1);

  // --- GLOSSY WHITE TORSO + NECK ---
  const torso = new THREE.Mesh(
    trackGeo(new THREE.SphereGeometry(0.275, 34, 28)),
    whiteShellMat
  );
  torso.scale.set(1.06, 0.9, 0.84);
  torso.position.set(0, 0.48, 0);
  torso.castShadow = true;
  torso.receiveShadow = true;
  bodyPivot.add(torso);

  // Subtle dark collar ring
  const collar = new THREE.Mesh(
    trackGeo(new THREE.TorusGeometry(0.155, 0.022, 12, 32)),
    jointDarkMat
  );
  collar.rotation.x = Math.PI / 2;
  collar.position.set(0, 0.695, 0);
  bodyPivot.add(collar);

  const neck = new THREE.Mesh(
    trackGeo(new THREE.CylinderGeometry(0.11, 0.13, 0.12, 22)),
    jointDarkMat
  );
  neck.position.set(0, 0.74, 0);
  bodyPivot.add(neck);

  // --- OVERSIZED CUTE HEAD + HEADPHONES + HAPPY VISOR FACE ---
  const headPivot = new THREE.Group();
  headPivot.position.set(0, 1.14, 0.02);
  bodyPivot.add(headPivot);

  const headShell = new THREE.Mesh(
    trackGeo(new THREE.SphereGeometry(0.49, 44, 38)),
    whiteShellMat
  );
  headShell.scale.set(1.16, 0.94, 0.94);
  headShell.castShadow = true;
  headShell.receiveShadow = true;
  headPivot.add(headShell);

  // Dark glossy recessed visor screen
  const visor = new THREE.Mesh(
    trackGeo(new THREE.SphereGeometry(0.42, 40, 32)),
    visorMat
  );
  visor.scale.set(0.96, 0.67, 0.48);
  visor.position.set(0, -0.02, 0.27);
  headPivot.add(visor);

  // Happy upward-curving cyan eyes (^ ^) with rounded endcaps
  const buildHappyEye = (
    x: number,
    mat: THREE.MeshStandardMaterial
  ): THREE.Group => {
    const g = new THREE.Group();
    g.position.set(x, 0.015, 0.468);
    g.rotation.y = x < 0 ? -0.15 : 0.15;

    const r = 0.068;
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

  // Cute smaller cyan smile arc (◡)
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

  // --- SLEEK OVER-EAR HEADPHONES (White Arch + Purple-Blue Glowing Earcups) ---
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

    // Subtle white hinge bracket connecting headband to earcup
    const hinge = new THREE.Mesh(
      trackGeo(new RoundedBoxGeometry(0.045, 0.08, 0.055, 2, 0.015)),
      whiteShellMat
    );
    hinge.position.set(side * 0.015, 0.15, 0);
    ear.add(hinge);
  });

  // --- ARTICULATED ARMS + TYPING HANDS ---
  const buildTypingArm = (side: -1 | 1) => {
    const shoulder = new THREE.Group();
    shoulder.position.set(side * 0.31, 0.56, 0.02);
    bodyPivot.add(shoulder);

    const shoulderJoint = new THREE.Mesh(
      trackGeo(new THREE.SphereGeometry(0.066, 18, 18)),
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
      scale: 0.94,
      whiteShellMat,
      jointDarkMat,
      trackGeo,
    });
    // Flip 180 deg around Y so palms face downward onto keyboard and thumbs sit inward near spacebar
    handRig.handGroup.rotation.y = Math.PI;
    applyHandPose(handRig, side, "typing");
    hand.add(handRig.handGroup);

    return { shoulder, forearmPivot, hand };
  };

  const leftArm = buildTypingArm(-1);
  const rightArm = buildTypingArm(1);

  // Initial typing rest pose angles
  leftArm.shoulder.rotation.set(-0.72, -0.18, -0.18);
  leftArm.forearmPivot.rotation.set(-0.92, 0, 0.22);
  rightArm.shoulder.rotation.set(-0.72, 0.18, 0.18);
  rightArm.forearmPivot.rotation.set(-0.92, 0, -0.22);

  // --- OPEN SILVER LAPTOP WITH GLOWING "A" LOGO ON LID ---
  const laptopGroup = new THREE.Group();
  laptopGroup.position.set(0.02, 0.24, 0.34);
  laptopGroup.rotation.x = 0.06;
  robotGroup.add(laptopGroup);

  const laptopBase = new THREE.Mesh(
    trackGeo(new RoundedBoxGeometry(0.58, 0.028, 0.39, 3, 0.012)),
    laptopAluminumMat
  );
  laptopBase.castShadow = true;
  laptopBase.receiveShadow = true;
  laptopGroup.add(laptopBase);

  // Recessed backlit keyboard plate
  const keyboard = new THREE.Mesh(
    trackGeo(new RoundedBoxGeometry(0.49, 0.01, 0.22, 2, 0.004)),
    keyboardWellMat
  );
  keyboard.position.set(0, 0.013, 0.025);
  laptopGroup.add(keyboard);

  // Lid hinge at front edge (+Z side of keyboard so back of lid faces viewer!)
  const lidPivot = new THREE.Group();
  lidPivot.position.set(0, 0.012, 0.19);
  lidPivot.rotation.x = 0.24; // Open ~104 deg away from robot, tilted slightly toward viewer
  laptopGroup.add(lidPivot);

  const lidShell = new THREE.Mesh(
    trackGeo(new RoundedBoxGeometry(0.58, 0.38, 0.022, 3, 0.01)),
    laptopAluminumMat
  );
  lidShell.position.set(0, 0.19, 0);
  lidShell.castShadow = true;
  lidPivot.add(lidShell);

  // Inner glowing screen facing robot (-Z)
  const innerScreen = new THREE.Mesh(
    trackGeo(new THREE.PlaneGeometry(0.52, 0.33)),
    screenGlowMat
  );
  innerScreen.rotation.y = Math.PI;
  innerScreen.position.set(0, 0.19, -0.012);
  lidPivot.add(innerScreen);

  // Glowing "A" emblem facing viewer (+Z) on back of laptop lid
  const logoBadge = new THREE.Mesh(
    trackGeo(new THREE.PlaneGeometry(0.22, 0.22)),
    logoMat
  );
  logoBadge.position.set(0, 0.19, 0.012);
  lidPivot.add(logoBadge);

  // Soft blue screen bounce light illuminating the robot's chin & chest
  const screenLight = new THREE.PointLight(0x60a5fa, 0.65, 1.4, 2);
  screenLight.position.set(0, 0.22, -0.15);
  lidPivot.add(screenLight);

  // --- FLOATING GLOWING IDEA LIGHTBULB + RAYS ---
  const lightbulbGroup = new THREE.Group();
  lightbulbGroup.position.set(0.62, 1.84, -0.04);
  lightbulbGroup.rotation.z = -0.16;
  scenePivot.add(lightbulbGroup);

  const bulbSphere = new THREE.Mesh(
    trackGeo(new THREE.SphereGeometry(0.115, 24, 20)),
    bulbGlassMat
  );
  bulbSphere.scale.set(0.95, 1.05, 0.95);
  bulbSphere.position.set(0, 0.07, 0);
  lightbulbGroup.add(bulbSphere);

  const bulbNeck = new THREE.Mesh(
    trackGeo(new THREE.CylinderGeometry(0.076, 0.048, 0.08, 18)),
    bulbGlassMat
  );
  bulbNeck.position.set(0, -0.02, 0);
  lightbulbGroup.add(bulbNeck);

  const screwBase = new THREE.Mesh(
    trackGeo(new THREE.CylinderGeometry(0.046, 0.038, 0.055, 16)),
    bulbBaseMat
  );
  screwBase.position.set(0, -0.082, 0);
  lightbulbGroup.add(screwBase);

  const screwTip = new THREE.Mesh(
    trackGeo(new THREE.SphereGeometry(0.026, 12, 12)),
    bulbBaseMat
  );
  screwTip.position.set(0, -0.112, 0);
  lightbulbGroup.add(screwTip);

  // 5 radiating light rays around top of bulb
  const bulbRayMats: THREE.MeshStandardMaterial[] = [];
  const rayGeo = trackGeo(new THREE.CapsuleGeometry(0.012, 0.048, 6, 10));
  [-1.15, -0.58, 0, 0.58, 1.15].forEach((angle) => {
    const rayMat = trackMat(
      new THREE.MeshStandardMaterial({
        color: 0xa78bfa,
        emissive: 0x6366f1,
        emissiveIntensity: 1.4,
        roughness: 0.2,
      })
    );
    bulbRayMats.push(rayMat);
    const ray = new THREE.Mesh(rayGeo, rayMat);
    const dist = 0.195;
    ray.position.set(Math.sin(angle) * dist, 0.07 + Math.cos(angle) * dist, 0);
    ray.rotation.z = -angle;
    lightbulbGroup.add(ray);
  });

  const rig: WritingMascotRig = {
    root,
    scenePivot,
    robotGroup,
    bodyPivot,
    headPivot,
    leftEye,
    rightEye,
    leftEyeMat,
    rightEyeMat,
    smileArc,
    leftArmPivot: leftArm.shoulder,
    leftForearmPivot: leftArm.forearmPivot,
    leftHand: leftArm.hand,
    rightArmPivot: rightArm.shoulder,
    rightForearmPivot: rightArm.forearmPivot,
    rightHand: rightArm.hand,
    lightbulbGroup,
    bulbGlassMat,
    bulbRayMats,
    screenGlowMat,
    screenLight,
    shadowPlane,
  };

  const dispose = () => {
    geometries.forEach((g) => g.dispose());
    materials.forEach((m) => m.dispose());
    textures.forEach((t) => t.dispose());
  };

  return { rig, dispose };
}
