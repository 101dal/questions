import { state } from './state.js';
import { renderMarkdown, playSound } from './ui.js'; // Added renderMarkdown

// --- Ordering Handlers ---
export function handleDragStart(event) {
    const target = event.target.closest('.ordering-item');
    if (!target || !state.isQuizActive) { event.preventDefault(); return; } // Check if quiz active
    state.draggedItem = target;
    setTimeout(() => state.draggedItem.classList.add('dragging'), 0);
    event.dataTransfer.effectAllowed = 'move';
    // event.dataTransfer.setData('text/plain', 'ordering-item'); // Optional data
}

export function handleDragEnd() {
    if (state.draggedItem) state.draggedItem.classList.remove('dragging');
    if (state.placeholder && state.placeholder.parentNode) state.placeholder.remove();
    state.draggedItem = null;
    state.placeholder = null;
}

export function handleOrderingDragOver(event) {
    event.preventDefault();
    const container = event.target.closest('.ordering-items-container');
    if (!container || !state.draggedItem || container === state.draggedItem || !state.isQuizActive) return;
    event.dataTransfer.dropEffect = 'move';

    if (!state.placeholder) {
        state.placeholder = document.createElement('div');
        state.placeholder.classList.add('ordering-placeholder');
    }
    const afterElement = getDragAfterElement(container, event.clientY);
    if (afterElement == null) {
        if (!container.contains(state.placeholder) || container.lastChild !== state.placeholder) {
            container.appendChild(state.placeholder);
        }
    } else {
        if (!container.contains(state.placeholder) || afterElement !== state.placeholder.nextSibling) {
            container.insertBefore(state.placeholder, afterElement);
        }
    }
}

export function handleOrderingDragLeave(event) {
    const container = event.target.closest('.ordering-items-container');
    if (container && state.placeholder && state.placeholder.parentNode === container && !container.contains(event.relatedTarget)) {
        setTimeout(() => {
            if (state.placeholder && state.placeholder.parentNode === container && !container.matches(':hover')) {
                state.placeholder.remove();
                state.placeholder = null;
            }
        }, 50);
    }
}

export function handleOrderingDrop(event) {
    event.preventDefault();
    const container = event.target.closest('.ordering-items-container');
    if (container && state.draggedItem && state.placeholder && state.placeholder.parentNode === container && state.isQuizActive) {
        container.insertBefore(state.draggedItem, state.placeholder);
    }
    // Cleanup handled by dragend
}

function getDragAfterElement(container, y) {
    const draggableElements = [...container.querySelectorAll('.ordering-item:not(.dragging)')];
    return draggableElements.reduce((closest, child) => {
        const box = child.getBoundingClientRect();
        const offset = y - box.top - box.height / 2;
        if (offset < 0 && offset > closest.offset) {
            return { offset: offset, element: child };
        } else { return closest; }
    }, { offset: Number.NEGATIVE_INFINITY }).element;
}


// --- Association Handlers ---
export function handleAssocDragStart(event) {
    const target = event.target.closest('.matching-item');
    if (!target || target.classList.contains('matched') || !state.isQuizActive) {
        event.preventDefault(); return;
    }
    state.assocDraggedItem = target;
    state.assocDraggedItemId = target.dataset.itemId;
    state.isDraggingFromTarget = false; // Always dragging from left
    if (!state.assocDraggedItemId) { event.preventDefault(); return; }

    setTimeout(() => target.classList.add('dragging'), 0);
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/plain', state.assocDraggedItemId);
}

export function handleAssocDragEnd() {
    if (state.assocDraggedItem) {
        state.assocDraggedItem.classList.remove('dragging');
    }
    document.querySelectorAll('.drop-target.over').forEach(el => el.classList.remove('over'));
    state.assocDraggedItem = null;
    state.assocDraggedItemId = null;
    state.isDraggingFromTarget = false;
}

export function handleAssocDragOver(event) {
    event.preventDefault();
    const target = event.target.closest('.drop-target');
    if (target && !target.classList.contains('matched') && state.assocDraggedItemId && state.isQuizActive) {
        event.dataTransfer.dropEffect = 'move';
        target.classList.add('over');
    } else {
        event.dataTransfer.dropEffect = 'none';
        if (target) target.classList.remove('over');
    }
    // Cleanup any potential ordering placeholder if dragging over assoc targets
    if (state.placeholder && state.placeholder.parentNode) state.placeholder.remove();
}

export function handleAssocDragLeave(event) {
    const target = event.target.closest('.drop-target');
    if (target) {
        setTimeout(() => { if (!target.matches(':hover')) target.classList.remove('over'); }, 50);
    }
}

export function handleAssocDrop(event) {
    event.preventDefault();
    const target = event.target.closest('.drop-target');
    const droppedItemId = event.dataTransfer.getData('text/plain');
    const questionBlock = target?.closest('.question-block');

    if (!target || !droppedItemId || !questionBlock || target.classList.contains('matched') || !state.isQuizActive) {
        console.warn("Assoc Drop failed: Invalid conditions.");
        if (target) target.classList.remove('over');
        handleAssocDragEnd();
        return;
    }

    target.classList.remove('over');
    const sourceItemElement = questionBlock.querySelector(`.matching-item[data-item-id="${droppedItemId}"]`);

    if (!sourceItemElement) {
        console.warn("Assoc Drop failed: Source item element not found for ID:", droppedItemId);
        handleAssocDragEnd();
        return;
    }

    // Update target appearance
    target.textContent = '';
    target.innerHTML = sourceItemElement.innerHTML; // Copy rendered content
    target.classList.add('matched');
    target.dataset.pairedItemId = droppedItemId;

    // Add click listener to return
    target.addEventListener('click', handleReturnItemToLeft);
    target.style.cursor = 'pointer';
    target.title = "Cliquez pour renvoyer l'élément à gauche";

    // Hide original item
    sourceItemElement.classList.add('matched');
    sourceItemElement.setAttribute('draggable', 'false');

    playSound('click');
    handleAssocDragEnd(); // Reset drag state
}

export function handleReturnItemToLeft(event) {
    const target = event.target.closest('.drop-target.matched');
    if (!target || !state.isQuizActive) return;

    const pairedItemId = target.dataset.pairedItemId;
    const questionBlock = target.closest('.question-block');
    if (!pairedItemId || !questionBlock) return;

    const originalItem = questionBlock.querySelector(`.matching-item[data-item-id="${pairedItemId}"]`);
    const leftContainer = questionBlock.querySelector('.matching-column[id^="matching-left-"]');

    if (originalItem && leftContainer) {
        // Reset target
        target.textContent = 'Déposez ici';
        target.classList.remove('matched');
        target.removeAttribute('data-paired-item-id');
        target.removeEventListener('click', handleReturnItemToLeft);
        target.style.cursor = 'default';
        target.title = "";

        // Restore original item
        originalItem.classList.remove('matched');
        originalItem.setAttribute('draggable', 'true');
        leftContainer.appendChild(originalItem); // Move back visually

        playSound('click');
    } else {
        console.warn("Could not return item: Original item or left container not found.");
    }
}
