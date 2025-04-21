import { LOCAL_STORAGE_KEYS } from './config.js';
import { state } from './state.js';
import { showToast } from './ui.js';

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
    }
}

function removeItem(key) {
    try {
        localStorage.removeItem(key);
    } catch (e) {
        console.error(`Error removing item ${key} from localStorage:`, e);
    }
}

// --- Specific Loaders / Savers ---

export function loadUserPreferences() {
    const defaultPrefs = { theme: 'light', soundEnabled: true };
    state.userPreferences = getItem(LOCAL_STORAGE_KEYS.PREFERENCES, defaultPrefs);
    state.userPreferences = { ...defaultPrefs, ...state.userPreferences };
}
export function saveUserPreferences() {
    setItem(LOCAL_STORAGE_KEYS.PREFERENCES, state.userPreferences);
}

export function loadQuizLibrary() {
    state.quizLibrary = getItem(LOCAL_STORAGE_KEYS.QUIZ_LIBRARY, []);
}
export function saveQuizLibrary() {
    setItem(LOCAL_STORAGE_KEYS.QUIZ_LIBRARY, state.quizLibrary);
}

export function loadQuizContent(quizId) {
    return getItem(`${LOCAL_STORAGE_KEYS.QUIZ_CONTENT_PREFIX}${quizId}`);
}
export function saveQuizContent(quizId, content) {
    setItem(`${LOCAL_STORAGE_KEYS.QUIZ_CONTENT_PREFIX}${quizId}`, content);
}
export function deleteQuizContent(quizId) {
    removeItem(`${LOCAL_STORAGE_KEYS.QUIZ_CONTENT_PREFIX}${quizId}`);
}

export function loadLocalHistory() {
    state.localHistory = getItem(LOCAL_STORAGE_KEYS.HISTORY, []);
}
export function saveLocalHistory() {
    setItem(LOCAL_STORAGE_KEYS.HISTORY, state.localHistory);
}
export function clearLocalHistory() {
    state.localHistory = [];
    removeItem(LOCAL_STORAGE_KEYS.HISTORY);
}

export function loadLocalStats() {
    const defaultStats = { totalQuizzes: 0, totalAnswers: 0, correctAnswers: 0, totalPoints: 0, avgAccuracy: 0, longestStreak: 0, quizStats: {}, level: 1, xp: 0, xpNextLevel: 100, badges: [] };
    state.localStats = getItem(LOCAL_STORAGE_KEYS.STATS, defaultStats);
    state.localStats = { ...defaultStats, ...state.localStats };
}
export function saveLocalStats() {
    setItem(LOCAL_STORAGE_KEYS.STATS, state.localStats);
}

export function loadLastConfig() {
    state.lastConfig = getItem(LOCAL_STORAGE_KEYS.LAST_CONFIG, {});
}
export function saveLastConfig() {
    setItem(LOCAL_STORAGE_KEYS.LAST_CONFIG, state.lastConfig);
}

// --- History Management Logic ---
export function saveQuizAttempt(attemptData) {
    state.localHistory.push(attemptData);
    saveLocalHistory();
    console.log("Attempt saved to local history.");
    // Note: Stat recalculation is handled separately in stats.js
}