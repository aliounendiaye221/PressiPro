# PressiPro — SaaS de Gestion de Pressing

MVP de gestion de pressing multi-tenant pour Rufisque/Dakar, construit avec Next.js 15 (App Router), PostgreSQL, Prisma et Tailwind CSS.

## Fonctionnalités

- **Multi-tenant strict** : isolation complète par pressing (tenantId sur toutes les tables)
- **Auth & RBAC** : inscription, connexion, rôles ADMIN/AGENT
- **Clients** : CRUD + recherche téléphone instantanée + gestion doublons par tenant
- **Commandes (POS-style)** : dépôt rapide < 60s, boutons quick items, code court unique (P-XXXXX)
- **Statuts** : RECU → TRAITEMENT → PRET → LIVRE + rollback admin + historique complet
- **Paiements** : avance/solde/impayés, CASH/OM/WAVE, badges PAYE/PARTIEL/IMPAYE
- **Reçus PDF** : ticket 80mm + QR code, support DUPLICATA, audit impression
- **WhatsApp** : bouton wa.me avec message pré-rempli (reçu + commande prête)
- **Dashboard** : CA jour/semaine/mois, impayés, retards, journal paiements par méthode
- **Paramètres** : services, quick items, utilisateurs
- **PWA** : installable, cache shell, gestion connexion faible

## Stack

- **Frontend** : Next.js 15 (App Router) + React 19 + Tailwind CSS
- **Backend** : API Routes Next.js (server-side)
- **Base de données** : PostgreSQL + Prisma ORM
- **Auth** : JWT (jose) + bcryptjs, cookies HttpOnly
- **PDF** : @react-pdf/renderer (server-side)
- **QR Code** : qrcode (Node.js)

## Setup

### Prérequis

- Node.js 18+
- PostgreSQL 14+

### Installation

```bash
# Cloner le projet
git clone <repo-url>
cd PressiPro

# Installer les dépendances
npm install

# Configurer l'environnement
cp .env.example .env
# Éditer .env avec votre DATABASE_URL et JWT_SECRET

# Générer le client Prisma
npm run db:generate

# Appliquer les migrations
npm run db:migrate

# Seeder la base (tenant démo)
npm run db:seed

# Lancer le dev server
npm run dev
```

### Variables d'environnement

| Variable | Description | Exemple |
|----------|-------------|---------|
| `DATABASE_URL` | URL PostgreSQL | `postgresql://user:pass@localhost:5432/pressipro` |
| `JWT_SECRET` | Secret JWT (min 32 chars) | `votre-secret-random-ici` |
| `NEXT_PUBLIC_APP_URL` | URL publique de l'app | `http://localhost:3000` |

## Compte démo (après seed)

| Rôle | Email | Mot de passe |
|------|-------|-------------|
| Admin | admin@pressipro.sn | admin123 |
| Agent | agent@pressipro.sn | agent123 |

## Structure du projet

```
src/
├── app/
│   ├── (auth)/               # Pages login/register
│   │   ├── login/
│   │   └── register/
│   ├── (dashboard)/           # Pages protégées (layout avec sidebar)
│   │   ├── dashboard/
│   │   ├── orders/
│   │   │   ├── [id]/
│   │   │   └── new/
│   │   ├── customers/
│   │   │   └── [id]/
│   │   └── settings/
│   ├── api/
│   │   ├── auth/              # register, login, logout, me
│   │   ├── customers/         # CRUD
│   │   ├── orders/            # CRUD + status + payments + receipt.pdf
│   │   ├── services/          # CRUD
│   │   ├── users/             # Admin: CRUD agents
│   │   └── dashboard/         # Stats / KPIs
│   └── layout.tsx
├── components/
│   ├── auth-provider.tsx      # Context auth client-side
│   └── register-sw.tsx        # PWA service worker registration
├── lib/
│   ├── db.ts                  # Prisma singleton
│   ├── auth.ts                # JWT, hashing, session
│   ├── tenant.ts              # requireTenantId() helper
│   ├── rbac.ts                # requireRole(), requireAdmin()
│   ├── validators.ts          # Schémas Zod
│   ├── order-status.ts        # Transitions contrôlées
│   ├── order-code.ts          # Génération P-XXXXX
│   ├── audit.ts               # Audit log helper
│   ├── api-utils.ts           # Error/success responses normalisées
│   ├── utils.ts               # cn() helper
│   └── receipt/
│       ├── template.tsx       # React-PDF template 80mm
│       ├── mapper.ts          # Data types + formatters
│       └── qr.ts              # QR code generation
├── middleware.ts               # Auth middleware (protège routes)
└── __tests__/
    ├── core.test.ts           # Tests calculs + transitions
    └── tenant-isolation.test.ts
prisma/
├── schema.prisma
└── seed.ts
public/
├── manifest.json
└── sw.js
```

## Scripts

| Commande | Description |
|----------|-------------|
| `npm run dev` | Dev server avec Turbopack |
| `npm run build` | Build production |
| `npm run start` | Start production |
| `npm run db:generate` | Générer le client Prisma |
| `npm run db:migrate` | Appliquer les migrations |
| `npm run db:seed` | Seeder la base de données |
| `npm test` | Lancer les tests |
| `npm run lint` | ESLint |

## API Endpoints

### Auth
- `POST /api/auth/register` — Inscription (crée tenant + admin)
- `POST /api/auth/login` — Connexion
- `POST /api/auth/logout` — Déconnexion
- `GET /api/auth/me` — Session courante

### Customers
- `GET /api/customers?q=&page=` — Liste + recherche
- `POST /api/customers` — Création
- `GET /api/customers/:id` — Détail
- `PUT /api/customers/:id` — Mise à jour
- `DELETE /api/customers/:id` — Suppression

### Orders
- `GET /api/orders?q=&status=&page=` — Liste + recherche
- `POST /api/orders` — Création (dépôt)
- `GET /api/orders/:id` — Détail
- `PUT /api/orders/:id/status` — Changement de statut
- `POST /api/orders/:id/payments` — Ajouter un paiement
- `GET /api/orders/:id/payments` — Liste paiements
- `GET /api/orders/:id/receipt.pdf` — Reçu PDF (+ ?duplicate=1)

### Services
- `GET /api/services` — Liste active
- `POST /api/services` — Création (admin)
- `PUT /api/services/:id` — Modification (admin)
- `DELETE /api/services/:id` — Suppression logique (admin)

### Users
- `GET /api/users` — Liste (admin)
- `POST /api/users` — Création (admin)

### Dashboard
- `GET /api/dashboard` — Stats et KPIs

## Déploiement

### Vercel (recommandé)

1. Connecter le repo à Vercel
2. Ajouter les variables d'environnement
3. La base PostgreSQL peut être hébergée sur Neon, Supabase, ou Railway

### Docker (auto-hébergement)

```dockerfile
FROM node:18-alpine AS builder
WORKDIR /app
COPY . .
RUN npm ci && npx prisma generate && npm run build

FROM node:18-alpine
WORKDIR /app
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./
COPY --from=builder /app/prisma ./prisma
EXPOSE 3000
CMD ["npm", "start"]
```

## Licence

Propriétaire — Tous droits réservés.
