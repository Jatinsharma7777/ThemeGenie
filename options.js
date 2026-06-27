const themesContainer = document.getElementById('themes-container');
const importInput = document.getElementById('import-input');
const exportBtn = document.getElementById('export-btn');
const addNewBtn = document.getElementById('add-new-btn');
const editGlobalBtn = document.getElementById('edit-global-btn');
const geminiKeyInput = document.getElementById('gemini-key');
const importBtn = document.getElementById('import-btn');
const closeEditorBtn = document.getElementById('close-editor-btn');
const downloadCssBtn = document.getElementById('download-css-btn');

// Editor elements
const editorOverlay = document.getElementById('editor-overlay');
const editorTitle = document.getElementById('editor-title');
const targetDomainInput = document.getElementById('target-domain');
const fullCssEditor = document.getElementById('full-css-editor');
const saveThemeBtn = document.getElementById('save-theme-btn');

const closeEditor = () => {
    editorOverlay.classList.remove('active');
};

async function loadThemes() {
    const result = await chrome.storage.local.get(['siteThemes', 'globalTheme', 'geminiKey']);
    const siteThemes = result.siteThemes || {};
    
    themesContainer.innerHTML = '';

    // 1. Add Global Theme Card first if it exists
    if (result.globalTheme) {
        const globalCard = document.createElement('div');
        globalCard.className = 'theme-card global-card';
        globalCard.style.borderLeft = '4px solid #3b82f6';
        globalCard.innerHTML = `
            <div>
                <h3>Global Styles</h3>
                <div class="domain">Applied to all websites</div>
            </div>
            <div class="code-preview">${result.globalTheme.substring(0, 100)}...</div>
            <div class="actions">
                <button class="edit-global-btn-inline">Edit Global</button>
            </div>
        `;
        themesContainer.appendChild(globalCard);
        
        globalCard.querySelector('.edit-global-btn-inline').onclick = () => {
            editGlobalBtn.click();
        };
    }
    
    Object.keys(siteThemes).forEach(domain => {
        const css = siteThemes[domain];
        const card = document.createElement('div');
        card.className = 'theme-card';
        card.innerHTML = `
            <div>
                <h3>Theme for</h3>
                <div class="domain">${domain}</div>
            </div>
            <div class="code-preview">${css.substring(0, 100)}...</div>
            <div class="actions">
                <button class="edit-btn" data-domain="${domain}">Edit</button>
                <button class="delete-btn" data-domain="${domain}">Remove</button>
            </div>
        `;
        themesContainer.appendChild(card);
    });

    // Attach listeners to dynamically created buttons
    document.querySelectorAll('.edit-btn').forEach(btn => {
        btn.onclick = () => editTheme(btn.dataset.domain);
    });
    document.querySelectorAll('.delete-btn').forEach(btn => {
        btn.onclick = () => deleteTheme(btn.dataset.domain);
    });

    if (Object.keys(siteThemes).length === 0) {
        themesContainer.innerHTML = '<p style="color: grey">No custom themes yet. Click "+ New Theme" to start!</p>';
    }

    if (result.geminiKey) {
        geminiKeyInput.value = result.geminiKey;
    }
}

const editTheme = async (domain) => {
    const result = await chrome.storage.local.get(['siteThemes']);
    const css = result.siteThemes[domain];
    
    editorTitle.textContent = `Editing ${domain}`;
    targetDomainInput.value = domain;
    targetDomainInput.disabled = true;
    fullCssEditor.value = css;
    editorOverlay.classList.add('active');
};

const deleteTheme = async (domain) => {
    if (confirm(`Delete theme for ${domain}?`)) {
        const result = await chrome.storage.local.get(['siteThemes']);
        const siteThemes = result.siteThemes || {};
        delete siteThemes[domain];
        await chrome.storage.local.set({ siteThemes });
        loadThemes();
    }
};

// Event Listeners
geminiKeyInput.onchange = async () => {
    await chrome.storage.local.set({ geminiKey: geminiKeyInput.value });
};

importBtn.onclick = () => {
    importInput.click();
};

closeEditorBtn.onclick = closeEditor;

downloadCssBtn.onclick = () => {
    const domain = targetDomainInput.value.trim() || 'theme';
    const css = fullCssEditor.value;
    const blob = new Blob([css], { type: 'text/css' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${domain.replace(/\./g, '-')}.css`;
    a.click();
    URL.revokeObjectURL(url);
};

addNewBtn.onclick = () => {
    editorTitle.textContent = 'New Theme';
    targetDomainInput.value = '';
    targetDomainInput.disabled = false;
    fullCssEditor.value = '';
    editorOverlay.classList.add('active');
};

editGlobalBtn.onclick = async () => {
    const result = await chrome.storage.local.get(['globalTheme']);
    editorTitle.textContent = 'Editing Global CSS';
    targetDomainInput.value = 'Global (All Sites)';
    targetDomainInput.disabled = true;
    fullCssEditor.value = result.globalTheme || '';
    editorOverlay.classList.add('active');
};

saveThemeBtn.onclick = async () => {
    let domain = targetDomainInput.value.trim().toLowerCase();
    const css = fullCssEditor.value.trim();

    if (!domain) {
        alert('Please enter a target domain.');
        return;
    }

    const isGlobal = targetDomainInput.value === 'Global (All Sites)';

    if (isGlobal) {
        await chrome.storage.local.set({ globalTheme: css });
    } else {
        try {
            if (domain.includes('://')) domain = new URL(domain).hostname;
            else if (domain.includes('/')) domain = domain.split('/')[0];
        } catch(e) {}

        const result = await chrome.storage.local.get(['siteThemes']);
        const siteThemes = result.siteThemes || {};
        siteThemes[domain] = css;
        await chrome.storage.local.set({ siteThemes });
    }
    
    closeEditor();
    loadThemes();
};

exportBtn.onclick = async () => {
    const result = await chrome.storage.local.get(['siteThemes']);
    const blob = new Blob([JSON.stringify(result.siteThemes, null, 2)], {type: "application/json"});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'themegenie-backup.json';
    a.click();
};

importInput.onchange = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const fileName = file.name.toLowerCase();
    const reader = new FileReader();

    reader.onload = async (event) => {
        const content = event.target.result;

        if (fileName.endsWith('.css')) {
            // 1. Detect Active Tab & Domain
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            let detectedDomain = '';
            try {
                detectedDomain = new URL(tab.url).hostname.replace(/^www\./, '');
            } catch(e) {}

            if (!detectedDomain) detectedDomain = 'imported-theme';

            // 2. Load into Editor (for visibility)
            editorTitle.textContent = 'Active Theme';
            targetDomainInput.value = detectedDomain;
            fullCssEditor.value = content;
            editorOverlay.classList.add('active');

            // 3. AUTO-SAVE & APPLY (The Stylus Way)
            const storageResult = await chrome.storage.local.get(['siteThemes']);
            const siteThemes = storageResult.siteThemes || {};
            siteThemes[detectedDomain] = content;
            await chrome.storage.local.set({ siteThemes });

            // 4. Update the management list
            loadThemes();

            // 5. Inject Preview immediately
            if (tab?.id) {
                chrome.scripting.executeScript({
                    target: { tabId: tab.id },
                    func: (cssText) => {
                        let el = document.getElementById('theme-genie-preview') || document.createElement('style');
                        el.id = 'theme-genie-preview';
                        el.textContent = cssText;
                        if (!el.parentElement) document.documentElement.appendChild(el);
                    },
                    args: [content]
                });
            }

            alert('CSS theme imported successfully.');
        } else if (fileName.endsWith('.json') || fileName.endsWith('.themegenie')) {
            // Handle JSON Backups
            try {
                const imported = JSON.parse(content);
                const result = await chrome.storage.local.get(['siteThemes']);
                const current = result.siteThemes || {};
                const merged = { ...current, ...imported };
                await chrome.storage.local.set({ siteThemes: merged });
                loadThemes();
                alert('JSON Theme backup imported successfully!');
            } catch (err) { 
                alert('Error: This file is not a valid ThemeGenie JSON backup.'); 
            }
        } else {
            alert('Unsupported file type. Please use .css, .json, or .themegenie.');
        }
        // Clear input to allow re-importing same file
        importInput.value = '';
    };

    reader.readAsText(file);
};

document.addEventListener('DOMContentLoaded', loadThemes);
