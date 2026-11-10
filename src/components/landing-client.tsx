"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { Zap, ArrowRight, Menu, X } from "lucide-react";

export function AnimatedCounter({
  end,
  suffix = "",
  duration = 2000,
}: {
  end: number;
  suffix?: string;
  duration?: number;
}) {
  const ref = useRef<HTMLSpanElement | null>(null);
  const [count, setCount] = useState(0);
  const [started, setStarted] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    if (typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) {
      const id = requestAnimationFrame(() => setCount(end));
      return () => cancelAnimationFrame(id);
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setStarted(true);
          observer.disconnect();
        }
      },
      { threshold: 0.3 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [end]);

  useEffect(() => {
    if (!started) return;
    let frame: number;
    const start = performance.now();
    const tick = (now: number) => {
      const progress = Math.min((now - start) / duration, 1);
      setCount(Math.floor(progress * end));
      if (progress < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [started, end, duration]);

  return (
    <span ref={ref}>
      {count.toLocaleString("fr-SN")}
      {suffix}
    </span>
  );
}

export function LandingNavbar() {
  const [mobileMenu, setMobileMenu] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    if (!mobileMenu) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMobileMenu(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [mobileMenu]);

  return (
    <nav
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        scrolled
          ? "bg-white/90 backdrop-blur-xl shadow-sm border-b border-gray-100"
          : "bg-transparent"
      }`}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 lg:h-20">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 bg-gradient-to-br from-primary-500 to-primary-700 rounded-xl flex items-center justify-center shadow-lg shadow-primary-500/30">
              <Zap className="w-5 h-5 text-white" />
            </div>
            <span className="text-xl font-bold bg-gradient-to-r from-gray-900 to-gray-600 bg-clip-text text-transparent">
              PressiPro
            </span>
          </div>

          <div className="hidden md:flex items-center gap-8">
            <a href="#probleme" className="text-sm font-medium text-gray-600 hover:text-primary-600 transition-colors">
              Problème
            </a>
            <a href="#fonctionnalites" className="text-sm font-medium text-gray-600 hover:text-primary-600 transition-colors">
              Fonctionnalités
            </a>
            <a href="#tarifs" className="text-sm font-medium text-gray-600 hover:text-primary-600 transition-colors">
              Tarifs
            </a>
            <a href="#temoignages" className="text-sm font-medium text-gray-600 hover:text-primary-600 transition-colors">
              Témoignages
            </a>
          </div>

          <div className="hidden md:flex items-center gap-3">
            <Link href="/login" className="text-sm font-semibold text-gray-700 hover:text-primary-600 transition-colors px-4 py-2">
              Se connecter
            </Link>
            <Link
              href="/register"
              className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-primary-600 to-primary-700 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-primary-500/25 hover:shadow-primary-500/40 transition-all duration-200 hover:scale-[1.02]"
            >
              Essai gratuit <ArrowRight className="w-4 h-4" />
            </Link>
          </div>

          <button
            type="button"
            aria-label={mobileMenu ? "Fermer le menu" : "Ouvrir le menu"}
            aria-expanded={mobileMenu}
            className="md:hidden p-2 text-gray-700 rounded-lg hover:bg-gray-100 transition-colors"
            onClick={() => setMobileMenu(!mobileMenu)}
          >
            {mobileMenu ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>
      </div>

      {mobileMenu && (
        <div className="md:hidden bg-white border-t border-gray-100 shadow-xl animate-fade-in">
          <div className="px-4 py-4 space-y-3">
            <a href="#probleme" onClick={() => setMobileMenu(false)} className="block text-sm font-medium text-gray-700 py-2">
              Problème
            </a>
            <a href="#fonctionnalites" onClick={() => setMobileMenu(false)} className="block text-sm font-medium text-gray-700 py-2">
              Fonctionnalités
            </a>
            <a href="#tarifs" onClick={() => setMobileMenu(false)} className="block text-sm font-medium text-gray-700 py-2">
              Tarifs
            </a>
            <a href="#temoignages" onClick={() => setMobileMenu(false)} className="block text-sm font-medium text-gray-700 py-2">
              Témoignages
            </a>
            <div className="pt-3 border-t space-y-2">
              <Link href="/login" className="block text-center text-sm font-semibold text-gray-700 py-2.5 rounded-xl border border-gray-200">
                Se connecter
              </Link>
              <Link href="/register" className="block text-center text-sm font-semibold text-white py-2.5 rounded-xl bg-gradient-to-r from-primary-600 to-primary-700">
                Essai gratuit
              </Link>
            </div>
          </div>
        </div>
      )}
    </nav>
  );
}
