const fs = require('fs');
const path = require('path');

/**
 * Automatically increments the Android versionCode integer in app/build.gradle.kts by 1.
 * This runs as a pre-build step in build.bat to ensure every generated APK has an 
 * incremented build number (versionCode), allowing Android to perform in-place updates.
 */
function incrementVersionCode() {
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

    fs.writeFileSync(gradlePath, content, 'utf8');
    console.log(`[BUILD PRE-STEP] Automatically incremented Android versionCode to ${newCode} in app/build.gradle.kts`);
}

incrementVersionCode();
