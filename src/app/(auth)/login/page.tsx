"use client";

import { useState } from "react";
import { useAuth } from "@/components/auth-provider";
import Link from "next/link";
import { LogIn, Mail, Lock, Eye, EyeOff, MessageSquare, PhoneCall, X, HelpCircle } from "lucide-react";

export default function LoginPage() {
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showForgotModal, setShowForgotModal] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await login(email, password);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur de connexion");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-primary-50 to-violet-50 px-4 py-8">
      <div className="w-full max-w-md animate-fade-in">
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-gradient-to-br from-primary-500 to-primary-700 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-xl shadow-primary-500/30">
            <span className="text-white font-bold text-2xl">P</span>
          </div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-primary-700 to-primary-500 bg-clip-text text-transparent">
            PressiPro
          </h1>
          <p className="text-gray-500 mt-2">Gestion de pressing simplifiée</p>
        </div>

        <div className="card bg-white shadow-xl">
          <h2 className="text-xl font-semibold text-gray-900 mb-6">Connexion</h2>

          {error && (
            <div className="bg-red-50 text-red-700 p-3 rounded-xl mb-4 text-sm border border-red-100">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1.5">
                Email
              </label>
              <div className="relative">
                <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  id="email"
                  type="email"
                  required
                  className="input-field pl-10"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="admin@pressipro.sn"
                  autoComplete="email"
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label htmlFor="password" className="block text-sm font-medium text-gray-700">
                  Mot de passe
                </label>
                <button
                  type="button"
                  onClick={() => setShowForgotModal(true)}
                  className="text-xs text-primary-600 hover:text-primary-800 font-medium hover:underline transition-colors"
                >
                  Mot de passe oublié ?
                </button>
              </div>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  required
                  className="input-field pl-10 pr-10"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••"
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                  aria-label="Afficher ou masquer le mot de passe"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button type="submit" disabled={loading} className="btn-primary w-full btn-lg">
              {loading ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <><LogIn className="w-4 h-4" /> Se connecter</>
              )}
            </button>
          </form>

          <p className="text-center text-sm text-gray-500 mt-6">
            Pas encore de compte ?{" "}
            <Link href="/register" className="text-primary-600 font-semibold hover:underline">
              Créer un pressing
            </Link>
          </p>
        </div>
      </div>

      {/* Modal Mot de passe oublié */}
      {showForgotModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in">
          <div className="card bg-white max-w-md w-full shadow-2xl border border-gray-100 p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-primary-50 text-primary-600 flex items-center justify-center font-bold">
                  <HelpCircle className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-gray-900 text-base">Récupération de compte</h3>
                  <p className="text-xs text-gray-500">Procédure simple en 1 clic</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowForgotModal(false)}
                className="text-gray-400 hover:text-gray-600 p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3.5 text-xs text-gray-600 leading-relaxed">
              <div className="p-3.5 rounded-xl bg-blue-50/70 border border-blue-100 space-y-1">
                <p className="font-semibold text-blue-900 flex items-center gap-1.5 text-xs">
                  👔 Vous êtes un employé ou caissier ?
                </p>
                <p className="text-blue-700">
                  Contactez votre <strong>gérant ou propriétaire du pressing</strong>. Il peut générer un nouveau mot de passe pour vous en 10 secondes depuis son espace <strong>Paramètres &gt; Utilisateurs</strong> et vous le partager directement par WhatsApp.
                </p>
              </div>

              <div className="p-3.5 rounded-xl bg-purple-50/70 border border-purple-100 space-y-2">
                <p className="font-semibold text-purple-900 flex items-center gap-1.5 text-xs">
                  🏪 Vous êtes propriétaire du pressing ?
                </p>
                <p className="text-purple-700">
                  Si vous êtes l&apos;administrateur principal et avez perdu votre accès, notre assistance technique peut débloquer votre compte en toute sécurité après vérification.
                </p>
                <div className="pt-1 flex flex-col sm:flex-row gap-2">
                  <a
                    href="https://wa.me/221770000000?text=Bonjour%20Support%20PressiPro,%20j'ai%20perdu%20l'accès%20à%20mon%20compte%20pressing.%20Mon%20email%20est%20:"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn-primary bg-emerald-600 hover:bg-emerald-700 text-xs flex items-center justify-center gap-1.5 py-2 flex-1"
                  >
                    <MessageSquare className="w-3.5 h-3.5" />
                    <span>WhatsApp Support</span>
                  </a>
                  <a
                    href="mailto:support@pressipro.com?subject=Recuperation%20de%20compte%20pressing"
                    className="btn-secondary text-xs flex items-center justify-center gap-1.5 py-2 flex-1"
                  >
                    <Mail className="w-3.5 h-3.5" />
                    <span>Email Support</span>
                  </a>
                </div>
              </div>
            </div>

            <div className="pt-2 flex justify-end">
              <button
                type="button"
                onClick={() => setShowForgotModal(false)}
                className="btn-secondary text-xs w-full sm:w-auto"
              >
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
