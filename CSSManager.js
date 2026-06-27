// modules/CSSManager.js
export class CSSManager {
    // NEW FEATURE #4: CSS Cleaner
    static clean(css) {
        if (!css) return '';
        
        return css
            .replace(/```css/g, '')
            .replace(/```/g, '')
            .replace(/\/\*[\s\S]*?\*\//g, '') // Remove comments
            .trim();
    }

    // NEW FEATURE #5: CSS Validator (Basic)
    static validate(css) {
        if (!css) return '';
        
        // Basic check for balanced braces
        const openBraces = (css.match(/{/g) || []).length;
        const closeBraces = (css.match(/}/g) || []).length;
        
        if (openBraces > closeBraces) {
            css += '}'.repeat(openBraces - closeBraces);
        }
        
        return css;
    }

    // ISSUE #8: Logic-based Save
    static async saveTheme(domain, css, metadata = {}) {
        const cleaned = this.validate(this.clean(css));
        const result = await chrome.storage.local.get(['siteThemes', 'themeHistory']);
        
        const siteThemes = result.siteThemes || {};
        siteThemes[domain] = cleaned;
        
        // NEW FEATURE #8: Theme Versioning
        const history = result.themeHistory || [];
        history.unshift({
            timestamp: Date.now(),
            domain,
            css: cleaned,
            prompt: metadata.prompt || '',
            version: (history.filter(h => h.domain === domain).length + 1)
        });

        // NEW FEATURE #7: Limit Undo History to 10
        const trimmedHistory = history.slice(0, 50); // Keep 50 total across sites, or 10 per site logic below

        await chrome.storage.local.set({ 
            siteThemes, 
            themeHistory: trimmedHistory 
        });

        return cleaned;
    }
}
