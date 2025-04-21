import * as dom from './dom.js';
import { state } from './state.js'; // For sound preference, theme
import { settings } from './dom.js'; // For themeSelect

export function showScreen(screenId) {
    Object.keys(dom.screens).forEach(id => {
        const isActive = id === screenId;
        dom.screens[id].classList.toggle('active', isActive);
        dom.screens[id].classList.toggle('hidden', !isActive);
    });
    // Specific actions on screen show are handled in main.js or calling function
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

export function showToast(message, type = 'info', duration = 3000) {
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;
    dom.toastContainer.appendChild(toast);
    // Delay adding 'show' to allow CSS transition
    setTimeout(() => toast.classList.add('show'), 10);
    // Set timeout to remove 'show' class
    setTimeout(() => {
        toast.classList.remove('show');
        // Remove the element after the transition ends
        toast.addEventListener('transitionend', () => toast.remove(), { once: true });
    }, duration);
}

export function showLoader() { dom.globalLoader.classList.remove('hidden'); }
export function hideLoader() { dom.globalLoader.classList.add('hidden'); }

export function playSound(soundName) {
    if (!state.userPreferences.soundEnabled) return;
    // Placeholder: Implement actual audio playback here
    console.log(`Playing sound: ${soundName}`);
    // e.g., const audio = new Audio(`sounds/${soundName}.wav`); audio.play();
}

export function applyTheme(theme) {
    dom.bodyElement.dataset.theme = theme;
    if (settings.themeSelect) settings.themeSelect.value = theme;
}

/** Basic Markdown Renderer */
export function renderMarkdown(text) {
    if (!text) return '';
    let html = text;
    // Basic replacements (add more as needed, consider a library for complex needs)
    html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>'); // Bold
    html = html.replace(/(\*|_)(.*?)\1/g, '<em>$2</em>');       // Italic
    html = html.replace(/`(.*?)`/g, '<code>$1</code>');         // Inline Code
    html = html.replace(/```(\w*)\n([\s\S]*?)\n```/g, (match, lang, code) => { // Code Block (basic)
        const escapedCode = code.replace(/</g, '&lt;').replace(/>/g, '&gt;');
        return `<pre><code class="language-${lang || ''}">${escapedCode}</code></pre>`;
    });
    // Lists (very basic, needs improvement for nesting)
    html = html.replace(/^\s*-\s+(.*)/gm, '<li>$1</li>');
    html = html.replace(/(\<\/li\>\n)*\<\/li\>/g, '</li>'); // Clean up potential extra tags
    html = html.replace(/(<li>.*<\/li>)/gs, '<ul>$1</ul>'); // Wrap sequence
    html = html.replace(/^\s*\d+\.\s+(.*)/gm, '<oli>$1</oli>'); // Use temp tag
    html = html.replace(/(<\/oli>\n)*\<\/oli>/g, '</oli>');
    html = html.replace(/(<oli>.*<\/oli>)/gs, (match) => '<ol>' + match.replace(/<oli>/g, '<li>').replace(/<\/oli>/g, '</li>') + '</ol>');

    html = html.replace(/\n/g, '<br>'); // Simple line breaks
    return html;
}

export function displayDashboardMessage(element, message, isError = true) {
    element.textContent = message;
    element.className = isError ? 'error-message' : 'success-message';
    element.classList.remove('hidden');
}

export function clearDashboardMessages() {
    dom.dashboard.fileErrorMsg.textContent = '';
    dom.dashboard.fileSuccessMsg.textContent = '';
    dom.dashboard.fileErrorMsg.classList.add('hidden');
    dom.dashboard.fileSuccessMsg.classList.add('hidden');
}

// --- Fullscreen API ---
export function toggleFullScreen() {
    const elem = document.documentElement;
    if (!document.fullscreenElement && !document.mozFullScreenElement && !document.webkitFullscreenElement && !document.msFullscreenElement) {
        // Enter
        if (elem.requestFullscreen) { elem.requestFullscreen(); }
        else if (elem.msRequestFullscreen) { elem.msRequestFullscreen(); }
        else if (elem.mozRequestFullScreen) { elem.mozRequestFullScreen(); }
        else if (elem.webkitRequestFullscreen) { elem.webkitRequestFullscreen(Element.ALLOW_KEYBOARD_INPUT); }
        state.isFullScreen = true;
    } else {
        // Exit
        if (document.exitFullscreen) { document.exitFullscreen(); }
        else if (document.msExitFullscreen) { document.msExitFullscreen(); }
        else if (document.mozCancelFullScreen) { document.mozCancelFullScreen(); }
        else if (document.webkitExitFullscreen) { document.webkitExitFullscreen(); }
        state.isFullScreen = false;
    }
}

export function updateFullscreenButton() {
    const isCurrentlyFullscreen = !!(document.fullscreenElement || document.mozFullScreenElement || document.webkitFullscreenElement || document.msFullscreenElement);
    state.isFullScreen = isCurrentlyFullscreen; // Sync state variable
    const exitIcon = dom.quiz.fullscreenExitIcon;
    const enterIcon = dom.quiz.fullscreenToggleBtn.querySelector('svg:not(#fullscreen-exit-icon)');

    if (exitIcon && enterIcon) {
        exitIcon.classList.toggle('hidden', !state.isFullScreen);
        enterIcon.classList.toggle('hidden', state.isFullScreen);
        dom.quiz.fullscreenToggleBtn.title = state.isFullScreen ? "Quitter Plein Écran" : "Mode Plein Écran";
    }
}

// --- Settings Button Visibility ---
export function updateSettingsButtonVisibility() {
    if (dom.dynamic.settingsButton) {
        dom.dynamic.settingsButton.classList.toggle('hidden', state.isQuizActive);
    } else {
        // console.warn("Settings button not yet created.");
    }
}