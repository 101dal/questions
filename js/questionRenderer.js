import { state } from './state.js';
import { shuffleArray } from './utils.js';
import { renderMarkdown } from './ui.js';
import {
    handleAnswerSelection,
    handleMarkQuestion,
    generateFalseAnswers
} from './quizEngine.js'; // Import necessary functions from quizEngine
import {
    handleAssocDragStart, handleAssocDragEnd, handleAssocDragOver,
    handleAssocDragLeave, handleAssocDrop, handleReturnItemToLeft, // Import association handlers
    handleDragStart, handleDragEnd, handleOrderingDragOver,
    handleOrderingDragLeave, handleOrderingDrop // Import ordering handlers
} from './dragDrop.js'; // Import drag/drop handlers

/**
 * Creates the HTML structure for a single question block.
 * Stores generated options for QCM/QCM-Multi on first display.
 */
export function createQuestionBlock(question, index) {
    const questionBlock = document.createElement('div');
    questionBlock.classList.add('question-block');
    questionBlock.dataset.index = index;
    const questionId = question.id || `q_${state.selectedQuizId}_${question.originalIndex ?? index}`;
    questionBlock.dataset.questionId = questionId;

    // --- Ensure userAnswer entry exists and has the correct ID ---
    if (state.userAnswers[index] === null || state.userAnswers[index].questionId !== questionId) {
        console.warn(`createQuestionBlock: Initializing/Correcting userAnswers entry for index ${index} with ID ${questionId}`);
        state.userAnswers[index] = {
            ...(state.userAnswers[index] || {}), // Keep existing data if any
            questionId: questionId,
            // Initialize core fields if creating anew or ID was wrong
            marked: state.userAnswers[index]?.marked ?? false,
            displayedOptions: state.userAnswers[index]?.displayedOptions ?? null,
            answer: null, isCorrect: null, pointsEarned: 0, timeTaken: null
        };
    }
    const answerInfo = state.userAnswers[index]; // Use the potentially initialized/corrected entry
    const isMarked = answerInfo?.marked || false;

    // Header
    const header = document.createElement('div');
    header.classList.add('question-block-header');
    header.innerHTML = `
        <span>Question ${index + 1}</span>
        <button class="mark-question-btn ${isMarked ? 'marked' : ''}" data-question-index="${index}" title="${isMarked ? 'Ne plus marquer' : 'Marquer cette question'}">
            ${isMarked ? '🌟' : '⭐'}
        </button>`;
    header.querySelector('.mark-question-btn').addEventListener('click', handleMarkQuestion);
    questionBlock.appendChild(header);

    // Question Text
    const textElement = document.createElement('div');
    textElement.classList.add('question-text');
    textElement.innerHTML = renderMarkdown(question.text);
    questionBlock.appendChild(textElement);

    // Answer Options Area
    const optionsDiv = document.createElement('div');
    optionsDiv.classList.add('answer-options', question.type);

    // --- Generate options based on type ---
    switch (question.type) {
        case 'qcm':
        case 'vrai_faux':
            renderQCMOptions(optionsDiv, question, answerInfo, index);
            break;
        case 'qcm_multi':
            renderQCMMultiOptions(optionsDiv, question, answerInfo, index);
            break;
        case 'texte_libre':
            renderTexteLibreInput(optionsDiv);
            break;
        case 'association':
            renderAssociationOptions(optionsDiv, question, index);
            break;
        case 'ordre':
            renderOrdreOptions(optionsDiv, question);
            break;
        default:
            optionsDiv.textContent = `Type de question inconnu: ${question.type}`;
    }
    questionBlock.appendChild(optionsDiv);

    const validationContainer = document.createElement('div');
    validationContainer.classList.add('validation-container'); // Pour styler si besoin
    const validateButton = document.createElement('button');
    validateButton.textContent = 'Valider';
    validateButton.classList.add('btn-primary', 'universal-validate-btn'); // Classe spécifique
    // L'écouteur est délégué au niveau du bloc question ou géré par handleAnswerSelection
    validationContainer.appendChild(validateButton);
    questionBlock.appendChild(validationContainer); // Ajoute le bouton après les options

    // Immediate Feedback Area
    const feedbackDiv = document.createElement('div');
    feedbackDiv.classList.add('immediate-feedback', 'hidden');
    feedbackDiv.innerHTML = `<span class="feedback-icon"></span> <span class="feedback-text"></span>`;
    questionBlock.appendChild(feedbackDiv);

    return questionBlock;
}

// --- Specific Render Functions ---

function renderQCMOptions(container, question, answerInfo, index) {
    let qcmOptions;
    if (answerInfo.displayedOptions) {
        qcmOptions = answerInfo.displayedOptions;
    } else {
        if (question.type === 'vrai_faux') {
            qcmOptions = shuffleArray([true, false]);
        } else {
            const correct = question.correctAnswer;
            const incorrect = generateFalseAnswers(question, state.activeQuizContent.questions, state.activeQuizContent.dummyAnswers);
            qcmOptions = shuffleArray([correct, ...incorrect]);
        }
        answerInfo.displayedOptions = qcmOptions;
    }

    qcmOptions.forEach(option => {
        const button = document.createElement('button');
        button.classList.add('answer-btn');
        const displayValue = (typeof option === 'boolean') ? (option ? 'Vrai' : 'Faux') : option;
        // Render markdown for options if needed
        button.innerHTML = renderMarkdown(String(displayValue)); // Use innerHTML for markdown
        button.dataset.answer = String(option); // Store original value as string
        container.appendChild(button);
    });
}

function renderQCMMultiOptions(container, question, answerInfo, index) {
    let multiOptions;
    if (answerInfo.displayedOptions) {
        multiOptions = answerInfo.displayedOptions;
    } else {
        const multiCorrect = Array.isArray(question.correctAnswer) ? question.correctAnswer : [question.correctAnswer];
        const multiFalse = generateFalseAnswers(question, state.activeQuizContent.questions, state.activeQuizContent.dummyAnswers, multiCorrect);
        const combined = [...multiCorrect, ...multiFalse];
        multiOptions = shuffleArray(combined.slice(0, 6)); // Limit options if desired
        answerInfo.displayedOptions = multiOptions;
    }

    multiOptions.forEach(option => {
        if (typeof option !== 'string') {
            console.error(`ERREUR INTERNE: Option QCM-Multi invalide (type ${typeof option}):`, option);
            return; // Skip invalid options
        }
        const label = document.createElement('label');
        label.classList.add('checkbox-label'); // Re-use checkbox style
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.value = option;
        checkbox.dataset.answer = option; // Use data-answer for consistency?
        const span = document.createElement('span');
        span.innerHTML = renderMarkdown(option); // Render markdown in the label text
        label.appendChild(checkbox);
        label.appendChild(span);
        container.appendChild(label);
    });
}

function renderTexteLibreInput(container) {
    const input = document.createElement('input');
    input.type = 'text';
    input.placeholder = "Tapez votre réponse...";
    container.appendChild(input);

    // L'appui sur Entrée devra maintenant déclencher un clic sur le bouton universel
    input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            // Trouve le bouton Valider associé à ce bloc et le clique
            const questionBlock = input.closest('.question-block');
            questionBlock?.querySelector('.universal-validate-btn')?.click();
        }
    });
}

function renderAssociationOptions(container, question, index) {
    if (!Array.isArray(question.items_left) || !Array.isArray(question.items_right) || typeof question.correctAnswer !== 'object') {
        container.innerHTML = `<p class='error-message'>Erreur structure Association.</p>`;
        return;
    }
    container.innerHTML = `
        <div class="matching-column" id="matching-left-${index}"><h4>Glissez :</h4></div>
        <div class="matching-column" id="matching-right-${index}"><h4>Déposez :</h4></div>`;
    const leftCol = container.querySelector(`#matching-left-${index}`);
    const rightCol = container.querySelector(`#matching-right-${index}`);

    // Shuffle left items for initial display
    shuffleArray([...question.items_left]).forEach(itemText => {
        const itemDiv = document.createElement('div');
        itemDiv.classList.add('matching-item');
        itemDiv.setAttribute('draggable', 'true');
        itemDiv.dataset.itemId = itemText;
        itemDiv.innerHTML = renderMarkdown(itemText);
        itemDiv.addEventListener('dragstart', handleAssocDragStart);
        itemDiv.addEventListener('dragend', handleAssocDragEnd);
        leftCol.appendChild(itemDiv);
    });

    // Display right items as targets
    question.items_right.forEach(targetText => {
        const targetContainer = document.createElement('div');
        targetContainer.classList.add('matching-target-container');
        const labelSpan = document.createElement('span');
        labelSpan.classList.add('matching-target-label');
        labelSpan.innerHTML = renderMarkdown(targetText);
        const dropDiv = document.createElement('div');
        dropDiv.classList.add('drop-target');
        dropDiv.dataset.targetId = targetText;
        dropDiv.textContent = 'Déposez ici';
        dropDiv.addEventListener('dragover', handleAssocDragOver);
        dropDiv.addEventListener('dragleave', handleAssocDragLeave);
        dropDiv.addEventListener('drop', handleAssocDrop);
        // Click listener to return item is added dynamically in handleAssocDrop
        targetContainer.appendChild(labelSpan);
        targetContainer.appendChild(dropDiv);
        rightCol.appendChild(targetContainer);
    });
}

function renderOrdreOptions(container, question) {
    if (!Array.isArray(question.items) || !Array.isArray(question.correctAnswer)) {
        container.innerHTML = `<p class='error-message'>Erreur structure Ordre.</p>`;
        return;
    }
    const itemsContainer = document.createElement('div');
    itemsContainer.classList.add('ordering-items-container');

    shuffleArray([...question.items]).forEach(itemText => {
        const itemDiv = document.createElement('div');
        itemDiv.classList.add('ordering-item');
        itemDiv.setAttribute('draggable', 'true');
        itemDiv.innerHTML = renderMarkdown(itemText); // Render markdown
        itemDiv.addEventListener('dragstart', handleDragStart);
        itemDiv.addEventListener('dragend', handleDragEnd);
        itemsContainer.appendChild(itemDiv);
    });

    itemsContainer.addEventListener('dragover', handleOrderingDragOver);
    itemsContainer.addEventListener('dragleave', handleOrderingDragLeave);
    itemsContainer.addEventListener('drop', handleOrderingDrop);
    container.appendChild(itemsContainer);
}
