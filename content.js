(function() {
    console.log("[PracticePaper Saver] V4 AI-Refined Active - Precision GPS Mode.");

    // 1. Get the exact URL including page numbers (fixes the copying-across-pages bug)
    function getPageKey() {
        return 'gate_' + window.location.pathname + window.location.search;
    }

    // 2. Generates a flawless structural coordinate path (ignores MathJax & color changes)
    function getExactSelector(el) {
        if (!(el instanceof Element)) return '';
        let path = [];
        while (el.nodeType === Node.ELEMENT_NODE && el.nodeName.toLowerCase() !== 'html') {
            let selector = el.nodeName.toLowerCase();
            let sibling = el, nth = 1;
            while (sibling = sibling.previousElementSibling) {
                if (sibling.nodeName.toLowerCase() === selector) nth++;
            }
            selector += `:nth-of-type(${nth})`;
            path.unshift(selector);
            el = el.parentNode;
        }
        return path.join(" > ");
    }

    // 3. Scans backwards up the page to find exactly which "Question X" you are under
    function getQuestionGroupId(clickedEl) {
        let allElements = Array.from(document.querySelectorAll('*'));
        let clickedIndex = allElements.indexOf(clickedEl);
        
        for (let i = clickedIndex; i >= 0; i--) {
            let el = allElements[i];
            let text = el.innerText || el.textContent || "";
            // Look for "Question X" in standard text blocks
            if (text.length > 0 && text.length < 300) {
                let match = text.match(/Question\s*(\d+)/i);
                if (match) {
                    return "Q_" + match[1]; // e.g., "Q_1", "Q_2"
                }
            }
        }
        
        // Fallback just in case they hide the question number
        let parent = clickedEl;
        for(let i=0; i<4; i++) {
            if(parent.parentElement && parent.parentElement !== document.body) {
                parent = parent.parentElement;
            }
        }
        return "Group_" + getExactSelector(parent);
    }

    let isAutoClicking = false;
    let currentlyRestored = new Set();
    let lastUrl = getPageKey();

    // 4. The Restore Engine
    function restoreAnswers() {
        let currentUrl = getPageKey();
        
        // If you clicked 'Next Page', reset our memory so we can click the new page's answers
        if (currentUrl !== lastUrl) {
            currentlyRestored.clear();
            lastUrl = currentUrl;
        }

        chrome.storage.local.get([currentUrl], function(result) {
            let savedState = result[currentUrl] || {};
            isAutoClicking = true;
            let count = 0;

            for (let qId in savedState) {
                let selector = savedState[qId];
                if (!currentlyRestored.has(selector)) {
                    let el = document.querySelector(selector);
                    if (el) {
                        el.click(); // Re-click your saved answer!
                        currentlyRestored.add(selector);
                        count++;
                    }
                }
            }
            
            if (count > 0) {
                console.log(`[PracticePaper Saver] Restored ${count} answers on this page.`);
            }
            // Let the site's animations settle before accepting manual clicks again
            setTimeout(() => { isAutoClicking = false; }, 150); 
        });
    }

    // 5. Intercept your manual clicks and save them
    document.addEventListener('click', (e) => {
        if (isAutoClicking) return; // Don't save our own automated restoring clicks
        if (e.target.closest('a')) return; // Ignore normal links like "Next Page"

        let target = e.target;
        let isClickableOption = false;

        // Verify you actually clicked a quiz bubble/option
        for (let i=0; i<3; i++) {
            if (target && target !== document.body) {
                if (window.getComputedStyle(target).cursor === 'pointer' || 
                    /INPUT|LABEL|LI/i.test(target.tagName) ||
                    (typeof target.className === 'string' && /option|choice|answer|mark/i.test(target.className))) {
                    isClickableOption = true;
                    break;
                }
                target = target.parentElement;
            }
        }

        if (!isClickableOption || !target) return;

        let qId = getQuestionGroupId(target);
        let selector = getExactSelector(target);
        let currentUrl = getPageKey();

        chrome.storage.local.get([currentUrl], function(result) {
            let savedState = result[currentUrl] || {};
            savedState[qId] = selector; // Map this answer to "Question 1" (overwrites if you change your mind)
            
            let toSave = {};
            toSave[currentUrl] = savedState;
            chrome.storage.local.set(toSave, () => {
                currentlyRestored.add(selector);
                console.log(`[PracticePaper Saver] Saved answer for ${qId}`);
            });
        });
    });

    // Run slightly delayed on load to give MathJax time to finish drawing
    setTimeout(restoreAnswers, 800);

    // Watch the page silently. If you click 'Next Page' without refreshing, this detects it and restores.
    let debounceTimer;
    const observer = new MutationObserver(() => {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(restoreAnswers, 600);
    });
    observer.observe(document.body, { childList: true, subtree: true });

})();