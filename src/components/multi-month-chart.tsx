"use client";

import React, { useState } from "react";
import { TrendingUp, TrendingDown } from "lucide-react";
import { triggerHaptic } from "@/lib/feedback";

interface MonthData {
  monthKey: string;
  label: string;
  revenue: number;
  expenses: number;
  netProfit: number;
  isProfit: boolean;
}

interface MultiMonthChartProps {
  data: MonthData[];
  selectedMonth: string;
  onSelectMonth: (monthKey: string) => void;
}

function formatFCFA(n: number) {
  return Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ") + " F";
}

export function MultiMonthChart({
  data,
  selectedMonth,
  onSelectMonth,
}: MultiMonthChartProps) {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  if (!data || data.length === 0) {
    return (
      <div className="h-64 flex items-center justify-center text-gray-400 dark:text-slate-500 text-sm">
        Données comparatives non disponibles
      </div>
    );
  }

  // Find max value across revenue and expenses for bar heights
  const maxBarValue = Math.max(1, ...data.map((m) => Math.max(m.revenue, m.expenses)));

  // SVG Chart Geometry
  const chartWidth = 720;
  const chartHeight = 220;
  const paddingLeft = 30;
  const paddingRight = 30;
  const paddingTop = 30;
  const paddingBottom = 40;
  const usableWidth = chartWidth - paddingLeft - paddingRight;
  const usableHeight = chartHeight - paddingTop - paddingBottom;

  const colWidth = usableWidth / data.length;
  const barWidth = Math.min(22, colWidth * 0.28);
  const gap = 4;

  // Compute profit line range (minProfit to maxProfit)
  const profits = data.map((d) => d.netProfit);
  const maxProfit = Math.max(...profits, 1);
  const minProfit = Math.min(...profits, 0);
  const profitRange = (maxProfit - minProfit) || 1;

  // Generate coordinates for profit line
  const profitPoints = data.map((d, idx) => {
    const cx = paddingLeft + idx * colWidth + colWidth / 2;
    // Map net profit: top when high profit, lower when loss
    const normalized = (d.netProfit - minProfit) / profitRange;
    const cy = paddingTop + (1 - normalized) * (usableHeight - 20) + 10;
    return { cx, cy, data: d };
  });

function getCubicBezierPath(points: { x: number; y: number }[]): string {
  if (points.length === 0) return "";
  if (points.length === 1) return `M ${points[0].x.toFixed(1)},${points[0].y.toFixed(1)}`;
  if (points.length === 2) {
    return `M ${points[0].x.toFixed(1)},${points[0].y.toFixed(1)} L ${points[1].x.toFixed(1)},${points[1].y.toFixed(1)}`;
  }

  let d = `M ${points[0].x.toFixed(1)},${points[0].y.toFixed(1)}`;
  const tension = 0.22;

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

  const profitLineD = getCubicBezierPath(profitPoints.map((pt) => ({ x: pt.cx, y: pt.cy })));

  // Baseline 0 for profit
  const zeroY = paddingTop + (1 - (0 - minProfit) / profitRange) * (usableHeight - 20) + 10;

  return (
    <div className="w-full space-y-4">
      {/* Chart Visualizer */}
      <div className="relative w-full overflow-x-auto select-none pt-2">
        <svg
          viewBox={`0 0 ${chartWidth} ${chartHeight}`}
          className="w-full h-auto min-w-[580px] overflow-visible"
        >
          <defs>
            {/* Revenue Bar Gradient */}
            <linearGradient id="bar-rev-grad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#3b82f6" />
              <stop offset="100%" stopColor="#1d4ed8" />
            </linearGradient>

            {/* Expenses Bar Gradient */}
            <linearGradient id="bar-exp-grad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#f87171" />
              <stop offset="100%" stopColor="#dc2626" />
            </linearGradient>

            {/* Profit Line Glow Filter */}
            <filter id="glow-profit" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="3" result="blur" />
              <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>
          </defs>

          {/* Grid lines */}
          <line
            x1={paddingLeft}
            y1={paddingTop}
            x2={chartWidth - paddingRight}
            y2={paddingTop}
            stroke="currentColor"
            className="text-gray-100 dark:text-slate-800"
            strokeDasharray="4 4"
          />
          <line
            x1={paddingLeft}
            y1={paddingTop + usableHeight / 2}
            x2={chartWidth - paddingRight}
            y2={paddingTop + usableHeight / 2}
            stroke="currentColor"
            className="text-gray-100 dark:text-slate-800"
            strokeDasharray="4 4"
          />
          <line
            x1={paddingLeft}
            y1={chartHeight - paddingBottom}
            x2={chartWidth - paddingRight}
            y2={chartHeight - paddingBottom}
            stroke="currentColor"
            className="text-gray-200 dark:text-slate-700"
          />

          {/* Baseline 0 Line for profit (subtle dashed) */}
          {minProfit < 0 && maxProfit > 0 && (
            <line
              x1={paddingLeft}
              y1={zeroY}
              x2={chartWidth - paddingRight}
              y2={zeroY}
              stroke="#94a3b8"
              strokeDasharray="2 3"
              strokeWidth="1"
              strokeOpacity="0.5"
            />
          )}

          {/* Render Each Month Column */}
          {data.map((m, idx) => {
            const colCenterX = paddingLeft + idx * colWidth + colWidth / 2;
            const revHeight = Math.max(6, (m.revenue / maxBarValue) * usableHeight);
            const expHeight = Math.max(6, (m.expenses / maxBarValue) * usableHeight);
            const isSelected = m.monthKey === selectedMonth;
            const isHovered = hoveredIdx === idx;

            const revX = colCenterX - barWidth - gap / 2;
            const expX = colCenterX + gap / 2;

            const revY = chartHeight - paddingBottom - revHeight;
            const expY = chartHeight - paddingBottom - expHeight;

            return (
              <g
                key={m.monthKey}
                className="cursor-pointer transition-all duration-150"
                onClick={() => {
                  triggerHaptic("selection");
                  onSelectMonth(m.monthKey);
                }}
                onMouseEnter={() => setHoveredIdx(idx)}
                onMouseLeave={() => setHoveredIdx(null)}
              >
                {/* Column Highlight Background */}
                {(isSelected || isHovered) && (
                  <rect
                    x={paddingLeft + idx * colWidth + 4}
                    y={paddingTop - 12}
                    width={colWidth - 8}
                    height={usableHeight + 46}
                    rx="12"
                    fill={isSelected ? "currentColor" : "currentColor"}
                    className={
                      isSelected
                        ? "text-primary-500/10 dark:text-primary-400/15"
                        : "text-gray-500/5 dark:text-slate-400/5"
                    }
                  />
                )}

                {/* Revenue Bar */}
                <rect
                  x={revX}
                  y={revY}
                  width={barWidth}
                  height={revHeight}
                  rx={barWidth / 2}
                  fill="url(#bar-rev-grad)"
                  className="transition-all duration-300"
                  opacity={isSelected ? 1 : 0.85}
                />

                {/* Expenses Bar */}
                <rect
                  x={expX}
                  y={expY}
                  width={barWidth}
                  height={expHeight}
                  rx={barWidth / 2}
                  fill="url(#bar-exp-grad)"
                  className="transition-all duration-300"
                  opacity={isSelected ? 1 : 0.85}
                />

                {/* Month Label */}
                <text
                  x={colCenterX}
                  y={chartHeight - paddingBottom + 20}
                  textAnchor="middle"
                  className={`text-[11px] font-bold ${
                    isSelected
                      ? "fill-primary-600 dark:fill-primary-400 font-extrabold"
                      : "fill-gray-500 dark:fill-slate-400"
                  }`}
                >
                  {m.label.split(" ")[0]}
                </text>
                <text
                  x={colCenterX}
                  y={chartHeight - paddingBottom + 33}
                  textAnchor="middle"
                  className="text-[9px] fill-gray-400 dark:fill-slate-500"
                >
                  {m.label.split(" ")[1]}
                </text>
              </g>
            );
          })}

          {/* Overlaid Net Profit Curve */}
          <path
            d={profitLineD}
            fill="none"
            stroke="#10b981"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            filter="url(#glow-profit)"
          />

          {/* Profit Nodes */}
          {profitPoints.map((pt, idx) => {
            const isSelected = pt.data.monthKey === selectedMonth;
            const isProfit = pt.data.isProfit;
            const nodeColor = isProfit ? "#10b981" : "#ef4444";

            return (
              <g
                key={idx}
                className="cursor-pointer"
                onClick={() => {
                  triggerHaptic("selection");
                  onSelectMonth(pt.data.monthKey);
                }}
              >
                {isSelected && (
                  <circle
                    cx={pt.cx}
                    cy={pt.cy}
                    r="8"
                    fill={nodeColor}
                    opacity="0.3"
                    className="animate-ping"
                  />
                )}
                <circle
                  cx={pt.cx}
                  cy={pt.cy}
                  r={isSelected ? "5" : "3.5"}
                  fill={nodeColor}
                  stroke="#ffffff"
                  strokeWidth="2"
                />
              </g>
            );
          })}
        </svg>

        {/* Floating Tooltip for Active/Hovered Month */}
        {(() => {
          const activeIdx = hoveredIdx !== null ? hoveredIdx : data.findIndex((m) => m.monthKey === selectedMonth);
          const activeMonth = data[activeIdx >= 0 ? activeIdx : 0];
          if (!activeMonth) return null;

          return (
            <div className="mt-3 flex items-center justify-between flex-wrap gap-2 p-3 rounded-xl bg-gray-50 dark:bg-slate-800/80 border border-gray-200/80 dark:border-slate-700 text-xs">
              <div className="flex items-center gap-2">
                <span className="font-bold text-gray-900 dark:text-white">
                  {activeMonth.label} :
                </span>
                <span className="text-blue-600 dark:text-blue-400 font-semibold">
                  CA: {formatFCFA(activeMonth.revenue)}
                </span>
                <span className="text-gray-300 dark:text-slate-600">|</span>
                <span className="text-red-600 dark:text-red-400 font-semibold">
                  Dépenses: {formatFCFA(activeMonth.expenses)}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-gray-600 dark:text-slate-300">
                  Résultat :
                </span>
                <span
                  className={`font-black flex items-center gap-1 ${
                    activeMonth.isProfit
                      ? "text-emerald-600 dark:text-emerald-400"
                      : "text-red-600 dark:text-red-400"
                  }`}
                >
                  {activeMonth.isProfit ? (
                    <TrendingUp className="w-3.5 h-3.5" />
                  ) : (
                    <TrendingDown className="w-3.5 h-3.5" />
                  )}
                  {activeMonth.isProfit ? "+ " : ""}
                  {formatFCFA(activeMonth.netProfit)}
                </span>
              </div>
            </div>
          );
        })()}
      </div>

      {/* 6 Monthly Summary Selector Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5 pt-2">
        {data.map((m) => {
          const isSelected = m.monthKey === selectedMonth;
          return (
            <button
              key={m.monthKey}
              onClick={() => {
                triggerHaptic("selection");
                onSelectMonth(m.monthKey);
              }}
              className={`text-left rounded-2xl p-3 border transition-all duration-200 cursor-pointer ${
                isSelected
                  ? "bg-primary-50/70 dark:bg-primary-950/40 border-primary-400 dark:border-primary-700 shadow-md ring-2 ring-primary-500/20"
                  : "bg-white dark:bg-slate-900/60 border-gray-100 dark:border-slate-800 hover:border-gray-200 dark:hover:border-slate-700 hover:shadow-xs"
              }`}
            >
              <div className="flex items-center justify-between">
                <p className="text-xs font-bold text-gray-900 dark:text-white truncate">
                  {m.label.split(" ")[0]}
                </p>
                <span className="text-[10px] text-gray-400 dark:text-slate-500 font-mono">
                  {m.label.split(" ")[1]}
                </span>
              </div>

              <div className="mt-2 space-y-1 text-[11px]">
                <div className="flex justify-between text-gray-500 dark:text-slate-400">
                  <span>CA:</span>
                  <span className="font-semibold text-blue-600 dark:text-blue-400 truncate">
                    {formatFCFA(m.revenue)}
                  </span>
                </div>
                <div className="flex justify-between text-gray-500 dark:text-slate-400">
                  <span>Dép:</span>
                  <span className="font-semibold text-red-500 dark:text-red-400 truncate">
                    {formatFCFA(m.expenses)}
                  </span>
                </div>
              </div>

              {/* Profit Pill */}
              <div
                className={`mt-2 py-1 px-2 rounded-lg text-center text-[10px] font-extrabold truncate ${
                  m.isProfit
                    ? "bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300"
                    : "bg-red-100 dark:bg-red-950/60 text-red-800 dark:text-red-300"
                }`}
              >
                {m.isProfit ? "+" : ""}
                {formatFCFA(m.netProfit)}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
