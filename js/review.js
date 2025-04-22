// js/review.js

import * as dom from './dom.js';
import { state } from './state.js';
import { showScreen, renderMarkdown } from './ui.js';
import { formatAnswerForDisplay } from './results.js'; // Réutiliser le formateur

let allQuestionsData = []; // Pour stocker les questions du quiz actuel
let currentSearchTerm = ''; // Pour garder la recherche

/**
 * Initialise et affiche l'écran de révision globale.
 */
export function showReviewScreen() {
    if (!state.activeQuizContent || !state.activeQuizContent.questions) {
        console.error("Impossible d'afficher l'écran de révision : contenu du quiz manquant.");
        showScreen('dashboard'); // Retour au tableau de bord
        return;
    }

    allQuestionsData = state.activeQuizContent.questions;
    currentSearchTerm = ''; // Réinitialiser la recherche

    dom.review.quizTitle.textContent = `Consultation : ${state.activeQuizContent.quizTitle || 'Quiz sans titre'}`;
    dom.review.searchInput.value = ''; // Vider le champ de recherche

    renderReviewCards(allQuestionsData); // Afficher toutes les cartes initialement

    showScreen('review'); // Afficher l'écran
}

/**
 * Affiche les cartes de révision dans la zone de contenu.
 * @param {Array} questionsToDisplay - Le tableau de questions à afficher.
 */
function renderReviewCards(questionsToDisplay) {
    dom.review.contentArea.innerHTML = ''; // Vider la zone

    if (!questionsToDisplay || questionsToDisplay.length === 0) {
        dom.review.contentArea.innerHTML = '<p>Aucune question à afficher.</p>';
        return;
    }

    questionsToDisplay.forEach((question, index) => {
        const reviewCard = document.createElement('div');
        reviewCard.classList.add('review-card-item'); // Utiliser la classe stylée
        // Ajouter un dataset pour retrouver la question originale si besoin
        reviewCard.dataset.originalIndex = state.activeQuizContent.questions.indexOf(question);

        // Réutiliser/adapter la structure HTML de .result-item
        // On n'a PAS de userAnswerEntry ici, on affiche directement la question et la réponse correcte.
        const isMarked = false; // Pas de marquage dans ce mode pour l'instant

        let cardHTML = `
            <div class="result-question-header">
                 <p class="question-text-result">Q${index + 1}: ${renderMarkdown(question.text)}</p>
                 <!-- Pas de bouton étoile ici -->
             </div>
             <p class="correct-answer-text"><strong>Réponse:</strong> ${formatAnswerForDisplay(question.correctAnswer, question.type)}</p>
             <p class="explanation"><strong>Explication:</strong> ${renderMarkdown(question.explanation || '-')}</p>
        `;
        reviewCard.innerHTML = cardHTML;

        // Appliquer le surlignage si une recherche est active
        if (currentSearchTerm) {
            highlightSearchTerm(reviewCard, currentSearchTerm);
        }

        dom.review.contentArea.appendChild(reviewCard);
    });
}

/**
 * Gère la saisie dans le champ de recherche.
 */
export function handleReviewSearch() {
    currentSearchTerm = dom.review.searchInput.value.trim().toLowerCase();
    const filteredQuestions = filterQuestionsByText(allQuestionsData, currentSearchTerm);
    renderReviewCards(filteredQuestions);
}

/**
 * Filtre les questions dont le texte contient le terme de recherche.
 * @param {Array} questions - Le tableau complet des questions.
 * @param {string} searchTerm - Le terme de recherche (en minuscules).
 * @returns {Array} Le tableau des questions filtrées.
 */
function filterQuestionsByText(questions, searchTerm) {
    if (!searchTerm) {
        return questions; // Retourne tout si la recherche est vide
    }
    return questions.filter(q =>
        q.text.toLowerCase().includes(searchTerm) ||
        q.explanation.toLowerCase().includes(searchTerm) || // Chercher aussi dans l'explication
        String(q.correctAnswer).toLowerCase().includes(searchTerm) // Chercher dans la réponse
    );
}

/**
 * Surligne le terme de recherche dans le contenu textuel d'une carte.
 * (Implémentation simple, peut être améliorée pour éviter de casser le HTML)
 * @param {HTMLElement} cardElement - L'élément de la carte de révision.
 * @param {string} searchTerm - Le terme de recherche (minuscules).
 */
function highlightSearchTerm(cardElement, searchTerm) {
    if (!searchTerm) return;

    const options = { element: "span", className: "search-highlight" };
    const textNodes = getTextNodes(cardElement); // Obtenir tous les nœuds texte

    textNodes.forEach(node => {
        const text = node.nodeValue;
        const regex = new RegExp(`(${escapeRegExp(searchTerm)})`, 'gi'); // 'g' pour global, 'i' pour insensible casse

        if (regex.test(text)) {
            const fragment = document.createDocumentFragment();
            let lastIndex = 0;
            text.replace(regex, (match, p1, offset) => {
                // Ajouter le texte avant le match
                if (offset > lastIndex) {
                    fragment.appendChild(document.createTextNode(text.substring(lastIndex, offset)));
                }
                // Ajouter le match surligné
                const highlightSpan = document.createElement(options.element);
                highlightSpan.className = options.className;
                highlightSpan.textContent = match;
                fragment.appendChild(highlightSpan);
                lastIndex = offset + match.length;
            });
            // Ajouter le reste du texte après le dernier match
            if (lastIndex < text.length) {
                fragment.appendChild(document.createTextNode(text.substring(lastIndex)));
            }
            // Remplacer le nœud texte original par le fragment
            node.parentNode.replaceChild(fragment, node);
        }
    });
}

// Fonction utilitaire pour obtenir tous les nœuds texte d'un élément
function getTextNodes(elem) {
    const textNodes = [];
    const walk = document.createTreeWalker(elem, NodeFilter.SHOW_TEXT, null, false);
    let node;
    while (node = walk.nextNode()) {
        // Exclure les nœuds dans les scripts ou styles, et les nœuds vides
        const parentTag = node.parentNode.tagName.toUpperCase();
        if (parentTag !== 'SCRIPT' && parentTag !== 'STYLE' && node.nodeValue.trim() !== '') {
            textNodes.push(node);
        }
    }
    return textNodes;
}

// Fonction utilitaire pour échapper les caractères regex
function escapeRegExp(string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); // $& means the whole matched string
}


/**
 * Gère le clic sur le bouton retour.
 */
export function handleReviewBackToDashboard() {
    showScreen('dashboard');
    // Optionnel : Désélectionner le quiz ?
    // resetSelectionState(); // Si vous voulez forcer une nouvelle sélection
    // renderQuizLibrary();
}