(() => {
    const themeStorageKey = 'revoza-theme';
    const allowedThemes = new Set([
        'cool-dark',
        'soft-white',
        'cool-gray',
        'warm-cream',
        'soft-sage'
    ]);

    function applySavedTheme(theme) {
        if (!allowedThemes.has(theme)) return;
        document.documentElement.setAttribute('data-theme', theme);
        document.querySelectorAll('.theme select, #theme-select').forEach(select => {
            select.value = theme;
        });
    }

    const savedTheme = localStorage.getItem(themeStorageKey);
    if (savedTheme && allowedThemes.has(savedTheme)) {
        applySavedTheme(savedTheme);
    } else {
        const initialTheme = document.documentElement.getAttribute('data-theme') || 'cool-dark';
        applySavedTheme(initialTheme);
    }

    document.querySelectorAll('.theme select, #theme-select').forEach(select => {
        select.addEventListener('change', () => {
            if (!allowedThemes.has(select.value)) return;
            localStorage.setItem(themeStorageKey, select.value);
            applySavedTheme(select.value);
        });
    });

    window.addEventListener('storage', event => {
        if (event.key === themeStorageKey && event.newValue) {
            applySavedTheme(event.newValue);
        }
    });
})();
