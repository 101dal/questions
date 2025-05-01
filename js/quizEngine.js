import * as dom from './dom.js';
import { state, resetQuizState, setQuizActive, setActiveQuizContent, resetSelectionState } from './state.js';
import { PRESETS, ADVANCE_DELAY, FEEDBACK_DELAY, TIME_WARNING_THRESHOLD, TIME_CRITICAL_THRESHOLD } from './config.js';
import { saveLastConfig, loadLastConfig, loadLocalHistory, saveQuizAttempt } from './storage.js';
import { showToast, showScreen, renderMarkdown } from './ui.js';
import { getAnswerFormat, levenshtein, shuffleArray } from './utils.js';
import { createQuestionBlock } from './questionRenderer.js';
import { showResults, handleReturnItemToLeft } from './results.js'; // Import showResults and handleReturnItemToLeft
import { recalculateLocalStats } from './stats.js'; // Import stat calculation
import { showReviewScreen } from './review.js';
import * as audioManager from './audioManager.js';

// --- Quiz Lifecycle ---

export function startQuiz() {
    // --- MOVE resetQuizState HERE ---
    resetQuizState(); // Clear previous quiz state *before* setting up the new one

    if (!state.selectedQuizId || !state.activeQuizContent) {
        showToast("Veuillez d'abord sélectionner un quiz.", "warning");
        return;
    }

    // 1. Read Configuration
    const selectedMode = document.querySelector('input[name="quiz-mode"]:checked').value;

    if (selectedMode === 'review-all') {
        console.log("Starting Review Mode...");
        // Appeler la fonction du module review.js pour afficher cet écran
        showReviewScreen(); // Assurez-vous que showReviewScreen est importé
        return; // Arrêter l'exécution de startQuiz ici
    }

    const allowNavBack = dom.dashboard.allowNavigationCheckbox.checked;
    const instantFeedback = dom.dashboard.instantFeedbackCheckbox.checked;
    const showExpl = dom.dashboard.showExplOnIncorrectCheckbox.checked && instantFeedback;
    let numQuestions;
    let timeLimit = null; // seconds
    let sourceQuestions = [...state.activeQuizContent.questions];
    let errorQuestionIds = [];
    let determinedQuestions = []; // Temporary variable to hold questions before assigning to state

    try {
        // 2. Determine Questions (Assign to temporary variable first)
        if (selectedMode === 'all' || selectedMode === 'exam') {
            determinedQuestions = shuffleArray([...sourceQuestions]); // Shuffle a copy
        } else if (selectedMode === 'custom') {
            const customNum = parseInt(dom.dashboard.customQuestionsInput.value, 10);
            const customTime = parseInt(dom.dashboard.customTimeInput.value, 10);
            numQuestions = (!isNaN(customNum) && customNum > 0) ? Math.min(customNum, sourceQuestions.length) : sourceQuestions.length;
            if (!isNaN(customTime) && customTime > 0) timeLimit = customTime * 60;
            determinedQuestions = shuffleArray([...sourceQuestions]).slice(0, numQuestions); // Shuffle a copy
        } else if (PRESETS[selectedMode]) {
            numQuestions = Math.min(PRESETS[selectedMode].questions, sourceQuestions.length);
            determinedQuestions = shuffleArray([...sourceQuestions]).slice(0, numQuestions); // Shuffle a copy
        } else if (selectedMode === 'errors') {
            const sessionsToConsider = parseInt(dom.dashboard.errorSessionsCountInput.value, 10) || 1;
            loadLocalHistory();
            const relevantHistory = state.localHistory
                .filter(attempt => attempt.quizId === state.selectedQuizId)
                .sort((a, b) => new Date(b.date) - new Date(a.date))
                .slice(0, sessionsToConsider);

            const incorrectQIds = new Set();
            relevantHistory.forEach(attempt => {
                attempt.answers?.forEach(ans => {
                    if (ans && ans.isCorrect === false && ans.questionId) {
                        incorrectQIds.add(ans.questionId);
                    }
                });
            });

            errorQuestionIds = Array.from(incorrectQIds);
            if (errorQuestionIds.length === 0) {
                throw new Error(`Aucune erreur trouvée dans les ${sessionsToConsider} dernières sessions.`);
            }

            // Filter sourceQuestions using the standardized ID format
            const errorQuestionsFound = sourceQuestions.filter(q => {
                const qIdentifier = q.id || `q_${state.selectedQuizId}_${sourceQuestions.indexOf(q)}`;
                return errorQuestionIds.includes(qIdentifier);
            });

            if (errorQuestionsFound.length === 0 && errorQuestionIds.length > 0) {
                console.warn("Error IDs found in history but couldn't match to current questions:", errorQuestionIds);
                throw new Error("Impossible de retrouver les questions d'erreur (IDs incohérents ou questions modifiées?).");
            }

            determinedQuestions = shuffleArray([...errorQuestionsFound]); // Shuffle a copy of found errors
        } else {
            throw new Error("Mode de quiz inconnu.");
        }

        // Assign to state *after* successful determination within the try block
        state.questionsToAsk = determinedQuestions;


    } catch (error) {
        showToast(`Erreur de configuration: ${error.message}`, "error");
        console.error("Config Error:", error);
        // resetQuizState(); // State was already reset at the beginning
        return; // Stop execution
    }

    // --- FINAL VALIDATION ---
    if (!state.questionsToAsk || state.questionsToAsk.length === 0) {
        showToast("Erreur: Aucune question n'a pu être sélectionnée pour cette session.", "error");
        console.error("Start Quiz Error: state.questionsToAsk is empty after determination block.");
        // resetQuizState(); // Already reset
        return; // Stop execution
    }

    // 3. Save Config & Set Up State (No resetQuizState() here anymore)
    state.currentQuizConfig = {
        mode: selectedMode,
        numQuestions: state.questionsToAsk.length,
        timeLimit,
        allowNavBack,
        instantFeedback,
        showExpl,
        quizId: state.selectedQuizId,
        quizTitle: state.activeQuizContent.quizTitle || "Quiz sans Titre"
    };
    state.lastConfig = { // Save UI settings for next time
        mode: selectedMode,
        allowNavBack, instantFeedback, showExpl,
        customTime: dom.dashboard.customTimeInput.value,
        customQuestions: dom.dashboard.customQuestionsInput.value,
        errorSessions: dom.dashboard.errorSessionsCountInput.value
    };
    saveLastConfig();

    // Assign indices - NOW safe as state.questionsToAsk is populated
    state.questionsToAsk.forEach((q, idx) => q.originalIndex = sourceQuestions.indexOf(q)); // Store original index if needed
    state.questionsToAsk.forEach((q, idx) => q.quizSessionIndex = idx); // Index within this specific session

    state.userAnswers = new Array(state.questionsToAsk.length).fill(null);
    state.startTime = Date.now();
    setQuizActive(true); // Mark quiz as active
    state.isSubmittingAnswer = false;


    // 4. Setup UI & Start
    setupQuizUI();
    // showScreen('quiz'); // Handled by main.js
    displayQuestion(0); // Display first question (NOW safe)
    updateErrorModeAvailability();
}

export function setupQuizUI() {
    dom.quiz.titleDisplay.textContent = state.currentQuizConfig.quizTitle;
    dom.quiz.contentArea.innerHTML = '';
    dom.quiz.finishQuizBtn.classList.add('hidden');
    dom.quiz.cancelQuizBtn.classList.remove('hidden');
    dom.quiz.streakCounterDisplay.textContent = `Série: 0 🔥`;
    dom.quiz.scoreDisplay.textContent = `Score: 0 pts`;
    updateQuestionGridNav();

    // Timer Setup
    if (state.timerInterval) clearInterval(state.timerInterval);
    state.timerInterval = null;
    dom.quiz.timerDisplay.classList.remove('warning', 'critical');
    if (state.currentQuizConfig.timeLimit !== null) {
        state.timeLeft = state.currentQuizConfig.timeLimit;
        updateTimerDisplay();
        state.timerInterval = setInterval(handleTimerTick, 1000);
    } else {
        state.timeLeft = 0;
        dom.quiz.timerDisplay.textContent = "Temps: Libre";
    }
    updateProgressBar();
}

export function handleTimerTick() {
    if (!state.isQuizActive || state.timeLeft === null || state.timeLeft <= 0) {
        if (state.timerInterval) clearInterval(state.timerInterval);
        // Double check time is actually 0 or less before forcing finish
        if (state.timeLeft <= 0 && state.currentQuizConfig.timeLimit !== null && state.isQuizActive) {
            audioManager.playSound('error');
            showToast("Le temps est écoulé !", "warning", 4000);
            forceFinishQuiz(true); // Time out = true
        }
        return;
    }
    state.timeLeft--;
    updateTimerDisplay();
    if (state.timeLeft <= 0) {
        // This block now mainly handles the final tick to 0
        if (state.timerInterval) clearInterval(state.timerInterval);
        audioManager.playSound('error');
        showToast("Le temps est écoulé !", "warning", 4000);
        forceFinishQuiz(true);
    } else if (state.timeLeft <= TIME_CRITICAL_THRESHOLD) {
        dom.quiz.timerDisplay.classList.add('critical');
        dom.quiz.timerDisplay.classList.remove('warning');
    } else if (state.timeLeft <= TIME_WARNING_THRESHOLD) {
        dom.quiz.timerDisplay.classList.add('warning');
        dom.quiz.timerDisplay.classList.remove('critical');
    }
}

export function updateTimerDisplay() {
    if (!state.isQuizActive && state.timeLeft <= 0 && state.currentQuizConfig.timeLimit !== null) {
        dom.quiz.timerDisplay.textContent = "Temps écoulé !";
        dom.quiz.timerDisplay.classList.remove('warning', 'critical');
        return;
    }
    if (state.currentQuizConfig.timeLimit === null) {
        dom.quiz.timerDisplay.textContent = "Temps: Libre";
        return;
    }
    const displayTime = Math.max(0, state.timeLeft);
    const minutes = Math.floor(displayTime / 60);
    const seconds = displayTime % 60;
    dom.quiz.timerDisplay.textContent = `Temps: ${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
}

export function updateProgressBar() {
    const answeredCount = state.userAnswers.filter(a => a !== null).length;
    const progressPercent = state.questionsToAsk.length > 0 ? (answeredCount / state.questionsToAsk.length) * 100 : 0;
    dom.quiz.progressBar.style.width = `${Math.min(100, progressPercent)}%`;
}

export function updateQuestionGridNav() {
    dom.quiz.questionGridNav.innerHTML = '';
    if (!state.questionsToAsk || state.questionsToAsk.length === 0) return;

    state.questionsToAsk.forEach((q, i) => {
        const item = document.createElement('div');
        item.classList.add('grid-nav-item');
        item.title = `Question ${i + 1}`;
        item.dataset.index = i;

        if (state.isQuizActive && i === state.currentQuestionIndex) item.classList.add('current');

        const answerInfo = state.userAnswers[i];
        let answerContent = null;

        if (answerInfo) {
            answerContent = answerInfo.answer;
        }

        if (answerContent !== null) {
            item.classList.add('answered');
            if (state.currentQuizConfig.instantFeedback || !state.isQuizActive) {
                item.classList.toggle('correct', !!answerInfo.isCorrect);
                item.classList.toggle('incorrect', !answerInfo.isCorrect);
            }
        }

        if (state.currentQuizConfig.allowNavBack && answerContent !== null && i !== state.currentQuestionIndex) {
            item.classList.add('clickable');
            item.addEventListener('click', () => {
                if (state.isQuizActive) displayQuestion(i);
            });
        }
        dom.quiz.questionGridNav.appendChild(item);
    });
}

export function updateQuizHeader() {
    dom.quiz.questionCounterDisplay.textContent = `Question ${state.currentQuestionIndex + 1} / ${state.questionsToAsk.length}`;
    dom.quiz.streakCounterDisplay.textContent = `Série: ${state.currentStreak} 🔥`;
    dom.quiz.scoreDisplay.textContent = `Score: ${state.totalPoints} pts`;
    updateProgressBar();
    updateQuestionGridNav();
}

export function displayQuestion(index) {
    if (!state.isQuizActive || index < 0 || index >= state.questionsToAsk.length) {
        console.warn("Invalid index or quiz not active for displayQuestion:", index);
        return;
    }
    // Clear previous feedback (important for nav back/forth)
    document.querySelectorAll('.immediate-feedback.visible').forEach(fb => fb.classList.remove('visible'));

    state.currentQuestionIndex = index;
    const question = state.questionsToAsk[index];
    dom.quiz.contentArea.innerHTML = ''; // Clear previous content

    // Create the question block using the renderer
    const questionBlock = createQuestionBlock(question, index); // From questionRenderer.js
    dom.quiz.contentArea.appendChild(questionBlock);

    // --- CONDITION IMPORTANTE ---
    // Gérer l'état des inputs (activé/désactivé/restauré) UNIQUEMENT ici.

    if (state.userAnswers[index].answer !== null) { // Si la question a DEJA une réponse enregistrée
        if (state.currentQuizConfig.allowNavBack) {
            // Nav Back: Réactiver les inputs et restaurer l'UI de la réponse
            enableQuestionBlockInputs(questionBlock);
            restoreAnswerSelectionUI(questionBlock, state.userAnswers[index].answer, question.type);
        } else {
            // Pas de Nav Back: Laisser les inputs désactivés
            disableQuestionBlockInputs(questionBlock);
            // Optionnel : Montrer la réponse/feedback si le feedback instantané était activé
            //             mais cela complexifie car on ne sait pas si c'était la première visite.
            //             Mieux vaut gérer le feedback uniquement lors de la soumission initiale.
        }
    } else {
        // Si c'est la première fois qu'on voit cette question (userAnswers[index] === null)
        // Les inputs sont activés par défaut lors de la création dans questionRenderer/enableQuestionBlockInputs
        // et aucun feedback ne doit être montré.
        // Assurons-nous qu'ils sont bien actifs (double sécurité)
        enableQuestionBlockInputs(questionBlock); // Normalement redondant, mais sûr.
    }


    // Scroll into view logic
    setTimeout(() => {
        document.querySelectorAll('.question-block.focused').forEach(b => b.classList.remove('focused'));
        questionBlock.classList.add('focused');
        const headerHeight = dom.quiz.header.offsetHeight || 120;
        const elementPosition = questionBlock.getBoundingClientRect().top;
        const offsetPosition = elementPosition + window.pageYOffset - headerHeight - 20;
        window.scrollTo({ top: offsetPosition, behavior: 'smooth' });
    }, 50);

    updateQuizHeader();
    state.questionStartTime = Date.now();
    state.isSubmittingAnswer = false; // Réinitialiser le verrou de soumission
}


// --- Answering Logic ---
/**
 * Gère les interactions utilisateur au sein d'un bloc question :
 * - Sélection d'une option (QCM, V/F, QCM-Multi).
 * - Clic sur le bouton Valider universel.
 */
export function handleAnswerSelection(event) {
    const targetElement = event.target;
    const questionBlock = targetElement.closest('.question-block');
    if (!questionBlock || !state.isQuizActive || state.isSubmittingAnswer) {
        if (state.isSubmittingAnswer) console.log("handleAnswerSelection blocked: already submitting");
        return;
    }

    const questionIndex = parseInt(questionBlock.dataset.index, 10);
    const question = state.questionsToAsk[questionIndex];

    // --- CAS 1 : Clic sur le bouton Valider ---
    if (targetElement.closest('.universal-validate-btn')) {
        console.log("Validate button clicked for index:", questionIndex);
        // Extraire la réponse ACTUELLE basée sur l'état de l'UI
        let userAnswer;
        let isValidInput = true;

        switch (question.type) {
            case 'qcm':
            case 'vrai_faux':
                // Trouver le bouton avec la classe .option-selected-ui (la sélection visuelle)
                const selectedButton = questionBlock.querySelector('.answer-options button.answer-btn.option-selected-ui'); // <<< MODIFIÉ ICI
                if (!selectedButton) {
                    showToast("Veuillez sélectionner une réponse.", "warning");
                    isValidInput = false;
                } else {
                    const answerString = selectedButton.dataset.answer;
                    userAnswer = (answerString === 'true') ? true : (answerString === 'false' ? false : answerString);
                    // Optionnel: Marquer ce bouton comme 'selected' pour le style désactivé final
                    selectedButton.classList.add('selected');
                }
                break;
            // ... (reste des cas : texte_libre, qcm_multi, association, ordre) ...
            case 'texte_libre':
                const inputElement = questionBlock.querySelector('.answer-options input[type="text"]');
                userAnswer = inputElement.value.trim();
                if (userAnswer === '') {
                    showToast("Veuillez entrer une réponse.", "warning");
                    isValidInput = false;
                }
                break;
            case 'qcm_multi':
                const checkedBoxes = questionBlock.querySelectorAll('.answer-options input[type="checkbox"]:checked');
                userAnswer = Array.from(checkedBoxes).map(cb => cb.value).sort();
                if (userAnswer.length === 0) {
                    showToast("Veuillez sélectionner au moins une réponse.", "warning");
                    isValidInput = false;
                }
                break;
            case 'association':
                userAnswer = {};
                const matchedTargets = questionBlock.querySelectorAll('.drop-target.matched');
                matchedTargets.forEach(target => {
                    if (target.dataset.targetId && target.dataset.pairedItemId) {
                        userAnswer[target.dataset.targetId] = target.dataset.pairedItemId;
                    }
                });
                const totalTargets = questionBlock.querySelectorAll('.drop-target').length;
                if (matchedTargets.length !== totalTargets) {
                    showToast("Veuillez associer tous les éléments.", "warning");
                    isValidInput = false;
                }
                break;
            case 'ordre':
                const itemsContainer = questionBlock.querySelector('.ordering-items-container');
                if (!itemsContainer) { isValidInput = false; break; }
                userAnswer = Array.from(itemsContainer.querySelectorAll('.ordering-item')).map(item => item.textContent.trim());
                break;
            default:
                console.error("Unknown question type during validation:", question.type);
                isValidInput = false;
                break;
        }


        if (!isValidInput) {
            return;
        }

        // --- Input Valide -> Verrouiller et Traiter ---
        state.isSubmittingAnswer = true;
        disableQuestionBlockInputs(questionBlock);
        processAnswer(questionIndex, userAnswer);

        // Logique de Feedback & Avancement
        if (state.currentQuizConfig.instantFeedback) {
            showImmediateFeedback(questionBlock, state.userAnswers[questionIndex].isCorrect);
            audioManager.playSound(state.userAnswers[questionIndex].isCorrect ? 'correct' : 'incorrect');
            setTimeout(advanceQuestion, FEEDBACK_DELAY);
        } else {
            audioManager.playSound('click'); // Son pour validation
            setTimeout(advanceQuestion, ADVANCE_DELAY);
        }

        // --- CAS 2 : Clic sur une option de réponse QCM/VF (PAS le bouton Valider) ---
    } else if (targetElement.closest('.answer-btn')) {
        const clickedButton = targetElement.closest('.answer-btn');

        // --- Logique de sélection UI ---
        // 1. Enlever la classe de tous les autres boutons de ce bloc
        questionBlock.querySelectorAll('.answer-options button.answer-btn.option-selected-ui')
            .forEach(btn => btn.classList.remove('option-selected-ui'));
        // 2. Ajouter la classe au bouton cliqué
        clickedButton.classList.add('option-selected-ui');
        // 3. Jouer un son de sélection (optionnel)
        audioManager.playSound('select', 0.8); // Son plus léger pour sélection
        // -----------------------------

        console.log("QCM option selected, UI updated for index:", questionIndex);
        // NE PAS valider ni avancer ici

    } else if (targetElement.closest('.checkbox-label') || targetElement.matches('input[type="checkbox"]')) {
        // Pas de changement de style spécifique nécessaire ici, le navigateur gère la coche.
        // On pourrait jouer un son si on veut.
        // audioManager.playSound('select', 0.7);
        console.log("QCM-Multi checkbox toggled for index:", questionIndex);
        // NE PAS valider ni avancer ici
    }
    // else { // Clic ailleurs, ne rien faire }
}

export function disableQuestionBlockInputs(questionBlock) {
    questionBlock.querySelectorAll('button, input, select, textarea').forEach(el => el.disabled = true);
    questionBlock.querySelectorAll('.matching-item, .ordering-item, .drop-target').forEach(el => {
        el.setAttribute('draggable', 'false');
        el.style.cursor = 'default';
        el.classList.remove('over');
        // Remove click handler for returning association items when disabled
        if (el.classList.contains('drop-target') && el.classList.contains('matched')) {
            el.removeEventListener('click', handleReturnItemToLeft);
            el.title = ""; // Clear tooltip
        }
    });
}

export function enableQuestionBlockInputs(questionBlock) {
    // Enable most inputs/buttons, but NOT feedback buttons if they exist
    questionBlock.querySelectorAll('button:not(.flashcard-correct):not(.flashcard-incorrect), input, select, textarea').forEach(el => el.disabled = false);
    // Enable draggable items that are NOT matched
    questionBlock.querySelectorAll('.matching-item:not(.matched)').forEach(el => { el.setAttribute('draggable', 'true'); el.style.cursor = 'grab'; });
    questionBlock.querySelectorAll('.ordering-item').forEach(el => { el.setAttribute('draggable', 'true'); el.style.cursor = 'grab'; });
    // Re-enable click handler for returning association items
    questionBlock.querySelectorAll('.drop-target.matched').forEach(el => {
        el.addEventListener('click', handleReturnItemToLeft);
        el.style.cursor = 'pointer';
        el.title = "Cliquez pour renvoyer l'élément à gauche";
    });
    // Ensure non-matched targets are not clickable
    questionBlock.querySelectorAll('.drop-target:not(.matched)').forEach(el => {
        el.removeEventListener('click', handleReturnItemToLeft);
        el.style.cursor = 'default';
        el.title = '';
    });
}

/** Restores visual selection state when navigating back */
export function restoreAnswerSelectionUI(questionBlock, answer, type) {
    if (answer === null || answer === undefined) return;

    // --- Supprimer toute sélection UI précédente avant de restaurer ---
    questionBlock.querySelectorAll('.answer-options button.option-selected-ui')
        .forEach(btn => btn.classList.remove('option-selected-ui'));
    // -----------------------------------------------------------------

    switch (type) {
        case 'qcm':
        case 'vrai_faux':
            // Trouver le bouton correspondant à la réponse enregistrée
            const btnToSelect = questionBlock.querySelector(`.answer-options button[data-answer="${answer}"]`);
            if (btnToSelect) {
                // Ajouter SEULEMENT la classe de sélection UI, pas la classe 'selected' finale
                btnToSelect.classList.add('option-selected-ui');
            }
            break;
        // ... (reste des cas inchangés: texte_libre, qcm_multi, ordre, association) ...
        case 'texte_libre':
            const inputEl = questionBlock.querySelector('.answer-options input[type="text"]');
            if (inputEl) inputEl.value = answer;
            break;
        case 'qcm_multi':
            const answerArray = Array.isArray(answer) ? answer : [];
            questionBlock.querySelectorAll('.answer-options input[type="checkbox"]').forEach(cb => {
                cb.checked = answerArray.includes(cb.value);
            });
            break;
        case 'ordre':
            const currentItems = Array.from(questionBlock.querySelectorAll('.ordering-items-container .ordering-item'));
            const container = questionBlock.querySelector('.ordering-items-container');
            if (!container || !Array.isArray(answer)) break;
            container.innerHTML = '';
            answer.forEach(itemText => {
                const item = currentItems.find(el => el.textContent.trim() === itemText);
                if (item) container.appendChild(item);
                else console.warn("Could not find ordering item element for:", itemText);
            });
            break;
        case 'association':
            const leftContainer = questionBlock.querySelector('.matching-column[id^="matching-left-"]');
            const allLeftItems = Array.from(leftContainer?.querySelectorAll('.matching-item') || []);
            const allTargets = Array.from(questionBlock.querySelectorAll('.drop-target'));

            allTargets.forEach(target => {
                target.textContent = 'Déposez ici';
                target.classList.remove('matched');
                target.removeAttribute('data-paired-item-id');
                target.removeEventListener('click', handleReturnItemToLeft);
                target.style.cursor = 'default';
                target.title = "";
            });
            allLeftItems.forEach(item => {
                item.classList.remove('matched');
                item.setAttribute('draggable', 'true');
                leftContainer.appendChild(item);
            });

            if (typeof answer === 'object' && answer !== null) {
                for (const targetId in answer) {
                    const itemId = answer[targetId];
                    const targetElement = allTargets.find(t => t.dataset.targetId === targetId);
                    const itemElement = allLeftItems.find(i => i.dataset.itemId === itemId);

                    if (targetElement && itemElement) {
                        targetElement.innerHTML = itemElement.innerHTML;
                        targetElement.classList.add('matched');
                        targetElement.dataset.pairedItemId = itemId;
                        targetElement.addEventListener('click', handleReturnItemToLeft);
                        targetElement.style.cursor = 'pointer';
                        targetElement.title = "Cliquez pour renvoyer l'élément à gauche";
                        itemElement.classList.add('matched');
                        itemElement.setAttribute('draggable', 'false');
                    }
                }
            }
            break;
    }
}

export function showImmediateFeedback(questionBlock, isCorrect) {
    const feedbackDiv = questionBlock.querySelector('.immediate-feedback');
    if (!feedbackDiv) return;

    const textSpan = feedbackDiv.querySelector('.feedback-text');
    feedbackDiv.classList.remove('hidden', 'correct', 'incorrect', 'visible');
    textSpan.innerHTML = ''; // Clear previous

    let feedbackTextHTML = isCorrect ? "Correct !" : "Incorrect.";
    if (!isCorrect && state.currentQuizConfig.showExpl) {
        const question = state.questionsToAsk[state.currentQuestionIndex];
        const correctAnswerFormatted = formatAnswerForDisplay(question.correctAnswer, question.type); // Use results formatter
        feedbackTextHTML += `<span class="feedback-correct-answer">Bonne réponse : ${correctAnswerFormatted}</span>`;
        if (question.explanation) {
            feedbackTextHTML += `<p class="explanation" style="margin-top: 8px; font-size: 0.9em;">${renderMarkdown(question.explanation)}</p>`;
        }
    }

    feedbackDiv.classList.add(isCorrect ? 'correct' : 'incorrect');
    textSpan.innerHTML = feedbackTextHTML; // Use innerHTML

    setTimeout(() => feedbackDiv.classList.add('visible'), 10);
}

/** Processes the user's answer, calculates score/points, updates streak. */
export function processAnswer(questionIndex, userAnswer) {
    // Ensure answer entry exists (should be initialized in createQuestionBlock)
    if (state.userAnswers[questionIndex] === null) {
        console.warn(`processAnswer called for index ${questionIndex} but userAnswers entry is null. Initializing.`);
        const q = state.questionsToAsk[questionIndex];
        const qId = q.id || `q_${state.selectedQuizId}_${q.originalIndex ?? questionIndex}`;
        state.userAnswers[questionIndex] = { questionId: qId, marked: false, displayedOptions: null };
    }

    const question = state.questionsToAsk[questionIndex];
    // --- Standardized ID Generation ---
    const questionId = question.id || `q_${state.selectedQuizId}_${question.originalIndex ?? questionIndex}`;

    // --- Ensure userAnswers entry exists with the correct ID ---
    // Create or update the entry, preserving existing marked/options status if possible
    if (state.userAnswers[questionIndex] === null || state.userAnswers[questionIndex].questionId !== questionId) {
        console.warn(`processAnswer: Initializing/Correcting userAnswers entry for index ${questionIndex} with ID ${questionId}`);
        state.userAnswers[questionIndex] = {
            ...(state.userAnswers[questionIndex] || {}), // Keep existing data like marked/options if entry existed but ID was wrong
            questionId: questionId,
            // Ensure core fields exist if creating anew
            marked: state.userAnswers[questionIndex]?.marked ?? false,
            displayedOptions: state.userAnswers[questionIndex]?.displayedOptions ?? null,
            answer: state.userAnswers[questionIndex]?.answer ?? null,
            isCorrect: state.userAnswers[questionIndex]?.isCorrect ?? null,
            pointsEarned: state.userAnswers[questionIndex]?.pointsEarned ?? 0,
            timeTaken: state.userAnswers[questionIndex]?.timeTaken ?? null,
        };
    }

    const correctAnswer = question.correctAnswer;
    const pointsPossible = question.points ?? 10; // Points max pour cette question
    let isCorrect = false; // Sera true seulement si la correspondance est parfaite
    let pointsEarned = 0; // Initialiser les points gagnés
    const timeTaken = (Date.now() - state.questionStartTime) / 1000;

    // --- Check Correctness ---
    try {
        switch (question.type) {
            case 'vrai_faux':
                isCorrect = (userAnswer === correctAnswer);
                pointsEarned = isCorrect ? pointsPossible : 0;
                break;
            case 'qcm':
                isCorrect = String(userAnswer).toLowerCase() === String(correctAnswer).toLowerCase();
                pointsEarned = isCorrect ? pointsPossible : 0;
                break;
            case 'texte_libre':
                const s1 = String(userAnswer).trim().toLowerCase();
                const s2 = String(correctAnswer).trim().toLowerCase();
                const error = levenshtein(s1, s2) / s2.length; // Calculate the error so that mis-type can occur correctly
                console.log(error, error <= 0.15);
                isCorrect = (error <= 0.15); // Lower than 15% means correct answer
                pointsEarned = isCorrect ? pointsPossible : 0;
                break;

            case 'qcm_multi':
                // Assurer que correctAnswer et userAnswer sont des tableaux triés de strings
                const correctAnswersSet = new Set(Array.isArray(correctAnswer) ? correctAnswer.map(String) : [String(correctAnswer)]);
                const userAnswersSet = new Set(Array.isArray(userAnswer) ? userAnswer.map(String) : [String(userAnswer)]); // userAnswer vient déjà trié et en string de handleAnswerSelection

                // --- Calcul du Score Partiel ---
                let correctSelectedCount = 0;
                let incorrectSelectedCount = 0;
                const totalCorrectOptions = correctAnswersSet.size;
                // Pourrait aussi calculer le nombre total d'options affichées si on veut baser la pénalité là-dessus
                // const totalDisplayedOptions = questionBlock.querySelectorAll('.answer-options input[type="checkbox"]').length;

                // Compter les bonnes et mauvaises sélections de l'utilisateur
                userAnswersSet.forEach(ans => {
                    if (correctAnswersSet.has(ans)) {
                        correctSelectedCount++;
                    } else {
                        incorrectSelectedCount++;
                    }
                });

                // Vérifier si la réponse est parfaitement correcte
                isCorrect = (correctSelectedCount === totalCorrectOptions) && (incorrectSelectedCount === 0);

                // Calculer les points gagnés
                if (totalCorrectOptions > 0) {
                    const pointsPerCorrect = pointsPossible / totalCorrectOptions;
                    // Option 1: Pénalité égale aux points gagnés par bonne réponse
                    const penaltyPerIncorrect = pointsPerCorrect;
                    // Option 2: Pénalité basée sur le nombre de distracteurs (plus complexe si options générées dynamiquement)
                    // const totalDistractors = totalDisplayedOptions - totalCorrectOptions;
                    // const penaltyPerIncorrect = totalDistractors > 0 ? pointsPossible / totalDistractors : 0;

                    const scoreBeforePenalty = correctSelectedCount * pointsPerCorrect;
                    const totalPenalty = incorrectSelectedCount * penaltyPerIncorrect;

                    pointsEarned = Math.max(0, scoreBeforePenalty - totalPenalty); // Score ne peut pas être négatif
                    pointsEarned = Math.round(pointsEarned); // Arrondir au point entier le plus proche

                    // Si la réponse est parfaite, s'assurer qu'on donne tous les points (évite erreurs d'arrondi)
                    if (isCorrect) {
                        pointsEarned = pointsPossible;
                    }

                } else {
                    // Cas étrange où il n'y a pas de bonne réponse définie ? Score = 0
                    pointsEarned = 0;
                    isCorrect = (userAnswersSet.size === 0); // Correct si on n'a rien coché
                }
                console.log(`QCM-Multi Score: Correct=${correctSelectedCount}/${totalCorrectOptions}, Incorrect=${incorrectSelectedCount}, Points=${pointsEarned}/${pointsPossible}`);
                // --- Fin Calcul Score Partiel ---
                break; // Fin du case qcm_multi

            case 'ordre':
                const correctOrder = Array.isArray(correctAnswer) ? correctAnswer : [];
                const userOrder = Array.isArray(userAnswer) ? userAnswer : [];
                isCorrect = userOrder.join('|') === correctOrder.join('|');
                pointsEarned = isCorrect ? pointsPossible : 0;
                break;
            case 'association':
                const correctMap = typeof correctAnswer === 'object' && correctAnswer !== null ? correctAnswer : {};
                const userMap = typeof userAnswer === 'object' && userAnswer !== null ? userAnswer : {};
                let allMatch = true;
                if (Object.keys(userMap).length !== Object.keys(correctMap).length) {
                    allMatch = false;
                } else {
                    for (const leftItemKey in correctMap) {
                        const correctTarget = correctMap[leftItemKey];
                        let userMappedLeftItem = null;
                        for (const targetKey in userMap) {
                            if (targetKey === correctTarget) {
                                userMappedLeftItem = userMap[targetKey];
                                break;
                            }
                        }
                        if (userMappedLeftItem !== leftItemKey) {
                            allMatch = false;
                            break;
                        }
                    }
                }
                if (question.items_left && Object.keys(userMap).length !== question.items_left.length) {
                    allMatch = false;
                }
                isCorrect = allMatch;
                pointsEarned = isCorrect ? pointsPossible : 0;
                break;
            default:
                isCorrect = false;
                pointsEarned = 0;
        }
    } catch (e) {
        console.error("Error checking answer:", e);
        isCorrect = false;
        pointsEarned = 0;
    }

    // Update the specific answer entry (now we know it exists with the right ID)
    state.userAnswers[questionIndex] = {
        ...state.userAnswers[questionIndex], // Keep questionId, marked, displayedOptions
        answer: userAnswer,
        isCorrect: isCorrect,
        pointsEarned: pointsEarned,
        timeTaken: parseFloat(timeTaken.toFixed(2)),
    };

    // Recalculate running stats for the session
    recalculateCurrentSessionStats();
    updateQuizHeader(); // Update UI immediately
}

/** Recalculates score, points, streak based on current state.userAnswers */
export function recalculateCurrentSessionStats() {
    let currentSessionScore = 0;
    let currentSessionPoints = 0;
    let currentSessionStreak = 0;
    let maxSessionStreak = 0;

    for (let i = 0; i < state.userAnswers.length; i++) {
        const answer = state.userAnswers[i];
        if (answer !== null) { // Only count answered questions
            if (answer.isCorrect) {
                currentSessionScore++;
                currentSessionPoints += answer.pointsEarned || 0; // Ensure points are added
                currentSessionStreak++;
            } else {
                maxSessionStreak = Math.max(maxSessionStreak, currentSessionStreak);
                currentSessionStreak = 0; // Reset streak on incorrect
            }
        } else {
            // Reset streak if a question is skipped (e.g., due to navigation)
            maxSessionStreak = Math.max(maxSessionStreak, currentSessionStreak);
            currentSessionStreak = 0;
        }
    }
    // Final check for streak at the end of the answers array
    maxSessionStreak = Math.max(maxSessionStreak, currentSessionStreak);

    // Update global state variables for the current session
    state.score = currentSessionScore;
    state.totalPoints = currentSessionPoints;
    // IMPORTANT: currentStreak should reflect the streak ending at the *last answered* question,
    // but the loop calculates it based on the full array. Let's keep the loop's current streak.
    state.currentStreak = currentSessionStreak;
    state.maxStreak = maxSessionStreak; // Max streak achieved *so far*
}


export function advanceQuestion() {
    // Déverrouiller la soumission pour la prochaine question *au début*
    state.isSubmittingAnswer = false;

    // Cacher le feedback de la question actuelle (si visible)
    const currentBlock = dom.quiz.contentArea.querySelector(`.question-block[data-index="${state.currentQuestionIndex}"]`);
    if (currentBlock) {
        const feedbackDiv = currentBlock.querySelector('.immediate-feedback');
        if (feedbackDiv) feedbackDiv.classList.remove('visible');
    }

    const nextIndex = state.currentQuestionIndex + 1;
    if (nextIndex < state.questionsToAsk.length) {
        displayQuestion(nextIndex); // Afficher la question suivante
    } else {
        // --- CORRECTION : Vérifier si TOUTES les questions ont été répondues ---
        // (On vient de répondre à la dernière, donc on vérifie l'état actuel de userAnswers)
        const allAnswered = state.userAnswers.every(answer => answer !== null && answer.answer !== null);

        if (allAnswered) {
            // Toutes les questions ont une réponse -> Quiz terminé !
            setQuizActive(false); // Marquer le quiz comme inactif
            if (state.timerInterval) clearInterval(state.timerInterval);
            state.timerInterval = null;
            if (!state.quizEndTime) state.quizEndTime = Date.now();

            // Afficher le bouton "Voir les Résultats"
            dom.quiz.finishQuizBtn.classList.remove('hidden');
            dom.quiz.cancelQuizBtn.classList.add('hidden');
            updateQuestionGridNav(); // Mettre à jour la grille pour montrer l'état final
            showToast("Session terminée ! Cliquez sur 'Voir les Résultats'.", "success");
            playSound('finish');
            dom.quiz.finishQuizBtn.scrollIntoView({ behavior: 'smooth', block: 'center' });
        } else {
            // Pour l'instant, on marque comme inactif et on informe.
            if (state.timerInterval) clearInterval(state.timerInterval);
            state.timerInterval = null;
            if (!state.quizEndTime) state.quizEndTime = Date.now(); // Marquer la fin quand même ?

            updateQuestionGridNav(); // Mettre à jour la grille
            dom.quiz.cancelQuizBtn.classList.add('hidden'); // Cacher abandonner
            dom.quiz.finishQuizBtn.classList.add('hidden'); // Cacher aussi finir
            showToast("Vous avez répondu à la dernière question, mais certaines précédentes sont sans réponse.", "warning");
            // Optionnel : Proposer un bouton pour "Aller à la prochaine question non répondue" ?
            // Ou simplement laisser l'utilisateur naviguer via la grille.
        }
    }
}

export function handleMarkQuestion(event) {
    const button = event.target.closest('.mark-question-btn'); // Ensure button itself
    if (!button) return;
    const index = parseInt(button.dataset.questionIndex, 10);
    if (isNaN(index) || index < 0 || index >= state.questionsToAsk.length) return;

    // Ensure answer entry exists
    if (state.userAnswers[index] === null) {
        const q = state.questionsToAsk[index];
        const qId = q.id || `q_${state.selectedQuizId}_${q.originalIndex ?? index}`;
        state.userAnswers[index] = { questionId: qId, marked: false, displayedOptions: null, answer: null, isCorrect: null, pointsEarned: 0, timeTaken: null }; // Initialize minimally
    }
    state.userAnswers[index].marked = !state.userAnswers[index].marked;

    // Update button UI
    button.textContent = state.userAnswers[index].marked ? '🌟' : '⭐';
    button.title = state.userAnswers[index].marked ? "Ne plus marquer" : "Marquer cette question";
    button.classList.toggle('marked', state.userAnswers[index].marked);
    showToast(`Question ${index + 1} ${state.userAnswers[index].marked ? 'marquée' : 'démárquée'}.`, 'info', 1500);
    audioManager.playSound('click');
    // No backend call needed for local version
}

export function forceFinishQuiz(timedOut = false) {
    if (!state.isQuizActive && !timedOut) return; // Avoid finishing multiple times unless timed out
    if (!state.questionsToAsk || state.questionsToAsk.length === 0) return; // No questions

    console.log(`Forcing quiz finish. Timed out: ${timedOut}`);
    setQuizActive(false); // Use state modifier
    // updateSettingsButtonVisibility(); // This should be called from main.js after state change
    if (state.timerInterval) clearInterval(state.timerInterval);
    state.timerInterval = null;
    if (!state.quizEndTime) state.quizEndTime = Date.now();

    // Mark remaining as unanswered and disable current block
    state.questionsToAsk.forEach((q, index) => {
        if (state.userAnswers[index] === null) {
            // --- Use Standardized ID Generation ---
            const questionId = q.id || `q_${state.selectedQuizId}_${q.originalIndex ?? index}`;
            state.userAnswers[index] = {
                questionId: questionId, answer: null, isCorrect: false, pointsEarned: 0,
                timeTaken: null, marked: false, displayedOptions: null // Ensure all fields exist
            };
        }
        const block = dom.quiz.contentArea.querySelector(`.question-block[data-index="${index}"]`);
        if (block && index === state.currentQuestionIndex) {
            disableQuestionBlockInputs(block);
        }
    });

    recalculateCurrentSessionStats(); // Recalculate final stats
    updateQuestionGridNav(); // Show final grid state
    dom.quiz.cancelQuizBtn.classList.add('hidden');
    dom.quiz.finishQuizBtn.classList.add('hidden'); // Hide finish button too

    showResults(); // Go directly to results screen
}

export function handleCancelQuiz() {
    if (!state.isQuizActive) return;
    if (confirm("Êtes-vous sûr de vouloir abandonner cette session ? Votre progression ne sera pas sauvegardée.")) {
        setQuizActive(false); // Use state modifier
        if (state.timerInterval) clearInterval(state.timerInterval);

        // Reset only quiz-related state, keep library/history/prefs
        resetQuizState();
        // Crucially, deselect the quiz so config options hide on dashboard
        resetSelectionState();

        showToast("Session abandonnée.", "info");
        showScreen('dashboard'); // Go back to dashboard
        // Trigger UI updates needed for dashboard after cancellation
        // These might need to be called from main.js after showScreen
        // Example: renderQuizLibrary(); displayScoreHistory(); populateHistoryFilter();
    }
}


// --- Configuration Logic (Moved from main event handler area) ---
// Au début de handleConfigChange dans quizEngine.js
export function handleConfigChange() {
    const selectedMode = document.querySelector('input[name="quiz-mode"]:checked')?.value;
    if (!selectedMode) return;

    // --- Désactiver les options non pertinentes pour certains modes ---
    const isReviewMode = selectedMode === 'review-all';
    const disableTimeAndNav = isReviewMode; // Désactiver temps et options de nav/feedback pour review-all

    dom.dashboard.customSettingsDiv.classList.toggle('hidden', selectedMode !== 'custom' || isReviewMode);
    dom.dashboard.errorSessionsCountInput.disabled = (selectedMode !== 'errors');

    // Désactivation pour le mode "review-all"
    dom.dashboard.allowNavigationCheckbox.disabled = disableTimeAndNav;
    dom.dashboard.instantFeedbackCheckbox.disabled = disableTimeAndNav;
    dom.dashboard.showExplOnIncorrectCheckbox.disabled = disableTimeAndNav;
    dom.dashboard.customTimeInput.disabled = disableTimeAndNav; // Désactiver aussi le temps custom
    dom.dashboard.customQuestionsInput.disabled = (selectedMode === 'review-all'); // Pas de sélection de nombre pour ce mode

    // Appliquer l'opacité pour indiquer la désactivation
    [
        dom.dashboard.allowNavigationCheckbox,
        dom.dashboard.instantFeedbackCheckbox,
        dom.dashboard.showExplOnIncorrectCheckbox,
        dom.dashboard.customTimeInput,
        dom.dashboard.customQuestionsInput
    ].forEach(el => {
        const label = el.closest('label') || el.previousElementSibling;
        const opacityValue = el.disabled ? '0.5' : '1'; // Déterminer la valeur d'opacité

        // Appliquer l'opacité à l'élément lui-même
        el.style.opacity = opacityValue;
        // Appliquer au label trouvé s'il existe
        if (label) label.style.opacity = opacityValue;

        // --- CORRECTION : Vérifier avant d'assigner ---
        const errorGroupLabel = el.closest('.has-extra-input');
        if (errorGroupLabel) {
            errorGroupLabel.style.opacity = opacityValue;
        }
        const customSettingLabel = el.closest('#custom-settings label');
        // Note: el.closest('#custom-settings label') trouvera le label contenant l'input custom,
        // ce qui est probablement ce que vous vouliez, similaire à la recherche via `label`.
        // Si vous vouliez cibler un conteneur #custom-settings spécifique, la logique serait différente.
        if (customSettingLabel) {
            customSettingLabel.style.opacity = opacityValue;
        }
        // ---------------------------------------------
    });

    console.log("HELLO")

    // --- Logique existante pour instant feedback / nav back ---
    // (Ne s'appliquera pas si les options sont désactivées par le code ci-dessus)
    if (!disableTimeAndNav) { // Appliquer seulement si pas en mode review
        if (dom.dashboard.allowNavigationCheckbox.checked) {
            // ... logique existante ...
            dom.dashboard.instantFeedbackCheckbox.checked = false;
            dom.dashboard.instantFeedbackCheckbox.disabled = true;
            dom.dashboard.showExplOnIncorrectCheckbox.checked = false;
            dom.dashboard.showExplOnIncorrectCheckbox.disabled = true;
            dom.dashboard.instantFeedbackCheckbox.closest('label').style.opacity = '0.5';
            dom.dashboard.showExplOnIncorrectCheckbox.closest('label').style.opacity = '0.5';
        } else {
            // ... logique existante ...
            dom.dashboard.instantFeedbackCheckbox.disabled = false;
            dom.dashboard.instantFeedbackCheckbox.closest('label').style.opacity = '1';
            const isInstantFeedbackChecked = dom.dashboard.instantFeedbackCheckbox.checked;
            dom.dashboard.showExplOnIncorrectCheckbox.disabled = !isInstantFeedbackChecked;
            dom.dashboard.showExplOnIncorrectCheckbox.closest('label').style.opacity = isInstantFeedbackChecked ? '1' : '0.5';
            if (!isInstantFeedbackChecked) {
                dom.dashboard.showExplOnIncorrectCheckbox.checked = false;
            }
        }
    } else {
        // Si en mode review, s'assurer que les options dépendantes sont aussi visuellement désactivées
        dom.dashboard.instantFeedbackCheckbox.closest('label').style.opacity = '0.5';
        dom.dashboard.showExplOnIncorrectCheckbox.closest('label').style.opacity = '0.5';
    }
}

export function resetConfigOptions(prefill = false) {
    loadLastConfig(); // Ensure state.lastConfig is up-to-date

    const defaultMode = (prefill && state.lastConfig.mode) ? state.lastConfig.mode : 'preset-short';
    const radioToSelect = document.querySelector(`input[name="quiz-mode"][value="${defaultMode}"]`)
        || document.querySelector('input[name="quiz-mode"][value="preset-short"]'); // Fallback
    if (radioToSelect) radioToSelect.checked = true;

    dom.dashboard.allowNavigationCheckbox.checked = (prefill && state.lastConfig.allowNavBack !== undefined) ? state.lastConfig.allowNavBack : false;
    dom.dashboard.instantFeedbackCheckbox.checked = (prefill && state.lastConfig.instantFeedback !== undefined) ? state.lastConfig.instantFeedback : true;
    // showExpl depends on instantFeedback, handleConfigChange will set it correctly
    // dom.dashboard.showExplOnIncorrectCheckbox.checked = (prefill && state.lastConfig.showExpl !== undefined) ? state.lastConfig.showExpl : false; // Initial state before logic

    dom.dashboard.customTimeInput.value = (prefill && state.lastConfig.customTime) ? state.lastConfig.customTime : '';
    dom.dashboard.customQuestionsInput.value = (prefill && state.lastConfig.customQuestions) ? state.lastConfig.customQuestions : '';
    dom.dashboard.errorSessionsCountInput.value = (prefill && state.lastConfig.errorSessions) ? state.lastConfig.errorSessions : '3';

    handleConfigChange(); // Update UI based on defaults/prefill and dependencies
}


export function updateErrorModeAvailability() {
    const errorModeRadio = document.querySelector('input[name="quiz-mode"][value="errors"]');
    const errorModeLabel = errorModeRadio?.closest('label');
    if (!errorModeRadio || !errorModeLabel) return;

    let isDisabled = true;
    let title = "Sélectionnez d'abord un quiz";

    if (state.selectedQuizId) {
        // Ensure history is loaded before checking
        loadLocalHistory();
        const hasErrorsInHistory = state.localHistory.some(attempt =>
            attempt.quizId === state.selectedQuizId &&
            attempt.answers &&
            attempt.answers.some(a => a && a.isCorrect === false)
        );
        isDisabled = !hasErrorsInHistory;
        title = hasErrorsInHistory ? "" : "Aucune erreur enregistrée pour ce quiz dans l'historique";
    }

    errorModeRadio.disabled = isDisabled;
    errorModeLabel.style.opacity = isDisabled ? '0.5' : '1';
    errorModeLabel.title = title;

    // If errors mode was selected but becomes disabled, switch to default
    if (errorModeRadio.checked && isDisabled) {
        console.log("Error mode was checked but became unavailable. Resetting config.");
        resetConfigOptions(false); // Reset to default, don't prefill last config
    }
}


//--- Helper to generate false answers --- Moved from questionRenderer to be callable by engine ---
/**
* Generates false answers (distractors) for QCM/QCM-Multi questions.
*/
/**
 * Génère des réponses fausses (distracteurs) plus plausibles pour les questions QCM/QCM-Multi.
 * @param {object} currentQuestion L'objet question actuel.
 * @param {Array} allQuestions Tous les objets questions du quiz.
 * @param {object|null} dummyAnswersData L'objet dummyAnswers du JSON.
 * @param {Array} excludedAnswers Réponses spécifiques à exclure (en plus de la bonne réponse).
 * @returns {Array<string>} Un tableau de jusqu'à 3 chaînes de distracteurs uniques.
 */
export function generateFalseAnswers(currentQuestion, allQuestions, dummyAnswersData, excludedAnswers = []) {
    const correctAnswer = currentQuestion.correctAnswer;
    const correctAnswersArray = Array.isArray(correctAnswer) ? correctAnswer.map(String) : [String(correctAnswer)]; // Tableau de strings
    const correctAnswersLower = new Set(correctAnswersArray.map(a => a.toLowerCase()));

    // --- Ensemble des réponses à exclure (bonnes réponses + celles passées en argument) ---
    const excludedLower = new Set([
        ...correctAnswersLower,
        ...excludedAnswers.map(a => String(a).toLowerCase())
    ]);

    // --- Analyse de la bonne réponse principale (la première si QCM-Multi) ---
    const primaryCorrectAnswer = correctAnswersArray[0];
    const targetFormat = getAnswerFormat(primaryCorrectAnswer);
    const targetLength = primaryCorrectAnswer.length;

    // --- Collecte des distracteurs potentiels par source et priorité ---
    let potentialPool = []; // Contiendra des objets { text: string, sourcePriority: number, formatMatch: boolean, distance: number }

    const addAnswerToPool = (answer, sourcePriority) => {
        const answerStr = String(answer);
        const answerStrLower = answerStr.toLowerCase();

        // Vérifie si valide, non exclu et non vide
        if (answerStr.trim() === '' || excludedLower.has(answerStrLower) || correctAnswersLower.has(answerStrLower)) {
            return;
        }

        // Calcule les métriques de pertinence
        const format = getAnswerFormat(answerStr);
        const formatMatch = (format === targetFormat);
        // Distance Levenshtein (plus bas = plus similaire)
        const distance = levenshtein(primaryCorrectAnswer, answerStr);

        potentialPool.push({
            text: answerStr, // Garde la casse originale
            lowerText: answerStrLower, // Pour la déduplication
            sourcePriority: sourcePriority, // 1 = meilleure source
            formatMatch: formatMatch,
            distance: distance,
            lengthDiff: Math.abs(answerStr.length - targetLength)
        });
    };

    // --- Ordre de remplissage (priorité décroissante) ---
    const sources = [
        // 1. Dummies même catégorie
        () => {
            if (dummyAnswersData && currentQuestion.category && dummyAnswersData[currentQuestion.category]) {
                dummyAnswersData[currentQuestion.category].forEach(d => addAnswerToPool(d, 1));
            }
        },
        // 2. Dummies globaux
        () => {
            if (dummyAnswersData && dummyAnswersData.Global) {
                dummyAnswersData.Global.forEach(d => addAnswerToPool(d, 2));
            }
        },
        // 3. Bonnes réponses autres questions (même catégorie)
        () => {
            allQuestions.forEach(q => {
                if (q !== currentQuestion && q.category === currentQuestion.category) {
                    const otherCorrect = q.correctAnswer;
                    if (Array.isArray(otherCorrect)) otherCorrect.forEach(item => addAnswerToPool(item, 3));
                    else addAnswerToPool(otherCorrect, 3);
                }
            });
        },
        // 4. Bonnes réponses autres questions (autres catégories) - Priorité plus basse
        () => {
            allQuestions.forEach(q => {
                if (q !== currentQuestion && q.category !== currentQuestion.category) {
                    const otherCorrect = q.correctAnswer;
                    if (Array.isArray(otherCorrect)) otherCorrect.forEach(item => addAnswerToPool(item, 4));
                    else addAnswerToPool(otherCorrect, 4);
                }
            });
        },
        // 5. Dummies autres catégories - Priorité la plus basse
        () => {
            if (dummyAnswersData) {
                for (const cat in dummyAnswersData) {
                    if (cat !== currentQuestion.category && cat !== "Global") {
                        dummyAnswersData[cat].forEach(d => addAnswerToPool(d, 5));
                    }
                }
            }
        },
    ];

    // Remplir le pool en suivant les priorités
    sources.forEach(fillFunc => fillFunc());

    // --- Déduplication basée sur le texte en minuscules ---
    const uniquePoolMap = new Map();
    potentialPool.forEach(item => {
        if (!uniquePoolMap.has(item.lowerText)) {
            uniquePoolMap.set(item.lowerText, item);
        }
        // Optionnel : si on trouve un doublon, garder celui avec la meilleure sourcePriority ?
        // else {
        //     const existing = uniquePoolMap.get(item.lowerText);
        //     if (item.sourcePriority < existing.sourcePriority) {
        //         uniquePoolMap.set(item.lowerText, item);
        //     }
        // }
    });
    const uniquePool = Array.from(uniquePoolMap.values());


    // --- Tri du pool unique pour sélectionner les meilleurs candidats ---
    uniquePool.sort((a, b) => {
        // 1. Priorité à la source (plus bas = mieux)
        if (a.sourcePriority !== b.sourcePriority) return a.sourcePriority - b.sourcePriority;
        // 2. Priorité au format correspondant
        if (a.formatMatch !== b.formatMatch) return a.formatMatch ? -1 : 1; // true vient avant false
        // 3. Priorité à la distance Levenshtein (légèrement différente est bien, trop proche ou trop loin est moins bien)
        //    On cherche une distance > 0 mais pas trop grande. Peut-être cibler distance 1-5 ?
        const idealDistanceMin = 1;
        const idealDistanceMax = Math.max(5, Math.floor(targetLength * 0.5)); // Ex: 1 à 5, ou jusqu'à 50% de la longueur
        const aIsIdeal = a.distance >= idealDistanceMin && a.distance <= idealDistanceMax;
        const bIsIdeal = b.distance >= idealDistanceMin && b.distance <= idealDistanceMax;
        if (aIsIdeal !== bIsIdeal) return aIsIdeal ? -1 : 1; // Idéal vient avant
        // Si les deux sont idéaux ou non idéaux, préférer la distance la plus petite (mais > 0)
        if (a.distance !== b.distance) return a.distance - b.distance;
        // 4. Priorité à la différence de longueur la plus faible
        if (a.lengthDiff !== b.lengthDiff) return a.lengthDiff - b.lengthDiff;
        // 5. Fallback (juste pour être stable)
        return a.lowerText.localeCompare(b.lowerText);
    });

    // --- Sélectionner les 3 meilleurs et retourner leur texte original ---
    const finalDistractors = uniquePool.slice(0, 3).map(item => item.text);

    // --- Fallback si moins de 3 options ---
    let fallbackCounter = 1;
    while (finalDistractors.length < 3) {
        const placeholder = `Autre réponse ${fallbackCounter}`;
        // S'assurer que le fallback n'est pas une bonne réponse ou déjà dans les distracteurs
        if (!correctAnswersLower.has(placeholder.toLowerCase()) &&
            !finalDistractors.some(d => d.toLowerCase() === placeholder.toLowerCase())) {
            finalDistractors.push(placeholder);
        }
        fallbackCounter++;
        if (fallbackCounter > 10) break; // Safety break
    }

    console.log(`Generated distractors for "${primaryCorrectAnswer}":`, finalDistractors);
    return finalDistractors;
}


// Helper function from results.js needed here for immediate feedback
function formatAnswerForDisplay(answerValue, questionType) {
    if (answerValue === null || answerValue === undefined) return '<i>N/A</i>';
    let displayString = '';
    try {
        if (questionType === 'vrai_faux') displayString = answerValue ? 'Vrai' : 'Faux';
        else if (Array.isArray(answerValue)) displayString = answerValue.map(val => renderMarkdown(String(val))).join(questionType === 'ordre' ? ' → ' : ', ');
        else if (questionType === 'association' && typeof answerValue === 'object') {
            // In immediate feedback, user answer is {targetId: itemId}, correct is {itemId: targetId}
            // Need to format based on context or stick to one format. Let's use target->item for user answer display.
            displayString = Object.entries(answerValue).map(([key, value]) => `${renderMarkdown(key)} → ${renderMarkdown(value)}`).join('<br>');
        }
        else displayString = renderMarkdown(String(answerValue));
    } catch (e) {
        console.warn("Error formatting answer:", answerValue, e);
        const tempDiv = document.createElement('div');
        tempDiv.textContent = String(answerValue);
        displayString = tempDiv.innerHTML; // Basic HTML escaping fallback
    }
    return displayString;
}