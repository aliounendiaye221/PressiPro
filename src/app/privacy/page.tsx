import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, ShieldCheck, Lock, Eye, FileText, Phone } from "lucide-react";

export const metadata: Metadata = {
  title: "Politique de Confidentialité",
  description: "Politique de confidentialité et protection des données personnelles de PressiPro.",
};

export default function PrivacyPage() {
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
              <ShieldCheck className="w-8 h-8" />
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Politique de Confidentialité</h1>
              <p className="text-sm text-gray-500 dark:text-slate-400 mt-1">Dernière mise à jour : 6 Octobre 2026</p>
            </div>
          </div>
        </div>

        <div className="prose dark:prose-invert max-w-none space-y-6 text-sm sm:text-base leading-relaxed text-gray-700 dark:text-slate-300">
          <section className="space-y-3">
            <h2 className="text-lg sm:text-xl font-semibold text-gray-900 dark:text-white flex items-center gap-2">
              <Lock className="w-5 h-5 text-primary-600 dark:text-primary-400" />
              1. Introduction et engagement
            </h2>
            <p>
              La plateforme <strong>PressiPro</strong> (accessible via le web à <code>pressipro.vercel.app</code> et via les applications mobiles Android et iOS) est éditée pour accompagner la digitalisation et la gestion opérationnelle des pressings et blanchisseries en République du Sénégal et dans la sous-région.
            </p>
            <p>
              Nous accordons une importance primordiale à la confidentialité et à la sécurité de vos données personnelles ainsi que de celles de vos clients, conformément aux réglementations applicables en matière de protection des données (notamment la Loi n° 2008-12 sur la protection des données à caractère personnel au Sénégal - CDP).
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg sm:text-xl font-semibold text-gray-900 dark:text-white flex items-center gap-2">
              <Eye className="w-5 h-5 text-primary-600 dark:text-primary-400" />
              2. Données collectées
            </h2>
            <p>Dans le cadre du fonctionnement du service PressiPro, nous pouvons collecter :</p>
            <ul className="list-disc pl-5 space-y-1.5">
              <li><strong>Informations de compte du gérant/agent :</strong> nom, prénom, numéro de téléphone, adresse email, mot de passe sécurisé (chiffré).</li>
              <li><strong>Informations relatives au pressing :</strong> dénomination commerciale, adresse physique, coordonnées de contact, tarifs des prestations.</li>
              <li><strong>Données clients du pressing :</strong> nom, prénom, numéro de téléphone de vos clients (utilisés strictement pour l'attribution des commandes de linge et les notifications WhatsApp/SMS de retrait).</li>
              <li><strong>Données des transactions :</strong> dépôts de linge, statuts de traitement, montants, modes de règlement (Espèces, Wave, Orange Money). Aucune coordonnée bancaire sensible n'est enregistrée.</li>
              <li><strong>Données techniques de l'application :</strong> type d'appareil, version du système d'exploitation, journal de connexion à des fins de sécurité et de diagnostic de bugs.</li>
            </ul>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg sm:text-xl font-semibold text-gray-900 dark:text-white flex items-center gap-2">
              <FileText className="w-5 h-5 text-primary-600 dark:text-primary-400" />
              3. Finalités du traitement
            </h2>
            <p>Les données sont traitées pour :</p>
            <ul className="list-disc pl-5 space-y-1.5">
              <li>Assurer l'exécution du service de gestion des commandes et facturation du pressing.</li>
              <li>Générer les reçus PDF et codes QR pour l'identification physique des vêtements.</li>
              <li>Permettre l'envoi de notifications de commande prête par WhatsApp ou SMS.</li>
              <li>Prévenir la fraude et assurer la traçabilité des règlements de caisse.</li>
              <li>Améliorer les performances et la stabilité de l'application mobile.</li>
            </ul>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg sm:text-xl font-semibold text-gray-900 dark:text-white flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-primary-600 dark:text-primary-400" />
              4. Permissions sur mobile (Android & iOS)
            </h2>
            <p>L'application mobile peut solliciter les autorisations suivantes :</p>
            <ul className="list-disc pl-5 space-y-1.5">
              <li><strong>Caméra :</strong> nécessaire uniquement pour scanner les codes QR sur les tickets de pressing afin d'accéder instantanément au détail d'une commande. Les flux vidéo ne sont ni enregistrés ni transmis à un serveur tiers.</li>
              <li><strong>Accès Internet / Réseau :</strong> requis pour synchroniser les données de vos commandes avec votre espace cloud en temps réel.</li>
              <li><strong>Stockage / Fichiers :</strong> requis pour télécharger et imprimer les reçus et récapitulatifs comptables au format PDF.</li>
            </ul>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg sm:text-xl font-semibold text-gray-900 dark:text-white flex items-center gap-2">
              <Lock className="w-5 h-5 text-primary-600 dark:text-primary-400" />
              5. Conservation et Sécurité des données
            </h2>
            <p>
              Toutes les données sont transmises via des protocoles de chiffrement sécurisés (HTTPS / TLS 1.3). Les bases de données sont isolées par établissement (multi-tenant strict) avec sauvegardes quotidiennes chiffrées.
            </p>
            <p>
              Nous ne vendons, ne louons et ne cédons jamais vos données personnelles ou celles de vos clients à des régies publicitaires tierces.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg sm:text-xl font-semibold text-gray-900 dark:text-white flex items-center gap-2">
              <Phone className="w-5 h-5 text-primary-600 dark:text-primary-400" />
              6. Vos droits et Contact
            </h2>
            <p>
              Conformément à la réglementation, vous disposez d'un droit d'accès, de rectification, de portabilité et de suppression de vos données personnelles. Vous pouvez demander la suppression définitive de votre compte ou de vos données à tout moment.
            </p>
            <div className="p-4 bg-gray-50 dark:bg-slate-800/60 rounded-xl border border-gray-200/80 dark:border-slate-700/80 text-sm">
              <p className="font-semibold text-gray-900 dark:text-white">Délégué à la Protection des Données (DPO) :</p>
              <p>Email : <a href="mailto:support@pressipro.tech" className="text-primary-600 dark:text-primary-400 underline">support@pressipro.tech</a></p>
              <p>Téléphone / WhatsApp : <a href="tel:+221786037913" className="text-primary-600 dark:text-primary-400 underline">+221 78 603 79 13</a></p>
              <p>Adresse : Rufisque, Dakar, Sénégal</p>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
