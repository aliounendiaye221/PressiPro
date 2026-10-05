"use client";

import React, { useState, useRef, useEffect } from "react";
import { RefreshCw } from "lucide-react";
import { triggerHaptic } from "@/lib/feedback";

interface PullToRefreshProps {
  onRefresh: () => Promise<void> | void;
  children: React.ReactNode;
  disabled?: boolean;
}

const PULL_THRESHOLD = 60;
const MAX_PULL = 90;

export function PullToRefresh({ onRefresh, children, disabled = false }: PullToRefreshProps) {
  const [pullY, setPullY] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const startYRef = useRef(0);
  const isPullingRef = useRef(false);
  const hasTriggeredHapticRef = useRef(false);

  useEffect(() => {
    if (disabled) return;

    const handleTouchStart = (e: TouchEvent) => {
      // Only start pull if at the top of the viewport
      if (window.scrollY <= 2) {
        startYRef.current = e.touches[0].clientY;
        isPullingRef.current = true;
        hasTriggeredHapticRef.current = false;
      }
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (!isPullingRef.current || refreshing) return;

      const currentY = e.touches[0].clientY;
      const diff = currentY - startYRef.current;

      if (diff > 0 && window.scrollY <= 2) {
        // Apply dampening resistance
        const dampened = Math.min(diff * 0.45, MAX_PULL);
        setPullY(dampened);

        if (dampened >= PULL_THRESHOLD && !hasTriggeredHapticRef.current) {
          triggerHaptic("light");
          hasTriggeredHapticRef.current = true;
        }

        // Prevent native overscroll bouncing when user pulls down at top
        if (e.cancelable && diff > 10) {
          e.preventDefault();
        }
      } else {
        setPullY(0);
      }
    };

    const handleTouchEnd = async () => {
      if (!isPullingRef.current) return;
      isPullingRef.current = false;

      if (pullY >= PULL_THRESHOLD && !refreshing) {
        setRefreshing(true);
        setPullY(45); // hold in loading position
        triggerHaptic("medium");

        try {
          await onRefresh();
        } finally {
          setRefreshing(false);
          setPullY(0);
        }
      } else {
        setPullY(0);
      }
    };

    window.addEventListener("touchstart", handleTouchStart, { passive: true });
    window.addEventListener("touchmove", handleTouchMove, { passive: false });
    window.addEventListener("touchend", handleTouchEnd, { passive: true });

    return () => {
      window.removeEventListener("touchstart", handleTouchStart);
      window.removeEventListener("touchmove", handleTouchMove);
      window.removeEventListener("touchend", handleTouchEnd);
    };
  }, [disabled, refreshing, pullY, onRefresh]);

  const rotation = Math.min((pullY / PULL_THRESHOLD) * 360, 360);
  const opacity = Math.min(pullY / 30, 1);

  return (
    <div className="relative">
      {/* Pull Indicator */}
      <div
        style={{
          transform: `translateY(${pullY > 0 || refreshing ? pullY : 0}px)`,
          opacity: pullY > 5 || refreshing ? opacity : 0,
        }}
        className="fixed top-14 sm:top-16 inset-x-0 z-30 flex justify-center pointer-events-none transition-transform duration-100 ease-out"
      >
        <div className="flex items-center gap-2 bg-white dark:bg-slate-800 text-gray-700 dark:text-slate-200 px-3.5 py-1.5 rounded-full shadow-lg border border-gray-200/80 dark:border-slate-700 text-xs font-semibold">
          <RefreshCw
            style={{ transform: refreshing ? "none" : `rotate(${rotation}deg)` }}
            className={`w-3.5 h-3.5 text-primary-600 dark:text-primary-400 ${
              refreshing ? "animate-spin" : ""
            }`}
          />
          <span>{refreshing ? "Actualisation..." : pullY >= PULL_THRESHOLD ? "Relâcher pour actualiser" : "Tirer pour actualiser"}</span>
        </div>
      </div>

      {/* Main Content */}
      <div
        style={{
          transform: pullY > 0 && !refreshing ? `translateY(${pullY * 0.4}px)` : undefined,
          transition: isPullingRef.current ? "none" : "transform 0.25s ease-out",
        }}
      >
        {children}
      </div>
    </div>
  );
}
