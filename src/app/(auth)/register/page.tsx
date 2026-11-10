"use client";

import { useState, useMemo } from "react";
import { useAuth } from "@/components/auth-provider";
import Link from "next/link";
import {
  Sparkles,
  Eye,
  EyeOff,
  Store,
  User,
  ArrowRight,
  ArrowLeft,
  CheckCircle2,
  ShieldCheck,
  Zap,
  MapPin,
  Phone,
} from "lucide-react";

export default function RegisterPage() {
  const { register } = useAuth();
  const [step, setStep] = useState<1 | 2>(1);

  const [form, setForm] = useState({
    tenantName: "",
    tenantPhone: "",
    tenantAddress: "",
    name: "",
    email: "",
    password: "",
  });

  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const update = (field: string, value: string) =>
    setForm((f) => ({ ...f, [field]: value }));

  // Password rules validation
  const passwordRules = useMemo(() => {
    const pw = form.password;
    return {
      length: pw.length >= 10,
      lowercase: /[a-z]/.test(pw),
      uppercase: /[A-Z]/.test(pw),
      number: /[0-9]/.test(pw),
      special: /[^A-Za-z0-9]/.test(pw),
    };
  }, [form.password]);

  const isPasswordValid = Object.values(passwordRules).every(Boolean);

  const handleNextStep = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!form.tenantName.trim() || form.tenantName.trim().length < 2) {
      setError("Veuillez renseigner un nom pour votre pressing (min. 2 caractères).");
      return;
    }

    setStep(2);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!form.name.trim() || form.name.trim().length < 2) {
      setError("Veuillez renseigner votre nom complet.");
      return;
    }

    if (!form.email.trim() || !form.email.includes("@")) {
      setError("Veuillez renseigner une adresse email valide.");
      return;
    }

    if (!isPasswordValid) {
      setError("Veuillez respecter tous les critères du mot de passe fort.");
      return;
    }

    setLoading(true);
    try {
      await register(form);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur d'inscription");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-primary-50/40 to-teal-50/40 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 px-4 py-8">
      <div className="w-full max-w-lg animate-fade-in space-y-6">
        {/* HEADER */}
        <div className="text-center">
          <div className="w-16 h-16 bg-gradient-to-br from-primary-600 via-primary-500 to-teal-600 rounded-2xl flex items-center justify-center mx-auto mb-3.5 shadow-xl shadow-primary-500/25">
            <span className="text-white font-black text-2xl">P</span>
          </div>
          <h1 className="text-3xl font-black bg-gradient-to-r from-primary-700 via-primary-600 to-teal-600 dark:from-primary-400 dark:to-teal-300 bg-clip-text text-transparent">
            PressiPro
          </h1>
          <p className="text-gray-500 dark:text-slate-400 text-sm mt-1">
            Rejoignez le logiciel moderne de gestion de pressing au Sénégal
          </p>
        </div>

        {/* STEP PROGRESS BAR */}
        <div className="flex items-center justify-center gap-2">
          <div className="flex items-center gap-2">
            <div
              className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                step === 1
                  ? "bg-primary-600 text-white shadow-md shadow-primary-500/25 ring-4 ring-primary-500/15"
                  : "bg-emerald-500 text-white"
              }`}
            >
              {step > 1 ? <CheckCircle2 className="w-4 h-4" /> : "1"}
            </div>
            <span className={`text-xs font-bold ${step === 1 ? "text-primary-700 dark:text-primary-300" : "text-gray-500 dark:text-slate-400"}`}>
              Votre Pressing
            </span>
          </div>

          <div className="w-8 h-0.5 bg-gray-200 dark:bg-slate-800" />

          <div className="flex items-center gap-2">
            <div
              className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                step === 2
                  ? "bg-primary-600 text-white shadow-md shadow-primary-500/25 ring-4 ring-primary-500/15"
                  : "bg-gray-200 dark:bg-slate-800 text-gray-500 dark:text-slate-400"
              }`}
            >
              2
            </div>
            <span className={`text-xs font-bold ${step === 2 ? "text-primary-700 dark:text-primary-300" : "text-gray-400 dark:text-slate-500"}`}>
              Compte Gérant
            </span>
          </div>
        </div>

        {/* MAIN CARD */}
        <div className="card bg-white dark:bg-slate-900 border border-gray-100 dark:border-slate-800/90 shadow-xl p-6 sm:p-8 space-y-6">
          {error && (
            <div className="bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300 p-3 rounded-xl text-xs font-medium border border-red-100 dark:border-red-900/60 animate-fade-in">
              {error}
            </div>
          )}

          {/* STEP 1: VOTRE PRESSING */}
          {step === 1 && (
            <form onSubmit={handleNextStep} className="space-y-4 animate-fade-in">
              <div className="flex items-center gap-2 border-b border-gray-100 dark:border-slate-800 pb-3">
                <div className="p-2 rounded-xl bg-primary-50 dark:bg-primary-950/50 text-primary-600 dark:text-primary-400">
                  <Store className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-gray-900 dark:text-white">Identité de votre pressing</h2>
                  <p className="text-xs text-gray-500 dark:text-slate-400">Ces informations figureront sur vos tickets et reçus WhatsApp.</p>
                </div>
              </div>

              <div>
                <label htmlFor="tenantName" className="block text-xs font-bold text-gray-700 dark:text-slate-300 mb-1">
                  Nom du pressing <span className="text-primary-600">*</span>
                </label>
                <input
                  id="tenantName"
                  required
                  autoFocus
                  className="input-field"
                  value={form.tenantName}
                  onChange={(e) => update("tenantName", e.target.value)}
                  placeholder="Ex : Pressing Prestige Dakar"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label htmlFor="tenantPhone" className="block text-xs font-bold text-gray-700 dark:text-slate-300 mb-1">
                    Téléphone (Contact ou Wave)
                  </label>
                  <input
                    id="tenantPhone"
                    className="input-field"
                    value={form.tenantPhone}
                    onChange={(e) => update("tenantPhone", e.target.value)}
                    placeholder="Ex : +221 77 123 45 67"
                  />
                </div>
                <div>
                  <label htmlFor="tenantAddress" className="block text-xs font-bold text-gray-700 dark:text-slate-300 mb-1">
                    Quartier / Ville
                  </label>
                  <input
                    id="tenantAddress"
                    className="input-field"
                    value={form.tenantAddress}
                    onChange={(e) => update("tenantAddress", e.target.value)}
                    placeholder="Ex : Mermoz, Dakar"
                  />
                </div>
              </div>

              {/* LIVE BRAND PREVIEW BADGE */}
              <div className="p-3.5 rounded-2xl bg-gradient-to-br from-primary-50/60 via-slate-50 to-teal-50/40 dark:from-slate-850 dark:to-slate-900 border border-primary-200/50 dark:border-slate-800 space-y-2">
                <span className="text-[10px] font-bold text-primary-700 dark:text-primary-400 uppercase tracking-wider block">
                  Aperçu de votre identité
                </span>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary-600 to-teal-600 text-white flex items-center justify-center font-bold text-lg shadow-sm">
                    {form.tenantName.trim() ? form.tenantName.trim().charAt(0).toUpperCase() : "P"}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-gray-900 dark:text-white truncate">
                      {form.tenantName.trim() || "Nom de votre pressing"}
                    </p>
                    <p className="text-[11px] text-gray-500 dark:text-slate-400 flex items-center gap-1 truncate">
                      <MapPin className="w-3 h-3 text-primary-500 shrink-0" />
                      {form.tenantAddress.trim() || "Adresse / Ville"}
                    </p>
                  </div>
                </div>
              </div>

              <button
                type="submit"
                className="btn-primary w-full btn-lg mt-2 flex items-center justify-center gap-2 cursor-pointer"
              >
                <span>Continuer vers votre compte</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </form>
          )}

          {/* STEP 2: VOTRE COMPTE ADMINISTRATEUR */}
          {step === 2 && (
            <form onSubmit={handleSubmit} className="space-y-4 animate-fade-in">
              <div className="flex items-center justify-between border-b border-gray-100 dark:border-slate-800 pb-3">
                <div className="flex items-center gap-2">
                  <div className="p-2 rounded-xl bg-primary-50 dark:bg-primary-950/50 text-primary-600 dark:text-primary-400">
                    <User className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="text-base font-bold text-gray-900 dark:text-white">Votre compte gérant</h2>
                    <p className="text-xs text-gray-500 dark:text-slate-400">Vos identifiants d&apos;accès administrateur à PressiPro.</p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="text-xs font-semibold text-gray-500 dark:text-slate-400 hover:text-primary-600 flex items-center gap-1 cursor-pointer"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>Retour</span>
                </button>
              </div>

              <div>
                <label htmlFor="name" className="block text-xs font-bold text-gray-700 dark:text-slate-300 mb-1">
                  Nom complet du gérant <span className="text-primary-600">*</span>
                </label>
                <input
                  id="name"
                  required
                  autoFocus
                  className="input-field"
                  value={form.name}
                  onChange={(e) => update("name", e.target.value)}
                  placeholder="Ex : Ousmane Diop"
                />
              </div>

              <div>
                <label htmlFor="email" className="block text-xs font-bold text-gray-700 dark:text-slate-300 mb-1">
                  Email de connexion <span className="text-primary-600">*</span>
                </label>
                <input
                  id="email"
                  type="email"
                  required
                  className="input-field"
                  value={form.email}
                  onChange={(e) => update("email", e.target.value)}
                  placeholder="admin@monpressing.sn"
                  autoComplete="email"
                />
              </div>

              <div>
                <label htmlFor="password" className="block text-xs font-bold text-gray-700 dark:text-slate-300 mb-1">
                  Mot de passe sécurisé <span className="text-primary-600">*</span>
                </label>
                <div className="relative">
                  <input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    required
                    minLength={10}
                    className="input-field pr-10"
                    value={form.password}
                    onChange={(e) => update("password", e.target.value)}
                    placeholder="Ex: Pressing#2026"
                    autoComplete="new-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-slate-200 transition-colors cursor-pointer"
                    aria-label="Afficher ou masquer le mot de passe"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>

                {/* Password strength checklist */}
                <div className="grid grid-cols-2 gap-1.5 mt-2 p-2.5 rounded-xl bg-gray-50 dark:bg-slate-800/60 text-[10px]">
                  <span className={`flex items-center gap-1 ${passwordRules.length ? "text-emerald-600 dark:text-emerald-400 font-bold" : "text-gray-400"}`}>
                    <CheckCircle2 className="w-3 h-3" /> Min. 10 caractères
                  </span>
                  <span className={`flex items-center gap-1 ${passwordRules.uppercase ? "text-emerald-600 dark:text-emerald-400 font-bold" : "text-gray-400"}`}>
                    <CheckCircle2 className="w-3 h-3" /> 1 Majuscule (A-Z)
                  </span>
                  <span className={`flex items-center gap-1 ${passwordRules.number ? "text-emerald-600 dark:text-emerald-400 font-bold" : "text-gray-400"}`}>
                    <CheckCircle2 className="w-3 h-3" /> 1 Chiffre (0-9)
                  </span>
                  <span className={`flex items-center gap-1 ${passwordRules.special ? "text-emerald-600 dark:text-emerald-400 font-bold" : "text-gray-400"}`}>
                    <CheckCircle2 className="w-3 h-3" /> 1 Spécial (@, #, !)
                  </span>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="btn-primary w-full btn-lg mt-3 flex items-center justify-center gap-2 cursor-pointer"
              >
                {loading ? (
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    <span>Créer mon pressing et commencer</span>
                  </>
                )}
              </button>
            </form>
          )}

          {/* VALUE PROPOSITION BADGES */}
          <div className="pt-3 border-t border-gray-100 dark:border-slate-800 grid grid-cols-3 gap-2 text-center text-[10px] text-gray-500 dark:text-slate-400">
            <div className="p-2 rounded-xl bg-gray-50 dark:bg-slate-800/40">
              <span className="block font-bold text-gray-800 dark:text-slate-200">10 Services</span>
              <span>Déjà configurés</span>
            </div>
            <div className="p-2 rounded-xl bg-gray-50 dark:bg-slate-800/40">
              <span className="block font-bold text-gray-800 dark:text-slate-200">Reçus Wave</span>
              <span>Paiement direct</span>
            </div>
            <div className="p-2 rounded-xl bg-gray-50 dark:bg-slate-800/40">
              <span className="block font-bold text-gray-800 dark:text-slate-200">Vitrine Web</span>
              <span>Devis en ligne</span>
            </div>
          </div>

          <p className="text-center text-xs text-gray-500 dark:text-slate-400 pt-1">
            Déjà inscrit ?{" "}
            <Link href="/login" className="text-primary-600 dark:text-primary-400 font-bold hover:underline">
              Se connecter
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
