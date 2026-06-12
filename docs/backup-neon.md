# Guide de Sauvegarde Logique pour Neon (PostgreSQL)

Ce document décrit comment mettre en place une sauvegarde logique régulière de votre base de données Neon, en complément des sauvegardes automatiques physiques gérées par Neon (PITR).

## Pourquoi une sauvegarde logique ?
Neon fournit des restaurations dans le temps (PITR), mais celles-ci sont physiques. En cas de perte de données complexe ou pour exporter les données vers un autre fournisseur, une sauvegarde logique (dump SQL) est essentielle. De plus, l'audit recommande une rétention de 30 jours, ce qui peut dépasser la limite de la formule gratuite/standard de Neon.

## Outils requis
- `pg_dump` (fourni avec PostgreSQL client tools)
- Un stockage sécurisé (S3, Google Cloud Storage, ou un serveur de backup dédié)
- Un ordonnanceur (Cron, GitHub Actions, Vercel Cron, ou équivalent)

## Méthode 1 : Sauvegarde via script bash et Cron (Serveur VPS / Machine locale)

1. **Créer le script de backup (`backup.sh`)**
   ```bash
   #!/bin/bash
   # Remplacez par l'URL de connexion sécurisée (pooling ou directe)
   DATABASE_URL="postgres://user:password@ep-nom-instance.neon.tech/dbname?sslmode=require"
   BACKUP_DIR="/chemin/vers/sauvegardes"
   TIMESTAMP=$(date +%Y%m%d_%H%M%S)
   BACKUP_FILE="$BACKUP_DIR/pressipro_backup_$TIMESTAMP.sql.gz"

   # Créer le dump et le compresser
   pg_dump "$DATABASE_URL" -Z 9 -f "$BACKUP_FILE"

   # (Optionnel) Uploader vers AWS S3
   # aws s3 cp "$BACKUP_FILE" s3://votre-bucket-backup/pressipro/

   # Nettoyer les backups de plus de 30 jours
   find "$BACKUP_DIR" -type f -name "*.sql.gz" -mtime +30 -exec rm {} \;
   ```

2. **Rendre le script exécutable**
   ```bash
   chmod +x backup.sh
   ```

3. **Ajouter à crontab (ex: tous les jours à 2h du matin)**
   ```bash
   0 2 * * * /chemin/vers/backup.sh
   ```

## Méthode 2 : Automatisation via GitHub Actions (Recommandé si vous n'avez pas de serveur)

Si votre code source est sur GitHub, vous pouvez utiliser GitHub Actions pour exécuter un backup régulier et l'envoyer vers AWS S3 (ou l'enregistrer comme artefact de courte durée).

1. **Fichier `.github/workflows/db-backup.yml`**
   ```yaml
   name: Database Backup
   on:
     schedule:
       - cron: '0 2 * * *' # Tous les jours à 2h UTC
     workflow_dispatch: # Permet de lancer manuellement

   jobs:
     backup:
       runs-on: ubuntu-latest
       steps:
         - name: Run pg_dump
           env:
             DATABASE_URL: ${{ secrets.DATABASE_URL_UNPOOLED }}
           run: |
             pg_dump "$DATABASE_URL" -Z 9 -f backup.sql.gz
         - name: Upload to S3
           env:
             AWS_ACCESS_KEY_ID: ${{ secrets.AWS_ACCESS_KEY_ID }}
             AWS_SECRET_ACCESS_KEY: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
             AWS_REGION: 'eu-west-3'
           run: |
             aws s3 cp backup.sql.gz s3://votre-bucket-backup/pressipro/backup-$(date +%Y%m%d).sql.gz
   ```

## Restauration
Pour restaurer une sauvegarde :
```bash
# Décompresser si nécessaire (si non compressé via pg_dump -Z)
# zcat backup.sql.gz | psql "$DATABASE_URL"

# Ou restauration directe (si dump compressé avec format custom de pg_dump -Fc)
# pg_restore -d "$DATABASE_URL" backup.dump
```

*Note: Lors de la restauration logique, assurez-vous de restaurer vers une base de données vide pour éviter les conflits d'unicité, ou de jouer le script avec l'option `--clean` (à utiliser avec précaution).*
