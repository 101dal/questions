import * as dom from './dom.js';
import { state, resetQuizState, resetSelectionState, setQuizActive } from './state.js';
import * as storage from './storage.js';
import * as ui from './ui.js';
import * as library from './library.js';
import * as importExport from './importExport.js';
import * as quizEngine from './quizEngine.js';
import * as results from './results.js';
import * as review from './review.js';
import * as settings from './settings.js';
import * as stats from './stats.js';
import * as audioManager from './audioManager.js';
import * as tutorialManager from './tutorial.js';

// --- Initialization ---
async function init() {
    console.log("Quiz Master (Local Version) Initializing...");
    ui.showLoader(); // Show loader during init

    // Load all necessary data from storage into state
    storage.loadUserPreferences();
    storage.loadQuizLibrary();
    storage.loadLocalHistory();
    storage.loadLocalStats();
    storage.loadLastConfig();

    // --- Initialiser l'Audio Manager ---
    // Important : L'appeler avant que les premiers sons ne soient potentiellement joués
    // mais après le chargement des préférences (pour savoir si le son est activé).
    await audioManager.initAudioManager();

    // Apply initial settings
    ui.applyTheme(state.userPreferences.theme);

    // --- Afficher le tutoriel si nécessaire ---
    await tutorialManager.checkAndShowTutorial();

    // Import default quizzes if not present
    try {
        await importExport.importDefaultQuizzes(); // Attendre si besoin
        setupEventListeners();
        createDynamicElements();
        showScreenAndRender('dashboard');
    } catch (error) {
        console.error("Error during initialization:", error);
        // Essayer de continuer même si une partie échoue
        setupEventListeners();
        createDynamicElements();
        showScreenAndRender('dashboard');
    } finally {
        ui.hideLoader();
        console.log("Initialization Complete.");
    }


}

// --- Dynamic Element Creation ---
function createDynamicElements() {
    // Settings Button
    if (!document.getElementById('dynamic-settings-btn')) { // Créer seulement s'il n'existe pas
        const button = document.createElement('button');
        button.id = 'dynamic-settings-btn';
        button.innerHTML = '⚙️'; // Emoji initial
        button.title = "Paramètres & Statistiques";
        // Les styles CSS (position: fixed, z-index, etc.) sont gérés dans le CSS

        // --- ÉCOUTEUR MODIFIÉ : Basculer la classe 'visible' ---
        button.addEventListener('click', () => {
            const settingsScreen = dom.screens.settings; // <<< Vérifier cette référence
            if (!settingsScreen) {
                console.error("L'élément de l'écran des paramètres est introuvable !");
                return;
            }
            const isVisible = settingsScreen.classList.contains('visible');

            if (isVisible) {
                settingsScreen.classList.remove('visible'); // <<< Retire la classe
                settingsScreen.classList.add('hidden'); // <<< AJOUTE la classe
                button.innerHTML = '⚙️';
                button.title = "Ouvrir Paramètres";
            } else {
                settings.renderSettingsScreen(); // Re-render avant d'afficher
                settingsScreen.classList.remove('hidden'); // <<< Retire la classe
                settingsScreen.classList.add('visible'); // <<< AJOUTE la classe
                button.innerHTML = '❌';
                button.title = "Fermer Paramètres";
            }
        });
        // --- FIN ÉCOUTEUR MODIFIÉ ---

        document.body.appendChild(button);
        dom.dynamic.settingsButton = button; // Garder la référence si besoin ailleurs
    }
}



// --- Screen Switching and Rendering ---
function showScreenAndRender(screenId) {
    // Ne plus cacher/montrer l'écran settings ici
    Object.keys(dom.screens).forEach(id => {
        if (id === 'settings') return; // Ignorer l'écran settings pour display:block/none

        const isActive = id === screenId;
        dom.screens[id].classList.toggle('active', isActive);
        // On pourrait aussi utiliser opacity/visibility pour les écrans principaux
        // dom.screens[id].classList.toggle('hidden', !isActive);
    });
    // Scroll to top pour les écrans principaux
    if (screenId !== 'settings') {
        window.scrollTo({ top: 0, behavior: 'smooth' });
        ui.showScreen(screenId);
    }

    // Appeler les fonctions de rendu spécifiques
    switch (screenId) {
        case 'dashboard':
            library.renderQuizLibrary();
            displayScoreHistory();
            library.populateHistoryFilter();
            quizEngine.updateErrorModeAvailability();
            dom.dashboard.configOptionsDiv.classList.toggle('hidden', !state.selectedQuizId);
            if (state.selectedQuizId) quizEngine.resetConfigOptions(true);
            break;
        case 'quiz':
            // Pas de rendu spécifique ici, géré par startQuiz/displayQuestion
            break;
        case 'results':
            // Rendu géré par results.showResults
            break;
        case 'review':
            // Rendu géré par review.showReviewScreen
            break;
        // PAS DE CAS 'settings' ICI
    }
    // ui.updateSettingsButtonVisibility(); // <<< SUPPRIMER (bouton toujours visible)
}

// --- History Display (Moved here as it uses library state) ---
export function displayScoreHistory() {
    storage.loadLocalHistory(); // Ensure history is fresh

    const historyTable = dom.dashboard.scoreHistoryDiv.querySelector('table');
    let tbody;

    if (!historyTable) {
        dom.dashboard.scoreHistoryDiv.innerHTML = `
             <table>
                 <thead>
                     <tr>
                         <th>Date</th><th>Quiz</th><th>Score</th><th>Points</th><th>Temps</th><th>Mode</th>
                     </tr>
                 </thead>
                 <tbody></tbody>
             </table>`;
        tbody = dom.dashboard.scoreHistoryDiv.querySelector('tbody');
    } else {
        tbody = historyTable.querySelector('tbody');
        if (!tbody) {
            tbody = document.createElement('tbody');
            historyTable.appendChild(tbody);
        }
        tbody.innerHTML = '';
    }

    dom.dashboard.clearHistoryBtn.classList.toggle('hidden', state.localHistory.length === 0);

    const filterValue = dom.dashboard.historyFilterSelect.value;
    const filteredHistory = state.localHistory.filter(item => filterValue === 'all' || item.quizId === filterValue);

    if (filteredHistory.length === 0) {
        let message = filterValue === 'all' ? 'Aucun historique local.' : `Aucun historique pour ce quiz.`;
        if (state.localHistory.length > 0 && filterValue !== 'all') message += ' (Essayez "Tous les Quiz")';
        const row = tbody.insertRow();
        row.innerHTML = `<td colspan="6" style="text-align: center; font-style: italic; padding: 20px;">${message}</td>`;
    } else {
        filteredHistory.sort((a, b) => new Date(b.date) - new Date(a.date)); // Already sorted on import/save? Maybe re-sort anyway.

        filteredHistory.forEach(item => {
            const itemDate = new Date(item.date);
            const formattedDate = itemDate.toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' });
            const quizInfo = state.quizLibrary.find(q => q.quizId === item.quizId);
            const quizTitle = quizInfo?.title || item.quizTitle || `Quiz ID: ${item.quizId || '?'}`;
            const row = tbody.insertRow();
            row.innerHTML = `
                <td>${formattedDate}</td>
                <td>${quizTitle}</td>
                <td>${item.score || '?'}</td>
                <td>${item.points ?? '?'}</td>
                <td>${item.timeTaken || '?'}</td>
                <td>${item.mode || '?'}</td>
            `;
        });
    }
}

// Re-export functions needed by other modules if they aren't directly imported there
export { renderQuizLibrary, populateHistoryFilter } from './library.js';
export { renderSettingsScreen } from './settings.js';

// --- Event Listeners Setup ---
function setupEventListeners() {
    // Dashboard
    dom.dashboard.fileInput.addEventListener('change', importExport.handleFileImport);
    dom.dashboard.fileInputLabelContainer.addEventListener('dragover', importExport.handleDragOver);
    dom.dashboard.fileInputLabelContainer.addEventListener('dragleave', importExport.handleDragLeave);
    dom.dashboard.fileInputLabelContainer.addEventListener('drop', importExport.handleDrop);
    dom.dashboard.importUrlBtn.addEventListener('click', importExport.handleUrlImport);
    dom.dashboard.configRadioButtons.forEach(radio => radio.addEventListener('change', quizEngine.handleConfigChange));
    dom.dashboard.allowNavigationCheckbox.addEventListener('change', quizEngine.handleConfigChange);
    dom.dashboard.instantFeedbackCheckbox.addEventListener('change', quizEngine.handleConfigChange);
    dom.dashboard.showExplOnIncorrectCheckbox.addEventListener('change', quizEngine.handleConfigChange);
    dom.dashboard.errorSessionsCountInput.addEventListener('input', quizEngine.handleConfigChange); // Or just trigger update
    dom.dashboard.startQuizBtn.addEventListener('click', () => {
        quizEngine.startQuiz(); // Calls quizEngine to start
        if (state.isQuizActive) { // Only switch screen if quiz actually started
            showScreenAndRender('quiz');
        }
    });
    dom.dashboard.historyFilterSelect.addEventListener('change', displayScoreHistory); // Re-render history on filter change
    dom.dashboard.clearHistoryBtn.addEventListener('click', handleClearHistory);
    // Quiz Library item listeners are added dynamically in library.renderQuizLibrary

    // Quiz Screen
    dom.quiz.cancelQuizBtn.addEventListener('click', () => {
        quizEngine.handleCancelQuiz(); // Logic is in quizEngine
        // handleCancelQuiz should call showScreen itself or main should handle the screen change after state update
        if (!state.isQuizActive) { // Check state after cancel attempt
            showScreenAndRender('dashboard');
        }
    });
    dom.quiz.finishQuizBtn.addEventListener('click', () => {
        results.showResults(); // Logic is in results module
        showScreenAndRender('results'); // Switch screen after logic runs
    });
    dom.quiz.fullscreenToggleBtn.addEventListener('click', ui.toggleFullScreen);
    document.addEventListener('fullscreenchange', ui.updateFullscreenButton);
    document.addEventListener('webkitfullscreenchange', ui.updateFullscreenButton);
    document.addEventListener('mozfullscreenchange', ui.updateFullscreenButton);
    document.addEventListener('MSFullscreenChange', ui.updateFullscreenButton);

    // --- Listeners pour l'écran Review ---
    dom.review.searchInput.addEventListener('input', review.handleReviewSearch);
    dom.review.backToDashboardBtn.addEventListener('click', review.handleReviewBackToDashboard);

    // --- NOUVEL ÉCOUTEUR DÉLÉGUÉ POUR LE CONTENU DU QUIZ ---
    dom.quiz.contentArea.addEventListener('click', (event) => {
        // Appeler handleAnswerSelection si le clic provient du contentArea
        // handleAnswerSelection vérifiera ensuite la cible exacte (option, bouton valider, etc.)
        if (state.isQuizActive) { // Vérifier si le quiz est actif avant de traiter
            quizEngine.handleAnswerSelection(event);
        }
    });

    // --- Ajouter l'écouteur pour fermer l'overlay settings en cliquant sur le fond ---
    const settingsOverlayBg = document.querySelector('#settings-screen .settings-overlay-background');
    if (settingsOverlayBg) {
        settingsOverlayBg.addEventListener('click', () => {
            dom.screens.settings.classList.remove('visible');
            dom.screens.settings.classList.add('hidden');
            // Remettre l'icône du bouton à "fermée"
            if (dom.dynamic.settingsButton) {
                dom.dynamic.settingsButton.innerHTML = '⚙️';
                dom.dynamic.settingsButton.title = "Ouvrir Paramètres";
            }
        });
    }

    // Results Screen
    dom.results.restartQuizBtn.addEventListener('click', () => {
        results.handleRestartQuiz();
        if (state.isQuizActive) showScreenAndRender('quiz');
    });
    dom.results.restartErrorsBtn.addEventListener('click', () => {
        results.handleRestartErrors();
        if (state.isQuizActive) showScreenAndRender('quiz');
    });
    dom.results.newConfigBtn.addEventListener('click', () => {
        results.handleNewConfig(); // Logic in results module
        showScreenAndRender('dashboard'); // Always go back to dashboard
    });
    dom.results.exportSessionBtn.addEventListener('click', importExport.handleExportSession);
    dom.results.backToDashboardBtn.addEventListener('click', () => showScreenAndRender('dashboard'));
    dom.results.detailedResultsFiltersDiv.addEventListener('click', results.handleFilterResults); // Delegate filter clicks
    // Mark buttons listeners added dynamically in results.displayDetailedResults

    document.addEventListener('keydown', handleGlobalKeyDown);

    // Settings Screen (Listeners setup within settings.js)
    settings.setupSettingsScreen(); // Call setup for settings listeners

    console.log("Event listeners setup complete.");
}

// --- Specific Handlers Residing in Main ---
function handleClearHistory() {
    if (confirm("Êtes-vous sûr de vouloir effacer TOUT votre historique local ? Action irréversible.")) {
        storage.clearLocalHistory();
        stats.recalculateLocalStats(); // Recalculate stats after clearing history
        ui.showToast("Historique local effacé.", "success");
        displayScoreHistory(); // Refresh display
        library.populateHistoryFilter(); // Refresh filter dropdown
        quizEngine.updateErrorModeAvailability(); // Update config option availability
        // If settings screen is currently visible, re-render it
        if (dom.screens.settings.classList.contains('active')) {
            settings.renderSettingsScreen();
        }
    }
}

function handleGlobalKeyDown(event) {
    // --- Gérer Echap pour fermer Settings ---
    if (event.key === 'Escape') {
        const settingsScreen = dom.screens.settings;
        if (settingsScreen.classList.contains('visible')) {
            event.preventDefault(); // Empêche d'autres actions Echap par défaut
            settingsScreen.classList.remove('visible');
            // Remettre l'icône du bouton à "fermée"
            if (dom.dynamic.settingsButton) {
                dom.dynamic.settingsButton.innerHTML = '⚙️';
                dom.dynamic.settingsButton.title = "Ouvrir Paramètres";
            }
            console.log("Settings overlay closed via Escape key.");
            return; // Arrêter le traitement si on a fermé les settings
        }
    }
    // --- Fin gestion Echap ---
    // Ne rien faire si le quiz n'est pas actif ou si l'écran n'est pas le quiz
    if (!state.isQuizActive || !dom.screens.quiz.classList.contains('active')) {
        return;
    }

    const activeElement = document.activeElement;
    const isInputFocused = activeElement && (activeElement.tagName === 'INPUT' || activeElement.tagName === 'TEXTAREA');

    // --- RACCOURCI VALIDATION (Entrée / Espace) ---
    // Autorisé même si focus sur input[type=text] pour valider la réponse texte_libre
    if (event.key === 'Enter' || event.key === ' ') {
        // Si c'est Entrée ET le focus est sur un input texte, la validation est déjà gérée
        // par l'écouteur interne de l'input dans questionRenderer. Ne pas doubler.
        if (event.key === 'Enter' && activeElement?.type === 'text') {
            console.log("Enter on text input handled by input listener.");
            return;
        }

        // Si Espace et focus sur input/textarea, ignorer (sauf si on veut le permettre ?)
        if (event.key === ' ' && isInputFocused) {
            console.log("Space ignored in input/textarea.");
            return;
        }

        event.preventDefault(); // Empêche Espace de défiler, Entrée de potentiellement soumettre un formulaire (si existant)

        const currentQuestionBlock = dom.quiz.contentArea.querySelector(`.question-block[data-index="${state.currentQuestionIndex}"]`);
        if (currentQuestionBlock) {
            const validateButton = currentQuestionBlock.querySelector('.universal-validate-btn');
            if (validateButton && !validateButton.disabled) {
                console.log(`Key '${event.key}' pressed, simulating validate button click for index:`, state.currentQuestionIndex);
                validateButton.click(); // Déclenche handleAnswerSelection
            } else {
                console.warn(`Key '${event.key}' pressed, but validate button not found or disabled.`);
            }
        } else {
            console.warn(`Key '${event.key}' pressed, but current question block not found.`);
        }
        return; // Validation traitée, on arrête ici
    }

    // --- AUTRES RACCOURCIS (bloqués si focus sur input/textarea) ---
    if (isInputFocused) {
        // console.log("Other shortcuts blocked due to input focus.");
        return;
    }

    // --- RACCOURCI MARQUAGE (M) ---
    if (event.key === 'm' || event.key === 'M') {
        event.preventDefault();
        const currentQuestionBlock = dom.quiz.contentArea.querySelector(`.question-block[data-index="${state.currentQuestionIndex}"]`);
        if (currentQuestionBlock) {
            const markButton = currentQuestionBlock.querySelector('.mark-question-btn');
            if (markButton) {
                console.log("'M' key pressed, simulating mark button click.");
                markButton.click(); // Déclenche handleMarkQuestion
            }
        }
        return; // Marquage traité
    }

    // --- RACCOURCIS NAVIGATION (Flèches Gauche/Droite) ---
    // Utile principalement si navigation autorisée ET feedback OFF (où il n'y a pas d'avance auto)
    // Ou si on veut forcer la navigation même avec feedback ON (peut être déroutant?)
    // Condition: Autoriser la navigation OU être en mode feedback instantané (où on peut vouloir naviguer après)
    if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') {
        event.preventDefault();
        const direction = (event.key === 'ArrowRight') ? 1 : -1;
        const targetIndex = state.currentQuestionIndex + direction;

        // Vérifier si la cible est valide
        if (targetIndex >= 0 && targetIndex < state.questionsToAsk.length) {
            // Naviguer visuellement est toujours permis
            console.log(`Arrow key '${event.key}' pressed, displaying index:`, targetIndex);
            quizEngine.displayQuestion(targetIndex); // Affiche la question cible
            // La logique dans displayQuestion gérera l'activation/désactivation des inputs
            // en fonction de allowNavBack et si la question a déjà été répondue.

        } else {
            console.log("Arrow key navigation blocked (reached beginning/end).");

            if (event.key === 'ArrowRight' && state.currentQuestionIndex === state.questionsToAsk.length - 1) {
                // Vérifier si toutes les questions ont une réponse (ne sont pas null)
                const allAnswered = state.userAnswers.every(answer => answer !== null && answer.answer !== null); // Vérifie si une réponse a été enregistrée
                const finishButton = dom.quiz.finishQuizBtn;

                if (allAnswered && !finishButton.classList.contains('hidden')) {
                    console.log("ArrowRight on last question AND all answered, clicking Finish button.");
                    finishButton.click();
                } else if (!allAnswered) {
                    console.log("ArrowRight on last question, but not all questions answered yet.");
                    ui.showToast("Veuillez répondre à toutes les questions avant de terminer.", "warning");
                }
            }
        }
        return; // Navigation traitée
    }

    // --- RACCOURCIS SÉLECTION QCM/VRAI_FAUX (Touches 1, 2, 3...) ---
    if (/^[1-9]$/.test(event.key)) {
        event.preventDefault();
        const choiceIndex = parseInt(event.key, 10) - 1;

        const currentQuestionBlock = dom.quiz.contentArea.querySelector(`.question-block[data-index="${state.currentQuestionIndex}"]`);
        if (currentQuestionBlock) {
            // Ou si allowNavBack est activé (car l'utilisateur peut vouloir changer)
            const currentAnswerEntry = state.userAnswers[state.currentQuestionIndex];
            if (currentAnswerEntry && currentAnswerEntry.answer === null || state.currentQuizConfig.allowNavBack) {
                const questionType = state.questionsToAsk[state.currentQuestionIndex]?.type;

                if (questionType === 'qcm' || questionType === 'vrai_faux') {
                    const optionsButtons = currentQuestionBlock.querySelectorAll('.answer-options button.answer-btn');
                    if (choiceIndex < optionsButtons.length && !optionsButtons[choiceIndex].disabled) { // Vérifier si option non désactivée
                        console.log(`Number key '${event.key}' pressed, selecting QCM option index:`, choiceIndex);
                        optionsButtons[choiceIndex].click(); // Déclenche handleAnswerSelection pour la sélection UI
                    }
                } else if (questionType === 'qcm_multi') {
                    const optionsCheckboxes = currentQuestionBlock.querySelectorAll('.answer-options input[type="checkbox"]');
                    if (choiceIndex < optionsCheckboxes.length && !optionsCheckboxes[choiceIndex].disabled) { // Vérifier si option non désactivée
                        console.log(`Number key '${event.key}' pressed, toggling QCM-Multi option index:`, choiceIndex);
                        const targetCheckbox = optionsCheckboxes[choiceIndex];
                        targetCheckbox.checked = !targetCheckbox.checked;
                    }
                }
            } else {
                console.log(`Number key '${event.key}' ignored: Question already answered or nav back disabled.`);
            }
        }
        return; // Sélection traitée
    }

}


// --- Start the application ---
document.addEventListener('DOMContentLoaded', init);
