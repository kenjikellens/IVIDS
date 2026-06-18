const FIREBASE_CONFIG = {
    databaseURL: 'https://spreadsheet-95159-default-rtdb.europe-west1.firebasedatabase.app'
};

let _cachedKey = null;

const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

export function bytesToHex(buf) {
    return Array.from(new Uint8Array(buf))
        .map(byte => byte.toString(16).padStart(2, '0'))
        .join('');
}

export function hexToBytes(hex) {
    if (!/^[0-9a-f]*$/i.test(hex) || hex.length % 2 !== 0) {
        throw new Error('Invalid hex value');
    }
    const bytes = new Uint8Array(hex.length / 2);
    for (let i = 0; i < bytes.length; i++) {
        bytes[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
    }
    return bytes;
}

export function generateSalt() {
    const salt = window.crypto.getRandomValues(new Uint8Array(16));
    return bytesToHex(salt);
}

export async function deriveKey(email, pin, saltHex) {
    const password = textEncoder.encode(`${email.trim().toLowerCase()}${pin}`);
    const salt = hexToBytes(saltHex);
    const keyMaterial = await window.crypto.subtle.importKey(
        'raw',
        password,
        'PBKDF2',
        false,
        ['deriveKey']
    );

    return window.crypto.subtle.deriveKey(
        { name: 'PBKDF2', salt, iterations: 100000, hash: 'SHA-256' },
        keyMaterial,
        { name: 'AES-GCM', length: 256 },
        false,
        ['encrypt', 'decrypt']
    );
}

export async function encrypt(key, plaintext) {
    const iv = window.crypto.getRandomValues(new Uint8Array(12));
    const encoded = textEncoder.encode(plaintext);
    const ciphertext = await window.crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, encoded);
    return { iv: bytesToHex(iv), ct: bytesToHex(ciphertext) };
}

export async function decrypt(key, ivHex, ctHex) {
    const iv = hexToBytes(ivHex);
    const ciphertext = hexToBytes(ctHex);
    const decrypted = await window.crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, ciphertext);
    return textDecoder.decode(decrypted);
}

async function firebaseJson(path, options = {}) {
    const response = await fetch(`${FIREBASE_CONFIG.databaseURL}${path}`, options);
    if (!response.ok) {
        throw new Error(`Firebase request failed: ${response.status}`);
    }
    return response.json();
}

function isValidRecord(record) {
    return Boolean(
        record &&
        typeof record.salt === 'string' &&
        record.user &&
        typeof record.user.iv === 'string' &&
        typeof record.user.ct === 'string' &&
        record.info &&
        typeof record.info.iv === 'string' &&
        typeof record.info.ct === 'string'
    );
}

function getDefaultInfo(username) {
    return {
        profile: {
            name: username,
            color: '#E50914'
        },
        settings: {
            accentColor: '#46d369',
            language: 'en'
        },
        playlists: [],
        recentlyWatched: [],
        watchProgress: {}
    };
}

export async function fetchAllUsers() {
    const records = await firebaseJson('/users.json');
    return records || {};
}

export async function login(email, username, pin) {
    const normalizedEmail = email.trim().toLowerCase();
    const normalizedUsername = username.trim();
    const records = await fetchAllUsers();

    for (const [pushId, record] of Object.entries(records)) {
        if (!isValidRecord(record)) continue;

        try {
            const key = await deriveKey(normalizedEmail, pin, record.salt);
            const decryptedUser = await decrypt(key, record.user.iv, record.user.ct);

            if (decryptedUser === normalizedUsername) {
                const decryptedInfo = await decrypt(key, record.info.iv, record.info.ct);
                const info = JSON.parse(decryptedInfo);
                _cachedKey = key;
                return { success: true, info, pushId, key };
            }
        } catch (error) {
            continue;
        }
    }

    return { success: false };
}

export async function register(email, username, pin) {
    const normalizedEmail = email.trim().toLowerCase();
    const normalizedUsername = username.trim();
    const duplicate = await login(normalizedEmail, normalizedUsername, pin);

    if (duplicate.success) {
        return { success: false, reason: 'already_registered' };
    }

    const saltHex = generateSalt();
    const key = await deriveKey(normalizedEmail, pin, saltHex);
    const userBlob = await encrypt(key, normalizedUsername);
    const info = getDefaultInfo(normalizedUsername);
    const infoBlob = await encrypt(key, JSON.stringify(info));

    const result = await firebaseJson('/users.json', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ salt: saltHex, user: userBlob, info: infoBlob })
    });

    if (!result || !result.name) {
        throw new Error('Firebase did not return a push id');
    }

    _cachedKey = key;
    return { success: true, pushId: result.name, key, info };
}

export async function syncInfo(pushId, key, info) {
    if (!pushId || !key) {
        throw new Error('Missing cloud session key');
    }

    const infoBlob = await encrypt(key, JSON.stringify(info));
    await firebaseJson(`/users/${encodeURIComponent(pushId)}/info.json`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(infoBlob)
    });
}

export function getCachedKey() {
    return _cachedKey;
}

export function clearSession() {
    _cachedKey = null;
    localStorage.removeItem('ivids-cloud-session');
}
