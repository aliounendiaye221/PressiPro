"use client";

import { useEffect, useState } from "react";

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

  useEffect(() => {
    let startTimestamp: number | null = null;
    const startVal = displayValue;
    const endVal = value;

    if (startVal === endVal) return;

    let animationFrameId: number;

    const step = (timestamp: number) => {
      if (!startTimestamp) startTimestamp = timestamp;
      const progress = Math.min((timestamp - startTimestamp) / duration, 1);
      // Ease out cubic
      const easeProgress = 1 - Math.pow(1 - progress, 3);
      const current = Math.round(startVal + (endVal - startVal) * easeProgress);

      setDisplayValue(current);

      if (progress < 1) {
        animationFrameId = requestAnimationFrame(step);
      } else {
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
