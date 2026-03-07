"use client";

import { useState } from "react";
import { useAuth } from "@/components/auth-provider";
import Link from "next/link";
import { Store, User, Mail, Lock, Phone, MapPin, Sparkles } from "lucide-react";

export default function RegisterPage() {
  const { register } = useAuth();
  const [form, setForm] = useState({
    tenantName: "",
    tenantPhone: "",
    tenantAddress: "",
    name: "",
    email: "",
    password: "",
  });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const update = (field: string, value: string) =>
    setForm((f) => ({ ...f, [field]: value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
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
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-primary-50 to-violet-50 px-4 py-8">
      <div className="w-full max-w-lg animate-fade-in">
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-gradient-to-br from-primary-500 to-primary-700 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-xl shadow-primary-500/30">
            <span className="text-white font-bold text-2xl">P</span>
          </div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-primary-700 to-primary-500 bg-clip-text text-transparent">
            PressiPro
          </h1>
          <p className="text-gray-500 mt-2">Créez votre pressing en ligne</p>
        </div>

        <div className="card backdrop-blur-xl bg-white/80 border-white/50 shadow-xl">
          <h2 className="text-xl font-semibold text-gray-900 mb-6">Inscription</h2>

          {error && (
            <div className="bg-red-50 text-red-700 p-3 rounded-lg mb-4 text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <fieldset className="space-y-3">
              <legend className="text-sm font-medium text-gray-500 uppercase tracking-wide">
                Votre pressing
              </legend>
              <div>
                <label htmlFor="tenantName" className="block text-sm font-medium text-gray-700 mb-1">
                  Nom du pressing *
                </label>
                <input
                  id="tenantName"
                  required
                  className="input-field"
                  value={form.tenantName}
                  onChange={(e) => update("tenantName", e.target.value)}
                  placeholder="Pressing Élégance"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="tenantPhone" className="block text-sm font-medium text-gray-700 mb-1">
                    Téléphone
                  </label>
                  <input
                    id="tenantPhone"
                    className="input-field"
                    value={form.tenantPhone}
                    onChange={(e) => update("tenantPhone", e.target.value)}
                    placeholder="+221 77..."
                  />
                </div>
                <div>
                  <label htmlFor="tenantAddress" className="block text-sm font-medium text-gray-700 mb-1">
                    Adresse
                  </label>
                  <input
                    id="tenantAddress"
                    className="input-field"
                    value={form.tenantAddress}
                    onChange={(e) => update("tenantAddress", e.target.value)}
                    placeholder="Rufisque, Dakar"
                  />
                </div>
              </div>
            </fieldset>

            <fieldset className="space-y-3 pt-2">
              <legend className="text-sm font-medium text-gray-500 uppercase tracking-wide">
                Votre compte administrateur
              </legend>
              <div>
                <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">
                  Nom complet *
                </label>
                <input
                  id="name"
                  required
                  className="input-field"
                  value={form.name}
                  onChange={(e) => update("name", e.target.value)}
                  placeholder="Mamadou Diallo"
                />
              </div>
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
                  Email *
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
                <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
                  Mot de passe * (min. 6 caractères)
                </label>
                <input
                  id="password"
                  type="password"
                  required
                  minLength={6}
                  className="input-field"
                  value={form.password}
                  onChange={(e) => update("password", e.target.value)}
                  placeholder="••••••"
                  autoComplete="new-password"
                />
              </div>
            </fieldset>

            <button type="submit" disabled={loading} className="btn-primary w-full btn-lg mt-2">
              {loading ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <><Sparkles className="w-4 h-4" /> Créer mon pressing</>
              )}
            </button>
          </form>

          <p className="text-center text-sm text-gray-500 mt-6">
            Déjà inscrit ?{" "}
            <Link href="/login" className="text-primary-600 font-semibold hover:underline">
              Se connecter
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
