/**
 * Data Migration Utility for IVIDS.
 * Converted legacy profile layouts and plaintext storage keys into secure,
 * account-specific namespaced storage structures on startup.
 */

async function hashPin(pin) {
    if (!pin) return null;
    try {
        const msgBuffer = new TextEncoder().encode(pin);
        const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    } catch (e) {
        console.error('Migration: Hash calculation failed, keeping plaintext as fallback:', e);
        return pin; // Fallback in case of older WebView environments lacking full Web Crypto support
    }
}

/**
 * Executes database/storage migration from older versions to the namespaced accounts system.
 * Converts legacy profiles to local accounts and namespaces historical data.
 */
export async function runMigration() {
    try {
        const hasMigrated = localStorage.getItem('ivids-migrated-v0.5.0');
        if (hasMigrated) return; // Already migrated

        console.log('Migration: Checking for legacy data...');
        const legacyProfilesStr = localStorage.getItem('ivids-profiles');
        
        let legacyProfiles = null;
        if (legacyProfilesStr) {
            try {
                legacyProfiles = JSON.parse(legacyProfilesStr);
            } catch (e) {
                console.error('Migration: Failed to parse legacy profiles:', e);
            }
        }

        // 1. Convert legacy custom profiles to Accounts
        let accounts = [];
        if (legacyProfiles && Array.isArray(legacyProfiles)) {
            const customProfiles = legacyProfiles.filter(p => p.id !== 'guest' && p.name !== 'Guest');
            
            for (let i = 0; i < customProfiles.length; i++) {
                const p = customProfiles[i];
                const accId = `acc_${Date.now()}_${i}`;
                const hashedPin = await hashPin(p.pin);
                accounts.push({
                    id: accId,
                    name: p.name,
                    color: p.color,
                    pin: hashedPin
                });
            }
        }

        // Fetch legacy global data
        const legacyHistory = localStorage.getItem('recentlyWatched');
        const legacyPlaylists = localStorage.getItem('user_playlists');
        const legacySettings = localStorage.getItem('ivids-settings');

        if (accounts.length > 0) {
            // Migrate legacy data to the first converted custom account
            const firstAccId = accounts[0].id;
            console.log(`Migration: Migrating legacy data to account: ${accounts[0].name} (${firstAccId})`);

            if (legacyHistory) localStorage.setItem(`ivids-acc-${firstAccId}-recentlyWatched`, legacyHistory);
            if (legacyPlaylists) localStorage.setItem(`ivids-acc-${firstAccId}-playlists`, legacyPlaylists);
            if (legacySettings) localStorage.setItem(`ivids-acc-${firstAccId}-settings`, legacySettings);

            // Save new accounts list
            localStorage.setItem('ivids-profiles', JSON.stringify(accounts));
            
            // Set first custom account as active
            localStorage.setItem('ivids-current-profile', JSON.stringify(accounts[0]));
        } else {
            // No custom profiles, migrate global legacy data to anonymous namespace
            console.log('Migration: No custom profiles found. Migrating to anonymous namespace.');
            
            if (legacyHistory) localStorage.setItem('ivids-anon-recentlyWatched', legacyHistory);
            if (legacyPlaylists) localStorage.setItem('ivids-anon-playlists', legacyPlaylists);
            if (legacySettings) localStorage.setItem('ivids-anon-settings', legacySettings);

            // Clean up profiles
            localStorage.removeItem('ivids-profiles');
            localStorage.removeItem('ivids-current-profile');
        }

        // Clean up legacy global keys
        localStorage.removeItem('recentlyWatched');
        localStorage.removeItem('user_playlists');
        localStorage.removeItem('ivids-guest-pos');
        
        // Mark migration as complete
        localStorage.setItem('ivids-migrated-v0.5.0', 'true');
        console.log('Migration: Migration completed successfully.');
    } catch (error) {
        console.error('Migration: Critical migration error:', error);
    }
}
