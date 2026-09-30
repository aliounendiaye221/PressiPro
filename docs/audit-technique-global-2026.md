# 📋 Rapport d'Audit Complet — PressiPro (SaaS Multi-Tenant)

**Date de l'audit** : 30 Septembre 2026  
**Auditeur** : Antigravity (Advanced Agentic Architecture & Security)  
**Périmètre** : Codebase global, API Routes, Sécurité & Authentification, Modèles Prisma & Base Neon, Performance, Mode PWA / Offline, Scripts et Déploiement.  
**Statut Global** : 🟡 **BON AVEC VULNÉRABILITÉS CRITIQUES À CORRIGER**

---

## Executive Summary

**PressiPro** est un SaaS de gestion de pressing bien conçu, particulièrement adapté aux réalités opérationnelles du marché sénégalais (Dakar / Rufisque). L'architecture logicielle fait preuve d'une excellente rigueur sur la séparation multi-tenant, la résilience aux pannes réseau (PWA et file d'attente hors ligne), ainsi que la traçabilité des encaissements (Orange Money / Wave / Espèces).

Cependant, l'audit met en évidence **une fuite critique de secret de base de données en clair dans des scripts**, un risque de **déni de service sur la génération PDF publique**, une anomalie ergonomique sur le **QR code des tickets imprimés**, et un **problème de friction majeure lors de l'onboarding des nouveaux pressings**.

---

## 1. Matrice des Risques & Vulnérabilités

| ID | Domaine | Gravité | Vulnérabilité / Problème | Statut |
|---|---|---|---|---|
| **SEC-01** | Sécurité | 🔴 **CRITIQUE** | Identifiants Neon DB de production en clair dans `scripts/` | **À corriger immédiatement** |
| **SEC-02** | Sécurité / DoS | 🔴 **ÉLEVÉ** | Route publique `/api/public/receipt/[token]` sans rate-limit avec rendu PDF lourd | **Action requise** |
| **LOG-01** | Métier / POS | 🟠 **ÉLEVÉ** | QR code du reçu PDF pointant vers l'URL privée `/orders/:id` au lieu du lien public | **Action requise** |
| **DAT-01** | Concurrence | 🟠 **MOYEN** | `generateOrderCode` non atomique (SELECT MAX au lieu d'une séquence) | **Optimisation** |
| **UX-01** | Onboarding | 🟠 **MOYEN** | Aucun service par défaut à l'inscription (abandon des nouveaux tenants) | **Amélioration produit** |
| **SEC-03** | Gouvernance | 🟡 **MOYEN** | Suppression d'un tenant en cascade sans délai de rétention ni confirmation stricte | **Sécurisation** |
| **PERF-01** | Build & CI | 🟡 **FAIBLE** | ESLint 9 FlatCompat très lent, build nécessitant `--max-old-space-size=4096` | **Maintenance** |
| **DB-01** | Base de données | 🟢 **MINEUR** | Index manquants sur `deletedAt` et `Payment.method` | **Optimisation** |

---

## 2. Analyse Approfondie des Vulnérabilités & Recommandations

### 🔴 SEC-01 : Chaîne de connexion Neon PostgreSQL en clair dans le code
- **Fichiers concernés** :
  - [`scripts/seed-neon.mjs:6`](file:///c:/Users/aliou/PressiPro/scripts/seed-neon.mjs#L6)
  - [`scripts/setup-neon.mjs:4`](file:///c:/Users/aliou/PressiPro/scripts/setup-neon.mjs#L4)
- **Constat** :
  ```javascript
  const DATABASE_URL =
    process.env.DATABASE_URL ||
    'postgresql://neondb_owner:npg_H7kBYAQ9XfTS@ep-summer-surf-ahsp02zb-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require';
  ```
  Le mot de passe de l'utilisateur `neondb_owner` est codé en dur en valeur de secours. Si ce code est poussé sur GitHub (public ou privé partagé), tout tiers a un accès administrateur total sur la base de données.
- **Recommandation immédiate** :
  1. Réinitialiser immédiatement le mot de passe de la base sur la console Neon.
  2. Supprimer la valeur de secours en dur dans ces scripts :
  ```javascript
  const DATABASE_URL = process.env.DATABASE_URL;
  if (!DATABASE_URL) {
    console.error("DATABASE_URL is required");
    process.exit(1);
  }
  ```

---

### 🔴 SEC-02 : Risque de Déni de Service (DoS) sur le rendu PDF public
- **Fichier concerné** : [`src/app/api/public/receipt/[token]/route.ts`](file:///c:/Users/aliou/PressiPro/src/app/api/public/receipt/[token]/route.ts)
- **Constat** :
  La route `/api/public/receipt/[token]` est exemptée de vérification de session dans [`src/middleware.ts`](file:///c:/Users/aliou/PressiPro/src/middleware.ts#L11). Chaque appel sans paramètre `?meta=1` exécute `@react-pdf/renderer` (`renderToBuffer`). 
  Ce moteur est gourmand en CPU et mémoire. Une boucle de quelques dizaines de requêtes simultanées peut facilement saturer le processeur ou dépasser les quotas de mémoire Vercel Serverless (code 137/134 OOM).
- **Recommandation** :
  1. Ajouter un rate-limiting basé sur l'IP sur `/api/public/receipt` (ex: 20 requêtes / minute).
  2. Ajouter une politique de cache HTTP `Cache-Control: public, max-age=300, stale-while-revalidate=86400` pour que les CDN / caches Vercel absorbent les requêtes répétées pour un même token.

---

### 🟠 LOG-01 : Le QR Code du reçu papier pointe vers l'espace agent privé
- **Fichier concerné** : [`src/lib/receipt/pdf.ts:104`](file:///c:/Users/aliou/PressiPro/src/lib/receipt/pdf.ts#L104)
- **Constat** :
  ```typescript
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const qrText = `${appUrl}/orders/${order.id}`;
  ```
  Lorsque le pressing imprime un ticket de caisse et le remet au client, le QR code imprimé contient l'URL `/orders/{id}`. Quand le client scanne ce code avec son smartphone, il arrive sur une page protégée qui le redirige immédiatement vers `/login`.
  Pourtant, le projet possède déjà un système complet de partage de reçus sécurisé par token : [`src/app/share/receipt/[token]/page.tsx`](file:///c:/Users/aliou/PressiPro/src/app/share/receipt/%5Btoken%5D/page.tsx).
- **Recommandation** :
  Dans [`src/lib/receipt/pdf.ts`](file:///c:/Users/aliou/PressiPro/src/lib/receipt/pdf.ts), générer un token via `createReceiptShareToken` et pointer le QR code vers :
  ```typescript
  const token = await createReceiptShareToken({ orderId: order.id, tenantId: order.tenantId });
  const qrText = `${appUrl}/share/receipt/${token}`;
  ```
  Ainsi, le client final accède directement à son reçu numérique certifié (statut, solde, paiement Wave/OM).

---

### 🟠 DAT-01 : Génération de code de commande et concurrence
- **Fichier concerné** : [`src/lib/order-code.ts`](file:///c:/Users/aliou/PressiPro/src/lib/order-code.ts)
- **Constat** :
  La documentation interne annonce une opération atomique `UPDATE ... RETURNING`, mais le code réel effectue un `SELECT COALESCE(MAX(...)) + 1 FROM "Order"`. En cas d'encaissements quasi-simultanés sur deux guichets du même pressing, les deux transactions tentent de créer le même code `P-XXXXX`.
  Bien qu'un mécanisme de retry (3 tentatives sur erreur Prisma `P2002`) soit implémenté dans [`src/app/api/orders/route.ts`](file:///c:/Users/aliou/PressiPro/src/app/api/orders/route.ts#L98), cela reste sous-optimal sous forte affluence.
- **Recommandation** :
  Ajouter un compteur incrémental dans le modèle `Tenant` (ex: `orderCounter Int @default(0)`) et incrémenter de manière atomique :
  ```typescript
  const updatedTenant = await tx.tenant.update({
    where: { id: tenantId },
    data: { orderCounter: { increment: 1 } },
    select: { orderCounter: true }
  });
  const code = `P-${String(updatedTenant.orderCounter).padStart(5, "0")}`;
  ```

---

### 🟠 UX-01 : Onboarding & Churn : Zéro service par défaut après inscription
- **Fichiers concernés** :
  - [`src/app/api/auth/register/route.ts`](file:///c:/Users/aliou/PressiPro/src/app/api/auth/register/route.ts)
  - [`docs/integrity-audit-2026-04-01.md`](file:///c:/Users/aliou/PressiPro/docs/integrity-audit-2026-04-01.md)
- **Constat** :
  Lorsqu'un pressing s'inscrit, la base crée le `Tenant` et l'utilisateur `User`, mais **aucun service**.
  L'audit de production d'avril 2026 a révélé que 4 pressings inscrits (`Al_Makhtoum`, `Dashow pressing`, `Pabi Sene`, `Tawhid Pressing`) avaient 0 service et 0 commande.
  Arrivés sur la page de dépôt `/orders/new`, le catalogue est vide et rien ne peut être enregistré sans configuration préalable fastidieuse.
- **Recommandation** :
  Insérer automatiquement les 10 services sénégalais les plus courants (Chemise, Pantalon, Boubou, Costume, Robe, Draps, Lavage au kilo...) lors de la transaction d'inscription.

---

### 🟡 SEC-03 : Suppression irréversible de Tenant en Super Admin
- **Fichier concerné** : [`src/app/api/admin/tenants/[id]/route.ts:89`](file:///c:/Users/aliou/PressiPro/src/app/api/admin/tenants/%5Bid%5D/route.ts#L89)
- **Constat** :
  La suppression d'un tenant supprime en dur (`deleteMany`) les clients, commandes, items, paiements ET les logs d'audit.
  Une fausse manipulation ou un token super-admin compromis permet d'effacer instantanément un commerce entier sans possibilité de rollback ni trace d'audit conservée.
- **Recommandation** :
  1. Privilégier la désactivation (`active: false`) plutôt que la suppression dure.
  2. Si la suppression est maintenue, exiger dans le payload JSON la confirmation du nom exact du pressing (`confirmationName === tenant.name`) et conserver l'historique d'audit légal.

---

### 🟡 PERF-01 : Problèmes de build et performance de linting
- **Fichiers concernés** :
  - [`eslint.config.mjs`](file:///c:/Users/aliou/PressiPro/eslint.config.mjs)
  - [`package.json`](file:///c:/Users/aliou/PressiPro/package.json#L7)
  - [`next.config.mjs`](file:///c:/Users/aliou/PressiPro/next.config.mjs#L11)
- **Constat** :
  - `eslint .` utilise `FlatCompat` sur ESLint 9, ce qui génère une surcharge importante et analyse des dossiers inutiles.
  - Le build Next.js a subi des saturations de tas V8 (`JavaScript heap out of memory`) et requiert l'argument `--max-old-space-size=4096`.
  - Le flag `ignoreDuringBuilds: true` a été posé pour contourner les lenteurs/blocages en CI Vercel.
- **Recommandation** :
  - Ajouter explicitement `.vercel/**` et les scripts de maintenance aux `ignores` d'ESLint.
  - Découper les gros composants client (comme [`orders/[id]/page.tsx`](file:///c:/Users/aliou/PressiPro/src/app/%28dashboard%29/orders/%5Bid%5D/page.tsx) qui fait plus de 1 000 lignes) en sous-composants mémoïsés.

---

## 3. Revue de la Qualité du Code & Architecture

### 3.1 Ce qui est remarquable (Forces)
1. **Isolation Multi-Tenant** : Le filtrage par `tenantId` issu du token de session ([`requireTenantSession`](file:///c:/Users/aliou/PressiPro/src/lib/tenant.ts#L16)) est systématique. Les paramètres d'URL injectés par des clients malveillants ne peuvent pas outrepasser la session.
2. **PWA & Offline Queue** : La gestion du mode hors ligne dans [`src/lib/offline-queue.ts`](file:///c:/Users/aliou/PressiPro/src/lib/offline-queue.ts) avec remapping des ID temporaires de clients et détection des conflits 409 est de très haut niveau pour une application web de caisse.
3. **Double mode d'impression** : Disponibilité simultanée de l'impression thermique directe USB/Série (ESC/POS) et des tickets PDF vectoriels 80mm format ticket de caisse.
4. **Politique d'authentification** : Mot de passe fort obligatoire, vérification bcrypt avec coût 12, verrouillage temporaire après 5 tentatives infructueuses, rate-limiting IP/email.
5. **Soft Delete et Audit Logs** : Implémentation du champ `deletedAt` sur les commandes avec historique d'audit exhaustif incluant un instantané complet des articles.

### 3.2 Tests Unitaires
- **Vitest** : 3 suites de tests, **31/31 tests réussis (100%)** :
  - `tenant-isolation.test.ts` (4 tests) : Validation de l'étanchéité multi-tenant.
  - `core.test.ts` (21 tests) : Transitions de statut de commande, calculs de remise, formatage FCFA, normalisation E.164.
  - `auth-security.test.ts` (6 tests) : Règle de mot de passe fort, rate-limiting mémoire, expiration de fenêtre.

---

## 4. Plan d'Action Recommandé (Feuille de Route)

### Phase 1 : Sécurité Immédiate (Jour 1)
- [ ] Révoquer et renouveler les identifiants de base de données Neon.
- [ ] Nettoyer les URLs en clair dans `scripts/seed-neon.mjs` et `scripts/setup-neon.mjs`.
- [ ] Ajouter un rate-limit sur `/api/public/receipt/[token]`.

### Phase 2 : Correctifs Métier & Expérience Client (Semaine 1)
- [ ] Corriger le QR code du ticket PDF pour pointer vers l'URL publique partagée (`/share/receipt/[token]`).
- [ ] Injecter un pack de services par défaut à l'inscription d'un pressing.
- [ ] Remplacer le `SELECT MAX` de `generateOrderCode` par un compteur atomique sur le modèle `Tenant`.

### Phase 3 : Dette Technique & Optimisation (Semaine 2)
- [ ] Ajouter les index composites `@@index([tenantId, deletedAt])` et `@@index([tenantId, method])` dans `prisma/schema.prisma`.
- [ ] Refactoriser `orders/[id]/page.tsx` en sous-composants modulaires.
- [ ] Nettoyer la configuration ESLint pour accélérer les vérifications locales.
