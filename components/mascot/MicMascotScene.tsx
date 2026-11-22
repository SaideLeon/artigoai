"use client";

import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import {
  createMicMascot,
  type MicMascotRig,
} from "@/components/mascot/MicMascotModel";
import BrandLogo from "@/components/BrandLogo";

export type MicMascotSceneProps = {
  isRecording?: boolean;
  audioLevel?: number; // 0..1 live mic voice level
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

export default function MicMascotScene({
  isRecording = true,
  audioLevel = 0.25,
  paused = false,
  rotationDeg = 0,
  scale = 1,
  blinkNonce = 0,
  interactive = true,
  cameraZ = 4.6,
  onRotationChange,
  onRobotClick,
  className = "h-full w-full",
  ariaLabel = "Mulébi segurando um microfone com ondas sonoras",
}: MicMascotSceneProps) {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const [contextLost, setContextLost] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);

  const stateRef = useRef({
    isRecording,
    audioLevel,
    paused,
    rotationDeg,
    scale,
    reducedMotion: false,
  });

  useEffect(() => {
    stateRef.current.isRecording = isRecording;
    stateRef.current.audioLevel = THREE.MathUtils.clamp(audioLevel, 0, 1);
    stateRef.current.paused = paused;
    stateRef.current.rotationDeg = rotationDeg;
    stateRef.current.scale = scale;
  }, [isRecording, audioLevel, paused, rotationDeg, scale]);

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
    renderer.toneMappingExposure = 1.05;
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
    camera.position.set(0, 0.25, cameraZ);
    camera.lookAt(0, 0.08, 0);
    renderer.setSize(initialW, initialH, false);

    // Mandatory studio environment reflection
    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    const roomEnv = new RoomEnvironment();
    const envTarget = pmremGenerator.fromScene(roomEnv, 0.04);
    scene.environment = envTarget.texture;
    roomEnv.dispose();
    pmremGenerator.dispose();

    // Warm/cool studio lighting
    const hemiLight = new THREE.HemisphereLight(0xeef2ff, 0x312e81, 0.72);
    scene.add(hemiLight);

    const keyLight = new THREE.DirectionalLight(0xffffff, 1.32);
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

    const fillLight = new THREE.DirectionalLight(0xc7d2fe, 0.65);
    fillLight.position.set(-3.2, 2.4, 2.6);
    scene.add(fillLight);

    const rimLight = new THREE.DirectionalLight(0x818cf8, 0.95);
    rimLight.position.set(-1.6, 2.9, -3.5);
    scene.add(rimLight);

    const { rig, dispose: disposeMascot } = createMicMascot(
      renderer.capabilities.getMaxAnisotropy()
    );
    scene.add(rig.root);

    if (!isSoftwareGl) {
      renderer.compile(scene, camera);
    }

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

    let frameId = 0;
    let disposed = false;
    let lastTime = performance.now();
    let elapsed = 0;
    let smoothLevel = 0;
    let blinkTimer = 2.5;
    let blinkProgress = 0;
    let isBlinking = false;

    blinkTriggerRef.current = () => {
      if (!isBlinking) {
        isBlinking = true;
        blinkProgress = 0;
      }
    };

    function updateRig(r: MicMascotRig, dt: number) {
      const s = stateRef.current;
      const safeDt = Math.min(dt, 0.05);

      if (!s.paused && !s.reducedMotion) {
        elapsed += safeDt;
        blinkTimer -= safeDt;
        if (blinkTimer <= 0 && !isBlinking) {
          isBlinking = true;
          blinkProgress = 0;
          blinkTimer = 2.4 + ((Math.sin(elapsed * 14.3) + 1) * 0.5) * 2.1;
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
      const targetLevel = s.isRecording ? Math.max(0.18, s.audioLevel) : 0.04;
      smoothLevel = THREE.MathUtils.damp(smoothLevel, targetLevel, 14, safeDt);

      const blinkMult = isBlinking
        ? 1 - Math.sin(blinkProgress * Math.PI) * 0.88
        : 1;

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

      // Attentive breathing & lively listening head tilt
      r.bodyPivot.position.y = THREE.MathUtils.damp(
        r.bodyPivot.position.y,
        Math.sin(t * 2.2) * (0.02 + smoothLevel * 0.015),
        10,
        safeDt
      );
      r.headPivot.rotation.x = THREE.MathUtils.damp(
        r.headPivot.rotation.x,
        -0.01 + Math.sin(t * 2.8) * (0.02 + smoothLevel * 0.035) - pointerTarget.y * 0.14,
        10,
        safeDt
      );
      r.headPivot.rotation.y = THREE.MathUtils.damp(
        r.headPivot.rotation.y,
        Math.sin(t * 1.5) * 0.05 + pointerTarget.x * 0.22,
        10,
        safeDt
      );
      r.headPivot.rotation.z = THREE.MathUtils.damp(
        r.headPivot.rotation.z,
        0.04 + Math.sin(t * 1.9) * 0.04,
        10,
        safeDt
      );

      // Left-side arm reaches forward offering microphone to user like an interviewer
      r.leftArmPivot.rotation.x = THREE.MathUtils.damp(
        r.leftArmPivot.rotation.x,
        -0.82 + Math.sin(t * 2.2) * (0.025 + smoothLevel * 0.03),
        12,
        safeDt
      );
      r.leftForearmPivot.rotation.x = THREE.MathUtils.damp(
        r.leftForearmPivot.rotation.x,
        -1.12 - smoothLevel * 0.05 + Math.sin(t * 2.8) * 0.025,
        12,
        safeDt
      );

      // Right-side arm gestures warmly with open welcoming palm
      r.rightArmPivot.rotation.z = THREE.MathUtils.damp(
        r.rightArmPivot.rotation.z,
        0.52 + Math.sin(t * 2.4) * (0.035 + smoothLevel * 0.07),
        10,
        safeDt
      );
      r.rightForearmPivot.rotation.x = THREE.MathUtils.damp(
        r.rightForearmPivot.rotation.x,
        -0.98 - Math.cos(t * 2.8) * (0.04 + smoothLevel * 0.09),
        10,
        safeDt
      );
      for (let i = 0; i < r.rightHandRig.allFingers.length; i++) {
        const f = r.rightHandRig.allFingers[i];
        const waveOffset = Math.sin(t * 3.2 + i * 0.45) * (0.04 + smoothLevel * 0.08);
        f.proximal.rotation.x = -(0.22 + i * 0.06) + waveOffset;
      }

      // Eyes & smile react to voice energy
      r.leftEye.scale.y = THREE.MathUtils.damp(
        r.leftEye.scale.y,
        blinkMult * (1 + smoothLevel * 0.12),
        18,
        safeDt
      );
      r.rightEye.scale.y = THREE.MathUtils.damp(
        r.rightEye.scale.y,
        blinkMult * (1 + smoothLevel * 0.12),
        18,
        safeDt
      );
      r.smileArc.scale.setScalar(
        THREE.MathUtils.damp(
          r.smileArc.scale.x,
          1 + smoothLevel * 0.25,
          14,
          safeDt
        )
      );

      // Microphone LED + Chest core glow + Floor ring
      const ledBoost = s.isRecording
        ? 1.35 + smoothLevel * 1.45 + Math.sin(t * 7.5) * 0.25
        : 0.45;
      r.micLedMat.emissiveIntensity = ledBoost;
      r.micLedMat.color.setHex(s.isRecording ? 0x38bdf8 : 0x6366f1);
      r.chestCoreMat.emissiveIntensity = 1.0 + smoothLevel * 0.9;
      r.floorRingMat.opacity = s.isRecording
        ? 0.34 + smoothLevel * 0.32 + Math.sin(t * 3.0) * 0.08
        : 0.22;

      // Flanking blue acoustic wave arcs (left & right of Mulébi)
      const waveSpeed = s.isRecording ? 1.55 + smoothLevel * 1.3 : 0.4;
      for (let i = 0; i < r.sideWaves.length; i++) {
        const w = r.sideWaves[i];
        const ringIdx = i % 3;
        const phase = (t * waveSpeed + (2 - ringIdx) * 0.33) % 1;
        const pulseScale = 0.88 + phase * (0.28 + smoothLevel * 0.34);
        w.group.scale.setScalar(pulseScale);
        w.group.position.x =
          w.baseX + w.dirX * (ringIdx * 0.05 + phase * (0.04 + smoothLevel * 0.08));
        const envelope = Math.sin(phase * Math.PI);
        const visibility = s.isRecording ? 0.42 + smoothLevel * 0.58 : 0.22;
        w.material.opacity = 0.25 + envelope * visibility;
        w.material.emissiveIntensity = 1.15 + smoothLevel * 1.35;
      }

      // Ground shadow responsiveness
      const shadowScale = 1 - r.bodyPivot.position.y * 0.4;
      r.shadowPlane.scale.setScalar(THREE.MathUtils.clamp(shadowScale, 0.82, 1.12));
      r.shadowMat.opacity = THREE.MathUtils.clamp(
        0.65 - r.bodyPivot.position.y * 0.8,
        0.35,
        0.72
      );
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
