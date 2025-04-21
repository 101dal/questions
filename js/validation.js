// Contains the validateQuizData function
export function validateQuizData(jsonData) {
    if (!jsonData || typeof jsonData !== 'object') {
        throw new Error("Contenu JSON invalide ou vide.");
    }
    if (!jsonData.quizId || typeof jsonData.quizId !== 'string' || !jsonData.quizId.trim()) {
        throw new Error("Champ 'quizId' (identifiant unique string) manquant ou invalide.");
    }
    if (!jsonData.quizTitle || typeof jsonData.quizTitle !== 'string' || !jsonData.quizTitle.trim()) {
        console.warn(`Champ 'quizTitle' manquant ou invalide pour quizId '${jsonData.quizId}'. Utilisation de l'ID comme titre.`);
        jsonData.quizTitle = jsonData.quizId;
    }
    if (!Array.isArray(jsonData.questions) || jsonData.questions.length === 0) {
        throw new Error(`Champ 'questions' pour quizId '${jsonData.quizId}' manquant, vide, ou n'est pas un tableau.`);
    }

    const validTypes = ['qcm', 'vrai_faux', 'texte_libre', 'association', 'ordre', 'qcm_multi'];
    const questionIds = new Set();

    for (let i = 0; i < jsonData.questions.length; i++) {
        const q = jsonData.questions[i];
        const qNum = i + 1;

        if (!q || typeof q !== 'object') throw new Error(`Question ${qNum} (quizId: ${jsonData.quizId}): Format invalide.`);
        if (q.id) {
            if (typeof q.id !== 'string' || !q.id.trim()) throw new Error(`Question ${qNum} (quizId: ${jsonData.quizId}): ID ('id') invalide.`);
            if (questionIds.has(q.id)) throw new Error(`Question ${qNum} (quizId: ${jsonData.quizId}): ID ('${q.id}') dupliqué.`);
            questionIds.add(q.id);
        }
        if (!q.type || !validTypes.includes(q.type)) throw new Error(`Question ${qNum} (id: ${q.id || 'N/A'}, quizId: ${jsonData.quizId}): Type ('${q.type || 'inconnu'}') invalide ou manquant.`);
        if (!q.text || typeof q.text !== 'string' || !q.text.trim()) throw new Error(`Question ${qNum} (id: ${q.id || 'N/A'}, quizId: ${jsonData.quizId}): Texte ('text') manquant ou vide.`);
        if (q.correctAnswer === undefined || q.correctAnswer === null) throw new Error(`Question ${qNum} (id: ${q.id || 'N/A'}, quizId: ${jsonData.quizId}): Réponse correcte ('correctAnswer') manquante.`);
        if (q.explanation === undefined || typeof q.explanation !== 'string') throw new Error(`Question ${qNum} (id: ${q.id || 'N/A'}, quizId: ${jsonData.quizId}): Explication ('explanation') manquante ou invalide (doit être string).`);
        if (q.points !== undefined && (typeof q.points !== 'number' || !Number.isInteger(q.points) || q.points < 0)) throw new Error(`Question ${qNum} (id: ${q.id || 'N/A'}, quizId: ${jsonData.quizId}): Points ('points') invalides.`);
        if (q.category !== undefined && (typeof q.category !== 'string' || !q.category.trim())) console.warn(`Question ${qNum} (id: ${q.id || 'N/A'}, quizId: ${jsonData.quizId}): Catégorie ('category') fournie mais vide.`);

        // Type-specific Validation
        switch (q.type) {
            case 'vrai_faux':
                if (typeof q.correctAnswer !== 'boolean') throw new Error(`Question ${qNum} (id: ${q.id || 'N/A'}, quizId: ${jsonData.quizId}, type: V/F): 'correctAnswer' doit être booléen.`);
                break;
            case 'qcm':
                if (typeof q.correctAnswer !== 'string' || !q.correctAnswer.trim()) throw new Error(`Question ${qNum} (id: ${q.id || 'N/A'}, quizId: ${jsonData.quizId}, type: QCM): 'correctAnswer' doit être string non vide.`);
                break;
            case 'texte_libre':
                if (typeof q.correctAnswer !== 'string' || !q.correctAnswer.trim()) throw new Error(`Question ${qNum} (id: ${q.id || 'N/A'}, quizId: ${jsonData.quizId}, type: Texte Libre): 'correctAnswer' doit être string non vide.`);
                break;
            case 'qcm_multi':
                if (!Array.isArray(q.correctAnswer) || q.correctAnswer.length === 0) throw new Error(`Question ${qNum} (id: ${q.id || 'N/A'}, quizId: ${jsonData.quizId}, type: QCM-Multi): 'correctAnswer' doit être tableau non vide.`);
                if (!q.correctAnswer.every(item => typeof item === 'string' && item.trim())) throw new Error(`Question ${qNum} (id: ${q.id || 'N/A'}, quizId: ${jsonData.quizId}, type: QCM-Multi): Éléments de 'correctAnswer' doivent être strings non vides.`);
                break;
            case 'ordre':
                if (!Array.isArray(q.items) || q.items.length < 2) throw new Error(`Question ${qNum} (id: ${q.id || 'N/A'}, quizId: ${jsonData.quizId}, type: Ordre): 'items' requis (tableau >= 2 éléments).`);
                if (!q.items.every(item => typeof item === 'string' && item.trim())) throw new Error(`Question ${qNum} (id: ${q.id || 'N/A'}, quizId: ${jsonData.quizId}, type: Ordre): Éléments de 'items' doivent être strings non vides.`);
                if (!Array.isArray(q.correctAnswer) || q.correctAnswer.length !== q.items.length) throw new Error(`Question ${qNum} (id: ${q.id || 'N/A'}, quizId: ${jsonData.quizId}, type: Ordre): 'correctAnswer' doit être tableau de même taille que 'items'.`);
                const itemsSetOrdre = new Set(q.items); const correctAnsSetOrdre = new Set(q.correctAnswer);
                if (itemsSetOrdre.size !== correctAnsSetOrdre.size || ![...itemsSetOrdre].every(item => correctAnsSetOrdre.has(item))) throw new Error(`Question ${qNum} (id: ${q.id || 'N/A'}, quizId: ${jsonData.quizId}, type: Ordre): 'correctAnswer' doit contenir les mêmes éléments que 'items'.`);
                if (!q.correctAnswer.every(item => typeof item === 'string' && item.trim())) throw new Error(`Question ${qNum} (id: ${q.id || 'N/A'}, quizId: ${jsonData.quizId}, type: Ordre): Éléments de 'correctAnswer' doivent être strings non vides.`);
                break;
            case 'association':
                if (!Array.isArray(q.items_left) || q.items_left.length === 0) throw new Error(`Question ${qNum} (id: ${q.id || 'N/A'}, quizId: ${jsonData.quizId}, type: Association): 'items_left' requis (tableau non vide).`);
                if (!q.items_left.every(item => typeof item === 'string' && item.trim())) throw new Error(`Question ${qNum} (id: ${q.id || 'N/A'}, quizId: ${jsonData.quizId}, type: Association): Éléments de 'items_left' doivent être strings non vides.`);
                if (!Array.isArray(q.items_right) || q.items_right.length !== q.items_left.length) throw new Error(`Question ${qNum} (id: ${q.id || 'N/A'}, quizId: ${jsonData.quizId}, type: Association): 'items_right' requis (tableau de même taille que 'items_left').`);
                if (!q.items_right.every(item => typeof item === 'string' && item.trim())) throw new Error(`Question ${qNum} (id: ${q.id || 'N/A'}, quizId: ${jsonData.quizId}, type: Association): Éléments de 'items_right' doivent être strings non vides.`);
                if (typeof q.correctAnswer !== 'object' || q.correctAnswer === null || Array.isArray(q.correctAnswer) || Object.keys(q.correctAnswer).length !== q.items_left.length) throw new Error(`Question ${qNum} (id: ${q.id || 'N/A'}, quizId: ${jsonData.quizId}, type: Association): 'correctAnswer' doit être un objet (map) avec une entrée par élément de 'items_left'.`);
                const leftItemsSet = new Set(q.items_left); const rightItemsSet = new Set(q.items_right);
                for (const key in q.correctAnswer) {
                    if (!leftItemsSet.has(key)) throw new Error(`Question ${qNum} (id: ${q.id || 'N/A'}, quizId: ${jsonData.quizId}, type: Association): Clé '${key}' dans 'correctAnswer' absente de 'items_left'.`);
                    const value = q.correctAnswer[key];
                    if (typeof value !== 'string' || !value.trim() || !rightItemsSet.has(value)) throw new Error(`Question ${qNum} (id: ${q.id || 'N/A'}, quizId: ${jsonData.quizId}, type: Association): Valeur '${value}' pour clé '${key}' invalide ou absente de 'items_right'.`);
                }
                break;
        }
    }

    // Validate dummyAnswers structure if present
    if (jsonData.dummyAnswers !== undefined) {
        if (typeof jsonData.dummyAnswers !== 'object' || jsonData.dummyAnswers === null || Array.isArray(jsonData.dummyAnswers)) throw new Error(`Champ 'dummyAnswers' (quizId: ${jsonData.quizId}), si présent, doit être un objet.`);
        for (const category in jsonData.dummyAnswers) {
            if (!Array.isArray(jsonData.dummyAnswers[category])) throw new Error(`Dans 'dummyAnswers' (quizId: ${jsonData.quizId}), la valeur pour '${category}' doit être un tableau.`);
            if (!jsonData.dummyAnswers[category].every(item => typeof item === 'string' && item.trim())) throw new Error(`Dans 'dummyAnswers[${category}]' (quizId: ${jsonData.quizId}), éléments doivent être strings non vides.`);
        }
    }

    return true;
}
