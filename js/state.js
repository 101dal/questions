// Holds the dynamic state of the application

export const state = {
    // Preferences & Static Data
    userPreferences: {},
    quizLibrary: [], // Array of quiz metadata objects { quizId, title, source, filename/url, dateAdded }
    localHistory: [], // Array of quiz attempt summary objects
    localStats: {},   // Object holding aggregated stats
    lastConfig: {},   // Last used quiz configuration

    // Quiz Selection State
    selectedQuizId: null,      // ID of the quiz selected from the library
    activeQuizContent: null,   // Full JSON content of the selected quiz

    // Active Quiz Session State
    currentQuizConfig: {},   // Config for the *active* session { mode, numQuestions, timeLimit, ... }
    questionsToAsk: [],      // Array of question objects for the current session
    currentQuestionIndex: 0,
    userAnswers: [],         // Array storing user's answers for the current session [{ questionId, answer, ... }]
    score: 0,                // Correct answers count for the current session
    totalPoints: 0,          // Points score for the current session
    currentStreak: 0,
    maxStreak: 0,
    timerInterval: null,
    timeLeft: 0,             // in seconds
    startTime: 0,            // Timestamp quiz started
    questionStartTime: 0,    // Timestamp current question was displayed
    quizEndTime: 0,          // Timestamp quiz ended
    isQuizActive: false,
    isSubmittingAnswer: false, // Prevent double clicks
    isFullScreen: false,

    // Drag & Drop State (could be moved to dragDrop.js if complex)
    draggedItem: null,       // Element being dragged (ordering/assoc-item)
    placeholder: null,       // Placeholder element (ordering)
    assocDraggedItem: null,  // Assoc specific item element
    assocDraggedItemId: null,// ID of the item being dragged (association)
    isDraggingFromTarget: false, // Flag for association dragging
};

// --- Functions to modify state (optional, but good practice) ---

export function resetQuizState() {
    state.currentQuizConfig = {};
    state.questionsToAsk = [];
    state.currentQuestionIndex = 0;
    state.userAnswers = [];
    state.score = 0;
    state.totalPoints = 0;
    state.currentStreak = 0;
    state.maxStreak = 0;
    if (state.timerInterval) clearInterval(state.timerInterval);
    state.timerInterval = null;
    state.timeLeft = 0;
    state.startTime = 0;
    state.questionStartTime = 0;
    state.quizEndTime = 0;
    state.isQuizActive = false;
    state.isSubmittingAnswer = false;
    // Don't reset drag/drop state here usually
}

export function resetSelectionState() {
    state.selectedQuizId = null;
    state.activeQuizContent = null;
    // state.lastConfig = {}; // Keep last config? Decide based on UX.
}

export function setActiveQuizContent(quizId, content) {
    state.selectedQuizId = quizId;
    state.activeQuizContent = content;
}

export function setQuizActive(isActive) {
    state.isQuizActive = isActive;
}

// Add more state modifiers as needed...