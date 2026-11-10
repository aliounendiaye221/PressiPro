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

function shouldIgnoreTouchTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (target.closest('[role="dialog"], [aria-modal="true"], [data-no-ptr="true"]')) {
    return true;
  }
  let el: HTMLElement | null = target;
  while (el && el !== document.body && el !== document.documentElement) {
    if (el.scrollTop > 0) {
      return true;
    }
    el = el.parentElement;
  }
  return false;
}

export function PullToRefresh({ onRefresh, children, disabled = false }: PullToRefreshProps) {
  const [pullY, setPullY] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const [isPulling, setIsPulling] = useState(false);

  const startYRef = useRef(0);
  const pullYRef = useRef(0);
  const isPullingRef = useRef(false);
  const refreshingRef = useRef(false);
  const hasTriggeredHapticRef = useRef(false);
  const onRefreshRef = useRef(onRefresh);

  useEffect(() => {
    onRefreshRef.current = onRefresh;
  }, [onRefresh]);

  useEffect(() => {
    refreshingRef.current = refreshing;
  }, [refreshing]);

  useEffect(() => {
    if (disabled) return;

    const updatePull = (next: number) => {
      pullYRef.current = next;
      setPullY(next);
    };

    const handleTouchStart = (e: TouchEvent) => {
      if (refreshingRef.current) return;
      if (window.scrollY <= 2 && !shouldIgnoreTouchTarget(e.target)) {
        startYRef.current = e.touches[0].clientY;
        isPullingRef.current = true;
        setIsPulling(true);
        hasTriggeredHapticRef.current = false;
      }
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (!isPullingRef.current || refreshingRef.current) return;

      const currentY = e.touches[0].clientY;
      const diff = currentY - startYRef.current;

      if (diff > 0 && window.scrollY <= 2) {
        const dampened = Math.min(diff * 0.45, MAX_PULL);
        updatePull(dampened);

        if (dampened >= PULL_THRESHOLD && !hasTriggeredHapticRef.current) {
          triggerHaptic("light");
          hasTriggeredHapticRef.current = true;
        }

        if (e.cancelable && diff > 10) {
          e.preventDefault();
        }
      } else if (pullYRef.current !== 0) {
        updatePull(0);
      }
    };

    const handleTouchEnd = async () => {
      if (!isPullingRef.current) return;
      isPullingRef.current = false;
      setIsPulling(false);

      if (pullYRef.current >= PULL_THRESHOLD && !refreshingRef.current) {
        refreshingRef.current = true;
        setRefreshing(true);
        updatePull(45);
        triggerHaptic("medium");

        try {
          await onRefreshRef.current();
        } finally {
          refreshingRef.current = false;
          setRefreshing(false);
          updatePull(0);
        }
      } else {
        updatePull(0);
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
  }, [disabled]);

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
          <span>
            {refreshing
              ? "Actualisation..."
              : pullY >= PULL_THRESHOLD
              ? "Relâcher pour actualiser"
              : "Tirer pour actualiser"}
          </span>
        </div>
      </div>

      {/* Main Content */}
      <div
        style={{
          transform: pullY > 0 && !refreshing ? `translateY(${pullY * 0.4}px)` : undefined,
          transition: isPulling ? "none" : "transform 0.25s ease-out",
        }}
      >
        {children}
      </div>
    </div>
  );
}
