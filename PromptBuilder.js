// modules/PromptBuilder.js
export class PromptBuilder {
    static generate(domain, analysis, currentCSS, userPrompt) {
        const persona = this.getPersona(domain);
        
        // ISSUE #11: Compress prompt size (Summary instead of raw)
        const compressedAnalysis = {
            theme: analysis.theme,
            layout: analysis.layout,
            vars: analysis.cssVariables,
            typography: analysis.typography
        };

        let prompt = `${persona}\n\n`;
        
        // ISSUE #10: Include existing CSS
        if (currentCSS && currentCSS.trim().length > 0) {
            prompt += `CURRENT THEME:\n${currentCSS}\n\n`;
            prompt += `TASK: Improve or modify the existing theme based on the user request. Do not start from scratch unless requested.\n\n`;
        }

        prompt += `PAGE ANALYSIS:\n${JSON.stringify(compressedAnalysis)}\n\n`;
        prompt += `USER REQUEST: ${userPrompt}\n\n`;
        prompt += `RULES:\n`;
        prompt += `1. Output ONLY raw CSS.\n`;
        prompt += `2. Do not use markdown blocks.\n`;
        prompt += `3. Focus on ${analysis.theme === 'dark' ? 'enhancing' : 'converting to'} the aesthetic.\n`;
        prompt += `4. Ensure selectors match the analyzed structure.\n`;

        return prompt;
    }

    // ISSUE #9: Dynamic Persona Generation
    static getPersona(domain) {
        if (domain.includes('discord')) return "You are an expert Discord UI designer, specialist in Vencord and BetterDiscord themes.";
        if (domain.includes('github')) return "You are a GitHub redesign specialist, expert in minimalist and productivity-focused dark modes.";
        if (domain.includes('youtube')) return "You are a YouTube UI designer, focused on cinematic and distraction-free viewing experiences.";
        if (domain.includes('twitter') || domain.includes('x.com')) return "You are an X UI designer, expert in modern social media layouts.";
        if (domain.includes('reddit')) return "You are a Reddit UI designer, specialist in old and new Reddit layouts.";
        
        return "You are an expert frontend designer and CSS master.";
    }
}
