import { Router } from '../js/router.js';
import { SpatialNav } from '../js/spatial-nav.js';
import { login, register } from '../../logic/crypto.js';

const RATE_LIMIT_KEY = 'ivids-login-rate-limit';
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

let mode = 'signin';
let countdownTimer = null;

/**
 * Initializes the login page elements, binds events for form submission and tabs,
 * and sets up spatial navigation focus.
 * @param {Object} [params] - Route parameters including active mode.
 */
export function init(params = {}) {
    mode = params.mode === 'register' ? 'register' : 'signin';

    const form = document.getElementById('login-form');
    const emailInput = document.getElementById('login-email');
    const usernameInput = document.getElementById('login-username');
    const pinInput = document.getElementById('login-pin');
    const submitBtn = document.getElementById('login-submit');
    const backBtn = document.getElementById('login-back');
    const circleBackBtn = document.getElementById('login-circle-back');
    const tabs = Array.from(document.querySelectorAll('.login-tab'));

    tabs.forEach(tab => {
        tab.onclick = () => setMode(tab.dataset.mode || 'signin');
    });

    if (pinInput) {
        pinInput.oninput = () => {
            pinInput.value = pinInput.value.replace(/\D/g, '');
        };
    }

    form.onsubmit = event => {
        event.preventDefault();
        handleSubmit();
    };

    if (backBtn) {
        backBtn.onclick = () => {
            Router.goBack();
        };
    }

    if (circleBackBtn) {
        circleBackBtn.onclick = () => {
            Router.goBack();
        };
    }

    [emailInput, usernameInput].forEach(input => {
        input.onchange = () => {
            input.value = input.value.trim();
        };
    });

    setMode(mode);
    updateCooldownMessage();
    if (window.i18n) window.i18n.applyTranslations();
    SpatialNav.focusFirst();
}

function t(key, fallback, replacements = {}) {
    const translated = window.i18n?.t(key);
    let value = translated && translated !== key ? translated : fallback;
    Object.entries(replacements).forEach(([name, replacement]) => {
        value = value.replace(`{${name}}`, replacement);
    });
    return value;
}

/**
 * Sets the active login mode ('signin' or 'register'), updates UI visibility,
 * and dynamically translates the page header titles and button texts.
 */
function setMode(nextMode) {
    mode = nextMode === 'register' ? 'register' : 'signin';
    document.querySelectorAll('.login-tab').forEach(tab => {
        tab.classList.toggle('active', tab.dataset.mode === mode);
    });

    const usernameField = document.getElementById('username-field');
    if (usernameField) {
        usernameField.classList.toggle('hidden', mode === 'signin');
    }

    const titleEl = document.getElementById('login-title');
    if (titleEl) {
        titleEl.dataset.i18n = mode === 'register' ? 'login.registerTitle' : 'login.signInTitle';
        titleEl.textContent = mode === 'register'
            ? t('login.registerTitle', 'Register')
            : t('login.signInTitle', 'Sign In');
    }

    const subtitleEl = document.getElementById('login-subtitle');
    if (subtitleEl) {
        subtitleEl.dataset.i18n = mode === 'register' ? 'login.registerSubtitle' : 'login.signInSubtitle';
        subtitleEl.textContent = mode === 'register'
            ? t('login.registerSubtitle', 'Register your account')
            : t('login.signInSubtitle', 'Log in to your account');
    }

    const submitBtn = document.getElementById('login-submit');
    if (submitBtn) {
        submitBtn.dataset.i18n = mode === 'register' ? 'login.registerBtn' : 'login.signInBtn';
        submitBtn.textContent = mode === 'register'
            ? t('login.registerBtn', 'Create Account')
            : t('login.signInBtn', 'Sign In');
    }

    setMessage('');
}

/**
 * Retrieves the PIN code value from the single login-pin input field.
 * Returns the entered PIN string.
 */
function getPin() {
    return document.getElementById('login-pin')?.value || '';
}

/**
 * Validates the email, PIN, and conditionally the username input fields.
 * The username validation is only enforced in registration mode.
 */
function validate(email, username, pin) {
    if (!EMAIL_RE.test(email)) return t('login.errorInvalidEmail', 'Please enter a valid email');
    if (mode === 'register' && !username) return t('login.errorEmptyUsername', 'Username is required');
    if (!/^\d{4,8}$/.test(pin)) return t('login.errorPinLength', 'PIN must be 4 to 8 digits');
    return null;
}

function getRateState() {
    try {
        return JSON.parse(sessionStorage.getItem(RATE_LIMIT_KEY)) || { attempts: 0, lockedUntil: 0 };
    } catch (error) {
        return { attempts: 0, lockedUntil: 0 };
    }
}

function setRateState(state) {
    sessionStorage.setItem(RATE_LIMIT_KEY, JSON.stringify(state));
}

function getCooldownMs(attempts) {
    if (attempts >= 10) return 30 * 60 * 1000;
    if (attempts >= 6) return 5 * 60 * 1000;
    if (attempts >= 3) return 30 * 1000;
    return 0;
}

function isLocked() {
    const state = getRateState();
    return state.lockedUntil && state.lockedUntil > Date.now();
}

function incrementFailures() {
    const state = getRateState();
    state.attempts = (state.attempts || 0) + 1;
    const cooldown = getCooldownMs(state.attempts);
    if (cooldown) {
        state.lockedUntil = Date.now() + cooldown;
    }
    setRateState(state);
    updateCooldownMessage();
}

function clearFailures() {
    sessionStorage.removeItem(RATE_LIMIT_KEY);
    if (countdownTimer) {
        clearInterval(countdownTimer);
        countdownTimer = null;
    }
}

function updateCooldownMessage() {
    if (countdownTimer) clearInterval(countdownTimer);

    const tick = () => {
        const state = getRateState();
        const remaining = Math.ceil(((state.lockedUntil || 0) - Date.now()) / 1000);
        if (remaining > 0) {
            setMessage(t('login.errorRateLimit', 'Too many attempts. Try again in {seconds}s.', { seconds: String(remaining) }), 'error');
            return;
        }
        if (countdownTimer) {
            clearInterval(countdownTimer);
            countdownTimer = null;
        }
        if (state.lockedUntil) {
            state.lockedUntil = 0;
            setRateState(state);
            setMessage('');
        }
    };

    if (isLocked()) {
        tick();
        countdownTimer = setInterval(tick, 1000);
    }
}

function setMessage(message, type = '') {
    const messageEl = document.getElementById('login-message');
    if (!messageEl) return;
    messageEl.textContent = message;
    messageEl.classList.toggle('error', type === 'error');
    messageEl.classList.toggle('success', type === 'success');
}

function setLoading(loading) {
    const submitBtn = document.getElementById('login-submit');
    if (!submitBtn) return;
    submitBtn.disabled = loading;
    submitBtn.classList.toggle('loading', loading);
    if (loading) {
        submitBtn.textContent = '...';
    } else {
        submitBtn.textContent = mode === 'register'
            ? t('login.registerBtn', 'Create Account')
            : t('login.signInBtn', 'Sign In');
    }
}

function hydrateSession({ pushId, username, email, info }) {
    const profile = info.profile || { name: username, color: '#E50914' };
    const ns = `ivids-acc-${pushId}`;

    localStorage.setItem('ivids-cloud-session', JSON.stringify({ pushId, username, email }));
    localStorage.setItem('ivids-current-profile', JSON.stringify({
        id: pushId,
        name: profile.name || username,
        color: profile.color || '#E50914'
    }));
    localStorage.setItem(`${ns}-user_playlists`, JSON.stringify(info.playlists || []));
    localStorage.setItem(`${ns}-recently-watched`, JSON.stringify(info.recentlyWatched || []));
    localStorage.setItem(`${ns}-settings`, JSON.stringify(info.settings || {}));
    localStorage.setItem(`${ns}-watch-progress`, JSON.stringify(info.watchProgress || {}));

    if (info.settings?.accentColor) {
        document.documentElement.style.setProperty('--primary-color', info.settings.accentColor);
    }
}

/**
 * Processes the login or registration form submission.
 * Derives cryptographic keys to authenticate or register the user with Firebase.
 */
async function handleSubmit() {
    if (isLocked()) {
        updateCooldownMessage();
        return;
    }

    const email = document.getElementById('login-email').value.trim().toLowerCase();
    const username = mode === 'register' ? document.getElementById('login-username').value.trim() : '';
    const pin = getPin();
    const validationError = validate(email, username, pin);

    if (validationError) {
        setMessage(validationError, 'error');
        return;
    }

    setLoading(true);
    setMessage('');

    try {
        const result = mode === 'register'
            ? await register(email, username, pin)
            : await login(email, '', pin);

        if (!result.success) {
            if (result.reason === 'already_registered') {
                setMessage(t('login.errorAlreadyRegistered', 'This account already exists. Try signing in.'), 'error');
            } else {
                setMessage(t('login.errorLoginFailed', 'Invalid credentials. Please try again.'), 'error');
                incrementFailures();
            }
            return;
        }

        clearFailures();
        const finalUsername = mode === 'register' ? username : result.username;
        hydrateSession({ pushId: result.pushId, username: finalUsername, email, info: result.info });
        setMessage(
            mode === 'register'
                ? t('login.successRegistered', 'Account created!')
                : t('login.successLoggedIn', 'Welcome back, {name}!', { name: finalUsername }),
            'success'
        );
        Router.loadPage('home');
    } catch (error) {
        console.error('Login: auth request failed', error);
        setMessage(t('login.errorNetwork', 'Could not reach the server. Check your connection.'), 'error');
    } finally {
        setLoading(false);
    }
}
