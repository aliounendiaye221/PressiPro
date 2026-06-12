# Audit integrite donnees SaaS - 2026-04-01

## Perimetre
- Verification multi-tenant sur base Neon de production
- Controle des commandes, items, paiements, coherence montants, doublons, suppressions

## Resultat global
- Tenants: 7
- Commandes: 65
- Items de commande: 108
- Paiements: 34
- Suppressions non resolues: 0
- Commandes restaurees sans items: 13
- Incoherences total commande vs items: 13
- Incoherences paidAmount vs paiements: 0
- Doublons de code commande: 0

## Etat par tenant

### Pressing Elégance Rufisque (demo-tenant)
- Users: 3
- Customers: 13
- Services: 15
- Orders: 29
- Restored orders: 2
- Orders without items: 2
- Order total mismatch: 2
- Paid mismatch: 0

### Pressing Centre (cmmuuoblf0000lb04bnf8tb5t)
- Users: 1
- Customers: 19
- Services: 14
- Orders: 25
- Restored orders: 11
- Orders without items: 11
- Order total mismatch: 11
- Paid mismatch: 0

### Maxi Jet (cmmmhyo220000jo04htqileco)
- Users: 2
- Customers: 9
- Services: 6
- Orders: 11
- Restored orders: 0
- Orders without items: 0
- Order total mismatch: 0
- Paid mismatch: 0

### Al_Makhtoum (cmn54hucr0000l504okqtzhqj)
- Users: 1
- Customers: 1
- Services: 0
- Orders: 0

### Dashow pressing (cmndjmkhs0000if04rg256ckh)
- Users: 1
- Customers: 0
- Services: 0
- Orders: 0

### Pabi Sene (cmmx0v32u0000l704rbjuodlu)
- Users: 1
- Customers: 1
- Services: 0
- Orders: 0

### Tawhid Pressing (cmnem8fck0000k104ur8vlm0a)
- Users: 1
- Customers: 1
- Services: 0
- Orders: 0

## Recuperation effectuee
- Toutes les commandes supprimees detectees via AuditLog ORDER_DELETED ont ete recreees (13/13)
- Recuperation complementaire des acomptes depuis AuditLog ORDER_CREATED sur 5 commandes restaurees

## Limite critique
- Les 13 commandes restaurees n'ont pas pu recuperer leurs items originaux (OrderItem) car les suppressions ont cascade et ces details ne sont pas stockes dans AuditLog
- Recuperation 100% exacte de ces 13 commandes necessite une restauration depuis sauvegarde Neon (point-in-time)

## Scripts utilises
- scripts/restore-deleted-orders-from-audit-neon.mjs
- scripts/reconcile-restored-orders-from-created-audit-neon.mjs
- scripts/verify-all-tenants-integrity-neon.mjs
- scripts/list-restored-orders-neon.mjs
