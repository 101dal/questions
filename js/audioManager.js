import { state } from './state.js'; // Pour vérifier si le son est activé

const audioContext = new (window.AudioContext || window.webkitAudioContext)();
const soundBuffers = {}; // Pour stocker les sons pré-chargés
let soundsLoaded = false;
let soundPaths = {}; // Sera rempli par initAudioManager

// Liste des sons à charger (ID utilisé dans le code => chemin du fichier)
// IMPORTANT: Remplacez les chemins par les vôtres une fois que vous avez les fichiers !
const SOUND_FILES = {
    'correct': 'assets/sounds/correct_answer.mp3', // ou .mp3, .ogg
    'incorrect': 'assets/sounds/incorrect_answer.mp3',
    'click': 'assets/sounds/click_interface.mp3', // Clic générique UI
    'select': 'assets/sounds/click_interface.mp3', // Sélection d'option (plus léger)
    'finish': 'assets/sounds/quiz_complete.mp3', // Fin de quiz
    'error': 'assets/sounds/error_general.mp3', // Erreur générique (temps écoulé, etc.)
    'start': 'assets/sounds/quiz_start.mp3', // Début de quiz (optionnel)
    'badge': 'assets/sounds/badge_unlocked.mp3' // Déblocage badge (optionnel)
    // Ajoutez d'autres sons si nécessaire
};

/**
 * Charge un fichier audio et le décode.
 * @param {string} url Chemin vers le fichier audio.
 * @returns {Promise<AudioBuffer>} Promesse résolue avec l'AudioBuffer.
 */
async function loadSound(url) {
    try {
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status} for ${url}`);
        }
        const arrayBuffer = await response.arrayBuffer();
        const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
        return audioBuffer;
    } catch (error) {
        console.error(`Failed to load or decode sound: ${url}`, error);
        // Retourner null ou une promesse rejetée pour indiquer l'échec
        return Promise.reject(error); // Rejeter explicitement
    }
}

/**
 * Initialise le gestionnaire audio en chargeant tous les sons définis.
 * Doit être appelé une fois au démarrage.
 * On attend une interaction utilisateur pour démarrer l'AudioContext si nécessaire.
 */
export async function initAudioManager() {
    // Gérer la reprise de l'AudioContext après interaction utilisateur (navigateurs modernes)
    const resumeContext = () => {
        if (audioContext.state === 'suspended') {
            audioContext.resume().then(() => {
                console.log("AudioContext resumed successfully.");
            }).catch(e => console.error("Error resuming AudioContext:", e));
        }
        // Supprimer les écouteurs une fois le contexte repris
        document.removeEventListener('click', resumeContext);
        document.removeEventListener('keydown', resumeContext);
    };
    if (audioContext.state === 'suspended') {
        console.log("AudioContext suspended. Waiting for user interaction...");
        // Ajouter des écouteurs pour reprendre le contexte au premier clic ou touche
        document.addEventListener('click', resumeContext, { once: true });
        document.addEventListener('keydown', resumeContext, { once: true });
    }


    console.log("Loading sounds...");
    soundPaths = { ...SOUND_FILES }; // Copier les chemins
    const loadPromises = Object.entries(soundPaths).map(async ([soundId, path]) => {
        try {
            soundBuffers[soundId] = await loadSound(path);
            console.log(`Sound loaded: ${soundId}`);
        } catch (error) {
            console.warn(`Could not load sound '${soundId}' from ${path}. It will be unavailable.`);
            // On ne bloque pas tout si un son manque
        }
    });

    try {
        await Promise.all(loadPromises);
        soundsLoaded = true;
        console.log("All available sounds loaded.");
    } catch (error) {
        // Bien que loadSound rejette, Promise.all continuera si certains réussissent.
        // On log juste que le processus est terminé, même si certains sons ont échoué.
        console.warn("Sound loading process finished, some sounds might be missing.");
        soundsLoaded = true; // Marquer comme chargé pour permettre les tentatives de lecture
    }
}

/**
 * Joue un son pré-chargé par son ID.
 * @param {string} soundId L'ID du son à jouer (ex: 'correct', 'click').
 * @param {number} [volume=1.0] Volume (0.0 à 1.0).
 * @param {number} [playbackRate=1.0] Vitesse de lecture.
 */
export function playSound(soundId, volume = 1.0, playbackRate = 1.0) {
    // 1. Vérifier les préférences utilisateur
    if (!state.userPreferences?.soundEnabled) {
        // console.log(`Sound '${soundId}' skipped (disabled in prefs).`);
        return;
    }

    // 2. Vérifier si l'AudioContext est prêt
    if (audioContext.state !== 'running') {
        console.warn(`Cannot play sound '${soundId}', AudioContext is not running (state: ${audioContext.state}). Needs user interaction.`);
        // Essayer de reprendre si suspendu (au cas où les écouteurs initiaux n'auraient pas fonctionné)
        if (audioContext.state === 'suspended') {
            audioContext.resume().catch(e => console.error("Error resuming context on play:", e));
        }
        return;
    }

    // 3. Vérifier si les sons sont chargés et si ce son spécifique existe
    if (!soundsLoaded) {
        console.warn(`Cannot play sound '${soundId}', sounds not fully loaded yet.`);
        return;
    }
    const buffer = soundBuffers[soundId];
    if (!buffer) {
        console.warn(`Sound buffer for '${soundId}' not found.`);
        return;
    }

    // 4. Créer la source et le gain
    const source = audioContext.createBufferSource();
    source.buffer = buffer;
    source.playbackRate.value = playbackRate; // Appliquer la vitesse

    const gainNode = audioContext.createGain();
    gainNode.gain.setValueAtTime(Math.max(0, Math.min(1, volume)), audioContext.currentTime); // Appliquer le volume (sécurisé)

    // 5. Connecter les nœuds et jouer
    source.connect(gainNode);
    gainNode.connect(audioContext.destination);
    source.start(0); // Jouer immédiatement

    // Optionnel: Nettoyer la source après la lecture
    source.onended = () => {
        source.disconnect();
        gainNode.disconnect();
    };
}