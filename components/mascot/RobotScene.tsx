"use client";

import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { createArtigenRobot, type RobotRig } from "@/components/mascot/RobotModel";
import {
  RobotAnimator,
  type RobotAnimationState,
  type RobotExpression,
} from "@/components/mascot/RobotAnimations";
import BrandLogo from "@/components/BrandLogo";

export type RobotSceneProps = {
  animation?: RobotAnimationState;
  expression?: RobotExpression;
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

export default function RobotScene({
  animation = "idle",
  expression = "neutral",
  paused = false,
  rotationDeg = 0,
  scale = 1,
  blinkNonce = 0,
  interactive = true,
  cameraZ = 4.55,
  onRotationChange,
  onRobotClick,
  className = "h-full w-full",
  ariaLabel = "Mascote 3D interativo Artigen AI Assistant",
}: RobotSceneProps) {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const [contextLost, setContextLost] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);

  // Store reactive props in refs so WebGL context is created once and never torn down
  const stateRef = useRef({
    animation,
    expression,
    paused,
    rotationDeg,
    scale,
    reducedMotion: false,
  });

  useEffect(() => {
    stateRef.current.animation = animation;
    stateRef.current.expression = expression;
    stateRef.current.paused = paused;
    stateRef.current.rotationDeg = rotationDeg;
    stateRef.current.scale = scale;
  }, [animation, expression, paused, rotationDeg, scale]);

  const callbacksRef = useRef({
    onRotationChange,
    onRobotClick,
  });
  useEffect(() => {
    callbacksRef.current.onRotationChange = onRotationChange;
    callbacksRef.current.onRobotClick = onRobotClick;
  }, [onRotationChange, onRobotClick]);

  const animatorRef = useRef<RobotAnimator | null>(null);

  // Trigger manual blink whenever blinkNonce increments
  useEffect(() => {
    if (blinkNonce > 0) {
      animatorRef.current?.triggerBlink();
    }
  }, [blinkNonce]);

  // Respect prefers-reduced-motion
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
    renderer.toneMappingExposure = 0.98;
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

    // Scene & Camera
    const scene = new THREE.Scene();
    const initialW = Math.max(container.clientWidth, 160);
    const initialH = Math.max(container.clientHeight, 160);
    const camera = new THREE.PerspectiveCamera(
      36,
      initialW / initialH,
      0.1,
      50
    );
    camera.position.set(0, 0.28, cameraZ);
    camera.lookAt(0, 0.18, 0);
    renderer.setSize(initialW, initialH, false);

    // Procedural Studio Reflections (RoomEnvironment)
    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    const roomEnv = new RoomEnvironment();
    const envTarget = pmremGenerator.fromScene(roomEnv, 0.04);
    scene.environment = envTarget.texture;
    roomEnv.dispose();
    pmremGenerator.dispose();

    // Balanced 3-Point Studio Lighting
    const hemiLight = new THREE.HemisphereLight(0xdbeafe, 0x1e1b4b, 0.65);
    scene.add(hemiLight);

    const keyLight = new THREE.DirectionalLight(0xffffff, 1.25);
    keyLight.position.set(3.2, 4.4, 4.0);
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

    // Cool fill + electric indigo rim highlight
    const fillLight = new THREE.DirectionalLight(0x93c5fd, 0.55);
    fillLight.position.set(-3.5, 2.2, 2.5);
    scene.add(fillLight);

    const rimLight = new THREE.DirectionalLight(0x818cf8, 0.95);
    rimLight.position.set(-1.5, 2.8, -3.6);
    scene.add(rimLight);

    // Ground plane to catch subtle soft shadow when enabled
    const shadowCatcherGeo = new THREE.PlaneGeometry(5, 5);
    const shadowCatcherMat = new THREE.ShadowMaterial({ opacity: 0.14 });
    const shadowCatcher = new THREE.Mesh(shadowCatcherGeo, shadowCatcherMat);
    shadowCatcher.rotation.x = -Math.PI / 2;
    shadowCatcher.position.y = -1.165;
    shadowCatcher.receiveShadow = true;
    scene.add(shadowCatcher);

    // Procedural Robot Assembly
    const { rig, dispose: disposeRobot } = createArtigenRobot();
    scene.add(rig.root);

    const animator = new RobotAnimator();
    animatorRef.current = animator;

    if (!isSoftwareGl) {
      renderer.compile(scene, camera);
    }

    // Pointer tracking & drag-to-rotate state
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

    // ResizeObserver for crisp responsive sizing
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

    // Animation loop with Software-WebGL GPU pacing
    let frameId = 0;
    let disposed = false;
    let lastTime = performance.now();

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
        const status = sync ? gl.getSyncParameter(sync, gl.SYNC_STATUS) : gl.SIGNALED;
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

      const s = stateRef.current;
      animator.update(rig as RobotRig, dt, {
        animation: s.animation,
        expression: s.expression,
        pointerX: pointerTarget.x,
        pointerY: pointerTarget.y,
        manualRotationY: THREE.MathUtils.degToRad(s.rotationDeg),
        targetScale: s.scale,
        paused: s.paused,
        reducedMotion: s.reducedMotion,
      });

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
      disposeRobot();
      shadowCatcherGeo.dispose();
      shadowCatcherMat.dispose();
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
        <div className="absolute inset-0 flex flex-col items-center justify-center rounded-2xl bg-slate-100/90 p-6 text-center dark:bg-slate-900/90">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-[#5B4AF4] to-[#2563EB] text-white shadow-md">
            <BrandLogo className="size-9 text-white" />
          </div>
          <p className="mt-3 text-sm font-bold text-slate-900 dark:text-white">
            Artigen AI Assistant
          </p>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            Visualização 2D de reserva ativada neste dispositivo.
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
