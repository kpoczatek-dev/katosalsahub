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
async function fetchTerms() {
    if(!grid) return; // Safety check
    grid.innerHTML = '';
    if(loading) loading.style.display = 'flex';
    try {
        const response = await fetch(API_URL);
        const data = await response.json();
        allTerms = data;
        renderTerms(allTerms);
        if(loading) loading.style.display = 'none';
    } catch (error) {
        console.error('Error fetching terms:', error);
        if(loading) loading.innerHTML = '<p>Błąd pobierania danych.</p>';
    }
}

// Fetch Pending Terms
async function fetchPendingTerms() {
    if(loading) loading.style.display = 'flex';
    grid.innerHTML = '';
    
    try {
        const response = await fetch(`${API_URL}?action=pending`);
        const data = await response.json();
        renderTerms(data, true); // true = rendering pending mode
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
                     definitionHtml = definitionHtml.replace(regex, (match) => {
                         return `<a href="#" class="wiki-cross-link" onclick="scrollToTerm('${linkTerm.id}'); return false;">${match}</a>`;
                     });
                 }
             });
        }
        
        // Author Link Logic
        let authorHtml = `Autor: ${term.author}`;
        if (term.author_link) {
            authorHtml += ` <a href="${term.author_link}" target="_blank" title="Profil autora" style="color:var(--cuban-blue);margin-left:5px;"><i class="fab fa-facebook"></i></a>`;
        }

        card.innerHTML = `
            <div class="wiki-card-header">
                <h3>${term.term}</h3>
                <div class="badges">${badgesHtml}</div>
            </div>
            <div class="status-bar">${statusHtml}</div>
            
            <p class="definition">${definitionHtml}</p>
            
            ${term.source ? `<div class="source-link"><i class="fas fa-book"></i> Źródło: ${term.source}</div>` : ''}
            
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

// Scroll To Term
function scrollToTerm(id) {
    const card = document.getElementById(`card-${id}`);
    if (card) {
        card.scrollIntoView({ behavior: 'smooth', block: 'center' });
        card.classList.add('highlight-flash');
        setTimeout(() => card.classList.remove('highlight-flash'), 2000);
    } else {
        // Maybe it's filtered out? Reset filter and search (optional, or just alert)
        // Check if category is active? 
        // For simplicity:
        alert('Hasło znajduje się w innej kategorii lub jest ukryte.');
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
    document.getElementById('sourceInput').value = term.source || '';
    document.getElementById('authorInput').value = ''; // Reset author for new submission/verification
    document.getElementById('authorLinkInput').value = ''; 

    // Source Split
    const sourceNameInput = document.getElementById('sourceNameInput');
    const sourceLinkInput = document.getElementById('sourceLinkInput');
    
    if (term.source) {
        // Try to extract URL from format "Name (URL)"
        const match = term.source.match(/^(.*)\s\((https?:\/\/.*)\)$/);
        if (match) {
            sourceNameInput.value = match[1];
            sourceLinkInput.value = match[2];
        } else {
            // Just text or just URL
            if (term.source.startsWith('http')) {
                sourceNameInput.value = '';
                sourceLinkInput.value = term.source;
            } else {
                sourceNameInput.value = term.source;
                sourceLinkInput.value = '';
            }
        }
    } else {
        sourceNameInput.value = '';
        sourceLinkInput.value = '';
    }

    // Checkboxes (Categories) -> Now Select
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
}

async function handleFormSubmit(e) {
    e.preventDefault();
    
    const formData = new FormData(form);
    
    // Combine Source
    const sourceName = document.getElementById('sourceNameInput').value.trim();
    const sourceLink = document.getElementById('sourceLinkInput').value.trim();
    let finalSource = sourceName;
    if (sourceLink) {
        finalSource = sourceName ? `${sourceName} (${sourceLink})` : sourceLink;
    }

    // Read from Selects (Hidden)
// ...
    const data = {
        id: formData.get('id'),
        term: formData.get('term'),
        definition: formData.get('definition'),
        author: formData.get('author'),
        author_link: formData.get('author_link'),
        surname: formData.get('surname'), // honeypot
        category: categories,
        subcategory: subcategories,
        user_category: document.getElementById('userCategoryInput').value,
        source: finalSource, // Use Combined Source
        verification_request: formData.get('verification_request') ? true : false
    };
// ...
}

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

// Debug Function
window.debugFetch = async function() {
    const url = 'assets/php/wiki.php?t=' + new Date().getTime();
    console.log('DEBUG: Fetching ' + url);
    try {
        const resp = await fetch(url);
        const text = await resp.text();
        console.log('DEBUG: Raw Response:', text);
        
        if(text.length > 500) {
            alert('Otrzymano dane (' + text.length + ' znaków). Sprawdź konsolę (F12). Początek: \n' + text.substring(0, 200));
        } else {
             alert('Otrzymano: \n' + text);
        }
        
        try {
            const json = JSON.parse(text);
            alert('JSON Poprawny! Ilość haseł: ' + json.length);
        } catch(e) {
            alert('BŁĄD JSON PARSE: ' + e.message);
        }

    } catch(e) {
        alert('Błąd Fetch (Sieć/Serwer): ' + e.message);
    }
};
