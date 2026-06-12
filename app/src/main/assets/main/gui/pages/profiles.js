import { Router } from '../js/router.js';
import { SpatialNav } from '../js/spatial-nav.js';
import { Splash } from '../js/splash.js';
import { manageModal } from '../js/utils/ui-helper.js';

async function hashPin(pin) {
    if (!pin) return null;
    try {
        const msgBuffer = new TextEncoder().encode(pin);
        const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    } catch (e) {
        console.error('Profiles: PIN hashing failed, using plaintext:', e);
        return pin;
    }
}

export const init = async (params) => {
    console.log('Profiles: Initializing...');

    let closeProfileModalFn = null;
    let closeDeleteConfirmModalFn = null;
    let closePinModalFn = null;

    let profiles = JSON.parse(localStorage.getItem('ivids-profiles')) || [];
    let currentEditingIndex = -1;
    const DEFAULT_COLOR = '#E50914';
    let selectedColor = DEFAULT_COLOR;

    /**
     * Renders the accounts and profiles list in the UI, mapping each profile/account
     * and the 'Add Account' card to a dedicated side-by-side flex row layout.
     */
    const renderProfiles = () => {
        const profilesGrid = document.getElementById('profiles-grid');
        if (!profilesGrid) return;
        profilesGrid.innerHTML = '';

        // displayList represents the Accounts
        const displayList = [...profiles];
        const hasAddCard = profiles.length < 5;

        // 1. Add Profile Card Row
        if (hasAddCard) {
            const row = document.createElement('div');
            row.className = 'profile-row';

            const addCard = document.createElement('div');
            addCard.id = 'add-profile-card';
            addCard.className = 'profile-card focusable';
            addCard.innerHTML = `
                <div class="profile-card-surface add-profile-surface">
                    <div class="profile-avatar-container">
                        <div class="profile-avatar add-avatar">+</div>
                    </div>
                    <div class="profile-card-copy">
                        <div class="profile-name" data-i18n="profiles.add">Add Account</div>
                        <div class="profile-meta">Create a new account</div>
                    </div>
                </div>
            `;
            addCard.dataset.navDown = profiles.length > 0 ? '#profile-card-0' : '';
            addCard.dataset.navUp = '';
            addCard.dataset.navLeft = '';
            addCard.dataset.navRight = '';
            addCard.onclick = () => showProfileModal();

            row.appendChild(addCard);

            // Spacer for alignment next to the profile card
            const spacer = document.createElement('div');
            spacer.style.width = '72px';
            spacer.style.flexShrink = '0';
            row.appendChild(spacer);

            profilesGrid.appendChild(row);
        }

        // 2. Render Accounts Rows
        displayList.forEach((profile, index) => {
            const row = document.createElement('div');
            row.className = 'profile-row';

            const card = createProfileCard(profile, index);
            row.appendChild(card);

            const editBtn = document.createElement('button');
            editBtn.id = `edit-btn-${index}`;
            editBtn.className = 'manage-btn edit-btn focusable';
            editBtn.type = 'button';
            editBtn.title = 'Edit';
            editBtn.innerHTML = `<img src="images/edit.svg" alt="Edit">`;
            
            // Explicit Spatial Navigation overrides for edit button
            editBtn.dataset.navUp = (index === 0) ? (hasAddCard ? '#add-profile-card' : '') : `#edit-btn-${index - 1}`;
            editBtn.dataset.navDown = (index === profiles.length - 1) ? '' : `#edit-btn-${index + 1}`;
            editBtn.dataset.navLeft = `#profile-card-${index}`;
            editBtn.dataset.navRight = '';

            editBtn.onclick = (e) => {
                e.stopPropagation();
                showProfileModal(index);
            };

            row.appendChild(editBtn);
            profilesGrid.appendChild(row);
        });

        if (window.i18n) window.i18n.applyTranslations();

        // Initial Focus or Edit Mode
        setTimeout(() => {
            if (params && params.editMode) {
                const currentProfile = JSON.parse(localStorage.getItem('ivids-current-profile'));
                if (currentProfile) {
                    const idx = profiles.findIndex(p => p.id === currentProfile.id);
                    if (idx !== -1) {
                        showProfileModal(idx);
                        return;
                    }
                }
            }

            const firstProfile = document.getElementById('profile-card-0');
            const addAction = document.getElementById('add-profile-card');
            if (firstProfile) {
                SpatialNav.setFocus(firstProfile);
            } else if (addAction) {
                SpatialNav.setFocus(addAction);
            } else {
                SpatialNav.focusFirst();
            }
        }, 100);
    };

    /**
     * Creates a profile card element containing the user's avatar and name details.
     * Configures drag-and-drop event handlers for reordering profile lists.
     *
     * @param {Object} profile - The profile information data object.
     * @param {number} index - The zero-based index of this profile card in the list.
     * @returns {HTMLDivElement} The constructed profile card DOM node.
     */
    const createProfileCard = (profile, index) => {
        const card = document.createElement('div');
        card.className = 'profile-card focusable';
        card.id = `profile-card-${index}`;
        card.dataset.index = index;

        // Navigation Overrides
        const hasAddCard = profiles.length < 5;
        card.dataset.navUp = (index === 0) ? (hasAddCard ? '#add-profile-card' : '') : `#profile-card-${index - 1}`;
        card.dataset.navDown = (index === profiles.length - 1) ? '' : `#profile-card-${index + 1}`;
        card.dataset.navRight = `#edit-btn-${index}`;
        card.dataset.navLeft = '';

        const hasPin = !!profile.pin;
        const meta = hasPin ? 'PIN protected' : 'Ready to watch';

        card.innerHTML = `
            <div class="profile-card-surface">
                <div class="profile-avatar-container">
                    <div class="profile-avatar" style="background: ${profile.color || DEFAULT_COLOR}">
                        ${profile.name.charAt(0).toUpperCase()}
                    </div>
                </div>
                <div class="profile-card-copy">
                    <div class="profile-name">${profile.name}</div>
                    <div class="profile-meta">${meta}</div>
                </div>
            </div>
        `;

        card.onclick = (e) => {
            handleProfileSelection(profile);
        };

        // Mobile Drag-and-Drop
        let longPressTimer;
        let isDragging = false;
        let startX, startY;

        card.addEventListener('touchstart', (e) => {
            startX = e.touches[0].clientX;
            startY = e.touches[0].clientY;

            longPressTimer = setTimeout(() => {
                isDragging = true;
                card.classList.add('dragging');
                if (window.navigator.vibrate) window.navigator.vibrate(50);
            }, 500);
        }, { passive: true });

        card.addEventListener('touchmove', (e) => {
            if (!isDragging) {
                const dx = Math.abs(e.touches[0].clientX - startX);
                const dy = Math.abs(e.touches[0].clientY - startY);
                if (dx > 10 || dy > 10) clearTimeout(longPressTimer);
                return;
            }

            e.preventDefault(); // Prevent scrolling while dragging

            const touch = e.touches[0];
            const target = document.elementFromPoint(touch.clientX, touch.clientY);
            const targetCard = target ? target.closest('.profile-card') : null;

            if (targetCard && targetCard !== card && targetCard.id.startsWith('profile-card-')) {
                const targetIndex = parseInt(targetCard.dataset.index);
                if (!isNaN(targetIndex)) {
                    document.querySelectorAll('.profile-card').forEach(c => c.classList.remove('drag-over'));
                    targetCard.classList.add('drag-over');
                }
            }
        }, { passive: false });

        card.addEventListener('touchend', (e) => {
            clearTimeout(longPressTimer);
            if (!isDragging) return;

            isDragging = false;
            card.classList.remove('dragging');
            document.querySelectorAll('.profile-card').forEach(c => c.classList.remove('drag-over'));

            const touch = e.changedTouches[0];
            const target = document.elementFromPoint(touch.clientX, touch.clientY);
            const targetCard = target ? target.closest('.profile-card') : null;

            if (targetCard && targetCard !== card && targetCard.id.startsWith('profile-card-')) {
                const targetIndex = parseInt(targetCard.dataset.index);
                if (!isNaN(targetIndex)) {
                    moveProfileToIndex(index, targetIndex);
                }
            }
        });

        return card;
    };

    const moveProfileToIndex = (fromIndex, toIndex) => {
        const displayList = [...profiles];
        const item = displayList.splice(fromIndex, 1)[0];
        displayList.splice(toIndex, 0, item);

        localStorage.setItem('ivids-profiles', JSON.stringify(displayList));
        profiles = displayList;

        renderProfiles();
    };

    const handleProfileSelection = (profile) => {
        if (profile.pin) {
            showPinModal(profile);
        } else {
            selectProfile(profile);
        }
    };

    const selectProfile = (profile) => {
        localStorage.setItem('ivids-current-profile', JSON.stringify(profile));

        // Navigate to last route or home
        const lastRouteData = localStorage.getItem('ivids-last-route');
        if (lastRouteData) {
            try {
                const { page, params } = JSON.parse(lastRouteData);
                Router.loadPage(page, params);
            } catch (e) {
                Router.loadPage('home');
            }
        } else {
            Router.loadPage('home');
        }
    };

    const showProfileModal = (index = -1) => {
        currentEditingIndex = index;
        const nameInput = document.getElementById('profile-name');
        const pinInput = document.getElementById('profile-pin');
        const modalTitle = document.getElementById('modal-title');
        const pinGroup = document.getElementById('pin-input-group');

        const deleteBtn = document.getElementById('delete-profile-btn');
        const cancelBtn = document.getElementById('cancel-profile-btn');

        if (index === -1) {
            modalTitle.textContent = window.i18n.t('profiles.createTitle');
            nameInput.value = '';
            pinInput.value = '';
            selectedColor = DEFAULT_COLOR;
            pinGroup.style.display = 'flex';
            if (deleteBtn) deleteBtn.style.display = 'none';
            if (cancelBtn) cancelBtn.dataset.navLeft = '';
        } else {
            modalTitle.textContent = window.i18n.t('profiles.editTitle');
            const profile = profiles[index];
            nameInput.value = profile.name;
            pinInput.value = profile.pin ? '••••' : ''; // Mask PIN in edit mode
            selectedColor = profile.color || DEFAULT_COLOR;
            pinGroup.style.display = 'none'; // Don't edit PIN in simple mode for now

            if (deleteBtn) {
                deleteBtn.style.display = 'block';
                deleteBtn.onclick = (e) => {
                    e.stopPropagation();
                    showDeleteConfirmation(index);
                };
            }
            if (cancelBtn) cancelBtn.dataset.navLeft = '#delete-profile-btn';
        }

        updateColorSelection();
        const profileModal = document.getElementById('profile-modal');
        closeProfileModalFn = manageModal(profileModal, nameInput);
    };

    const updateColorSelection = () => {
        document.querySelectorAll('.color-option').forEach(opt => {
            if (opt.dataset.color === selectedColor) {
                opt.classList.add('selected');
            } else {
                opt.classList.remove('selected');
            }
        });
    };

    const saveProfile = async () => {
        const nameInput = document.getElementById('profile-name');
        const pinInput = document.getElementById('profile-pin');
        const nameError = document.getElementById('profile-name-error');
        const pinError = document.getElementById('profile-pin-error');
        const modalContent = document.querySelector('.profile-modal-content');

        const name = nameInput.value.trim();
        const pin = pinInput.value.trim();

        let isValid = true;

        // Reset errors
        nameError.textContent = '';
        nameError.classList.remove('visible');
        pinError.textContent = '';
        pinError.classList.remove('visible');
        modalContent.classList.remove('shake');

        if (!name) {
            nameError.textContent = window.i18n.t('profiles.errorNameEmpty');
            nameError.classList.add('visible');
            isValid = false;
        }

        if (currentEditingIndex === -1 && pin && pin.length !== 4) {
            pinError.textContent = window.i18n.t('profiles.errorPinLength');
            pinError.classList.add('visible');
            isValid = false;
        }

        if (!isValid) {
            void modalContent.offsetWidth; // Trigger reflow
            modalContent.classList.add('shake');
            return;
        }

        if (currentEditingIndex === -1) {
            const accId = `acc_${Date.now()}`;
            const hashedPin = await hashPin(pin);
            profiles.push({ id: accId, name, color: selectedColor, pin: hashedPin });
        } else {
            profiles[currentEditingIndex].name = name;
            profiles[currentEditingIndex].color = selectedColor;
        }

        localStorage.setItem('ivids-profiles', JSON.stringify(profiles));
        if (closeProfileModalFn) {
            closeProfileModalFn();
            closeProfileModalFn = null;
        }
        renderProfiles();
    };

    const deleteProfile = (index) => {
        const profileToDelete = profiles[index];
        const currentProfile = JSON.parse(localStorage.getItem('ivids-current-profile'));

        profiles.splice(index, 1);
        localStorage.setItem('ivids-profiles', JSON.stringify(profiles));

        // If it was the active profile, log out
        if (currentProfile && currentProfile.id === profileToDelete.id) {
            localStorage.removeItem('ivids-current-profile');
            localStorage.removeItem('ivids-last-route');
        }

        if (closeDeleteConfirmModalFn) {
            closeDeleteConfirmModalFn();
            closeDeleteConfirmModalFn = null;
        }

        if (closeProfileModalFn) {
            closeProfileModalFn();
            closeProfileModalFn = null;
        }

        renderProfiles();
    };

    const showDeleteConfirmation = (index) => {
        const profileToDelete = profiles[index];
        const deleteConfirmModal = document.getElementById('delete-confirm-modal');
        const deleteConfirmMessage = document.getElementById('delete-confirm-message');
        const confirmBtn = document.getElementById('confirm-delete-btn');
        const cancelBtn = document.getElementById('cancel-delete-btn');

        let message = window.i18n.t('profiles.deleteConfirmMessage');
        message = message.replace('{name}', profileToDelete.name);
        deleteConfirmMessage.textContent = message;

        closeDeleteConfirmModalFn = manageModal(deleteConfirmModal, cancelBtn);

        confirmBtn.onclick = () => deleteProfile(index);
        cancelBtn.onclick = () => {
            if (closeDeleteConfirmModalFn) {
                closeDeleteConfirmModalFn();
                closeDeleteConfirmModalFn = null;
            }
            // Go back to profile modal
            const profileModal = document.getElementById('profile-modal');
            SpatialNav.setFocusTrap(profileModal);
            SpatialNav.setFocus(document.getElementById('delete-profile-btn'));
        };
    };

    const showPinModal = (profile) => {
        const pinMessage = document.getElementById('pin-message');
        const pinTitle = document.getElementById('pin-modal-title');

        let titleText = window.i18n.t('profiles.enterPin');
        titleText = titleText.replace('{name}', profile.name);
        pinTitle.textContent = titleText;

        pinMessage.textContent = '';

        // Clear digits
        for (let i = 1; i <= 4; i++) {
            document.getElementById(`pin-digit-${i}`).value = '';
        }

        const pinModal = document.getElementById('pin-modal');
        closePinModalFn = manageModal(pinModal, document.getElementById('pin-digit-1'));

        // Logic to move between digits
        const digits = [1, 2, 3, 4].map(i => document.getElementById(`pin-digit-${i}`));
        digits.forEach((input, i) => {
            input.oninput = (e) => {
                if (input.value && i < 3) {
                    SpatialNav.setFocus(digits[i + 1]);
                } else if (input.value && i === 3) {
                    verifyPin(profile);
                }
            };
            input.onkeydown = (e) => {
                if (e.key === 'Backspace' && !input.value && i > 0) {
                    SpatialNav.setFocus(digits[i - 1]);
                }
            };
        });
    };

    const verifyPin = async (profile) => {
        const enteredPin = [1, 2, 3, 4].map(i => document.getElementById(`pin-digit-${i}`).value).join('');
        const hashedEntered = await hashPin(enteredPin);
        
        if (hashedEntered === profile.pin) {
            if (closePinModalFn) {
                closePinModalFn();
                closePinModalFn = null;
            }
            selectProfile(profile);
        } else {
            document.getElementById('pin-message').textContent = window.i18n.t('profiles.incorrectPin');
            // Clear inputs
            [1, 2, 3, 4].forEach(i => document.getElementById(`pin-digit-${i}`).value = '');
            SpatialNav.setFocus(document.getElementById('pin-digit-1'));
        }
    };

    document.getElementById('save-profile-btn').onclick = saveProfile;
    document.getElementById('cancel-profile-btn').onclick = () => {
        if (closeProfileModalFn) {
            closeProfileModalFn();
            closeProfileModalFn = null;
        }
    };
    document.getElementById('cancel-pin-btn').onclick = () => {
        if (closePinModalFn) {
            closePinModalFn();
            closePinModalFn = null;
        }
    };

    const addProfileAction = document.getElementById('add-profile-action');
    if (addProfileAction) {
        addProfileAction.onclick = () => showProfileModal();
    }

    document.querySelectorAll('.color-option').forEach(opt => {
        opt.onclick = () => {
            selectedColor = opt.dataset.color;
            updateColorSelection();
        };
    });

    renderProfiles();

    // Signal UI loaded to splash screen
    Splash.signalContentLoaded();
};
