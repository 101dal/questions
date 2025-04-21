import * as dom from './dom.js';
import { state, resetQuizState, setActiveQuizContent, setQuizActive } from './state.js';
import { showToast, playSound, showScreen, renderMarkdown } from './ui.js';
import { saveQuizAttempt, saveLocalHistory, loadQuizContent } from './storage.js';
import { recalculateLocalStats, getBadgeInfo } from './stats.js';
import { startQuiz, setupQuizUI, displayQuestion, updateErrorModeAvailability, resetConfigOptions } from './quizEngine.js'; // Import functions needed for restarting
import { renderQuizLibrary, displayScoreHistory, populateHistoryFilter } from './main.js'; // Import functions from main for navigation/UI updates
import { shuffleArray } from './utils.js';


export function showResults() {
    setQuizActive(false); // Ensure quiz is marked inactive
    // updateSettingsButtonVisibility(); // Should be called from main after state change
    if (!state.quizEndTime) state.quizEndTime = Date.now(); // Ensure end time
    if (state.timerInterval) clearInterval(state.timerInterval); // Ensure timer stopped
    state.timerInterval = null;


    // Final Calculations
    const timeElapsedSeconds = Math.max(0, (state.quizEndTime - state.startTime) / 1000);
    const minutes = Math.floor(timeElapsedSeconds / 60);
    const seconds = Math.floor(timeElapsedSeconds % 60);
    const timeTakenString = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    const accuracy = state.questionsToAsk.length > 0 ? ((state.score / state.questionsToAsk.length) * 100) : 0;

    // Populate Summary UI
    dom.results.quizTitle.textContent = state.currentQuizConfig.quizTitle;
    dom.results.scoreSummary.textContent = `Score: ${state.score} / ${state.questionsToAsk.length} (${state.totalPoints} pts)`;
    dom.results.timeTakenDisplay.textContent = `Temps: ${timeTakenString}`;
    dom.results.accuracyDisplay.textContent = `Précision: ${accuracy.toFixed(1)}%`;

    // Calculate Achievements (Local Example)
    const achievements = calculateLocalAchievements(accuracy, state.maxStreak, timeElapsedSeconds, state.questionsToAsk.length);
    displayAchievements(achievements);

    // Prepare attempt data for history
    const attemptData = {
        attemptId: `local_${Date.now()}_${Math.random().toString(16).substring(2, 8)}`,
        quizId: state.currentQuizConfig.quizId,
        quizTitle: state.currentQuizConfig.quizTitle,
        score: `${state.score} / ${state.questionsToAsk.length}`,
        points: state.totalPoints,
        accuracy: parseFloat(accuracy.toFixed(1)),
        timeTaken: timeTakenString,
        timeElapsedSeconds: parseFloat(timeElapsedSeconds.toFixed(2)),
        mode: state.currentQuizConfig.mode,
        date: new Date(state.startTime).toISOString(),
        totalQuestions: state.questionsToAsk.length,
        maxStreak: state.maxStreak,
        achievements: achievements.map(a => a.id),
        answers: state.userAnswers.map(a => ({ // Store minimal answer info
            questionId: a?.questionId,
            isCorrect: a?.isCorrect,
            marked: a?.marked,
            // answer: a?.answer // Optional: store user answer value
        }))
    };

    saveQuizAttempt(attemptData); // Save to local history
    recalculateLocalStats(); // Update stats based on the new history entry
    saveLocalHistory();      // Persist the updated history immediately

    // Display detailed results and comparison AFTER saving/recalculating
    displayDetailedResults();
    displayLocalComparison();

    // Show/hide restart errors button
    const hasErrors = state.userAnswers.some(a => a && !a.isCorrect);
    const errorCount = state.userAnswers.filter(a => a && !a.isCorrect).length;
    dom.results.restartErrorsBtn.classList.toggle('hidden', !hasErrors);
    dom.results.restartErrorsBtn.textContent = `Refaire les erreurs (${errorCount})`;

    showScreen('results');
    playSound('finish');

    // Refresh history display on dashboard in background (needs access to those functions)
    displayScoreHistory();
    populateHistoryFilter();
}


function calculateLocalAchievements(accuracy, maxStreak, timeElapsedSeconds, numQuestions) {
    const achievements = [];
    if (accuracy >= 100 && numQuestions > 0) achievements.push({ id: 'perfect_score', name: 'Score Parfait ! 🎉' });
    if (maxStreak >= 10) achievements.push({ id: 'streak_10', name: `Série de ${maxStreak} 🔥` });
    else if (maxStreak >= 5) achievements.push({ id: 'streak_5', name: `Série de ${maxStreak} 🔥` });
    // Add more specific streak badges if needed (e.g., streak_15, streak_20) using the exact maxStreak value
    if (timeElapsedSeconds < 60 && numQuestions >= 10) achievements.push({ id: 'quick', name: 'Rapide ! ⚡️' });
    // 'first_quiz' badge is typically added during stat recalculation, not here.
    return achievements;
}

function displayAchievements(achievements = []) {
    dom.results.achievementsDiv.innerHTML = ''; // Clear previous
    dom.results.achievementsDiv.classList.toggle('hidden', achievements.length === 0);
    achievements.forEach(ach => {
        const badgeInfo = getBadgeInfo(ach.id); // Get full info (name, icon, desc)
        const badge = document.createElement('span');
        badge.classList.add('achievement-badge');
        badge.textContent = badgeInfo.name; // Use name from badge info
        badge.title = badgeInfo.description; // Add description as tooltip
        // Optionally add an icon: badge.innerHTML = `<img src='${badgeInfo.icon_url}' alt=''> ${badgeInfo.name}`;
        dom.results.achievementsDiv.appendChild(badge);
    });
}

function displayLocalComparison() {
    dom.results.localComparisonP.classList.add('hidden');
    if (!state.currentQuizConfig.quizId || state.localHistory.length < 2) return; // Need >1 attempt

    // Find the ID of the attempt just saved
    const currentAttemptId = state.localHistory[state.localHistory.length - 1]?.attemptId;

    // Filter history for the same quiz, EXCLUDING the current attempt
    const historyForThisQuiz = state.localHistory.filter(a =>
        a.quizId === state.currentQuizConfig.quizId &&
        a.attemptId !== currentAttemptId
    );

    if (historyForThisQuiz.length === 0) return; // No previous attempts

    const totalAccuracy = historyForThisQuiz.reduce((sum, a) => sum + (a.accuracy || 0), 0);
    const avgAccuracy = totalAccuracy / historyForThisQuiz.length;

    dom.results.localComparisonP.textContent = `Votre moyenne locale précédente : ${avgAccuracy.toFixed(1)}% (${historyForThisQuiz.length} tentatives)`;
    dom.results.localComparisonP.classList.remove('hidden');
}

// --- Detailed Results Display ---
export function displayDetailedResults() {
    dom.results.detailedResultsDiv.innerHTML = ''; // Clear previous
    if (!state.questionsToAsk || !state.userAnswers || state.questionsToAsk.length !== state.userAnswers.length) {
        dom.results.detailedResultsDiv.innerHTML = "<p class='error-message'>Erreur affichage résultats détaillés.</p>";
        return;
    }

    // Reset filters visually
    dom.results.detailedResultsFiltersDiv.querySelectorAll('.btn-filter').forEach(btn => btn.classList.remove('active'));
    dom.results.detailedResultsFiltersDiv.querySelector('.btn-filter[data-filter="all"]').classList.add('active');

    state.questionsToAsk.forEach((question, index) => {
        const userAnswerEntry = state.userAnswers[index];
        if (!userAnswerEntry) {
            console.warn(`Missing user answer entry for index ${index}`);
            return;
        }

        const resultItem = document.createElement('div');
        resultItem.classList.add('result-item');
        const questionId = userAnswerEntry.questionId || `q_${state.currentQuizConfig.quizId}_${question.originalIndex ?? index}`;
        resultItem.dataset.questionId = questionId;

        const isCorrect = userAnswerEntry.isCorrect;
        const isUnanswered = userAnswerEntry.answer === null;
        const isMarked = userAnswerEntry.marked;

        resultItem.classList.add(isUnanswered ? 'unanswered' : (isCorrect ? 'correct' : 'incorrect'));
        if (isMarked) resultItem.classList.add('is-marked-result');

        let resultHTML = `
            <div class="result-question-header">
                 <p class="question-text-result">Q${index + 1}: ${renderMarkdown(question.text)}</p>
                 <button class="mark-question-btn-result ${isMarked ? 'marked' : ''}" data-question-index="${index}" title="${isMarked ? 'Ne plus marquer' : 'Marquer cette question'}">
                     ${isMarked ? '🌟' : '⭐'}
                 </button>
             </div>`;

        if (isUnanswered) {
            resultHTML += `<p class="unanswered-text"><i>Non répondu</i></p>`;
        } else {
            resultHTML += `<p class="user-answer ${isCorrect ? 'correct' : 'incorrect'}">Votre réponse: ${formatAnswerForDisplay(userAnswerEntry.answer, question.type)}</p>`;
        }
        if (!isCorrect) {
            resultHTML += `<p class="correct-answer-text">Bonne réponse: ${formatAnswerForDisplay(question.correctAnswer, question.type)}</p>`;
        }
        resultHTML += `<p class="explanation">Explication: ${renderMarkdown(question.explanation || '-')}</p>`; // Handle missing explanation
        resultItem.innerHTML = resultHTML;

        resultItem.querySelector('.mark-question-btn-result').addEventListener('click', handleMarkQuestionFromResult);
        dom.results.detailedResultsDiv.appendChild(resultItem);
    });
}

export function formatAnswerForDisplay(answerValue, questionType) {
    if (answerValue === null || answerValue === undefined) return '<i>N/A</i>';
    let displayString = '';
    try {
        if (questionType === 'vrai_faux') {
            displayString = answerValue ? 'Vrai' : 'Faux';
        } else if (Array.isArray(answerValue)) {
            // Render markdown for each item, join appropriately
            displayString = answerValue
                .map(val => renderMarkdown(String(val)))
                .join(questionType === 'ordre' ? ' → ' : ', ');
        } else if (questionType === 'association' && typeof answerValue === 'object') {
            // Format association object { targetId: itemId }
            displayString = Object.entries(answerValue)
                .map(([target, item]) => `${renderMarkdown(item)} → ${renderMarkdown(target)}`) // Show Item -> Target
                .join('<br>');
        } else {
            // Default: treat as string and render markdown
            displayString = renderMarkdown(String(answerValue));
        }
    } catch (e) {
        console.warn("Error formatting answer:", answerValue, e);
        // Basic text fallback with HTML escaping
        const tempDiv = document.createElement('div');
        tempDiv.textContent = String(answerValue);
        displayString = tempDiv.innerHTML;
    }
    return displayString;
}

function handleMarkQuestionFromResult(event) {
    const button = event.target.closest('.mark-question-btn-result');
    if (!button) return;
    const resultItem = button.closest('.result-item');
    const index = parseInt(button.dataset.questionIndex, 10);

    if (isNaN(index) || index < 0 || index >= state.userAnswers.length || !state.userAnswers[index] || !resultItem) return;

    state.userAnswers[index].marked = !state.userAnswers[index].marked; // Toggle state in current results data

    // Update button UI
    button.textContent = state.userAnswers[index].marked ? '🌟' : '⭐';
    button.title = state.userAnswers[index].marked ? "Ne plus marquer" : "Marquer cette question";
    button.classList.toggle('marked', state.userAnswers[index].marked);
    resultItem.classList.toggle('is-marked-result', state.userAnswers[index].marked); // Update filter class

    showToast(`Question ${index + 1} ${state.userAnswers[index].marked ? 'marquée' : 'démárquée'}.`, 'info', 1500);
    playSound('click');

    // Persist this change immediately by updating the specific attempt in localHistory
    const latestAttempt = state.localHistory[state.localHistory.length - 1];
    const questionIdToUpdate = state.userAnswers[index].questionId;

    if (latestAttempt && latestAttempt.answers && questionIdToUpdate) {
        const answerInHistory = latestAttempt.answers.find(a => a && a.questionId === questionIdToUpdate);
        if (answerInHistory) {
            answerInHistory.marked = state.userAnswers[index].marked;
            saveLocalHistory(); // Save the change to storage
            console.log(`Marked status for QID ${questionIdToUpdate} updated in history.`);
        } else {
            console.warn("Could not find corresponding answer in history (by QID) to save marked status.");
            // Fallback: try matching by index if desperate? Less reliable.
            if (latestAttempt.answers[index]) {
                latestAttempt.answers[index].marked = state.userAnswers[index].marked;
                saveLocalHistory();
                console.log(`Marked status for index ${index} updated in history (fallback).`);
            } else {
                console.error("Fallback index match also failed for saving marked status.");
            }
        }
    } else {
        console.warn("Could not reliably save marked status to history (no latest attempt or answers).");
    }
}

export function handleFilterResults(event) {
    const filterType = event.target.dataset.filter;
    if (!filterType || !event.target.classList.contains('btn-filter')) return;

    dom.results.detailedResultsFiltersDiv.querySelectorAll('.btn-filter').forEach(btn => btn.classList.remove('active'));
    event.target.classList.add('active');

    dom.results.detailedResultsDiv.querySelectorAll('.result-item').forEach(item => {
        let show = false;
        if (filterType === 'all') {
            show = true;
        } else if (filterType === 'incorrect') {
            show = item.classList.contains('incorrect') || item.classList.contains('unanswered');
        } else if (filterType === 'marked') {
            show = item.classList.contains('is-marked-result');
        }
        item.style.display = show ? '' : 'none'; // Use display style for filtering
    });
}

// --- Post-Quiz Action Handlers ---

export function handleRestartQuiz() {
    // Re-use the exact same questions array (state.questionsToAsk)
    if (!state.activeQuizContent || !state.currentQuizConfig.quizId || state.questionsToAsk.length === 0) {
        showToast("Impossible de relancer : données de session manquantes.", "error");
        showScreen('dashboard'); return;
    }
    console.log("Restarting quiz with same questions...");

    // Reset only the necessary quiz progress state
    state.currentQuestionIndex = 0;
    state.userAnswers = new Array(state.questionsToAsk.length).fill(null);
    state.score = 0; state.totalPoints = 0; state.currentStreak = 0; state.maxStreak = 0;
    state.startTime = Date.now(); state.questionStartTime = 0; state.quizEndTime = 0;
    state.isQuizActive = true; state.isSubmittingAnswer = false;
    state.timeLeft = state.currentQuizConfig.timeLimit; // Reset timer

    setupQuizUI(); // Re-setup timer, progress bar, etc.
    showScreen('quiz');
    displayQuestion(0); // Display first question
}

export function handleRestartErrors() {
    if (!state.activeQuizContent || !state.currentQuizConfig.quizId) {
        showToast("Impossible de relancer les erreurs : quiz non chargé.", "error"); return;
    }

    // Get error questions from the *last completed attempt* (userAnswers)
    const errorQuestionsFromLastAttempt = state.userAnswers
        .map((answer, index) => (answer && !answer.isCorrect) ? state.questionsToAsk[index] : null)
        .filter(q => q !== null);

    if (errorQuestionsFromLastAttempt.length === 0) {
        showToast("Félicitations, aucune erreur dans cette session !", "success"); return;
    }
    console.log(`Restarting with ${errorQuestionsFromLastAttempt.length} error(s)...`);

    // Modify state for the new quiz session
    resetQuizState(); // Clear previous quiz state first
    state.questionsToAsk = shuffleArray(errorQuestionsFromLastAttempt); // Use shuffled errors
    state.questionsToAsk.forEach((q, idx) => q.quizSessionIndex = idx); // Re-index for this session

    // Adapt current config for the error replay session
    state.currentQuizConfig = {
        ...state.currentQuizConfig, // Keep original settings like feedback, nav...
        mode: 'errors-replay',
        numQuestions: state.questionsToAsk.length,
        quizTitle: `${state.currentQuizConfig.quizTitle} (Erreurs Session)`,
        // Decide on time limit for error replay - keep original or make free?
        // timeLimit: null, // Example: Make error replay untimed
    };

    // Reset progress state for the new session
    state.userAnswers = new Array(state.questionsToAsk.length).fill(null);
    state.startTime = Date.now();
    state.isQuizActive = true;
    state.isSubmittingAnswer = false;
    state.timeLeft = state.currentQuizConfig.timeLimit; // Use potentially modified time limit

    setupQuizUI();
    showScreen('quiz');
    displayQuestion(0);
}

export function handleNewConfig() {
    if (state.activeQuizContent) {
        const currentQuizId = state.selectedQuizId; // Store before resetting
        // Reset quiz state but keep quiz selected
        resetQuizState();
        setQuizActive(false);
        // Keep state.selectedQuizId and state.activeQuizContent

        showScreen('dashboard');
        // Ensure the correct quiz is still visually selected and config shown
        renderQuizLibrary(); // Re-render to highlight selected quiz
        dom.dashboard.configOptionsDiv.classList.remove('hidden');
        resetConfigOptions(true); // Reset config, prefill from last config
        dom.dashboard.startQuizBtn.disabled = false;
        updateErrorModeAvailability();
        // Scroll config into view?
        dom.dashboard.configOptionsDiv.scrollIntoView({ behavior: 'smooth', block: 'start' });


    } else {
        showToast("Aucun quiz chargé. Veuillez en sélectionner un.", "warning");
        showScreen('dashboard');
    }
}

// Import handleReturnItemToLeft from dragDrop.js if it's defined there
// For now, keep it here if it's tightly coupled with results/quiz state restoration
// Or move the relevant parts to dragDrop.js as needed.
export { handleReturnItemToLeft } from './dragDrop.js'; // Re-export if needed by quizEngine
