function getPasswordRuleResults(password) {
    return {
        length: password.length >= 8,
        uppercase: /[A-Z]/.test(password),
        lowercase: /[a-z]/.test(password),
        number: /\d/.test(password),
        special: /[^A-Za-z0-9]/.test(password)
    };
}

function isValidUserName(name) {
    return /^[\p{L}\p{M}][\p{L}\p{M} .'-’]*$/u.test(name);
}

function updatePasswordRules() {
    const passwordInput = document.getElementById('login-password');
    if (!passwordInput) return;

    const rules = getPasswordRuleResults(passwordInput.value);
    Object.entries(rules).forEach(([rule, passed]) => {
        const element = document.querySelector(`[data-password-rule="${rule}"]`);
        if (element) {
            element.classList.toggle('passed', passed);
            element.setAttribute('aria-label', `${passed ? 'Met' : 'Not met'}: ${element.textContent}`);
        }
    });
}

function updateAuthFeedback(showEmptyErrors = false) {
    const nameInput = document.getElementById('signup-name');
    const emailInput = document.getElementById('login-email');
    const passwordInput = document.getElementById('login-password');
    const confirmInput = document.getElementById('signup-confirm-password');
    if (!nameInput || !emailInput || !passwordInput || !confirmInput) return;

    const showFieldError = (input, errorId, message) => {
        const error = document.getElementById(errorId);
        if (!error) return;

        const hasError = Boolean(message);
        input.classList.toggle('auth-invalid', hasError);
        input.setAttribute('aria-invalid', String(hasError));
        error.textContent = message;
        error.classList.toggle('hidden', !hasError);
    };

    if (authMode === 'signup') {
        const passwordRules = getPasswordRuleResults(passwordInput.value);
        const passwordIsValid = Object.values(passwordRules).every(Boolean);
        const name = nameInput.value.trim();
        const nameLength = name.length;

        showFieldError(
            nameInput,
            'signup-name-error',
            nameLength > 0 && !isValidUserName(name)
                ? 'This is not a valid format.'
                : (nameLength > 0 && (nameLength < 3 || nameLength > 25)
                    ? 'User name must be between 3 and 25 characters'
                    : '')
        );
        showFieldError(
            passwordInput,
            'auth-password-error',
            passwordInput.value && !passwordIsValid
                ? 'Password must be at least 8 characters and include 1 lowercase letter, 1 uppercase letter, 1 number, and 1 special character.'
                : ''
        );
        showFieldError(
            confirmInput,
            'signup-confirm-error',
            confirmInput.value && confirmInput.value !== passwordInput.value
                ? 'The password does not match!'
                : ''
        );
    } else {
        showFieldError(nameInput, 'signup-name-error', '');
        showFieldError(confirmInput, 'signup-confirm-error', '');
        showFieldError(
            passwordInput,
            'auth-password-error',
            !passwordInput.value && showEmptyErrors ? 'Enter your password.' : ''
        );
    }

    showFieldError(
        emailInput,
        'auth-email-error',
        emailInput.value && !emailInput.validity.valid
            ? 'Email is not in valid format'
            : (!emailInput.value && showEmptyErrors ? 'Enter a valid email address.' : '')
    );
}

function showAuthMessage(message, isSuccess = false) {
    const element = document.getElementById('auth-message');
    if (!element) return;

    element.textContent = message;
    element.classList.toggle('success', isSuccess);
    element.classList.remove('hidden');
}
