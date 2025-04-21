import * as dom from './dom.js';
import { state, resetQuizState, resetSelectionState, setQuizActive } from './state.js';
import * as storage from './storage.js';
import * as ui from './ui.js';
import * as library from './library.js';
import * as importExport from './importExport.js';
import * as quizEngine from './quizEngine.js';
import * as results from './results.js';
import * as settings from './settings.js';
import * as stats from './stats.js';

// --- Initialization ---
function init() {
    console.log("Quiz Master (Local Version) Initializing...");
    ui.showLoader(); // Show loader during init

    // Load all necessary data from storage into state
    storage.loadUserPreferences();
    storage.loadQuizLibrary();
    storage.loadLocalHistory();
    storage.loadLocalStats();
    storage.loadLastConfig();

    // Apply initial settings
    ui.applyTheme(state.userPreferences.theme);

    // Import default quizzes if not present
    importExport.importDefaultQuizzes().then(() => {
        // Setup event listeners after potential initial imports
        setupEventListeners();

        // Create dynamic elements (like settings button)
        createDynamicElements();
        ui.updateSettingsButtonVisibility(); // Set initial visibility

        // Show initial screen and render its content
        showScreenAndRender('dashboard'); // Use combined function
        ui.hideLoader(); // Hide loader after initial setup
        console.log("Initialization Complete.");
    }).catch(error => {
        console.error("Error during initialization (default quiz import):", error);
        // Still try to finish init even if default import fails
        setupEventListeners();
        createDynamicElements();
        ui.updateSettingsButtonVisibility();
        showScreenAndRender('dashboard');
        ui.hideLoader();
    });


}

// --- Dynamic Element Creation ---
function createDynamicElements() {
    // Settings Button
    const button = document.createElement('button');
    button.id = 'dynamic-settings-btn';
    button.innerHTML = '⚙️'; // Icon only
    button.style.position = 'fixed';
    button.style.bottom = '15px';
    button.style.left = '15px';
    button.style.zIndex = '1010';
    button.classList.add('btn-secondary', 'btn-icon'); // Use existing styles
    button.title = "Paramètres & Statistiques";
    button.addEventListener('click', () => {
        if (!state.isQuizActive) { // Prevent opening during quiz
            showScreenAndRender('settings');
        }
    });
    document.body.appendChild(button);
    dom.dynamic.settingsButton = button; // Store reference in dom module
}


// --- Screen Switching and Rendering ---
function showScreenAndRender(screenId) {
    ui.showScreen(screenId); // Switch visibility first

    // Call specific render/setup functions based on the screen shown
    switch (screenId) {
        case 'dashboard':
            library.renderQuizLibrary();
            displayScoreHistory(); // Render history table
            library.populateHistoryFilter(); // Populate dropdown
            quizEngine.updateErrorModeAvailability(); // Update based on selection/history
            // Ensure config options visibility is correct based on selection state
            dom.dashboard.configOptionsDiv.classList.toggle('hidden', !state.selectedQuizId);
            if (state.selectedQuizId) {
                quizEngine.resetConfigOptions(true); // Prefill if quiz selected
            }
            break;
        case 'quiz':
            // Setup is done within startQuiz() before showing screen
            break;
        case 'results':
            // Rendering is done within results.showResults() before showing screen
            break;
        case 'settings':
            settings.renderSettingsScreen();
            break;
    }
    // Update settings button visibility after screen change
    ui.updateSettingsButtonVisibility();
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


// --- Start the application ---
document.addEventListener('DOMContentLoaded', init);
