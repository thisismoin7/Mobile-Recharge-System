(function () {
    const button = document.querySelector('.user-dropdown-container > .avatar-button');
    if (!button) return;

    const updateLabel = () => {
        try {
            const email = localStorage.getItem('revoza-demo-session');
            const accounts = JSON.parse(localStorage.getItem('revoza-demo-accounts') || '[]');
            const account = Array.isArray(accounts)
                ? accounts.find(item => item && item.email === email && typeof item.name === 'string')
                : null;

            button.textContent = account ? account.name : 'Log in';
            button.setAttribute('aria-label', account ? `Show signed-in status for ${account.name}` : 'Open login page');
            
        } catch (error) {
            console.error('Unable to read the local demo account for the page header.', error);
            button.textContent = 'Log in';
            button.setAttribute('aria-label', 'Log in');
        }
    };

    updateLabel();
    window.addEventListener('storage', event => {
        if (event.key === 'revoza-demo-session' || event.key === 'revoza-demo-accounts') {
            updateLabel();
        }
    });
})();
