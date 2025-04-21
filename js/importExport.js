import * as dom from './dom.js';
import { state } from './state.js';
import { addQuizToLibrary, populateHistoryFilter } from './library.js';
import { validateQuizData } from './validation.js';
import { showLoader, hideLoader, showToast, displayDashboardMessage, clearDashboardMessages, applyTheme } from './ui.js';
import { saveQuizContent, saveUserPreferences, saveQuizLibrary, saveLocalHistory, saveLocalStats, loadUserPreferences, loadLocalStats, loadQuizContent } from './storage.js';
import { DEFAULT_QUIZ_URLS } from './config.js';
import { renderQuizLibrary, renderSettingsScreen, displayScoreHistory } from './main.js'; // Import necessary render functions from main

// --- File/URL Import ---
export function handleFileImport(event) {
    const file = event.target.files[0];
    if (file) {
        processQuizFile(file);
    }
    dom.dashboard.fileInput.value = ''; // Reset input
}

export function handleDragOver(event) {
    event.preventDefault();
    dom.dashboard.fileInputLabelContainer.classList.add('drag-over');
    dom.dashboard.dragDropOverlay.style.opacity = '1'; // Show overlay text
}

export function handleDragLeave(event) {
    event.preventDefault();
    // Only remove class if not leaving to a child element
    if (!dom.dashboard.fileInputLabelContainer.contains(event.relatedTarget)) {
        dom.dashboard.fileInputLabelContainer.classList.remove('drag-over');
        dom.dashboard.dragDropOverlay.style.opacity = '0'; // Hide overlay text
    }
}

export function handleDrop(event) {
    event.preventDefault();
    dom.dashboard.fileInputLabelContainer.classList.remove('drag-over');
    dom.dashboard.dragDropOverlay.style.opacity = '0';
    const file = event.dataTransfer?.files[0];
    if (file && file.name.endsWith('.json')) {
        processQuizFile(file);
    } else {
        clearDashboardMessages();
        displayDashboardMessage(dom.dashboard.fileErrorMsg, "Veuillez déposer un fichier .json valide.");
    }
}

export function handleUrlImport() {
    const url = dom.dashboard.urlInput.value.trim();
    if (!url) {
        displayDashboardMessage(dom.dashboard.fileErrorMsg, "Veuillez entrer une URL valide.");
        return;
    }
    try {
        new URL(url); // Basic validation
    } catch (_) {
        displayDashboardMessage(dom.dashboard.fileErrorMsg, "L'URL fournie n'est pas valide.");
        return;
    }
    clearDashboardMessages();
    fetchQuizFromUrl(url);
    dom.dashboard.urlInput.value = '';
}

async function fetchQuizFromUrl(url) {
    showLoader();
    dom.dashboard.fileInputLabel.textContent = "Chargement depuis URL...";
    try {
        // Use a CORS proxy if direct fetch fails (example using cors-anywhere, replace with your own if needed)
        // const proxyUrl = 'https://cors-anywhere.herokuapp.com/';
        // const response = await fetch(proxyUrl + url);
        const response = await fetch(url, { mode: 'cors' }); // Try direct fetch first

        if (!response.ok) {
            // Try with proxy as fallback if direct fails (e.g., due to CORS)
            console.warn(`Direct fetch failed for ${url} (${response.status}). Trying CORS proxy...`);
            const proxyUrl = 'https://corsproxy.io/?'; // Example public proxy
            const proxyResponse = await fetch(proxyUrl + encodeURIComponent(url));
            if (!proxyResponse.ok) {
                throw new Error(`Erreur réseau (direct & proxy): ${response.status} / ${proxyResponse.status}`);
            }
            // If proxy worked, use its content
            const jsonContent = await proxyResponse.json();
            processQuizJson(jsonContent, { source: 'url', url: url });
            return; // Exit after successful proxy fetch
        }

        // If direct fetch was okay
        const jsonContent = await response.json();
        processQuizJson(jsonContent, { source: 'url', url: url });

    } catch (error) {
        console.error("Fetch URL Error:", error);
        clearDashboardMessages();
        // More specific error messages
        let userMessage = `Erreur importation URL: ${error.message}`;
        if (error.message.includes('Failed to fetch') || error.message.includes('NetworkError')) {
            userMessage += ". Vérifiez la connexion ou si l'URL nécessite un proxy CORS.";
        } else if (error instanceof SyntaxError) {
            userMessage = "Erreur importation URL: La réponse n'était pas un JSON valide.";
        }
        displayDashboardMessage(dom.dashboard.fileErrorMsg, userMessage);
    } finally {
        dom.dashboard.fileInputLabel.textContent = "Choisir un fichier ou glisser-déposer ici...";
        hideLoader();
    }
}


function processQuizFile(file) {
    clearDashboardMessages();
    dom.dashboard.fileInputLabel.textContent = `Lecture de ${file.name}...`;
    showLoader();
    const reader = new FileReader();
    reader.onload = (e) => {
        processQuizJson(e.target.result, { source: 'local', filename: file.name });
    };
    reader.onerror = () => {
        hideLoader();
        clearDashboardMessages();
        displayDashboardMessage(dom.dashboard.fileErrorMsg, "Erreur de lecture du fichier.");
        dom.dashboard.fileInputLabel.textContent = "Choisir un fichier ou glisser-déposer ici...";
    };
    reader.readAsText(file);
}

function processQuizJson(jsonStringOrObject, sourceInfo) {
    try {
        const jsonData = (typeof jsonStringOrObject === 'string') ? JSON.parse(jsonStringOrObject) : jsonStringOrObject;

        if (validateQuizData(jsonData)) { // validateQuizData throws error if invalid
            const added = addQuizToLibrary(jsonData, sourceInfo);
            if (added) {
                const title = jsonData.quizTitle || `Quiz ${jsonData.quizId}`;
                clearDashboardMessages();
                displayDashboardMessage(dom.dashboard.fileSuccessMsg, `Quiz "${title}" importé/mis à jour ! Sélectionnez-le.`, false);
            }
        }
    } catch (error) {
        console.error("JSON Processing/Validation Error:", error);
        clearDashboardMessages();
        displayDashboardMessage(dom.dashboard.fileErrorMsg, `Erreur JSON: ${error.message}`);
    } finally {
        dom.dashboard.fileInputLabel.textContent = "Choisir un fichier ou glisser-déposer ici...";
        hideLoader();
    }
}


// --- Initial Default Quiz Import ---
export async function importDefaultQuizzes() {
    if (DEFAULT_QUIZ_URLS.length === 0) return;

    console.log("Checking for default quizzes to import...");
    let importNeededCount = 0;
    const importPromises = [];

    for (const url of DEFAULT_QUIZ_URLS) {
        const alreadyExists = state.quizLibrary.some(quiz => quiz.source === 'url' && quiz.url === url);
        if (!alreadyExists) {
            importNeededCount++;
            console.log(`Default quiz URL not found locally, attempting import: ${url}`);
            // Don't await here, let them run in parallel
            importPromises.push(fetchQuizFromUrl(url).catch(err => {
                console.warn(`Initial import failed for ${url}.`); // Error handled in fetchQuizFromUrl
            }));
        } else {
            console.log(`Default quiz URL already in library: ${url}`);
        }
    }

    if (importNeededCount > 0) {
        showToast(`Tentative d'importation de ${importNeededCount} quiz par défaut...`, 'info', 2500);
        // Optionally wait for all imports before potentially re-rendering something
        // await Promise.all(importPromises);
        // console.log("Default quiz import process finished.");
        // Maybe refresh library view here if needed after all attempts
    }
}


// --- Data Import/Export ---
export function handleExportData() {
    if (!confirm("Exporter toutes vos données locales (bibliothèque, historique, statistiques, préférences) ?")) return;
    showLoader();
    try {
        // Load potentially unsaved quiz content before export
        const quizContentsToExport = {};
        state.quizLibrary.forEach(meta => {
            const content = loadQuizContent(meta.quizId);
            if (content) {
                quizContentsToExport[meta.quizId] = content;
            }
        });

        const dataToExport = {
            version: "1.1-local", // Increment version if format changes
            exportDate: new Date().toISOString(),
            preferences: state.userPreferences,
            quizLibrary: state.quizLibrary,
            quizContents: quizContentsToExport, // Include content
            history: state.localHistory,
            stats: state.localStats,
        };
        const blob = new Blob([JSON.stringify(dataToExport, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `QuizMaster_Local_Backup_${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(a); a.click(); document.body.removeChild(a);
        URL.revokeObjectURL(url);
        showToast("Données locales exportées avec succès.", "success");
    } catch (error) {
        console.error("Export failed:", error);
        showToast(`Erreur d'exportation: ${error.message}`, "error");
    } finally {
        hideLoader();
    }
}

export function handleImportData() {
    if (!confirm("ATTENTION : L'importation fusionnera les données du fichier avec vos données locales (la bibliothèque et l'historique seront fusionnés, les quiz existants avec le même ID ne seront PAS écrasés par défaut, les statistiques et préférences seront remplacées). Sauvegardez vos données actuelles (Export) avant d'importer si nécessaire. Continuer ?")) return;

    const importFileInput = document.createElement('input');
    importFileInput.type = 'file'; importFileInput.accept = '.json';
    importFileInput.onchange = (e) => {
        const file = e.target.files[0];
        if (!file) return;
        showLoader();
        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                const importData = JSON.parse(event.target.result);
                // Basic validation
                if (!importData || typeof importData !== 'object' || !importData.version || !importData.quizLibrary || !importData.history || !importData.preferences || !importData.stats) {
                    throw new Error("Format de fichier d'importation invalide ou incomplet.");
                }
                console.log(`Importing data format version: ${importData.version}`);

                // --- Perform Merge/Overwrite ---
                // Preferences: Overwrite completely
                state.userPreferences = { ...loadUserPreferences(), ...importData.preferences }; // Ensure all default keys exist
                applyTheme(state.userPreferences.theme);

                // Library: Merge, avoid duplicates by quizId
                const currentLibraryIds = new Set(state.quizLibrary.map(q => q.quizId));
                importData.quizLibrary.forEach(importedQuizMeta => {
                    if (!currentLibraryIds.has(importedQuizMeta.quizId)) {
                        state.quizLibrary.push(importedQuizMeta);
                        // Import content if it exists in the file
                        if (importData.quizContents && importData.quizContents[importedQuizMeta.quizId]) {
                            // Validate imported content before saving? Optional but safer.
                            try {
                                if (validateQuizData(importData.quizContents[importedQuizMeta.quizId])) {
                                    saveQuizContent(importedQuizMeta.quizId, importData.quizContents[importedQuizMeta.quizId]);
                                }
                            } catch (validationError) {
                                console.warn(`Contenu du quiz importé ${importedQuizMeta.quizId} invalide, non sauvegardé: ${validationError.message}`);
                            }
                        } else {
                            console.warn(`Contenu du quiz ${importedQuizMeta.quizId} manquant dans le fichier d'importation.`);
                        }
                    } else {
                        console.log(`Skipping import of quiz metadata ${importedQuizMeta.quizId} - ID exists.`);
                    }
                });

                // History: Merge, avoid duplicates by attemptId
                const currentHistoryIds = new Set(state.localHistory.map(a => a.attemptId).filter(Boolean));
                let addedHistoryCount = 0;
                importData.history.forEach(importedAttempt => {
                    // Ensure attemptId is present and unique before adding
                    if (importedAttempt.attemptId && !currentHistoryIds.has(importedAttempt.attemptId)) {
                        state.localHistory.push(importedAttempt);
                        addedHistoryCount++;
                    }
                });
                console.log(`Added ${addedHistoryCount} new history entries.`);
                // Sort history after merge by date
                state.localHistory.sort((a, b) => new Date(b.date) - new Date(a.date));

                // Stats: Overwrite completely
                state.localStats = { ...loadLocalStats(), ...importData.stats }; // Ensure all default keys exist

                // --- Save Merged Data ---
                saveUserPreferences();
                saveQuizLibrary();
                saveLocalHistory();
                saveLocalStats();

                showToast("Données importées et fusionnées avec succès ! Rafraîchissement...", "success");

                // Refresh UI - Use functions imported likely from main.js or specific modules
                renderQuizLibrary(); // Needs to be exported from library.js or main.js
                displayScoreHistory(); // Needs export
                populateHistoryFilter(); // Needs export
                renderSettingsScreen(); // Needs export
                hideLoader();
                // showScreen('dashboard'); // Handled by calling function (e.g., in main.js)

            } catch (error) {
                console.error("Import failed:", error);
                showToast(`Erreur d'importation: ${error.message}`, "error");
                hideLoader();
            }
        };
        reader.onerror = () => { hideLoader(); showToast("Erreur de lecture du fichier.", "error"); };
        reader.readAsText(file);
    };
    importFileInput.click();
}

// --- Session Export ---
export function handleExportSession() {
    if (!state.currentQuizConfig.quizId || state.userAnswers.length === 0) {
        showToast("Aucune donnée de session à exporter.", "warning"); return;
    }

    let content = `Quiz Master - Résumé de Session\n`;
    content += `-------------------------------------\n`;
    content += `Quiz: ${state.currentQuizConfig.quizTitle} (ID: ${state.currentQuizConfig.quizId})\n`;
    content += `Date: ${new Date(state.startTime).toLocaleString('fr-FR')}\n`;
    content += `Mode: ${state.currentQuizConfig.mode}\n`;
    content += `Score: ${state.score} / ${state.questionsToAsk.length}\n`;
    content += `Points: ${state.totalPoints}\n`;
    // Get accuracy text directly from element as it's already calculated
    const accuracyText = dom.results.accuracyDisplay.textContent.split(': ')[1] || 'N/A';
    content += `Précision: ${accuracyText}\n`;
    const timeText = dom.results.timeTakenDisplay.textContent.split(': ')[1] || 'N/A';
    content += `Temps: ${timeText}\n`;
    content += `Série Max: ${state.maxStreak}\n`;
    content += `-------------------------------------\n\n`;
    content += `Détail des Réponses:\n\n`;

    state.questionsToAsk.forEach((q, index) => {
        const ans = state.userAnswers[index];
        content += `Q${index + 1}: (${ans?.isCorrect ? 'Correct' : (ans?.answer === null ? 'Non Répondu' : 'Incorrect')}) ${ans?.marked ? '[⭐]' : ''}\n`;
        content += `   Question: ${q.text.replace(/\n/g, '\n             ')}\n`; // Indent multi-line questions
        if (ans?.answer !== null) {
            content += `   Votre Réponse: ${formatAnswerForTextExport(ans?.answer, q.type)}\n`;
        }
        if (!ans?.isCorrect) {
            content += `   Bonne Réponse: ${formatAnswerForTextExport(q.correctAnswer, q.type)}\n`;
        }
        content += `   Explication: ${q.explanation ? q.explanation.replace(/\n/g, '\n                ') : '-'}\n\n`; // Indent explanations
    });

    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `QuizMaster_Session_${state.currentQuizConfig.quizId}_${new Date(state.startTime).toISOString().split('T')[0]}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast("Résumé de session exporté.", "success");
}

/** Helper to format answers for plain text export */
function formatAnswerForTextExport(answerValue, questionType) {
    if (answerValue === null || answerValue === undefined) return 'N/A';
    if (questionType === 'vrai_faux') return answerValue ? 'Vrai' : 'Faux';
    if (Array.isArray(answerValue)) return answerValue.map(String).join(questionType === 'ordre' ? ' -> ' : ', ');
    if (questionType === 'association' && typeof answerValue === 'object') {
        return Object.entries(answerValue).map(([key, value]) => `${key} -> ${value}`).join('; ');
    }
    return String(answerValue);
}
