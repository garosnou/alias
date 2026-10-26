#!/usr/bin/env node
/**
 * Собирает download/alias.zip — portable-версия для запуска с диска.
 * Запуск из standalone/: npm run zip
 * В архив не входят каталог download/, скрипты сборки, package.json и PLAN.md.
 */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const OUT_DIR = path.join(ROOT, 'download');
const OUT_ZIP = path.join(OUT_DIR, 'alias.zip');

const EXCLUDE_NAMES = new Set([
    'download',
    'scripts',
    'node_modules',
    'PLAN.md',
    'package.json',
    'package-lock.json',
    '.gitignore',
]);

function isExcluded(name) {
    if (EXCLUDE_NAMES.has(name)) return true;
    if (name.startsWith('.ftp-deploy-sync-state')) return true;
    return false;
}

function buildOnWindows() {
    const items = fs
        .readdirSync(ROOT)
        .filter((name) => !isExcluded(name))
        .map((name) => path.join(ROOT, name));
    if (!items.length) throw new Error('Нет файлов для архива');

    if (fs.existsSync(OUT_ZIP)) fs.unlinkSync(OUT_ZIP);

    const psPaths = items.map((p) => `'${p.replace(/'/g, "''")}'`).join(',');
    const psOut = OUT_ZIP.replace(/'/g, "''");
    execSync(
        `powershell -NoProfile -Command "Compress-Archive -LiteralPath @(${psPaths}) -DestinationPath '${psOut}' -CompressionLevel Optimal"`,
        { stdio: 'inherit' }
    );
}

function buildOnUnix() {
    const tmpZip = path.join(OUT_DIR, `.alias-build-${process.pid}.zip`);
    if (fs.existsSync(tmpZip)) fs.unlinkSync(tmpZip);

    const excludes = [
        'download/*',
        'scripts/*',
        'node_modules/*',
        'PLAN.md',
        'package.json',
        'package-lock.json',
        '.gitignore',
        '.ftp-deploy-sync-state*',
    ];
    const xArgs = excludes.map((pattern) => `-x "${pattern}"`).join(' ');
    execSync(`zip -r "${tmpZip}" . ${xArgs}`, {
        cwd: ROOT,
        stdio: 'inherit',
    });

    if (fs.existsSync(OUT_ZIP)) fs.unlinkSync(OUT_ZIP);
    fs.renameSync(tmpZip, OUT_ZIP);
}

fs.mkdirSync(OUT_DIR, { recursive: true });

if (process.platform === 'win32') buildOnWindows();
else buildOnUnix();

const sizeMb = (fs.statSync(OUT_ZIP).size / (1024 * 1024)).toFixed(2);
console.log(`download/alias.zip (${sizeMb} MB)`);
