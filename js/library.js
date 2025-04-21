import * as dom from './dom.js';
import { state, resetQuizState, resetSelectionState, setActiveQuizContent } from './state.js';
import { loadQuizContent, saveQuizLibrary, deleteQuizContent, saveLastConfig, loadLastConfig, saveQuizContent } from './storage.js';
import { showToast, clearDashboardMessages, displayDashboardMessage } from './ui.js';
import { resetConfigOptions, updateErrorModeAvailability, handleConfigChange } from './quizEngine.js'; // Need these for selection logic

export function renderQuizLibrary() {
    dom.dashboard.quizLibraryDiv.innerHTML = ''; // Clear existing
    if (state.quizLibrary.length === 0) {
        dom.dashboard.quizLibraryDiv.innerHTML = '<p>Aucun quiz dans la bibliothèque. Importez-en un !</p>';
        return;
    }
    state.quizLibrary.forEach(quizMeta => {
        const item = document.createElement('div');
        item.classList.add('quiz-library-item');
        item.dataset.quizId = quizMeta.quizId;
        item.innerHTML = `
            <span class="quiz-title">${quizMeta.title || 'Quiz sans titre'}</span>
            <span class="quiz-source">${quizMeta.source || 'inconnu'}</span>
            <button class="delete-quiz-btn" title="Supprimer de la bibliothèque">✖</button>
        `;
        if (quizMeta.quizId === state.selectedQuizId) {
            item.classList.add('selected');
        }
        item.addEventListener('click', (e) => {
            if (!e.target.classList.contains('delete-quiz-btn')) {
                handleQuizSelection(quizMeta.quizId);
            }
        });
        item.querySelector('.delete-quiz-btn').addEventListener('click', (e) => {
            e.stopPropagation();
            handleDeleteQuiz(quizMeta.quizId, quizMeta.title);
        });
        dom.dashboard.quizLibraryDiv.appendChild(item);
    });
    // Ensure config options are hidden if nothing is selected
    dom.dashboard.configOptionsDiv.classList.toggle('hidden', !state.selectedQuizId);
}

export function handleQuizSelection(quizId) {
    if (state.selectedQuizId === quizId && state.activeQuizContent) return; // No change

    console.log("Selecting quiz:", quizId);
    const quizContent = loadQuizContent(quizId);

    if (!quizContent) {
        showToast(`Erreur: Contenu du quiz '${quizId}' introuvable.`, 'error');
        resetSelectionState();
        renderQuizLibrary(); // Update deselection highlight
        dom.dashboard.configOptionsDiv.classList.add('hidden'); // Hide config
        return;
    }

    setActiveQuizContent(quizId, quizContent);
    loadLastConfig(); // Load last config for this quiz selection

    clearDashboardMessages();
    displayDashboardMessage(dom.dashboard.fileSuccessMsg, `Quiz "${state.activeQuizContent.quizTitle || 'Sans Titre'}" sélectionné.`, false);

    renderQuizLibrary(); // Update selection highlight
    dom.dashboard.configOptionsDiv.classList.remove('hidden'); // Show config
    dom.dashboard.startQuizBtn.disabled = false;
    resetConfigOptions(true); // Reset and prefill config options
    updateErrorModeAvailability(); // Check if error mode is available
}

export function handleDeleteQuiz(quizId, quizTitle) {
    if (confirm(`Voulez-vous vraiment supprimer le quiz "${quizTitle || 'ce quiz'}" de votre bibliothèque locale ? (L'historique associé NE sera PAS supprimé).`)) {
        state.quizLibrary = state.quizLibrary.filter(q => q.quizId !== quizId);
        saveQuizLibrary();
        deleteQuizContent(quizId);

        if (state.selectedQuizId === quizId) {
            resetSelectionState();
            dom.dashboard.configOptionsDiv.classList.add('hidden');
            clearDashboardMessages();
        }
        renderQuizLibrary();
        populateHistoryFilter(); // Update history dropdown
        updateErrorModeAvailability(); // Re-check error mode
        showToast(`Quiz "${quizTitle || ''}" supprimé de la bibliothèque.`, "info");
    }
}

export function addQuizToLibrary(quizContent, sourceInfo) {
    if (!quizContent || !quizContent.quizId) {
        console.error("Attempting to add quiz without ID or invalid content.");
        return false;
    }
    const quizId = quizContent.quizId;
    const existingIndex = state.quizLibrary.findIndex(q => q.quizId === quizId);

    const newMeta = {
        quizId: quizId,
        title: quizContent.quizTitle || `Quiz ${quizId}`,
        source: sourceInfo.source,
        filename: sourceInfo.filename, // only if source is 'local'
        url: sourceInfo.url,         // only if source is 'url'
        dateAdded: Date.now()
    };

    if (existingIndex > -1) {
        if (!confirm(`Un quiz avec l'ID "${quizId}" ("${state.quizLibrary[existingIndex].title}") existe déjà. Voulez-vous le remplacer ?`)) {
            showToast("Importation annulée.", "info");
            return false;
        }
        state.quizLibrary[existingIndex] = newMeta;
        console.log(`Quiz ${quizId} metadata overwritten.`);
    } else {
        state.quizLibrary.push(newMeta);
        console.log(`Quiz ${quizId} metadata added.`);
    }

    saveQuizContent(quizId, quizContent);
    saveQuizLibrary();
    renderQuizLibrary();
    populateHistoryFilter(); // Update history filter options
    return true;
}


// --- History Filter Population --- (Often needed alongside library updates)
export function populateHistoryFilter() {
    const uniqueQuizIdsInHistory = [...new Set(state.localHistory.map(item => item.quizId))];
    const uniqueQuizzes = uniqueQuizIdsInHistory
        .map(id => state.quizLibrary.find(q => q.quizId === id))
        .filter(Boolean) // Remove entries where quiz is no longer in library
        .sort((a, b) => (a.title || '').localeCompare(b.title || ''));

    const currentFilter = dom.dashboard.historyFilterSelect.value;
    dom.dashboard.historyFilterSelect.innerHTML = '<option value="all">Tous les Quiz</option>';
    uniqueQuizzes.forEach(quiz => {
        const option = document.createElement('option');
        option.value = quiz.quizId;
        option.textContent = quiz.title || `Quiz ID: ${quiz.quizId}`;
        dom.dashboard.historyFilterSelect.appendChild(option);
    });

    // Try to restore selection
    if (uniqueQuizzes.some(q => q.quizId === currentFilter)) {
        dom.dashboard.historyFilterSelect.value = currentFilter;
    } else {
        dom.dashboard.historyFilterSelect.value = 'all'; // Default to 'all' if previous selection is gone
    }
}