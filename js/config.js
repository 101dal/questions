export const DEFAULT_QUIZ_URLS = [
    "https://raw.githubusercontent.com/101dal/questions/refs/heads/main/quiz/chapitre%203.json"
];

export const PRESETS = {
    'preset-short': { questions: 10 },
    'preset-medium': { questions: 20 },
    'preset-long': { questions: 40 },
};

export const LOCAL_STORAGE_KEYS = {
    PREFERENCES: 'quizMasterLocalPrefs',
    QUIZ_LIBRARY: 'quizMasterLocalLibrary',
    QUIZ_CONTENT_PREFIX: 'quizMasterContent_',
    HISTORY: 'quizMasterLocalHistory',
    STATS: 'quizMasterLocalStats',
    LAST_CONFIG: 'quizMasterLastConfig'
};

export const ADVANCE_DELAY = 350;
export const FEEDBACK_DELAY = 1200;
export const TIME_WARNING_THRESHOLD = 60;
export const TIME_CRITICAL_THRESHOLD = 15;

// Add any other constants here