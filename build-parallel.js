const { spawn } = require('child_process');

const buildType = process.argv[2] === 'release' ? 'release' : 'debug';

console.log(`[INFO] Launching Windows EXE and Android APK builds simultaneously (${buildType} mode)...`);

const winCmd = process.platform === 'win32' ? 'npx.cmd' : 'npx';
const winArgs = ['electron-builder'];

const gradleCmd = process.platform === 'win32' ? 'gradlew.bat' : './gradlew';
const gradleTask = buildType === 'release' ? 'assembleRelease' : 'assembleDebug';

function runProcess(cmd, args, name) {
    return new Promise((resolve, reject) => {
        const proc = spawn(cmd, args, { stdio: 'inherit', shell: true });
        proc.on('close', (code) => {
            if (code === 0) {
                console.log(`[OK] ${name} completed successfully.`);
                resolve();
            } else {
                reject(new Error(`${name} failed with exit code ${code}`));
            }
        });
        proc.on('error', (err) => reject(err));
    });
}

Promise.all([
    runProcess(winCmd, winArgs, 'Windows (Electron) Build'),
    runProcess(gradleCmd, [gradleTask], 'Android (APK) Build')
]).then(() => {
    console.log('[OK] Simultaneous builds completed successfully.');
    process.exit(0);
}).catch((err) => {
    console.error(`[ERROR] Simultaneous build failed: ${err.message}`);
    process.exit(1);
});
