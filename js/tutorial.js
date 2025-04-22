// js/tutorial.js

import * as dom from './dom.js'; // Assurez-vous que dom.review existe (ou ajoutez les éléments modaux)
import { state } from './state.js';
import { saveUserPreferences } from './storage.js'; // Pour sauvegarder "ne plus afficher"

// Clé pour LocalStorage
const TUTORIAL_SEEN_KEY = 'quizMasterTutorialSeen';

// Références aux éléments de la modale (à ajouter dans dom.js ou à sélectionner ici)
const tutorialOverlay = document.getElementById('tutorial-overlay');
const tutorialModal = document.getElementById('tutorial-modal');
const tutorialContentPlaceholder = document.getElementById('tutorial-content-placeholder');
const closeTutorialBtn = document.getElementById('close-tutorial-btn');
const dontShowAgainCheckbox = document.getElementById('dont-show-tutorial-again');
const gotItBtn = document.getElementById('got-it-tutorial-btn');

let isTutorialLoaded = false;
const tutorialHtmlPath = 'public/tutorial.html'; // Chemin vers votre fichier HTML

/**
 * Vérifie si le tutoriel doit être affiché et le charge/affiche si nécessaire.
 * Doit être appelée au démarrage de l'application.
 */
export async function checkAndShowTutorial() {
    // Vérifier dans les préférences utilisateur ET localStorage (double sécurité)
    const tutorialSeenInPrefs = state.userPreferences?.tutorialSeen ?? false;
    const tutorialSeenInStorage = localStorage.getItem(TUTORIAL_SEEN_KEY) === 'true';

    if (tutorialSeenInPrefs || tutorialSeenInStorage) {
        console.log("Tutorial already marked as seen.");
        // S'assurer que la modale est cachée au cas où
        if (tutorialOverlay && !tutorialOverlay.classList.contains('hidden')) {
            hideTutorial();
        }
        return; // Ne pas afficher
    }

    // Si pas vu, charger et afficher
    console.log("Tutorial not seen, loading and showing...");
    await loadAndShowTutorial();
}

/**
 * Charge le contenu HTML du tutoriel et affiche la modale.
 */
async function loadAndShowTutorial() {
    if (!tutorialOverlay || !tutorialContentPlaceholder) {
        console.error("Tutorial modal elements not found in DOM.");
        return;
    }

    // Charger le contenu seulement si pas déjà fait
    if (!isTutorialLoaded) {
        try {
            const response = await fetch(tutorialHtmlPath);
            if (!response.ok) {
                throw new Error(`HTTP error! Status: ${response.status}`);
            }
            const htmlContent = await response.text();
            tutorialContentPlaceholder.innerHTML = htmlContent;
            isTutorialLoaded = true;
            // Attacher les écouteurs une fois le contenu chargé
            setupTutorialListeners();
        } catch (error) {
            console.error(`Failed to load tutorial content from ${tutorialHtmlPath}:`, error);
            tutorialContentPlaceholder.innerHTML = '<p>Erreur lors du chargement du tutoriel. Veuillez réessayer plus tard.</p>';
            // Afficher quand même la modale avec le message d'erreur ?
            showTutorial();
            return; // Arrêter si chargement échoue
        }
    }

    // Afficher la modale
    showTutorial();
}

/** Ajoute les écouteurs pour les boutons de la modale */
function setupTutorialListeners() {
    if (!closeTutorialBtn || !gotItBtn || !dontShowAgainCheckbox || !tutorialOverlay) return;

    closeTutorialBtn.addEventListener('click', hideTutorial);
    gotItBtn.addEventListener('click', handleGotIt);
    // Fermer si on clique sur le fond sombre
    tutorialOverlay.addEventListener('click', (event) => {
        if (event.target === tutorialOverlay) {
            hideTutorial();
        }
    });
    // Fermer avec la touche Echap
    document.addEventListener('keydown', handleTutorialKeydown);
}

/** Affiche la modale */
function showTutorial() {
    if (tutorialOverlay) tutorialOverlay.classList.remove('hidden');
}

/** Cache la modale */
function hideTutorial() {
    if (tutorialOverlay) tutorialOverlay.classList.add('hidden');
    // Détacher l'écouteur keydown quand la modale est fermée
    document.removeEventListener('keydown', handleTutorialKeydown);
}

/** Gère le clic sur "Compris !" */
function handleGotIt() {
    if (dontShowAgainCheckbox.checked) {
        markTutorialAsSeen();
    }
    hideTutorial();
}

/** Gère la fermeture avec la touche Echap */
function handleTutorialKeydown(event) {
    if (event.key === 'Escape' && !tutorialOverlay.classList.contains('hidden')) {
        hideTutorial();
    }
}


/** Marque le tutoriel comme vu dans les préférences et localStorage */
function markTutorialAsSeen() {
    console.log("Marking tutorial as seen permanently.");
    localStorage.setItem(TUTORIAL_SEEN_KEY, 'true');

    // Mettre à jour aussi les préférences utilisateur si possible/souhaité
    if (state.userPreferences) {
        state.userPreferences.tutorialSeen = true;
        saveUserPreferences(); // Sauvegarder les préférences mises à jour
    }
}

/**
 * Fonction pour forcer l'affichage du tutoriel (utile pour un bouton "Aide")
 */
export function forceShowTutorial() {
    loadAndShowTutorial(); // Recharge et affiche, même s'il a été marqué comme vu
}