# Quiz Master - Local Version

**Quiz Master** est une application web d'apprentissage et de révision personnelle, conçue pour fonctionner entièrement **localement** dans votre navigateur. Importez vos propres quiz au format JSON, testez vos connaissances avec différents types de questions interactives, suivez votre progression et gérez vos données sans nécessiter de compte ou de connexion internet (après le chargement initial).

## Fonctionnalités Principales

*   **Fonctionnement 100% Local :** Aucune inscription, aucun serveur. Toutes les données (quiz, historique, statistiques, préférences) sont stockées dans le `localStorage` de votre navigateur.
*   **Importation Flexible de Quiz :**
    *   Chargez des fichiers `.json` depuis votre ordinateur.
    *   Utilisez la fonction glisser-déposer (Drag & Drop).
    *   Importez directement depuis une URL pointant vers un fichier `.json` valide (nécessite que le serveur distant autorise le partage CORS).
*   **Bibliothèque Locale :** Gérez et sélectionnez facilement les quiz que vous avez importés. L'application se souvient des quiz entre les sessions.
*   **Modes de Quiz Variés :**
    *   **Presets :** Sessions rapides, moyennes ou longues avec un nombre de questions prédéfini.
    *   **Toutes les questions :** Passez en revue l'intégralité d'un quiz.
    *   **Rejouer les erreurs :** Ciblez spécifiquement les questions échouées lors des X dernières sessions pour un quiz donné.
    *   **Examen Blanc :** Simulez des conditions d'examen (pas de feedback immédiat, score final).
    *   **Personnalisé :** Définissez vous-même le nombre de questions et/ou une limite de temps.
*   **Types de Questions Interactifs :**
    *   QCM (Choix Multiple Unique)
    *   Vrai/Faux
    *   Réponse Courte (Texte Libre)
    *   Association (Glisser-Déposer)
    *   Mise en Ordre (Glisser-Déposer)
    *   QCM Multi (Choix Multiple Multiple)
*   **Expérience de Quiz Configurable :**
    *   **Feedback Instantané :** Choisissez d'avoir ou non une indication Correct/Incorrect après chaque réponse.
    *   **Affichage Explication :** Option pour voir l'explication/réponse immédiatement en cas d'erreur (si feedback instantané activé).
    *   **Navigation Arrière :** Option pour revenir aux questions précédentes et modifier les réponses (désactive le feedback instantané).
    *   **Marquage de Questions :** Marquez des questions (⭐) pendant le quiz ou la révision pour les retrouver facilement.
    *   **Points Personnalisés :** Le créateur du quiz peut assigner un nombre de points spécifique à chaque question via le JSON.
    *   **Mode Plein Écran :** Immergez-vous dans le quiz sans distractions.
*   **Suivi de Progression Local :**
    *   **Historique Détaillé :** Conserve un historique de toutes vos sessions de quiz locales (score, points, temps, mode, date).
    *   **Statistiques Agrégées :** Suivez vos performances globales (nombre de quiz, précision moyenne, plus longue série) et par quiz individuel.
    *   **Gamification Locale :** Système simple de Niveau/XP et de badges basés sur vos performances et votre historique local.
*   **Révision Post-Quiz :**
    *   Consultez un résumé clair de vos résultats.
    *   Revoyez chaque question en détail (votre réponse, la bonne réponse, l'explication).
    *   Filtrez la révision pour voir uniquement les erreurs ou les questions marquées.
    *   Comparez votre performance à votre moyenne locale pour ce quiz.
    *   Exportez les résultats d'une session spécifique en format texte.
*   **Gestion des Données Locales :**
    *   **Export Complet :** Sauvegardez l'intégralité de vos données locales (bibliothèque, historique, stats, préférences, progression) dans un seul fichier JSON.
    *   **Import & Fusion :** Restaurez vos données depuis un fichier d'export. L'import fusionne les données (ajoute l'historique/bibliothèque sans doublons d'ID, met à jour les stats, écrase les préférences).
*   **Interface Moderne et Adaptative :**
    *   Design Neumorphic agréable.
    *   Thèmes Clair et Sombre.
    *   Adapté aux écrans de bureau, tablettes et mobiles.
    *   Support basique du Markdown pour le texte des questions et explications.

## Getting Started / Utilisation

Cette application est conçue pour fonctionner directement dans votre navigateur sans installation complexe.

1.  **Téléchargez ou Clonez :** Obtenez les fichiers du projet ( `index.html`, `style.css`, `script.js` et potentiellement un dossier `assets/images` pour les badges).
2.  **Ouvrez `index.html` :** Double-cliquez sur le fichier `index.html` ou ouvrez-le via le menu "Fichier > Ouvrir" de votre navigateur web moderne (Chrome, Firefox, Edge, Safari).
3.  **Importez un Quiz :**
    *   Utilisez le bouton "Choisir un fichier" ou le glisser-déposer pour charger un fichier `.json` de quiz (voir le guide de format ci-dessous).
    *   Ou collez une URL directe vers un fichier `.json` et cliquez sur "Importer depuis URL".
4.  **Configurez et Lancez :** Sélectionnez le quiz importé dans la bibliothèque, choisissez vos options de session et cliquez sur "Lancer la Session".
5.  **Répondez et Révisez !**

**Note sur l'Import URL :** Pour que l'importation depuis une URL fonctionne, le serveur hébergeant le fichier `.json` doit envoyer les en-têtes CORS appropriés (comme `Access-Control-Allow-Origin: *` ou une origine plus spécifique) pour autoriser votre application locale à le télécharger.

## Gestion des Données Locales

*   **Stockage :** Toutes vos données (quiz importés, historique des sessions, statistiques calculées, préférences de thème/son, progression de gamification) sont stockées dans le `localStorage` de votre navigateur.
*   **Persistance :** Ces données persistent tant que vous n'effacez pas les données de site pour cette application dans les paramètres de votre navigateur. Elles sont spécifiques au navigateur et au profil utilisateur utilisés.
*   **Sauvegarde et Transfert :** Utilisez la fonction **"Exporter TOUTES les données"** dans l'écran "Paramètres & Stats Locales" pour créer un fichier de sauvegarde `.json`. Vous pouvez ensuite utiliser la fonction **"Importer des données"** sur un autre navigateur ou après avoir effacé vos données pour restaurer votre progression (les données importées sont fusionnées avec celles existantes).

---