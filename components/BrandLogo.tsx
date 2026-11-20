"use client";

import { useId } from "react";
import { LOGO_PATHS } from "@/lib/logoPaths";

export type BrandLogoVariant =
  | "static"
  | "write"
  | "sequence"
  | "progress"
  | "tap";

type BrandLogoProps = {
  variant?: BrandLogoVariant;
  progress?: number;
  className?: string;
  ariaLabel?: string;
};

export function BrandLogoDefs() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      className="hidden"
      aria-hidden="true"
    >
      <defs>
        <path id="parte-1" fillRule="evenodd" d={LOGO_PATHS.parte1} />
        <path id="parte-2" fillRule="evenodd" d={LOGO_PATHS.parte2} />
        <path id="parte-3" fillRule="evenodd" d={LOGO_PATHS.parte3} />
        <path id="parte-4" fillRule="evenodd" d={LOGO_PATHS.parte4} />
        <path id="parte-5" fillRule="evenodd" d={LOGO_PATHS.parte5} />
      </defs>
      <symbol id="bi-logotipo" viewBox="0 0 16 16">
        <use href="#parte-1" />
        <use href="#parte-2" />
        <use href="#parte-3" />
        <use href="#parte-4" />
        <use href="#parte-5" />
      </symbol>
    </svg>
  );
}

export default function BrandLogo({
  variant = "static",
  progress = 1,
  className = "size-8",
  ariaLabel,
}: BrandLogoProps) {
  const rawId = useId();
  const clipId = `logo-clip-${rawId.replace(/[^a-zA-Z0-9_-]/g, "")}`;
  const clamped = Math.max(0, Math.min(1, progress));

  const ariaProps = ariaLabel
    ? ({ role: "img", "aria-label": ariaLabel } as const)
    : ({ "aria-hidden": true } as const);

  if (variant === "progress") {
    return (
      <svg
        viewBox="0 0 16 16"
        fill="currentColor"
        className={className}
        {...ariaProps}
      >
        <defs>
          <clipPath id={clipId}>
            <rect
              x="0"
              y={16 - 16 * clamped}
              width="16"
              height={16 * clamped}
            />
          </clipPath>
        </defs>
        <use href="#bi-logotipo" opacity={0.18} />
        <use href="#bi-logotipo" clipPath={`url(#${clipId})`} />
      </svg>
    );
  }

  if (variant === "write") {
    return (
      <svg
        viewBox="0 0 16 16"
        fill="currentColor"
        className={className}
        {...ariaProps}
      >
        <use href="#parte-1" />
        <use href="#parte-2" />
        <use href="#parte-3" />
        <use href="#parte-4" />
        <use href="#parte-5" className="logo-pt logo-write" />
      </svg>
    );
  }

  if (variant === "sequence") {
    return (
      <svg
        viewBox="0 0 16 16"
        fill="currentColor"
        className={className}
        {...ariaProps}
      >
        <use href="#parte-1" className="logo-pt logo-p1" />
        <use href="#parte-2" className="logo-pt logo-p2" />
        <use href="#parte-3" className="logo-pt logo-p3" />
        <use href="#parte-4" className="logo-pt logo-p4" />
        <use href="#parte-5" className="logo-pt logo-p5" />
      </svg>
    );
  }

  if (variant === "tap") {
    return (
      <svg
        viewBox="0 0 16 16"
        fill="currentColor"
        className={`animate-pulse ${className}`}
        {...ariaProps}
      >
        <use href="#parte-1" />
        <use href="#parte-2" />
        <use href="#parte-3" />
        <use href="#parte-4" />
        <use href="#parte-5" className="logo-pt logo-tap" />
      </svg>
    );
  }

  return (
    <svg
      viewBox="0 0 16 16"
      fill="currentColor"
      className={className}
      {...ariaProps}
    >
      <use href="#bi-logotipo" />
    </svg>
  );
}
