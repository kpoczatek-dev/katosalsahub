"use strict";

const API_URL = 'assets/php/wiki.php';
let allTerms = [];
let currentCategory = 'all';

// Initial Fetch (Handled by Router via initWiki)
// document.addEventListener('DOMContentLoaded', () => {
//     fetchTerms();
// });

// Global Init Function for Router
window.initWiki = function() {
    console.log('Initializing Salsopedia...');
    
    // Re-bind DOM Elements (because they were replaced)
    rebindElements();

    // Fetch Data
    fetchTerms();
    
    // Update Year
    const rok = document.getElementById("rok");
    if(rok) rok.textContent = new Date().getFullYear();
};

let grid, searchInput, modal, form, loading, categoryList, modalTitle, categoryListMobile;

function rebindElements() {
    grid = document.getElementById('wikiGrid');
    searchInput = document.getElementById('searchInput');
    modal = document.getElementById('wikiModal');
    form = document.getElementById('wikiForm');
    loading = document.getElementById('loading');
    categoryList = document.getElementById('categoryList');
    modalTitle = document.getElementById('modalTitle');
    
    // Re-attach Search Listener
    if(searchInput) {
        searchInput.removeEventListener('input', handleSearch); // Clean up old
        searchInput.addEventListener('input', handleSearch);
    }
    
    // Re-attach Category Listener
    if(categoryList) {
        categoryList.removeEventListener('click', handleCategoryClick);
        categoryList.addEventListener('click', handleCategoryClick);
    }

    // Re-attach Form Listener
    if(form) {
        form.removeEventListener('submit', handleFormSubmit);
        form.addEventListener('submit', handleFormSubmit);
    }

    // Initialize Custom Selects
    // Check if elements exist before init to avoid errors
    if(document.getElementById('catSelect')) {
        initCustomSelect('catSelect', 'catSelectContainer', 'Wybierz kategorie...');
    }
    if(document.getElementById('subSelect')) {
        initCustomSelect('subSelect', 'subSelectContainer', 'Wybierz podkategorie...');
    }

    // Re-attach Pending Changes Button
    const pendingBtn = document.getElementById('showPendingBtn');
    if(pendingBtn) {
        pendingBtn.removeEventListener('click', fetchPendingTerms);
        pendingBtn.addEventListener('click', fetchPendingTerms);
    }
}

let activeSelects = {}; // Store instances to update them later

function initCustomSelect(selectId, containerId, placeholder) {
    const originalSelect = document.getElementById(selectId);
    if(!originalSelect) return;
    
    const container = document.getElementById(containerId);
    container.innerHTML = ''; // Clean

    // state
    const options = Array.from(originalSelect.options).map(opt => ({
        value: opt.value,
        text: opt.innerText,
        selected: opt.selected
    }));

    // Trigger (Display Area)
    const trigger = document.createElement('div');
    trigger.className = 'select-trigger';
    trigger.innerHTML = `<span class="placeholder">${placeholder}</span>`;
    
    // Options List
    const optionsList = document.createElement('div');
    optionsList.className = 'select-options';
    
    options.forEach(opt => {
        const item = document.createElement('div');
        item.className = `option-item ${opt.selected ? 'selected' : ''}`;
        item.dataset.value = opt.value;
        item.innerHTML = `
            <div class="check-icon">${opt.selected ? '✔' : ''}</div>
            <span>${opt.text}</span>
        `;
        
        item.addEventListener('click', (e) => {
            e.stopPropagation();
            toggleOption(opt.value, item, originalSelect, trigger, placeholder);
        });
        
        optionsList.appendChild(item);
    });

    // Toggle Dropdown
    trigger.addEventListener('click', (e) => {
        e.stopPropagation();
        // Close others
        document.querySelectorAll('.select-options').forEach(el => {
            if(el !== optionsList) el.classList.remove('open');
        });
        optionsList.classList.toggle('open');
    });

    // Close on click outside
    document.addEventListener('click', () => {
        optionsList.classList.remove('open');
    });

    container.appendChild(trigger);
    container.appendChild(optionsList);

    // Initial render of tags
    updateTrigger(originalSelect, trigger, placeholder);

    // Save instance for programmatic updates
    activeSelects[selectId] = {
        update: () => {
            // Re-read selected from original select (which we modify programmatically in fillForm)
            // and update UI classes
            const opts = Array.from(originalSelect.options);
            opts.forEach(opt => {
                const item = optionsList.querySelector(`.option-item[data-value="${opt.value}"]`);
                if(item) {
                     if(opt.selected) item.classList.add('selected');
                     else item.classList.remove('selected');
                     item.querySelector('.check-icon').innerText = opt.selected ? '✔' : '';
                }
            });
            updateTrigger(originalSelect, trigger, placeholder);
        }
    };
}

function toggleOption(value, itemElement, originalSelect, triggerElement, placeholder) {
    // Toggle in hidden select
    const option = originalSelect.querySelector(`option[value="${value}"]`);
    option.selected = !option.selected;
    
    // Toggle UI
    itemElement.classList.toggle('selected');
    itemElement.querySelector('.check-icon').innerText = option.selected ? '✔' : '';
    
    updateTrigger(originalSelect, triggerElement, placeholder);
}

function updateTrigger(originalSelect, triggerElement, placeholder) {
    const selected = Array.from(originalSelect.selectedOptions);
    
    if(selected.length === 0) {
        triggerElement.innerHTML = `<span class="placeholder" style="color:rgba(255,255,255,0.5)">${placeholder}</span>`;
    } else {
        triggerElement.innerHTML = '';
        selected.forEach(opt => {
            const tag = document.createElement('span');
            tag.className = 'selected-tag';
            tag.innerHTML = `${opt.innerText} <span class="tag-remove" data-val="${opt.value}">×</span>`;
            
            tag.querySelector('.tag-remove').addEventListener('click', (e) => {
                e.stopPropagation();
                // Deselect logic
                opt.selected = false;
                // Update UI (we need reference to item, but we can just re-init or trigger global update)
                // For simplicity, find item and click it essentially
                // Or just re-run update via activeSelects if we had robust link. 
                // Quick fix: trigger click on the option item to run toggle Logic
                const containerId = originalSelect.id === 'catSelect' ? 'catSelectContainer' : 'subSelectContainer';
                const item = document.getElementById(containerId).querySelector(`.option-item[data-value="${opt.value}"]`);
                if(item) item.click(); 
            });
            triggerElement.appendChild(tag);
        });
    }
}

// Handlers (Defined outside Init to be reusable)
function handleSearch() {
    renderTerms(allTerms);
}

function handleCategoryClick(e) {
    if (e.target.tagName === 'LI') {
        document.querySelectorAll('.category-list li').forEach(li => li.classList.remove('active'));
        e.target.classList.add('active');
        currentCategory = e.target.getAttribute('data-category');
        fetchTerms();
    }
}

async function handleFormSubmit(e) {
    e.preventDefault();
    
    const formData = new FormData(form);
    
    const categories = [];
    document.querySelectorAll('input[name="category"]:checked').forEach(cb => {
        categories.push(cb.value);
    });

    const subcategories = [];
    const subInput = document.getElementById('subcategoryInput');
    Array.from(subInput.selectedOptions).forEach(option => {
        subcategories.push(option.value);
    });


    const data = {
        id: formData.get('id'),
        term: formData.get('term'),
        definition: formData.get('definition'),
        author: formData.get('author'),
        author_link: formData.get('author_link'),
        surname: formData.get('surname'), // honeypot
        category: categories,
        subcategory: subcategories,
        source: formData.get('source'),
        verification_request: formData.get('verification_request') ? true : false
    };

    try {
        const response = await fetch(API_URL, {
            method: 'POST',
            body: JSON.stringify(data),
            headers: { 'Content-Type': 'application/json' }
        });
        
        const result = await response.json();
        
        if (result.success) {
            document.getElementById('formMessage').innerHTML = `<p style="color: green;">${result.message}</p>`;
            setTimeout(() => {
                closeModal();
                fetchTerms(); // Refresh
            }, 2000);
        } else {
            document.getElementById('formMessage').innerHTML = `<p style="color: red;">${result.error}</p>`;
        }
    } catch (error) {
        console.error('Error submitting:', error);
    }
}

// Fetch Terms
// Fetch Terms
async function fetchTerms() {
    if(!grid) return; // Safety check
    grid.innerHTML = '';
    if(loading) loading.style.display = 'flex';

    // Check for "file:" protocol (PHP won't run)
    if (window.location.protocol === 'file:') {
        if(loading) loading.style.display = 'none';
        grid.innerHTML = `
            <div class="no-results" style="display:block; border: 1px solid var(--cuban-red); padding: 20px; text-align: center;">
                <i class="fas fa-server" style="color:var(--cuban-red); font-size: 2rem; margin-bottom: 10px;"></i>
                <h3 style="color:var(--cuban-red)">Wymagany serwer lokalny (PHP)</h3>
                <p>Uruchamiasz stronę bezpośrednio z dysku (<code>file://</code>).</p>
                <p>Baza danych Salsopedii i formularze wymagają PHP.</p>
                <p>Uruchom stronę przez <strong>XAMPP</strong>, <strong>Laragon</strong> lub rozszerzenie <strong>PHP Server</strong> w VS Code.</p>
            </div>
        `;
        return;
    }

    try {
        const response = await fetch(API_URL);
        
        // Handle non-OK responses
        if (!response.ok) {
            throw new Error(`Server Error: ${response.status} ${response.statusText}`);
        }

        const text = await response.text();
        
        try {
            allTerms = JSON.parse(text);
        } catch (e) {
            console.error("JSON Parse Error", e, text);
            throw new Error(`Błąd danych z serwera: ${text.substring(0, 50)}...`);
        }
        
        // Handle Empty Array
        if(!Array.isArray(allTerms)) {
             allTerms = []; 
             console.warn("Received data is not an array");
        }

        renderTerms(allTerms); // Render all initially
    } catch (error) {
        console.error('Błąd pobierania:', error);
        const grid = document.getElementById('wikiGrid');
        if (grid) {
            grid.innerHTML = `
                <div class="wiki-error">
                    <h3>Błąd wczytywania danych</h3>
                    <p>${error.message}</p>
                    <button onclick="fetchTerms()" class="btn-verify" style="margin-top:10px">Spróbuj ponownie</button>
                    <br><small style="opacity:0.7">Jeśli widzisz ten błąd na serwerze, zgłoś go administratorowi.</small>
                </div>
            `;
        }
    } finally {
        toggleLoading(false);
    }
}

// Fetch Pending Terms
async function fetchPendingTerms() {
    if(loading) loading.style.display = 'flex';
    grid.innerHTML = '';
    
    try {
        const response = await fetch(`${API_URL}?action=pending`, { cache: "no-store" });
        const data = await response.json();
        
        // Polyfill ID for rendering
        const pendingTerms = data.map(t => ({
            ...t,
            id: t.original_id || t.token, // Use original ID if edit, else token
            isPending: true
        }));

        renderTerms(pendingTerms, true); // true = rendering pending mode
        if(loading) loading.style.display = 'none';
        
        // Update Active Category UI
        document.querySelectorAll('.category-list li').forEach(li => li.classList.remove('active'));
    } catch (error) {
        console.error('Error fetching pending:', error);
    }
}


// Render Terms
function renderTerms(terms, isPendingMode = false) {
    grid.innerHTML = '';

    if (terms.length === 0) {
        document.getElementById('noResults').classList.remove('hidden');
        return;
    } else {
        document.getElementById('noResults').classList.add('hidden');
    }

    // Sort terms for linking (longest first to avoid partial matches)
    const sortedTermsForLinking = [...allTerms].sort((a, b) => b.term.length - a.term.length);

    terms.forEach(term => {
        // Filter by Category
        if (!isPendingMode && currentCategory !== 'all') {
            const cats = Array.isArray(term.category) ? term.category : [term.category];
            if (!cats.includes(currentCategory)) return;
        }

        // Filter by Search
        const query = searchInput.value.toLowerCase();
        if (query && !term.term.toLowerCase().includes(query) && !term.definition.toLowerCase().includes(query)) {
            return;
        }

        const card = document.createElement('div');
        card.className = 'wiki-card';
        card.id = `card-${term.id}`; // Add ID for anchor scrolling
        if (term.status === 'unverified' && !isPendingMode) {
            card.classList.add('unverified');
        }

        // Badges for Categories & Subcategories
        const cats = Array.isArray(term.category) ? term.category : [term.category];
        const subs = Array.isArray(term.subcategory) ? term.subcategory : (term.subcategory ? [term.subcategory] : []);
        
        // Show main cats + subcats
        let badgesHtml = cats.map(cat => `<span class="cat-badge main-cat">${getCategoryName(cat)}</span>`).join('');
        badgesHtml += subs.map(sub => `<span class="cat-badge sub-cat">${getCategoryName(sub)}</span>`).join('');


        // Status & Verification Logic
        let statusHtml = '';
        let verCount = term.verification_count || 0;
        
        if (term.status === 'verified') {
            statusHtml = `<span class="status-verified" title="Zatwierdzone">
                            <i class="fas fa-check-circle"></i> Zweryfikowane (${verCount})
                          </span>`;
        } else if (term.status === 'unverified') {
            statusHtml = `<span class="status-unverified" title="Wymaga weryfikacji">
                            <i class="fas fa-exclamation-triangle"></i> Niezweryfikowane (${verCount})
                          </span>`;
        }

        // Action Buttons
        let actionBtn = '';
        if (isPendingMode) {
            actionBtn = `<div class="pending-info"><small>Oczekuje na moderację...</small></div>`;
        } else {
            const btnText = term.status === 'unverified' ? 'Zweryfikuj' : 'Edytuj';
            const btnIcon = term.status === 'unverified' ? 'fa-check-double' : 'fa-pen';
            
            actionBtn = `<button class="btn-verify" onclick="openVerifyModal('${term.id}')">
                            <i class="fas ${btnIcon}"></i> ${btnText}
                         </button>`;
        }

        // Cross-Linking Logic
        let definitionHtml = term.definition;
        if (!isPendingMode) { // meaningful content only
             const sortedTermsForLinking = [...allTerms].sort((a, b) => b.term.length - a.term.length);
             
             sortedTermsForLinking.forEach(linkTerm => {
                 if (linkTerm.id === term.id) return; // Don't link to self
                 if (linkTerm.term.length < 4) return; // Skip very short words (e.g. "Son") to avoid noise
                 
                 // Regex: Case insensitive, Word boundary
                 const regex = new RegExp(`\\b${escapeRegExp(linkTerm.term)}\\b`, 'gi');
                 if (regex.test(definitionHtml)) {
                     // Replace with a link
                     // Use javascript:void(0) to prevent router from intercepting or scrolling to top
                     definitionHtml = definitionHtml.replace(regex, (match) => {
                         return `<a href="javascript:void(0)" class="wiki-cross-link" onclick="scrollToTerm('${linkTerm.id}')">${match}</a>`;
                     });
                 }
             });
        }
        
        // Author Link Logic
        let authorHtml = `Autor: ${term.author}`;
        if (term.author_link) {
            authorHtml += ` <a href="${term.author_link}" target="_blank" title="Profil autora" style="color:var(--cuban-blue);margin-left:5px;"><i class="fab fa-facebook"></i></a>`;
        }

        // Multi-Source Rendering
        let sourceHtml = '';
        if (term.source) {
            let sources = [];
            if (Array.isArray(term.source)) {
                sources = term.source;
            } else {
                 if(typeof term.source === 'string') {
                    const match = term.source.match(/^(.*)\s\((https?:\/\/.*)\)$/);
                    if(match) sources.push({name: match[1], url: match[2]});
                    else sources.push({name: term.source, url: ''});
                 }
            }
            sources = sources.filter(s => s.name || s.url);
            if(sources.length > 0) {
                sourceHtml = `<div class="source-link"><i class="fas fa-book"></i> Źródła: `;
                const links = sources.map(s => {
                    const name = s.name || s.url || 'Link';
                    if(s.url && s.url.startsWith('http')) {
                        return `<a href="${s.url}" target="_blank">${name}</a>`;
                    } else {
                        return name;
                    }
                });
                sourceHtml += links.join(', ') + `</div>`;
            }
        }

        // Diff View for Pending Changes
        let diffHtml = '';
        if (isPendingMode && term.original_id) {
            const original = allTerms.find(t => t.id === term.original_id);
            if (original) {
                diffHtml = `<div class="diff-view" style="margin-top: 10px; padding: 10px; background: rgba(0,0,0,0.2); border-left: 3px solid var(--cuban-orange); font-size: 0.9em;">
                    <strong style="color: var(--cuban-orange)">Porównanie ze starą wersją:</strong><br>
                    ${original.term !== term.term ? `<div><strong>Hasło:</strong> <span style="text-decoration: line-through; opacity: 0.7">${original.term}</span> -> <span style="color:lightgreen">${term.term}</span></div>` : ''}
                    ${original.definition !== term.definition ? `<div><strong>Definicja:</strong> <br><span style="text-decoration: line-through; opacity: 0.6">${original.definition}</span> <br> <span style="color:lightgreen">${term.definition}</span></div>` : ''}
                    ${JSON.stringify(original.source) !== JSON.stringify(term.source) ? `<div><strong>Źródła:</strong> Zmienione</div>` : ''}
                    ${original.author !== term.author ? `<div><strong>Autor zmiany:</strong> ${term.author} (Oryginał: ${original.author})</div>` : ''}
                </div>`;
            } else {
                diffHtml = `<div class="diff-view"><small>Nie znaleziono oryginału (być może usunięty?).</small></div>`;
            }
        } else if (isPendingMode) {
             diffHtml = `<div class="diff-view" style="color: lightgreen;"><small>✨ Nowe hasło</small></div>`;
        }

        card.innerHTML = `
            <div class="wiki-card-header">
                <h3>${term.term}</h3>
                <div class="badges">${badgesHtml}</div>
            </div>
            <div class="status-bar">${statusHtml}</div>
            
            ${diffHtml}

            ${!diffHtml ? `<p class="definition">${definitionHtml}</p>` : (isPendingMode ? `<p class="definition" style="border-left:2px solid lightgreen; padding-left:10px">${definitionHtml}</p>` : `<p class="definition">${definitionHtml}</p>`)}
            
            ${sourceHtml}
            
            <div class="wiki-card-footer">
                <span class="author">${authorHtml}</span>
                ${actionBtn}
            </div>
        `;
        grid.appendChild(card);
    });
}
window.renderTerms = renderTerms; 

// Helper for Regex
function escapeRegExp(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Scroll To Term w/ Filter Reset
function scrollToTerm(id) {
    console.log('Scrolling to:', id);
    let card = document.getElementById(`card-${id}`);

    if (!card) {
        console.log('Card not found locally, resetting filters...');
        
        // 1. Reset Selects/Categories
        currentCategory = 'all';
        // Reset UI active classes
        document.querySelectorAll('.category-list li').forEach(li => li.classList.remove('active'));
        const allLi = document.querySelector('.category-list li[data-category="all"]');
        if(allLi) allLi.classList.add('active');

        // 2. Reset Search
        if(searchInput) searchInput.value = '';

        // 3. Re-render ALL terms
        renderTerms(allTerms);

        // 4. Try finding card again after render (small delay)
        setTimeout(() => {
            card = document.getElementById(`card-${id}`);
            if (card) {
                card.scrollIntoView({ behavior: 'smooth', block: 'center' });
                card.classList.add('highlight-flash');
                setTimeout(() => card.classList.remove('highlight-flash'), 2000);
            } else {
                console.warn('Term still not found:', id);
                alert('Nie znaleziono hasła (może zostało usunięte?).');
            }
        }, 50); 
    } else {
        // Card is visible
        card.scrollIntoView({ behavior: 'smooth', block: 'center' });
        card.classList.add('highlight-flash');
        setTimeout(() => card.classList.remove('highlight-flash'), 2000);
    }
}
window.scrollToTerm = scrollToTerm;

// Search and Form Listeners are now handled in rebindElements() called by initWiki()
function getCategoryName(code) {
    const map = {
        'all': 'Wszystkie',
        'steps': 'Kroki',
        'figures': 'Figury',
        'instruments': 'Instrumenty',
        'music': 'Muzyka',
        'dance': 'Taniec',
        'styles': 'Style',
        'history': 'Historia',
        'gods': 'Bogowie',
        'instructors': 'Instruktorzy',
        'schools': 'Szkoły'
    };
    return map[code] || code;
}

// Modal Functions
function openModal() {
    form.reset();
    document.getElementById('termId').value = '';
    document.getElementById('isVerification').value = '';
    modalTitle.innerText = 'Dodaj nowe hasło';
    modal.classList.add('open');
    
    // Reset Custom Selects
    if(activeSelects['catSelect']) {
        const s = document.getElementById('catSelect');
        Array.from(s.options).forEach(o => o.selected = false);
        activeSelects['catSelect'].update();
    }
    if(activeSelects['subSelect']) {
        const s = document.getElementById('subSelect');
        Array.from(s.options).forEach(o => o.selected = false);
        activeSelects['subSelect'].update();
    }
}
window.openModal = openModal;

function closeModal() {
    modal.classList.remove('open');
    document.getElementById('formMessage').innerHTML = '';
}
window.closeModal = closeModal;

// Verify/Edit Modal
function openVerifyModal(id) {
    const term = allTerms.find(t => t.id === id);
    if (!term) return;
    
    fillForm(term);
    document.getElementById('isVerification').value = '1';
    modalTitle.innerText = term.status === 'unverified' ? 'Zweryfikuj hasło' : 'Edytuj hasło';
    modal.classList.add('open');
}
window.openVerifyModal = openVerifyModal;


function fillForm(term) {
    document.getElementById('termId').value = term.id;
    document.getElementById('termInput').value = term.term;
    document.getElementById('definitionInput').value = term.definition;
    document.getElementById('authorInput').value = ''; // Reset author for new submission/verification
    document.getElementById('authorLinkInput').value = ''; 

    // Multi-Source Fill
    const sourceContainer = document.getElementById('sourceContainer');
    sourceContainer.innerHTML = ''; // Clear
    
    let sources = [];
    if(term.source) {
         if (Array.isArray(term.source)) {
            sources = term.source;
        } else {
             // Legacy
             const match = term.source.match(/^(.*)\s\((https?:\/\/.*)\)$/);
             if(match) sources.push({name: match[1], url: match[2]});
             else sources.push({name: term.source, url: term.source.startsWith('http') ? term.source : ''});
        }
    }
    
    // If empty, add one empty row
    if(sources.length === 0) sources.push({name:'', url:''});
    
    sources.forEach(s => addSourceRow(s.name, s.url));

    // Categories (Select)
    const catSelect = document.getElementById('catSelect');
    if(catSelect) {
        Array.from(catSelect.options).forEach(opt => opt.selected = false); // Reset
        const cats = Array.isArray(term.category) ? term.category : [term.category];
        cats.forEach(c => {
            const opt = catSelect.querySelector(`option[value="${c}"]`);
            if(opt) opt.selected = true;
        });
        // Update UI
        if(activeSelects['catSelect']) activeSelects['catSelect'].update();
    }
// ... (rest of function)
    // Subcategories (Select)
    const subSelect = document.getElementById('subSelect');
    if(subSelect) {
        Array.from(subSelect.options).forEach(opt => opt.selected = false); // Reset
        const subs = Array.isArray(term.subcategory) ? term.subcategory : (term.subcategory ? [term.subcategory] : []);
        subs.forEach(s => {
            const opt = subSelect.querySelector(`option[value="${s}"]`);
            if(opt) opt.selected = true;
        });
        // Update UI
        if(activeSelects['subSelect']) activeSelects['subSelect'].update();
    }
}

function addSourceRow(name = '', url = '') {
    const div = document.createElement('div');
    div.className = 'source-row';
    div.innerHTML = `
        <input type="text" name="source_name[]" placeholder="Nazwa źródła (np. YouTube)" value="${name}" style="flex:1">
        <input type="url" name="source_url[]" placeholder="Link (URL)" value="${url}" style="flex:2">
        <button type="button" class="btn-remove-source" onclick="this.parentElement.remove()">&times;</button>
    `;
    document.getElementById('sourceContainer').appendChild(div);
}
window.addSourceRow = addSourceRow;

async function handleFormSubmit(e) {
    e.preventDefault();
    
    const formData = new FormData(form);
    
    // Collect Sources
    const sourceNames = formData.getAll('source_name[]');
    const sourceUrls = formData.getAll('source_url[]');
    const sources = [];
    
    for(let i=0; i<sourceNames.length; i++) {
        if(sourceNames[i].trim() || sourceUrls[i].trim()) {
            sources.push({
                name: sourceNames[i].trim(),
                url: sourceUrls[i].trim()
            });
        }
    }

    // Read from Selects (Hidden)
    const categories = [];
    document.querySelectorAll('input[name="category"]:checked').forEach(cb => {
        categories.push(cb.value);
    });
    
    // Also check Select if custom logic used (redundant if select syncs to checkboxes, but here we used select directly)
    // The previous code had specific logic for this. Restoring it based on context implies we just rely on form data if selects update hidden inputs? 
    // Wait, the custom select updates the <select> element options 'selected' attribute.
    // FormData *should* capture multi-select values if name="category".
    // Let's ensure we capture them correctly.

    const catSelect = document.getElementById('catSelect');
    const selectedCats = catSelect ? Array.from(catSelect.selectedOptions).map(o => o.value) : [];
    
    const subSelect = document.getElementById('subSelect');
    const selectedSubs = subSelect ? Array.from(subSelect.selectedOptions).map(o => o.value) : [];

    const data = {
        id: formData.get('id'),
        term: formData.get('term'),
        definition: formData.get('definition'),
        author: formData.get('author'),
        author_link: formData.get('author_link'),
        surname: formData.get('surname'), // honeypot
        category: selectedCats.length > 0 ? selectedCats : ['dance'],
        subcategory: selectedSubs,
        user_category: document.getElementById('userCategoryInput').value,
        source: sources, // Submit Array!
        verification_request: formData.get('verification_request') ? true : false
    };

    try {
        const response = await fetch(API_URL, {
            method: 'POST',
            body: JSON.stringify(data),
            headers: { 'Content-Type': 'application/json' }
        });
        
        const result = await response.json();
        
        if (result.success) {
            document.getElementById('formMessage').innerHTML = `<p style="color: green;">${result.message}</p>`;
            setTimeout(() => {
                closeModal();
                fetchTerms(); // Refresh
            }, 2000);
        } else {
            document.getElementById('formMessage').innerHTML = `<p style="color: red;">${result.error}</p>`;
        }
    } catch (error) {
        console.error('Error submitting:', error);
    }
}

// End of wiki.js
