import { state } from './state.js';
import { saveLocalStats } from './storage.js';
import * as dom from './dom.js'; // Need settings screen elements

/** Recalculates all local statistics based on the current localHistory */
export function recalculateLocalStats() {
    let totalQuizzes = 0;
    let totalAnswers = 0;
    let correctAnswers = 0;
    let totalPointsAgg = 0;
    let longestStreakOverall = 0;
    const quizStatsMap = {}; // { quizId: { attempts, totalQ, correctQ, totalPts, avgAccuracy, bestScoreNum, bestScoreDen, bestPoints, bestScore } }
    // Start with currently known badges (from loaded stats)
    const earnedBadgeIds = new Set(state.localStats.badges || []);

    // Use attemptId for unique quiz attempts count if available, otherwise fallback
    const attemptIds = new Set(state.localHistory.map(a => a.attemptId).filter(Boolean));
    totalQuizzes = attemptIds.size > 0 ? attemptIds.size : state.localHistory.length; // Fallback to length if no IDs

    state.localHistory.forEach(attempt => {
        const qId = attempt.quizId;
        if (!qId) return; // Skip attempts without quizId

        // Initialize stats for this quiz if not present
        if (!quizStatsMap[qId]) {
            quizStatsMap[qId] = { attempts: 0, totalQ: 0, correctQ: 0, totalPts: 0, avgAccuracy: 0, bestScoreNum: -1, bestScoreDen: 0, bestPoints: -Infinity, bestScore: 'N/A' };
        }
        const stats = quizStatsMap[qId];

        stats.attempts++;
        const attemptTotalQ = attempt.totalQuestions || attempt.answers?.length || 0;
        // Parse score carefully, handling potential 'N/A' or malformed strings
        const scoreParts = String(attempt.score || '0/0').split('/');
        let attemptCorrect = 0;
        let attemptTotal = attemptTotalQ; // Default to total questions if score is bad
        if (scoreParts.length === 2) {
            const parsedCorrect = parseInt(scoreParts[0], 10);
            const parsedTotal = parseInt(scoreParts[1], 10);
            if (!isNaN(parsedCorrect)) attemptCorrect = parsedCorrect;
            // Use parsed total from score string if valid, otherwise keep attemptTotalQ
            if (!isNaN(parsedTotal) && parsedTotal > 0) attemptTotal = parsedTotal;
            else if (attemptCorrect > attemptTotalQ) attemptTotal = attemptCorrect; // Fix denominator if score looks like X/0
        }

        const attemptPoints = attempt.points ?? 0;

        totalAnswers += attemptTotal; // Use the more reliable total count
        correctAnswers += attemptCorrect;
        totalPointsAgg += attemptPoints;
        longestStreakOverall = Math.max(longestStreakOverall, attempt.maxStreak || 0);

        stats.totalQ += attemptTotal;
        stats.correctQ += attemptCorrect;
        stats.totalPts += attemptPoints;

        // Update best score logic
        if (attemptCorrect > stats.bestScoreNum) {
            stats.bestScoreNum = attemptCorrect;
            stats.bestScoreDen = attemptTotal;
            stats.bestPoints = attemptPoints;
        } else if (attemptCorrect === stats.bestScoreNum && attemptPoints > stats.bestPoints) {
            // Prioritize higher points for the same score
            stats.bestPoints = attemptPoints;
            stats.bestScoreDen = attemptTotal; // Update denominator too
        }

        // Add badges earned in this attempt
        (attempt.achievements || []).forEach(badgeId => {
            if (typeof badgeId === 'string') earnedBadgeIds.add(badgeId);
        });
    });

    // Calculate final averages and best scores after iterating through history
    const avgAccuracyOverall = totalAnswers > 0 ? (correctAnswers / totalAnswers * 100) : 0;
    Object.keys(quizStatsMap).forEach(qId => {
        const stats = quizStatsMap[qId];
        stats.avgAccuracy = stats.totalQ > 0 ? (stats.correctQ / stats.totalQ * 100) : 0;
        if (stats.bestScoreNum >= 0) {
            stats.bestScore = `${stats.bestScoreNum} / ${stats.bestScoreDen}`;
        } else {
            stats.bestScore = 'N/A'; // Ensure reset if no valid score found
        }
    });

    // Simple Level/XP System (Example)
    let currentLevel = 1;
    let currentXP = totalPointsAgg; // XP = total points earned
    let xpForNext = 100;
    while (currentXP >= xpForNext && currentLevel < 50) { // Level cap example
        currentXP -= xpForNext;
        currentLevel++;
        xpForNext = Math.floor(100 * Math.pow(1.2, currentLevel - 1)); // Exponential increase
    }

    // Add 'first_quiz' badge if history exists and it wasn't already earned
    if (state.localHistory.length > 0 && !earnedBadgeIds.has('first_quiz')) {
        earnedBadgeIds.add('first_quiz');
    }

    // Update global state.localStats object
    state.localStats = {
        totalQuizzes: totalQuizzes,
        totalAnswers: totalAnswers,
        correctAnswers: correctAnswers, // Raw count
        totalPoints: totalPointsAgg,
        avgAccuracy: avgAccuracyOverall,
        longestStreak: longestStreakOverall,
        quizStats: quizStatsMap,
        level: currentLevel,
        xp: currentXP,
        xpNextLevel: xpForNext,
        badges: Array.from(earnedBadgeIds).sort() // Store unique badges, sorted
    };

    saveLocalStats(); // Persist the recalculated stats
    console.log("Local stats recalculated and saved.");
}


/** Placeholder function to get badge details from a predefined list */
export function getBadgeInfo(badgeId) {
    // Define your badges here
    const badgeDictionary = {
        "perfect_score": { name: "Score Parfait", icon_url: "assets/images/badge_perfect.png", description: "Quiz terminé avec 100% de bonnes réponses." },
        "streak_5": { name: "Série de 5", icon_url: "assets/images/badge_streak5.png", description: "Réussi 5 questions d'affilée." },
        "streak_10": { name: "Série de 10", icon_url: "assets/images/badge_streak10.png", description: "Réussi 10 questions d'affilée." },
        "quick": { name: "Rapide", icon_url: "assets/images/badge_quick.png", description: "Quiz d'au moins 10 questions terminé en moins d'1 minute." },
        "first_quiz": { name: "Premiers Pas", icon_url: "assets/images/badge_first.png", description: "Premier quiz terminé." },
        // Add more... e.g., "quiz_master_X" for mastering a specific quiz (e.g., 3 perfect scores)
    };
    const defaultBadge = { name: badgeId, icon_url: "assets/images/default_badge.png", description: `Badge: ${badgeId}` };
    return badgeDictionary[badgeId] || defaultBadge;
}

// --- Functions to render stats (could be moved to settings.js or ui.js) ---
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
        state.localStats.badges.forEach(badgeId => {
            const badgeInfo = getBadgeInfo(badgeId);
            const badgeElement = document.createElement('div');
            badgeElement.classList.add('badge');
            badgeElement.title = badgeInfo.description;
            // Basic display - assumes icons are available or uses text
            badgeElement.innerHTML = `
                 ${badgeInfo.icon_url && !badgeInfo.icon_url.includes('default_badge.png') ? `<img src="${badgeInfo.icon_url}" alt="">` : '🏆'}
                 <span>${badgeInfo.name}</span>`;
            dom.settings.badgesEarnedLocalDiv.appendChild(badgeElement);
        });
    }
}