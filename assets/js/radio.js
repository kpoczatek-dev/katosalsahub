/**
 * Timba Nation Radio Service
 * Runs once, maintains state, updates UI on events.
 */

let radioInitialized = false;

function initRadioOnce() {
    console.log('RadioJS: initRadioOnce called', { radioInitialized });
    if (radioInitialized) {
        // UI Update Loop for Navigation
        // Even if initialized, DOM buttons might be new.
        if(window.updateGlobalRadioUI) window.updateGlobalRadioUI();
        return; 
    }
    
    radioInitialized = true;
    initRadio();
}

// Listeners are handled at the end of file for singleton pattern

// Audio Object Scope
const streamUrl = 'https://stream.zeno.fm/g0zpm0pypuhvv';
let radioAudio = new Audio(streamUrl);
let isPlaying = false;
let isLoading = false;

// Initialize
function initRadio() {
    // Make update function global for re-use
    window.updateGlobalRadioUI = updateGlobalUI;
    updateGlobalUI();
}
    
    // Global Click Listener (Event Delegation) - Handles dynamic elements
    document.addEventListener('click', (e) => {
        const btn = e.target.closest('#header-radio-play, #radio-play');
        if (btn) {
            console.log('RadioJS: Play button clicked', btn.id);
            e.preventDefault();
            toggleRadio();
        }
    });

    // One-time Audio Setup
    radioAudio.addEventListener('playing', () => {
        isLoading = false;
        isPlaying = true;
        updateGlobalUI();
    });

    radioAudio.addEventListener('pause', () => {
        isPlaying = false;
        updateGlobalUI();
    });

    radioAudio.addEventListener('waiting', () => {
        isLoading = true;
        updateGlobalUI();
    });

    radioAudio.addEventListener('error', (e) => {
        console.error("Radio Error:", e);
        isLoading = false;
        isPlaying = false;
        updateGlobalUI();
        // Don't alert on simple stream errors to annoying user? Or use toast?
        // alert("Nie udało się połączyć z radiem.");
    });


    function updateGlobalUI() {
        const headerPlayBtn = document.getElementById('header-radio-play');
        const sectionPlayBtn = document.getElementById('radio-play');
        const vinyl = document.querySelector('.vinyl-disc');
        const soundWaves = document.querySelectorAll('.sound-wave span');
        updateUI(headerPlayBtn, sectionPlayBtn, vinyl, soundWaves);
    }

    // Toggle Play/Pause
    function toggleRadio() {
        if (isPlaying) {
            radioAudio.pause();
        } else {
            isLoading = true;
            updateGlobalUI();
            radioAudio.play().catch(error => {
                console.error("Playback failed:", error);
                isLoading = false;
                isPlaying = false;
                updateGlobalUI();
            });
        }
    }

    // Update UI based on state
    function updateUI(headerBtn, sectionBtn, vinyl, waves) {
        // defined states
        const state = isLoading ? 'loading' : (isPlaying ? 'playing' : 'stopped');
        
        // 1. Update Section Button
        if (sectionBtn) {
            if (state === 'loading') {
                sectionBtn.textContent = "⏳ Łączenie...";
                sectionBtn.classList.add('loading');
            } else if (state === 'playing') {
                sectionBtn.textContent = "⏹ Wyłącz radio";
                sectionBtn.classList.add('playing');
                sectionBtn.classList.remove('loading');
            } else {
                sectionBtn.textContent = "▶ Włącz radio";
                sectionBtn.classList.remove('playing', 'loading');
            }
        }

        // 2. Update Header Button
        if (headerBtn) {
             // Reset classes
            headerBtn.classList.remove('playing', 'loading');
            headerBtn.innerHTML = ''; // Clear icon

            if (state === 'loading') {
                headerBtn.classList.add('loading');
                // Spinner
                headerBtn.innerHTML = `
                    <svg class="spinner" viewBox="0 0 50 50">
                        <circle class="path" cx="25" cy="25" r="20" fill="none" stroke-width="5"></circle>
                    </svg>`;
            } else if (state === 'playing') {
                headerBtn.classList.add('playing');
                // Stop (Square)
                headerBtn.innerHTML = `
                    <svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor">
                        <rect x="6" y="6" width="12" height="12" rx="2" ry="2"/>
                    </svg>`;
            } else {
                // Play (Triangle)
                headerBtn.innerHTML = `
                    <svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor">
                        <path d="M8 5v14l11-7z"/>
                    </svg>`;
            }
            headerBtn.title = state === 'playing' ? "Zatrzymaj radio" : "Włącz radio";
        }

        // 3. Update Animations
        const animationState = isPlaying ? 'running' : 'paused';
        
        if (vinyl) {
            vinyl.style.animationPlayState = animationState;
        }
        
        if (waves) {
            waves.forEach(wave => {
                wave.style.animationPlayState = animationState;
            });
        }
    }

    // Expose for debugging if needed
    window.initRadio = initRadioOnce;

    // Run initially (Singleton Pattern)
    if(document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initRadioOnce);
    } else {
        initRadioOnce();
    }
    
    // UI Update on Navigation (Radio persists, UI changes)
    document.addEventListener('page:loaded', () => {
        if (radioInitialized && window.updateGlobalRadioUI) {
            window.updateGlobalRadioUI();
        }
    });
