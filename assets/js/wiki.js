"use strict";

const API_URL = 'assets/php/wiki.php';
let allTerms = [];
let currentCategory = 'all';

// Global Init Function for Router
window.initWiki = function() {
    console.log('Initializing Salsopedia...');
    
    // Re-bind DOM Elements
    rebindElements();

    // Fetch Data
    fetchTerms();
    
    // Update Year
    const rok = document.getElementById("rok");
    if(rok) rok.textContent = new Date().getFullYear();
};

let grid, searchInput, modal, form, loading, categoryList, modalTitle;
let activeSelects = {}; 

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
        searchInput.removeEventListener('input', handleSearch);
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

// Custom Select Logic
function initCustomSelect(selectId, containerId, placeholder) {
    const originalSelect = document.getElementById(selectId);
    if(!originalSelect) return;
    
    const container = document.getElementById(containerId);
    container.innerHTML = ''; 

    const options = Array.from(originalSelect.options).map(opt => ({
        value: opt.value,
        text: opt.innerText,
        selected: opt.selected
    }));

    const trigger = document.createElement('div');
    trigger.className = 'select-trigger';
    trigger.innerHTML = `<span class="placeholder">${placeholder}</span>`;
    
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

    trigger.addEventListener('click', (e) => {
        e.stopPropagation();
        document.querySelectorAll('.select-options').forEach(el => {
            if(el !== optionsList) el.classList.remove('open');
        });
        optionsList.classList.toggle('open');
    });

    document.addEventListener('click', () => {
        optionsList.classList.remove('open');
    });

    container.appendChild(trigger);
    container.appendChild(optionsList);

    updateTrigger(originalSelect, trigger, placeholder);

    activeSelects[selectId] = {
        update: () => {
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
    const option = originalSelect.querySelector(`option[value="${value}"]`);
    option.selected = !option.selected;
    
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
                opt.selected = false;
                const containerId = originalSelect.id === 'catSelect' ? 'catSelectContainer' : 'subSelectContainer';
                const item = document.getElementById(containerId).querySelector(`.option-item[data-value="${opt.value}"]`);
                if(item) item.click(); 
            });
            triggerElement.appendChild(tag);
        });
    }
}

// Utilities
function debounce(func, wait) {
    let timeout;
    return function(...args) {
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(this, args), wait);
    };
}

// Handlers
const handleSearch = debounce(() => {
    renderTerms(allTerms);
}, 300);

function handleCategoryClick(e) {
    if (e.target.tagName === 'LI') {
        document.querySelectorAll('.category-list li').forEach(li => li.classList.remove('active'));
        e.target.classList.add('active');
        currentCategory = e.target.getAttribute('data-category');
        fetchTerms();
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
    
    // Collect Sources (Array)
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

    // Capture Custom Selects via underlying <select>
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
        source: sources, 
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
    if(!grid) return; 
    grid.innerHTML = '';
    if(loading) loading.style.display = 'flex';

    if (window.location.protocol === 'file:') {
        if(loading) loading.style.display = 'none';
        grid.innerHTML = `<div class="no-results">Wymagany serwer lokalny (PHP)</div>`;
        return;
    }

    try {
        const response = await fetch(API_URL + "?t=" + Date.now()); // Cache Buster
        if (!response.ok) throw new Error(`Server Error: ${response.status}`);

        const text = await response.text();
        
        try {
            allTerms = JSON.parse(text);
        } catch (e) {
            console.error("JSON Parse Error", e, text);
            throw new Error(`Błąd danych z serwera: ${text.substring(0, 50)}...`);
        }
        
        if(!Array.isArray(allTerms)) {
             allTerms = []; 
             console.warn("Received data is not an array");
        }

        renderTerms(allTerms);
    } catch (error) {
        console.error('Błąd pobierania:', error);
        if (grid) {
            grid.innerHTML = `
                <div class="wiki-error">
                    <h3>Błąd wczytywania danych</h3>
                    <p>${error.message}</p>
                    <button onclick="fetchTerms()" class="btn-verify" style="margin-top:10px">Spróbuj ponownie</button>
                </div>
            `;
        }
    } finally {
        toggleLoading(false);
    }
}

// Fetch Pending Terms
async function fetchPendingTerms() {
    // Simple Security with Session Storage
    if (!sessionStorage.getItem('katoAdmin')) {
        const pass = prompt("Podaj hasło administratora:");
        if(pass !== 'katoAdmin2024') { 
            alert("Błędne hasło.");
            return;
        }
        sessionStorage.setItem('katoAdmin', 'true');
    }

    console.log("Fetching pending terms..."); // Debug
    if(!grid || !loading) rebindElements();
    if(!grid) return;

    if(loading) loading.style.display = 'flex';
    grid.innerHTML = '';
    
    try {
        const response = await fetch(`${API_URL}?action=pending&t=${Date.now()}`);
        const data = await response.json();
        
        const pendingTerms = data.map(t => ({
            ...t,
            id: t.original_id || t.token,
            isPending: true
        }));

        renderTerms(pendingTerms, true); 
        if(loading) loading.style.display = 'none';
        
        document.querySelectorAll('.category-list li').forEach(li => li.classList.remove('active'));
    } catch (error) {
        console.error('Error fetching pending:', error);
    }
}
window.fetchPendingTerms = fetchPendingTerms;

// Render Terms
function renderTerms(terms, isPendingMode = false) {
    grid.innerHTML = '';

    if (terms.length === 0) {
        document.getElementById('noResults').classList.remove('hidden');
        return;
    } else {
        document.getElementById('noResults').classList.add('hidden');
    }

    // Sort terms for linking
    // We copy allTerms to avoid mutating it, but we need meaningful terms for linking
    const sortedTermsForLinking = [...allTerms].filter(t=>t.term).sort((a, b) => b.term.length - a.term.length);

    terms.forEach(term => {
        if (!isPendingMode && currentCategory !== 'all') {
            const cats = Array.isArray(term.category) ? term.category : [term.category];
            if (!cats.includes(currentCategory)) return;
        }

        const query = searchInput.value.toLowerCase();
        if (query && !term.term.toLowerCase().includes(query) && !term.definition.toLowerCase().includes(query)) {
            return;
        }

        const card = document.createElement('div');
        card.className = 'wiki-card';
        card.id = `card-${term.id}`; 
        
        if (term.status === 'unverified' && !isPendingMode) {
            card.classList.add('unverified');
        }

        const cats = Array.isArray(term.category) ? term.category : [term.category];
        const subs = Array.isArray(term.subcategory) ? term.subcategory : (term.subcategory ? [term.subcategory] : []);
        
        let badgesHtml = cats.map(cat => `<span class="cat-badge main-cat">${getCategoryName(cat)}</span>`).join('');
        badgesHtml += subs.map(sub => `<span class="cat-badge sub-cat">${getCategoryName(sub)}</span>`).join('');

        let statusHtml = '';
        let verCount = term.verification_count || 0;
        
        if (term.status === 'verified') {
            statusHtml = `<span class="status-verified"><i class="fas fa-check-circle"></i> Zweryfikowane (${verCount})</span>`;
        } else if (term.status === 'unverified') {
            statusHtml = `<span class="status-unverified"><i class="fas fa-exclamation-triangle"></i> Niezweryfikowane (${verCount})</span>`;
        }

        // Action Buttons
        let actionBtn = '';
        if (isPendingMode) {
            // Moderation Buttons
            // Note: We use the token for approval/rejection
            const token = term.token; 
            actionBtn = `
                <div class="pending-actions" style="margin-top:10px; display:flex; gap:10px;">
                    <button class="btn-verify" onclick="approveTerm('${token}')" style="background:rgba(16, 185, 129, 0.2); border-color:#10b981; color:#10b981;">
                        <i class="fas fa-check"></i> Zatwierdź
                    </button>
                    <button class="btn-verify" onclick="rejectTerm('${token}')" style="background:rgba(255, 71, 87, 0.2); border-color:#ff4757; color:#ff4757;">
                        <i class="fas fa-times"></i> Odrzuć
                    </button>
                </div>
            `;
        } else {
            const btnText = term.status === 'unverified' ? 'Zweryfikuj' : 'Edytuj';
            const btnIcon = term.status === 'unverified' ? 'fa-check-double' : 'fa-pen';
            actionBtn = `<button class="btn-verify" onclick="openVerifyModal('${term.id}')"><i class="fas ${btnIcon}"></i> ${btnText}</button>`;
        }

        // Cross-Linking
        let definitionHtml = term.definition;
        if (!isPendingMode) { 
             sortedTermsForLinking.forEach(linkTerm => {
                 if (linkTerm.id === term.id) return; 
                 if (linkTerm.term.length < 4) return; 
                 
                 const regex = new RegExp(`\\b${escapeRegExp(linkTerm.term)}\\b`, 'gi');
                 if (regex.test(definitionHtml)) {
                     definitionHtml = definitionHtml.replace(regex, (match) => {
                         return `<a href="javascript:void(0)" class="wiki-cross-link" onclick="scrollToTerm('${linkTerm.id}')">${match}</a>`;
                     });
                 }
             });
        }
        
        let authorHtml = `Autor: ${term.author}`;
        if (term.author_link) {
            authorHtml += ` <a href="${term.author_link}" target="_blank" style="color:var(--cuban-blue);margin-left:5px;"><i class="fab fa-facebook"></i></a>`;
        }

        // Multi-Source Display
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

        // Diff View
        let diffHtml = '';
        if (isPendingMode && term.original_id) {
            const original = allTerms.find(t => t.id === term.original_id);
            if (original) {
                diffHtml = `<div class="diff-view" style="margin-top: 10px; padding: 10px; background: rgba(0,0,0,0.2); border-left: 3px solid var(--cuban-orange); font-size: 0.9em;">
                    <strong style="color: var(--cuban-orange)">Porównanie:</strong><br>
                    ${original.term !== term.term ? `<div>Hasło: <strike>${original.term}</strike> -> <span style="color:lightgreen">${term.term}</span></div>` : ''}
                    ${original.definition !== term.definition ? `<div>Definicja: Zmieniona</div>` : ''}
                </div>`;
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
            <p class="definition">${definitionHtml}</p>
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

function escapeRegExp(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function scrollToTerm(id) {
    let card = document.getElementById(`card-${id}`);
    if (!card) {
        // Reset filters
        currentCategory = 'all';
        searchInput.value = '';
        document.querySelectorAll('.category-list li').forEach(li => li.classList.remove('active'));
        renderTerms(allTerms);
        setTimeout(() => {
             card = document.getElementById(`card-${id}`);
             if(card) {
                 card.scrollIntoView({ behavior: 'smooth', block: 'center' });
                 card.classList.add('highlight-flash');
                 setTimeout(() => card.classList.remove('highlight-flash'), 2000);
             } else {
                 alert('Nie znaleziono hasła.');
             }
        }, 100);
    } else {
        card.scrollIntoView({ behavior: 'smooth', block: 'center' });
        card.classList.add('highlight-flash');
        setTimeout(() => card.classList.remove('highlight-flash'), 2000);
    }
}
window.scrollToTerm = scrollToTerm;

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

function openModal() {
    form.reset();
    document.getElementById('termId').value = '';
    document.getElementById('isVerification').value = '';
    modalTitle.innerText = 'Dodaj nowe hasło';
    modal.classList.add('open');
    
    // Reset Selects
    if(activeSelects['catSelect']) {
        Array.from(document.getElementById('catSelect').options).forEach(o => o.selected = false);
        activeSelects['catSelect'].update();
    }
    if(activeSelects['subSelect']) {
        Array.from(document.getElementById('subSelect').options).forEach(o => o.selected = false);
        activeSelects['subSelect'].update();
    }
    
    // Reset Sources
    document.getElementById('sourceContainer').innerHTML = '';
    addSourceRow();
}
window.openModal = openModal;

function closeModal() {
    modal.classList.remove('open');
    document.getElementById('formMessage').innerHTML = '';
}
window.closeModal = closeModal;

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
    document.getElementById('authorInput').value = ''; 
    document.getElementById('authorLinkInput').value = ''; 

    // Reset Sources
    const sourceContainer = document.getElementById('sourceContainer');
    sourceContainer.innerHTML = '';
    
    let sources = [];
    if(term.source) {
         if (Array.isArray(term.source)) {
            sources = term.source;
        } else {
             const match = term.source.match(/^(.*)\s\((https?:\/\/.*)\)$/);
             if(match) sources.push({name: match[1], url: match[2]});
             else sources.push({name: term.source, url: ''});
        }
    }
    if(sources.length === 0) sources.push({name:'', url:''});
    sources.forEach(s => addSourceRow(s.name, s.url));

    // Categories
    const catSelect = document.getElementById('catSelect');
    if(catSelect) {
        Array.from(catSelect.options).forEach(opt => opt.selected = false);
        const cats = Array.isArray(term.category) ? term.category : [term.category];
        cats.forEach(c => {
            const opt = catSelect.querySelector(`option[value="${c}"]`);
            if(opt) opt.selected = true;
        });
        if(activeSelects['catSelect']) activeSelects['catSelect'].update();
    }

    // Subcategories
    const subSelect = document.getElementById('subSelect');
    if(subSelect) {
        Array.from(subSelect.options).forEach(opt => opt.selected = false);
        const subs = Array.isArray(term.subcategory) ? term.subcategory : (term.subcategory ? [term.subcategory] : []);
        subs.forEach(s => {
            const opt = subSelect.querySelector(`option[value="${s}"]`);
            if(opt) opt.selected = true;
        });
        if(activeSelects['subSelect']) activeSelects['subSelect'].update();
    }
}

function toggleLoading(show) {
    if(loading) loading.style.display = show ? 'flex' : 'none';
}
// Moderation Actions
async function approveTerm(token) {
    console.log("Approve clicked for token:", token);
    if(!confirm("Czy na pewno chcesz zatwierdzić to hasło?")) return;
    await processModeration(token, 'approve');
}
window.approveTerm = approveTerm;

async function rejectTerm(token) {
    console.log("Reject clicked for token:", token);
    if(!confirm("Czy na pewno chcesz odrzucić to hasło?")) return;
    await processModeration(token, 'reject');
}
window.rejectTerm = rejectTerm;
