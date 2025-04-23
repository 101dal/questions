import * as dom from './dom.js';
import { state } from './state.js';
import { applyTheme } from './ui.js';
import { saveUserPreferences } from './storage.js';
import { handleExportData, handleImportData } from './importExport.js';
import { renderGlobalStats, renderQuizStats, renderGamificationStats } from './stats.js';

export function setupSettingsScreen() {
    // Add event listeners specific to the settings screen
    dom.settings.themeSelect.addEventListener('change', handleThemeChange);
    dom.settings.soundEffectsToggle.addEventListener('change', handleSoundToggle);
    dom.settings.exportDataBtn.addEventListener('click', handleExportData);
    dom.settings.importDataBtn.addEventListener('click', handleImportData);
}

export function renderSettingsScreen() {
    // Apply current preferences to controls
    dom.settings.themeSelect.value = state.userPreferences.theme || 'light';
    dom.settings.soundEffectsToggle.checked = state.userPreferences.soundEnabled !== undefined ? state.userPreferences.soundEnabled : true; // Default true

    // Render stats sections by calling functions from stats.js
    renderGlobalStats();
    renderQuizStats();
    renderGamificationStats();
}

function handleThemeChange(event) {
    state.userPreferences.theme = event.target.value;
    applyTheme(state.userPreferences.theme);
    saveUserPreferences();
}

function handleSoundToggle(event) {
    state.userPreferences.soundEnabled = event.target.checked;
    saveUserPreferences();
}