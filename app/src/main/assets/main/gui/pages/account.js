import { Router } from '../js/router.js';
import { SpatialNav } from '../js/spatial-nav.js';

export async function init() {
    console.log('Account page initialized');

    const profileData = localStorage.getItem('ivids-current-profile');
    const avatarEl = document.getElementById('current-profile-avatar');
    const nameEl = document.getElementById('current-profile-name');
    const editBtn = document.getElementById('account-edit-profile-btn');
    const switchBtn = document.getElementById('account-switch-profile-btn');

    if (profileData) {
        try {
            const profile = JSON.parse(profileData);
            const isGuest = profile.id === 'guest' || profile.name === 'Guest';

            nameEl.textContent = profile.name;
            avatarEl.style.backgroundColor = profile.color || '#E50914';
            avatarEl.textContent = profile.name.charAt(0).toUpperCase();

            // Hide edit button for Guest
            if (isGuest && editBtn) {
                editBtn.style.display = 'none';
            }
        } catch (e) {
            console.error('Error parsing profile data:', e);
            nameEl.textContent = 'User';
        }
    } else {
        nameEl.textContent = 'Guest';
        avatarEl.style.backgroundColor = '#555';
        avatarEl.textContent = 'G';
        if (editBtn) editBtn.style.display = 'none';
    }

    // Apply translations
    if (window.i18n && typeof window.i18n.applyTranslations === 'function') {
        window.i18n.applyTranslations();
    }

    // Handlers
    if (switchBtn) {
        switchBtn.onclick = () => {
            console.log('Switching profile...');
            localStorage.removeItem('ivids-current-profile');
            Router.loadPage('profiles');
        };
    }

    if (editBtn) {
        editBtn.onclick = () => {
            console.log('Redirecting to Edit Profile...');
            Router.loadPage('profiles', { editMode: true });
        };
    }

    SpatialNav.focusFirst();
}
