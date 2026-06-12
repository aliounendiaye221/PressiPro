# Runbook de Redéploiement PressiPro

Date: 2026-03-30

## Résultat du pré-check actuel

- Prisma schema: OK
- Tests: OK (29/29)
- Lint global: KO (29 erreurs, 30 warnings)

Décision recommandée:
- `NO-GO` strict si votre politique impose lint vert.
- `GO` conditionnel possible si vous acceptez lint non bloquant temporaire (risque technique assumé).

## Préparation (avant déploiement)

1. Vérifier les secrets en plateforme (pas dans le code):
- DATABASE_URL
- JWT_SECRET (long, aléatoire)
- NEXT_PUBLIC_APP_URL

2. Vérifier la base:
- `npx prisma validate`
- `npx prisma migrate status`

3. Vérifier les checks qualité:
- `npm run test`
- `npm run lint` (si politique lint bloquant)

4. Vérifier healthcheck DB local:
- `GET /api/health/db`
- attendu: `200` + `{"ok":true,"status":"up"...}`

## Déploiement (ordre recommandé)

1. Push sur master (ou merge PR validée).
2. Laisser le workflow CI exécuter:
- `npm ci`
- `npx prisma validate`
- `npm run test`
3. Déployer la version.
4. Exécuter les smoke tests prod:
- Login
- Création client
- Création commande
- Génération reçu PDF
- Flow WhatsApp (download PDF + ouverture contact)
- Health DB: `GET /api/health/db`

## Smoke tests prod (checklist rapide)

1. Auth
- Connexion admin fonctionne
- Session persistante

2. Données métier
- Création client refuse doublon de numéro
- Numéro client stocké au format normalisé

3. Commandes
- Création commande OK
- Reçu PDF téléchargeable

4. WhatsApp
- Bouton « Envoyer sur WhatsApp »
- PDF téléchargé automatiquement
- Ouverture du bon contact
- Message prérempli sans lien

5. Santé système
- `GET /api/health/db` retourne 200

## Rollback rapide (si incident)

1. Revenir au déploiement précédent dans la plateforme.
2. Vérifier immédiatement:
- `/api/health/db`
- login
- création commande
3. Ouvrir un incident avec cause + impact + correctif prévu.

## Plan de stabilisation lint (après déploiement)

1. Corriger les erreurs lint bloquantes en priorité:
- imports non utilisés
- no-explicit-any
- react/no-unescaped-entities
- react-hooks/set-state-in-effect

2. Maintenir lint non bloquant jusqu'à retour à 0 erreurs.
3. Repasser lint en bloquant dans le pipeline après stabilisation.
