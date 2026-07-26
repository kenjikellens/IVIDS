/**
 * update-file-list.js — Scans the project for important source files and updates docs/file_list.md.
 *
 * Run with: node docs/update-file-list.js
 *
 * Only includes relevant source files (.js, .html, .css, .json, .svg, .xml, .png, .ico, .webp, .bat, .kts, .java, .py).
 * Excludes build output, node_modules, gradle caches, and non-essential directories.
 */

const fs = require('fs');
const path = require('path');

/** Root of the project (one level up from docs/) */
const PROJECT_ROOT = path.resolve(__dirname, '..');

/** Extensions to include in the file list */
const ALLOWED_EXTENSIONS = new Set([
    '.js', '.html', '.css', '.json', '.svg', '.xml',
    '.png', '.ico', '.webp', '.bat', '.kts', '.java', '.py', '.md'
]);

/** Directory names to skip entirely */
const EXCLUDED_DIRS = new Set([
    'node_modules', '.gradle', '.idea', 'build', '.git',
    '.agents', 'docs', 'mockup', 'mipmap-anydpi-v26',
    'mipmap-hdpi', 'mipmap-mdpi', 'mipmap-xhdpi',
    'mipmap-xxhdpi', 'mipmap-xxxhdpi'
]);

/** Specific root-level files to always include */
const ROOT_FILES = [
    'build.bat',
    'build.gradle.kts',
    'settings.gradle.kts',
    'run_pc.py'
];

/**
 * Recursively walks a directory and collects file paths matching allowed extensions.
 * @param {string} dir - Absolute path to scan.
 * @param {string[]} results - Accumulator array for matched file paths.
 * @returns {string[]} The accumulated file paths.
 */
function walkDir(dir, results = []) {
    let entries;
    try {
        entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch (e) {
        return results;
    }

    for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);

        if (entry.isDirectory()) {
            if (EXCLUDED_DIRS.has(entry.name)) continue;
            walkDir(fullPath, results);
        } else if (entry.isFile()) {
            const ext = path.extname(entry.name).toLowerCase();
            if (ALLOWED_EXTENSIONS.has(ext)) {
                results.push(fullPath);
            }
        }
    }

    return results;
}

// 1. Collect files from app/ directory
const appDir = path.join(PROJECT_ROOT, 'app');
const files = walkDir(appDir);

// 2. Add root-level files if they exist
for (const rootFile of ROOT_FILES) {
    const fullPath = path.join(PROJECT_ROOT, rootFile);
    if (fs.existsSync(fullPath)) {
        files.push(fullPath);
    }
}

// 3. Convert to relative paths and sort
const relativePaths = files
    .map(f => path.relative(PROJECT_ROOT, f).replace(/\\/g, '/'))
    .sort();

// 4. Write to docs/file_list.md
const outputPath = path.join(PROJECT_ROOT, 'docs', 'file_list.md');
const content = relativePaths.join('\n') + '\n';

fs.writeFileSync(outputPath, content, 'utf-8');
console.log(`file_list.md updated with ${relativePaths.length} files.`);
