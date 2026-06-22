const FIREBASE_CONFIG = {
    databaseURL: 'https://spreadsheet-95159-default-rtdb.europe-west1.firebasedatabase.app'
};

let _cachedKey = null;

const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

// Pre-generated Lookup Table (LUT) to avoid array allocations during bytesToHex
const byteToHexLUT = [];
for (let i = 0; i < 256; i++) {
    byteToHexLUT.push(i.toString(16).padStart(2, '0'));
}

export function bytesToHex(buf) {
    const bytes = new Uint8Array(buf);
    let hex = '';
    for (let i = 0; i < bytes.length; i++) {
        hex += byteToHexLUT[bytes[i]];
    }
    return hex;
}

/**
 * Generates a SHA-256 hash of the normalized email to use as a secure, unique Firebase path.
 * @param {string} email
 * @returns {Promise<string>}
 */
async function getEmailHash(email) {
    const msgBuffer = textEncoder.encode(email.trim().toLowerCase());
    const hashBuffer = await window.crypto.subtle.digest('SHA-256', msgBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    let hex = '';
    for (let i = 0; i < hashArray.length; i++) {
        hex += byteToHexLUT[hashArray[i]];
    }
    return hex;
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

export async function login(email, username, pin) {
    const normalizedEmail = email.trim().toLowerCase();
    const normalizedUsername = username ? username.trim() : '';
    const emailHash = await getEmailHash(normalizedEmail);

    try {
        const record = await firebaseJson(`/users/${emailHash}.json`);
        if (!record || !isValidRecord(record)) {
            return { success: false };
        }

        const key = await deriveKey(normalizedEmail, pin, record.salt);
        const decryptedUser = await decrypt(key, record.user.iv, record.user.ct);

        if (!normalizedUsername || decryptedUser === normalizedUsername) {
            const decryptedInfo = await decrypt(key, record.info.iv, record.info.ct);
            const info = JSON.parse(decryptedInfo);
            _cachedKey = key;
            return { success: true, info, pushId: emailHash, key, username: decryptedUser };
        }
    } catch (error) {
        // Fall through to failure on validation/decryption error
    }

    return { success: false };
}

export async function register(email, username, pin) {
    const normalizedEmail = email.trim().toLowerCase();
    const normalizedUsername = username.trim();
    
    // Check duplication by checking if we can log in with this email hash
    const duplicate = await login(normalizedEmail, normalizedUsername, pin);
    if (duplicate.success) {
        return { success: false, reason: 'already_registered' };
    }

    const saltHex = generateSalt();
    const key = await deriveKey(normalizedEmail, pin, saltHex);
    const userBlob = await encrypt(key, normalizedUsername);
    const info = getDefaultInfo(normalizedUsername);
    const infoBlob = await encrypt(key, JSON.stringify(info));

    const emailHash = await getEmailHash(normalizedEmail);
    await firebaseJson(`/users/${emailHash}.json`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ salt: saltHex, user: userBlob, info: infoBlob })
    });

    _cachedKey = key;
    return { success: true, pushId: emailHash, key, info };
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
