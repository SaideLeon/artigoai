"use client";

import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import {
  createWritingMascot,
  type WritingMascotRig,
} from "@/components/mascot/WritingMascotModel";
import BrandLogo from "@/components/BrandLogo";

export type WritingMascotSceneProps = {
  paused?: boolean;
  rotationDeg?: number;
  scale?: number;
  blinkNonce?: number;
  interactive?: boolean;
  cameraZ?: number;
  onRotationChange?: (deg: number) => void;
  onRobotClick?: () => void;
  className?: string;
  ariaLabel?: string;
};

function detectSoftwareWebGL(): boolean {
  try {
    const canvas = document.createElement("canvas");
    const gl = canvas.getContext("webgl2");
    if (!gl) return true;
    const ext = gl.getExtension("WEBGL_debug_renderer_info");
    const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
    const gpu = String(gl.getParameter(param) ?? "");
    gl.getExtension("WEBGL_lose_context")?.loseContext();
    return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
  } catch {
    return true;
  }
}

export default function WritingMascotScene({
  paused = false,
  rotationDeg = 0,
  scale = 1,
  blinkNonce = 0,
  interactive = true,
  cameraZ = 4.25,
  onRotationChange,
  onRobotClick,
  className = "h-full w-full",
  ariaLabel = "Mulébi sentado nos livros a redigir no portátil",
}: WritingMascotSceneProps) {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const [contextLost, setContextLost] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);

  const stateRef = useRef({
    paused,
    rotationDeg,
    scale,
    reducedMotion: false,
  });

  useEffect(() => {
    stateRef.current.paused = paused;
    stateRef.current.rotationDeg = rotationDeg;
    stateRef.current.scale = scale;
  }, [paused, rotationDeg, scale]);

  const callbacksRef = useRef({
    onRotationChange,
    onRobotClick,
  });
  useEffect(() => {
    callbacksRef.current.onRotationChange = onRotationChange;
    callbacksRef.current.onRobotClick = onRobotClick;
  }, [onRotationChange, onRobotClick]);

  const blinkTriggerRef = useRef<() => void>(() => {});
  useEffect(() => {
    if (blinkNonce > 0) {
      blinkTriggerRef.current();
    }
  }, [blinkNonce]);

  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    let active = true;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => {
      if (!active) return;
      setReducedMotion(mq.matches);
      stateRef.current.reducedMotion = mq.matches;
    };
    Promise.resolve().then(sync);
    mq.addEventListener("change", sync);
    return () => {
      active = false;
      mq.removeEventListener("change", sync);
    };
  }, []);

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const isSoftwareGl = detectSoftwareWebGL();
    const isLowPowerMobile =
      typeof navigator !== "undefined" &&
      (navigator.hardwareConcurrency ?? 4) <= 4;

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({
        antialias: !isSoftwareGl,
        alpha: true,
        powerPreference: isLowPowerMobile ? "default" : "high-performance",
      });
    } catch {
      Promise.resolve().then(() => setContextLost(true));
      return;
    }

    renderer.setClearColor(0x000000, 0);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.04;
    renderer.setPixelRatio(
      isSoftwareGl
        ? 1
        : Math.min(window.devicePixelRatio || 1, isLowPowerMobile ? 1.5 : 2)
    );
    renderer.shadowMap.enabled = !isSoftwareGl && !isLowPowerMobile;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    const canvas = renderer.domElement;
    canvas.style.width = "100%";
    canvas.style.height = "100%";
    canvas.style.display = "block";
    canvas.style.touchAction = interactive ? "pan-y" : "auto";
    container.appendChild(canvas);

    const scene = new THREE.Scene();
    const initialW = Math.max(container.clientWidth, 140);
    const initialH = Math.max(container.clientHeight, 140);
    const camera = new THREE.PerspectiveCamera(
      34,
      initialW / initialH,
      0.1,
      50
    );
    camera.position.set(0.06, 0.28, cameraZ);
    camera.lookAt(0.06, 0.14, 0);
    renderer.setSize(initialW, initialH, false);

    // Studio IBL reflections
    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    const roomEnv = new RoomEnvironment();
    const envTarget = pmremGenerator.fromScene(roomEnv, 0.04);
    scene.environment = envTarget.texture;
    roomEnv.dispose();
    pmremGenerator.dispose();

    // Balanced warm/cool studio lighting
    const hemiLight = new THREE.HemisphereLight(0xeef2ff, 0x312e81, 0.72);
    scene.add(hemiLight);

    const keyLight = new THREE.DirectionalLight(0xffffff, 1.3);
    keyLight.position.set(3.4, 4.8, 4.2);
    if (renderer.shadowMap.enabled) {
      keyLight.castShadow = true;
      keyLight.shadow.mapSize.set(1024, 1024);
      keyLight.shadow.camera.near = 0.5;
      keyLight.shadow.camera.far = 14;
      keyLight.shadow.camera.left = -2.2;
      keyLight.shadow.camera.right = 2.2;
      keyLight.shadow.camera.top = 2.2;
      keyLight.shadow.camera.bottom = -2.2;
      keyLight.shadow.bias = -0.0004;
      keyLight.shadow.normalBias = 0.02;
    }
    scene.add(keyLight);

    const fillLight = new THREE.DirectionalLight(0xc7d2fe, 0.62);
    fillLight.position.set(-3.2, 2.4, 2.6);
    scene.add(fillLight);

    const rimLight = new THREE.DirectionalLight(0x818cf8, 0.92);
    rimLight.position.set(-1.6, 2.9, -3.5);
    scene.add(rimLight);

    const { rig, dispose: disposeMascot } = createWritingMascot(
      renderer.capabilities.getMaxAnisotropy()
    );
    scene.add(rig.root);

    if (!isSoftwareGl) {
      renderer.compile(scene, camera);
    }

    // Pointer tracking & drag-to-rotate
    const pointerTarget = { x: 0, y: 0 };
    let isDragging = false;
    let dragDistance = 0;
    let lastClientX = 0;
    let localRotDeg = stateRef.current.rotationDeg;

    const handlePointerMove = (e: PointerEvent) => {
      if (!interactive) return;
      const rect = canvas.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
        const nx = ((e.clientX - rect.left) / rect.width) * 2 - 1;
        const ny = -(((e.clientY - rect.top) / rect.height) * 2 - 1);
        pointerTarget.x = THREE.MathUtils.clamp(nx, -1, 1);
        pointerTarget.y = THREE.MathUtils.clamp(ny, -1, 1);
      }
      if (isDragging) {
        const dx = e.clientX - lastClientX;
        lastClientX = e.clientX;
        dragDistance += Math.abs(dx);
        localRotDeg = ((localRotDeg + dx * 0.65 + 540) % 360) - 180;
        stateRef.current.rotationDeg = localRotDeg;
        callbacksRef.current.onRotationChange?.(Math.round(localRotDeg));
      }
    };

    const handlePointerLeave = () => {
      if (!isDragging) {
        pointerTarget.x = 0;
        pointerTarget.y = 0;
      }
    };

    const handlePointerDown = (e: PointerEvent) => {
      if (!interactive) return;
      isDragging = true;
      dragDistance = 0;
      lastClientX = e.clientX;
      localRotDeg = stateRef.current.rotationDeg;
      canvas.setPointerCapture?.(e.pointerId);
    };

    const handlePointerUp = (e: PointerEvent) => {
      if (!interactive) return;
      if (isDragging && dragDistance < 6) {
        callbacksRef.current.onRobotClick?.();
      }
      isDragging = false;
      canvas.releasePointerCapture?.(e.pointerId);
    };

    if (interactive) {
      canvas.addEventListener("pointermove", handlePointerMove);
      canvas.addEventListener("pointerleave", handlePointerLeave);
      canvas.addEventListener("pointerdown", handlePointerDown);
      window.addEventListener("pointerup", handlePointerUp);
    }

    const handleContextLost = (e: Event) => {
      e.preventDefault();
      setContextLost(true);
    };
    const handleContextRestored = () => {
      setContextLost(false);
    };
    canvas.addEventListener("webglcontextlost", handleContextLost);
    canvas.addEventListener("webglcontextrestored", handleContextRestored);

    const resizeObserver = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;
      const w = Math.max(Math.floor(entry.contentRect.width), 80);
      const h = Math.max(Math.floor(entry.contentRect.height), 80);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h, false);
    });
    resizeObserver.observe(container);

    // Procedural typing, cheerful blinking & floating lightbulb loop
    let frameId = 0;
    let disposed = false;
    let lastTime = performance.now();
    let elapsed = 0;
    let blinkTimer = 2.8;
    let blinkProgress = 0;
    let isBlinking = false;

    blinkTriggerRef.current = () => {
      if (!isBlinking) {
        isBlinking = true;
        blinkProgress = 0;
      }
    };

    function updateRig(r: WritingMascotRig, dt: number) {
      const s = stateRef.current;
      const safeDt = Math.min(dt, 0.05);

      if (!s.paused && !s.reducedMotion) {
        elapsed += safeDt;
        blinkTimer -= safeDt;
        if (blinkTimer <= 0 && !isBlinking) {
          isBlinking = true;
          blinkProgress = 0;
          blinkTimer = 2.6 + ((Math.sin(elapsed * 13.7) + 1) * 0.5) * 2.0;
        }
        if (isBlinking) {
          blinkProgress += safeDt * 7.5;
          if (blinkProgress >= 1) {
            isBlinking = false;
            blinkProgress = 0;
          }
        }
      }

      const t = s.reducedMotion ? 0 : elapsed;
      const blinkMult = isBlinking
        ? 1 - Math.sin(blinkProgress * Math.PI) * 0.85
        : 1;

      // Smooth root rotation & scale
      r.root.rotation.y = THREE.MathUtils.damp(
        r.root.rotation.y,
        THREE.MathUtils.degToRad(s.rotationDeg),
        10,
        safeDt
      );
      const curScale = THREE.MathUtils.damp(
        r.root.scale.x,
        s.scale,
        10,
        safeDt
      );
      r.root.scale.setScalar(curScale);

      // Gentle seated breathing & eager writing nod
      r.bodyPivot.rotation.x = THREE.MathUtils.damp(
        r.bodyPivot.rotation.x,
        0.04 + Math.sin(t * 3.1) * 0.02,
        10,
        safeDt
      );
      r.headPivot.rotation.x = THREE.MathUtils.damp(
        r.headPivot.rotation.x,
        0.08 + Math.sin(t * 2.6) * 0.025 - pointerTarget.y * 0.1,
        10,
        safeDt
      );
      r.headPivot.rotation.y = THREE.MathUtils.damp(
        r.headPivot.rotation.y,
        Math.sin(t * 1.9) * 0.07 + pointerTarget.x * 0.18,
        10,
        safeDt
      );
      r.headPivot.rotation.z = THREE.MathUtils.damp(
        r.headPivot.rotation.z,
        Math.sin(t * 1.4) * 0.04,
        10,
        safeDt
      );

      // Energetic alternating typing hands on laptop keyboard
      const leftType = Math.sin(t * 13.5);
      const rightType = Math.cos(t * 14.5);

      r.leftArmPivot.rotation.x = THREE.MathUtils.damp(
        r.leftArmPivot.rotation.x,
        -0.72 + leftType * 0.05,
        16,
        safeDt
      );
      r.leftForearmPivot.rotation.x = THREE.MathUtils.damp(
        r.leftForearmPivot.rotation.x,
        -0.92 + leftType * 0.14,
        18,
        safeDt
      );
      r.leftHand.rotation.x = THREE.MathUtils.damp(
        r.leftHand.rotation.x,
        0.18 - leftType * 0.22,
        20,
        safeDt
      );

      r.rightArmPivot.rotation.x = THREE.MathUtils.damp(
        r.rightArmPivot.rotation.x,
        -0.72 + rightType * 0.05,
        16,
        safeDt
      );
      r.rightForearmPivot.rotation.x = THREE.MathUtils.damp(
        r.rightForearmPivot.rotation.x,
        -0.92 + rightType * 0.14,
        18,
        safeDt
      );
      r.rightHand.rotation.x = THREE.MathUtils.damp(
        r.rightHand.rotation.x,
        0.18 - rightType * 0.22,
        20,
        safeDt
      );

      // Happy eyes blink & gentle glow pulse
      r.leftEye.scale.y = THREE.MathUtils.damp(
        r.leftEye.scale.y,
        blinkMult,
        20,
        safeDt
      );
      r.rightEye.scale.y = THREE.MathUtils.damp(
        r.rightEye.scale.y,
        blinkMult,
        20,
        safeDt
      );

      // Floating glowing idea lightbulb above right of head
      r.lightbulbGroup.position.y = THREE.MathUtils.damp(
        r.lightbulbGroup.position.y,
        1.84 + Math.sin(t * 2.4) * 0.045,
        10,
        safeDt
      );
      const bulbPulse = 1.25 + Math.sin(t * 4.0) * 0.32;
      r.bulbGlassMat.emissiveIntensity = bulbPulse;
      for (let i = 0; i < r.bulbRayMats.length; i++) {
        r.bulbRayMats[i].emissiveIntensity =
          1.15 + Math.sin(t * 4.0 + i * 0.5) * 0.35;
      }

      // Soft laptop screen flicker while typing
      const screenPulse = 1.05 + Math.sin(t * 8.5) * 0.14;
      r.screenGlowMat.emissiveIntensity = screenPulse;
      r.screenLight.intensity = 0.58 + Math.sin(t * 8.5) * 0.1;
    }

    function afterDraw(cb: () => void) {
      const gl = renderer.getContext() as WebGL2RenderingContext;
      if (!gl || typeof gl.fenceSync !== "function") {
        frameId = window.setTimeout(cb, 80);
        return;
      }
      const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
      gl.flush();
      const poll = () => {
        if (disposed) {
          if (sync) gl.deleteSync(sync);
          return;
        }
        const status = sync
          ? gl.getSyncParameter(sync, gl.SYNC_STATUS)
          : gl.SIGNALED;
        if (status === gl.UNSIGNALED) {
          frameId = window.setTimeout(poll, 5);
        } else {
          if (sync) gl.deleteSync(sync);
          frameId = window.setTimeout(cb, 80);
        }
      };
      frameId = window.setTimeout(poll, 5);
    }

    function tick(now?: number) {
      if (disposed) return;
      const currentNow = now ?? performance.now();
      const dt = Math.min((currentNow - lastTime) / 1000, 0.05);
      lastTime = currentNow;

      updateRig(rig, dt);
      renderer.render(scene, camera);

      if (isSoftwareGl) {
        afterDraw(() => tick());
      } else {
        frameId = requestAnimationFrame(tick);
      }
    }

    tick(performance.now());

    return () => {
      disposed = true;
      cancelAnimationFrame(frameId);
      clearTimeout(frameId);
      resizeObserver.disconnect();

      if (interactive) {
        canvas.removeEventListener("pointermove", handlePointerMove);
        canvas.removeEventListener("pointerleave", handlePointerLeave);
        canvas.removeEventListener("pointerdown", handlePointerDown);
        window.removeEventListener("pointerup", handlePointerUp);
      }
      canvas.removeEventListener("webglcontextlost", handleContextLost);
      canvas.removeEventListener("webglcontextrestored", handleContextRestored);

      scene.remove(rig.root);
      disposeMascot();
      envTarget.dispose();
      renderer.dispose();

      if (canvas.parentNode === container) {
        container.removeChild(canvas);
      }
    };
  }, [cameraZ, interactive]);

  return (
    <div
      className={`relative select-none ${className}`}
      role="img"
      aria-label={ariaLabel}
    >
      <div
        ref={mountRef}
        className={`h-full w-full ${
          interactive ? "cursor-grab active:cursor-grabbing" : ""
        }`}
      />

      {contextLost && (
        <div className="absolute inset-0 flex flex-col items-center justify-center rounded-2xl bg-slate-100/90 p-4 text-center dark:bg-slate-900/90">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-[#5B4AF4] to-[#2563EB] text-white shadow-md">
            <BrandLogo className="size-7 text-white" />
          </div>
          <p className="mt-2 text-xs font-bold text-slate-900 dark:text-white">
            Mulébi · Mascote 3D
          </p>
        </div>
      )}

      {reducedMotion && !contextLost && (
        <span className="sr-only">
          Animações contínuas reduzidas de acordo com as preferências do sistema.
        </span>
      )}
    </div>
  );
}
