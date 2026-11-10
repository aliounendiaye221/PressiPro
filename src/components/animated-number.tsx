"use client";

import { useEffect, useRef, useState } from "react";

interface AnimatedNumberProps {
  value: number;
  suffix?: string;
  prefix?: string;
  duration?: number;
  formatAsFCFA?: boolean;
  formatFCFA?: boolean;
  className?: string;
}

function formatFCFASuffix(n: number): string {
  return Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ");
}

export function AnimatedNumber({
  value,
  suffix = "",
  prefix = "",
  duration = 900,
  formatAsFCFA = true,
  formatFCFA,
  className = "",
}: AnimatedNumberProps) {
  const [displayValue, setDisplayValue] = useState(0);
  const currentRef = useRef(0);

  useEffect(() => {
    const startVal = currentRef.current;
    const endVal = value;

    if (startVal === endVal) return;

    if (typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) {
      const id = requestAnimationFrame(() => {
        currentRef.current = endVal;
        setDisplayValue(endVal);
      });
      return () => cancelAnimationFrame(id);
    }

    let startTimestamp: number | null = null;
    let animationFrameId: number;

    const step = (timestamp: number) => {
      if (!startTimestamp) startTimestamp = timestamp;
      const progress = Math.min((timestamp - startTimestamp) / duration, 1);
      const easeProgress = 1 - Math.pow(1 - progress, 3);
      const current = Math.round(startVal + (endVal - startVal) * easeProgress);

      currentRef.current = current;
      setDisplayValue(current);

      if (progress < 1) {
        animationFrameId = requestAnimationFrame(step);
      } else {
        currentRef.current = endVal;
        setDisplayValue(endVal);
      }
    };

    animationFrameId = requestAnimationFrame(step);

    return () => {
      cancelAnimationFrame(animationFrameId);
    };
  }, [value, duration]);

  const shouldFormatFCFA = formatFCFA !== undefined ? formatFCFA : formatAsFCFA;

  const formatted = shouldFormatFCFA
    ? `${prefix}${formatFCFASuffix(displayValue)}${suffix ? ` ${suffix}` : ""}`
    : `${prefix}${displayValue}${suffix}`;

  return <span className={className}>{formatted}</span>;
}
