// Contact Form Logic with Event Delegation for SPA
document.addEventListener('submit', async function(e) {
    if (e.target && e.target.name === 'contact') {
        e.preventDefault();
        const form = e.target;
        
        // Pobranie przycisku i elementów formularza
        const submitBtn = form.querySelector('button[type="submit"]');
        const originalBtnText = submitBtn.innerHTML;
        const messageArea = document.getElementById('form-message') || createMessageArea(form);
        
        // Pobieranie wartości
        const formData = new FormData(form);
        const data = Object.fromEntries(formData.entries());
        
        // Prosta validacja po stronie klienta
        if (!data.name || !data.email || !data.message) {
            showMessage(messageArea, 'Wypełnij wszystkie pola!', 'error');
            return;
        }

        // Stan ładowania
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<span>Wysyłanie...</span>';
        
        try {
            const response = await fetch('assets/php/contact.php', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(data)
            });
            
            const result = await response.json();
            
            if (response.ok) {
                showMessage(messageArea, result.message, 'success');
                form.reset(); // Wyczyść formularz
            } else {
                showMessage(messageArea, result.message || 'Wystąpił błąd.', 'error');
            }
        } catch (error) {
            console.error('Error:', error);
            showMessage(messageArea, 'Wystąpił błąd połączenia.', 'error');
        } finally {
            // Przywróć przycisk
            submitBtn.disabled = false;
            submitBtn.innerHTML = originalBtnText;
        }
    }
});

// Helper do tworzenia miejsca na komunikaty
function createMessageArea(form) {
    const div = document.createElement('div');
    div.id = 'form-message';
    div.style.marginBottom = '15px';
    div.style.padding = '10px';
    div.style.borderRadius = '8px';
    div.style.display = 'none';
    form.insertBefore(div, form.firstChild);
    return div;
}

// Helper do wyświetlania wiadomości
function showMessage(element, text, type) {
    element.style.display = 'block';
    element.textContent = text;
    
    if (type === 'success') {
        element.style.backgroundColor = 'rgba(76, 175, 80, 0.1)';
        element.style.color = '#4CAF50';
        element.style.border = '1px solid #4CAF50';
    } else {
        element.style.backgroundColor = 'rgba(244, 67, 54, 0.1)';
        element.style.color = '#F44336';
        element.style.border = '1px solid #F44336';
    }
    
    // Ukryj po 5 sekundach
    setTimeout(() => {
        element.style.display = 'none';
    }, 5000);
}
