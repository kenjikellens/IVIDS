import { Router } from '../js/router.js';
import { SpatialNav } from '../js/spatial-nav.js';
import { getActiveAccount } from '../../logic/account-helper.js';
// Import session clearing logic to reset cloud credentials on logout
import { clearSession } from '../../logic/crypto.js';

/**
 * Initializes the account page details, displays current profile state,
 * and sets up authentication handlers for signing in and out.
 */
export async function init() {
    console.log('Account page initialized');

    const account = getActiveAccount();
    const avatarEl = document.getElementById('current-profile-avatar');
    const nameEl = document.getElementById('current-profile-name');
    const sectionTitle = document.getElementById('account-section-title');
    
    const signInBtn = document.getElementById('account-sign-in-btn');
    const createAccBtn = document.getElementById('account-create-acc-btn');
    const signOutBtn = document.getElementById('account-sign-out-btn');

    // Hide all actions first
    if (signInBtn) signInBtn.style.display = 'none';
    if (createAccBtn) createAccBtn.style.display = 'none';
    if (signOutBtn) signOutBtn.style.display = 'none';

    if (account) {
        // Logged In state
        if (sectionTitle) sectionTitle.textContent = window.i18n.t('account.currentProfile') || 'Current Account';
        nameEl.textContent = account.name;
        avatarEl.style.backgroundColor = account.color || '#E50914';
        avatarEl.textContent = account.name.charAt(0).toUpperCase();

        if (signOutBtn) signOutBtn.style.display = 'inline-block';
    } else {
        // Anonymous (Logged Out) state
        if (sectionTitle) sectionTitle.textContent = window.i18n.t('account.anonymousMode') || 'Guest Mode';
        nameEl.textContent = window.i18n.t('account.notLoggedIn') || 'Not Signed In';
        avatarEl.style.backgroundColor = '#555';
        avatarEl.textContent = '?';

        if (signInBtn) signInBtn.style.display = 'inline-block';
        if (createAccBtn) createAccBtn.style.display = 'inline-block';
    }

    // Apply translations
    if (window.i18n && typeof window.i18n.applyTranslations === 'function') {
        window.i18n.applyTranslations();
    }

    // Handlers
    if (signInBtn) {
        signInBtn.onclick = () => {
            Router.loadPage('login');
        };
    }

    if (createAccBtn) {
        createAccBtn.onclick = () => {
            Router.loadPage('login', { mode: 'register' });
        };
    }

    if (signOutBtn) {
        signOutBtn.onclick = () => {
            // Remove user profiles and session data from local storage
            localStorage.removeItem('ivids-current-profile');
            localStorage.removeItem('ivids-cloud-session');
            
            // Clear in-memory crypto credentials
            clearSession();
            
            // Reapply primary/accent color to default settings if any, or reload
            const savedSettings = localStorage.getItem('ivids-settings');
            const globalSettings = savedSettings ? JSON.parse(savedSettings) : {};
            if (globalSettings.accentColor) {
                document.documentElement.style.setProperty('--primary-color', globalSettings.accentColor);
            } else {
                document.documentElement.style.setProperty('--primary-color', '#46d369'); // default green accent
            }
            
            // Reset Router's current page to force reload the account view
            Router.currentPage = null;
            Router.loadPage('account');
        };
    }

    SpatialNav.focusFirst();
}
