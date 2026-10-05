"use client";

import React, { useState } from "react";
import { triggerHaptic } from "@/lib/feedback";
import { CreditCard, Wallet, Smartphone, Banknote, HelpCircle } from "lucide-react";

export interface DonutSegment {
  id: string;
  label: string;
  value: number;
  count?: number;
  color?: string;
  icon?: React.ReactNode;
}

interface ModernDonutChartProps {
  title?: string;
  subtitle?: string;
  segments: DonutSegment[];
  totalLabel?: string;
  emptyMessage?: string;
  formatValue?: (n: number) => string;
}

const DEFAULT_COLORS = [
  "#10b981", // Emerald (Cash / Espèces)
  "#06b6d4", // Cyan (Wave)
  "#f97316", // Orange (Orange Money)
  "#8b5cf6", // Purple (CB / Virement)
  "#ec4899", // Pink (Autre)
];

function defaultFormatFCFA(n: number) {
  return Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ") + " F";
}

export function ModernDonutChart({
  title = "Répartition des Encaissements",
  subtitle = "Ventilation en temps réel par méthode",
  segments,
  totalLabel = "Total Encaissé",
  emptyMessage = "Aucun paiement enregistré aujourd'hui",
  formatValue = defaultFormatFCFA,
}: ModernDonutChartProps) {
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  const total = segments.reduce((sum, s) => sum + Math.max(0, s.value), 0);

  // SVG Geometry
  const size = 180;
  const strokeWidth = 18;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;

  // Active segment
  const activeSegment = hoveredId ? segments.find((s) => s.id === hoveredId) : null;

  // Map segments with offset, percentage and colors
  let accumulatedPercent = 0;
  const processed = segments
    .filter((s) => s.value > 0)
    .map((s, idx) => {
      const percent = total > 0 ? (s.value / total) * 100 : 0;
      const strokeDash = (percent / 100) * circumference;
      // Reserve a tiny gap between segments
      const gap = segments.filter((item) => item.value > 0).length > 1 ? 4 : 0;
      const length = Math.max(2, strokeDash - gap);
      const offset = (accumulatedPercent / 100) * circumference;
      accumulatedPercent += percent;

      return {
        ...s,
        percent: Math.round(percent),
        color: s.color || DEFAULT_COLORS[idx % DEFAULT_COLORS.length],
        length,
        offset,
      };
    });

  const getMethodIcon = (id: string, label: string) => {
    const l = (id + " " + label).toLowerCase();
    if (l.includes("wave")) return <Smartphone className="w-3.5 h-3.5 text-cyan-500" />;
    if (l.includes("om") || l.includes("orange")) return <Smartphone className="w-3.5 h-3.5 text-orange-500" />;
    if (l.includes("cash") || l.includes("espece") || l.includes("espèces")) return <Banknote className="w-3.5 h-3.5 text-emerald-500" />;
    return <Wallet className="w-3.5 h-3.5 text-purple-500" />;
  };

  return (
    <div className="card bg-white dark:bg-slate-900 border border-gray-100 dark:border-slate-800 flex flex-col justify-between shadow-xs">
      <div>
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-base font-bold text-gray-900 dark:text-white tracking-tight flex items-center gap-2">
              <span>{title}</span>
              <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-cyan-50 dark:bg-cyan-950/60 text-cyan-700 dark:text-cyan-300 border border-cyan-200/50 dark:border-cyan-800/40">
                Aujourd&apos;hui
              </span>
            </h3>
            <p className="text-xs text-gray-500 dark:text-slate-400 mt-0.5">{subtitle}</p>
          </div>
        </div>

        {total === 0 ? (
          <div className="py-12 text-center text-xs text-gray-400 dark:text-slate-500 space-y-2">
            <div className="w-10 h-10 rounded-2xl bg-gray-100 dark:bg-slate-800 flex items-center justify-center mx-auto text-gray-400">
              <CreditCard className="w-5 h-5 opacity-60" />
            </div>
            <p>{emptyMessage}</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-12 gap-6 items-center my-2">
            {/* Donut Visualizer */}
            <div className="sm:col-span-5 flex justify-center relative">
              <div className="relative w-[180px] h-[180px] flex items-center justify-center">
                <svg
                  width={size}
                  height={size}
                  viewBox={`0 0 ${size} ${size}`}
                  className="rotate-[-90deg] overflow-visible"
                >
                  <defs>
                    <filter id="donut-glow" x="-20%" y="-20%" width="140%" height="140%">
                      <feGaussianBlur stdDeviation="3" result="blur" />
                      <feComposite in="SourceGraphic" in2="blur" operator="over" />
                    </filter>
                  </defs>

                  {/* Background Track Circle */}
                  <circle
                    cx={size / 2}
                    cy={size / 2}
                    r={radius}
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={strokeWidth}
                    className="text-gray-100 dark:text-slate-800/80"
                  />

                  {/* Render Segment Rings */}
                  {processed.map((seg) => {
                    const isHovered = hoveredId === seg.id;
                    return (
                      <circle
                        key={seg.id}
                        cx={size / 2}
                        cy={size / 2}
                        r={radius}
                        fill="none"
                        stroke={seg.color}
                        strokeWidth={isHovered ? strokeWidth + 4 : strokeWidth}
                        strokeDasharray={`${seg.length} ${circumference}`}
                        strokeDashoffset={-seg.offset}
                        strokeLinecap="round"
                        className="transition-all duration-200 cursor-pointer"
                        filter={isHovered ? "url(#donut-glow)" : undefined}
                        onMouseEnter={() => {
                          triggerHaptic("light");
                          setHoveredId(seg.id);
                        }}
                        onMouseLeave={() => setHoveredId(null)}
                      />
                    );
                  })}
                </svg>

                {/* Center KPI Metric Overlay */}
                <div className="absolute inset-0 flex flex-col items-center justify-center text-center pointer-events-none px-4">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400 dark:text-slate-500 truncate max-w-[120px]">
                    {activeSegment ? activeSegment.label : totalLabel}
                  </span>
                  <span className="text-base sm:text-lg font-black text-gray-900 dark:text-white mt-0.5 truncate max-w-[130px]">
                    {formatValue(activeSegment ? activeSegment.value : total)}
                  </span>
                  {activeSegment && (
                    <span className="text-[10px] font-black px-2 py-0.2 rounded-full mt-1 bg-gray-100 dark:bg-slate-800 text-gray-700 dark:text-slate-300">
                      {Math.round((activeSegment.value / total) * 100)}%
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Interactive Legend List */}
            <div className="sm:col-span-7 space-y-2.5">
              {processed.map((seg) => {
                const isHovered = hoveredId === seg.id;
                return (
                  <div
                    key={seg.id}
                    onMouseEnter={() => {
                      triggerHaptic("light");
                      setHoveredId(seg.id);
                    }}
                    onMouseLeave={() => setHoveredId(null)}
                    className={`p-2.5 rounded-xl border transition-all cursor-pointer ${
                      isHovered
                        ? "bg-gray-50/90 dark:bg-slate-800 border-gray-300 dark:border-slate-600 scale-[1.02] shadow-xs"
                        : "bg-white dark:bg-slate-900/60 border-gray-100 dark:border-slate-800 hover:border-gray-200 dark:hover:border-slate-700"
                    }`}
                  >
                    <div className="flex items-center justify-between text-xs mb-1.5">
                      <div className="flex items-center gap-2 min-w-0">
                        <span
                          className="w-3 h-3 rounded-full shrink-0 shadow-xs"
                          style={{ backgroundColor: seg.color }}
                        />
                        <span className="font-bold text-gray-800 dark:text-slate-200 truncate flex items-center gap-1.5">
                          {getMethodIcon(seg.id, seg.label)}
                          <span>{seg.label}</span>
                        </span>
                        {seg.count !== undefined && (
                          <span className="text-[10px] text-gray-400 dark:text-slate-500 shrink-0">
                            ({seg.count} tx)
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="font-extrabold text-gray-900 dark:text-white">
                          {formatValue(seg.value)}
                        </span>
                        <span
                          className="text-[10px] font-black px-1.5 py-0.5 rounded-md text-white shrink-0"
                          style={{ backgroundColor: seg.color }}
                        >
                          {seg.percent}%
                        </span>
                      </div>
                    </div>

                    {/* Channel Progress Line */}
                    <div className="w-full h-1.5 bg-gray-100 dark:bg-slate-800 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{
                          width: `${Math.max(4, seg.percent)}%`,
                          backgroundColor: seg.color,
                        }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      <div className="mt-4 pt-3 border-t border-gray-100 dark:border-slate-800 flex items-center justify-between text-xs text-gray-500 dark:text-slate-400">
        <span>Canaux d&apos;encaissement synchronisés</span>
        <span className="font-semibold text-emerald-600 dark:text-emerald-400">
          Total : {formatValue(total)}
        </span>
      </div>
    </div>
  );
}
