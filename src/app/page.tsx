"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  Zap, Shield, Smartphone, BarChart3, Clock, Users, Receipt,
  ChevronRight, Check, Star, ArrowRight, Menu, X, TrendingUp,
  Package, Bell, QrCode, Globe, HeadphonesIcon, Weight
} from "lucide-react";

/* ─── Counter animation ──────────────────────────────────── */
function AnimatedCounter({ end, suffix = "", duration = 2000 }: { end: number; suffix?: string; duration?: number }) {
  const [count, setCount] = useState(0);
  const [started, setStarted] = useState(false);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) setStarted(true); },
      { threshold: 0.3 }
    );
    const el = document.getElementById(`counter-${end}`);
    if (el) observer.observe(el);
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

  return <span id={`counter-${end}`}>{count.toLocaleString("fr-SN")}{suffix}</span>;
}

/* ─── Sections data ──────────────────────────────────────── */
const PROBLEMS = [
  { icon: Clock, title: "Commandes perdues", desc: "Des tickets papier égarés, des vêtements oubliés, des clients furieux. Chaque erreur vous coûte un client fidèle." },
  { icon: Receipt, title: "Comptabilité floue", desc: "Vous ne savez pas combien vous gagnez par jour, par semaine. L'argent rentre et sort sans traçabilité." },
  { icon: Users, title: "Clients qui partent", desc: "Sans suivi, sans notifications, vos clients vont chez le concurrent qui leur envoie un SMS quand c'est prêt." },
  { icon: TrendingUp, title: "Pas de croissance", desc: "Impossible de savoir quels services marchent le mieux, quel jour est le plus rentable, où investir." },
];

const FEATURES = [
  { icon: Zap, title: "Commande en 10 secondes", desc: "Boutons rapides pour vos articles les plus demandés. Chemise, Pantalon, Boubou — un tap et c'est enregistré.", color: "from-blue-500 to-blue-600" },
  { icon: Weight, title: "Tarification au kilo", desc: "Lavage au kilo à 400F/kg ? Parfait. Le système calcule automatiquement le total selon le poids.", color: "from-amber-500 to-amber-600" },
  { icon: Smartphone, title: "Paiement Wave & OM", desc: "Acceptez Wave et Orange Money. Vos numéros s'affichent sur chaque reçu pour faciliter le paiement.", color: "from-green-500 to-green-600" },
  { icon: Receipt, title: "Reçus PDF + QR Code", desc: "Reçus professionnels avec QR code, logo de votre pressing, infos de contact. Fini les tickets manuscrits.", color: "from-violet-500 to-violet-600" },
  { icon: BarChart3, title: "Dashboard temps réel", desc: "Revenus du jour, commandes en cours, retards — tout est visible d'un coup d'œil sur votre tableau de bord.", color: "from-rose-500 to-rose-600" },
  { icon: Shield, title: "Multi-utilisateurs", desc: "Admin et agents avec des rôles séparés. Vous gardez le contrôle, vos employés font le travail.", color: "from-cyan-500 to-cyan-600" },
  { icon: Bell, title: "Suivi des statuts", desc: "Reçu → Traitement → Prêt → Livré. Chaque étape est tracée avec historique et dates.", color: "from-orange-500 to-orange-600" },
  { icon: Globe, title: "Accessible partout", desc: "Application web progressive (PWA). Fonctionne sur téléphone, tablette, ordinateur. Même hors connexion.", color: "from-indigo-500 to-indigo-600" },
];

const TESTIMONIALS = [
  { name: "Mamadou D.", role: "Gérant, Pressing Élégance - Rufisque", text: "Avant PressiPro, je perdais 2 à 3 commandes par semaine. Maintenant tout est tracé, mes clients me font confiance.", stars: 5 },
  { name: "Fatou N.", role: "Propriétaire, Pressing FN - Dakar", text: "Le dashboard me montre exactement combien je gagne. J'ai augmenté mes prix sur les services les plus demandés.", stars: 5 },
  { name: "Ousmane B.", role: "Gérant, Net Express - Pikine", text: "Mes clients adorent recevoir un reçu professionnel avec QR code. Ça fait sérieux. Ça fait professionnel.", stars: 5 },
];

const PRICING = [
  { name: "Starter", price: "Gratuit", period: "pour commencer", features: ["1 pressing", "2 utilisateurs", "100 commandes/mois", "Reçus PDF", "Dashboard basique"], cta: "Commencer gratuitement", popular: false },
  { name: "Pro", price: "9 900 F", period: "/mois", features: ["1 pressing", "Utilisateurs illimités", "Commandes illimitées", "Reçus PDF + QR", "Dashboard avancé", "Wave & OM sur reçus", "Tarification au kilo", "Support prioritaire"], cta: "Essai gratuit 14 jours", popular: true },
  { name: "Enterprise", price: "Sur mesure", period: "", features: ["Multi-pressings", "Super Admin", "API personnalisée", "Formation équipe", "Support dédié 24/7", "Statistiques plateforme"], cta: "Nous contacter", popular: false },
];

const STEPS = [
  { num: "01", title: "Inscrivez-vous", desc: "Créez votre compte en 30 secondes. Nom du pressing, email, mot de passe. C'est tout." },
  { num: "02", title: "Configurez", desc: "Ajoutez vos services, vos tarifs, vos numéros Wave/OM. Personnalisez votre pressing." },
  { num: "03", title: "Encaissez", desc: "Prenez des commandes, imprimez des reçus, suivez vos revenus. Votre pressing tourne comme une machine." },
];

export default function LandingPage() {
  const [mobileMenu, setMobileMenu] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <div className="min-h-screen bg-white overflow-x-hidden">
      {/* ═════════ NAVBAR ═════════ */}
      <nav className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${scrolled ? "bg-white/90 backdrop-blur-xl shadow-sm border-b border-gray-100" : "bg-transparent"}`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16 lg:h-20">
            <div className="flex items-center gap-2">
              <div className="w-9 h-9 bg-gradient-to-br from-primary-500 to-primary-700 rounded-xl flex items-center justify-center shadow-lg shadow-primary-500/30">
                <Zap className="w-5 h-5 text-white" />
              </div>
              <span className="text-xl font-bold bg-gradient-to-r from-gray-900 to-gray-600 bg-clip-text text-transparent">PressiPro</span>
            </div>

            <div className="hidden md:flex items-center gap-8">
              <a href="#probleme" className="text-sm font-medium text-gray-600 hover:text-primary-600 transition-colors">Problème</a>
              <a href="#fonctionnalites" className="text-sm font-medium text-gray-600 hover:text-primary-600 transition-colors">Fonctionnalités</a>
              <a href="#tarifs" className="text-sm font-medium text-gray-600 hover:text-primary-600 transition-colors">Tarifs</a>
              <a href="#temoignages" className="text-sm font-medium text-gray-600 hover:text-primary-600 transition-colors">Témoignages</a>
            </div>

            <div className="hidden md:flex items-center gap-3">
              <Link href="/login" className="text-sm font-semibold text-gray-700 hover:text-primary-600 transition-colors px-4 py-2">
                Se connecter
              </Link>
              <Link href="/register" className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-primary-600 to-primary-700 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-primary-500/25 hover:shadow-primary-500/40 transition-all duration-200 hover:scale-[1.02]">
                Essai gratuit <ArrowRight className="w-4 h-4" />
              </Link>
            </div>

            <button className="md:hidden p-2" onClick={() => setMobileMenu(!mobileMenu)}>
              {mobileMenu ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>

        {/* Mobile menu */}
        {mobileMenu && (
          <div className="md:hidden bg-white border-t border-gray-100 shadow-xl animate-fade-in">
            <div className="px-4 py-4 space-y-3">
              <a href="#probleme" onClick={() => setMobileMenu(false)} className="block text-sm font-medium text-gray-700 py-2">Problème</a>
              <a href="#fonctionnalites" onClick={() => setMobileMenu(false)} className="block text-sm font-medium text-gray-700 py-2">Fonctionnalités</a>
              <a href="#tarifs" onClick={() => setMobileMenu(false)} className="block text-sm font-medium text-gray-700 py-2">Tarifs</a>
              <a href="#temoignages" onClick={() => setMobileMenu(false)} className="block text-sm font-medium text-gray-700 py-2">Témoignages</a>
              <div className="pt-3 border-t space-y-2">
                <Link href="/login" className="block text-center text-sm font-semibold text-gray-700 py-2.5 rounded-xl border border-gray-200">Se connecter</Link>
                <Link href="/register" className="block text-center text-sm font-semibold text-white py-2.5 rounded-xl bg-gradient-to-r from-primary-600 to-primary-700">Essai gratuit</Link>
              </div>
            </div>
          </div>
        )}
      </nav>

      {/* ═════════ HERO ═════════ */}
      <section className="relative pt-32 pb-20 lg:pt-44 lg:pb-32 overflow-hidden">
        {/* Background effects */}
        <div className="absolute inset-0 bg-gradient-to-br from-primary-50/80 via-white to-violet-50/60" />
        <div className="absolute top-20 left-10 w-72 h-72 bg-primary-200/30 rounded-full blur-3xl" />
        <div className="absolute bottom-10 right-10 w-96 h-96 bg-violet-200/20 rounded-full blur-3xl" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-gradient-radial from-primary-100/20 to-transparent rounded-full" />

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-4xl mx-auto">
            {/* Badge */}
            <div className="inline-flex items-center gap-2 rounded-full bg-primary-50 border border-primary-100 px-4 py-1.5 text-sm font-medium text-primary-700 mb-6 animate-fade-in">
              <span className="w-2 h-2 bg-primary-500 rounded-full animate-pulse" />
              La solution #1 de gestion pour les pressings au Sénégal
            </div>

            <h1 className="text-4xl sm:text-5xl lg:text-7xl font-extrabold text-gray-900 leading-[1.1] tracking-tight mb-6">
              Votre pressing mérite
              <span className="block bg-gradient-to-r from-primary-600 via-primary-500 to-violet-600 bg-clip-text text-transparent mt-2">
                une gestion moderne
              </span>
            </h1>

            <p className="text-lg sm:text-xl text-gray-600 max-w-2xl mx-auto mb-10 leading-relaxed">
              Fini les tickets perdus et la comptabilité au cahier.
              <strong className="text-gray-800"> PressiPro</strong> digitalise votre pressing en 30 secondes :
              commandes, paiements, reçus, statistiques — tout sur votre téléphone.
            </p>

            {/* CTA buttons */}
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-12">
              <Link
                href="/register"
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-primary-600 to-primary-700 px-8 py-4 text-base font-bold text-white shadow-2xl shadow-primary-500/30 hover:shadow-primary-500/50 transition-all duration-300 hover:scale-[1.03] hover:-translate-y-0.5"
              >
                Démarrer gratuitement <ArrowRight className="w-5 h-5" />
              </Link>
              <a
                href="#demo"
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-2xl border-2 border-gray-200 bg-white px-8 py-4 text-base font-bold text-gray-700 hover:border-primary-300 hover:text-primary-700 transition-all duration-300"
              >
                Voir la démo <ChevronRight className="w-5 h-5" />
              </a>
            </div>

            {/* Social proof */}
            <div className="flex flex-col sm:flex-row items-center justify-center gap-6 text-sm text-gray-500">
              <div className="flex items-center gap-1.5">
                <div className="flex -space-x-2">
                  {["M", "F", "O", "A"].map((l, i) => (
                    <div key={i} className={`w-8 h-8 rounded-full border-2 border-white flex items-center justify-center text-xs font-bold text-white ${["bg-primary-500", "bg-violet-500", "bg-emerald-500", "bg-amber-500"][i]}`}>{l}</div>
                  ))}
                </div>
                <span className="ml-1">+50 pressings inscrits</span>
              </div>
              <div className="flex items-center gap-1">
                {[...Array(5)].map((_, i) => <Star key={i} className="w-4 h-4 text-amber-400 fill-amber-400" />)}
                <span className="ml-1">4.9/5 satisfaction</span>
              </div>
              <span>✓ Sans carte bancaire</span>
            </div>
          </div>

          {/* Hero mockup */}
          <div className="relative mt-16 lg:mt-20 max-w-5xl mx-auto" id="demo">
            <div className="relative rounded-2xl overflow-hidden shadow-2xl shadow-gray-900/10 border border-gray-200/60">
              <div className="bg-gradient-to-r from-gray-800 to-gray-900 h-8 flex items-center px-4 gap-2">
                <div className="w-3 h-3 rounded-full bg-red-400" />
                <div className="w-3 h-3 rounded-full bg-amber-400" />
                <div className="w-3 h-3 rounded-full bg-green-400" />
                <span className="text-xs text-gray-400 ml-2">app.pressipro.sn</span>
              </div>
              <div className="bg-gradient-to-br from-gray-50 to-white p-6 sm:p-10 min-h-[300px] lg:min-h-[420px]">
                {/* Simulated dashboard */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                  {[
                    { label: "Aujourd'hui", value: "47 500 F", color: "from-blue-500 to-blue-600", icon: TrendingUp },
                    { label: "Commandes", value: "23", color: "from-emerald-500 to-emerald-600", icon: Package },
                    { label: "En cours", value: "8", color: "from-amber-500 to-amber-600", icon: Clock },
                    { label: "Clients", value: "156", color: "from-violet-500 to-violet-600", icon: Users },
                  ].map((s, i) => (
                    <div key={i} className="bg-white rounded-xl p-4 shadow-sm border border-gray-100 relative overflow-hidden">
                      <div className={`absolute -top-2 -right-2 w-10 h-10 bg-gradient-to-br ${s.color} rounded-lg rotate-12 opacity-15`} />
                      <s.icon className="w-4 h-4 text-gray-400 mb-1" />
                      <p className="text-lg font-bold text-gray-900">{s.value}</p>
                      <p className="text-xs text-gray-500">{s.label}</p>
                    </div>
                  ))}
                </div>
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                  <div className="lg:col-span-2 bg-white rounded-xl p-4 shadow-sm border border-gray-100">
                    <p className="text-sm font-semibold text-gray-700 mb-3">Commandes récentes</p>
                    {["P-00145 — Aminata Sow — 2 500 F — Prêt ✓", "P-00144 — Ousmane Ba — 4 000 F — Traitement", "P-00143 — Mariama Diop — 1 500 F — Livré ✓✓"].map((o, i) => (
                      <p key={i} className="text-xs text-gray-500 py-1.5 border-b border-gray-50 last:border-0">{o}</p>
                    ))}
                  </div>
                  <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
                    <p className="text-sm font-semibold text-gray-700 mb-3">Paiements</p>
                    <div className="space-y-2">
                      <div className="flex justify-between text-xs"><span className="text-gray-500">Espèces</span><span className="font-medium">65%</span></div>
                      <div className="h-2 bg-gray-100 rounded-full overflow-hidden"><div className="h-full bg-emerald-500 rounded-full" style={{ width: "65%" }} /></div>
                      <div className="flex justify-between text-xs"><span className="text-gray-500">Wave</span><span className="font-medium">25%</span></div>
                      <div className="h-2 bg-gray-100 rounded-full overflow-hidden"><div className="h-full bg-blue-500 rounded-full" style={{ width: "25%" }} /></div>
                      <div className="flex justify-between text-xs"><span className="text-gray-500">OM</span><span className="font-medium">10%</span></div>
                      <div className="h-2 bg-gray-100 rounded-full overflow-hidden"><div className="h-full bg-orange-500 rounded-full" style={{ width: "10%" }} /></div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            {/* Floating glow */}
            <div className="absolute -bottom-6 left-1/2 -translate-x-1/2 w-3/4 h-12 bg-primary-500/10 blur-2xl rounded-full" />
          </div>
        </div>
      </section>

      {/* ═════════ METRICS ═════════ */}
      <section className="py-16 bg-gradient-to-r from-gray-900 via-gray-800 to-gray-900 text-white relative overflow-hidden">
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiNmZmYiIGZpbGwtb3BhY2l0eT0iMC4wMyI+PHBhdGggZD0iTTM2IDE4YzEuNjU3IDAgMy0xLjM0MyAzLTNzLTEuMzQzLTMtMy0zLTMgMS4zNDMtMyAzIDEuMzQzIDMgMyAzem0xMiAxMmMxLjY1NyAwIDMtMS4zNDMgMy0zcy0xLjM0My0zLTMtMy0zIDEuMzQzLTMgMyAxLjM0MyAzIDMgM3oiLz48L2c+PC9nPjwvc3ZnPg==')] opacity-50" />
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-8 text-center">
            {[
              { value: 50, suffix: "+", label: "Pressings actifs" },
              { value: 12000, suffix: "+", label: "Commandes traitées" },
              { value: 99, suffix: "%", label: "Disponibilité" },
              { value: 30, suffix: "sec", label: "Pour créer un dépôt" },
            ].map((m, i) => (
              <div key={i}>
                <p className="text-3xl lg:text-5xl font-extrabold bg-gradient-to-r from-white to-gray-300 bg-clip-text text-transparent">
                  <AnimatedCounter end={m.value} suffix={m.suffix} />
                </p>
                <p className="text-sm text-gray-400 mt-1">{m.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═════════ PROBLEM ═════════ */}
      <section id="probleme" className="py-20 lg:py-28 bg-gradient-to-b from-white to-red-50/30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <span className="inline-block text-sm font-bold text-red-600 bg-red-50 border border-red-100 rounded-full px-4 py-1 mb-4">LE PROBLÈME</span>
            <h2 className="text-3xl lg:text-5xl font-extrabold text-gray-900">
              Votre pressing perd de l&apos;argent <span className="text-red-500">chaque jour</span>
            </h2>
            <p className="text-lg text-gray-600 mt-4">Si vous gérez encore avec un cahier et un stylo, vous perdez des clients, de l&apos;argent et du temps. Voici ce qui vous coûte cher :</p>
          </div>
          <div className="grid md:grid-cols-2 gap-6">
            {PROBLEMS.map((p, i) => (
              <div key={i} className="group bg-white rounded-2xl p-6 border border-red-100/50 hover:border-red-200 hover:shadow-lg hover:shadow-red-500/5 transition-all duration-300">
                <div className="flex gap-4">
                  <div className="w-12 h-12 rounded-xl bg-red-50 flex items-center justify-center flex-shrink-0 group-hover:bg-red-100 transition-colors">
                    <p.icon className="w-6 h-6 text-red-500" />
                  </div>
                  <div>
                    <h3 className="font-bold text-gray-900 text-lg">{p.title}</h3>
                    <p className="text-gray-600 mt-1 leading-relaxed">{p.desc}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═════════ SOLUTION / HOW IT WORKS ═════════ */}
      <section className="py-20 lg:py-28 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <span className="inline-block text-sm font-bold text-emerald-600 bg-emerald-50 border border-emerald-100 rounded-full px-4 py-1 mb-4">LA SOLUTION</span>
            <h2 className="text-3xl lg:text-5xl font-extrabold text-gray-900">
              Opérationnel en <span className="text-emerald-500">3 étapes</span>
            </h2>
            <p className="text-lg text-gray-600 mt-4">Pas besoin de formation. Pas besoin de technicien. Vous êtes prêt en 5 minutes.</p>
          </div>
          <div className="grid md:grid-cols-3 gap-8">
            {STEPS.map((s, i) => (
              <div key={i} className="relative group">
                <div className="bg-gradient-to-br from-gray-50 to-white rounded-2xl p-8 border border-gray-100 hover:shadow-xl hover:-translate-y-1 transition-all duration-300">
                  <span className="text-6xl font-black text-primary-100 group-hover:text-primary-200 transition-colors">{s.num}</span>
                  <h3 className="text-xl font-bold text-gray-900 mt-2">{s.title}</h3>
                  <p className="text-gray-600 mt-2 leading-relaxed">{s.desc}</p>
                </div>
                {i < 2 && <ChevronRight className="hidden md:block absolute top-1/2 -right-5 w-6 h-6 text-gray-300" />}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═════════ FEATURES ═════════ */}
      <section id="fonctionnalites" className="py-20 lg:py-28 bg-gradient-to-b from-gray-50 to-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <span className="inline-block text-sm font-bold text-primary-600 bg-primary-50 border border-primary-100 rounded-full px-4 py-1 mb-4">FONCTIONNALITÉS</span>
            <h2 className="text-3xl lg:text-5xl font-extrabold text-gray-900">
              Tout ce dont votre pressing a <span className="text-primary-600">besoin</span>
            </h2>
            <p className="text-lg text-gray-600 mt-4">Chaque fonctionnalité est conçue pour les réalités du pressing au Sénégal.</p>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {FEATURES.map((f, i) => (
              <div key={i} className="group bg-white rounded-2xl p-6 border border-gray-100 hover:shadow-xl hover:-translate-y-1 transition-all duration-300 relative overflow-hidden">
                <div className={`absolute -top-4 -right-4 w-20 h-20 bg-gradient-to-br ${f.color} rounded-2xl rotate-12 opacity-[0.07] group-hover:opacity-[0.12] transition-opacity`} />
                <div className={`w-11 h-11 rounded-xl bg-gradient-to-br ${f.color} flex items-center justify-center mb-4 shadow-lg`}>
                  <f.icon className="w-5 h-5 text-white" />
                </div>
                <h3 className="font-bold text-gray-900">{f.title}</h3>
                <p className="text-sm text-gray-600 mt-2 leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═════════ TESTIMONIALS ═════════ */}
      <section id="temoignages" className="py-20 lg:py-28 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <span className="inline-block text-sm font-bold text-amber-600 bg-amber-50 border border-amber-100 rounded-full px-4 py-1 mb-4">TÉMOIGNAGES</span>
            <h2 className="text-3xl lg:text-5xl font-extrabold text-gray-900">
              Ils ont <span className="text-amber-500">transformé</span> leur pressing
            </h2>
          </div>
          <div className="grid md:grid-cols-3 gap-6">
            {TESTIMONIALS.map((t, i) => (
              <div key={i} className="bg-gradient-to-br from-gray-50 to-white rounded-2xl p-6 border border-gray-100 hover:shadow-lg transition-all duration-300">
                <div className="flex gap-0.5 mb-3">{[...Array(t.stars)].map((_, j) => <Star key={j} className="w-4 h-4 text-amber-400 fill-amber-400" />)}</div>
                <p className="text-gray-700 leading-relaxed italic">&ldquo;{t.text}&rdquo;</p>
                <div className="flex items-center gap-3 mt-4 pt-4 border-t border-gray-100">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary-400 to-primary-600 flex items-center justify-center text-white font-bold text-sm">
                    {t.name.charAt(0)}
                  </div>
                  <div>
                    <p className="font-semibold text-gray-900 text-sm">{t.name}</p>
                    <p className="text-xs text-gray-500">{t.role}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═════════ PRICING ═════════ */}
      <section id="tarifs" className="py-20 lg:py-28 bg-gradient-to-b from-gray-50 to-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <span className="inline-block text-sm font-bold text-primary-600 bg-primary-50 border border-primary-100 rounded-full px-4 py-1 mb-4">TARIFS</span>
            <h2 className="text-3xl lg:text-5xl font-extrabold text-gray-900">
              Un prix qui <span className="text-primary-600">s&apos;adapte</span> à vous
            </h2>
            <p className="text-lg text-gray-600 mt-4">Commencez gratuitement. Évoluez quand vous êtes prêt.</p>
          </div>
          <div className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto">
            {PRICING.map((p, i) => (
              <div key={i} className={`rounded-2xl p-6 border relative ${p.popular ? "bg-gradient-to-br from-primary-600 to-primary-800 text-white border-primary-500 shadow-2xl shadow-primary-500/20 scale-[1.03]" : "bg-white border-gray-200 hover:shadow-lg"} transition-all duration-300`}>
                {p.popular && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-amber-400 text-amber-900 text-xs font-bold px-3 py-1 rounded-full">
                    POPULAIRE
                  </div>
                )}
                <h3 className={`text-lg font-bold ${p.popular ? "text-white" : "text-gray-900"}`}>{p.name}</h3>
                <div className="mt-4 mb-6">
                  <span className={`text-4xl font-extrabold ${p.popular ? "text-white" : "text-gray-900"}`}>{p.price}</span>
                  <span className={`text-sm ${p.popular ? "text-primary-200" : "text-gray-500"}`}>{p.period}</span>
                </div>
                <ul className="space-y-3 mb-8">
                  {p.features.map((f, j) => (
                    <li key={j} className="flex items-center gap-2 text-sm">
                      <Check className={`w-4 h-4 flex-shrink-0 ${p.popular ? "text-primary-200" : "text-emerald-500"}`} />
                      <span className={p.popular ? "text-primary-100" : "text-gray-600"}>{f}</span>
                    </li>
                  ))}
                </ul>
                <Link
                  href={p.popular ? "/register" : p.name === "Enterprise" ? "#contact" : "/register"}
                  className={`block text-center rounded-xl py-3 text-sm font-bold transition-all duration-200 ${
                    p.popular
                      ? "bg-white text-primary-700 hover:bg-primary-50 shadow-lg"
                      : "bg-gray-900 text-white hover:bg-gray-800"
                  }`}
                >
                  {p.cta}
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═════════ CTA FINAL ═════════ */}
      <section className="py-20 lg:py-28 relative overflow-hidden bg-gradient-to-br from-primary-600 via-primary-700 to-violet-700">
        <div className="absolute inset-0">
          <div className="absolute top-10 left-10 w-64 h-64 bg-white/5 rounded-full blur-3xl" />
          <div className="absolute bottom-10 right-10 w-80 h-80 bg-violet-500/10 rounded-full blur-3xl" />
        </div>
        <div className="relative max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl lg:text-5xl font-extrabold text-white leading-tight">
            Chaque jour sans PressiPro,<br />
            c&apos;est de l&apos;argent perdu.
          </h2>
          <p className="text-lg text-primary-100 mt-6 max-w-2xl mx-auto">
            Vos concurrents se digitalisent. Ne restez pas derrière.
            Commencez maintenant — c&apos;est gratuit, sans engagement, sans carte bancaire.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mt-10">
            <Link
              href="/register"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-2xl bg-white px-8 py-4 text-base font-bold text-primary-700 shadow-2xl hover:shadow-white/20 transition-all duration-300 hover:scale-[1.03]"
            >
              Créer mon pressing maintenant <ArrowRight className="w-5 h-5" />
            </Link>
          </div>
          <p className="text-primary-200 text-sm mt-6">✓ 14 jours d&apos;essai gratuit &nbsp; ✓ Aucune carte requise &nbsp; ✓ Prêt en 30 secondes</p>
        </div>
      </section>

      {/* ═════════ CONTACT ═════════ */}
      <section id="contact" className="py-16 bg-gray-900 text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-2 gap-12">
            <div>
              <div className="flex items-center gap-2 mb-4">
                <div className="w-9 h-9 bg-gradient-to-br from-primary-500 to-primary-700 rounded-xl flex items-center justify-center">
                  <Zap className="w-5 h-5 text-white" />
                </div>
                <span className="text-xl font-bold">PressiPro</span>
              </div>
              <p className="text-gray-400 leading-relaxed max-w-md">
                La plateforme SaaS de gestion de pressing conçue au Sénégal, pour le Sénégal.
                Simplifiez votre travail, augmentez vos revenus.
              </p>
              <div className="mt-6 space-y-3">
                <div className="flex items-center gap-3">
                  <HeadphonesIcon className="w-5 h-5 text-primary-400" />
                  <a href="tel:+221786037913" className="text-gray-300 hover:text-white transition-colors">+221 78 603 79 13</a>
                </div>
                <div className="flex items-center gap-3">
                  <Globe className="w-5 h-5 text-primary-400" />
                  <a href="mailto:aliounendiaye2511@gmail.com" className="text-gray-300 hover:text-white transition-colors">aliounendiaye2511@gmail.com</a>
                </div>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-8">
              <div>
                <h4 className="font-semibold text-sm text-gray-300 uppercase tracking-wider mb-4">Produit</h4>
                <ul className="space-y-2.5">
                  <li><a href="#fonctionnalites" className="text-sm text-gray-400 hover:text-white transition-colors">Fonctionnalités</a></li>
                  <li><a href="#tarifs" className="text-sm text-gray-400 hover:text-white transition-colors">Tarifs</a></li>
                  <li><a href="#temoignages" className="text-sm text-gray-400 hover:text-white transition-colors">Témoignages</a></li>
                  <li><a href="#demo" className="text-sm text-gray-400 hover:text-white transition-colors">Démo</a></li>
                </ul>
              </div>
              <div>
                <h4 className="font-semibold text-sm text-gray-300 uppercase tracking-wider mb-4">Compte</h4>
                <ul className="space-y-2.5">
                  <li><Link href="/login" className="text-sm text-gray-400 hover:text-white transition-colors">Se connecter</Link></li>
                  <li><Link href="/register" className="text-sm text-gray-400 hover:text-white transition-colors">Créer un compte</Link></li>
                </ul>
              </div>
            </div>
          </div>
          <div className="border-t border-gray-800 mt-12 pt-8 flex flex-col sm:flex-row items-center justify-between gap-4">
            <p className="text-sm text-gray-500">© {new Date().getFullYear()} PressiPro. Tous droits réservés.</p>
            <p className="text-sm text-gray-500">Fait avec ❤️ à Dakar, Sénégal</p>
          </div>
        </div>
      </section>
    </div>
  );
}
