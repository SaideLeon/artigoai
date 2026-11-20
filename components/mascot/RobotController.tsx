"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type {
  RobotAnimationState,
  RobotExpression,
} from "@/components/mascot/RobotAnimations";

export type RobotControllerApi = {
  animation: RobotAnimationState;
  expression: RobotExpression;
  paused: boolean;
  rotationDeg: number;
  scale: number;
  blinkNonce: number;
  setAnimation: (next: RobotAnimationState) => void;
  setExpression: (next: RobotExpression) => void;
  triggerBlink: () => void;
  setPaused: (paused: boolean) => void;
  togglePaused: () => void;
  setRotationDeg: (deg: number) => void;
  setScale: (scale: number) => void;
  cycleClickInteraction: () => void;
};

declare global {
  interface Window {
    artigenRobot?: {
      setAnimation: (next: RobotAnimationState) => void;
      setExpression: (next: RobotExpression) => void;
      triggerBlink: () => void;
      setPaused: (paused: boolean) => void;
    };
  }
}

const CLICK_EXPRESSIONS: RobotExpression[] = [
  "happy",
  "wink",
  "curious",
  "excited",
  "neutral",
];

const RobotControllerContext = createContext<RobotControllerApi | null>(null);

export function useRobotStateController(
  initialAnimation: RobotAnimationState = "idle"
): RobotControllerApi {
  const [animation, setAnimationState] =
    useState<RobotAnimationState>(initialAnimation);
  const [expression, setExpressionState] = useState<RobotExpression>("neutral");
  const [paused, setPaused] = useState(false);
  const [rotationDeg, setRotationDeg] = useState(0);
  const [scale, setScale] = useState(1);
  const [blinkNonce, setBlinkNonce] = useState(0);
  const clickCountRef = useRef(0);

  const setAnimation = useCallback((next: RobotAnimationState) => {
    setAnimationState(next);
    if (next === "idle") {
      setExpressionState("neutral");
    } else if (next === "sleeping") {
      setExpressionState("sleepy");
    } else if (next === "greeting") {
      setExpressionState("happy");
    } else if (next === "thinking") {
      setExpressionState("curious");
    } else if (next === "excited") {
      setExpressionState("excited");
    } else if (next === "pointing") {
      setExpressionState("happy");
    }
  }, []);

  const setExpression = useCallback((next: RobotExpression) => {
    setExpressionState(next);
  }, []);

  const triggerBlink = useCallback(() => {
    setBlinkNonce((n) => n + 1);
  }, []);

  const togglePaused = useCallback(() => {
    setPaused((p) => !p);
  }, []);

  const cycleClickInteraction = useCallback(() => {
    const nextCount = clickCountRef.current + 1;
    clickCountRef.current = nextCount;
    if (nextCount === 1) {
      setAnimationState("greeting");
      setExpressionState("happy");
    } else {
      const expr =
        CLICK_EXPRESSIONS[(nextCount - 1) % CLICK_EXPRESSIONS.length];
      setExpressionState(expr);
      setAnimationState(
        expr === "excited"
          ? "excited"
          : expr === "curious"
          ? "thinking"
          : "greeting"
      );
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.artigenRobot = {
      setAnimation,
      setExpression,
      triggerBlink,
      setPaused,
    };
    return () => {
      delete window.artigenRobot;
    };
  }, [setAnimation, setExpression, triggerBlink]);

  return useMemo(
    () => ({
      animation,
      expression,
      paused,
      rotationDeg,
      scale,
      blinkNonce,
      setAnimation,
      setExpression,
      triggerBlink,
      setPaused,
      togglePaused,
      setRotationDeg,
      setScale,
      cycleClickInteraction,
    }),
    [
      animation,
      expression,
      paused,
      rotationDeg,
      scale,
      blinkNonce,
      setAnimation,
      setExpression,
      triggerBlink,
      togglePaused,
      cycleClickInteraction,
    ]
  );
}

export function RobotControllerProvider({
  initialAnimation = "idle",
  children,
}: {
  initialAnimation?: RobotAnimationState;
  children: React.ReactNode;
}) {
  const api = useRobotStateController(initialAnimation);
  return (
    <RobotControllerContext.Provider value={api}>
      {children}
    </RobotControllerContext.Provider>
  );
}

export function useRobotController(): RobotControllerApi {
  const ctx = useContext(RobotControllerContext);
  if (!ctx) {
    throw new Error(
      "useRobotController deve ser usado dentro de RobotControllerProvider"
    );
  }
  return ctx;
}
