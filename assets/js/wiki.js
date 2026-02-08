// wiki.js v11 (AppState Refactor)
const API_URL = 'assets/php/wiki.php';

// Unified State
const AppState = {
    terms: [],
    pending: [],
    category: 'all',
    ui: {
        loading: null, // Init in DOMContentLoaded
        selects: {}
    }
};

// --- Initialization ---

    }
};

let wikiInitialized = false;

// --- Event Driven Initialization ---

function onWikiPageLoaded(e) {
    const path = e.detail ? e.detail.path : window.location.pathname.replace(/^\//,'');
    
    if (path.includes('salsopedia.html')) {
        // Always run init if DOM replaced
        // Reset parts of AppState logic if needed?
        AppState.ui.loading = document.getElementById('loading');
        
        // if (!wikiInitialized) { ... } 
        // Actually, since DOM is replaced, listeners on buttons are gone.
        // We MUST re-run initWiki to attach listeners and fetch data.
        initWiki();
        
        // Re-setup global selects as DOM is new
         document.querySelectorAll('.custom-select-wrapper').forEach(wrapper => {
            const selectId = wrapper.querySelector('select').id;
            AppState.ui.selects[selectId] = new CustomSelect(wrapper);
        });
        
        // Re-setup Search & Modal
        const searchInput = document.getElementById('searchInput');
        if(searchInput) {
            searchInput.addEventListener('input', debounce((e) => handleSearch(e), 300));
        }
        // ... other setups ...
        
        wikiInitialized = true;
    } else {
        wikiInitialized = false;
    }
}

document.addEventListener('DOMContentLoaded', () => {
   // Initial Check
   const path = window.location.pathname.replace(/^\//,'');
   if(path.includes('salsopedia.html')) {
       AppState.ui.loading = document.getElementById('loading');
       initWiki(); 
       // Setup Selects etc. needs to be part of initWiki or called here
       // Moving setup logic into initWiki or helper would be cleaner
       // For now, keeping structure but ensuring call
       setupWikiInteractions();
   }
});

document.addEventListener('page:loaded', (e) => {
    // Navigation Check
     if (e.detail.path.includes('salsopedia.html')) {
        AppState.ui.loading = document.getElementById('loading');
        initWiki();
        setupWikiInteractions();
     }
});

function setupWikiInteractions() {
    // Extracted Setup Logic
    document.querySelectorAll('.custom-select-wrapper').forEach(wrapper => {
        const selectId = wrapper.querySelector('select').id;
        AppState.ui.selects[selectId] = new CustomSelect(wrapper);
    });

    const modal = document.getElementById('modal');
    const closeBtn = document.querySelector('.close-modal');
    if(closeBtn) closeBtn.onclick = closeModal;
    if(modal) window.onclick = (e) => { if (e.target == modal) closeModal(); };

    const searchInput = document.getElementById('searchInput');
    if(searchInput) {
        searchInput.addEventListener('input', debounce((e) => handleSearch(e), 300));
    }
    
    const form = document.getElementById('termForm');
    if(form) form.addEventListener('submit', handleFormSubmit);

    addSourceRow();
}

async function initWiki() {
    toggleLoading(true);
    await fetchTerms();
    window.fetchPendingTerms = fetchPendingTerms;
    toggleLoading(false);
}

// --- Fetching Data ---

async function fetchTerms() {
    try {
        const response = await fetch(API_URL + '?action=list');
        allTerms = await response.json();
        
        // Initial Render
        const urlParams = new URLSearchParams(window.location.search);
        const termId = urlParams.get('term');
        
        renderTerms(allTerms);
        
        if (termId) {
            setTimeout(() => scrollToTerm(termId), 500);
        }
    } catch (error) {
        console.error('Error fetching terms:', error);
        document.getElementById('wikiGrid').innerHTML = '<p class="error-msg">Nie udało się pobrać haseł.</p>';
    }
}

async function fetchPendingTerms() {
    const grid = document.getElementById('wikiGrid');
    if(!grid) return; // Safeguard if on Home
    
    toggleLoading(true);
    try {
        const response = await fetch(API_URL + '?action=pending');
        const data = await response.json();
        
        // Map to internal format (ID is uniform now)
        pendingTerms = data.map(t => ({ // Assign to global
            ...t,
            isPending: true
        }));
        
        renderTerms(pendingTerms, true);
        
    } catch (error) {
        console.error('Error fetching pending:', error);
        alert('Błąd pobierania oczekujących haseł.');
    }
    toggleLoading(false);
}

// --- Rendering ---

function renderTerms(terms, isPendingMode = false) {
    const grid = document.getElementById('wikiGrid');
    if(!grid) return;
    
    grid.innerHTML = '';
    
    if (terms.length === 0) {
        grid.innerHTML = '<div class="no-results">Brak haseł spełniających kryteria.</div>';
        return;
    }
    
    // Sorting (A-Z) if not pending (pending usually chronological?)
    // Fix: Use spread syntax to avoid mutating original array
    const sortedTerms = isPendingMode ? [...terms] : [...terms].sort((a, b) => a.term.localeCompare(b.term));

    sortedTerms.forEach(term => {
        const card = document.createElement('div');
        card.className = `wiki-card ${isPendingMode ? 'pending-card' : ''}`;
        card.id = `card-${term.id}`;
        
        // Categories Badges
        let catsHtml = '';
        const cats = Array.isArray(term.category) ? term.category : [term.category];
        cats.forEach(c => {
            catsHtml += `<span class="category-badge">${getCategoryName(c)}</span>`;
        });
        
        // Source Logic (Simplified)
        let sourceHtml = '';
        const sources = Array.isArray(term.source) ? term.source : (term.source ? [term.source] : []);
        
        if (sources.length > 0) {
             sourceHtml = '<div class="wiki-card-source">Sources: ';
             sources.forEach(s => {
                 const name = s.name || 'Link';
                 const url = s.url || '#';
                 if(url && url !== '#') sourceHtml += `<a href="${url}" target="_blank">${name}</a> `;
                 else sourceHtml += `<span>${name}</span> `;
             });
             sourceHtml += '</div>';
        }

        // Action Buttons (Pending vs Live)
        let actionBtn = '';
        if (isPendingMode) {
            actionBtn = `
                <div class="moderation-actions">
                    <button class="btn-approve" onclick="approveTerm('${term.id}')">Zatwierdź</button>
                    <button class="btn-reject" onclick="rejectTerm('${term.id}')">Odrzuć</button>
                    <button class="btn-edit" onclick="openVerifyModal('${term.id}')">Edytuj</button>
                </div>
            `;
        } else {
            actionBtn = `<button class="btn-verify" onclick="openVerifyModal('${term.id}')">Zgłoś poprawkę / Weryfikuj</button>`;
        }
        
        // Status Badge
        let statusBadge = '';
        if (term.status === 'verified') {
            statusBadge = `<span class="verified-badge" title="Zweryfikowane ${term.verification_count} razy">✓ ${term.verification_count || 1}</span>`;
        }

        card.innerHTML = `
            <div class="wiki-card-header">
                <h3>${term.term}</h3>
                ${statusBadge}
            </div>
            <div class="wiki-card-meta">
                ${catsHtml}
            </div>
            <div class="wiki-card-body">
                <p>${term.definition}</p>
            </div>
            ${sourceHtml}
            <div class="wiki-card-footer">
                <span class="author">Dodane przez: ${term.author}</span>
                ${actionBtn}
            </div>
        `;
        grid.appendChild(card);
    });
}

// --- Actions (Submit & Moderation) ---

async function handleFormSubmit(e) {
    e.preventDefault();
    const form = document.getElementById('termForm');
    const formMessage = document.getElementById('formMessage');
    const formData = new FormData(form);
    
    // Honeypot
    if (formData.get('surname')) {
        formMessage.innerHTML = '<div class="alert alert-success">Zgłoszenie wysłane!</div>';
        setTimeout(closeModal, 2000);
        return;
    }

    try {
        // Send to wiki.php?action=submit (FormData directly)
        const response = await fetch(API_URL + '?action=submit', {
            method: 'POST',
            body: formData
        });
        
        const result = await response.json();
        
        if (result.success) {
             formMessage.innerHTML = `<div class="alert alert-success">Zgłoszenie wysłane do moderacji!</div>`;
             form.reset();
             setTimeout(closeModal, 2000);
        } else {
             formMessage.innerHTML = `<div class="alert alert-danger">${result.error || 'Błąd'}</div>`;
        }
    } catch (error) {
        console.error('Submit Error:', error);
        formMessage.innerHTML = '<div class="alert alert-danger">Błąd połączenia.</div>';
    }
}

async function processModeration(id, action) {
    const password = sessionStorage.getItem('katoAdminPass') || prompt("Podaj hasło administratora:");
    if(!password) return;

    if(password) sessionStorage.setItem('katoAdminPass', password);

    try {
        const response = await fetch(API_URL + '?action=moderate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id, action, password })
        });

        const result = await response.json();

        if (result.success) {
            alert("Operacja wykonana pomyślnie.");
            fetchPendingTerms(); // Refresh list
        } else {
             alert("Błąd: " + (result.error || 'Nieznany błąd'));
             if(result.error && result.error.includes("autoryzacji")) {
                sessionStorage.removeItem('katoAdminPass');
             }
        }
    } catch (error) {
        console.error("Moderation Error:", error);
        alert("Błąd połączenia z serwerem.");
    }
}

async function approveTerm(id) {
    if(!confirm("Zatwierdzić?")) return;
    await processModeration(id, 'approve');
}
window.approveTerm = approveTerm;

async function rejectTerm(id) {
    if(!confirm("Odrzucić?")) return;
    await processModeration(id, 'reject');
}
window.rejectTerm = rejectTerm;

// --- UI Helpers ---

function toggleLoading(show) {
    if(loading) loading.style.display = show ? 'flex' : 'none';
}

function openModal() {
    const form = document.getElementById('termForm');
    const modal = document.getElementById('modal');
    if(form) form.reset();
    document.getElementById('termId').value = '';
    document.getElementById('isVerification').value = '';
    document.getElementById('modalTitle').innerText = 'Dodaj nowe hasło';
    modal.classList.add('open');
    
    // Reset inputs
    document.getElementById('sourceContainer').innerHTML = '';
    addSourceRow();
}
window.openModal = openModal;

function closeModal() {
    const modal = document.getElementById('modal');
    modal.classList.remove('open');
    document.getElementById('formMessage').innerHTML = '';
}
window.closeModal = closeModal;

function openVerifyModal(id) {
    // Search in Live OR Pending
    const term = allTerms.find(t => t.id === id) || pendingTerms.find(t => t.id === id) || {id: id};
    if (!term) return;
    
    // Populate form logic here (Simplified for brevity, assuming standard fill)
    fillForm(term);
    document.getElementById('isVerification').value = '1';
    document.getElementById('modalTitle').innerText = 'Edytuj / Weryfikuj hasło';
    document.getElementById('modal').classList.add('open');
}
window.openVerifyModal = openVerifyModal;

function fillForm(term) {
    document.getElementById('termId').value = term.id || '';
    document.getElementById('termInput').value = term.term || '';
    document.getElementById('definitionInput').value = term.definition || '';
    document.getElementById('authorInput').value = term.author || '';
    // ... Fill other fields ...
}

function addSourceRow(name = '', url = '') {
    const container = document.getElementById('sourceContainer');
    if(!container) return;
    const div = document.createElement('div');
    div.className = 'source-row';
    div.innerHTML = `
        <input type="text" name="source_name[]" placeholder="Nazwa" value="${name}" class="form-input">
        <input type="url" name="source_url[]" placeholder="URL" value="${url}" class="form-input">
        <button type="button" onclick="this.parentElement.remove()">&times;</button>
    `;
    container.appendChild(div);
}
window.addSourceRow = addSourceRow;

function handleSearch(e) {
    const query = e.target.value.toLowerCase();
    const filtered = allTerms.filter(t => 
        t.term.toLowerCase().includes(query) || 
        t.definition.toLowerCase().includes(query)
    );
    renderTerms(filtered);
}

function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

function getCategoryName(code) {
    const map = {
        'all': 'Wszystkie',
        'steps': 'Kroki',
        'figures': 'Figury',
        'dance': 'Taniec'
        // ... Add more mappings if needed
    };
    return map[code] || code;
}

// Custom Select Class (Simplified)
class CustomSelect {
    constructor(wrapper) {
        this.wrapper = wrapper;
        this.select = wrapper.querySelector('select');
        // Init logic (listeners etc.)
    }
    update() {
        // Refresh display
    }
}
