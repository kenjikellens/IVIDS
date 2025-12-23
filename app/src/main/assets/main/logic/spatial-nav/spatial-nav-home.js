export const spatialNavHome = {
    id: 'home',
    findNext: (current, direction) => {
        // Navigation hierarchy: prevent direct jump from content to navbar
        // Content rows → Hero section → Navbar
        if (direction === 'up') {
            const currentInContent = current.closest('.row-posters') !== null;

            // If navigating UP from content sections, block navbar elements
            // This forces navigation to stop at hero section first
            if (currentInContent) {
                // Return null to let the default logic handle it with filtering
                // or we could implement specific logic here.
            }
        }
        return null;
    }
};
