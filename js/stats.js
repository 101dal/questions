// js/stats.js

import { state } from './state.js';
import { saveLocalStats } from './storage.js';
import * as dom from './dom.js'; // Need settings screen elements
// --- Importation des définitions ---
import { BADGE_DEFINITIONS } from './badgesConfig.js';

/**
 * Récupère les informations d'affichage d'un badge par son ID.
 */
export function getBadgeInfo(badgeId) {
    const badgeDef = BADGE_DEFINITIONS.find(b => b.id === badgeId);
    const defaultBadge = {
        id: badgeId,
        name: badgeId, // Fallback name
        description: `Badge: ${badgeId}`,
        icon_url: "assets/images/default_badge.png" // Fallback icon
    };
    // Retourne la définition trouvée ou un objet par défaut, en s'assurant que l'ID est toujours présent
    // Fusionne l'objet trouvé avec defaultBadge pour garantir que toutes les clés existent
    return badgeDef ? { ...defaultBadge, ...badgeDef } : defaultBadge;
}

/**
 * Vérifie les conditions des badges et met à jour state.localStats.badges.
 * @param {object} data - Les données à utiliser pour la vérification (dépend du type).
 * @param {'session'|'global'} checkType - Le type de vérification à effectuer ('session' ou 'global').
 * @returns {Array<object>} Un tableau des badges NOUVELLEMENT obtenus lors de cette vérification (contenant les infos complètes du badge via getBadgeInfo).
 */
export function checkAndAwardBadges(data, checkType) {
    const newlyEarnedBadgesInfo = [];
    // Utilise une copie des badges ACTUELS de l'état pour la vérification
    const currentBadges = new Set(state.localStats.badges || []);
    let badgesUpdated = false; // Flag to check if state needs saving

    BADGE_DEFINITIONS.forEach(badge => {
        // Vérifie uniquement les badges du type demandé ET qui n'ont pas déjà été obtenus
        if (badge.type === checkType && !currentBadges.has(badge.id)) {
            try {
                if (badge.checkCondition(data)) {
                    // Condition remplie ET badge non possédé !
                    currentBadges.add(badge.id); // Ajoute à l'ensemble des badges possédés
                    newlyEarnedBadgesInfo.push(getBadgeInfo(badge.id)); // Stocke les infos complètes du badge
                    badgesUpdated = true; // Marque qu'une mise à jour a eu lieu
                    console.log(`Badge '${badge.id}' earned!`);
                }
            } catch (error) {
                console.error(`Error checking badge condition for '${badge.id}':`, error);
            }
        }
    });

    // Met à jour l'état global et sauvegarde SEULEMENT si de nouveaux badges ont été ajoutés
    if (badgesUpdated) {
        state.localStats.badges = Array.from(currentBadges).sort(); // Met à jour l'état global avec la liste triée
        saveLocalStats(); // Sauvegarde immédiatement l'état mis à jour
        console.log("Badge list updated in state and saved.");
    }

    return newlyEarnedBadgesInfo; // Retourne uniquement les infos des badges gagnés lors de CET appel
}


/** Recalculates all local statistics based on the current localHistory */
export function recalculateLocalStats() {
    let totalQuizzes = 0;
    let totalAnswers = 0;
    let correctAnswers = 0;
    let totalPointsAgg = 0;
    let longestStreakOverall = 0;
    const quizStatsMap = {}; // { quizId: { attempts, totalQ, correctQ, totalPts, avgAccuracy, bestScoreNum, bestScoreDen, bestPoints, bestScore } }
    // Charge les badges déjà obtenus pour ne pas les perdre
    const previouslyEarnedBadges = new Set(state.localStats.badges || []);

    // Utilise attemptId pour un compte unique si possible
    const attemptIds = new Set(state.localHistory.map(a => a.attemptId).filter(Boolean));
    totalQuizzes = attemptIds.size > 0 ? attemptIds.size : state.localHistory.length;

    state.localHistory.forEach(attempt => {
        const qId = attempt.quizId;
        if (!qId) return;

        if (!quizStatsMap[qId]) {
            quizStatsMap[qId] = { attempts: 0, totalQ: 0, correctQ: 0, totalPts: 0, avgAccuracy: 0, bestScoreNum: -1, bestScoreDen: 0, bestPoints: -Infinity, bestScore: 'N/A' };
        }
        const stats = quizStatsMap[qId];

        stats.attempts++;
        const attemptTotalQ = attempt.totalQuestions || attempt.answers?.length || 0;
        const scoreParts = String(attempt.score || '0/0').split('/');
        let attemptCorrect = 0;
        let attemptTotal = attemptTotalQ;
        if (scoreParts.length === 2) {
            const parsedCorrect = parseInt(scoreParts[0], 10);
            const parsedTotal = parseInt(scoreParts[1], 10);
            if (!isNaN(parsedCorrect)) attemptCorrect = parsedCorrect;
            if (!isNaN(parsedTotal) && parsedTotal > 0) attemptTotal = parsedTotal;
            else if (attemptCorrect > attemptTotalQ) attemptTotal = attemptCorrect;
        }

        const attemptPoints = attempt.points ?? 0;

        // Utilise attemptTotal (plus fiable) pour les stats globales
        totalAnswers += attemptTotal;
        correctAnswers += attemptCorrect;
        totalPointsAgg += attemptPoints;
        longestStreakOverall = Math.max(longestStreakOverall, attempt.maxStreak || 0);

        stats.totalQ += attemptTotal;
        stats.correctQ += attemptCorrect;
        stats.totalPts += attemptPoints;

        // Update best score
        if (attemptCorrect > stats.bestScoreNum) {
            stats.bestScoreNum = attemptCorrect;
            stats.bestScoreDen = attemptTotal;
            stats.bestPoints = attemptPoints;
        } else if (attemptCorrect === stats.bestScoreNum && attemptPoints > stats.bestPoints) {
            stats.bestPoints = attemptPoints;
            stats.bestScoreDen = attemptTotal;
        }

        // Collecte les badges de cette session (ils seront revérifiés globalement plus tard si besoin)
        // (On ne fait que collecter ici, la vérification globale se fait après)
        // (commenté car checkAndAwardBadges gère l'ajout)
        // (attempt.achievements || []).forEach(badgeId => {
        //     if (typeof badgeId === 'string') previouslyEarnedBadges.add(badgeId);
        // });
    });

    // Calculate final averages and best scores
    const avgAccuracyOverall = totalAnswers > 0 ? (correctAnswers / totalAnswers * 100) : 0;
    Object.keys(quizStatsMap).forEach(qId => {
        const stats = quizStatsMap[qId];
        stats.avgAccuracy = stats.totalQ > 0 ? (stats.correctQ / stats.totalQ * 100) : 0;
        if (stats.bestScoreNum >= 0) {
            stats.bestScore = `${stats.bestScoreNum} / ${stats.bestScoreDen}`;
        } else {
            stats.bestScore = 'N/A';
        }
    });

    // Simple Level/XP System
    let currentLevel = 1;
    let currentXP = totalPointsAgg;
    let xpForNext = 100;
    while (currentXP >= xpForNext && currentLevel < 50) {
        currentXP -= xpForNext;
        currentLevel++;
        xpForNext = Math.floor(100 * Math.pow(1.2, currentLevel - 1));
    }

    // --- Met à jour l'objet state.localStats AVEC les badges existants ---
    // On pré-charge les badges existants avant l'appel à checkAndAwardBadges global
    state.localStats = {
        ...(state.localStats || {}), // Garde la structure précédente si elle existe
        totalQuizzes: totalQuizzes,
        totalAnswers: totalAnswers,
        correctAnswers: correctAnswers,
        totalPoints: totalPointsAgg,
        avgAccuracy: avgAccuracyOverall,
        longestStreak: longestStreakOverall,
        quizStats: quizStatsMap,
        level: currentLevel,
        xp: currentXP,
        xpNextLevel: xpForNext,
        badges: Array.from(previouslyEarnedBadges).sort() // Assure que les badges chargés sont présents
    };

    // --- Vérifie les badges de type 'global' basé sur les stats recalculées ---
    // Cette fonction met à jour state.localStats.badges directement et sauvegarde si besoin
    checkAndAwardBadges(state.localStats, 'global');

    console.log("Local stats recalculated.");
    // Pas besoin de saveLocalStats() ici, car checkAndAwardBadges s'en charge s'il y a eu des changements.
}

// --- Fonctions de rendu ---

export function renderGlobalStats() {
    dom.settings.totalQuizzesSpan.textContent = state.localStats.totalQuizzes || 0;
    dom.settings.totalAnswersSpan.textContent = state.localStats.totalAnswers || 0;
    dom.settings.avgAccuracySpan.textContent = `${(state.localStats.avgAccuracy || 0).toFixed(1)}%`;
    dom.settings.longestStreakSpan.textContent = state.localStats.longestStreak || 0;
}

export function renderQuizStats() {
    dom.settings.quizStatsLocalDiv.innerHTML = ''; // Clear
    const quizIdsWithStats = Object.keys(state.localStats.quizStats || {});
    if (quizIdsWithStats.length === 0) {
        dom.settings.quizStatsLocalDiv.innerHTML = '<p>Aucune statistique par quiz disponible.</p>';
    } else {
        let tableHTML = `<table><thead><tr><th>Quiz</th><th>Tentatives</th><th>Précision Moy.</th><th>Meilleur Score</th><th>Pts (Meilleur)</th></tr></thead><tbody>`;
        // Sort quizzes alphabetically by title for display
        quizIdsWithStats.sort((a, b) => {
            const titleA = state.quizLibrary.find(q => q.quizId === a)?.title || a;
            const titleB = state.quizLibrary.find(q => q.quizId === b)?.title || b;
            return titleA.localeCompare(titleB);
        }).forEach(quizId => {
            const stats = state.localStats.quizStats[quizId];
            const quizMeta = state.quizLibrary.find(q => q.quizId === quizId);
            const title = quizMeta?.title || `Quiz ID: ${quizId}`;
            tableHTML += `<tr>
                <td>${title}</td>
                <td style="text-align: center;">${stats.attempts || 0}</td>
                <td style="text-align: right;">${(stats.avgAccuracy || 0).toFixed(1)}%</td>
                <td style="text-align: center;">${stats.bestScore || 'N/A'}</td>
                <td style="text-align: center;">${stats.bestPoints > -Infinity ? (stats.bestPoints ?? '-') : '-'}</td>
             </tr>`;
        });
        tableHTML += `</tbody></table>`;
        dom.settings.quizStatsLocalDiv.innerHTML = tableHTML;
    }
}

export function renderGamificationStats() {
    dom.settings.localLevelSpan.textContent = state.localStats.level || 1;
    dom.settings.localXpSpan.textContent = `${state.localStats.xp || 0} / ${state.localStats.xpNextLevel || 100}`;

    // Render Badges
    dom.settings.badgesEarnedLocalDiv.innerHTML = ''; // Clear
    if (!state.localStats.badges || state.localStats.badges.length === 0) {
        dom.settings.badgesEarnedLocalDiv.innerHTML = '<p>Aucun badge local débloqué.</p>';
    } else {
        // Trie les badges par nom pour l'affichage
        const sortedBadgeIds = [...state.localStats.badges].sort((a, b) => {
            const infoA = getBadgeInfo(a);
            const infoB = getBadgeInfo(b);
            return infoA.name.localeCompare(infoB.name);
        });

        sortedBadgeIds.forEach(badgeId => {
            const badgeInfo = getBadgeInfo(badgeId);
            const badgeElement = document.createElement('div');
            badgeElement.classList.add('badge');
            badgeElement.title = badgeInfo.description;
            // Utilise l'icône si disponible et différente de l'icône par défaut, sinon un emoji
            const iconHTML = badgeInfo.icon_url && !badgeInfo.icon_url.includes('default_badge.png')
                ? `<img src="${badgeInfo.icon_url}" alt="">`
                : '🏆'; // Emoji par défaut
            badgeElement.innerHTML = `${iconHTML}<span>${badgeInfo.name}</span>`;
            dom.settings.badgesEarnedLocalDiv.appendChild(badgeElement);
        });
    }
}