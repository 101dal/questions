/** Shuffles array in place */
export function shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
}

// Ajoutez ceci quelque part dans js/quizEngine.js (en dehors d'une autre fonction)

/**
 * Calcule la distance de Levenshtein entre deux chaînes.
 * Plus le résultat est bas, plus les chaînes sont similaires.
 * @param {string} s1 Première chaîne
 * @param {string} s2 Seconde chaîne
 * @returns {number} La distance d'édition.
 */
export function levenshtein(s1, s2) {
    s1 = s1.toLowerCase();
    s2 = s2.toLowerCase();

    const costs = [];
    for (let i = 0; i <= s1.length; i++) {
        let lastValue = i;
        for (let j = 0; j <= s2.length; j++) {
            if (i === 0) {
                costs[j] = j;
            } else {
                if (j > 0) {
                    let newValue = costs[j - 1];
                    if (s1.charAt(i - 1) !== s2.charAt(j - 1)) {
                        newValue = Math.min(Math.min(newValue, lastValue), costs[j]) + 1;
                    }
                    costs[j - 1] = lastValue;
                    lastValue = newValue;
                }
            }
        }
        if (i > 0) costs[s2.length] = lastValue;
    }
    return costs[s2.length];
}

// --- Helper pour déterminer le type approximatif ---
export function getAnswerFormat(answer) {
    const str = String(answer).trim();
    if (/^\d+([.,]\d+)?$/.test(str)) return 'number'; // Nombre simple
    if (/^\d{1,2}[/-]\d{1,2}[/-]\d{2,4}$/.test(str) || /^\d{4}[/-]\d{1,2}[/-]\d{1,2}$/.test(str)) return 'date'; // Date simple XX/XX/XXXX ou YYYY-XX-XX
    if (str.split(/\s+/).length <= 3) return 'short'; // Peu de mots
    // Pourrait ajouter détection de code, URL, etc.
    return 'general';
}