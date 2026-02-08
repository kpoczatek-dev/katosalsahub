/**
 * SPA Router for Kato Salsa Hub
 * Handles seamless navigation between pages without breaking radio playback.
 */

let isNavigating = false;

document.addEventListener('DOMContentLoaded', () => {
    
    // Intercept Links
    document.body.addEventListener('click', e => {
        const link = e.target.closest('a');
        if (!link) return;

        const href = link.getAttribute('href');
        if (!href || href.startsWith('http') || href.startsWith('mailto:')) return;

        // Check for Hash-only navigation on same page
        // Use full path comparison to be safe
        const currentPath = window.location.pathname.replace(/^\/|\/$/g, '') || 'index.html';
        const targetUrlParts = href.split('#');
        const targetPath = targetUrlParts[0].replace(/^\/|\/$/g, '') || 'index.html';
        
        console.log('Nav Click:', {href, currentPath, targetPath});

        if (currentPath === targetPath && href.includes('#')) {
            console.log('Hash Nav Intercepted (Default Behavior)');
            return;
        }

        e.preventDefault();
        navigateTo(href);
    });

    // Handle Back/Forward Browser Buttons
    window.addEventListener('popstate', () => {
        loadPage(window.location.pathname + window.location.hash);
    });

    // Initial Init
    const path = window.location.pathname;
    if (path.includes('salsopedia.html')) {
        if (window.initWiki && !window.wikiInitialized) window.initWiki();
    } else {
        if (window.initHome && !window.homeInitialized) window.initHome();
    }
});

async function navigateTo(url) {
    if (isNavigating) return;
    
    // Normalize URL: Ensure it doesn't break if we are "deep" (though here structure is flat)
    // If url is relative like "index.html", it's fine.
    
    history.pushState(null, null, url);
    await loadPage(url);
}

async function loadPage(url) {
    if (isNavigating) return;
    isNavigating = true;

    const appContent = document.getElementById('app-content');
    appContent.style.opacity = '0.5';

    try {
        // Strip hash for fetching
        const fetchUrl = url.split('#')[0] || 'index.html';
        
        const response = await fetch(fetchUrl);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        
        const text = await response.text();
        const parser = new DOMParser();
        const doc = parser.parseFromString(text, 'text/html');
        const newContent = doc.getElementById('app-content');
        
        if (!newContent) {
            window.location.href = url; // Fallback
            return;
        }

        appContent.innerHTML = newContent.innerHTML;
        appContent.style.opacity = '1';
        
        // Re-initialize Scripts
        if (url.includes('salsopedia.html')) {
            // Function to run wiki init
            const runWiki = () => {
                if (typeof window.initWiki === 'function') {
                    window.initWiki();
                } else {
                    console.error('initWiki still not found after loading!');
                }
            };

            if (typeof window.initWiki === 'function') {
                runWiki();
            } else {
                console.log('initWiki not found, loading wiki.js...');
                try {
                    await loadScript('assets/js/wiki.js');
                    runWiki();
                } catch (e) {
                     console.error('Failed to load wiki.js', e);
                }
            }
        } else {
             // Function to run home init
            const runHome = () => {
                if (typeof window.initHome === 'function') {
                    window.initHome();
                } else {
                     console.error('initHome still not found after loading!');
                }
            };

            if (typeof window.initHome === 'function') {
                runHome();
            } else {
                console.log('initHome not found, loading home.js...');
                 try {
                    await loadScript('assets/js/home.js');
                    runHome();
                } catch (e) {
                     console.error('Failed to load home.js', e);
                }
            }
        }

        // Scroll
        const hash = url.split('#')[1];
        if (hash) {
            setTimeout(() => {
                const el = document.getElementById(hash);
                if (el) el.scrollIntoView();
            }, 100); 
        } else {
            window.scrollTo(0, 0);
        }

        // Re-init Radio (Always, as buttons might be re-rendered)
        if (typeof window.initRadio === 'function') {
            window.initRadio();
        }

        updateNavLinks(url);

    } catch (error) {
        console.error('Navigation Error:', error);
        // Only fallback if really broken
        if (confirm('Wystąpił błąd nawigacji. Czy chcesz przeładować stronę?')) {
            window.location.href = url;
        } else {
            appContent.style.opacity = '1'; // Restore
        }
    } finally {
        isNavigating = false;
    }
}

function loadScript(src) {
    return new Promise((resolve, reject) => {
        // Check if already exists (ignore query params for check)
        // We check if any script starts with the src path
        if (document.querySelector(`script[src^="${src}"]`)) {
            resolve();
            return;
        }
        const script = document.createElement('script');
        script.src = src + '?v=' + Date.now(); // Cache Buster
        script.onload = resolve;
        script.onerror = reject;
        document.body.appendChild(script);
    });
}

function updateNavLinks(url) {
    // Simplify URL for comparison
    const targetFile = url.split('#')[0].split('/').pop() || 'index.html';
    
    document.querySelectorAll('.nav-links a').forEach(a => {
        a.classList.remove('active');
        a.style.color = '';
        
        const linkHref = a.getAttribute('href').split('#')[0] || 'index.html';
        const linkFile = linkHref.split('/').pop() || 'index.html'; // Robust comparison
        
        if (targetFile === linkFile) {
            a.classList.add('active');
            if(targetFile === 'salsopedia.html') a.style.color = 'var(--cuban-orange)';
        }
    });

    const navLinks = document.querySelector('.nav-links');
    const burger = document.querySelector('.burger-menu');
    if (navLinks && navLinks.classList.contains('active')) {
        navLinks.classList.remove('active');
        if(burger) burger.classList.remove('active');
    }
}
