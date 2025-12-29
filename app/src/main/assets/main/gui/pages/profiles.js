import { Router } from '../js/router.js';
import { SpatialNav } from '../js/spatial-nav.js';

export const init = async (params) => {
    console.log('Profiles: Initializing...');

    // Hide Sidebar if it exists
    const sidebar = document.getElementById('sidebar-container');
    if (sidebar) sidebar.style.display = 'none';

    const mainView = document.getElementById('main-view');
    if (mainView) mainView.style.marginLeft = '0';

    let profiles = JSON.parse(localStorage.getItem('ivids-profiles')) || [];
    let guestPos = parseInt(localStorage.getItem('ivids-guest-pos')) || 0; // Index in the list (0 = first after Add)
    let currentEditingIndex = -1;
    const DEFAULT_COLOR = '#E50914';
    let selectedColor = DEFAULT_COLOR;

    const renderProfiles = () => {
        const profilesGrid = document.getElementById('profiles-grid');
        if (!profilesGrid) return;
        profilesGrid.innerHTML = '';

        // Create unified list for rendering and navigation
        const displayList = [...profiles];
        const guestProfile = { id: 'guest', name: 'Guest', color: '#555' };
        displayList.splice(guestPos, 0, guestProfile);

        // 1. Add Profile Card (less than 5 profiles)
        if (profiles.length < 5) {
            const addCard = document.createElement('div');
            addCard.id = 'add-profile-card';
            addCard.className = 'profile-card focusable';
            addCard.innerHTML = `
                <div class="profile-avatar-container">
                    <div class="profile-avatar" style="background: #333;">+</div>
                </div>
                <div class="profile-name" data-i18n="profiles.add">Add Profile</div>
            `;
            addCard.dataset.navRight = `#profile-card-0`; // Points to first item in displayList
            addCard.onclick = () => showProfileModal();
            profilesGrid.appendChild(addCard);
        }

        // 2. Render displayList (Guest + Users)
        displayList.forEach((profile, index) => {
            const card = createProfileCard(profile, index);
            profilesGrid.appendChild(card);
        });

        if (window.i18n) window.i18n.applyTranslations();

        // Initial Focus or Edit Mode
        setTimeout(() => {
            if (params && params.editMode) {
                const currentProfile = JSON.parse(localStorage.getItem('ivids-current-profile'));
                if (currentProfile && currentProfile.id !== 'guest') {
                    // Try to find by name/color since ID might be transient in this simple implementation
                    // Or better, let's assume profiles is updated
                    const idx = profiles.findIndex(p => p.name === currentProfile.name);
                    if (idx !== -1) {
                        showProfileModal(idx);
                        return;
                    }
                }
            }

            const addBtn = document.getElementById('add-profile-card');
            if (addBtn) {
                SpatialNav.setFocus(addBtn);
            } else {
                SpatialNav.focusFirst();
            }
        }, 100);
    };

    const createProfileCard = (profile, index) => {
        const card = document.createElement('div');
        const isGuest = profile.id === 'guest';
        card.className = 'profile-card focusable';
        card.id = `profile-card-${index}`; // Standardized ID for all in displayList
        card.dataset.index = index;

        // Navigation Overrides
        if (index === 0) {
            card.dataset.navLeft = '#add-profile-card';
        }

        // Down goes to the controls (Right to Edit for Users, Right to Move for Guest)
        card.dataset.navDown = isGuest ? `#move-left-${index}` : `#edit-btn-${index}`;

        card.innerHTML = `
            <div class="profile-avatar-container">
                <div class="profile-avatar" style="background: ${profile.color || DEFAULT_COLOR}">
                    ${profile.name.charAt(0).toUpperCase()}
                </div>
            </div>
            <div class="profile-name">${profile.name}</div>
            <div class="profile-manage-controls">
                <div id="move-left-${index}" class="manage-btn move-left-btn focusable" title="Move Left" 
                    data-nav-up="#profile-card-${index}" 
                    data-nav-right="${isGuest ? `#move-right-${index}` : `#edit-btn-${index}`}">
                    <img src="images/arrow.svg" alt="Left">
                </div>
                ${!isGuest ? `
                <div id="edit-btn-${index}" class="manage-btn edit-btn focusable" title="Edit" 
                    data-nav-up="#profile-card-${index}" 
                    data-nav-left="#move-left-${index}" 
                    data-nav-right="#move-right-${index}">
                    <img src="images/edit.svg" alt="Edit">
                </div>` : ''}
                <div id="move-right-${index}" class="manage-btn move-right-btn focusable" title="Move Right" 
                    data-nav-up="#profile-card-${index}" 
                    data-nav-left="${isGuest ? `#move-left-${index}` : `#edit-btn-${index}`}">
                    <img src="images/arrow.svg" alt="Right">
                </div>
            </div>
        `;

        card.onclick = (e) => {
            if (e.target.closest('.manage-btn')) return;
            handleProfileSelection(profile);
        };

        // Click handlers for buttons
        const moveLeft = card.querySelector('.move-left-btn');
        const moveRight = card.querySelector('.move-right-btn');
        const edit = card.querySelector('.edit-btn');

        if (moveLeft) moveLeft.onclick = (e) => { e.stopPropagation(); reorderProfile(index, -1); };
        if (moveRight) moveRight.onclick = (e) => { e.stopPropagation(); reorderProfile(index, 1); };
        if (edit) edit.onclick = (e) => { e.stopPropagation(); showProfileModal(getUserIndex(index)); };

        // Mobile Drag-and-Drop
        let longPressTimer;
        let isDragging = false;
        let startX, startY;

        card.addEventListener('touchstart', (e) => {
            if (e.target.closest('.manage-btn')) return;
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
                    // Visual feedback: we could swap them in the DOM here for "premium" feel
                    // but calling reorderProfile frequently might be heavy.
                    // For now, let's just mark the target.
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
                    const direction = targetIndex - index;
                    // We don't have a multi-swap reorderProfile, so let's call it 
                    // or implement a direct swap/move logic
                    moveProfileToIndex(index, targetIndex);
                }
            }
        });

        return card;
    };

    const moveProfileToIndex = (fromIndex, toIndex) => {
        // Reconstruct common list
        const displayList = [...profiles];
        displayList.splice(guestPos, 0, { id: 'guest', name: 'Guest', color: '#555' });

        // Move item
        const item = displayList.splice(fromIndex, 1)[0];
        displayList.splice(toIndex, 0, item);

        // Persist back
        const newGuestPos = displayList.findIndex(p => p.id === 'guest');
        const newProfiles = displayList.filter(p => p.id !== 'guest');

        localStorage.setItem('ivids-profiles', JSON.stringify(newProfiles));
        localStorage.setItem('ivids-guest-pos', newGuestPos);

        profiles = newProfiles;
        guestPos = newGuestPos;

        renderProfiles();
    };

    /**
     * Map screen index back to profiles array index
     */
    const getUserIndex = (displayIndex) => {
        if (displayIndex < guestPos) return displayIndex;
        if (displayIndex > guestPos) return displayIndex - 1;
        return -1; // Should not happen for Edit as Guest has no edit btn
    };

    const reorderProfile = (index, direction) => {
        const newIndex = index + direction;

        // Reconstruct common list
        const displayList = [...profiles];
        displayList.splice(guestPos, 0, { id: 'guest', name: 'Guest', color: '#555' });

        if (newIndex < 0 || newIndex >= displayList.length) return;

        // Swap in display list
        const temp = displayList[index];
        displayList[index] = displayList[newIndex];
        displayList[newIndex] = temp;

        // Persist back
        const newGuestPos = displayList.findIndex(p => p.id === 'guest');
        const newProfiles = displayList.filter(p => p.id !== 'guest');

        localStorage.setItem('ivids-profiles', JSON.stringify(newProfiles));
        localStorage.setItem('ivids-guest-pos', newGuestPos);

        profiles = newProfiles;
        guestPos = newGuestPos;

        renderProfiles();

        // Refocus
        setTimeout(() => {
            const movedCard = document.getElementById(`profile-card-${newIndex}`);
            if (movedCard) SpatialNav.setFocus(movedCard);
        }, 50);
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

        // Show sidebar back for other pages
        if (sidebar) sidebar.style.display = 'block';
        if (mainView) mainView.style.marginLeft = '';

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
            pinInput.value = profile.pin || '';
            selectedColor = profile.color || DEFAULT_COLOR;
            pinGroup.style.display = 'none'; // Don't edit PIN for now for simplicity, or we can enable it

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
        profileModal.classList.add('active');
        SpatialNav.setFocusTrap(profileModal);
        SpatialNav.setFocus(nameInput);
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

    const saveProfile = () => {
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

        if (pin && pin.length !== 4) {
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
            profiles.push({ name, color: selectedColor, pin: pin || null });
        } else {
            profiles[currentEditingIndex].name = name;
            profiles[currentEditingIndex].color = selectedColor;
        }

        localStorage.setItem('ivids-profiles', JSON.stringify(profiles));
        const profileModal = document.getElementById('profile-modal');
        if (profileModal) profileModal.classList.remove('active');
        SpatialNav.clearFocusTrap();
        renderProfiles();
    };

    const deleteProfile = (index) => {
        const profileToDelete = profiles[index];
        const currentProfile = JSON.parse(localStorage.getItem('ivids-current-profile'));

        profiles.splice(index, 1);
        localStorage.setItem('ivids-profiles', JSON.stringify(profiles));

        // If it was the current profile, logout
        if (currentProfile && currentProfile.name === profileToDelete.name) {
            localStorage.removeItem('ivids-current-profile');
            localStorage.removeItem('ivids-last-route');
        }

        const deleteConfirmModal = document.getElementById('delete-confirm-modal');
        if (deleteConfirmModal) deleteConfirmModal.classList.remove('active');

        const profileModal = document.getElementById('profile-modal');
        if (profileModal) profileModal.classList.remove('active');

        SpatialNav.clearFocusTrap();
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

        deleteConfirmModal.classList.add('active');
        SpatialNav.setFocusTrap(deleteConfirmModal);
        SpatialNav.setFocus(cancelBtn); // Safety first, focus cancel by default

        confirmBtn.onclick = () => deleteProfile(index);
        cancelBtn.onclick = () => {
            deleteConfirmModal.classList.remove('active');
            SpatialNav.clearFocusTrap();
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
        if (pinModal) pinModal.classList.add('active');
        SpatialNav.setFocusTrap(pinModal);
        SpatialNav.setFocus(document.getElementById('pin-digit-1'));

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

    const verifyPin = (profile) => {
        const enteredPin = [1, 2, 3, 4].map(i => document.getElementById(`pin-digit-${i}`).value).join('');
        if (enteredPin === profile.pin) {
            if (pinModal) pinModal.classList.remove('active');
            SpatialNav.clearFocusTrap();
            selectProfile(profile);
        } else {
            document.getElementById('pin-message').textContent = window.i18n.t('profiles.incorrectPin');
            // Clear inputs
            [1, 2, 3, 4].forEach(i => document.getElementById(`pin-digit-${i}`).value = '');
            SpatialNav.setFocus(document.getElementById('pin-digit-1'));
        }
    };

    // Event Handlers for modals
    const profileModal = document.getElementById('profile-modal');
    const pinModal = document.getElementById('pin-modal');

    document.getElementById('save-profile-btn').onclick = saveProfile;
    document.getElementById('cancel-profile-btn').onclick = () => {
        profileModal.classList.remove('active');
        SpatialNav.clearFocusTrap();
    };
    document.getElementById('cancel-pin-btn').onclick = () => {
        pinModal.classList.remove('active');
        SpatialNav.clearFocusTrap();
    };


    document.querySelectorAll('.color-option').forEach(opt => {
        opt.onclick = () => {
            selectedColor = opt.dataset.color;
            updateColorSelection();
        };
    });

    renderProfiles();
};
