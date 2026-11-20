"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";

export type LaptopScreenPreset = {
  label: string;
  tema: string;
  tom: string;
  primeiraPessoa: boolean;
  pesquisaWeb: string;
  tituloArtigo: string;
  meta: string;
  secaoTitulo: string;
  secaoParagrafo: string;
  fonte: string;
};

type HeroLaptop3DProps = {
  isOpen: boolean;
  preset: LaptopScreenPreset;
  onClickLaptop?: () => void;
  className?: string;
};

const _vec3 = new THREE.Vector3();

function detectSoftwareWebGL(): boolean {
  if (typeof document === "undefined") return false;
  try {
    const probe = document.createElement("canvas");
    const gl = probe.getContext("webgl2") || probe.getContext("webgl");
    if (!gl) return true;
    const ext = gl.getExtension("WEBGL_debug_renderer_info");
    const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
    const gpu = String(gl.getParameter(param) || "");
    gl.getExtension("WEBGL_lose_context")?.loseContext();
    return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
  } catch {
    return false;
  }
}

function drawRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function wrapTextLines(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
  maxLines: number
): string[] {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let current = "";

  for (const w of words) {
    const test = current ? `${current} ${w}` : w;
    if (ctx.measureText(test).width > maxWidth && current) {
      lines.push(current);
      current = w;
      if (lines.length === maxLines) break;
    } else {
      current = test;
    }
  }
  if (lines.length < maxLines && current) {
    lines.push(current);
  }
  return lines;
}

function paintLidEmblemCanvas(canvas: HTMLCanvasElement) {
  canvas.width = 512;
  canvas.height = 340;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  // Brushed aluminum backplate gradient
  const bg = ctx.createLinearGradient(0, 0, 512, 340);
  bg.addColorStop(0, "#CBD5E1");
  bg.addColorStop(0.5, "#E2E8F0");
  bg.addColorStop(1, "#94A3B8");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, 512, 340);

  // Subtle horizontal brushed lines
  ctx.strokeStyle = "rgba(255,255,255,0.16)";
  ctx.lineWidth = 1;
  for (let y = 0; y < 340; y += 3) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(512, y);
    ctx.stroke();
  }

  // Centered glowing Artigen emblem badge
  const cx = 256;
  const cy = 158;

  const halo = ctx.createRadialGradient(cx, cy, 8, cx, cy, 78);
  halo.addColorStop(0, "rgba(91, 74, 244, 0.36)");
  halo.addColorStop(1, "rgba(37, 99, 235, 0)");
  ctx.fillStyle = halo;
  ctx.beginPath();
  ctx.arc(cx, cy, 78, 0, Math.PI * 2);
  ctx.fill();

  const emblemGrad = ctx.createLinearGradient(cx - 26, cy - 26, cx + 26, cy + 26);
  emblemGrad.addColorStop(0, "#5B4AF4");
  emblemGrad.addColorStop(1, "#2563EB");
  ctx.fillStyle = emblemGrad;
  drawRoundedRect(ctx, cx - 28, cy - 28, 56, 56, 16);
  ctx.fill();

  // Stylized quill / nib stroke inside emblem
  ctx.strokeStyle = "#FFFFFF";
  ctx.lineWidth = 4;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.beginPath();
  ctx.moveTo(cx - 12, cy + 12);
  ctx.lineTo(cx + 12, cy - 12);
  ctx.moveTo(cx + 12, cy - 12);
  ctx.lineTo(cx + 14, cy + 2);
  ctx.moveTo(cx + 12, cy - 12);
  ctx.lineTo(cx - 2, cy - 14);
  ctx.stroke();

  ctx.fillStyle = "#1E293B";
  ctx.font = "700 22px system-ui, -apple-system, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("Artigen", cx, cy + 56);
}

function paintStudioScreenCanvas(
  canvas: HTMLCanvasElement,
  preset: LaptopScreenPreset
) {
  canvas.width = 1024;
  canvas.height = 640;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  // Base workspace background
  ctx.fillStyle = "#F4F6FB";
  ctx.fillRect(0, 0, 1024, 640);

  // Left Navy Sidebar
  const sideGrad = ctx.createLinearGradient(0, 0, 0, 640);
  sideGrad.addColorStop(0, "#0E162E");
  sideGrad.addColorStop(1, "#131F44");
  ctx.fillStyle = sideGrad;
  ctx.fillRect(0, 0, 198, 640);

  // Sidebar Logo
  const logoGrad = ctx.createLinearGradient(22, 24, 58, 60);
  logoGrad.addColorStop(0, "#5B4AF4");
  logoGrad.addColorStop(1, "#2563EB");
  ctx.fillStyle = logoGrad;
  drawRoundedRect(ctx, 22, 24, 34, 34, 10);
  ctx.fill();

  ctx.fillStyle = "#FFFFFF";
  ctx.font = "700 18px system-ui, -apple-system, sans-serif";
  ctx.textAlign = "left";
  ctx.fillText("Artigen", 66, 46);

  // Sidebar Nav Items
  const navItems = ["Início", "Meus Artigos", "Favoritos", "Estatísticas", "Configurações"];
  navItems.forEach((label, idx) => {
    const y = 92 + idx * 44;
    if (idx === 0) {
      const activeGrad = ctx.createLinearGradient(16, y, 182, y + 34);
      activeGrad.addColorStop(0, "#5B4AF4");
      activeGrad.addColorStop(1, "#3B82F6");
      ctx.fillStyle = activeGrad;
      drawRoundedRect(ctx, 16, y, 166, 36, 10);
      ctx.fill();
      ctx.fillStyle = "#FFFFFF";
    } else {
      ctx.fillStyle = "#94A3B8";
    }
    ctx.font = idx === 0 ? "600 13px system-ui, sans-serif" : "500 13px system-ui, sans-serif";
    ctx.fillText(label, 34, y + 23);
  });

  // Top Bar strip inside Studio
  ctx.fillStyle = "#FFFFFF";
  ctx.fillRect(198, 0, 826, 56);
  ctx.fillStyle = "#E2E8F0";
  ctx.fillRect(198, 55, 826, 1);

  ctx.fillStyle = "#0F172A";
  ctx.font = "700 16px system-ui, sans-serif";
  ctx.fillText("Gerador de Artigos com IA", 224, 34);

  // Preset label pill in top bar
  ctx.fillStyle = "#EEF2FF";
  drawRoundedRect(ctx, 840, 14, 160, 28, 14);
  ctx.fill();
  ctx.fillStyle = "#4F46E5";
  ctx.font = "600 12px system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText(preset.label, 920, 32);
  ctx.textAlign = "left";

  // Middle Card: Configurar seu artigo
  ctx.fillStyle = "#FFFFFF";
  drawRoundedRect(ctx, 218, 76, 314, 540, 16);
  ctx.fill();
  ctx.strokeStyle = "#E2E8F0";
  ctx.lineWidth = 1.5;
  ctx.stroke();

  ctx.fillStyle = "#0F172A";
  ctx.font = "700 15px system-ui, sans-serif";
  ctx.fillText("Configurar seu artigo", 240, 108);

  // Field 1: Tema
  ctx.fillStyle = "#475569";
  ctx.font = "600 11px system-ui, sans-serif";
  ctx.fillText("Tema ou Título Principal", 240, 140);
  ctx.fillStyle = "#F8FAFC";
  drawRoundedRect(ctx, 240, 150, 270, 58, 10);
  ctx.fill();
  ctx.strokeStyle = "#CBD5E1";
  ctx.stroke();
  ctx.fillStyle = "#0F172A";
  ctx.font = "500 12px system-ui, sans-serif";
  const temaLines = wrapTextLines(ctx, preset.tema, 246, 2);
  temaLines.forEach((line, i) => ctx.fillText(line, 252, 173 + i * 17));

  // Field 2: Tom & Perspectiva
  ctx.fillStyle = "#475569";
  ctx.font = "600 11px system-ui, sans-serif";
  ctx.fillText("Tom editorial", 240, 236);
  ctx.fillStyle = "#F8FAFC";
  drawRoundedRect(ctx, 240, 246, 270, 38, 10);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = "#1E293B";
  ctx.font = "500 12px system-ui, sans-serif";
  ctx.fillText(preset.tom, 252, 270);

  ctx.fillStyle = "#475569";
  ctx.font = "600 11px system-ui, sans-serif";
  ctx.fillText("Perspectiva narrativa", 240, 314);
  ctx.fillStyle = "#EEF2FF";
  drawRoundedRect(ctx, 240, 324, 270, 38, 10);
  ctx.fill();
  ctx.fillStyle = "#4338CA";
  ctx.font = "600 12px system-ui, sans-serif";
  ctx.fillText(
    preset.primeiraPessoa ? "Primeira pessoa (Eu / Nós)" : "Terceira pessoa",
    252,
    348
  );

  ctx.fillStyle = "#475569";
  ctx.font = "600 11px system-ui, sans-serif";
  ctx.fillText("Pesquisa web", 240, 392);
  ctx.fillStyle = "#F8FAFC";
  drawRoundedRect(ctx, 240, 402, 270, 38, 10);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = "#0F172A";
  ctx.font = "500 12px system-ui, sans-serif";
  ctx.fillText(preset.pesquisaWeb, 252, 426);

  // Primary CTA button
  const btnGrad = ctx.createLinearGradient(240, 540, 510, 584);
  btnGrad.addColorStop(0, "#5B4AF4");
  btnGrad.addColorStop(1, "#2563EB");
  ctx.fillStyle = btnGrad;
  drawRoundedRect(ctx, 240, 542, 270, 46, 12);
  ctx.fill();
  ctx.fillStyle = "#FFFFFF";
  ctx.font = "700 14px system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("Gerar Artigo com IA", 375, 570);
  ctx.textAlign = "left";

  // Right Card: Live Article Workspace Preview
  ctx.fillStyle = "#FFFFFF";
  drawRoundedRect(ctx, 550, 76, 454, 540, 16);
  ctx.fill();
  ctx.strokeStyle = "#E2E8F0";
  ctx.stroke();

  // Article Title
  ctx.fillStyle = "#0F172A";
  ctx.font = "700 20px Georgia, serif";
  const titleLines = wrapTextLines(ctx, preset.tituloArtigo, 408, 3);
  titleLines.forEach((line, i) => ctx.fillText(line, 574, 114 + i * 26));

  // Meta bar
  const metaY = 122 + titleLines.length * 26;
  ctx.fillStyle = "#64748B";
  ctx.font = "500 11px system-ui, sans-serif";
  ctx.fillText(preset.meta, 574, metaY);

  // Illustration card banner inside article
  const bannerY = metaY + 18;
  const bannerGrad = ctx.createLinearGradient(574, bannerY, 980, bannerY + 132);
  bannerGrad.addColorStop(0, "#0E162E");
  bannerGrad.addColorStop(0.55, "#1E3A8A");
  bannerGrad.addColorStop(1, "#2563EB");
  ctx.fillStyle = bannerGrad;
  drawRoundedRect(ctx, 574, bannerY, 406, 132, 14);
  ctx.fill();

  // Stylized cute AI bot circle inside banner
  ctx.fillStyle = "#FFFFFF";
  ctx.beginPath();
  ctx.arc(918, bannerY + 66, 36, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#090E1B";
  drawRoundedRect(ctx, 894, bannerY + 48, 48, 34, 12);
  ctx.fill();
  ctx.fillStyle = "#00E5FF";
  ctx.beginPath();
  ctx.arc(909, bannerY + 64, 5.5, 0, Math.PI * 2);
  ctx.arc(927, bannerY + 64, 5.5, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "#A5B4FC";
  ctx.font = "600 11px system-ui, sans-serif";
  ctx.fillText("ILUSTRAÇÃO GERADA POR IA", 594, bannerY + 42);
  ctx.fillStyle = "#FFFFFF";
  ctx.font = "700 14px system-ui, sans-serif";
  const secLines = wrapTextLines(ctx, preset.secaoTitulo, 260, 2);
  secLines.forEach((line, i) => ctx.fillText(line, 594, bannerY + 70 + i * 20));

  // Article body excerpt
  const bodyY = bannerY + 160;
  ctx.fillStyle = "#334155";
  ctx.font = "400 13.5px Georgia, serif";
  const bodyLines = wrapTextLines(ctx, preset.secaoParagrafo, 406, 5);
  bodyLines.forEach((line, i) => ctx.fillText(line, 574, bodyY + i * 21));

  // Sources footer
  ctx.fillStyle = "#E2E8F0";
  ctx.fillRect(574, 576, 406, 1);
  ctx.fillStyle = "#64748B";
  ctx.font = "500 11px system-ui, sans-serif";
  ctx.fillText(`Fontes: ${preset.fonte}`, 574, 598);
}

function paintContactShadowCanvas(canvas: HTMLCanvasElement) {
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const grad = ctx.createRadialGradient(128, 128, 18, 128, 128, 124);
  grad.addColorStop(0, "rgba(15, 23, 42, 0.34)");
  grad.addColorStop(0.55, "rgba(30, 41, 59, 0.14)");
  grad.addColorStop(1, "rgba(15, 23, 42, 0)");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 256, 256);
}

export default function HeroLaptop3D({
  isOpen,
  preset,
  onClickLaptop,
  className = "",
}: HeroLaptop3DProps) {
  const mountRef = useRef<HTMLDivElement>(null);
  const isOpenRef = useRef(isOpen);
  const screenCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const screenTextureRef = useRef<THREE.CanvasTexture | null>(null);
  const pointerRef = useRef({ x: 0, y: 0 });
  const clickCallbackRef = useRef(onClickLaptop);

  useEffect(() => {
    isOpenRef.current = isOpen;
  }, [isOpen]);

  useEffect(() => {
    clickCallbackRef.current = onClickLaptop;
  }, [onClickLaptop]);

  // Repaint the 3D screen CanvasTexture whenever the selected preset updates
  useEffect(() => {
    const canvas = screenCanvasRef.current;
    const texture = screenTextureRef.current;
    if (!canvas || !texture) return;
    paintStudioScreenCanvas(canvas, preset);
    texture.needsUpdate = true;
  }, [preset]);

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const isSoftwareGl = detectSoftwareWebGL();
    const prefersReducedMotion =
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

    const width = Math.max(container.clientWidth, 320);
    const height = Math.max(container.clientHeight, 300);

    const renderer = new THREE.WebGLRenderer({
      alpha: true,
      antialias: !isSoftwareGl,
      powerPreference: "high-performance",
    });
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.08;
    renderer.setPixelRatio(
      isSoftwareGl ? 1 : Math.min(window.devicePixelRatio || 1, 2)
    );
    renderer.setSize(width, height);
    renderer.shadowMap.enabled = !isSoftwareGl;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    container.appendChild(renderer.domElement);

    const scene = new THREE.Scene();

    // Procedural Studio Environment Reflection (mandatory for aluminum body)
    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    const envTarget = pmremGenerator.fromScene(new RoomEnvironment(), 0.04);
    scene.environment = envTarget.texture;
    pmremGenerator.dispose();

    const camera = new THREE.PerspectiveCamera(34, width / height, 0.1, 40);
    camera.position.set(1.85, 1.38, 3.65);
    camera.lookAt(0, 0.24, 0);

    // 3-point Warm/Cool Studio Lighting
    const hemiLight = new THREE.HemisphereLight(0xdbeafe, 0x1e293b, 0.9);
    scene.add(hemiLight);

    const keyLight = new THREE.DirectionalLight(0xfff7ed, 2.1);
    keyLight.position.set(3.5, 5.2, 4.0);
    keyLight.castShadow = !isSoftwareGl;
    keyLight.shadow.mapSize.width = 1024;
    keyLight.shadow.mapSize.height = 1024;
    keyLight.shadow.camera.near = 0.5;
    keyLight.shadow.camera.far = 16;
    keyLight.shadow.camera.left = -2.4;
    keyLight.shadow.camera.right = 2.4;
    keyLight.shadow.camera.top = 2.4;
    keyLight.shadow.camera.bottom = -2.4;
    keyLight.shadow.bias = -0.0005;
    keyLight.shadow.normalBias = 0.02;
    scene.add(keyLight);

    const rimLight = new THREE.DirectionalLight(0x60a5fa, 1.35);
    rimLight.position.set(-4.0, 2.5, -3.2);
    scene.add(rimLight);

    const fillLight = new THREE.DirectionalLight(0xa78bfa, 0.85);
    fillLight.position.set(-3.0, 1.2, 3.2);
    scene.add(fillLight);

    // Track disposables cleanly
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

    // Root laptop assembly group (bottom-center grounded)
    const rootGroup = new THREE.Group();
    rootGroup.rotation.y = -0.26;
    scene.add(rootGroup);

    // Soft radial contact shadow plane under laptop
    const shadowCanvas = document.createElement("canvas");
    paintContactShadowCanvas(shadowCanvas);
    const shadowTex = trackTex(new THREE.CanvasTexture(shadowCanvas));
    shadowTex.colorSpace = THREE.SRGBColorSpace;
    const shadowMat = trackMat(
      new THREE.MeshBasicMaterial({
        map: shadowTex,
        transparent: true,
        depthWrite: false,
        opacity: 0.72,
      })
    );
    const shadowPlane = new THREE.Mesh(
      trackGeo(new THREE.PlaneGeometry(3.4, 2.6)),
      shadowMat
    );
    shadowPlane.rotation.x = -Math.PI / 2;
    shadowPlane.position.y = -0.02;
    rootGroup.add(shadowPlane);

    // Dimensions
    const baseW = 2.15;
    const baseD = 1.44;
    const baseH = 0.075;

    // Materials with varied roughness/metalness
    const aluminumMat = trackMat(
      new THREE.MeshPhysicalMaterial({
        color: 0xdbe2ec,
        metalness: 0.76,
        roughness: 0.24,
        clearcoat: 0.35,
        clearcoatRoughness: 0.22,
      })
    );
    const darkTrimMat = trackMat(
      new THREE.MeshStandardMaterial({
        color: 0x0f172a,
        metalness: 0.35,
        roughness: 0.65,
      })
    );
    const keycapMat = trackMat(
      new THREE.MeshStandardMaterial({
        color: 0x161f33,
        metalness: 0.15,
        roughness: 0.62,
      })
    );
    const trackpadMat = trackMat(
      new THREE.MeshPhysicalMaterial({
        color: 0xc2cbd8,
        metalness: 0.45,
        roughness: 0.38,
        clearcoat: 0.5,
      })
    );
    const backlightMat = trackMat(
      new THREE.MeshStandardMaterial({
        color: 0x1e293b,
        emissive: 0x4f46e5,
        emissiveIntensity: 0.0,
        roughness: 0.8,
      })
    );

    // 1. Primary Unibody Base Deck
    const baseMesh = new THREE.Mesh(
      trackGeo(new RoundedBoxGeometry(baseW, baseH, baseD, 4, 0.024)),
      aluminumMat
    );
    baseMesh.position.y = baseH / 2;
    baseMesh.castShadow = !isSoftwareGl;
    baseMesh.receiveShadow = !isSoftwareGl;
    rootGroup.add(baseMesh);

    // 2. Rubberized bottom feet (4 corners)
    const footGeo = trackGeo(new THREE.CylinderGeometry(0.055, 0.055, 0.015, 16));
    const footOffsets: [number, number][] = [
      [-baseW * 0.42, -baseD * 0.4],
      [baseW * 0.42, -baseD * 0.4],
      [-baseW * 0.42, baseD * 0.4],
      [baseW * 0.42, baseD * 0.4],
    ];
    for (const [fx, fz] of footOffsets) {
      const foot = new THREE.Mesh(footGeo, darkTrimMat);
      foot.position.set(fx, 0.005, fz);
      rootGroup.add(foot);
    }

    // 3. Recessed Keyboard Well + Subtle Backlight Layer
    const wellMesh = new THREE.Mesh(
      trackGeo(new RoundedBoxGeometry(1.78, 0.018, 0.64, 2, 0.008)),
      backlightMat
    );
    wellMesh.position.set(0, baseH - 0.004, -0.18);
    rootGroup.add(wellMesh);

    // 4. Instanced Keycaps (5 rows x 14 columns = 70 keys)
    const cols = 14;
    const rows = 5;
    const keyGeo = trackGeo(new RoundedBoxGeometry(0.098, 0.022, 0.092, 2, 0.006));
    const keyInstanced = new THREE.InstancedMesh(
      keyGeo,
      keycapMat,
      cols * rows
    );
    const dummy = new THREE.Object3D();
    let idx = 0;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const kx = -0.78 + c * 0.12;
        const kz = -0.42 + r * 0.118;
        dummy.position.set(kx, baseH + 0.007, kz);
        dummy.scale.set(1, 1, 1);
        // Make spacebar region slightly wider/coalesced look on bottom middle keys
        if (r === rows - 1 && c >= 4 && c <= 8) {
          dummy.scale.set(1.18, 1, 1.04);
        }
        dummy.updateMatrix();
        keyInstanced.setMatrixAt(idx++, dummy.matrix);
      }
    }
    keyInstanced.instanceMatrix.needsUpdate = true;
    keyInstanced.computeBoundingSphere();
    rootGroup.add(keyInstanced);

    // 5. Precision Glass Trackpad
    const trackpadMesh = new THREE.Mesh(
      trackGeo(new RoundedBoxGeometry(0.76, 0.008, 0.44, 2, 0.004)),
      trackpadMat
    );
    trackpadMesh.position.set(0, baseH + 0.001, 0.41);
    rootGroup.add(trackpadMesh);

    // 6. Machined Rear Hinge Cylinder
    const hingeMesh = new THREE.Mesh(
      trackGeo(new THREE.CylinderGeometry(0.032, 0.032, 1.56, 20)),
      darkTrimMat
    );
    hingeMesh.rotation.z = Math.PI / 2;
    hingeMesh.position.set(0, baseH - 0.005, -baseD / 2 + 0.055);
    rootGroup.add(hingeMesh);

    // 7. Articulated Display Lid Group (pivoting around rear hinge!)
    const lidPivot = new THREE.Group();
    lidPivot.position.set(0, baseH - 0.005, -baseD / 2 + 0.055);
    rootGroup.add(lidPivot);

    const lidH = 1.38;
    const lidT = 0.042;
    const lidCenterY = lidH / 2 + 0.015;

    // Aluminum backplate
    const lidShell = new THREE.Mesh(
      trackGeo(new RoundedBoxGeometry(baseW, lidH, lidT, 4, 0.018)),
      aluminumMat
    );
    lidShell.position.set(0, lidCenterY, 0);
    lidShell.castShadow = !isSoftwareGl;
    lidPivot.add(lidShell);

    // Outer Lid Emblem Plate (visible when closed!)
    const emblemCanvas = document.createElement("canvas");
    paintLidEmblemCanvas(emblemCanvas);
    const emblemTex = trackTex(new THREE.CanvasTexture(emblemCanvas));
    emblemTex.colorSpace = THREE.SRGBColorSpace;
    emblemTex.anisotropy = renderer.capabilities.getMaxAnisotropy();
    const emblemMat = trackMat(
      new THREE.MeshStandardMaterial({
        map: emblemTex,
        metalness: 0.45,
        roughness: 0.28,
      })
    );
    const lidCoverDecal = new THREE.Mesh(
      trackGeo(new THREE.PlaneGeometry(baseW - 0.06, lidH - 0.06)),
      emblemMat
    );
    lidCoverDecal.rotation.y = Math.PI;
    lidCoverDecal.position.set(0, lidCenterY, -lidT / 2 - 0.002);
    lidPivot.add(lidCoverDecal);

    // Dark glass display bezel
    const bezelMesh = new THREE.Mesh(
      trackGeo(new RoundedBoxGeometry(baseW - 0.05, lidH - 0.05, 0.012, 2, 0.01)),
      darkTrimMat
    );
    bezelMesh.position.set(0, lidCenterY, lidT / 2 - 0.002);
    lidPivot.add(bezelMesh);

    // Dynamic Artigen Studio Display Panel
    const screenCanvas = document.createElement("canvas");
    paintStudioScreenCanvas(screenCanvas, preset);
    screenCanvasRef.current = screenCanvas;

    const screenTex = trackTex(new THREE.CanvasTexture(screenCanvas));
    screenTex.colorSpace = THREE.SRGBColorSpace;
    screenTex.anisotropy = renderer.capabilities.getMaxAnisotropy();
    screenTextureRef.current = screenTex;

    const screenMat = trackMat(
      new THREE.MeshStandardMaterial({
        map: screenTex,
        emissiveMap: screenTex,
        emissive: new THREE.Color(0xffffff),
        emissiveIntensity: 0.0,
        roughness: 0.16,
        metalness: 0.05,
      })
    );

    const screenMesh = new THREE.Mesh(
      trackGeo(new THREE.PlaneGeometry(baseW - 0.14, lidH - 0.15)),
      screenMat
    );
    screenMesh.position.set(0, lidCenterY + 0.01, lidT / 2 + 0.006);
    lidPivot.add(screenMesh);

    // Tiny glowing webcam indicator dot on top bezel
    const camDotMat = trackMat(
      new THREE.MeshStandardMaterial({
        color: 0x0ea5e9,
        emissive: 0x38bdf8,
        emissiveIntensity: 0.2,
      })
    );
    const camDot = new THREE.Mesh(
      trackGeo(new THREE.CircleGeometry(0.012, 12)),
      camDotMat
    );
    camDot.position.set(0, lidCenterY + lidH / 2 - 0.048, lidT / 2 + 0.007);
    lidPivot.add(camDot);

    // Initialize lid rotation based on starting isOpen
    const CLOSED_ANGLE = Math.PI / 2 - 0.025;
    const OPEN_ANGLE = -0.28;
    let currentLidAngle = isOpenRef.current ? OPEN_ANGLE : CLOSED_ANGLE;
    let screenGlow = isOpenRef.current ? 0.92 : 0.0;
    lidPivot.rotation.x = currentLidAngle;

    if (!isSoftwareGl) {
      renderer.compile(scene, camera);
    }

    // Pointer tracking + click handler
    const onPointerMove = (e: PointerEvent) => {
      const rect = renderer.domElement.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) return;
      pointerRef.current.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      pointerRef.current.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
    };
    const onPointerLeave = () => {
      pointerRef.current.x = 0;
      pointerRef.current.y = 0;
    };
    const onClick = () => {
      clickCallbackRef.current?.();
    };

    renderer.domElement.addEventListener("pointermove", onPointerMove);
    renderer.domElement.addEventListener("pointerleave", onPointerLeave);
    renderer.domElement.addEventListener("click", onClick);

    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const w = Math.max(entry.contentRect.width, 280);
        const h = Math.max(entry.contentRect.height, 260);
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
        renderer.setSize(w, h);
      }
    });
    resizeObserver.observe(container);

    // Animation loop with software WebGL pacing
    let frameId = 0;
    let disposed = false;
    let lastTime = performance.now();

    function afterDraw(cb: () => void) {
      if (disposed) return;
      const gl = renderer.getContext() as WebGL2RenderingContext;
      const sync = gl.fenceSync?.(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
      gl.flush();
      if (!sync) {
        frameId = window.setTimeout(cb, 80);
        return;
      }
      const poll = () => {
        if (disposed) {
          gl.deleteSync(sync);
          return;
        }
        const status = gl.getSyncParameter(sync, gl.SYNC_STATUS);
        if (status === gl.UNSIGNALED) {
          frameId = window.setTimeout(poll, 5);
        } else {
          gl.deleteSync(sync);
          frameId = window.setTimeout(cb, 80);
        }
      };
      frameId = window.setTimeout(poll, 5);
    }

    function tick(now: number) {
      if (disposed) return;
      const dt = Math.min((now - lastTime) / 1000, 0.08);
      lastTime = now;
      const t = now * 0.001;

      const targetOpen = isOpenRef.current;
      const targetAngle = targetOpen ? OPEN_ANGLE : CLOSED_ANGLE;
      const targetGlow = targetOpen ? 0.92 : 0.0;

      if (prefersReducedMotion) {
        currentLidAngle = targetAngle;
        screenGlow = targetGlow;
      } else {
        currentLidAngle = THREE.MathUtils.damp(
          currentLidAngle,
          targetAngle,
          6.8,
          dt
        );
        screenGlow = THREE.MathUtils.damp(screenGlow, targetGlow, 6.2, dt);
      }

      lidPivot.rotation.x = currentLidAngle;
      screenMat.emissiveIntensity = screenGlow;
      backlightMat.emissiveIntensity = screenGlow * 0.48;
      camDotMat.emissiveIntensity = 0.15 + screenGlow * 0.85;

      // Subtle floating levitation and cursor tilt
      if (!prefersReducedMotion) {
        const hoverY = Math.sin(t * 1.7) * 0.032 + (targetOpen ? 0.03 : 0);
        rootGroup.position.y = THREE.MathUtils.damp(
          rootGroup.position.y,
          hoverY,
          5.0,
          dt
        );
        shadowPlane.position.y = -0.02 - rootGroup.position.y;
        const targetRotY = -0.26 + pointerRef.current.x * 0.14;
        const targetRotX = 0.04 - pointerRef.current.y * 0.06;
        rootGroup.rotation.y = THREE.MathUtils.damp(
          rootGroup.rotation.y,
          targetRotY,
          5.5,
          dt
        );
        rootGroup.rotation.x = THREE.MathUtils.damp(
          rootGroup.rotation.x,
          targetRotX,
          5.5,
          dt
        );
      }

      // Gentle camera framing shift when opened so full screen stays crisp
      _vec3.set(
        targetOpen ? 1.55 : 1.88,
        targetOpen ? 1.42 : 1.32,
        targetOpen ? 3.55 : 3.65
      );
      camera.position.lerp(_vec3, prefersReducedMotion ? 1 : 1 - Math.exp(-4.5 * dt));
      camera.lookAt(0, targetOpen ? 0.42 : 0.18, 0);

      renderer.render(scene, camera);

      if (isSoftwareGl) {
        afterDraw(() => tick(performance.now()));
      } else {
        frameId = requestAnimationFrame(tick);
      }
    }

    frameId = requestAnimationFrame(tick);

    return () => {
      disposed = true;
      cancelAnimationFrame(frameId);
      clearTimeout(frameId);
      resizeObserver.disconnect();
      renderer.domElement.removeEventListener("pointermove", onPointerMove);
      renderer.domElement.removeEventListener("pointerleave", onPointerLeave);
      renderer.domElement.removeEventListener("click", onClick);

      for (const g of geometries) g.dispose();
      for (const m of materials) m.dispose();
      for (const tex of textures) tex.dispose();
      envTarget.dispose();
      renderer.dispose();
      if (renderer.domElement.parentNode === container) {
        container.removeChild(renderer.domElement);
      }
    };
    // Intentionally mounted once; preset updates repaint CanvasTexture directly
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div
      ref={mountRef}
      role="img"
      aria-label="Computador 3D interativo do Artigen — passe o cursor no cabeçalho ou clique para abrir"
      className={`h-full w-full cursor-pointer select-none ${className}`}
    />
  );
}
