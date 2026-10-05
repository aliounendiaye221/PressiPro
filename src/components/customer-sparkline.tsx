"use client";

import React from "react";

interface CustomerSparklineProps {
  data?: number[];
  className?: string;
  width?: number;
  height?: number;
}

export function CustomerSparkline({
  data = [],
  className = "",
  width = 68,
  height = 24,
}: CustomerSparklineProps) {
  if (!data || data.length < 2) {
    return (
      <div
        className={`flex items-center justify-center text-[10px] text-gray-400 dark:text-gray-500 font-mono ${className}`}
        style={{ width, height }}
        title="Historique insuffisant pour une courbe"
      >
        <span className="w-1.5 h-1.5 rounded-full bg-gray-300 dark:bg-slate-600 inline-block mr-1" />
        <span className="opacity-70">—</span>
      </div>
    );
  }

  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const paddingY = 4;
  const usableHeight = height - paddingY * 2;

  // Calculate points
  const points = data.map((val, idx) => {
    const x = Math.round((idx / (data.length - 1)) * width);
    const normalizedY = (val - min) / range;
    const y = Math.round(height - paddingY - normalizedY * usableHeight);
    return { x, y, val };
  });

function getCubicBezierPath(points: { x: number; y: number }[]): string {
  if (points.length === 0) return "";
  if (points.length === 1) return `M ${points[0].x},${points[0].y}`;
  if (points.length === 2) {
    return `M ${points[0].x},${points[0].y} L ${points[1].x},${points[1].y}`;
  }

  let d = `M ${points[0].x},${points[0].y}`;
  const tension = 0.2;

  for (let i = 0; i < points.length - 1; i++) {
    const p0 = i > 0 ? points[i - 1] : points[i];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = i < points.length - 2 ? points[i + 2] : p2;

    const cp1x = p1.x + (p2.x - p0.x) * tension;
    const cp1y = p1.y + (p2.y - p0.y) * tension;
    const cp2x = p2.x - (p3.x - p1.x) * tension;
    const cp2y = p2.y - (p3.y - p1.y) * tension;

    d += ` C ${cp1x.toFixed(1)},${cp1y.toFixed(1)} ${cp2x.toFixed(1)},${cp2y.toFixed(1)} ${p2.x.toFixed(1)},${p2.y.toFixed(1)}`;
  }

  return d;
}

  const pathD = getCubicBezierPath(points);

  // Area path for gradient fill
  const lastPoint = points[points.length - 1];
  const firstPoint = points[0];
  const areaD = `${pathD} L ${lastPoint.x} ${height} L ${firstPoint.x} ${height} Z`;

  // Trend direction: is the last order higher than the first?
  const isUp = data[data.length - 1] >= data[0];
  const strokeColor = isUp ? "#10b981" : "#06b6d4"; // Emerald or Cyan
  const gradientId = `sparkline-grad-${data.join("-").slice(0, 8)}`;

  return (
    <div
      className={`relative inline-flex items-center ${className}`}
      style={{ width, height }}
      title={`Tendance de dépenses : ${data.map((n) => Math.round(n) + " F").join(" → ")}`}
    >
      <svg
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        className="overflow-visible"
      >
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={strokeColor} stopOpacity="0.25" />
            <stop offset="100%" stopColor={strokeColor} stopOpacity="0.0" />
          </linearGradient>
        </defs>

        {/* Shaded Area */}
        <path d={areaD} fill={`url(#${gradientId})`} />

        {/* Line */}
        <path
          d={pathD}
          fill="none"
          stroke={strokeColor}
          strokeWidth="1.75"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* End dot */}
        <circle
          cx={points[points.length - 1].x}
          cy={points[points.length - 1].y}
          r="2.5"
          fill={strokeColor}
          className="animate-pulse"
        />
      </svg>
    </div>
  );
}
