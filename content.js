(function() {
    const domain = window.location.hostname.replace(/^www\./, '');
    let styleEl = null;
    let globalStyleEl = null;

    // --- State & Caching ---
    let lastAnalysis = null;
    let lastURL = window.location.href;

    function createStyleTag(id) {
        let el = document.getElementById(id);
        if (!el) {
            el = document.createElement('style');
            el.id = id;
            if (document.documentElement) document.documentElement.appendChild(el);
        }
        return el;
    }

    function updateStyles() {
        chrome.storage.local.get(['siteThemes', 'globalTheme'], (result) => {
            if (result.globalTheme) {
                globalStyleEl = createStyleTag('theme-genie-global');
                globalStyleEl.textContent = result.globalTheme;
            }
            const siteThemes = result.siteThemes || {};
            const match = siteThemes[domain];
            if (match) {
                styleEl = createStyleTag('theme-genie-style');
                styleEl.textContent = match;
            }
        });
    }

    // ISSUE #1-7: Page Analyzer Implementation
    function analyzePage() {
        if (lastAnalysis && window.location.href === lastURL) {
            return lastAnalysis;
        }

        const styles = getComputedStyle(document.documentElement);
        const bodyStyles = getComputedStyle(document.body);

        const analysis = {
            websiteName: document.title.split(' - ')[0] || domain,
            domain: domain,
            pageTitle: document.title,
            theme: detectTheme(styles, bodyStyles),
            cssVariables: getFilteredVariables(styles),
            colors: getCoreColors(styles, bodyStyles),
            typography: getTypography(styles, bodyStyles),
            layout: detectSemanticLayout(),
            interactiveElements: getComponentCounts(),
            importantElements: getSignificantSelectors(),
            pageSummary: `A ${domain} page with a ${detectTheme(styles, bodyStyles)} theme.`
        };

        lastAnalysis = analysis;
        lastURL = window.location.href;
        return analysis;
    }

    // ISSUE #2: Intelligent Variable Filtering
    function getFilteredVariables(styles) {
        const keptKeys = ['background', 'text', 'brand', 'accent', 'border', 'panel', 'chat', 'button', 'surface', 'interactive'];
        const vars = {};
        let count = 0;

        for (let i = 0; i < styles.length; i++) {
            const prop = styles[i];
            if (prop.startsWith('--') && count < 100) {
                const isRelevant = keptKeys.some(key => prop.toLowerCase().includes(key));
                if (isRelevant) {
                    vars[prop] = styles.getPropertyValue(prop).trim();
                    count++;
                }
            }
        }
        return vars;
    }

    // ISSUE #3: Semantic Layout Detection
    function detectSemanticLayout() {
        return {
            serverSidebar: !!document.querySelector('.sidebar-1tnWbe, [class*="sidebar"]'), // Discord specific hint
            channelSidebar: !!document.querySelector('nav, [class*="channels"]'),
            chatArea: !!document.querySelector('main, [class*="chat"]'),
            memberSidebar: !!document.querySelector('[class*="membersWrap"]'),
            messageBox: !!document.querySelector('[class*="channelTextArea"]'),
            hasNav: !!document.querySelector('nav, [class*="nav"]'),
            modalCount: document.querySelectorAll('[class*="modal"], [class*="dialog"]').length
        };
    }

    // ISSUE #4: Typography Collection
    function getTypography(root, body) {
        return {
            fontFamily: root.fontFamily || body.fontFamily,
            fontSize: root.fontSize || body.fontSize,
            fontWeight: root.fontWeight || body.fontWeight,
            lineHeight: root.lineHeight || body.lineHeight
        };
    }

    // ISSUE #5: Component Counts
    function getComponentCounts() {
        return {
            buttons: document.querySelectorAll('button').length,
            links: document.querySelectorAll('a').length,
            forms: document.querySelectorAll('form').length,
            inputs: document.querySelectorAll('input').length,
            textareas: document.querySelectorAll('textarea').length,
            media: {
                svg: document.querySelectorAll('svg').length,
                img: document.querySelectorAll('img').length,
                video: document.querySelectorAll('video').length,
                canvas: document.querySelectorAll('canvas').length
            }
        };
    }

    // ISSUE #6: Core Colors
    function getCoreColors(styles, body) {
        return {
            primaryBackground: styles.backgroundColor || body.backgroundColor,
            secondaryBackground: styles.getPropertyValue('--background-secondary') || 'auto',
            text: styles.color || body.color,
            accent: styles.getPropertyValue('--accent') || styles.getPropertyValue('--brand') || 'auto',
            hover: styles.getPropertyValue('--hover') || 'auto',
            selection: styles.getPropertyValue('--selection') || 'auto'
        };
    }

    // ISSUE #7: Theme Detection
    function detectTheme(styles, body) {
        const bg = styles.backgroundColor || body.backgroundColor;
        if (!bg || bg === 'rgba(0, 0, 0, 0)' || bg === 'transparent') {
            // Check body if root is transparent
            const bodyBg = body.backgroundColor;
            return checkBrightness(bodyBg);
        }
        return checkBrightness(bg);
    }

    function checkBrightness(color) {
        const rgb = color.match(/\d+/g);
        if (!rgb || rgb.length < 3) return 'light';
        const brightness = (parseInt(rgb[0]) * 299 + parseInt(rgb[1]) * 587 + parseInt(rgb[2]) * 114) / 1000;
        return brightness < 128 ? 'dark' : 'light';
    }

    function getSignificantSelectors() {
        const containers = Array.from(document.querySelectorAll('body > div'))
            .filter(div => div.id || div.classList.length > 0)
            .slice(0, 5)
            .map(div => ({ tag: 'div', id: div.id, classes: Array.from(div.classList) }));
        return containers;
    }

    // --- Communication ---
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
        if (message.action === 'refresh') {
            updateStyles();
            sendResponse({ status: 'refreshed' });
        } else if (message.action === 'analyze') {
            sendResponse(analyzePage());
        }
        return true;
    });

    updateStyles();
})();
