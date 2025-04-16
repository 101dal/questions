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

## Créer Votre Propre Quiz (Format JSON)

Pour créer un quiz compatible avec Quiz Master, vous devez créer un fichier texte avec l'extension `.json` respectant la structure suivante :

```json
{
  "quizId": "identifiant_unique_pour_ce_quiz",
  "quizTitle": "Titre Lisible de Votre Quiz",
  "dummyAnswers": { // Optionnel: pour générer des réponses incorrectes
    "NomCategorie1": ["Distracteur 1", "Distracteur 2"],
    "NomCategorie2": ["Autre Distracteur"],
    "Global": ["Distracteur générique 1", "Distracteur générique 2"]
  },
  "questions": [
    // --- Début d'un objet Question ---
    {
      "id": "q1_unique_optional", // Optionnel mais recommandé : ID unique de la question
      "type": "qcm", // Type de question (voir types ci-dessous)
      "text": "Le texte de votre question. Peut utiliser du **Markdown** *simple*.",
      "correctAnswer": "La bonne réponse (string pour QCM)",
      "explanation": "L'explication affichée après la réponse ou en révision. *Markdown* aussi possible.",
      "points": 10, // Optionnel: Nombre de points (défaut: 10)
      "category": "NomCategorie1" // Optionnel: Pour stats et dummyAnswers
    },
    // --- Autre objet Question ---
    {
      "id": "q2",
      "type": "vrai_faux",
      "text": "Affirmation Vrai/Faux ?",
      "correctAnswer": true, // boolean: true ou false
      "explanation": "Explication...",
      "points": 5
    },
    // --- Autre objet Question ---
    {
      "id": "q3",
      "type": "texte_libre",
      "text": "Quelle est la capitale de... ?",
      "correctAnswer": "Réponse exacte attendue", // String
      "explanation": "Explication...",
      "points": 8
      // "tolerance": 0.8 // Optionnel: future fonctionnalité
    },
     // --- Autre objet Question ---
     {
        "id": "q4",
        "type": "ordre",
        "text": "Remettez dans l'ordre :",
        "items": ["Item B", "Item A", "Item C"], // Items à ordonner (seront mélangés à l'affichage)
        "correctAnswer": ["Item A", "Item B", "Item C"], // Array de strings DANS LE BON ORDRE
        "explanation": "...",
        "points": 15
     },
     // --- Autre objet Question ---
     {
        "id": "q5",
        "type": "association",
        "text": "Associez les éléments :",
        "items_left": ["Element Gauche 1", "Element Gauche 2"], // Elements à glisser
        "items_right": ["Cible Droite A", "Cible Droite B"],    // Cibles fixes
        "correctAnswer": { // Objet map: Clé = item_left, Valeur = item_right correct
            "Element Gauche 1": "Cible Droite B",
            "Element Gauche 2": "Cible Droite A"
        },
        "explanation": "...",
        "points": 20
     },
     // --- Autre objet Question ---
     {
        "id": "q6",
        "type": "qcm_multi",
        "text": "Cochez toutes les bonnes réponses :",
        "correctAnswer": ["Bonne Réponse 1", "Autre Bonne Réponse"], // Array de strings
        "explanation": "...",
        "points": 12
     }
    // ... Ajoutez autant de questions que nécessaire
  ]
}
```

**Champs Clés du JSON :**

*   **`quizId` (String - Obligatoire) :** Identifiant *unique* pour ce fichier quiz. Ne doit pas changer si vous mettez à jour le quiz. Permet de lier l'historique et les statistiques. Ex: `"chimie_chapitre_1_v2"`.
*   **`quizTitle` (String - Obligatoire) :** Titre lisible affiché dans l'application. Ex: `"Chimie - Chapitre 1 : Atomes"`.
*   **`dummyAnswers` (Objet - Optionnel) :** Contient des réponses incorrectes ("distracteurs") pour peupler les QCM/QCM-Multi si besoin. Les clés sont des noms de catégories (correspondant au champ `category` des questions) ou `"Global"`. Les valeurs sont des tableaux de strings.
*   **`questions` (Array - Obligatoire) :** Tableau contenant les objets de chaque question.
    *   **`id` (String - Optionnel mais Fortement Recommandé) :** Identifiant unique *pour cette question* au sein du quiz. Permet un suivi plus fiable.
    *   **`type` (String - Obligatoire) :** Le type de question. Valeurs possibles : `"qcm"`, `"vrai_faux"`, `"texte_libre"`, `"association"`, `"ordre"`, `"qcm_multi"`.
    *   **`text` (String - Obligatoire) :** L'énoncé de la question. Peut contenir du Markdown simple ( `**gras**`, `*italique*`, `` `code` ``, ``` ```bloc code``` ``, listes `- / 1.` ).
    *   **`correctAnswer` (Variable - Obligatoire) :** La bonne réponse. Le format dépend du `type` (voir exemple ci-dessus).
    *   **`explanation` (String - Obligatoire) :** Explication détaillée. Peut être `""` si aucune explication n'est nécessaire. Supporte le Markdown simple.
    *   **`points` (Number - Optionnel) :** Nombre de points pour cette question (entier positif). Si absent, une valeur par défaut (ex: 10) est utilisée.
    *   **`category` (String - Optionnel) :** Catégorie ou tag pour la question. Utilisé pour les statistiques et potentiellement les `dummyAnswers`.
    *   **`items` (Array de Strings - Requis pour `type: "ordre"`) :** Les éléments à ordonner.
    *   **`items_left` / `items_right` (Arrays de Strings - Requis pour `type: "association"`) :** Les éléments à glisser et les cibles fixes.

**Syntaxe JSON Importante :**

*   Le fichier doit être un objet JSON valide (commence par `{` et finit par `}`).
*   Les clés (noms des champs comme `"quizId"`) et les valeurs de type string *doivent* être entre guillemets doubles (`"`).
*   Les éléments d'un tableau sont séparés par des virgules (`,`) et encadrés par des crochets (`[]`).
*   Les paires clé-valeur dans un objet sont séparées par des virgules (`,`) et encadrées par des accolades (`{}`).
*   Attention aux virgules finales (interdites après le dernier élément d'un objet ou d'un tableau). Utilisez un validateur JSON en ligne pour vérifier votre fichier si vous avez des doutes.

## Gestion des Données Locales

*   **Stockage :** Toutes vos données (quiz importés, historique des sessions, statistiques calculées, préférences de thème/son, progression de gamification) sont stockées dans le `localStorage` de votre navigateur.
*   **Persistance :** Ces données persistent tant que vous n'effacez pas les données de site pour cette application dans les paramètres de votre navigateur. Elles sont spécifiques au navigateur et au profil utilisateur utilisés.
*   **Sauvegarde et Transfert :** Utilisez la fonction **"Exporter TOUTES les données"** dans l'écran "Paramètres & Stats Locales" pour créer un fichier de sauvegarde `.json`. Vous pouvez ensuite utiliser la fonction **"Importer des données"** sur un autre navigateur ou après avoir effacé vos données pour restaurer votre progression (les données importées sont fusionnées avec celles existantes).

---