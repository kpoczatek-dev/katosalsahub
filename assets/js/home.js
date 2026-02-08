/**
 * Home Page Logic
 * Extracted from index.html inline scripts.
 */

window.initHome = function() {
    console.log('Initializing Home Page...');
    
    // Update Year in Footer
    const rok = document.getElementById("rok");
    if(rok) rok.textContent = new Date().getFullYear();

    // Re-attach listeners or restart animations if needed
    // Currently, CSS animations run automatically on load.
    // If there were specific JS animations (like ScrollReveal), they would go here.
    
    // Note: Burger menu is global and handled in index.html or router, 
    // but specific page interactions go here.
};

// Auto-run if not loaded via Router (e.g., direct refresh)
// router.js handles the check on DOMContentLoaded, but we define the function here.
