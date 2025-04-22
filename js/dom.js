// Select all DOM elements here and export them

export const screens = {
    dashboard: document.getElementById('dashboard-screen'),
    quiz: document.getElementById('quiz-screen'),
    results: document.getElementById('results-screen'),
    review: document.getElementById('review-screen'),
    settings: document.getElementById('settings-screen'),
};

export const bodyElement = document.body;
export const globalLoader = document.getElementById('global-loader');
export const toastContainer = document.getElementById('toast-notifications');

// --- Dashboard Elements ---
export const dashboard = {
    fileInput: document.getElementById('file-input'),
    fileInputLabel: document.querySelector('.file-input-label span'),
    fileInputLabelContainer: document.querySelector('.file-input-label'),
    dragDropOverlay: document.getElementById('drag-drop-overlay'),
    urlInput: document.getElementById('url-input'),
    importUrlBtn: document.getElementById('import-url-btn'),
    fileErrorMsg: document.getElementById('file-error'),
    fileSuccessMsg: document.getElementById('file-success'),
    quizLibraryDiv: document.getElementById('quiz-library'),
    configOptionsDiv: document.getElementById('config-options'),
    configRadioButtons: document.querySelectorAll('input[name="quiz-mode"]'),
    errorSessionsCountInput: document.getElementById('error-sessions-count'),
    customSettingsDiv: document.getElementById('custom-settings'),
    customTimeInput: document.getElementById('custom-time'),
    customQuestionsInput: document.getElementById('custom-questions'),
    allowNavigationCheckbox: document.getElementById('allow-navigation-checkbox'),
    instantFeedbackCheckbox: document.getElementById('instant-feedback-checkbox'),
    showExplOnIncorrectCheckbox: document.getElementById('show-expl-on-incorrect'),
    startQuizBtn: document.getElementById('start-quiz-btn'),
    scoreHistorySection: document.getElementById('score-history-section'), // Added
    scoreHistoryDiv: document.getElementById('score-history'),
    scoreHistoryControls: document.getElementById('score-history-controls'),
    historyFilterSelect: document.getElementById('history-filter'),
    clearHistoryBtn: document.getElementById('clear-history-btn'),
};

// --- Quiz Screen Elements ---
export const quiz = {
    header: document.getElementById('quiz-header'),
    titleDisplay: document.getElementById('quiz-title-display'),
    fullscreenToggleBtn: document.getElementById('fullscreen-toggle-btn'),
    fullscreenExitIcon: document.getElementById('fullscreen-exit-icon'),
    questionCounterDisplay: document.getElementById('question-counter'),
    timerDisplay: document.getElementById('timer'),
    streakCounterDisplay: document.getElementById('streak-counter'),
    scoreDisplay: document.getElementById('score-display'),
    progressBarContainer: document.getElementById('progress-bar-container'), // Added
    progressBar: document.getElementById('progress-bar'),
    questionGridNav: document.getElementById('question-grid-nav'),
    contentArea: document.getElementById('quiz-content-area'),
    finishQuizBtn: document.getElementById('finish-quiz-btn'),
    cancelQuizBtn: document.getElementById('cancel-quiz-btn'),
};

// --- Results Screen Elements ---
export const results = {
    quizTitle: document.getElementById('results-quiz-title'),
    scoreSummary: document.getElementById('score-summary'),
    timeTakenDisplay: document.getElementById('time-taken'),
    accuracyDisplay: document.getElementById('accuracy'),
    localComparisonP: document.getElementById('local-comparison'),
    achievementsDiv: document.getElementById('results-achievements'),
    detailedResultsHeader: document.querySelector('.detailed-results-header'), // Added
    detailedResultsFiltersDiv: document.querySelector('.detailed-results-filters'),
    detailedResultsDiv: document.getElementById('detailed-results'),
    restartQuizBtn: document.getElementById('restart-quiz-btn'),
    restartErrorsBtn: document.getElementById('restart-errors-btn'),
    newConfigBtn: document.getElementById('new-config-btn'),
    exportSessionBtn: document.getElementById('export-session-btn'),
    backToDashboardBtn: document.getElementById('back-to-dashboard-btn'),
    resultsActions: document.querySelector('.results-actions'), // Added
};

// --- Settings Screen Elements ---
export const settings = {
    themeSelect: document.getElementById('theme-select'),
    soundEffectsToggle: document.getElementById('sound-effects-toggle'),
    exportDataBtn: document.getElementById('export-data-btn'),
    importDataBtn: document.getElementById('import-data-btn'),
    generalStatsLocalDiv: document.getElementById('general-stats-local'),
    totalQuizzesSpan: document.getElementById('stats-total-quizzes-local'), // Added
    totalAnswersSpan: document.getElementById('stats-total-answers-local'), // Added
    avgAccuracySpan: document.getElementById('stats-avg-accuracy-local'), // Added
    longestStreakSpan: document.getElementById('stats-longest-streak-local'), // Added
    quizStatsLocalDiv: document.getElementById('quiz-stats-local'),
    localGamificationDiv: document.getElementById('local-gamification'),
    localLevelSpan: document.getElementById('local-level'), // Added
    localXpSpan: document.getElementById('local-xp'), // Added
    badgesEarnedLocalDiv: document.getElementById('badges-earned-local'),
    backToDashboardBtn: document.getElementById('back-to-dashboard-from-settings-btn'),
};

// --- Review Screen Elements ---
export const review = {
    screen: document.getElementById('review-screen'),
    quizTitle: document.getElementById('review-quiz-title'),
    searchInput: document.getElementById('review-search-input'),
    backToDashboardBtn: document.getElementById('review-back-to-dashboard-btn'),
    contentArea: document.getElementById('review-content-area'),
}

// --- Dynamic Elements (created later) ---
export const dynamic = {
    settingsButton: null, // Will be assigned in main.js
};