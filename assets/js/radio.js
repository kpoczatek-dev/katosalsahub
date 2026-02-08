/**
 * Timba Nation Radio Logic
 * Handles the radio playback, state synchronization between buttons, and animations.
 */

document.addEventListener('DOMContentLoaded', () => {
    // Elements
    const headerPlayBtn = document.getElementById('header-radio-play');
    const sectionPlayBtn = document.getElementById('radio-play');
    
    // Animation elements (Section)
    const vinyl = document.querySelector('.vinyl-disc');
    const soundWaves = document.querySelectorAll('.sound-wave span');
    
    // Audio Object
    const streamUrl = 'https://stream.zeno.fm/g0zpm0pypuhvv';
    let radioAudio = new Audio(streamUrl);
    let isPlaying = false;
    let isLoading = false;

    // Initialize
    function init() {
        if (headerPlayBtn) {
            headerPlayBtn.addEventListener('click', toggleRadio);
        }
        if (sectionPlayBtn) {
            sectionPlayBtn.addEventListener('click', toggleRadio);
        }
        
        // Setup audio events for better state handling
        radioAudio.addEventListener('playing', () => {
            isLoading = false;
            isPlaying = true;
            updateUI();
        });

        radioAudio.addEventListener('pause', () => {
            isPlaying = false;
            updateUI();
        });

        radioAudio.addEventListener('waiting', () => {
            isLoading = true;
            updateUI();
        });

        radioAudio.addEventListener('error', (e) => {
            console.error("Radio Error:", e);
            isLoading = false;
            isPlaying = false;
            updateUI();
            alert("Nie udało się połączyć z radiem. Spróbuj ponownie później.");
        });
    }

    // Toggle Play/Pause
    function toggleRadio() {
        if (isPlaying) {
            radioAudio.pause();
            // Optional: Reload audio to stop buffering/lag when resuming later
            // radioAudio.src = streamUrl; 
        } else {
            isLoading = true;
            updateUI();
            radioAudio.play().catch(error => {
                console.error("Playback failed:", error);
                isLoading = false;
                isPlaying = false;
                updateUI();
            });
        }
    }

    // Update UI based on state
    function updateUI() {
        // defined states
        const state = isLoading ? 'loading' : (isPlaying ? 'playing' : 'stopped');
        
        // 1. Update Section Button
        if (sectionPlayBtn) {
            if (state === 'loading') {
                sectionPlayBtn.textContent = "⏳ Łączenie...";
                sectionPlayBtn.classList.add('loading');
            } else if (state === 'playing') {
                sectionPlayBtn.textContent = "⏹ Wyłącz radio";
                sectionPlayBtn.classList.add('playing');
                sectionPlayBtn.classList.remove('loading');
            } else {
                sectionPlayBtn.textContent = "▶ Włącz radio";
                sectionPlayBtn.classList.remove('playing', 'loading');
            }
        }

        // 2. Update Header Button
        if (headerPlayBtn) {
            // Reset classes
            headerPlayBtn.classList.remove('playing', 'loading');
            headerPlayBtn.innerHTML = ''; // Clear icon

            if (state === 'loading') {
                headerPlayBtn.classList.add('loading');
                // Spinner icon
                headerPlayBtn.innerHTML = `
                    <svg class="spinner" viewBox="0 0 50 50">
                        <circle class="path" cx="25" cy="25" r="20" fill="none" stroke-width="5"></circle>
                    </svg>`;
            } else if (state === 'playing') {
                headerPlayBtn.classList.add('playing');
                // Stop icon (Square)
                headerPlayBtn.innerHTML = `
                    <svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor">
                        <rect x="6" y="6" width="12" height="12" rx="2" ry="2"/>
                    </svg>`;
            } else {
                // Play icon (Triangle)
                headerPlayBtn.innerHTML = `
                    <svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor">
                        <path d="M8 5v14l11-7z"/>
                    </svg>`;
            }
            // Tooltip or title update
            headerPlayBtn.title = state === 'playing' ? "Zatrzymaj radio" : "Włącz radio";
        }

        // 3. Update Animations (Vinyl & Waves)
        const animationState = isPlaying ? 'running' : 'paused';
        
        if (vinyl) {
            vinyl.style.animationPlayState = animationState;
        }
        
        soundWaves.forEach(wave => {
            wave.style.animationPlayState = animationState;
        });
    }

    // Run
    init();
});
