/**
 * validate-build-integrity.js
 * ============================
 * Automated pre-build gatekeeper script.
 * Validates 100% version synchronization across package.json, package-lock.json,
 * app/build.gradle.kts, and Tizen config.xml files, and scans GUI files for
 * legacy hardcoded version literals before any compilation is permitted to start.
 */

const fs = require('fs');
const path = require('path');

/**
 * Main execution method for build integrity validation.
 */
function main() {
    console.log('\n===================================================');
    console.log('       IVIDS BUILD INTEGRITY GATEKEEPER');
    console.log('===================================================');

    let errors = [];

    // 1. Read package.json version as baseline
    const pkgPath = path.join(__dirname, 'package.json');
    if (!fs.existsSync(pkgPath)) {
        console.error('[FAIL] package.json not found in workspace root.');
        process.exit(1);
    }

    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
    const baseVersion = pkg.version;
    const baseDisplayVersion = 'v' + baseVersion;

    console.log(`[INFO] Baseline target version: ${baseDisplayVersion} (${baseVersion})`);

    // 2. Validate package-lock.json
    const lockPath = path.join(__dirname, 'package-lock.json');
    if (fs.existsSync(lockPath)) {
        const lock = JSON.parse(fs.readFileSync(lockPath, 'utf8'));
        if (lock.version !== baseVersion) {
            errors.push(`package-lock.json version mismatch: expected "${baseVersion}", found "${lock.version}"`);
        }
        if (lock.packages && lock.packages[''] && lock.packages[''].version !== baseVersion) {
            errors.push(`package-lock.json packages[''] version mismatch: expected "${baseVersion}", found "${lock.packages[''].version}"`);
        }
    }

    // 3. Validate app/build.gradle.kts
    const gradlePath = path.join(__dirname, 'app', 'build.gradle.kts');
    if (fs.existsSync(gradlePath)) {
        const gradleContent = fs.readFileSync(gradlePath, 'utf8');
        const match = gradleContent.match(/versionName\s*=\s*"([^"]+)"/);
        if (!match) {
            errors.push('app/build.gradle.kts does not define a valid versionName');
        } else if (match[1] !== baseDisplayVersion && match[1] !== baseVersion) {
            errors.push(`app/build.gradle.kts versionName mismatch: expected "${baseDisplayVersion}", found "${match[1]}"`);
        }
    } else {
        errors.push('app/build.gradle.kts not found');
    }

    // 4. Validate Tizen config.xml files
    const configPaths = [
        path.join(__dirname, 'app', 'src', 'main', 'config.xml'),
        path.join(__dirname, 'app', 'src', 'main', 'assets', 'main', 'config.xml')
    ];

    configPaths.forEach(cfgPath => {
        if (fs.existsSync(cfgPath)) {
            const content = fs.readFileSync(cfgPath, 'utf8');
            const match = content.match(/<widget[^>]+version="([^"]+)"/);
            if (!match) {
                errors.push(`Widget version attribute missing in ${path.relative(__dirname, cfgPath)}`);
            } else if (match[1] !== baseVersion) {
                errors.push(`Tizen config version mismatch in ${path.relative(__dirname, cfgPath)}: expected "${baseVersion}", found "${match[1]}"`);
            }
        } else {
            errors.push(`Config file missing: ${path.relative(__dirname, cfgPath)}`);
        }
    });

    // 5. Scan GUI HTML/JS files for legacy hardcoded strings
    const guiDir = path.join(__dirname, 'app', 'src', 'main', 'assets', 'main', 'gui');
    const legacyPatterns = [
        { regex: /app-version-display[^>]*>v\d+\.\d+\.\d+</i, name: 'Hardcoded initial HTML version in app-version-display' },
        { regex: /return\s+['"]v0\.[0-5]\.\d+['"]/g, name: 'Legacy hardcoded fallback return in JS' }
    ];

    function scanDir(dir) {
        if (!fs.existsSync(dir)) return;
        const entries = fs.readdirSync(dir, { withFileTypes: true });
        for (const entry of entries) {
            const fullPath = path.join(dir, entry.name);
            if (entry.isDirectory()) {
                scanDir(fullPath);
            } else if (entry.name.endsWith('.js') || entry.name.endsWith('.html')) {
                const content = fs.readFileSync(fullPath, 'utf8');
                legacyPatterns.forEach(pattern => {
                    if (pattern.regex.test(content)) {
                        errors.push(`Legacy hardcoded version pattern found in ${path.relative(__dirname, fullPath)}: ${pattern.name}`);
                    }
                });
            }
        }
    }
    scanDir(guiDir);

    // Final Gate Evaluation
    if (errors.length > 0) {
        console.error('\n[GATEKEEPER BLOCKED BUILD] The following version discrepancies were detected:');
        errors.forEach((err, idx) => console.error(`  ${idx + 1}. ${err}`));
        console.error('\nRun "build.bat version vX.Y.Z" to automatically synchronize all targets.\n');
        process.exit(1);
    }

    console.log('[GATEKEEPER PASSED] All targets 100% synchronized.');
    console.log('===================================================\n');
    process.exit(0);
}

main();
