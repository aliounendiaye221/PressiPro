import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, FileCheck, CheckCircle2, AlertCircle, HelpCircle } from "lucide-react";

export const metadata: Metadata = {
  title: "Conditions Générales d'Utilisation",
  description: "Conditions Générales d'Utilisation (CGU) du service PressiPro.",
};

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-950 text-gray-900 dark:text-slate-100 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-gray-100 dark:border-slate-800 p-6 sm:p-10">
        <div className="mb-8">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-sm font-medium text-primary-600 dark:text-primary-400 hover:underline mb-4"
          >
            <ArrowLeft className="w-4 h-4" />
            Retour à l'accueil
          </Link>
          <div className="flex items-center gap-3">
            <div className="p-3 bg-primary-50 dark:bg-primary-950/50 rounded-xl text-primary-600 dark:text-primary-400">
              <FileCheck className="w-8 h-8" />
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Conditions Générales d'Utilisation</h1>
              <p className="text-sm text-gray-500 dark:text-slate-400 mt-1">Dernière mise à jour : 6 Octobre 2026</p>
            </div>
          </div>
        </div>

        <div className="prose dark:prose-invert max-w-none space-y-6 text-sm sm:text-base leading-relaxed text-gray-700 dark:text-slate-300">
          <section className="space-y-3">
            <h2 className="text-lg sm:text-xl font-semibold text-gray-900 dark:text-white flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-primary-600 dark:text-primary-400" />
              1. Objet du Service
            </h2>
            <p>
              <strong>PressiPro</strong> est une solution logicielle en mode SaaS (Software-as-a-Service) conçue spécifiquement pour la gestion informatisée des activités de pressing, blanchisserie et teinturerie. Les présentes CGU régissent l'accès et l'utilisation de la plateforme web ainsi que des applications mobiles Android et iOS associées.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg sm:text-xl font-semibold text-gray-900 dark:text-white flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-primary-600 dark:text-primary-400" />
              2. Comptes et Accès
            </h2>
            <p>
              Pour utiliser le service, le responsable de pressing doit créer un compte administrateur. Il est responsable de la confidentialité de ses identifiants et de ceux des employés (agents de comptoir) créés au sein de son établissement. Toute action effectuée depuis un compte authentifié est réputée avoir été effectuée par l'utilisateur titulaire.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg sm:text-xl font-semibold text-gray-900 dark:text-white flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-primary-600 dark:text-primary-400" />
              3. Abonnements et Tarification
            </h2>
            <p>
              PressiPro propose une période d'essai gratuit de 14 jours sans engagement. À l'issue de cet essai, l'accès aux fonctionnalités avancées s'effectue via abonnement mensuel ou annuel, payable par moyens de paiement locaux (Wave, Orange Money) ou carte bancaire.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg sm:text-xl font-semibold text-gray-900 dark:text-white flex items-center gap-2">
              <HelpCircle className="w-5 h-5 text-primary-600 dark:text-primary-400" />
              4. Disponibilité du Service et Support
            </h2>
            <p>
              Nous mettons en œuvre tous les moyens raisonnables pour assurer une disponibilité 24h/24 et 7j/7 du service (taux cible de 99.9%). Un support technique est disponible par téléphone et WhatsApp au <code>+221 78 603 79 13</code> pour accompagner les utilisateurs au quotidien.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
