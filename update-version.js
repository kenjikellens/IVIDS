const fs = require('fs');
const path = require('path');

/**
 * Main function that orchestrates the version updates in package.json, package-lock.json,
 * and app/build.gradle.kts, and appends a corresponding log entry to CHANGELOG.md.
 */
function main() {
    const args = process.argv.slice(2);
    if (args.length < 1) {
        console.error('Error: Please specify the version (e.g. 0.4.4 or v0.4.4)');
        process.exit(1);
    }

    const versionArg = args[0].trim();
    const versionMatch = versionArg.match(/^v?(\d+\.\d+\.\d+)$/);
    if (!versionMatch) {
        console.error('Error: Invalid version format. Must be X.Y.Z or vX.Y.Z');
        process.exit(1);
    }

    const cleanVersion = versionMatch[1];
    const displayVersion = 'v' + cleanVersion;

    updatePackageJson(cleanVersion);
    updatePackageLockJson(cleanVersion);
    updateTizenConfig(cleanVersion);
    const newVersionCode = updateGradleConfig(displayVersion);
    writeChangelog(displayVersion, newVersionCode);

    console.log(`Successfully updated project to version ${displayVersion} (versionCode: ${newVersionCode})`);
}

/**
 * Updates the version field in the package.json file.
 * @param {string} version - The clean version string (e.g. "0.4.4").
 */
function updatePackageJson(version) {
    const pkgPath = path.join(__dirname, 'package.json');
    if (!fs.existsSync(pkgPath)) {
        console.error('Error: package.json not found in workspace root.');
        process.exit(1);
    }
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
    pkg.version = version;
    fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n', 'utf8');
    console.log(`Updated package.json version to ${version}`);
}

/**
 * Updates the version fields in the package-lock.json file.
 * @param {string} version - The clean version string (e.g. "0.4.4").
 */
function updatePackageLockJson(version) {
    const lockPath = path.join(__dirname, 'package-lock.json');
    if (!fs.existsSync(lockPath)) {
        console.warn('Warning: package-lock.json not found.');
        return;
    }
    const lock = JSON.parse(fs.readFileSync(lockPath, 'utf8'));
    lock.version = version;
    if (lock.packages && lock.packages['']) {
        lock.packages[''].version = version;
    }
    fs.writeFileSync(lockPath, JSON.stringify(lock, null, 2) + '\n', 'utf8');
    console.log(`Updated package-lock.json version to ${version}`);
}

/**
 * Updates versionName and increments versionCode in app/build.gradle.kts.
 * @param {string} versionName - The version string with 'v' prefix (e.g. "v0.4.4").
 * @returns {number} The new versionCode.
 */
function updateGradleConfig(versionName) {
    const gradlePath = path.join(__dirname, 'app', 'build.gradle.kts');
    if (!fs.existsSync(gradlePath)) {
        console.error('Error: app/build.gradle.kts not found.');
        process.exit(1);
    }
    let content = fs.readFileSync(gradlePath, 'utf8');

    const versionCodeRegex = /(versionCode\s*=\s*)(\d+)/;
    const codeMatch = content.match(versionCodeRegex);
    if (!codeMatch) {
        console.error('Error: Could not find versionCode in app/build.gradle.kts');
        process.exit(1);
    }

    const oldCode = parseInt(codeMatch[2], 10);
    const newCode = oldCode + 1;
    content = content.replace(versionCodeRegex, `$1${newCode}`);

    const versionNameRegex = /(versionName\s*=\s*)"([^"]+)"/;
    if (!content.match(versionNameRegex)) {
        console.error('Error: Could not find versionName in app/build.gradle.kts');
        process.exit(1);
    }
    content = content.replace(versionNameRegex, `$1"${versionName}"`);

    fs.writeFileSync(gradlePath, content, 'utf8');
    console.log(`Updated app/build.gradle.kts: versionName = "${versionName}", versionCode = ${newCode}`);
    return newCode;
}

/**
 * Appends the standard changelog hooks to CHANGELOG.md.
 * @param {string} versionName - The version string (e.g. "v0.4.4").
 * @param {number} versionCode - The incremented versionCode number.
 */
function writeChangelog(versionName, versionCode) {
    const changelogPath = path.join(__dirname, 'CHANGELOG.md');
    const now = new Date();
    const hh = String(now.getHours()).padStart(2, '0');
    const mm = String(now.getMinutes()).padStart(2, '0');
    const dd = String(now.getDate()).padStart(2, '0');
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const yyyy = now.getFullYear();
    const timestamp = `[${hh}:${mm} ${dd}-${month}-${yyyy}]`;

    const entry = `${timestamp} app/build.gradle.kts - Bumped versionName to ${versionName} and incremented versionCode to ${versionCode}.\n`;

    fs.appendFileSync(changelogPath, entry, 'utf8');
    console.log(`Appended change log hook to CHANGELOG.md`);
}

/**
 * Updates the version attribute in the widget element of Tizen config.xml files.
 * @param {string} version - The clean version string (e.g. "0.4.4").
 */
function updateTizenConfig(version) {
    const configPaths = [
        path.join(__dirname, 'app', 'src', 'main', 'config.xml'),
        path.join(__dirname, 'app', 'src', 'main', 'assets', 'main', 'config.xml')
    ];

    configPaths.forEach(configPath => {
        if (!fs.existsSync(configPath)) {
            console.warn(`Warning: Tizen config not found at ${configPath}`);
            return;
        }
        let content = fs.readFileSync(configPath, 'utf8');
        
        const widgetVersionRegex = /(<widget[^>]+version=")([^"]+)("[^>]*>)/;
        if (content.match(widgetVersionRegex)) {
            content = content.replace(widgetVersionRegex, `$1${version}$3`);
            fs.writeFileSync(configPath, content, 'utf8');
            console.log(`Updated Tizen config version to ${version} in ${path.relative(__dirname, configPath)}`);
        } else {
            console.error(`Error: Could not find version attribute in widget tag of ${configPath}`);
        }
    });
}

main();
