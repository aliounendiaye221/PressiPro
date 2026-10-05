"use client";

import React, { useState, useRef, useMemo, useId } from "react";
import { TrendingUp, Award, Layers, Zap, Calendar } from "lucide-react";
import { triggerHaptic } from "@/lib/feedback";

export interface ChartDayData {
  dayName: string;
  dayShort: string;
  revenue: number;
  orders: number;
}

interface ModernAreaChartProps {
  dailyRevenue: number[];
  dailyOrders?: number[];
  title?: string;
  subtitle?: string;
}

function formatFCFA(n: number) {
  return Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ") + " F";
}

const DAY_NAMES = [
  { short: "Lun", full: "Lundi" },
  { short: "Mar", full: "Mardi" },
  { short: "Mer", full: "Mercredi" },
  { short: "Jeu", full: "Jeudi" },
  { short: "Ven", full: "Vendredi" },
  { short: "Sam", full: "Samedi" },
  { short: "Dim", full: "Dimanche" },
];

/**
 * Computes a smooth cubic Bezier curve string (M ... C ...) through the provided points.
 * Uses tension parameter to ensure no harsh angles and no runaway overshoots.
 */
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

/**
 * Builds the closed area polygon under the Bezier curve down to base line Y.
 */
function getCubicBezierArea(points: { x: number; y: number }[], baseY: number): string {
  if (points.length === 0) return "";
  const curve = getCubicBezierPath(points);
  const first = points[0];
  const last = points[points.length - 1];
  return `${curve} L ${last.x.toFixed(1)},${baseY} L ${first.x.toFixed(1)},${baseY} Z`;
}

export function ModernAreaChart({
  dailyRevenue,
  dailyOrders,
  title = "Activité Hebdomadaire en Temps Réel",
  subtitle = "Courbe fluidifiée 2026 des encaissements et du volume de commandes de la semaine",
}: ModernAreaChartProps) {
  const [activeMetric, setActiveMetric] = useState<"revenue" | "orders">("revenue");
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const chartId = useId();

  // Normalize data (always 7 days)
  const revData = dailyRevenue && dailyRevenue.length === 7 ? dailyRevenue : [0, 0, 0, 0, 0, 0, 0];
  const ordData = dailyOrders && dailyOrders.length === 7 ? dailyOrders : [0, 0, 0, 0, 0, 0, 0];

  const series = activeMetric === "revenue" ? revData : ordData;

  // Key KPI stats
  const totalValue = series.reduce((a, b) => a + b, 0);
  const avgValue = Math.round(totalValue / 7);
  const maxVal = Math.max(...series, activeMetric === "revenue" ? 5000 : 5);
  const minVal = 0;
  const range = maxVal - minVal || 1;

  // Peak day
  const peakIndex = useMemo(() => {
    let best = 0;
    for (let i = 1; i < series.length; i++) {
      if (series[i] > series[best]) best = i;
    }
    return best;
  }, [series]);

  // Chart Dimensions & Grid
  const svgWidth = 640;
  const svgHeight = 220;
  const padLeft = 45;
  const padRight = 30;
  const padTop = 25;
  const padBottom = 35;
  const plotWidth = svgWidth - padLeft - padRight;
  const plotHeight = svgHeight - padTop - padBottom;
  const baseY = svgHeight - padBottom;

  // Calculate points
  const points = useMemo(() => {
    return series.map((val, i) => {
      const x = padLeft + (i / (series.length - 1)) * plotWidth;
      const normalized = (val - minVal) / range;
      const y = baseY - normalized * plotHeight;
      return { x, y, val, index: i };
    });
  }, [series, minVal, range, padLeft, plotWidth, baseY, plotHeight]);

  const curvePath = useMemo(() => getCubicBezierPath(points), [points]);
  const areaPath = useMemo(() => getCubicBezierArea(points, baseY), [points, baseY]);

  // Active point (either hovered or the peak day by default when no hover)
  const activePoint = hoveredIdx !== null ? points[hoveredIdx] : null;

  // Touch and mouse handler
  const handlePointerMove = (clientX: number) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const relativeX = clientX - rect.left;
    const ratio = Math.max(0, Math.min(1, (relativeX - (padLeft / svgWidth) * rect.width) / ((plotWidth / svgWidth) * rect.width)));
    const targetIdx = Math.round(ratio * (series.length - 1));
    if (targetIdx >= 0 && targetIdx < series.length && targetIdx !== hoveredIdx) {
      triggerHaptic("light");
      setHoveredIdx(targetIdx);
    }
  };

  const isRev = activeMetric === "revenue";
  const strokeColor = isRev ? "#06b6d4" : "#8b5cf6"; // Cyan vs Purple
  const strokeGradStart = isRev ? "#06b6d4" : "#a855f7";
  const strokeGradEnd = isRev ? "#3b82f6" : "#6366f1";
  const haloColor = isRev ? "rgba(6, 182, 212, 0.4)" : "rgba(168, 85, 247, 0.4)";

  return (
    <div className="card card-levitate relative overflow-hidden bg-white/95 dark:bg-slate-900/90 border border-gray-100 dark:border-slate-800 shadow-sm backdrop-blur-xs">
      {/* Header Bar with 2026 Segmented Pill Switcher */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
        <div>
          <div className="flex items-center gap-2">
            <div className={`w-8 h-8 rounded-xl flex items-center justify-center text-white shadow-xs ${isRev ? "bg-gradient-to-br from-cyan-500 to-blue-600 shadow-cyan-500/30" : "bg-gradient-to-br from-purple-500 to-indigo-600 shadow-purple-500/30"}`}>
              {isRev ? <TrendingUp className="w-4 h-4" /> : <Layers className="w-4 h-4" />}
            </div>
            <div>
              <h3 className="text-base font-extrabold text-gray-900 dark:text-white tracking-tight flex items-center gap-2">
                <span>{title}</span>
                <span className="inline-flex items-center gap-1 text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200/60 dark:border-emerald-800/40">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  Live 2026
                </span>
              </h3>
              <p className="text-xs text-gray-500 dark:text-slate-400 mt-0.5">{subtitle}</p>
            </div>
          </div>
        </div>

        {/* Metric Switcher & Peak Stat */}
        <div className="flex items-center gap-2 self-start sm:self-auto flex-wrap">
          {/* Segmented Controller (Revenus vs Dépôts) */}
          <div className="flex items-center p-1 rounded-xl bg-gray-100 dark:bg-slate-800/90 border border-gray-200/70 dark:border-slate-700/60 text-xs font-bold">
            <button
              type="button"
              onClick={() => {
                triggerHaptic("selection");
                setActiveMetric("revenue");
              }}
              className={`px-2.5 sm:px-3 py-1.5 rounded-lg transition-all duration-200 flex items-center gap-1.5 ${
                isRev
                  ? "bg-white dark:bg-slate-900 text-cyan-700 dark:text-cyan-300 shadow-xs"
                  : "text-gray-500 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white"
              }`}
            >
              <Zap className="w-3 h-3 text-cyan-500 shrink-0" />
              <span className="hidden sm:inline">Chiffre d&apos;Affaires</span>
              <span className="sm:hidden">CA</span>
            </button>
            <button
              type="button"
              onClick={() => {
                triggerHaptic("selection");
                setActiveMetric("orders");
              }}
              className={`px-2.5 sm:px-3 py-1.5 rounded-lg transition-all duration-200 flex items-center gap-1.5 ${
                !isRev
                  ? "bg-white dark:bg-slate-900 text-purple-700 dark:text-purple-300 shadow-xs"
                  : "text-gray-500 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white"
              }`}
            >
              <Layers className="w-3 h-3 text-purple-500 shrink-0" />
              <span>Dépôts</span>
            </button>
          </div>
        </div>
      </div>

      {/* Snapshot Mini-Ribbon (Total / Moyenne / Record) */}
      <div className="grid grid-cols-3 gap-1.5 sm:gap-3 p-2 sm:p-2.5 mb-2 rounded-2xl bg-gray-50/70 dark:bg-slate-800/40 border border-gray-100 dark:border-slate-800 text-xs">
        <div className="px-1.5 sm:px-2 min-w-0">
          <span className="text-[9px] sm:text-[10px] uppercase font-bold text-gray-400 dark:text-slate-500 block truncate">Total Semaine</span>
          <span className="font-extrabold text-xs sm:text-sm md:text-base text-gray-900 dark:text-white block truncate">
            {isRev ? formatFCFA(totalValue) : `${totalValue} cmd`}
          </span>
        </div>
        <div className="px-1.5 sm:px-2 border-l border-gray-200 dark:border-slate-700/60 min-w-0">
          <span className="text-[9px] sm:text-[10px] uppercase font-bold text-gray-400 dark:text-slate-500 block truncate">Moyenne / J</span>
          <span className="font-extrabold text-xs sm:text-sm md:text-base text-gray-900 dark:text-white block truncate">
            {isRev ? formatFCFA(avgValue) : `${avgValue} / j`}
          </span>
        </div>
        <div className="px-1.5 sm:px-2 border-l border-gray-200 dark:border-slate-700/60 min-w-0 flex items-center justify-between">
          <div className="min-w-0">
            <span className="text-[9px] sm:text-[10px] uppercase font-bold text-amber-500 dark:text-amber-400 block truncate flex items-center gap-1">
              <Award className="w-3 h-3 shrink-0" /> Pic de vente
            </span>
            <span className="font-extrabold text-xs sm:text-sm md:text-base text-gray-900 dark:text-white block truncate">
              {DAY_NAMES[peakIndex]?.full}
            </span>
          </div>
          <span className="hidden md:inline-block text-[11px] font-bold text-gray-500 dark:text-slate-400 shrink-0">
            {isRev ? formatFCFA(series[peakIndex]) : `${series[peakIndex]} dépôts`}
          </span>
        </div>
      </div>

      {/* Interactive Chart Canvas */}
      <div
        ref={containerRef}
        onMouseMove={(e) => handlePointerMove(e.clientX)}
        onMouseLeave={() => setHoveredIdx(null)}
        onTouchMove={(e) => {
          if (e.touches[0]) handlePointerMove(e.touches[0].clientX);
        }}
        onTouchEnd={() => setHoveredIdx(null)}
        className="relative w-full h-64 sm:h-72 select-none cursor-crosshair touch-pan-x"
      >
        <svg
          viewBox={`0 0 ${svgWidth} ${svgHeight}`}
          className="w-full h-full overflow-visible"
          preserveAspectRatio="none"
        >
          <defs>
            {/* Fluid Multi-Stop Gradient Fill */}
            <linearGradient id={`${chartId}-fill-grad`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={strokeGradStart} stopOpacity="0.32" />
              <stop offset="45%" stopColor={strokeGradEnd} stopOpacity="0.12" />
              <stop offset="100%" stopColor={strokeGradEnd} stopOpacity="0.0" />
            </linearGradient>

            {/* Curve Stroke Gradient */}
            <linearGradient id={`${chartId}-stroke-grad`} x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor={strokeGradStart} />
              <stop offset="100%" stopColor={strokeGradEnd} />
            </linearGradient>

            {/* Neon Glow Filter */}
            <filter id={`${chartId}-glow`} x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="3.5" result="blur" />
              <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>
          </defs>

          {/* Grid lines and horizontal Y values */}
          {[0, 0.33, 0.66, 1].map((ratio, index) => {
            const y = padTop + ratio * plotHeight;
            const val = maxVal - ratio * range;
            return (
              <g key={index} className="opacity-30 dark:opacity-20">
                <line
                  x1={padLeft}
                  y1={y}
                  x2={svgWidth - padRight}
                  y2={y}
                  stroke="#94a3b8"
                  strokeWidth="1"
                  strokeDasharray={index === 3 ? "none" : "4 4"}
                />
                <text
                  x={padLeft - 8}
                  y={y + 3}
                  className="text-[9px] fill-gray-400 dark:fill-slate-500 font-semibold"
                  textAnchor="end"
                >
                  {isRev ? formatFCFA(val) : Math.round(val)}
                </text>
              </g>
            );
          })}

          {/* Fluid Area Under Curve */}
          <path
            d={areaPath}
            fill={`url(#${chartId}-fill-grad)`}
            className="transition-all duration-300"
          />

          {/* Glowing Shadow Curve */}
          <path
            d={curvePath}
            fill="none"
            stroke={haloColor}
            strokeWidth="6"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="transition-all duration-300 opacity-60"
          />

          {/* Main Bezier Curve */}
          <path
            d={curvePath}
            fill="none"
            stroke={`url(#${chartId}-stroke-grad)`}
            strokeWidth="3.2"
            strokeLinecap="round"
            strokeLinejoin="round"
            filter={`url(#${chartId}-glow)`}
            className="transition-all duration-300"
          />

          {/* Vertical Laser Tracking Line */}
          {activePoint && (
            <g className="transition-all duration-75">
              <line
                x1={activePoint.x}
                y1={padTop - 5}
                x2={activePoint.x}
                y2={baseY}
                stroke={strokeColor}
                strokeWidth="1.5"
                strokeDasharray="3 3"
                className="opacity-80"
              />
              {/* Ground projection ring */}
              <ellipse
                cx={activePoint.x}
                cy={baseY}
                rx="6"
                ry="2"
                fill={strokeColor}
                className="opacity-40 animate-pulse"
              />
            </g>
          )}

          {/* Peak day badge marker (subtle star / crown dot when not hovered) */}
          {points[peakIndex] && hoveredIdx === null && (
            <g className="animate-bounce-subtle pointer-events-none">
              <circle
                cx={points[peakIndex].x}
                cy={points[peakIndex].y}
                r="8"
                fill={haloColor}
                className="animate-ping opacity-30"
              />
              <circle
                cx={points[peakIndex].x}
                cy={points[peakIndex].y}
                r="4.5"
                fill="#ffffff"
                stroke="#eab308"
                strokeWidth="2.5"
              />
            </g>
          )}

          {/* Data Points on Curve */}
          {points.map((p, i) => {
            const isActive = activePoint?.index === i;
            return (
              <g key={i}>
                {/* Large transparent touch/hover hitbox */}
                <circle
                  cx={p.x}
                  cy={p.y}
                  r="24"
                  fill="transparent"
                  className="cursor-pointer"
                  onMouseEnter={() => {
                    triggerHaptic("light");
                    setHoveredIdx(i);
                  }}
                />

                {/* Outer Ripple on Active */}
                {isActive && (
                  <circle
                    cx={p.x}
                    cy={p.y}
                    r="12"
                    fill={haloColor}
                    className="animate-ping opacity-40 pointer-events-none"
                  />
                )}

                {/* Visible Data Dot */}
                <circle
                  cx={p.x}
                  cy={p.y}
                  r={isActive ? 6 : 3.5}
                  fill={isActive ? "#ffffff" : strokeColor}
                  stroke={isActive ? strokeColor : "#ffffff"}
                  strokeWidth={isActive ? 3 : 1.5}
                  className="transition-all duration-150 pointer-events-none shadow-sm"
                />
              </g>
            );
          })}
        </svg>

        {/* 2026 Glassmorphic Floating Tooltip Card */}
        {activePoint && (
          <div
            className="absolute z-20 pointer-events-none transition-transform duration-100 ease-out"
            style={{
              left: `${(activePoint.x / svgWidth) * 100}%`,
              top: `${(activePoint.y / svgHeight) * 100 - 14}%`,
              transform: `translate(${activePoint.index > 4 ? "-90%" : activePoint.index < 2 ? "-10%" : "-50%"}, -100%)`,
            }}
          >
            <div className="glass-card-2026 px-3.5 py-2.5 rounded-2xl shadow-2xl border border-white/20 dark:border-slate-700/50 bg-gray-900/90 dark:bg-slate-900/95 text-white backdrop-blur-md flex flex-col gap-1 min-w-[140px] animate-fade-in">
              <div className="flex items-center justify-between gap-3 text-[10px] text-gray-400 dark:text-slate-400 font-semibold uppercase tracking-wider">
                <span className="flex items-center gap-1">
                  <Calendar className="w-3 h-3 text-cyan-400" />
                  {DAY_NAMES[activePoint.index]?.full}
                </span>
                {activePoint.index === peakIndex && (
                  <span className="text-[9px] font-black text-amber-400 bg-amber-400/10 px-1.5 py-0.5 rounded-md flex items-center gap-0.5">
                    <Award className="w-2.5 h-2.5" /> Pic
                  </span>
                )}
              </div>

              {/* Main value */}
              <div className="flex items-baseline gap-1.5">
                <span className={`text-base font-black ${isRev ? "text-cyan-300" : "text-purple-300"}`}>
                  {isRev ? formatFCFA(activePoint.val) : `${activePoint.val} dépôts`}
                </span>
              </div>

              {/* Relative comparison vs average */}
              <div className="text-[10px] font-semibold text-gray-300 dark:text-slate-400 flex items-center justify-between pt-1 border-t border-white/10 dark:border-slate-800">
                <span>Vs moy. jour :</span>
                {activePoint.val >= avgValue ? (
                  <span className="text-emerald-400 font-bold">
                    +{avgValue > 0 ? Math.round(((activePoint.val - avgValue) / avgValue) * 100) : 0}%
                  </span>
                ) : (
                  <span className="text-rose-400 font-bold">
                    -{avgValue > 0 ? Math.round(((avgValue - activePoint.val) / avgValue) * 100) : 0}%
                  </span>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Modern Day-by-Day X Axis Strip */}
      <div className="grid grid-cols-7 gap-1 mt-2 pt-2 border-t border-gray-100 dark:border-slate-800/80">
        {DAY_NAMES.map((d, i) => {
          const isSelected = activePoint?.index === i;
          const isPeak = i === peakIndex;
          return (
            <button
              key={i}
              type="button"
              onClick={() => {
                triggerHaptic("light");
                setHoveredIdx(i);
              }}
              className={`flex flex-col items-center py-1.5 px-1 rounded-xl transition-all ${
                isSelected
                  ? "bg-primary-50 dark:bg-primary-950/60 ring-1 ring-primary-500/40"
                  : "hover:bg-gray-50 dark:hover:bg-slate-800/50"
              }`}
            >
              <span className={`text-[11px] font-bold ${isSelected ? "text-primary-600 dark:text-primary-400" : "text-gray-400 dark:text-slate-500"}`}>
                {d.short}
              </span>
              <span className={`text-[10px] font-semibold mt-0.5 ${isPeak ? "text-amber-500 font-extrabold" : "text-gray-600 dark:text-slate-300"}`}>
                {isRev ? `${Math.round(series[i] / 1000)}k` : series[i]}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
