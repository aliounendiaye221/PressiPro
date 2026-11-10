# Guide Complet : Publication de PressiPro sur Google Play Store & Apple App Store

Ce guide détaille pas à pas la configuration, la génération des binaires et les procédures officielles pour publier **PressiPro** sur le **Google Play Store (Android)** et l'**Apple App Store (iOS)**.

---

## 1. Architecture Mobile de PressiPro

PressiPro utilise **Capacitor 8**, le standard moderne recommandé pour packager des applications Next.js / React en applications natives iOS & Android.

- **Nom de l'application** : `PressiPro`
- **Identifiant Unique (Package ID / Bundle ID)** : `com.pressipro.app`
- **URL de production connectée** : `https://pressipro.vercel.app` (ou votre domaine personnalisé `https://pressipro.tech`)
- **Avantage majeur** : Grâce à l'architecture WebView native connectée, **toute modification ou mise à jour déployée sur Vercel est immédiatement disponible sur les téléphones des gérants de pressing**, sans nécessiter de nouvelle soumission sur les stores (sauf ajout de permissions matérielles natives).
- **Mode Hors Ligne / Fallback** : Un écran local et un Service Worker garantissent qu'un message d'attente s'affiche si l'utilisateur n'a pas de connexion Internet.

---

## 2. Publication sur le Google Play Store (Android)

### Étape 2.1 : Prérequis Google Play
1. Créer un compte **Google Play Console** sur [play.google.com/console](https://play.google.com/console) (frais unique de 25 $ USD).
2. Compléter la vérification d'identité (DNI/Passeport ou entreprise).

### Étape 2.2 : Générer la clé de signature privée (Keystore)
Google Play exige que les versions de production soient signées avec une clé privée.

Exécutez dans un terminal :
```bash
keytool -genkey -v -keystore pressipro-release-key.jks -keyalg RSA -keysize 2048 -validity 10000 -alias pressipro
```
> ⚠️ **IMPORTANT** : Conservez le fichier `pressipro-release-key.jks` et vos mots de passe en lieu sûr (sauvegarde cloud sécurisée). La perte de cette clé empêche toute mise à jour future sur le Play Store !

### Étape 2.3 : Configurer la signature sécurisée dans Gradle
Pour ne **jamais enregistrer vos mots de passe en clair dans Git**, le projet est déjà pré-configuré pour lire un fichier local sécurisé `android/key.properties` (ignoré par Git).

1. Créez le fichier `android/key.properties` (ou copiez `android/key.properties.example`) :
```properties
storeFile=../pressipro-release-key.jks
storePassword=VOTRE_MOT_DE_PASSE
keyAlias=pressipro
keyPassword=VOTRE_MOT_DE_PASSE
```
2. `android/app/build.gradle` applique automatiquement cette signature pour toute compilation de release. Si le fichier n'est pas encore présent, les builds de test restent fonctionnels sans erreur.

### Étape 2.4 : Générer l'Android App Bundle (.aab)
Google Play exige le format **AAB** (Android App Bundle), plus léger que l'ancien APK :

Dans le dossier du projet :
```bash
npm run cap:sync
npm run cap:bundle:android
```
Le fichier généré se trouvera dans :
`android/app/build/outputs/bundle/release/app-release.aab`

### Étape 2.5 : Créer la fiche sur Google Play Console
1. **Créer une application** :
   - Nom : `PressiPro — Gestion de Pressing`
   - Langue par défaut : Français
   - Type : Application (Gratuite ou Freemium)
2. **Politique de confidentialité (Obligatoire)** :
   - URL : `https://pressipro.vercel.app/privacy`
3. **Accès aux fonctionnalités** :
   - Indiquer un compte de test pour l'équipe Google (ex: `demo@pressipro.tech` / mot de passe).
4. **Classification du contenu** :
   - Remplir le questionnaire (catégorie Entreprise / Productivité, classification Tout Public 3+).
5. **Fiche Play Store (Assets graphiques)** :
   - Icône haute résolution : 512x512 PNG (déjà disponible dans `public/icon-512.png`).
   - Image de présentation (Feature Graphic) : 1024x500 PNG/JPEG.
   - Captures d'écran mobiles : minimum 2 captures (Dashboard, Dépôt de commande, Reçu PDF).
6. **Mise en production** :
   - Uploader le fichier `app-release.aab`.
   - Lancer un test interne ou soumettre directement à la validation (délai : 24 à 72 heures).

---

## 3. Publication sur l'Apple App Store (iOS)

### Étape 3.1 : Prérequis Apple
1. Adhérer au **Apple Developer Program** sur [developer.apple.com](https://developer.apple.com) (99 $ USD/an).
2. Disposer d'un Mac avec **Xcode** installé (ou utiliser un service CI/CD comme GitHub Actions / Codemagic).

### Étape 3.2 : Ouvrir le projet dans Xcode
Dans le dossier du projet :
```bash
npm run cap:sync
npm run cap:open:ios
```
Cela ouvre le projet natif dans Xcode (`ios/App/App.xcworkspace`).

### Étape 3.3 : Configurer Signing & Capabilities dans Xcode
1. Dans le navigateur de gauche de Xcode, cliquez sur le projet racine **App**.
2. Allez dans l'onglet **Signing & Capabilities**.
3. Cochez **Automatically manage signing**.
4. Sélectionnez votre équipe Apple Developer dans **Team**.
5. Vérifiez que le **Bundle Identifier** est bien `com.pressipro.app`.

### Étape 3.4 : Permissions & Conformité aux Guidelines Apple
Apple est très strict sur les applications issues de technologies web. Les exigences suivantes ont déjà été intégrées dans le code de PressiPro :
- ✅ **Safe Area Insets** : Prise en charge des encoches iPhone et de la barre Dynamic Island.
- ✅ **Justification des permissions** : `NSCameraUsageDescription` est configuré dans `Info.plist` avec la phrase explicative pour le scanneur QR.
- ✅ **Écran Splash & Status Bar natifs** : Empêche l'effet de page blanche au lancement.
- ✅ **Politique de confidentialité** : Accessible sur `https://pressipro.vercel.app/privacy`.
- ✅ **Conditions Générales** : Accessibles sur `https://pressipro.vercel.app/terms`.

### Étape 3.5 : Compiler et distribuer vers App Store Connect
1. Dans Xcode, sélectionnez la cible **Any iOS Device (arm64)**.
2. Allez dans le menu : **Product > Archive**.
3. Une fois l'archive créée dans l'Organizer de Xcode, cliquez sur **Distribute App**.
4. Choisissez **App Store Connect** > **Upload**.
5. Xcode téléverse automatiquement le binaire vers votre compte App Store Connect.

### Étape 3.6 : Fiche App Store Connect
1. Connectez-vous sur [appstoreconnect.apple.com](https://appstoreconnect.apple.com).
2. Rendez-vous dans **Mes apps** > Cliquez sur **+** (Nouvelle app).
   - Plateforme : iOS
   - Nom : `PressiPro`
   - Langue principale : Français
   - Bundle ID : `com.pressipro.app`
   - SKU : `pressipro-01`
3. Renseignez la description, les mots-clés (`pressing, blanchisserie, dakar, sénégal, gestion, caisse, wave`), et les captures d'écran iPhone (6.5" et 5.5").
4. Renseignez l'URL de confidentialité : `https://pressipro.vercel.app/privacy`.
5. Dans les informations pour l'équipe d'examen Apple (App Review Information), fournissez les identifiants d'un compte de démo pour qu'ils puissent tester la connexion.
6. Cliquez sur **Soumettre pour vérification** (Délai moyen : 24 à 48 heures).

---

## 4. Commandes Utiles au Quotidien

| Commande | Action |
|---|---|
| `npm run cap:sync` | Synchronise les modifications web/plugins avec les projets natifs Android et iOS |
| `npm run cap:open:android` | Ouvre le projet Android dans Android Studio |
| `npm run cap:open:ios` | Ouvre le projet iOS dans Xcode |
| `npm run cap:build:android` | Compile un APK de release Android |
| `npm run cap:bundle:android` | Génère le bundle `.aab` pour Google Play Store |
| `powershell -File scripts/generate-mobile-icons.ps1` | Régénère toutes les icônes mobiles Android & iOS |
