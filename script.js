document.addEventListener('DOMContentLoaded', () => {
    const DEFAULT_QUIZ_URLS = [
        "https://raw.githubusercontent.com/101dal/questions/refs/heads/main/quiz/chapitre%203.json"
    ];

    // --- Constants ---
    const PRESETS = {
        'preset-short': { questions: 10 }, // Time limit handled separately if needed
        'preset-medium': { questions: 20 },
        'preset-long': { questions: 40 },
    };
    const LOCAL_STORAGE_KEYS = {
        PREFERENCES: 'quizMasterLocalPrefs',
        QUIZ_LIBRARY: 'quizMasterLocalLibrary', // Stores [{ quizId, title, source, filename/url, dateAdded }]
        QUIZ_CONTENT_PREFIX: 'quizMasterContent_', // quizMasterContent_{quizId} stores full JSON
        HISTORY: 'quizMasterLocalHistory',       // Stores array of attempt summaries
        STATS: 'quizMasterLocalStats',         // Stores aggregated stats object
        LAST_CONFIG: 'quizMasterLastConfig'       // Stores last used config options
    };
    const ADVANCE_DELAY = 350; // ms delay before auto-advancing (no feedback)
    const FEEDBACK_DELAY = 1200; // ms to show immediate feedback before advancing
    const TIME_WARNING_THRESHOLD = 60; // seconds remaining for timer warning
    const TIME_CRITICAL_THRESHOLD = 15; // seconds remaining for timer critical state

    // --- State Variables ---
    let userPreferences = {};
    let quizLibrary = []; // Array of quiz metadata objects
    let localHistory = []; // Array of quiz attempt summary objects
    let localStats = {};   // Object holding aggregated stats
    let lastConfig = {};   // Last used quiz configuration

    let selectedQuizId = null;      // ID of the quiz selected from the library
    let activeQuizContent = null;   // Full JSON content of the selected quiz
    let currentQuizConfig = {};   // Config for the *active* session { mode, numQuestions, timeLimit, allowNavBack, instantFeedback, showExpl, quizId, quizTitle }
    let questionsToAsk = [];      // Array of question objects for the current session
    let currentQuestionIndex = 0;
    let userAnswers = [];         // Array storing user's answers for the current session [{ questionId, answer, isCorrect, pointsEarned, timeTaken, marked }]
    let score = 0;                // Correct answers count for the current session
    let totalPoints = 0;          // Points score for the current session
    let currentStreak = 0;
    let maxStreak = 0;
    let timerInterval = null;
    let timeLeft = 0;             // in seconds
    let startTime = 0;            // Timestamp quiz started
    let questionStartTime = 0;    // Timestamp current question was displayed
    let quizEndTime = 0;          // Timestamp quiz ended
    let isQuizActive = false;
    let isSubmittingAnswer = false; // Prevent double clicks
    let isFullScreen = false;

    // Drag & Drop State (Ordering & Association)
    let draggedItem = null;       // Element being dragged (ordering/assoc-item)
    let placeholder = null;       // Placeholder element (ordering)
    let assocDraggedItemId = null; // ID of the item being dragged (association)
    let isDraggingFromTarget = false; // Flag for association dragging

    // --- DOM Elements ---
    const screens = {
        dashboard: document.getElementById('dashboard-screen'),
        quiz: document.getElementById('quiz-screen'),
        results: document.getElementById('results-screen'),
        settings: document.getElementById('settings-screen'),
    };
    const bodyElement = document.body;
    const globalLoader = document.getElementById('global-loader');
    const toastContainer = document.getElementById('toast-notifications');

    // Dashboard Screen
    const fileInput = document.getElementById('file-input');
    const fileInputLabel = document.querySelector('.file-input-label span');
    const fileInputLabelContainer = document.querySelector('.file-input-label');
    const dragDropOverlay = document.getElementById('drag-drop-overlay');
    const urlInput = document.getElementById('url-input');
    const importUrlBtn = document.getElementById('import-url-btn');
    const fileErrorMsg = document.getElementById('file-error');
    const fileSuccessMsg = document.getElementById('file-success');
    const quizLibraryDiv = document.getElementById('quiz-library');
    const configOptionsDiv = document.getElementById('config-options');
    const configRadioButtons = document.querySelectorAll('input[name="quiz-mode"]');
    const errorSessionsCountInput = document.getElementById('error-sessions-count');
    const customSettingsDiv = document.getElementById('custom-settings');
    const customTimeInput = document.getElementById('custom-time');
    const customQuestionsInput = document.getElementById('custom-questions');
    const allowNavigationCheckbox = document.getElementById('allow-navigation-checkbox');
    const instantFeedbackCheckbox = document.getElementById('instant-feedback-checkbox');
    const showExplOnIncorrectCheckbox = document.getElementById('show-expl-on-incorrect');
    const startQuizBtn = document.getElementById('start-quiz-btn');
    const scoreHistoryDiv = document.getElementById('score-history');
    const scoreHistoryControls = document.getElementById('score-history-controls');
    const historyFilterSelect = document.getElementById('history-filter');
    const clearHistoryBtn = document.getElementById('clear-history-btn');

    // Quiz Screen
    const quizHeader = document.getElementById('quiz-header');
    const quizTitleDisplay = document.getElementById('quiz-title-display');
    const fullscreenToggleBtn = document.getElementById('fullscreen-toggle-btn');
    const fullscreenExitIcon = document.getElementById('fullscreen-exit-icon');
    const questionCounterDisplay = document.getElementById('question-counter');
    const timerDisplay = document.getElementById('timer');
    const streakCounterDisplay = document.getElementById('streak-counter');
    const scoreDisplay = document.getElementById('score-display');
    const progressBar = document.getElementById('progress-bar');
    const questionGridNav = document.getElementById('question-grid-nav');
    const quizContentArea = document.getElementById('quiz-content-area');
    const finishQuizBtn = document.getElementById('finish-quiz-btn');
    const cancelQuizBtn = document.getElementById('cancel-quiz-btn');

    // Results Screen
    const resultsQuizTitle = document.getElementById('results-quiz-title');
    const scoreSummary = document.getElementById('score-summary');
    const timeTakenDisplay = document.getElementById('time-taken');
    const accuracyDisplay = document.getElementById('accuracy');
    const localComparisonP = document.getElementById('local-comparison');
    const resultsAchievementsDiv = document.getElementById('results-achievements');
    const detailedResultsFiltersDiv = document.querySelector('.detailed-results-filters');
    const detailedResultsDiv = document.getElementById('detailed-results');
    const restartQuizBtn = document.getElementById('restart-quiz-btn');
    const restartErrorsBtn = document.getElementById('restart-errors-btn');
    const newConfigBtn = document.getElementById('new-config-btn');
    const exportSessionBtn = document.getElementById('export-session-btn');
    const backToDashboardBtn = document.getElementById('back-to-dashboard-btn');

    // Settings Screen
    const themeSelect = document.getElementById('theme-select');
    const soundEffectsToggle = document.getElementById('sound-effects-toggle');
    const exportDataBtn = document.getElementById('export-data-btn');
    const importDataBtn = document.getElementById('import-data-btn');
    const generalStatsLocalDiv = document.getElementById('general-stats-local');
    const quizStatsLocalDiv = document.getElementById('quiz-stats-local');
    const localGamificationDiv = document.getElementById('local-gamification');
    const badgesEarnedLocalDiv = document.getElementById('badges-earned-local');
    const backToDashboardFromSettingsBtn = document.getElementById('back-to-dashboard-from-settings-btn');

    // --- LocalStorage Helper Functions ---

    function getItem(key, defaultValue = null) {
        try {
            const item = localStorage.getItem(key);
            return item ? JSON.parse(item) : defaultValue;
        } catch (e) {
            console.error(`Error getting item ${key} from localStorage:`, e);
            return defaultValue;
        }
    }

    function setItem(key, value) {
        try {
            localStorage.setItem(key, JSON.stringify(value));
        } catch (e) {
            console.error(`Error setting item ${key} in localStorage:`, e);
            if (e.name === 'QuotaExceededError') {
                showToast("Erreur: Stockage local plein !", "error", 5000);
            }
            // Handle other potential errors?
        }
    }

    function removeItem(key) {
        try {
            localStorage.removeItem(key);
        } catch (e) {
            console.error(`Error removing item ${key} from localStorage:`, e);
        }
    }

    // Specific Loaders / Savers
    function loadUserPreferences() {
        const defaultPrefs = { theme: 'light', soundEnabled: true };
        userPreferences = getItem(LOCAL_STORAGE_KEYS.PREFERENCES, defaultPrefs);
        // Ensure all keys exist by merging with defaults
        userPreferences = { ...defaultPrefs, ...userPreferences };
    }
    function saveUserPreferences() { setItem(LOCAL_STORAGE_KEYS.PREFERENCES, userPreferences); }
    function loadQuizLibrary() { quizLibrary = getItem(LOCAL_STORAGE_KEYS.QUIZ_LIBRARY, []); }
    function saveQuizLibrary() { setItem(LOCAL_STORAGE_KEYS.QUIZ_LIBRARY, quizLibrary); }
    function loadQuizContent(quizId) { return getItem(`${LOCAL_STORAGE_KEYS.QUIZ_CONTENT_PREFIX}${quizId}`); }
    function saveQuizContent(quizId, content) { setItem(`${LOCAL_STORAGE_KEYS.QUIZ_CONTENT_PREFIX}${quizId}`, content); }
    function deleteQuizContent(quizId) { removeItem(`${LOCAL_STORAGE_KEYS.QUIZ_CONTENT_PREFIX}${quizId}`); }
    function loadLocalHistory() { localHistory = getItem(LOCAL_STORAGE_KEYS.HISTORY, []); }
    function saveLocalHistory() { setItem(LOCAL_STORAGE_KEYS.HISTORY, localHistory); }
    function clearLocalHistory() { localHistory = []; removeItem(LOCAL_STORAGE_KEYS.HISTORY); }
    function loadLocalStats() {
        const defaultStats = { totalQuizzes: 0, totalAnswers: 0, correctAnswers: 0, totalPoints: 0, avgAccuracy: 0, longestStreak: 0, quizStats: {}, level: 1, xp: 0, xpNextLevel: 100, badges: [] };
        localStats = getItem(LOCAL_STORAGE_KEYS.STATS, defaultStats);
        localStats = { ...defaultStats, ...localStats }; // Ensure all keys exist
    }
    function saveLocalStats() { setItem(LOCAL_STORAGE_KEYS.STATS, localStats); }
    function loadLastConfig() { lastConfig = getItem(LOCAL_STORAGE_KEYS.LAST_CONFIG, {}); }
    function saveLastConfig() { setItem(LOCAL_STORAGE_KEYS.LAST_CONFIG, lastConfig); }

    // --- UI Helper Functions ---

    function showScreen(screenId) {
        Object.keys(screens).forEach(id => {
            const isActive = id === screenId;
            screens[id].classList.toggle('active', isActive);
            screens[id].classList.toggle('hidden', !isActive);
        });
        // Specific actions on screen show
        if (screenId === 'dashboard') {
            renderQuizLibrary(); // Fait
            // --- Assurer que les données sont chargées AVANT l'affichage ---
            loadLocalHistory(); // Recharge explicitement au cas où
            loadQuizLibrary();  // Recharge explicitement au cas où
            // --- Puis afficher ---
            displayScoreHistory(); // Appelé ici
            populateHistoryFilter(); // Appelé ici
            updateErrorModeAvailability(); // Mise à jour dispo erreurs

            // Reset sélection SI on ne vient PAS de 'handleNewConfig'
            // (handleNewConfig gère déjà la sélection)
            // --> Pas besoin de reset ici si on vient d'ailleurs, l'état est géré par les autres fonctions

        } else if (screenId === 'settings') {
            renderSettingsScreen();
        }
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    function showToast(message, type = 'info', duration = 3000) {
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.textContent = message;
        toastContainer.appendChild(toast);
        setTimeout(() => toast.classList.add('show'), 10);
        setTimeout(() => {
            toast.classList.remove('show');
            toast.addEventListener('transitionend', () => toast.remove(), { once: true });
        }, duration);
    }

    function showLoader() { globalLoader.classList.remove('hidden'); }
    function hideLoader() { globalLoader.classList.add('hidden'); }

    function playSound(soundName) {
        if (!userPreferences.soundEnabled) return;
        // Placeholder: Implement actual audio playback here
        console.log(`Playing sound: ${soundName}`);
        // e.g., const audio = new Audio(`sounds/${soundName}.wav`); audio.play();
    }

    function applyTheme(theme) {
        bodyElement.dataset.theme = theme;
        if (themeSelect) themeSelect.value = theme;
    }

    /**
     * Simple Markdown Renderer Placeholder. Replace with a library like 'marked' for robustness.
     * WARNING: This basic version is NOT XSS-safe if user input can reach here.
     * Use a proper library with sanitization for user-generated content.
     */
    function renderMarkdown(text) {
        if (!text) return '';
        let html = text;
        // Bold (**text**)
        html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
        // Italic (*text* or _text_)
        html = html.replace(/(\*|_)(.*?)\1/g, '<em>$2</em>');
        // Code inline (`code`)
        html = html.replace(/`(.*?)`/g, '<code>$1</code>');
        // Code block (```lang\n code \n```) - Very basic
        html = html.replace(/```(\w*)\n([\s\S]*?)\n```/g, (match, lang, code) => {
            // Basic escaping for safety, replace with proper highlighting/sanitization
            const escapedCode = code.replace(/</g, '&lt;').replace(/>/g, '&gt;');
            return `<pre><code class="language-${lang || ''}">${escapedCode}</code></pre>`;
        });
        // Lists (basic unordered)
        html = html.replace(/^\s*-\s+(.*)/gm, '<li>$1</li>');
        html = html.replace(/(\<\/li\>\n)*\<\/li\>/g, '</li>'); // Clean up extra closing tags potentially
        html = html.replace(/(<li>.*<\/li>)/gs, '<ul>$1</ul>'); // Wrap sequence in <ul>
        // Basic numbered lists (needs improvement for nested/complex cases)
        html = html.replace(/^\s*\d+\.\s+(.*)/gm, '<oli>$1</oli>'); // Use <oli> temporarily
        html = html.replace(/(<\/oli>\n)*\<\/oli>/g, '</oli>');
        html = html.replace(/(<oli>.*<\/oli>)/gs, (match) => '<ol>' + match.replace(/<oli>/g, '<li>').replace(/<\/oli>/g, '</li>') + '</ol>');
        // Paragraphs (basic, wrap lines not part of other elements) - Needs refinement
        // html = html.split('\n').map(line => line.trim() === '' ? '' : `<p>${line}</p>`).join(''); // This is too naive

        // Replace \n with <br> for simple line breaks within paragraphs (should be handled more carefully)
        html = html.replace(/\n/g, '<br>');

        // NOTE: This is a very basic and potentially flawed markdown parser.
        // A dedicated library is highly recommended for production.
        return html;
    }

    function displayDashboardMessage(element, message, isError = true) {
        element.textContent = message;
        element.className = isError ? 'error-message' : 'success-message';
        element.classList.remove('hidden');
    }

    function clearDashboardMessages() {
        fileErrorMsg.textContent = ''; fileSuccessMsg.textContent = '';
        fileErrorMsg.classList.add('hidden'); fileSuccessMsg.classList.add('hidden');
    }

    // --- Quiz Library Management ---

    function renderQuizLibrary() {
        quizLibraryDiv.innerHTML = ''; // Clear existing
        if (quizLibrary.length === 0) {
            quizLibraryDiv.innerHTML = '<p>Aucun quiz dans la bibliothèque. Importez-en un !</p>';
            return;
        }
        quizLibrary.forEach(quizMeta => {
            const item = document.createElement('div');
            item.classList.add('quiz-library-item');
            item.dataset.quizId = quizMeta.quizId;
            item.innerHTML = `
                <span class="quiz-title">${quizMeta.title || 'Quiz sans titre'}</span>
                <span class="quiz-source">${quizMeta.source || 'inconnu'}</span>
                <button class="delete-quiz-btn" title="Supprimer de la bibliothèque">✖</button>
            `;
            // Highlight if selected
            if (quizMeta.quizId === selectedQuizId) {
                item.classList.add('selected');
            }
            // Add listeners
            item.addEventListener('click', (e) => {
                if (!e.target.classList.contains('delete-quiz-btn')) {
                    handleQuizSelection(quizMeta.quizId);
                }
            });
            item.querySelector('.delete-quiz-btn').addEventListener('click', (e) => {
                e.stopPropagation(); // Prevent selection event
                handleDeleteQuiz(quizMeta.quizId, quizMeta.title);
            });
            quizLibraryDiv.appendChild(item);
        });
    }

    function handleQuizSelection(quizId) {
        if (selectedQuizId === quizId && activeQuizContent) return; // No change if already selected and loaded

        console.log("Selecting quiz:", quizId); // Debug log
        selectedQuizId = quizId;
        activeQuizContent = null; // Reset content first
        configOptionsDiv.classList.add('hidden'); // Hide config initially
        startQuizBtn.disabled = false; // Disable button until content loads

        renderQuizLibrary(); // Update selection highlight

        const quizContent = loadQuizContent(quizId);

        if (!quizContent) {
            showToast(`Erreur: Contenu du quiz '${quizId}' introuvable.`, 'error');
            selectedQuizId = null; // Reset selection fully
            // Keep renderQuizLibrary called earlier to show deselection
            return;
        }

        activeQuizContent = quizContent; // Content is now loaded
        lastConfig = loadLastConfig();

        clearDashboardMessages();
        displayDashboardMessage(fileSuccessMsg, `Quiz "${activeQuizContent.quizTitle || 'Sans Titre'}" sélectionné.`, false);

        configOptionsDiv.classList.remove('hidden'); // Show config
        resetConfigOptions(true);
        startQuizBtn.disabled = false; // <-- ENABLE THE BUTTON HERE
        updateErrorModeAvailability();
    }

    function handleDeleteQuiz(quizId, quizTitle) {
        if (confirm(`Voulez-vous vraiment supprimer le quiz "${quizTitle || 'ce quiz'}" de votre bibliothèque locale ? (L'historique associé NE sera PAS supprimé).`)) {
            // Remove from library metadata
            quizLibrary = quizLibrary.filter(q => q.quizId !== quizId);
            saveQuizLibrary();
            // Remove content from storage
            deleteQuizContent(quizId);
            // If this was the selected quiz, reset selection
            if (selectedQuizId === quizId) {
                selectedQuizId = null;
                activeQuizContent = null;
                configOptionsDiv.classList.add('hidden');
                startQuizBtn.disabled = false;
                clearDashboardMessages();
            }
            renderQuizLibrary(); // Update UI list
            showToast(`Quiz "${quizTitle || ''}" supprimé de la bibliothèque.`, "info");
        }
    }

    function addQuizToLibrary(quizContent, sourceInfo) { // sourceInfo = { source: 'local'/'url', filename/url }
        if (!quizContent || !quizContent.quizId) {
            console.error("Tentative d'ajout d'un quiz sans ID ou contenu invalide.");
            return false; // Indicate failure
        }
        const quizId = quizContent.quizId;
        const existingIndex = quizLibrary.findIndex(q => q.quizId === quizId);

        const newMeta = {
            quizId: quizId,
            title: quizContent.quizTitle || `Quiz ${quizId}`,
            source: sourceInfo.source,
            filename: sourceInfo.filename, // only if source is 'local'
            url: sourceInfo.url,         // only if source is 'url'
            dateAdded: Date.now()
        };

        if (existingIndex > -1) {
            // Quiz ID already exists, ask user to overwrite?
            if (!confirm(`Un quiz avec l'ID "${quizId}" ("${quizLibrary[existingIndex].title}") existe déjà. Voulez-vous le remplacer par celui que vous importez ?`)) {
                showToast("Importation annulée.", "info");
                return false; // Indicate cancellation
            }
            // Overwrite metadata and content
            quizLibrary[existingIndex] = newMeta;
            console.log(`Quiz ${quizId} metadata overwritten.`);
        } else {
            // Add new entry
            quizLibrary.push(newMeta);
            console.log(`Quiz ${quizId} metadata added.`);
        }

        // Save content and updated library
        saveQuizContent(quizId, quizContent);
        saveQuizLibrary();
        renderQuizLibrary(); // Update the UI list
        populateHistoryFilter(); // Update history filter options
        return true; // Indicate success
    }

    // --- Import Logic ---

    function handleFileImport(event) {
        const file = event.target.files[0];
        if (file) {
            processQuizFile(file);
        }
        fileInput.value = ''; // Reset input for consecutive imports of the same file
    }
    function handleDragOver(event) { event.preventDefault(); fileInputLabelContainer.classList.add('drag-over'); }
    function handleDragLeave(event) { event.preventDefault(); fileInputLabelContainer.classList.remove('drag-over'); }
    function handleDrop(event) {
        event.preventDefault();
        fileInputLabelContainer.classList.remove('drag-over');
        const file = event.dataTransfer?.files[0];
        if (file && file.name.endsWith('.json')) {
            processQuizFile(file);
        } else {
            clearDashboardMessages();
            displayDashboardMessage(fileErrorMsg, "Veuillez déposer un fichier .json valide.");
        }
    }
    function handleUrlImport() {
        const url = urlInput.value.trim();
        if (!url) {
            displayDashboardMessage(fileErrorMsg, "Veuillez entrer une URL valide.");
            return;
        }
        // Basic URL validation (can be improved)
        try {
            new URL(url);
        } catch (_) {
            displayDashboardMessage(fileErrorMsg, "L'URL fournie n'est pas valide.");
            return;
        }
        clearDashboardMessages();
        fetchQuizFromUrl(url);
        urlInput.value = ''; // Clear input after attempt
    }

    async function fetchQuizFromUrl(url) {
        showLoader();
        fileInputLabel.textContent = "Chargement depuis URL...";
        try {
            const response = await fetch(url, { mode: 'cors' }); // Need CORS headers on the server serving the JSON
            if (!response.ok) {
                throw new Error(`Erreur réseau: ${response.status} ${response.statusText}`);
            }
            let jsonContent;
            try {
                jsonContent = await response.json(); // Tente de parser la réponse en JSON
            } catch (parseError) {
                // Si le parsing échoue, ALORS on lève l'erreur de format JSON
                console.error("JSON Parse Error from URL:", parseError);
                throw new Error("La réponse reçue n'a pas pu être interprétée comme JSON valide.");
            }
            processQuizJson(jsonContent, { source: 'url', url: url });
        } catch (error) {
            console.error("Fetch URL Error:", error);
            clearDashboardMessages();
            displayDashboardMessage(fileErrorMsg, `Erreur importation URL: ${error.message}`);
            fileInputLabel.textContent = "Choisir un fichier ou glisser-déposer ici...";
        } finally {
            hideLoader();
        }
    }

    function processQuizFile(file) {
        clearDashboardMessages();
        fileInputLabel.textContent = `Lecture de ${file.name}...`;
        showLoader();
        const reader = new FileReader();
        reader.onload = (e) => {
            processQuizJson(e.target.result, { source: 'local', filename: file.name });
        };
        reader.onerror = () => {
            hideLoader();
            clearDashboardMessages();
            displayDashboardMessage(fileErrorMsg, "Erreur de lecture du fichier.");
            fileInputLabel.textContent = "Choisir un fichier ou glisser-déposer ici...";
        };
        reader.readAsText(file);
    }

    function processQuizJson(jsonStringOrObject, sourceInfo) {
        try {
            const jsonData = (typeof jsonStringOrObject === 'string') ? JSON.parse(jsonStringOrObject) : jsonStringOrObject;

            if (validateQuizData(jsonData)) { // Throws error if invalid
                const added = addQuizToLibrary(jsonData, sourceInfo);
                if (added) {
                    const title = jsonData.quizTitle || `Quiz ${jsonData.quizId}`;
                    clearDashboardMessages();
                    displayDashboardMessage(fileSuccessMsg, `Quiz "${title}" importé/mis à jour avec succès ! Sélectionnez-le dans la bibliothèque.`, false);
                    fileInputLabel.textContent = "Choisir un fichier ou glisser-déposer ici...";
                } // else: addQuizToLibrary showed a message (overwrite cancelled)
            }
            // validateQuizData throws error if invalid
        } catch (error) {
            console.error("JSON Processing/Validation Error:", error);
            clearDashboardMessages();
            displayDashboardMessage(fileErrorMsg, `Erreur JSON: ${error.message}`);
            fileInputLabel.textContent = "Choisir un fichier ou glisser-déposer ici...";
        } finally {
            hideLoader();
        }
    }

    /** Validates quiz data structure. Throws error on failure. */
    function validateQuizData(jsonData) {
        if (!jsonData || typeof jsonData !== 'object') {
            throw new Error("Contenu JSON invalide ou vide.");
        }
        if (!jsonData.quizId || typeof jsonData.quizId !== 'string' || !jsonData.quizId.trim()) {
            throw new Error("Champ 'quizId' (identifiant unique string) manquant ou invalide.");
        }
        if (!jsonData.quizTitle || typeof jsonData.quizTitle !== 'string' || !jsonData.quizTitle.trim()) {
            // Warn instead of throwing error for title, can use ID as fallback
            console.warn(`Champ 'quizTitle' manquant ou invalide pour quizId '${jsonData.quizId}'. Utilisation de l'ID comme titre.`);
            jsonData.quizTitle = jsonData.quizId; // Assign ID as title if missing
        }
        if (!Array.isArray(jsonData.questions) || jsonData.questions.length === 0) {
            throw new Error(`Champ 'questions' pour quizId '${jsonData.quizId}' manquant, vide, ou n'est pas un tableau.`);
        }

        const validTypes = ['qcm', 'vrai_faux', 'texte_libre', 'association', 'ordre', 'qcm_multi'];
        const questionIds = new Set(); // Check for duplicate question IDs within the quiz

        for (let i = 0; i < jsonData.questions.length; i++) {
            const q = jsonData.questions[i];
            const qNum = i + 1;

            // Basic Question Structure Checks
            if (!q || typeof q !== 'object') {
                throw new Error(`Question ${qNum} (quizId: ${jsonData.quizId}): Format invalide (n'est pas un objet).`);
            }
            if (q.id) { // Validate question ID if present
                if (typeof q.id !== 'string' || !q.id.trim()) throw new Error(`Question ${qNum} (quizId: ${jsonData.quizId}): ID de question ('id') invalide.`);
                if (questionIds.has(q.id)) throw new Error(`Question ${qNum} (quizId: ${jsonData.quizId}): ID de question ('${q.id}') dupliqué dans ce quiz.`);
                questionIds.add(q.id);
            }
            if (!q.type || !validTypes.includes(q.type)) {
                throw new Error(`Question ${qNum} (id: ${q.id || 'N/A'}, quizId: ${jsonData.quizId}): Type ('${q.type || 'inconnu'}') invalide ou manquant. Types valides: ${validTypes.join(', ')}.`);
            }
            if (!q.text || typeof q.text !== 'string' || !q.text.trim()) {
                throw new Error(`Question ${qNum} (id: ${q.id || 'N/A'}, quizId: ${jsonData.quizId}): Texte ('text') manquant ou vide.`);
            }
            if (q.correctAnswer === undefined || q.correctAnswer === null) {
                throw new Error(`Question ${qNum} (id: ${q.id || 'N/A'}, quizId: ${jsonData.quizId}): Réponse correcte ('correctAnswer') manquante.`);
            }
            if (q.explanation === undefined || typeof q.explanation !== 'string') {
                // Allow empty string for explanation, but require the field
                throw new Error(`Question ${qNum} (id: ${q.id || 'N/A'}, quizId: ${jsonData.quizId}): Explication ('explanation') manquante ou invalide (doit être string, peut être vide).`);
            }
            if (q.points !== undefined && (typeof q.points !== 'number' || !Number.isInteger(q.points) || q.points < 0)) {
                throw new Error(`Question ${qNum} (id: ${q.id || 'N/A'}, quizId: ${jsonData.quizId}): Points ('points') invalides (doit être un nombre entier >= 0).`);
            }
            if (q.category !== undefined && (typeof q.category !== 'string' || !q.category.trim())) {
                console.warn(`Question ${qNum} (id: ${q.id || 'N/A'}, quizId: ${jsonData.quizId}): Catégorie ('category') fournie mais vide.`);
                // Allow empty category string, maybe sanitize later?
            }

            // Type-specific Validation for correctAnswer and required fields
            switch (q.type) {
                case 'vrai_faux':
                    if (typeof q.correctAnswer !== 'boolean') {
                        throw new Error(`Question ${qNum} (id: ${q.id || 'N/A'}, quizId: ${jsonData.quizId}, type: V/F): 'correctAnswer' doit être un booléen (true ou false).`);
                    }
                    break;
                case 'qcm':
                    if (typeof q.correctAnswer !== 'string' || !q.correctAnswer.trim()) {
                        throw new Error(`Question ${qNum} (id: ${q.id || 'N/A'}, quizId: ${jsonData.quizId}, type: QCM): 'correctAnswer' doit être une chaîne de caractères non vide.`);
                    }
                    break;
                case 'texte_libre':
                    if (typeof q.correctAnswer !== 'string' || !q.correctAnswer.trim()) {
                        throw new Error(`Question ${qNum} (id: ${q.id || 'N/A'}, quizId: ${jsonData.quizId}, type: Texte Libre): 'correctAnswer' doit être une chaîne de caractères non vide.`);
                    }
                    // Optional: check tolerance field if you add it
                    break;
                case 'qcm_multi':
                    if (!Array.isArray(q.correctAnswer) || q.correctAnswer.length === 0) {
                        throw new Error(`Question ${qNum} (id: ${q.id || 'N/A'}, quizId: ${jsonData.quizId}, type: QCM-Multi): 'correctAnswer' doit être un tableau (array) non vide.`);
                    }
                    if (!q.correctAnswer.every(item => typeof item === 'string' && item.trim())) {
                        throw new Error(`Question ${qNum} (id: ${q.id || 'N/A'}, quizId: ${jsonData.quizId}, type: QCM-Multi): Tous les éléments dans 'correctAnswer' doivent être des chaînes de caractères non vides.`);
                    }
                    break;
                case 'ordre':
                    if (!Array.isArray(q.items) || q.items.length < 2) {
                        throw new Error(`Question ${qNum} (id: ${q.id || 'N/A'}, quizId: ${jsonData.quizId}, type: Ordre): Le champ 'items' est requis, doit être un tableau avec au moins 2 éléments.`);
                    }
                    if (!q.items.every(item => typeof item === 'string' && item.trim())) {
                        throw new Error(`Question ${qNum} (id: ${q.id || 'N/A'}, quizId: ${jsonData.quizId}, type: Ordre): Tous les éléments dans 'items' doivent être des chaînes de caractères non vides.`);
                    }
                    if (!Array.isArray(q.correctAnswer) || q.correctAnswer.length !== q.items.length) {
                        throw new Error(`Question ${qNum} (id: ${q.id || 'N/A'}, quizId: ${jsonData.quizId}, type: Ordre): 'correctAnswer' doit être un tableau de même taille que 'items'.`);
                    }
                    // Check if correctAnswer contains exactly the same elements as items (just possibly different order)
                    const itemsSet = new Set(q.items);
                    const correctAnsSet = new Set(q.correctAnswer);
                    if (itemsSet.size !== correctAnsSet.size || ![...itemsSet].every(item => correctAnsSet.has(item))) {
                        throw new Error(`Question ${qNum} (id: ${q.id || 'N/A'}, quizId: ${jsonData.quizId}, type: Ordre): 'correctAnswer' doit contenir exactement les mêmes éléments que 'items'.`);
                    }
                    if (!q.correctAnswer.every(item => typeof item === 'string' && item.trim())) {
                        throw new Error(`Question ${qNum} (id: ${q.id || 'N/A'}, quizId: ${jsonData.quizId}, type: Ordre): Tous les éléments dans 'correctAnswer' doivent être des chaînes de caractères non vides.`);
                    }
                    break;
                case 'association':
                    if (!Array.isArray(q.items_left) || q.items_left.length === 0) {
                        throw new Error(`Question ${qNum} (id: ${q.id || 'N/A'}, quizId: ${jsonData.quizId}, type: Association): Le champ 'items_left' est requis et doit être un tableau non vide.`);
                    }
                    if (!q.items_left.every(item => typeof item === 'string' && item.trim())) {
                        throw new Error(`Question ${qNum} (id: ${q.id || 'N/A'}, quizId: ${jsonData.quizId}, type: Association): Tous les éléments dans 'items_left' doivent être des chaînes de caractères non vides.`);
                    }
                    if (!Array.isArray(q.items_right) || q.items_right.length !== q.items_left.length) {
                        throw new Error(`Question ${qNum} (id: ${q.id || 'N/A'}, quizId: ${jsonData.quizId}, type: Association): Le champ 'items_right' est requis et doit être un tableau de même taille que 'items_left'.`);
                    }
                    if (!q.items_right.every(item => typeof item === 'string' && item.trim())) {
                        throw new Error(`Question ${qNum} (id: ${q.id || 'N/A'}, quizId: ${jsonData.quizId}, type: Association): Tous les éléments dans 'items_right' doivent être des chaînes de caractères non vides.`);
                    }
                    // Check correctAnswer structure: must be an object, keys must be from items_left, values must be from items_right
                    if (typeof q.correctAnswer !== 'object' || q.correctAnswer === null || Array.isArray(q.correctAnswer) || Object.keys(q.correctAnswer).length !== q.items_left.length) {
                        throw new Error(`Question ${qNum} (id: ${q.id || 'N/A'}, quizId: ${jsonData.quizId}, type: Association): 'correctAnswer' doit être un objet (map) avec une entrée pour chaque élément de 'items_left'.`);
                    }
                    const leftItemsSet = new Set(q.items_left);
                    const rightItemsSet = new Set(q.items_right);
                    for (const key in q.correctAnswer) {
                        if (!leftItemsSet.has(key)) {
                            throw new Error(`Question ${qNum} (id: ${q.id || 'N/A'}, quizId: ${jsonData.quizId}, type: Association): Clé '${key}' dans 'correctAnswer' n'existe pas dans 'items_left'.`);
                        }
                        const value = q.correctAnswer[key];
                        if (typeof value !== 'string' || !value.trim() || !rightItemsSet.has(value)) {
                            throw new Error(`Question ${qNum} (id: ${q.id || 'N/A'}, quizId: ${jsonData.quizId}, type: Association): Valeur '${value}' pour la clé '${key}' dans 'correctAnswer' est invalide ou n'existe pas dans 'items_right'.`);
                        }
                    }
                    break;
            }
        } // End loop through questions

        // Validate dummyAnswers structure if present
        if (jsonData.dummyAnswers !== undefined) {
            if (typeof jsonData.dummyAnswers !== 'object' || jsonData.dummyAnswers === null || Array.isArray(jsonData.dummyAnswers)) {
                throw new Error(`Champ 'dummyAnswers' (quizId: ${jsonData.quizId}), s'il est présent, doit être un objet (map).`);
            }
            for (const category in jsonData.dummyAnswers) {
                if (!Array.isArray(jsonData.dummyAnswers[category])) {
                    throw new Error(`Dans 'dummyAnswers' (quizId: ${jsonData.quizId}), la valeur pour la clé '${category}' doit être un tableau.`);
                }
                if (!jsonData.dummyAnswers[category].every(item => typeof item === 'string' && item.trim())) {
                    throw new Error(`Dans 'dummyAnswers[${category}]' (quizId: ${jsonData.quizId}), tous les éléments doivent être des chaînes de caractères non vides.`);
                }
            }
        }

        return true; // If no errors were thrown
    }

    async function importDefaultQuizzes() {
        if (DEFAULT_QUIZ_URLS.length === 0) return; // Rien à faire

        console.log("Checking for default quizzes to import...");
        let importNeededCount = 0;

        for (const url of DEFAULT_QUIZ_URLS) {
            // Vérifie si un quiz avec cette URL source existe déjà
            const alreadyExists = quizLibrary.some(quiz => quiz.source === 'url' && quiz.url === url);

            if (!alreadyExists) {
                importNeededCount++;
                console.log(`Default quiz URL not found locally, attempting import: ${url}`);
                // Utilise fetchQuizFromUrl qui gère déjà l'ajout à la bibliothèque et les erreurs
                // On lance l'import mais on n'attend pas ici pour ne pas bloquer le démarrage
                fetchQuizFromUrl(url).catch(err => {
                    // L'erreur est déjà loggée et un toast affiché dans fetchQuizFromUrl
                    console.warn(`Initial import failed for ${url}. User can try manually later.`);
                });
            } else {
                console.log(`Default quiz URL already in library: ${url}`);
            }
        }

        if (importNeededCount > 0) {
            showToast(`Tentative d'importation de ${importNeededCount} quiz par défaut en arrière-plan...`, 'info', 2500);
        }
    }

    // --- Configuration Logic ---

    function handleConfigChange() {
        const selectedMode = document.querySelector('input[name="quiz-mode"]:checked').value;
        customSettingsDiv.classList.toggle('hidden', selectedMode !== 'custom');
        errorSessionsCountInput.disabled = (selectedMode !== 'errors');

        // --- NOUVELLE LOGIQUE ---
        if (allowNavigationCheckbox.checked) {
            // If nav back is enabled, disable instant feedback and explanation display
            instantFeedbackCheckbox.checked = false;
            instantFeedbackCheckbox.disabled = true;
            showExplOnIncorrectCheckbox.checked = false;
            showExplOnIncorrectCheckbox.disabled = true;
            // Add visual cue that it's disabled
            instantFeedbackCheckbox.closest('label').style.opacity = '0.5';
            showExplOnIncorrectCheckbox.closest('label').style.opacity = '0.5';

        } else {
            // If nav back is disabled, re-enable instant feedback option
            instantFeedbackCheckbox.disabled = false;
            instantFeedbackCheckbox.closest('label').style.opacity = '1';
            // Explanation option depends *only* on instant feedback now
            showExplOnIncorrectCheckbox.disabled = !instantFeedbackCheckbox.checked;
            showExplOnIncorrectCheckbox.closest('label').style.opacity = instantFeedbackCheckbox.checked ? '1' : '0.5';
            if (!instantFeedbackCheckbox.checked) {
                showExplOnIncorrectCheckbox.checked = false; // Ensure it's unchecked if instant feedback is off
            }
        }
        // --- FIN NOUVELLE LOGIQUE ---
    }

    function resetConfigOptions(prefill = false) {
        // Set default radio
        const defaultMode = (prefill && lastConfig.mode) ? lastConfig.mode : 'preset-short';
        const radioToSelect = document.querySelector(`input[name="quiz-mode"][value="${defaultMode}"]`) || document.querySelector('input[name="quiz-mode"][value="preset-short"]');
        if (radioToSelect) radioToSelect.checked = true;

        // Set default checkboxes
        allowNavigationCheckbox.checked = (prefill && lastConfig.allowNavBack !== undefined) ? lastConfig.allowNavBack : false;
        instantFeedbackCheckbox.checked = (prefill && lastConfig.instantFeedback !== undefined) ? lastConfig.instantFeedback : true;
        showExplOnIncorrectCheckbox.checked = (prefill && lastConfig.showExpl !== undefined) ? lastConfig.showExpl : false;

        // Set custom inputs
        customTimeInput.value = (prefill && lastConfig.customTime) ? lastConfig.customTime : '';
        customQuestionsInput.value = (prefill && lastConfig.customQuestions) ? lastConfig.customQuestions : '';
        errorSessionsCountInput.value = (prefill && lastConfig.errorSessions) ? lastConfig.errorSessions : '3';

        handleConfigChange(); // Update UI based on defaults/prefill
    }

    function updateErrorModeAvailability() {
        const errorModeRadio = document.querySelector('input[name="quiz-mode"][value="errors"]');
        if (!errorModeRadio) return;

        if (!selectedQuizId) {
            errorModeRadio.disabled = true;
            errorModeRadio.closest('label').style.opacity = '0.5';
            errorModeRadio.closest('label').title = "Sélectionnez d'abord un quiz";
            return;
        }

        const hasErrorsInHistory = localHistory.some(attempt =>
            attempt.quizId === selectedQuizId &&
            attempt.answers &&
            attempt.answers.some(a => a && a.isCorrect === false)
        );

        errorModeRadio.disabled = !hasErrorsInHistory;
        errorModeRadio.closest('label').style.opacity = hasErrorsInHistory ? '1' : '0.5';
        errorModeRadio.closest('label').title = hasErrorsInHistory ? "" : "Aucune erreur enregistrée pour ce quiz dans l'historique";

        // If errors mode was selected but becomes disabled, switch to default
        if (errorModeRadio.checked && errorModeRadio.disabled) {
            resetConfigOptions(false); // Reset to default, don't prefill
        }
    }

    // --- History Management ---

    async function displayScoreHistory() { // Keep async signature, though not needed for local
        loadLocalHistory(); // Assurer que localHistory est à jour

        const historyTable = scoreHistoryDiv.querySelector('table');
        let tbody;

        // 1. Assurer que la structure table/thead/tbody existe
        if (!historyTable) {
            scoreHistoryDiv.innerHTML = `
                 <table>
                     <thead>
                         <tr>
                             <th>Date</th>
                             <th>Quiz</th>
                             <th>Score</th>
                             <th>Points</th>
                             <th>Temps</th>
                             <th>Mode</th>
                         </tr>
                     </thead>
                     <tbody>
                         <!-- Le contenu sera ajouté ici -->
                     </tbody>
                 </table>`;
            tbody = scoreHistoryDiv.querySelector('tbody');
        } else {
            tbody = historyTable.querySelector('tbody');
            if (!tbody) { // Juste au cas où tbody manquerait
                tbody = document.createElement('tbody');
                historyTable.appendChild(tbody);
            }
            tbody.innerHTML = ''; // Vider seulement le corps pour le reremplissage
        }

        // 2. Gérer l'état vide/filtré
        clearHistoryBtn.classList.toggle('hidden', localHistory.length === 0);

        const filterValue = historyFilterSelect.value;
        const filteredHistory = localHistory.filter(item => filterValue === 'all' || item.quizId === filterValue);

        if (filteredHistory.length === 0) {
            let message = filterValue === 'all'
                ? 'Aucun historique local pour le moment.'
                : `Aucun historique local pour ce quiz.`;
            if (localHistory.length > 0) message += ' (Essayez le filtre "Tous les Quiz")';

            // Afficher le message DANS le tbody
            const row = tbody.insertRow();
            const cell = row.insertCell();
            cell.colSpan = 6; // Assurer que ça prend toute la largeur
            cell.textContent = message;
            cell.style.textAlign = 'center';
            cell.style.fontStyle = 'italic';
            cell.style.padding = '20px';
        } else {
            // 3. Trier et afficher les données
            filteredHistory.sort((a, b) => new Date(b.date) - new Date(a.date));

            filteredHistory.forEach(item => {
                const itemDate = new Date(item.date);
                const formattedDate = itemDate.toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' });
                const quizInfo = quizLibrary.find(q => q.quizId === item.quizId);
                const quizTitle = quizInfo?.title || item.quizTitle || `Quiz ID: ${item.quizId || 'Inconnu'}`;

                const row = tbody.insertRow();
                row.innerHTML = `
                    <td>${formattedDate}</td>
                    <td>${quizTitle}</td>
                    <td>${item.score || 'N/A'}</td>
                    <td>${item.points ?? 'N/A'}</td>
                    <td>${item.timeTaken || 'N/A'}</td>
                    <td>${item.mode || 'N/A'}</td>
                `;
            });
        }
    }

    function populateHistoryFilter() {
        const uniqueQuizIdsInHistory = [...new Set(localHistory.map(item => item.quizId))];
        const uniqueQuizzes = uniqueQuizIdsInHistory
            .map(id => quizLibrary.find(q => q.quizId === id)) // Get full quiz meta
            .filter(Boolean) // Remove entries where quiz is no longer in library
            .sort((a, b) => a.title.localeCompare(b.title));

        const currentFilter = historyFilterSelect.value;
        historyFilterSelect.innerHTML = '<option value="all">Tous les Quiz</option>';
        uniqueQuizzes.forEach(quiz => {
            const option = document.createElement('option');
            option.value = quiz.quizId; // Use quizId for value
            option.textContent = quiz.title;
            historyFilterSelect.appendChild(option);
        });
        // Restore selection if possible
        if (uniqueQuizzes.some(q => q.quizId === currentFilter)) {
            historyFilterSelect.value = currentFilter;
        } else {
            historyFilterSelect.value = 'all';
        }
    }

    function handleHistoryFilterChange() { displayScoreHistory(); }

    function handleClearHistory() {
        if (confirm("Êtes-vous sûr de vouloir effacer TOUT votre historique local ? Cette action est irréversible.")) {
            clearLocalHistory(); // Clears the variable and localStorage
            showToast("Historique local effacé.", "success");
            displayScoreHistory(); // Refresh display (will show empty message)
            populateHistoryFilter(); // Refresh filter (will show only 'All')
            updateErrorModeAvailability(); // Errors mode might become unavailable
            // Recalculate stats as history is gone
            recalculateLocalStats();
            renderSettingsScreen(); // Update stats display on settings screen
        }
    }

    // --- Quiz Lifecycle ---

    function startQuiz() {
        if (!selectedQuizId || !activeQuizContent) {
            showToast("Veuillez d'abord sélectionner un quiz dans la bibliothèque.", "warning");
            return;
        }

        // 1. Read Configuration
        const selectedMode = document.querySelector('input[name="quiz-mode"]:checked').value;
        const allowNavBack = allowNavigationCheckbox.checked;
        const instantFeedback = instantFeedbackCheckbox.checked;
        const showExpl = showExplOnIncorrectCheckbox.checked && instantFeedback; // Only if instant feedback is on
        let numQuestions;
        let timeLimit = null; // seconds
        let sourceQuestions = [...activeQuizContent.questions]; // Copy questions
        let errorQuestionIds = []; // For errors mode

        try {
            // 2. Determine Questions to Ask based on Mode
            if (selectedMode === 'all' || selectedMode === 'exam') {
                numQuestions = sourceQuestions.length;
                questionsToAsk = shuffleArray(sourceQuestions);
            } else if (selectedMode === 'custom') {
                const customNum = parseInt(customQuestionsInput.value, 10);
                const customTime = parseInt(customTimeInput.value, 10);
                numQuestions = (!isNaN(customNum) && customNum > 0) ? Math.min(customNum, sourceQuestions.length) : sourceQuestions.length;
                if (!isNaN(customTime) && customTime > 0) timeLimit = customTime * 60;
                questionsToAsk = shuffleArray(sourceQuestions).slice(0, numQuestions);
            } else if (PRESETS[selectedMode]) {
                numQuestions = Math.min(PRESETS[selectedMode].questions, sourceQuestions.length);
                questionsToAsk = shuffleArray(sourceQuestions).slice(0, numQuestions);
            } else if (selectedMode === 'errors') {
                const sessionsToConsider = parseInt(errorSessionsCountInput.value, 10) || 1;
                const relevantHistory = localHistory
                    .filter(attempt => attempt.quizId === selectedQuizId)
                    .sort((a, b) => new Date(b.date) - new Date(a.date)) // Sort recent first
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
                    throw new Error(`Aucune erreur trouvée dans les ${sessionsToConsider} dernières sessions pour ce quiz.`);
                }
                // Find the full question objects corresponding to these IDs
                questionsToAsk = sourceQuestions.filter(q => errorQuestionIds.includes(q.id || `gen_${sourceQuestions.indexOf(q)}`)); // Need reliable IDs! Add index fallback.
                questionsToAsk = shuffleArray(questionsToAsk); // Shuffle the error questions
                numQuestions = questionsToAsk.length;
            } else {
                throw new Error("Mode de quiz inconnu sélectionné.");
            }

            if (questionsToAsk.length === 0 && selectedMode !== 'errors') { // Errors mode handles its own empty case
                throw new Error("Aucune question à poser pour cette configuration.");
            }

        } catch (error) {
            showToast(`Erreur de configuration: ${error.message}`, "error");
            console.error("Config Error:", error);
            return;
        }

        // 3. Save Config & Reset State
        currentQuizConfig = {
            mode: selectedMode,
            numQuestions: questionsToAsk.length, // Actual number of questions being asked
            timeLimit,
            allowNavBack,
            instantFeedback,
            showExpl,
            quizId: selectedQuizId,
            quizTitle: activeQuizContent.quizTitle || "Quiz sans Titre"
        };
        // Save config for next time
        lastConfig = {
            mode: selectedMode,
            allowNavBack, instantFeedback, showExpl,
            customTime: customTimeInput.value,
            customQuestions: customQuestionsInput.value,
            errorSessions: errorSessionsCountInput.value
        };
        saveLastConfig();

        questionsToAsk.forEach((q, idx) => q.originalIndex = sourceQuestions.indexOf(q)); // Store original index if needed
        questionsToAsk.forEach((q, idx) => q.quizSessionIndex = idx); // Index within this specific session

        currentQuestionIndex = 0;
        userAnswers = new Array(questionsToAsk.length).fill(null);
        score = 0; totalPoints = 0; currentStreak = 0; maxStreak = 0;
        startTime = Date.now(); questionStartTime = 0; quizEndTime = 0;
        isQuizActive = true; isSubmittingAnswer = false;
        timerInterval = null; timeLeft = timeLimit;

        // 4. Setup UI & Start
        setupQuizUI();
        showScreen('quiz');
        displayQuestion(currentQuestionIndex);
        updateErrorModeAvailability(); // Re-check availability after starting a quiz
    }

    function setupQuizUI() {
        quizTitleDisplay.textContent = currentQuizConfig.quizTitle;
        quizContentArea.innerHTML = '';
        finishQuizBtn.classList.add('hidden');
        cancelQuizBtn.classList.remove('hidden');
        streakCounterDisplay.textContent = `Série: 0 🔥`;
        scoreDisplay.textContent = `Score: 0 pts`;
        updateQuestionGridNav();

        // Timer
        clearInterval(timerInterval); timerInterval = null;
        timerDisplay.classList.remove('warning', 'critical');
        if (currentQuizConfig.timeLimit !== null) {
            timeLeft = currentQuizConfig.timeLimit;
            updateTimerDisplay();
            timerInterval = setInterval(handleTimerTick, 1000);
        } else {
            timeLeft = 0; // Reset just in case
            timerDisplay.textContent = "Temps: Libre";
        }
        updateProgressBar();
    }

    function handleTimerTick() {
        if (!isQuizActive || timeLeft === null) { clearInterval(timerInterval); return; }
        timeLeft--;
        updateTimerDisplay();
        if (timeLeft <= 0) {
            playSound('error');
            clearInterval(timerInterval);
            showToast("Le temps est écoulé !", "warning", 4000);
            forceFinishQuiz(true); // Time out = true
        } else if (timeLeft <= TIME_CRITICAL_THRESHOLD) {
            timerDisplay.classList.add('critical');
            timerDisplay.classList.remove('warning');
        } else if (timeLeft <= TIME_WARNING_THRESHOLD) {
            timerDisplay.classList.add('warning');
            timerDisplay.classList.remove('critical');
        }
    }

    function updateTimerDisplay() {
        if (!isQuizActive && timeLeft <= 0) {
            timerDisplay.textContent = "Temps écoulé !";
            timerDisplay.classList.remove('warning', 'critical');
            return;
        }
        if (currentQuizConfig.timeLimit === null) {
            timerDisplay.textContent = "Temps: Libre";
            return;
        }
        const displayTime = Math.max(0, timeLeft);
        const minutes = Math.floor(displayTime / 60);
        const seconds = displayTime % 60;
        timerDisplay.textContent = `Temps: ${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    }

    function updateProgressBar() {
        const answeredCount = userAnswers.filter(a => a !== null).length;
        const progressPercent = questionsToAsk.length > 0 ? (answeredCount / questionsToAsk.length) * 100 : 0;
        progressBar.style.width = `${Math.min(100, progressPercent)}%`;
    }

    function updateQuestionGridNav() {
        questionGridNav.innerHTML = '';
        if (!questionsToAsk || questionsToAsk.length === 0) return;

        questionsToAsk.forEach((q, i) => {
            const item = document.createElement('div');
            item.classList.add('grid-nav-item');
            item.title = `Question ${i + 1}`;
            item.dataset.index = i;

            if (isQuizActive && i === currentQuestionIndex) item.classList.add('current');

            const answerInfo = userAnswers[i];
            if (answerInfo !== null) {
                item.classList.add('answered');
                if (currentQuizConfig.instantFeedback || !isQuizActive) { // Show correctness if feedback on OR quiz finished
                    item.classList.toggle('correct', !!answerInfo.isCorrect);
                    item.classList.toggle('incorrect', !answerInfo.isCorrect);
                }
            }

            // Add click listener for navigation if allowed
            if (currentQuizConfig.allowNavBack && answerInfo !== null && i !== currentQuestionIndex) {
                item.classList.add('clickable');
                item.addEventListener('click', () => {
                    if (isQuizActive) displayQuestion(i);
                });
            }
            questionGridNav.appendChild(item);
        });
    }

    function updateQuizHeader() {
        questionCounterDisplay.textContent = `Question ${currentQuestionIndex + 1} / ${questionsToAsk.length}`;
        streakCounterDisplay.textContent = `Série: ${currentStreak} 🔥`;
        scoreDisplay.textContent = `Score: ${totalPoints} pts`;
        updateProgressBar();
        updateQuestionGridNav();
    }

    function displayQuestion(index) {
        if (!isQuizActive || index < 0 || index >= questionsToAsk.length) {
            console.warn("Invalid index or quiz not active for displayQuestion:", index);
            return;
        }
        // Clear previous feedback immediately if navigating back/forth
        document.querySelectorAll('.immediate-feedback.visible').forEach(fb => fb.classList.remove('visible'));

        currentQuestionIndex = index;
        const question = questionsToAsk[index];
        quizContentArea.innerHTML = ''; // Clear previous

        const questionBlock = createQuestionBlock(question, index);
        quizContentArea.appendChild(questionBlock);

        // Re-enable inputs if navigating back to an answered question
        if (currentQuizConfig.allowNavBack && userAnswers[index] !== null) {
            enableQuestionBlockInputs(questionBlock);
            // Re-select previous answer visually (if applicable)
            restoreAnswerSelectionUI(questionBlock, userAnswers[index].answer, question.type);
        } else if (userAnswers[index] !== null && !currentQuizConfig.allowNavBack) {
            // If feedback is off and nav is off, keep block disabled after initial answer
            disableQuestionBlockInputs(questionBlock);
        }


        // Scroll into view logic
        setTimeout(() => {
            document.querySelectorAll('.question-block.focused').forEach(b => b.classList.remove('focused'));
            questionBlock.classList.add('focused');
            const headerHeight = quizHeader.offsetHeight || 120;
            const elementPosition = questionBlock.getBoundingClientRect().top;
            const offsetPosition = elementPosition + window.pageYOffset - headerHeight - 20;
            window.scrollTo({ top: offsetPosition, behavior: 'smooth' });
        }, 50);

        updateQuizHeader();
        questionStartTime = Date.now(); // Reset timer for this question display
        isSubmittingAnswer = false;
    }

    function createQuestionBlock(question, index) {
        const questionBlock = document.createElement('div');
        questionBlock.classList.add('question-block');
        questionBlock.dataset.index = index;
        // Ensure a reliable ID for matching answers later
        questionBlock.dataset.questionId = question.id || `q_${selectedQuizId}_${question.originalIndex ?? index}`;

        const answerInfo = userAnswers[index]; // Check if already answered/marked
        const isMarked = answerInfo?.marked || false;

        // Header
        const header = document.createElement('div');
        header.classList.add('question-block-header');
        header.innerHTML = `
            <span>Question ${index + 1}</span>
            <button class="mark-question-btn ${isMarked ? 'marked' : ''}" data-question-index="${index}" title="${isMarked ? 'Ne plus marquer' : 'Marquer cette question'}">
                ${isMarked ? '🌟' : '⭐'}
            </button>
        `;
        header.querySelector('.mark-question-btn').addEventListener('click', handleMarkQuestion);
        questionBlock.appendChild(header);

        // Question Text (Rendered Markdown)
        const textElement = document.createElement('div'); // Use div for block elements from markdown
        textElement.classList.add('question-text');
        textElement.innerHTML = renderMarkdown(question.text); // Use the markdown renderer
        questionBlock.appendChild(textElement);

        // --- Answer Options Area (Dynamically generated) ---
        const optionsDiv = document.createElement('div');
        optionsDiv.classList.add('answer-options');
        optionsDiv.classList.add(question.type); // Class for specific type styling

        // --- Generate options based on type ---
        switch (question.type) {
            case 'qcm':
            case 'vrai_faux':
                let options = question.type === 'vrai_faux'
                    ? [true, false]
                    : shuffleArray([question.correctAnswer, ...generateFalseAnswers(question, activeQuizContent.questions, activeQuizContent.dummyAnswers)]);
                options.forEach(option => {
                    const button = document.createElement('button');
                    button.classList.add('answer-btn');
                    button.textContent = (typeof option === 'boolean') ? (option ? 'Vrai' : 'Faux') : option;
                    button.dataset.answer = option;
                    button.addEventListener('click', handleAnswerSelection);
                    optionsDiv.appendChild(button);
                });
                break;

            case 'texte_libre':
                const input = document.createElement('input');
                input.type = 'text'; input.placeholder = "Tapez votre réponse...";
                input.addEventListener('keydown', (e) => { if (e.key === 'Enter') submitBtn.click(); });
                optionsDiv.appendChild(input);
                const submitBtn = document.createElement('button');
                submitBtn.textContent = 'Valider';
                submitBtn.classList.add('btn-primary', 'submit-answer-btn');
                submitBtn.addEventListener('click', handleAnswerSelection);
                optionsDiv.appendChild(submitBtn);
                break;

            case 'qcm_multi':
                const multiCorrect = Array.isArray(question.correctAnswer) ? question.correctAnswer : [question.correctAnswer];
                const multiFalse = generateFalseAnswers(question, activeQuizContent.questions, activeQuizContent.dummyAnswers, multiCorrect);
                const multiCombined = shuffleArray([...multiCorrect, ...multiFalse]); // Combine and shuffle
                multiCombined.forEach(option => {
                    const label = document.createElement('label'); label.classList.add('checkbox-label');
                    const checkbox = document.createElement('input'); checkbox.type = 'checkbox'; checkbox.value = option; checkbox.dataset.answer = option;
                    const span = document.createElement('span'); span.innerHTML = renderMarkdown(option); // Render markdown in options too
                    label.appendChild(checkbox); label.appendChild(span);
                    optionsDiv.appendChild(label);
                });
                const submitMultiBtn = document.createElement('button');
                submitMultiBtn.textContent = 'Valider Sélection'; submitMultiBtn.classList.add('btn-primary', 'submit-answer-btn');
                submitMultiBtn.addEventListener('click', handleAnswerSelection);
                optionsDiv.appendChild(submitMultiBtn);
                break;

            case 'association':
                if (!Array.isArray(question.items_left) || !Array.isArray(question.items_right) || typeof question.correctAnswer !== 'object') {
                    optionsDiv.innerHTML = `<p class='error-message'>Erreur de structure question Association.</p>`; break;
                }
                optionsDiv.innerHTML = `<div class="matching-column" id="matching-left-${index}"><h4>Glissez :</h4></div> <div class="matching-column" id="matching-right-${index}"><h4>Déposez :</h4></div>`;
                const leftCol = optionsDiv.querySelector(`#matching-left-${index}`);
                const rightCol = optionsDiv.querySelector(`#matching-right-${index}`);
                shuffleArray([...question.items_left]).forEach(itemText => {
                    const itemDiv = document.createElement('div'); itemDiv.classList.add('matching-item'); itemDiv.setAttribute('draggable', 'true');
                    itemDiv.dataset.itemId = itemText; itemDiv.innerHTML = renderMarkdown(itemText);
                    itemDiv.addEventListener('dragstart', handleAssocDragStart); itemDiv.addEventListener('dragend', handleAssocDragEnd);
                    leftCol.appendChild(itemDiv);
                });
                question.items_right.forEach(targetText => {
                    const targetContainer = document.createElement('div'); targetContainer.classList.add('matching-target-container');
                    const labelSpan = document.createElement('span'); labelSpan.classList.add('matching-target-label'); labelSpan.innerHTML = renderMarkdown(targetText);
                    const dropDiv = document.createElement('div'); dropDiv.classList.add('drop-target'); dropDiv.dataset.targetId = targetText; dropDiv.textContent = 'Déposez ici';
                    dropDiv.addEventListener('dragover', handleAssocDragOver); dropDiv.addEventListener('dragleave', handleAssocDragLeave); dropDiv.addEventListener('drop', handleAssocDrop);
                    targetContainer.appendChild(labelSpan); targetContainer.appendChild(dropDiv);
                    rightCol.appendChild(targetContainer);
                });
                const submitAssocBtn = document.createElement('button');
                submitAssocBtn.textContent = "Valider Associations"; submitAssocBtn.classList.add('btn-primary', 'submit-answer-btn', 'association-submit'); // Add specific class for targeting
                submitAssocBtn.addEventListener('click', handleAnswerSelection);
                questionBlock.appendChild(submitAssocBtn); // Append after optionsDiv
                break;

            case 'ordre':
                if (!Array.isArray(question.items) || !Array.isArray(question.correctAnswer)) {
                    optionsDiv.innerHTML = `<p class='error-message'>Erreur de structure question Ordre.</p>`; break;
                }
                shuffleArray([...question.items]).forEach(itemText => {
                    const itemDiv = document.createElement('div'); itemDiv.classList.add('ordering-item'); itemDiv.setAttribute('draggable', 'true');
                    itemDiv.innerHTML = renderMarkdown(itemText); // Use innerHTML for markdown
                    itemDiv.addEventListener('dragstart', handleDragStart); itemDiv.addEventListener('dragend', handleDragEnd);
                    optionsDiv.appendChild(itemDiv);
                });
                optionsDiv.addEventListener('dragover', handleOrderingDragOver); // Use specific handler
                optionsDiv.addEventListener('dragleave', handleOrderingDragLeave); // Use specific handler
                optionsDiv.addEventListener('drop', handleOrderingDrop);       // Use specific handler
                const submitOrderBtn = document.createElement('button');
                submitOrderBtn.textContent = "Valider l'ordre"; submitOrderBtn.classList.add('btn-primary', 'submit-answer-btn');
                submitOrderBtn.addEventListener('click', handleAnswerSelection);
                optionsDiv.appendChild(submitOrderBtn);
                break;

            default:
                optionsDiv.textContent = `Type de question inconnu: ${question.type}`;
        }
        questionBlock.appendChild(optionsDiv);

        // Immediate Feedback Area
        const feedbackDiv = document.createElement('div');
        feedbackDiv.classList.add('immediate-feedback', 'hidden');
        feedbackDiv.innerHTML = `<span class="feedback-icon"></span> <span class="feedback-text"></span>`;
        questionBlock.appendChild(feedbackDiv);

        return questionBlock;
    }

    /**
 * Generates false answers (distractors) for QCM/QCM-Multi questions.
 * Prioritizes dummy answers from the same category, then global, then correct answers
 * from other questions, then dummies from other categories.
 * Ensures only strings (or booleans converted to 'Vrai'/'Faux') are added.
 *
 * @param {object} currentQuestion The current question object.
 * @param {Array} allQuestions All questions from the loaded JSON quiz.
 * @param {object|null} dummyAnswersData The dummyAnswers object from JSON (can be null/undefined).
 * @param {Array} excludedAnswers Answers to exclude (e.g., all correct answers for multi-choice).
 * @returns {Array<string>} An array of up to 3 unique false answer strings.
 */
    function generateFalseAnswers(currentQuestion, allQuestions, dummyAnswersData, excludedAnswers = []) {
        // Ensure correctAnswer is treated correctly (single string or array for multi)
        const correctAnswer = currentQuestion.correctAnswer;
        const correctAnswersArray = Array.isArray(correctAnswer) ? correctAnswer : [correctAnswer];

        // Build the set of excluded answers (case-insensitive)
        // Includes the correct answer(s) for the current question and any explicitly passed exclusions
        const finalExcluded = new Set(
            [...correctAnswersArray, ...excludedAnswers]
                .map(a => String(a).toLowerCase()) // Convert to string and lowercase
        );

        let potentialFalsePool = new Set();

        /**
         * Safely adds a potential answer to the pool if it's a valid type (string/boolean)
         * and not already excluded. Converts boolean to string ('Vrai'/'Faux').
         * @param {*} answer The potential answer to add.
         */
        const addAnswerToPool = (answer) => {
            const answerType = typeof answer;

            // Only process non-null/undefined strings or booleans
            if (answerType === 'string' && answer.trim() !== '') {
                const answerLower = answer.toLowerCase();
                if (!finalExcluded.has(answerLower)) {
                    potentialFalsePool.add(answer); // Add the original string
                }
            } else if (answerType === 'boolean') {
                const answerStr = answer ? 'Vrai' : 'Faux';
                const answerStrLower = answerStr.toLowerCase();
                if (!finalExcluded.has(answerStrLower)) {
                    potentialFalsePool.add(answerStr); // Add 'Vrai' or 'Faux'
                }
            }
            // Implicitly ignore numbers, objects, arrays, null, undefined, empty strings
        };

        // --- Populate the pool in order of preference ---

        // 1. Dummies from the same category (if category and dummies exist)
        if (dummyAnswersData && currentQuestion.category && dummyAnswersData[currentQuestion.category]) {
            dummyAnswersData[currentQuestion.category].forEach(addAnswerToPool);
        }

        // 2. Dummies from Global category (if it exists)
        if (dummyAnswersData && dummyAnswersData.Global) {
            dummyAnswersData.Global.forEach(addAnswerToPool);
        }

        // 3. Correct answers from *other* questions (prefer same category first)
        const otherQuestions = allQuestions.filter(q => q !== currentQuestion);
        // Same category first
        otherQuestions.forEach(q => {
            if (q.category === currentQuestion.category) {
                // Need to handle cases where correctAnswer might be an array (QCM-Multi) or object (Association)
                if (typeof q.correctAnswer === 'string' || typeof q.correctAnswer === 'boolean') {
                    addAnswerToPool(q.correctAnswer);
                } else if (Array.isArray(q.correctAnswer)) {
                    // For arrays (QCM-Multi, Ordre), add individual valid string items
                    q.correctAnswer.forEach(item => {
                        if (typeof item === 'string') addAnswerToPool(item);
                    });
                }
                // Ignore object correctAnswers (Association) as distractors for QCM
            }
        });
        // Then other categories
        otherQuestions.forEach(q => {
            if (q.category !== currentQuestion.category) {
                if (typeof q.correctAnswer === 'string' || typeof q.correctAnswer === 'boolean') {
                    addAnswerToPool(q.correctAnswer);
                } else if (Array.isArray(q.correctAnswer)) {
                    q.correctAnswer.forEach(item => {
                        if (typeof item === 'string') addAnswerToPool(item);
                    });
                }
                // Ignore object correctAnswers
            }
        });

        // 4. Dummies from other categories (if dummies exist)
        if (dummyAnswersData) {
            for (const cat in dummyAnswersData) {
                // Check category is not the current one and not Global
                if (cat !== currentQuestion.category && cat !== "Global") {
                    dummyAnswersData[cat].forEach(addAnswerToPool);
                }
            }
        }

        // --- Select final options ---

        // Shuffle the collected valid distractors
        let shuffledPool = shuffleArray(Array.from(potentialFalsePool));

        // Take up to 3 options from the pool
        let falseOptions = shuffledPool.slice(0, 3);

        // --- Fallback if not enough unique options found ---
        let fallbackCounter = 1;
        while (falseOptions.length < 3) {
            const placeholder = `Option Fallback ${fallbackCounter}`;
            // Ensure fallback doesn't match excluded answers
            if (!finalExcluded.has(placeholder.toLowerCase())) {
                falseOptions.push(placeholder);
            }
            fallbackCounter++;
            // Safety break to prevent infinite loop if something is wrong
            if (fallbackCounter > 20) {
                console.warn(`Could not generate 3 unique false answers for question (id: ${currentQuestion.id || 'N/A'}), generated ${falseOptions.length}.`);
                break;
            }
        }

        // Return exactly 3 options (or fewer if fallback failed badly)
        return falseOptions.slice(0, 3);
    }

    /** Shuffles array in place */
    function shuffleArray(array) {
        for (let i = array.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [array[i], array[j]] = [array[j], array[i]];
        }
        return array;
    }

    // --- Drag & Drop Handlers (Ordering) ---
    function handleDragStart(event) {
        draggedItem = event.target.closest('.ordering-item');
        if (!draggedItem) return;
        setTimeout(() => draggedItem.classList.add('dragging'), 0);
        event.dataTransfer.effectAllowed = 'move';
        // Store index maybe? event.dataTransfer.setData('text/plain', draggedItem.dataset.index?);
    }
    function handleDragEnd() {
        if (draggedItem) draggedItem.classList.remove('dragging');
        if (placeholder && placeholder.parentNode) placeholder.remove();
        draggedItem = null; placeholder = null;
    }
    function handleOrderingDragOver(event) { // Renamed to be specific
        event.preventDefault();
        const container = event.target.closest('.answer-options.ordre');
        if (!container || !draggedItem || container === draggedItem) return;
        event.dataTransfer.dropEffect = 'move';

        if (!placeholder) {
            placeholder = document.createElement('div');
            placeholder.classList.add('ordering-placeholder');
        }
        const afterElement = getDragAfterElement(container, event.clientY);
        if (afterElement == null) {
            if (!container.contains(placeholder) || container.lastChild !== placeholder) {
                container.appendChild(placeholder);
            }
        } else {
            if (!container.contains(placeholder) || afterElement !== placeholder.nextSibling) {
                container.insertBefore(placeholder, afterElement);
            }
        }
    }
    function handleOrderingDragLeave(event) { // Renamed
        const container = event.target.closest('.answer-options.ordre');
        if (container && placeholder && placeholder.parentNode === container && !container.contains(event.relatedTarget)) {
            setTimeout(() => { // Delay removal
                if (placeholder && placeholder.parentNode === container && !container.matches(':hover')) {
                    placeholder.remove();
                    placeholder = null; // Reset placeholder variable
                }
            }, 50);
        }
    }
    function handleOrderingDrop(event) { // Renamed
        event.preventDefault();
        const container = event.target.closest('.answer-options.ordre');
        if (container && draggedItem && placeholder && placeholder.parentNode === container) {
            container.insertBefore(draggedItem, placeholder); // Insert item before placeholder
        }
        // Cleanup handled by dragend
    }
    function getDragAfterElement(container, y) {
        const draggableElements = [...container.querySelectorAll('.ordering-item:not(.dragging)')];
        return draggableElements.reduce((closest, child) => {
            const box = child.getBoundingClientRect();
            const offset = y - box.top - box.height / 2;
            if (offset < 0 && offset > closest.offset) {
                return { offset: offset, element: child };
            } else { return closest; }
        }, { offset: Number.NEGATIVE_INFINITY }).element;
    }

    // --- Drag & Drop Handlers (Association) ---
    function handleAssocDragStart(event) {
        const target = event.target.closest('.matching-item'); // Only drag from left items
        if (!target || target.classList.contains('matched')) { // Don't drag already matched items
            event.preventDefault();
            return;
        }

        assocDraggedItem = target;
        assocDraggedItemId = target.dataset.itemId;
        isDraggingFromTarget = false; // Always false now

        if (!assocDraggedItemId) { event.preventDefault(); return; }

        setTimeout(() => target.classList.add('dragging'), 0);
        event.dataTransfer.effectAllowed = 'move';
        event.dataTransfer.setData('text/plain', assocDraggedItemId);
    }
    function handleAssocDragEnd() {
        if (assocDraggedItem) {
            assocDraggedItem.classList.remove('dragging');
        }
        // Remove lingering highlight on targets
        document.querySelectorAll('.drop-target.over').forEach(el => el.classList.remove('over'));

        assocDraggedItem = null;
        assocDraggedItemId = null;
        isDraggingFromTarget = false; // Reset state
    }
    function handleAssocDragOver(event) {
        event.preventDefault();
        const target = event.target.closest('.drop-target');

        // Can only drop onto an *unmatched* target
        if (target && !target.classList.contains('matched') && assocDraggedItemId) {
            event.dataTransfer.dropEffect = 'move';
            target.classList.add('over');
        } else {
            event.dataTransfer.dropEffect = 'none';
            if (target) target.classList.remove('over'); // Remove 'over' if not droppable
        }
        // Remove placeholder logic for left column as we don't drag back there anymore
        const currentPlaceholder = document.querySelector(`#matching-left-${currentQuestionIndex} .ordering-placeholder`);
        if (currentPlaceholder) {
            currentPlaceholder.remove();
        }
    }
    function handleAssocDragLeave(event) {
        const target = event.target.closest('.drop-target');
        if (target) {
            // Delay removal slightly to avoid flicker
            setTimeout(() => { if (!target.matches(':hover')) target.classList.remove('over'); }, 50);
        }
    }
    function handleAssocDrop(event) {
        event.preventDefault();
        const target = event.target.closest('.drop-target');
        const droppedItemId = event.dataTransfer.getData('text/plain');
        const questionBlock = target?.closest('.question-block');

        if (!target || !droppedItemId || !questionBlock || target.classList.contains('matched')) {
            console.warn("Assoc Drop failed: Invalid target or data, or target already matched.");
            // Cleanup just in case
            if (target) target.classList.remove('over');
            handleAssocDragEnd(); // Ensure state is reset
            return;
        }

        target.classList.remove('over');
        const sourceItemElement = questionBlock.querySelector(`.matching-item[data-item-id="${droppedItemId}"]`);

        if (!sourceItemElement) {
            console.warn("Assoc Drop failed: Source item element not found for ID:", droppedItemId);
            handleAssocDragEnd();
            return;
        }

        // --- Update the target ---
        target.textContent = ''; // Clear placeholder text
        target.innerHTML = sourceItemElement.innerHTML; // Copy content (already rendered markdown)
        target.classList.add('matched');
        target.dataset.pairedItemId = droppedItemId; // Store which item is inside
        // target.setAttribute('draggable', 'true'); // <<--- REMOVE THIS LINE

        // --- ADD CLICK LISTENER TO RETURN ITEM ---
        target.addEventListener('click', handleReturnItemToLeft);
        target.style.cursor = 'pointer'; // Indicate clickability
        target.title = "Cliquez pour renvoyer l'élément à gauche"; // Add tooltip


        // --- Hide the original item from the left column ---
        sourceItemElement.classList.add('matched'); // Visually hide/dim
        sourceItemElement.setAttribute('draggable', 'false'); // Make original non-draggable

        playSound('click');
        handleAssocDragEnd(); // Reset drag state
    }
    function handleReturnItemToLeft(event) {
        const target = event.target.closest('.drop-target.matched');
        if (!target || !isQuizActive) return; // Only act on matched targets during active quiz

        const pairedItemId = target.dataset.pairedItemId;
        const questionBlock = target.closest('.question-block');
        if (!pairedItemId || !questionBlock) return;

        const originalItem = questionBlock.querySelector(`.matching-item[data-item-id="${pairedItemId}"]`);
        const leftContainer = questionBlock.querySelector('.matching-column[id^="matching-left-"]');

        if (originalItem && leftContainer) {
            // Reset the target
            target.textContent = 'Déposez ici'; // Restore placeholder
            target.classList.remove('matched');
            target.removeAttribute('data-paired-item-id');
            target.removeEventListener('click', handleReturnItemToLeft); // Remove the listener
            target.style.cursor = 'default';
            target.title = ""; // Remove tooltip

            // Restore the original item
            originalItem.classList.remove('matched');
            originalItem.setAttribute('draggable', 'true');
            leftContainer.appendChild(originalItem); // Append back to the left column

            playSound('click'); // Or a different sound for 'undo'
        } else {
            console.warn("Could not return item: Original item or left container not found.");
        }
    }

    // --- Answering Logic ---

    function handleAnswerSelection(event) {
        if (isSubmittingAnswer || !isQuizActive) return;
        const targetElement = event.target;
        const questionBlock = targetElement.closest('.question-block');
        if (!questionBlock) return;

        const questionIndex = parseInt(questionBlock.dataset.index, 10);
        const question = questionsToAsk[questionIndex];
        let userAnswer;
        let isValidInput = true; // Flag for types needing validation

        // --- Extract User Answer Based on Type ---
        switch (question.type) {
            case 'qcm':
            case 'vrai_faux':
                const selectedButton = targetElement.closest('button.answer-btn');
                if (!selectedButton) return; // Clicked outside button
                const answerString = selectedButton.dataset.answer;
                userAnswer = (answerString === 'true') ? true : (answerString === 'false' ? false : answerString);
                questionBlock.querySelectorAll('.answer-options button').forEach(btn => btn.classList.remove('selected'));
                selectedButton.classList.add('selected');
                break;
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
                if (!targetElement.classList.contains('submit-answer-btn')) return; // Only trigger on submit button
                userAnswer = {};
                questionBlock.querySelectorAll('.drop-target.matched').forEach(target => {
                    const targetId = target.dataset.targetId;
                    const pairedItemId = target.dataset.pairedItemId;
                    if (targetId && pairedItemId) {
                        // Map: Right Target ID -> Left Item ID chosen by user
                        userAnswer[targetId] = pairedItemId;
                    }
                });
                // Optional: Check if all targets are filled
                const totalTargets = questionBlock.querySelectorAll('.drop-target').length;
                if (Object.keys(userAnswer).length !== totalTargets) {
                    showToast("Veuillez associer tous les éléments.", "warning");
                    isValidInput = false;
                }
                break;
            case 'ordre':
                if (!targetElement.classList.contains('submit-answer-btn')) return; // Only trigger on submit button
                userAnswer = Array.from(questionBlock.querySelectorAll('.answer-options.ordre .ordering-item'))
                    .map(item => item.textContent); // Get text content in current order
                break;
            default:
                console.error("Unknown question type in handleAnswerSelection:", question.type);
                return;
        }

        if (!isValidInput) return; // Stop if input was invalid

        isSubmittingAnswer = true; // Lock processing
        disableQuestionBlockInputs(questionBlock);
        processAnswer(questionIndex, userAnswer);

        // Feedback & Advance Logic
        if (currentQuizConfig.instantFeedback) {
            showImmediateFeedback(questionBlock, userAnswers[questionIndex].isCorrect);
            playSound(userAnswers[questionIndex].isCorrect ? 'correct' : 'incorrect');
            setTimeout(advanceQuestion, FEEDBACK_DELAY);
        } else {
            playSound('click');
            setTimeout(advanceQuestion, ADVANCE_DELAY);
        }
    }

    function disableQuestionBlockInputs(questionBlock) {
        questionBlock.querySelectorAll('button, input, select, textarea').forEach(el => el.disabled = true);
        questionBlock.querySelectorAll('.matching-item, .ordering-item, .drop-target').forEach(el => {
            el.setAttribute('draggable', 'false');
            el.style.cursor = 'default';
            el.classList.remove('over');
            if (el.classList.contains('drop-target')) {
                el.removeEventListener('click', handleReturnItemToLeft); // Remove click listener on disable
                el.title = ""; // Remove tooltip
            }
        });
    }

    function enableQuestionBlockInputs(questionBlock) {
        questionBlock.querySelectorAll('button:not(.flashcard-correct):not(.flashcard-incorrect), input, select, textarea').forEach(el => el.disabled = false);
        questionBlock.querySelectorAll('.matching-item:not(.matched)').forEach(el => { el.setAttribute('draggable', 'true'); el.style.cursor = 'grab'; });
        questionBlock.querySelectorAll('.ordering-item').forEach(el => { el.setAttribute('draggable', 'true'); el.style.cursor = 'grab'; });
        questionBlock.querySelectorAll('.drop-target').forEach(el => {
            if (el.classList.contains('matched')) {
                el.style.cursor = 'pointer';
                el.title = "Cliquez pour renvoyer l'élément à gauche";
                el.addEventListener('click', handleReturnItemToLeft); // RE-ADD listener
            } else {
                el.style.cursor = 'default';
                el.title = "";
                el.removeEventListener('click', handleReturnItemToLeft); // Ensure no listener if not matched
            }
        });
    }

    /** Restores visual selection state when navigating back */
    function restoreAnswerSelectionUI(questionBlock, answer, type) {
        if (answer === null || answer === undefined) return; // No previous answer

        switch (type) {
            case 'qcm':
            case 'vrai_faux':
                const btnToSelect = questionBlock.querySelector(`.answer-options button[data-answer="${answer}"]`);
                if (btnToSelect) btnToSelect.classList.add('selected');
                break;
            case 'texte_libre':
                const inputEl = questionBlock.querySelector('.answer-options input[type="text"]');
                if (inputEl) inputEl.value = answer;
                break;
            case 'qcm_multi':
                questionBlock.querySelectorAll('.answer-options input[type="checkbox"]').forEach(cb => {
                    cb.checked = answer.includes(cb.value); // Answer is sorted array
                });
                break;
            case 'ordre':
                // Reconstruct the order - assumes answer is the ordered array of textContents
                const currentItems = Array.from(questionBlock.querySelectorAll('.answer-options.ordre .ordering-item'));
                const container = questionBlock.querySelector('.answer-options.ordre');
                if (!container) break;
                // Clear container first (except submit button)
                const submitBtn = container.querySelector('.submit-answer-btn');
                container.innerHTML = ''; // Clear
                // Append items in the saved order
                answer.forEach(itemText => {
                    const item = currentItems.find(el => el.textContent === itemText);
                    if (item) container.appendChild(item);
                });
                if (submitBtn) container.appendChild(submitBtn); // Re-append button
                break;
            case 'association':
                // Reconstruct matched pairs - answer is { targetId: itemId }
                const leftContainer = questionBlock.querySelector('.matching-column[id^="matching-left-"]');
                questionBlock.querySelectorAll('.drop-target').forEach(target => {
                    const targetId = target.dataset.targetId;
                    const correctItemId = answer ? answer[targetId] : null; // Check if answer exists

                    // Clear previous state first
                    target.textContent = 'Déposez ici';
                    target.classList.remove('matched');
                    target.removeAttribute('data-paired-item-id');
                    target.removeEventListener('click', handleReturnItemToLeft); // Remove potential old listener
                    target.style.cursor = 'default';
                    target.title = "";

                    if (correctItemId) {
                        target.innerHTML = renderMarkdown(correctItemId); // Assume correctItemId is the text to display
                        target.classList.add('matched');
                        target.dataset.pairedItemId = correctItemId;
                        target.addEventListener('click', handleReturnItemToLeft); // ADD LISTENER HERE
                        target.style.cursor = 'pointer';
                        target.title = "Cliquez pour renvoyer l'élément à gauche";

                        // Hide corresponding left item
                        const leftItem = leftContainer?.querySelector(`.matching-item[data-item-id="${correctItemId}"]`);
                        if (leftItem) {
                            leftItem.classList.add('matched');
                            leftItem.setAttribute('draggable', 'false');
                        }
                    }
                });
                // Ensure items not in any target are visible on the left (like before)
                leftContainer?.querySelectorAll('.matching-item').forEach(item => {
                    const itemId = item.dataset.itemId;
                    let isMatched = false;
                    if (answer) { // Check only if answer data exists
                        for (const targetId in answer) {
                            if (answer[targetId] === itemId) { isMatched = true; break; }
                        }
                    }
                    item.classList.toggle('matched', isMatched);
                    item.setAttribute('draggable', !isMatched);
                });

                break;
        }
    }

    function showImmediateFeedback(questionBlock, isCorrect) {
        const feedbackDiv = questionBlock.querySelector('.immediate-feedback');
        if (!feedbackDiv) return;

        const textSpan = feedbackDiv.querySelector('.feedback-text');
        feedbackDiv.classList.remove('hidden', 'correct', 'incorrect', 'visible');
        textSpan.innerHTML = ''; // Clear previous text/HTML

        let feedbackTextHTML = isCorrect ? "Correct !" : "Incorrect.";
        if (!isCorrect && currentQuizConfig.showExpl) {
            // Show correct answer and explanation immediately
            const question = questionsToAsk[currentQuestionIndex];
            const correctAnswerFormatted = formatAnswerForDisplay(question.correctAnswer, question.type);
            feedbackTextHTML += `<span class="feedback-correct-answer">Bonne réponse : ${correctAnswerFormatted}</span>`;
            if (question.explanation) {
                feedbackTextHTML += `<p class="explanation" style="margin-top: 8px; font-size: 0.9em;">${renderMarkdown(question.explanation)}</p>`;
            }
        }

        feedbackDiv.classList.add(isCorrect ? 'correct' : 'incorrect');
        textSpan.innerHTML = feedbackTextHTML; // Use innerHTML for potential HTML in feedback

        setTimeout(() => feedbackDiv.classList.add('visible'), 10);
    }

    // --- REMPLACER la fonction processAnswer existante par celle-ci ---

    function processAnswer(questionIndex, userAnswer) {
        if (userAnswers[questionIndex] === null) {
            // First time answering this question in this session
            userAnswers[questionIndex] = { marked: false }; // Initialize if needed
        }

        const question = questionsToAsk[questionIndex];
        const correctAnswer = question.correctAnswer;
        const pointsPossible = question.points ?? 10;
        let isCorrect = false;
        const timeTaken = (Date.now() - questionStartTime) / 1000;

        // --- Check Correctness (Copier/coller la logique de comparaison de l'ancienne fonction ici) ---
        try {
            switch (question.type) {
                case 'vrai_faux':
                    isCorrect = userAnswer === correctAnswer; break;
                case 'qcm':
                    isCorrect = String(userAnswer).toLowerCase() === String(correctAnswer).toLowerCase(); break;
                case 'texte_libre':
                    isCorrect = String(userAnswer).trim().toLowerCase() === String(correctAnswer).trim().toLowerCase(); break;
                case 'qcm_multi':
                    const correctSorted = [...(Array.isArray(correctAnswer) ? correctAnswer : [correctAnswer])].sort();
                    isCorrect = JSON.stringify(userAnswer) === JSON.stringify(correctSorted); break; // userAnswer is already sorted array
                case 'ordre':
                    const correctOrder = Array.isArray(correctAnswer) ? correctAnswer : [];
                    const userOrder = Array.isArray(userAnswer) ? userAnswer : [];
                    isCorrect = JSON.stringify(userOrder) === JSON.stringify(correctOrder); break;
                case 'association':
                    const correctMap = typeof correctAnswer === 'object' ? correctAnswer : {};
                    const userMap = typeof userAnswer === 'object' ? userAnswer : {};
                    let allMatch = true;
                    const allLeftItems = question.items_left || [];
                    const allRightTargets = question.items_right || [];
                    if (allLeftItems.length !== allRightTargets.length || Object.keys(correctMap).length !== allLeftItems.length) {
                        allMatch = false;
                    } else {
                        for (const leftItem of allLeftItems) {
                            const correctTarget = correctMap[leftItem];
                            let userChoiceForTarget = null;
                            for (const targetIdKey in userMap) {
                                if (targetIdKey === correctTarget) { userChoiceForTarget = userMap[targetIdKey]; break; }
                            }
                            if (userChoiceForTarget !== leftItem) { allMatch = false; break; }
                        }
                        if (Object.keys(userMap).length !== allRightTargets.length) { allMatch = false; }
                    }
                    isCorrect = allMatch;
                    break;
                default: isCorrect = false;
            }
        } catch (e) { console.error("Error checking answer:", e); isCorrect = false; }
        // --- Fin de la logique de comparaison ---

        const pointsEarned = isCorrect ? pointsPossible : 0;

        // Update the specific answer entry
        userAnswers[questionIndex] = {
            ...userAnswers[questionIndex], // Preserve existing properties like 'marked'
            questionId: question.id || `q_${selectedQuizId}_${question.originalIndex ?? questionIndex}`,
            answer: userAnswer,
            isCorrect: isCorrect,
            pointsEarned: pointsEarned,
            timeTaken: parseFloat(timeTaken.toFixed(2)),
            // marked: is already preserved by spread operator
        };

        // Recalculate total score, points, and streaks based on the *entire* userAnswers array
        recalculateCurrentSessionStats();

        updateQuizHeader(); // Update UI with recalculated stats
    }

    // --- AJOUTER cette nouvelle fonction ---
    /** Recalculates score, totalPoints, currentStreak, and maxStreak based on the userAnswers array */
    function recalculateCurrentSessionStats() {
        let currentSessionScore = 0;
        let currentSessionPoints = 0;
        let currentSessionStreak = 0;
        let maxSessionStreak = 0;

        for (let i = 0; i < userAnswers.length; i++) {
            const answer = userAnswers[i];
            if (answer !== null) { // Only consider answered questions
                if (answer.isCorrect) {
                    currentSessionScore++;
                    currentSessionPoints += answer.pointsEarned;
                    currentSessionStreak++;
                } else {
                    maxSessionStreak = Math.max(maxSessionStreak, currentSessionStreak);
                    currentSessionStreak = 0;
                }
            } else {
                // If a question is skipped (null), reset streak
                maxSessionStreak = Math.max(maxSessionStreak, currentSessionStreak);
                currentSessionStreak = 0;
            }
        }
        // Final check for streak at the end
        maxSessionStreak = Math.max(maxSessionStreak, currentSessionStreak);

        // Update global state variables for the current session
        score = currentSessionScore;
        totalPoints = currentSessionPoints;
        currentStreak = currentSessionStreak; // Reflect streak at the *current* position
        maxStreak = maxSessionStreak; // Reflect max streak achieved *so far*
    }

    function advanceQuestion() {
        isSubmittingAnswer = false; // Unlock for next question

        // Hide feedback from previous question
        const currentBlock = quizContentArea.querySelector(`.question-block[data-index="${currentQuestionIndex}"]`);
        if (currentBlock) {
            const feedbackDiv = currentBlock.querySelector('.immediate-feedback');
            if (feedbackDiv) feedbackDiv.classList.remove('visible');
        }


        const nextIndex = currentQuestionIndex + 1;
        if (nextIndex < questionsToAsk.length) {
            displayQuestion(nextIndex);
        } else {
            // Quiz finished
            isQuizActive = false;
            clearInterval(timerInterval);
            if (!quizEndTime) quizEndTime = Date.now();
            finishQuizBtn.classList.remove('hidden');
            cancelQuizBtn.classList.add('hidden');
            updateQuestionGridNav(); // Update grid to final state
            showToast("Session terminée ! Cliquez sur 'Voir les Résultats'.", "success");
            playSound('finish');
            finishQuizBtn.scrollIntoView({ behavior: 'smooth', block: 'center' });
            // Results are shown when user clicks the button
        }
    }

    function handleMarkQuestion(event) {
        const button = event.target;
        const index = parseInt(button.dataset.questionIndex, 10);
        if (isNaN(index) || index < 0 || index >= questionsToAsk.length) return;

        // Ensure answer entry exists
        if (userAnswers[index] === null) {
            userAnswers[index] = { marked: false }; // Initialize minimally
        }
        userAnswers[index].marked = !userAnswers[index].marked;

        // Update UI
        button.textContent = userAnswers[index].marked ? '🌟' : '⭐';
        button.title = userAnswers[index].marked ? "Ne plus marquer" : "Marquer cette question";
        button.classList.toggle('marked', userAnswers[index].marked);
        showToast(`Question ${index + 1} ${userAnswers[index].marked ? 'marquée' : 'démárquée'}.`, 'info', 1500);
        playSound('click');
        // No backend call needed for local version
    }

    function forceFinishQuiz(timedOut = false) {
        if (!isQuizActive && !timedOut) return;
        if (!questionsToAsk || questionsToAsk.length === 0) return;

        console.log(`Forcing quiz finish. Timed out: ${timedOut}`);
        isQuizActive = false;
        clearInterval(timerInterval);
        if (!quizEndTime) quizEndTime = Date.now();

        // Mark remaining as unanswered
        questionsToAsk.forEach((q, index) => {
            if (userAnswers[index] === null) {
                const isMarked = false; // Cannot mark unanswered questions this way
                userAnswers[index] = {
                    questionId: q.id || `q_${selectedQuizId}_${q.originalIndex ?? index}`,
                    answer: null, isCorrect: false, pointsEarned: 0, timeTaken: null, marked: isMarked
                };
            }
            // Disable current block if visible
            const block = quizContentArea.querySelector(`.question-block[data-index="${index}"]`);
            if (block && index === currentQuestionIndex) disableQuestionBlockInputs(block);
        });

        updateQuestionGridNav();
        cancelQuizBtn.classList.add('hidden');
        finishQuizBtn.classList.add('hidden'); // Hide finish button too

        showResults(); // Go directly to results
    }

    function handleCancelQuiz() {
        if (!isQuizActive) return;
        if (confirm("Êtes-vous sûr de vouloir abandonner cette session ? Votre progression ne sera pas sauvegardée.")) {
            isQuizActive = false;
            clearInterval(timerInterval);
            // Reset state *without* saving attempt
            // Keep quizLibrary, localHistory, localStats, userPreferences
            selectedQuizId = null; // Deselect quiz
            activeQuizContent = null;
            currentQuizConfig = {};
            questionsToAsk = [];
            currentQuestionIndex = 0;
            userAnswers = [];
            score = 0; totalPoints = 0; currentStreak = 0; maxStreak = 0;
            timerInterval = null; timeLeft = 0; startTime = 0; quizEndTime = 0;

            showToast("Session abandonnée.", "info");
            showScreen('dashboard'); // Return to dashboard (will re-render library etc.)
        }
    }

    // --- Results Logic ---

    function showResults() {
        if (!quizEndTime) quizEndTime = Date.now(); // Ensure end time
        clearInterval(timerInterval); // Ensure timer stopped

        // Final Calculations
        const timeElapsedSeconds = Math.max(0, (quizEndTime - startTime) / 1000);
        const minutes = Math.floor(timeElapsedSeconds / 60);
        const seconds = Math.floor(timeElapsedSeconds % 60);
        const timeTakenString = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
        const accuracy = questionsToAsk.length > 0 ? ((score / questionsToAsk.length) * 100) : 0;

        // Populate Summary
        resultsQuizTitle.textContent = currentQuizConfig.quizTitle;
        scoreSummary.textContent = `Score: ${score} / ${questionsToAsk.length} (${totalPoints} pts)`;
        timeTakenDisplay.textContent = `Temps: ${timeTakenString}`;
        accuracyDisplay.textContent = `Précision: ${accuracy.toFixed(1)}%`;

        // Calculate Achievements (Local Example)
        const achievements = [];
        if (accuracy >= 100 && questionsToAsk.length > 0) achievements.push({ id: 'perfect_score', name: 'Score Parfait ! 🎉' });
        if (maxStreak >= 5) achievements.push({ id: `streak_${maxStreak}`, name: `Série de ${maxStreak} 🔥` });
        if (timeElapsedSeconds < 60 && questionsToAsk.length >= 10) achievements.push({ id: 'quick', name: 'Rapide ! ⚡️' });
        displayAchievements(achievements);

        // Prepare attempt data for history
        const attemptData = {
            // Generate a simple unique ID for local history entries
            attemptId: `local_${Date.now()}_${Math.random().toString(16).substring(2, 8)}`,
            quizId: currentQuizConfig.quizId, // Link to the quiz
            quizTitle: currentQuizConfig.quizTitle, // Denormalize for easier display
            score: `${score} / ${questionsToAsk.length}`,
            points: totalPoints,
            accuracy: parseFloat(accuracy.toFixed(1)),
            timeTaken: timeTakenString,
            timeElapsedSeconds: parseFloat(timeElapsedSeconds.toFixed(2)),
            mode: currentQuizConfig.mode,
            date: new Date(startTime).toISOString(),
            totalQuestions: questionsToAsk.length,
            maxStreak: maxStreak,
            achievements: achievements.map(a => a.id), // Store achievement IDs
            // Store answers with minimal needed info for replay/stats
            answers: userAnswers.map(a => ({
                questionId: a?.questionId, // Critical for matching back to original question
                isCorrect: a?.isCorrect,
                marked: a?.marked
                // Maybe store user answer value too for detailed review later? Could increase storage size.
                // answer: a?.answer // Optional: uncomment to store user's answer value
            }))
        };

        saveQuizAttempt(attemptData); // Save to local history & update stats

        // Display detailed results and comparison AFTER saving
        displayDetailedResults();
        displayLocalComparison();
        // Show/hide restart errors button based on current results
        const hasErrors = userAnswers.some(a => a && !a.isCorrect);
        restartErrorsBtn.classList.toggle('hidden', !hasErrors);
        restartErrorsBtn.textContent = `Refaire les erreurs (${userAnswers.filter(a => a && !a.isCorrect).length})`; // Update count

        showScreen('results');
        playSound('finish'); // Or applause sound

        // Refresh history on dashboard in background
        displayScoreHistory();
        populateHistoryFilter();
    }

    function saveQuizAttempt(attemptData) {
        // 1. Add to local history array
        localHistory.push(attemptData);
        saveLocalHistory(); // Save updated history array to localStorage

        // 2. Update local aggregated statistics
        recalculateLocalStats(); // Recalculate and save stats based on the new history

        console.log("Attempt saved to local history & stats updated.");
    }

    function displayDetailedResults() {
        detailedResultsDiv.innerHTML = ''; // Clear previous
        if (!questionsToAsk || !userAnswers || questionsToAsk.length !== userAnswers.length) {
            detailedResultsDiv.innerHTML = "<p class='error-message'>Erreur affichage résultats détaillés.</p>"; return;
        }

        // Reset filters visually
        detailedResultsFiltersDiv.querySelectorAll('.btn-filter').forEach(btn => btn.classList.remove('active'));
        detailedResultsFiltersDiv.querySelector('.btn-filter[data-filter="all"]').classList.add('active');


        questionsToAsk.forEach((question, index) => {
            const userAnswerEntry = userAnswers[index];
            if (!userAnswerEntry) return; // Should not happen if logic is correct

            const resultItem = document.createElement('div');
            resultItem.classList.add('result-item');
            const questionId = userAnswerEntry.questionId || `q_${currentQuizConfig.quizId}_${question.originalIndex ?? index}`;
            resultItem.dataset.questionId = questionId; // Use the ID stored in the answer

            const isCorrect = userAnswerEntry.isCorrect;
            const isUnanswered = userAnswerEntry.answer === null;
            const isMarked = userAnswerEntry.marked;

            resultItem.classList.add(isUnanswered ? 'unanswered' : (isCorrect ? 'correct' : 'incorrect'));
            if (isMarked) resultItem.classList.add('is-marked-result'); // Add class for filtering by marked

            let resultHTML = `
                <div class="result-question-header">
                     <p class="question-text-result">Q${index + 1}: ${renderMarkdown(question.text)}</p>
                     <button class="mark-question-btn-result ${isMarked ? 'marked' : ''}" data-question-index="${index}" title="${isMarked ? 'Ne plus marquer' : 'Marquer cette question'}">
                         ${isMarked ? '🌟' : '⭐'}
                     </button>
                 </div>
            `;
            if (isUnanswered) {
                resultHTML += `<p class="unanswered-text"><i>Non répondu</i></p>`;
            } else {
                resultHTML += `<p class="user-answer ${isCorrect ? 'correct' : 'incorrect'}">Votre réponse: ${formatAnswerForDisplay(userAnswerEntry.answer, question.type)}</p>`;
            }
            if (!isCorrect) {
                resultHTML += `<p class="correct-answer-text">Bonne réponse: ${formatAnswerForDisplay(question.correctAnswer, question.type)}</p>`;
            }
            resultHTML += `<p class="explanation">Explication: ${renderMarkdown(question.explanation)}</p>`;
            resultItem.innerHTML = resultHTML;

            // Add listener for marking
            resultItem.querySelector('.mark-question-btn-result').addEventListener('click', handleMarkQuestionFromResult);
            detailedResultsDiv.appendChild(resultItem);
        });
    }

    function formatAnswerForDisplay(answerValue, questionType) {
        if (answerValue === null || answerValue === undefined) return '<i>N/A</i>';
        let displayString = '';
        try {
            if (questionType === 'vrai_faux') displayString = answerValue ? 'Vrai' : 'Faux';
            else if (Array.isArray(answerValue)) displayString = answerValue.map(val => renderMarkdown(String(val))).join(questionType === 'ordre' ? ' → ' : ', '); // Render markdown within array items too
            else if (questionType === 'association' && typeof answerValue === 'object') {
                displayString = Object.entries(answerValue).map(([key, value]) => `${renderMarkdown(key)} → ${renderMarkdown(value)}`).join('<br>');
            }
            else displayString = renderMarkdown(String(answerValue)); // Render markdown for simple answers too
        } catch (e) {
            console.warn("Error formatting answer:", answerValue, e);
            // Basic text fallback
            const tempDiv = document.createElement('div');
            tempDiv.textContent = String(answerValue);
            displayString = tempDiv.innerHTML; // Basic HTML escaping
        }
        return displayString;
    }

    function handleMarkQuestionFromResult(event) {
        const button = event.target;
        const index = parseInt(button.dataset.questionIndex, 10); // Index *within the current results view*
        if (isNaN(index) || index < 0 || index >= userAnswers.length || !userAnswers[index]) return;

        userAnswers[index].marked = !userAnswers[index].marked; // Toggle state in the current view's data

        // Update UI
        button.textContent = userAnswers[index].marked ? '🌟' : '⭐';
        button.title = userAnswers[index].marked ? "Ne plus marquer" : "Marquer cette question";
        button.classList.toggle('marked', userAnswers[index].marked);
        button.closest('.result-item')?.classList.toggle('is-marked-result', userAnswers[index].marked); // Update filter class
        showToast(`Question ${index + 1} ${userAnswers[index].marked ? 'marquée' : 'démárquée'}.`, 'info', 1500);
        playSound('click');

        // Persist this change immediately by updating the specific attempt in localHistory
        // Find the attempt this result screen corresponds to (might need to store attemptId on results screen)
        // For now, assume userAnswers IS the data for the latest attempt that needs updating in localHistory
        const latestAttempt = localHistory[localHistory.length - 1];
        if (latestAttempt && latestAttempt.answers && latestAttempt.answers.length === userAnswers.length) {
            // Find the corresponding answer entry by questionId if possible, or index as fallback
            const answerToUpdate = latestAttempt.answers.find(a => a.questionId === userAnswers[index].questionId) || latestAttempt.answers[index];
            if (answerToUpdate) {
                answerToUpdate.marked = userAnswers[index].marked;
                saveLocalHistory(); // Save the change
            } else {
                console.warn("Could not find corresponding answer in history to save marked status.");
            }
        } else {
            console.warn("Could not reliably save marked status to history.");
        }
    }

    function handleFilterResults(event) {
        const filterType = event.target.dataset.filter;
        if (!filterType) return;

        // Update active button style
        detailedResultsFiltersDiv.querySelectorAll('.btn-filter').forEach(btn => btn.classList.remove('active'));
        event.target.classList.add('active');

        // Apply filtering via CSS classes
        detailedResultsDiv.querySelectorAll('.result-item').forEach(item => {
            let show = false;
            if (filterType === 'all') {
                show = true;
            } else if (filterType === 'incorrect') {
                show = item.classList.contains('incorrect') || item.classList.contains('unanswered');
            } else if (filterType === 'marked') {
                // Use the class added in displayDetailedResults / handleMarkQuestionFromResult
                show = item.classList.contains('is-marked-result');
            }
            item.classList.toggle('hidden-by-filter', !show);
        });
    }


    function displayAchievements(achievements = []) {
        resultsAchievementsDiv.innerHTML = '';
        resultsAchievementsDiv.classList.toggle('hidden', achievements.length === 0);
        achievements.forEach(ach => {
            const badge = document.createElement('span');
            badge.classList.add('achievement-badge');
            badge.textContent = ach.name || ach.id;
            badge.title = ach.description || '';
            resultsAchievementsDiv.appendChild(badge);
        });
    }

    function displayLocalComparison() {
        localComparisonP.classList.add('hidden'); // Hide by default
        if (!currentQuizConfig.quizId || localHistory.length < 2) return; // Need history and current quiz ID

        const historyForThisQuiz = localHistory.filter(a => a.quizId === currentQuizConfig.quizId && a.attemptId !== localHistory[localHistory.length - 1].attemptId); // Exclude current attempt
        if (historyForThisQuiz.length === 0) return;

        const totalAccuracy = historyForThisQuiz.reduce((sum, a) => sum + (a.accuracy || 0), 0);
        const avgAccuracy = totalAccuracy / historyForThisQuiz.length;

        localComparisonP.textContent = `Votre moyenne locale précédente sur ce quiz : ${avgAccuracy.toFixed(1)}%`;
        localComparisonP.classList.remove('hidden');
    }


    // --- Post-Quiz Action Handlers ---

    function handleRestartQuiz() {
        // Config and questions are already in currentQuizConfig and questionsToAsk
        if (!activeQuizContent || !currentQuizConfig.quizId || questionsToAsk.length === 0) {
            showToast("Impossible de relancer : données du quiz manquantes.", "error");
            showScreen('dashboard'); return;
        }
        // Re-use the *exact same* question array (questionsToAsk)
        // Don't reshuffle if it was already shuffled or ordered for errors mode
        console.log("Restarting quiz with same questions...");

        // Reset state
        currentQuestionIndex = 0;
        userAnswers = new Array(questionsToAsk.length).fill(null);
        score = 0; totalPoints = 0; currentStreak = 0; maxStreak = 0;
        startTime = Date.now(); questionStartTime = 0; quizEndTime = 0;
        isQuizActive = true; isSubmittingAnswer = false;
        timeLeft = currentQuizConfig.timeLimit;

        setupQuizUI();
        showScreen('quiz');
        displayQuestion(currentQuestionIndex);
    }

    function handleRestartErrors() {
        if (!activeQuizContent || !currentQuizConfig.quizId) {
            showToast("Impossible de relancer les erreurs : quiz non chargé.", "error"); return;
        }
        // Get error questions from the *last* completed attempt (userAnswers)
        const errorQuestionsFromLastAttempt = userAnswers
            .map((answer, index) => (answer && !answer.isCorrect) ? questionsToAsk[index] : null)
            .filter(q => q !== null);

        if (errorQuestionsFromLastAttempt.length === 0) {
            showToast("Félicitations, aucune erreur dans cette session !", "success"); return;
        }
        console.log(`Restarting with ${errorQuestionsFromLastAttempt.length} error(s) from last session...`);

        // Use the filtered error questions
        questionsToAsk = shuffleArray(errorQuestionsFromLastAttempt); // Shuffle the errors
        questionsToAsk.forEach((q, idx) => q.quizSessionIndex = idx); // Re-index

        // Adapt current config
        currentQuizConfig = {
            ...currentQuizConfig,
            mode: 'errors-replay',
            numQuestions: questionsToAsk.length,
            quizTitle: `${currentQuizConfig.quizTitle} (Erreurs Session)`
            // Keep original time limit option? Or make it free? Let's keep it for now.
        };

        // Reset state
        currentQuestionIndex = 0;
        userAnswers = new Array(questionsToAsk.length).fill(null);
        score = 0; totalPoints = 0; currentStreak = 0; maxStreak = 0;
        startTime = Date.now(); questionStartTime = 0; quizEndTime = 0;
        isQuizActive = true; isSubmittingAnswer = false;
        timeLeft = currentQuizConfig.timeLimit; // Use potentially adapted time limit

        setupQuizUI();
        showScreen('quiz');
        displayQuestion(currentQuestionIndex);
    }

    function handleNewConfig() {
        if (activeQuizContent) {
            // Reset quiz state but keep quiz selected
            isQuizActive = false; clearInterval(timerInterval);
            // Keep selectedQuizId and activeQuizContent
            currentQuizConfig = {}; questionsToAsk = []; userAnswers = [];
            // Go back to dashboard - it will show the selected quiz and config options
            showScreen('dashboard');
            // Re-render library to ensure selection highlight is correct
            renderQuizLibrary();
            configOptionsDiv.classList.remove('hidden');
            resetConfigOptions(true); // Reset and prefill config
            startQuizBtn.disabled = false;
            updateErrorModeAvailability();
        } else {
            showToast("Aucun quiz chargé. Veuillez en sélectionner un.", "warning");
            showScreen('dashboard');
        }
    }

    function handleExportSession() {
        if (!currentQuizConfig.quizId || userAnswers.length === 0) {
            showToast("Aucune donnée de session à exporter.", "warning"); return;
        }

        let content = `Quiz Master - Résumé de Session\n`;
        content += `-------------------------------------\n`;
        content += `Quiz: ${currentQuizConfig.quizTitle} (ID: ${currentQuizConfig.quizId})\n`;
        content += `Date: ${new Date(startTime).toLocaleString('fr-FR')}\n`;
        content += `Mode: ${currentQuizConfig.mode}\n`;
        content += `Score: ${score} / ${questionsToAsk.length}\n`;
        content += `Points: ${totalPoints}\n`;
        content += `Précision: ${accuracyDisplay.textContent.split(': ')[1]}\n`;
        content += `Temps: ${timeTakenDisplay.textContent.split(': ')[1]}\n`;
        content += `Série Max: ${maxStreak}\n`;
        content += `-------------------------------------\n\n`;
        content += `Détail des Réponses:\n\n`;

        questionsToAsk.forEach((q, index) => {
            const ans = userAnswers[index];
            content += `Q${index + 1}: (${ans?.isCorrect ? 'Correct' : (ans?.answer === null ? 'Non Répondu' : 'Incorrect')}) ${ans?.marked ? '[⭐]' : ''}\n`;
            content += `   Question: ${q.text}\n`;
            if (ans?.answer !== null) {
                content += `   Votre Réponse: ${formatAnswerForTextExport(ans?.answer, q.type)}\n`;
            }
            if (!ans?.isCorrect) {
                content += `   Bonne Réponse: ${formatAnswerForTextExport(q.correctAnswer, q.type)}\n`;
            }
            content += `   Explication: ${q.explanation || '-'}\n\n`;
        });

        const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `QuizMaster_Session_${currentQuizConfig.quizId}_${new Date(startTime).toISOString().split('T')[0]}.txt`;
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
        if (Array.isArray(answerValue)) return answerValue.join(questionType === 'ordre' ? ' -> ' : ', ');
        if (questionType === 'association' && typeof answerValue === 'object') {
            return Object.entries(answerValue).map(([key, value]) => `${key} -> ${value}`).join('; ');
        }
        return String(answerValue);
    }


    // --- Settings & Stats Logic ---

    function renderSettingsScreen() {
        // Apply preferences to controls
        themeSelect.value = userPreferences.theme;
        soundEffectsToggle.checked = userPreferences.soundEnabled;

        // Render Global Stats
        generalStatsLocalDiv.querySelector('#stats-total-quizzes-local').textContent = localStats.totalQuizzes || 0;
        generalStatsLocalDiv.querySelector('#stats-total-answers-local').textContent = localStats.totalAnswers || 0;
        generalStatsLocalDiv.querySelector('#stats-avg-accuracy-local').textContent = `${(localStats.avgAccuracy || 0).toFixed(1)}%`;
        generalStatsLocalDiv.querySelector('#stats-longest-streak-local').textContent = localStats.longestStreak || 0;

        // Render Quiz Stats
        quizStatsLocalDiv.innerHTML = ''; // Clear
        const quizIdsWithStats = Object.keys(localStats.quizStats || {});
        if (quizIdsWithStats.length === 0) {
            quizStatsLocalDiv.innerHTML = '<p>Aucune statistique par quiz disponible.</p>';
        } else {
            let tableHTML = `<table><thead><tr><th>Quiz</th><th>Tentatives</th><th>Précision Moy.</th><th>Meilleur Score</th></tr></thead><tbody>`;
            quizIdsWithStats.forEach(quizId => {
                const stats = localStats.quizStats[quizId];
                const quizMeta = quizLibrary.find(q => q.quizId === quizId);
                const title = quizMeta?.title || `Quiz ID: ${quizId}`;
                tableHTML += `<tr>
                    <td>${title}</td>
                    <td>${stats.attempts || 0}</td>
                    <td>${(stats.avgAccuracy || 0).toFixed(1)}%</td>
                    <td>${stats.bestScore || 'N/A'} (${stats.bestPoints ?? '-'} pts)</td>
                 </tr>`;
            });
            tableHTML += `</tbody></table>`;
            quizStatsLocalDiv.innerHTML = tableHTML;
        }

        // Render Gamification
        localGamificationDiv.querySelector('#local-level').textContent = localStats.level || 1;
        localGamificationDiv.querySelector('#local-xp').textContent = `${localStats.xp || 0} / ${localStats.xpNextLevel || 100}`;
        badgesEarnedLocalDiv.innerHTML = ''; // Clear
        if (!localStats.badges || localStats.badges.length === 0) {
            badgesEarnedLocalDiv.innerHTML = '<p>Aucun badge local débloqué.</p>';
        } else {
            localStats.badges.forEach(badgeId => { // Assume badges are stored by ID
                // You might need a predefined badge dictionary here { id: { name, icon_url, desc }, ... }
                const badgeInfo = getBadgeInfo(badgeId); // Placeholder function
                const badgeElement = document.createElement('div');
                badgeElement.classList.add('badge');
                badgeElement.title = badgeInfo.description;
                badgeElement.innerHTML = `<img src="${badgeInfo.icon_url}" alt="${badgeInfo.name}"><span>${badgeInfo.name}</span>`;
                badgesEarnedLocalDiv.appendChild(badgeElement);
            });
        }
    }

    /** Placeholder function to get badge details from a predefined list */
    function getBadgeInfo(badgeId) {
        const badgeDictionary = {
            "perfect_score": { name: "Score Parfait", icon_url: "assets/images/badge_perfect.png", description: "Quiz terminé avec 100% de bonnes réponses." },
            "streak_5": { name: "Série de 5", icon_url: "assets/images/badge_streak5.png", description: "Réussi 5 questions d'affilée." },
            "streak_10": { name: "Série de 10", icon_url: "assets/images/badge_streak10.png", description: "Réussi 10 questions d'affilée." },
            "quick": { name: "Rapide", icon_url: "assets/images/badge_quick.png", description: "Quiz d'au moins 10 questions terminé en moins d'une minute." },
            "first_quiz": { name: "Premiers Pas", icon_url: "assets/images/badge_first.png", description: "Premier quiz terminé." },
            // Add more badges
        };
        const defaultBadge = { name: badgeId, icon_url: "assets/images/default_badge.png", description: "Badge inconnu" };
        return badgeDictionary[badgeId] || defaultBadge;
    }


    function handleThemeChange(event) {
        userPreferences.theme = event.target.value;
        applyTheme(userPreferences.theme);
        saveUserPreferences();
    }

    function handleSoundToggle(event) {
        userPreferences.soundEnabled = event.target.checked;
        saveUserPreferences();
    }

    function handleExportData() {
        if (!confirm("Exporter toutes vos données locales (bibliothèque, historique, statistiques, préférences) ?")) return;
        showLoader();
        try {
            const dataToExport = {
                version: "1.0-local", // Add versioning
                exportDate: new Date().toISOString(),
                preferences: userPreferences,
                quizLibrary: quizLibrary,
                // Include quiz content? Might make file huge. Maybe optional?
                // quizContents: quizLibrary.reduce((acc, meta) => {
                //     const content = loadQuizContent(meta.quizId);
                //     if (content) acc[meta.quizId] = content;
                //     return acc;
                // }, {}),
                history: localHistory,
                stats: localStats,
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

    function handleImportData() {
        if (!confirm("ATTENTION : L'importation fusionnera les données du fichier avec vos données locales actuelles (historique, bibliothèque, etc.). Les préférences seront écrasées. Sauvegardez vos données actuelles (Export) avant d'importer si nécessaire. Continuer ?")) return;

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

                    // --- Perform Merge ---
                    // Preferences: Overwrite
                    userPreferences = { ...loadUserPreferences(), ...importData.preferences };
                    applyTheme(userPreferences.theme); // Apply imported theme immediately

                    // Library: Merge, avoid duplicates by quizId
                    const currentLibraryIds = new Set(quizLibrary.map(q => q.quizId));
                    importData.quizLibrary.forEach(importedQuiz => {
                        if (!currentLibraryIds.has(importedQuiz.quizId)) {
                            quizLibrary.push(importedQuiz);
                            // Try to import content if it exists in the file (optional feature)
                            if (importData.quizContents && importData.quizContents[importedQuiz.quizId]) {
                                saveQuizContent(importedQuiz.quizId, importData.quizContents[importedQuiz.quizId]);
                            }
                        } else {
                            console.log(`Skipping import of quiz ${importedQuiz.quizId} - ID exists.`);
                            // Optionally offer to overwrite here? For now, just skip.
                        }
                    });

                    // History: Merge, avoid duplicates by attemptId (if exists) or combination? Be careful.
                    // Simple approach: just append, duplicates might occur if importing same file twice.
                    // Better: use a Set based on attemptId if available.
                    const currentHistoryIds = new Set(localHistory.map(a => a.attemptId).filter(Boolean));
                    importData.history.forEach(importedAttempt => {
                        if (!importedAttempt.attemptId || !currentHistoryIds.has(importedAttempt.attemptId)) {
                            localHistory.push(importedAttempt); // Add if ID is new or missing
                        }
                    });
                    // Sort history after merge
                    localHistory.sort((a, b) => new Date(b.date) - new Date(a.date));

                    // Stats: Overwrite with imported stats (simpler than merging complex stats)
                    localStats = { ...loadLocalStats(), ...importData.stats };

                    // --- Save Merged Data ---
                    saveUserPreferences();
                    saveQuizLibrary();
                    saveLocalHistory();
                    saveLocalStats();

                    showToast("Données importées et fusionnées avec succès ! Rafraîchissement...", "success");
                    // Reload UI to reflect changes fully
                    setTimeout(() => {
                        // Rerender necessary parts instead of full reload if possible
                        renderQuizLibrary();
                        displayScoreHistory();
                        populateHistoryFilter();
                        renderSettingsScreen(); // Update stats display
                        hideLoader();
                        showScreen('dashboard'); // Go to dashboard
                    }, 500);

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

    // --- Gamification & Stats Calculation ---

    /** Recalculates all local statistics based on the current localHistory */
    function recalculateLocalStats() {
        let totalQuizzes = 0;
        let totalAnswers = 0;
        let correctAnswers = 0;
        let totalPointsAgg = 0;
        let longestStreakOverall = 0;
        const quizStatsMap = {}; // { quizId: { attempts, totalQ, correctQ, totalPts, bestScore, bestPoints } }
        const earnedBadgeIds = new Set(localStats.badges || []); // Keep previously earned badges

        totalQuizzes = new Set(localHistory.map(a => a.attemptId)).size; // Count unique attempts

        localHistory.forEach(attempt => {
            const qId = attempt.quizId;
            if (!qId) return; // Skip attempts without quizId

            // Init quiz stats if first time seeing this quizId
            if (!quizStatsMap[qId]) {
                quizStatsMap[qId] = { attempts: 0, totalQ: 0, correctQ: 0, totalPts: 0, bestScoreNum: -1, bestScoreDen: 0, bestPoints: -Infinity, bestScore: 'N/A' };
            }
            const stats = quizStatsMap[qId];

            stats.attempts++;
            const attemptTotalQ = attempt.totalQuestions || attempt.answers?.length || 0;
            const attemptScoreParts = String(attempt.score || '0/0').split('/');
            const attemptCorrect = parseInt(attemptScoreParts[0], 10) || 0;
            const attemptTotal = parseInt(attemptScoreParts[1], 10) || attemptTotalQ; // Use score total if available
            const attemptPoints = attempt.points ?? 0;

            totalAnswers += attemptTotalQ;
            correctAnswers += attemptCorrect;
            totalPointsAgg += attemptPoints;
            longestStreakOverall = Math.max(longestStreakOverall, attempt.maxStreak || 0);

            stats.totalQ += attemptTotalQ;
            stats.correctQ += attemptCorrect;
            stats.totalPts += attemptPoints;

            // Update best score for this quiz
            const currentBestNum = stats.bestScoreNum;
            if (attemptCorrect > currentBestNum) {
                stats.bestScoreNum = attemptCorrect;
                stats.bestScoreDen = attemptTotal;
                stats.bestPoints = attemptPoints; // Also track points for best score
            } else if (attemptCorrect === currentBestNum && attemptPoints > stats.bestPoints) {
                // If scores are equal, prefer higher points
                stats.bestPoints = attemptPoints;
            }

            // Check for badges earned in this attempt
            (attempt.achievements || []).forEach(badgeId => earnedBadgeIds.add(badgeId));
        });

        // Calculate averages and final best scores
        const avgAccuracyOverall = totalAnswers > 0 ? (correctAnswers / totalAnswers * 100) : 0;
        Object.keys(quizStatsMap).forEach(qId => {
            const stats = quizStatsMap[qId];
            stats.avgAccuracy = stats.totalQ > 0 ? (stats.correctQ / stats.totalQ * 100) : 0;
            if (stats.bestScoreNum >= 0) {
                stats.bestScore = `${stats.bestScoreNum} / ${stats.bestScoreDen}`;
            }
        });

        // Simple Level/XP System (Example)
        let currentLevel = 1;
        let currentXP = totalPointsAgg; // XP = total points earned
        let xpForNext = 100; // XP needed for level 2
        while (currentXP >= xpForNext && currentLevel < 50) { // Level cap at 50
            currentXP -= xpForNext;
            currentLevel++;
            xpForNext = Math.floor(100 * Math.pow(1.2, currentLevel - 1)); // Exponential increase
        }


        // Update global localStats object
        localStats = {
            totalQuizzes: totalQuizzes,
            totalAnswers: totalAnswers,
            correctAnswers: correctAnswers, // Store raw counts if needed
            totalPoints: totalPointsAgg,
            avgAccuracy: avgAccuracyOverall,
            longestStreak: longestStreakOverall,
            quizStats: quizStatsMap,
            level: currentLevel,
            xp: currentXP,
            xpNextLevel: xpForNext,
            badges: Array.from(earnedBadgeIds) // Store unique badge IDs earned across all attempts
        };

        // Add 'first_quiz' badge if history exists and badge wasn't there before
        if (localHistory.length > 0 && !earnedBadgeIds.has('first_quiz')) {
            localStats.badges.push('first_quiz');
        }


        saveLocalStats(); // Save the recalculated stats
    }

    // --- Fullscreen API ---
    function toggleFullScreen() {
        const elem = document.documentElement; // Full page fullscreen
        if (!document.fullscreenElement && !document.mozFullScreenElement && !document.webkitFullscreenElement && !document.msFullscreenElement) {
            // Enter fullscreen
            if (elem.requestFullscreen) { elem.requestFullscreen(); }
            else if (elem.msRequestFullscreen) { elem.msRequestFullscreen(); }
            else if (elem.mozRequestFullScreen) { elem.mozRequestFullScreen(); }
            else if (elem.webkitRequestFullscreen) { elem.webkitRequestFullscreen(Element.ALLOW_KEYBOARD_INPUT); }
            isFullScreen = true;
        } else {
            // Exit fullscreen
            if (document.exitFullscreen) { document.exitFullscreen(); }
            else if (document.msExitFullscreen) { document.msExitFullscreen(); }
            else if (document.mozCancelFullScreen) { document.mozCancelFullScreen(); }
            else if (document.webkitExitFullscreen) { document.webkitExitFullscreen(); }
            isFullScreen = false;
        }
    }

    function updateFullscreenButton() {
        const isCurrentlyFullscreen = !!(document.fullscreenElement || document.mozFullScreenElement || document.webkitFullscreenElement || document.msFullscreenElement);
        isFullScreen = isCurrentlyFullscreen; // Sync state variable
        const exitIcon = fullscreenExitIcon;
        const enterIcon = fullscreenToggleBtn.querySelector('svg:not(#fullscreen-exit-icon)');

        if (exitIcon && enterIcon) {
            exitIcon.classList.toggle('hidden', !isFullScreen);
            enterIcon.classList.toggle('hidden', isFullScreen);
            fullscreenToggleBtn.title = isFullScreen ? "Quitter Plein Écran" : "Mode Plein Écran";
        }
    }


    // --- Initialization ---
    function init() {
        console.log("Quiz Master (Local Version) Initializing...");
        loadUserPreferences();
        loadQuizLibrary();
        loadQuizLibrary();
        loadLocalHistory();
        loadLocalStats();
        loadLastConfig();

        importDefaultQuizzes();

        applyTheme(userPreferences.theme);
        setupEventListeners();
        showScreen('dashboard'); // Start on dashboard
        hideLoader();
        console.log("Initialization Complete.");
    }

    // --- Event Listeners Setup ---
    function setupEventListeners() {
        // Dashboard
        fileInput.addEventListener('change', handleFileImport);
        fileInputLabelContainer.addEventListener('dragover', handleDragOver);
        fileInputLabelContainer.addEventListener('dragleave', handleDragLeave);
        fileInputLabelContainer.addEventListener('drop', handleDrop);
        importUrlBtn.addEventListener('click', handleUrlImport);
        configRadioButtons.forEach(radio => radio.addEventListener('change', handleConfigChange));
        allowNavigationCheckbox.addEventListener('change', handleConfigChange);
        instantFeedbackCheckbox.addEventListener('change', handleConfigChange);
        showExplOnIncorrectCheckbox.addEventListener('change', handleConfigChange); // Listen for changes
        errorSessionsCountInput.addEventListener('input', handleConfigChange); // Update if count changes
        startQuizBtn.addEventListener('click', startQuiz);
        historyFilterSelect.addEventListener('change', handleHistoryFilterChange);
        clearHistoryBtn.addEventListener('click', handleClearHistory);
        // Quiz Library listeners are added dynamically in renderQuizLibrary

        // Quiz Screen
        cancelQuizBtn.addEventListener('click', handleCancelQuiz);
        finishQuizBtn.addEventListener('click', showResults); // Finish button now directly calls showResults
        fullscreenToggleBtn.addEventListener('click', toggleFullScreen);
        document.addEventListener('fullscreenchange', updateFullscreenButton);
        document.addEventListener('webkitfullscreenchange', updateFullscreenButton);
        document.addEventListener('mozfullscreenchange', updateFullscreenButton);
        document.addEventListener('MSFullscreenChange', updateFullscreenButton);


        // Results Screen
        restartQuizBtn.addEventListener('click', handleRestartQuiz);
        restartErrorsBtn.addEventListener('click', handleRestartErrors);
        newConfigBtn.addEventListener('click', handleNewConfig);
        exportSessionBtn.addEventListener('click', handleExportSession);
        backToDashboardBtn.addEventListener('click', () => showScreen('dashboard'));
        detailedResultsFiltersDiv.addEventListener('click', (e) => { // Delegate filter clicks
            if (e.target.classList.contains('btn-filter')) {
                handleFilterResults(e);
            }
        });
        // Mark buttons listeners added dynamically in displayDetailedResults

        // Settings Screen
        themeSelect.addEventListener('change', handleThemeChange);
        soundEffectsToggle.addEventListener('change', handleSoundToggle);
        exportDataBtn.addEventListener('click', handleExportData);
        importDataBtn.addEventListener('click', handleImportData);
        backToDashboardFromSettingsBtn.addEventListener('click', () => showScreen('dashboard')); // Button to go back

        // Add listener to show Settings screen (e.g., a button somewhere?)
        // TEMP: For testing, add a button to the dashboard footer or header
        const settingsButtonTemp = document.createElement('button');
        settingsButtonTemp.textContent = '⚙️ Paramètres';
        settingsButtonTemp.style.position = 'fixed';
        settingsButtonTemp.style.bottom = '10px';
        settingsButtonTemp.style.left = '10px';
        settingsButtonTemp.style.zIndex = '1000';
        settingsButtonTemp.classList.add('btn-secondary');
        settingsButtonTemp.addEventListener('click', () => showScreen('settings'));
        document.body.appendChild(settingsButtonTemp); // Add directly to body for now

        console.log("Event listeners setup complete.");
    }

    // --- START ---
    init();
});