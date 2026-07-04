#!/usr/bin/env node
/**
 * Собирает standalone/download/alias.zip — portable-версия для скачивания.
 * Запуск: node scripts/build-standalone-zip.js
 */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const STANDALONE = path.join(__dirname, '..', 'standalone');
const OUT_DIR = path.join(STANDALONE, 'download');
const OUT_ZIP = path.join(OUT_DIR, 'alias.zip');
const EXCLUDE = new Set(['download', 'PLAN.md']);

function buildOnWindows() {
    const items = fs
        .readdirSync(STANDALONE)
        .filter((name) => !EXCLUDE.has(name))
        .map((name) => path.join(STANDALONE, name));
    if (!items.length) throw new Error('Нет файлов для архива standalone');

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

    execSync(`zip -r "${tmpZip}" . -x "download/*" -x "PLAN.md"`, {
        cwd: STANDALONE,
        stdio: 'inherit',
    });

    if (fs.existsSync(OUT_ZIP)) fs.unlinkSync(OUT_ZIP);
    fs.renameSync(tmpZip, OUT_ZIP);
}

fs.mkdirSync(OUT_DIR, { recursive: true });

if (process.platform === 'win32') buildOnWindows();
else buildOnUnix();

const sizeMb = (fs.statSync(OUT_ZIP).size / (1024 * 1024)).toFixed(2);
console.log(`standalone/download/alias.zip (${sizeMb} MB)`);
