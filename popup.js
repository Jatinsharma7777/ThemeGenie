// popup.js - Main Controller
import { PromptBuilder } from './modules/PromptBuilder.js';
import { CSSManager } from './modules/CSSManager.js';
import { AIEngine } from './modules/AIEngine.js';
import { ThemeHistory } from './modules/ThemeHistory.js';

document.addEventListener('DOMContentLoaded', async () => {
    // UI Elements
    const editor = document.getElementById('css-editor');
    const saveBtn = document.getElementById('save-btn');
    const domainDisplay = document.getElementById('domain-display');
    const btnSite = document.getElementById('btn-site');
    const btnGlobal = document.getElementById('btn-global');
    const dashboardBtn = document.getElementById('open-dashboard');
    const clearBtn = document.getElementById('clear-all');
    
    const aiPrompt = document.getElementById('ai-prompt');
    const aiMagicBtn = document.getElementById('ai-magic-btn');
    const aiStatus = document.getElementById('ai-status');

    const previewActions = document.getElementById('preview-actions');
    const keepYes = document.getElementById('keep-yes');
    const keepNo = document.getElementById('keep-no');
    const downloadCssBtn = document.getElementById('download-css');

    // State
    let currentMode = 'site';
    let previousThemeBackup = '';
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    const domain = tab?.url ? new URL(tab.url).hostname.replace(/^www\./, '') : 'restricted';
    domainDisplay.textContent = domain;

    // --- Core Logic ---

    async function loadEditor() {
        const result = await chrome.storage.local.get(['siteThemes', 'globalTheme']);
        if (currentMode === 'site') {
            const siteThemes = result.siteThemes || {};
            editor.value = siteThemes[domain] || '';
            editor.placeholder = `/* Custom CSS for ${domain} */`;
        } else {
            editor.value = result.globalTheme || '';
            editor.placeholder = `/* Global CSS (Applies to ALL sites) */`;
        }
    }

    // ISSUE #8: Logic-based Save (Proper function, no programmatic clicks)
    async function saveTheme(css) {
        if (currentMode === 'site') {
            await CSSManager.saveTheme(domain, css, { prompt: aiPrompt.value });
        } else {
            await chrome.storage.local.set({ globalTheme: css });
        }
        
        // Notify content script
        if (tab?.id) {
            chrome.tabs.sendMessage(tab.id, { action: 'refresh' }).catch(() => {
                chrome.scripting.executeScript({
                    target: { tabId: tab.id },
                    files: ['content.js']
                });
            });
        }

        saveBtn.textContent = 'SAVED & APPLIED ✅';
        setTimeout(() => saveBtn.textContent = 'APPLY', 2000);
    }

    // --- NEW FEATURE #3: Theme Generator Pipeline ---
    aiMagicBtn.onclick = async () => {
        const userPrompt = aiPrompt.value.trim();
        if (!userPrompt) return;

        aiStatus.textContent = 'Analyzing website...';
        aiStatus.classList.remove('hidden');
        aiMagicBtn.disabled = true;

        try {
            // Backup current theme for "NO" option
            previousThemeBackup = editor.value;

            // 1. Website Analyzer
            const analysis = await chrome.tabs.sendMessage(tab.id, { action: 'analyze' });

            // 2. Prompt Builder
            const prompt = PromptBuilder.generate(domain, analysis, editor.value, userPrompt);

            // 3. Direct Gemini Call (Prototype Mode)
            aiStatus.textContent = 'Dreaming up your theme...';
            const rawCSS = await AIEngine.generate(await getApiKey(), prompt);

            // 4. CSS Cleaner & Validator
            const cleanCSS = CSSManager.validate(CSSManager.clean(rawCSS));

            // 5. Live Preview (NEW FEATURE #6)
            editor.value = cleanCSS;
            applyLivePreview(cleanCSS);
            
            aiStatus.classList.add('hidden');
            previewActions.classList.remove('hidden');
        } catch (err) {
            console.error(err);
            aiStatus.textContent = 'Error: ' + err.message;
            setTimeout(() => aiStatus.classList.add('hidden'), 5000);
        } finally {
            aiMagicBtn.disabled = false;
        }
    };

    // NEW FEATURE #6: Live Preview
    function applyLivePreview(css) {
        chrome.scripting.executeScript({
            target: { tabId: tab.id },
            func: (cssText, id) => {
                let el = document.getElementById(id) || document.createElement('style');
                el.id = id;
                el.textContent = cssText;
                if (!el.parentElement) document.documentElement.appendChild(el);
            },
            args: [css, 'theme-genie-preview']
        });
    }

    keepYes.onclick = async () => {
        await saveTheme(editor.value);
        cleanupPreview();
    };

    keepNo.onclick = () => {
        editor.value = previousThemeBackup;
        cleanupPreview();
        // Restore previous live appearance
        saveTheme(previousThemeBackup);
    };

    function cleanupPreview() {
        previewActions.classList.add('hidden');
        chrome.scripting.executeScript({
            target: { tabId: tab.id },
            func: (id) => document.getElementById(id)?.remove(),
            args: ['theme-genie-preview']
        });
    }

    async function getApiKey() {
        const result = await chrome.storage.local.get(['geminiKey']);
        if (!result.geminiKey) throw new Error("Please set your API Key in the Dashboard.");
        return result.geminiKey;
    }

    // --- Original Event Handlers (Preserved & Cleaned) ---

    btnSite.onclick = () => {
        currentMode = 'site';
        btnSite.classList.add('active');
        btnGlobal.classList.remove('active');
        loadEditor();
    };

    btnGlobal.onclick = () => {
        currentMode = 'global';
        btnGlobal.classList.add('active');
        btnSite.classList.remove('active');
        loadEditor();
    };

    saveBtn.onclick = () => saveTheme(editor.value);
    clearBtn.onclick = () => editor.value = '';
    dashboardBtn.onclick = () => chrome.runtime.openOptionsPage();

    downloadCssBtn.onclick = () => {
        const css = editor.value;
        if (!css.trim()) return;
        const blob = new Blob([css], { type: 'text/css' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${domain.replace(/\./g, '-')}-theme.css`;
        a.click();
        URL.revokeObjectURL(url);
    };

    await loadEditor();
});
