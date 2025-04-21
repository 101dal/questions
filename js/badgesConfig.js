// js/badgesConfig.js

/**
 * Définit tous les badges disponibles, leurs informations d'affichage
 * et la logique pour déterminer s'ils sont obtenus.
 *
 * Chaque définition de badge contient :
 * - id: Identifiant unique (string)
 * - name: Nom affiché à l'utilisateur (string)
 * - description: Texte affiché en tooltip ou détail (string)
 * - icon_url: Chemin vers l'icône (string, optionnel)
 * - type: Quand vérifier ce badge ?
 *     - 'session': Vérifié à la fin d'une session de quiz. La fonction checkCondition recevra les données de la session.
 *     - 'global': Vérifié lors du recalcul des statistiques globales. La fonction checkCondition recevra l'objet state.localStats.
 * - checkCondition: Fonction (data) => boolean
 *     - Prend en argument les données pertinentes (session ou globales).
 *     - Retourne true si les conditions du badge sont remplies pour ces données, false sinon.
 */
export const BADGE_DEFINITIONS = [
    // --- Badges de Session (vérifiés dans results.js) ---
    {
        id: 'perfect_score',
        name: 'Score Parfait ! 🎉',
        description: 'Terminer un quiz avec 100% de bonnes réponses.',
        icon_url: 'assets/images/badge_perfect.png', // Mettez vos chemins réels
        type: 'session',
        checkCondition: (sessionData) => {
            // sessionData contiendra { accuracy, numQuestions, ... }
            return sessionData.accuracy >= 100 && sessionData.numQuestions > 0;
        }
    },
    {
        id: 'streak_5',
        name: 'Série de 5 🔥',
        description: 'Réussir 5 questions d\'affilée dans une session.',
        icon_url: 'assets/images/badge_streak5.png',
        type: 'session',
        checkCondition: (sessionData) => {
            // sessionData contiendra { maxStreak, ... }
            return sessionData.maxStreak >= 5;
        }
    },
    {
        id: 'streak_10',
        name: 'Série de 10 🔥🔥',
        description: 'Réussir 10 questions d\'affilée dans une session.',
        icon_url: 'assets/images/badge_streak10.png',
        type: 'session',
        checkCondition: (sessionData) => {
            return sessionData.maxStreak >= 10;
        }
    },
    {
        id: 'quick',
        name: 'Rapide ! ⚡️',
        description: 'Terminer un quiz d\'au moins 10 questions en moins d\'une minute.',
        icon_url: 'assets/images/badge_quick.png',
        type: 'session',
        checkCondition: (sessionData) => {
            // sessionData contiendra { timeElapsedSeconds, numQuestions, ... }
            return sessionData.timeElapsedSeconds < 60 && sessionData.numQuestions >= 10;
        }
    },
    // Ajoutez d'autres badges basés sur la session ici...
    // Exemple : Terminer un quiz spécifique ? (Nécessiterait sessionData.quizId)
    /*
    {
        id: 'completed_chap3',
        name: 'Chapitre 3 Terminé',
        description: 'Avoir terminé le quiz du Chapitre 3.',
        type: 'session',
        checkCondition: (sessionData) => {
            return sessionData.quizId === 'ID_DU_QUIZ_CHAP3'; // Remplacez par le vrai ID
        }
    },
    */

    // --- Badges Globaux (vérifiés dans stats.js) ---
    {
        id: 'first_quiz',
        name: 'Premiers Pas',
        description: 'Terminer votre premier quiz.',
        icon_url: 'assets/images/badge_first.png',
        type: 'global',
        checkCondition: (globalStats) => {
            // globalStats est state.localStats
            return globalStats.totalQuizzes >= 1;
        }
    },
    {
        id: 'quiz_apprentice',
        name: 'Apprenti Quizzer',
        description: 'Terminer 5 quiz différents.',
        icon_url: 'assets/images/badge_apprentice.png', // Inventez des chemins
        type: 'global',
        checkCondition: (globalStats) => {
            // Compter les quiz uniques tentés (basé sur les clés de quizStats)
            const uniqueQuizzesAttempted = Object.keys(globalStats.quizStats || {}).length;
            return uniqueQuizzesAttempted >= 5;
            // Alternative: si totalQuizzes compte les tentatives, il faudrait une autre stat
            // return globalStats.totalQuizzes >= 5; // Moins précis si on peut refaire le même quiz
        }
    },
    {
        id: 'quiz_master_10',
        name: 'Maître Quizzer (10)',
        description: 'Terminer 10 quiz différents.',
        icon_url: 'assets/images/badge_master10.png',
        type: 'global',
        checkCondition: (globalStats) => {
            const uniqueQuizzesAttempted = Object.keys(globalStats.quizStats || {}).length;
            return uniqueQuizzesAttempted >= 10;
        }
    },
    {
        id: 'xp_level_5',
        name: 'Niveau 5 Atteint',
        description: 'Atteindre le niveau 5.',
        icon_url: 'assets/images/badge_level5.png',
        type: 'global',
        checkCondition: (globalStats) => {
            return globalStats.level >= 5;
        }
    },
    {
        id: 'xp_level_10',
        name: 'Niveau 10 Atteint',
        description: 'Atteindre le niveau 10.',
        icon_url: 'assets/images/badge_level10.png',
        type: 'global',
        checkCondition: (globalStats) => {
            return globalStats.level >= 10;
        }
    },
    // Ajoutez d'autres badges globaux ici...
    // Exemple : Avoir une précision moyenne > 80%
    /*
    {
        id: 'high_accuracy_global',
        name: 'Haute Précision',
        description: 'Maintenir une précision globale supérieure à 80%.',
        type: 'global',
        checkCondition: (globalStats) => {
            return globalStats.avgAccuracy > 80;
        }
    },
    */
];