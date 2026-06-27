// modules/ThemeHistory.js
export class ThemeHistory {
    static async getHistory(domain) {
        const result = await chrome.storage.local.get(['themeHistory']);
        const history = result.themeHistory || [];
        return history.filter(h => h.domain === domain);
    }

    static async undo(domain) {
        const history = await this.getHistory(domain);
        if (history.length < 2) return null; // No previous theme to restore

        // Current theme is at [0], previous is at [1]
        const previousTheme = history[1].css;
        
        // Remove current from history? Or just move it back?
        // For simplicity, we'll just return the previous theme and let the manager save it
        return previousTheme;
    }
}
