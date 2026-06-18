export const spatialNavLogin = {
    id: 'login',
    /**
     * Returns the default element to focus when entering the login page.
     * Usually the Sign In tab.
     */
    getDefaultFocus: () => document.getElementById('login-signin-tab'),

    /**
     * Determines the next focusable element based on the currently focused element and the navigation direction.
     * Dynamically skips the username field in Sign In mode.
     */
    findNext: (current, direction) => {
        const byId = id => document.getElementById(id);
        const usernameEl = byId('login-username');
        const isUsernameVisible = usernameEl && usernameEl.offsetParent !== null;
        const activeTab = document.querySelector('.login-tab.active') || byId('login-signin-tab');
        const circleBackEl = byId('login-circle-back');
        const isCircleBackVisible = circleBackEl && circleBackEl.offsetParent !== null;

        if (current.id === 'login-circle-back') {
            if (direction === 'right' || direction === 'down') return activeTab;
            return null;
        }

        if (current.id === 'login-signin-tab') {
            if (direction === 'right') return byId('login-register-tab');
            if (direction === 'left' || direction === 'up') {
                return isCircleBackVisible ? circleBackEl : null;
            }
            if (direction === 'down') return byId('login-email');
        }

        if (current.id === 'login-register-tab') {
            if (direction === 'left') return byId('login-signin-tab');
            if (direction === 'up') {
                return isCircleBackVisible ? circleBackEl : null;
            }
            if (direction === 'down') return byId('login-email');
        }

        if (current.id === 'login-email' && direction === 'up') return activeTab;
        if (current.id === 'login-email' && direction === 'down') {
            return isUsernameVisible ? usernameEl : byId('login-pin');
        }

        if (current.id === 'login-username' && direction === 'up') return byId('login-email');
        if (current.id === 'login-username' && direction === 'down') return byId('login-pin');

        if (current.id === 'login-pin') {
            if (direction === 'up') return isUsernameVisible ? usernameEl : byId('login-email');
            if (direction === 'down') return byId('login-submit');
        }

        if (current.id === 'login-submit') {
            if (direction === 'up') return byId('login-pin');
            if (direction === 'down') return byId('login-back');
        }

        if (current.id === 'login-back') {
            if (direction === 'up') return byId('login-submit');
        }

        return null;
    }
};
