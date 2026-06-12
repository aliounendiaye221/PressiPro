# Faisabilite recuperation complete via Neon MCP - 2026-04-01

## Contexte
Objectif: recuperer integralement les commandes supprimees (avec items/paiements) avant redéploiement.

## Verification MCP Neon
- Projet identifie: delicate-wind-91045037 (neon-champagne-bridge)
- Endpoint confirme: ep-summer-surf-ahsp02zb-pooler.c-3.us-east-1.aws.neon.tech
- Retention historique Neon: 21600 secondes (6 heures)

## Donnees constatees en base
- Suppressions ORDER_DELETED:
  - premiere suppression: 2026-03-07T21:58:45.903Z
  - derniere suppression: 2026-03-26T08:38:06.096Z
  - total suppressions: 13
- Commandes restaurees depuis AuditLog: 13
- Commandes restaurees sans items: 13

## Conclusion technique
La restauration point-in-time complete est **impossible** a cette date:
- La fenetre Neon est de 6h.
- Les suppressions sont bien au-dela de cette fenetre.

## Impact
- Les 13 commandes existent a nouveau (id/code/total), mais sans lignes d'articles d'origine.
- Les paiements ont ete partiellement reconcilies quand possible via ORDER_CREATED.

## Actions recommandees
1. NO-GO metier pour redéploiement si politique exige restauration 100% historique.
2. Si GO operationnel: accepter explicitement 13 commandes incompletes, avec journal de risque signe.
3. Mettre en place immediatement:
   - sauvegarde reguliere (dump logique quotidien + retention >= 30 jours)
   - suppression logique (soft delete) au lieu de DELETE physique
   - garde-fou role/validation sur suppression commande
   - audit enrichi des snapshots commande/items/paiements avant suppression
