#!/usr/bin/env node
/**
 * Сканирует standalone/bg и записывает manifest.json со списком картинок для экрана зала.
 * Запуск: node scripts/gen-bg-manifest.js
 */
const fs = require('fs');
const path = require('path');

const BG_DIR = path.join(__dirname, '..', 'standalone', 'bg');
const MANIFEST = path.join(BG_DIR, 'manifest.json');
const IMAGE_EXT = new Set(['.jpg', '.jpeg', '.png', '.webp', '.gif', '.avif', '.bmp']);

if (!fs.existsSync(BG_DIR)) {
    fs.mkdirSync(BG_DIR, { recursive: true });
}

const files = fs
    .readdirSync(BG_DIR)
    .filter((name) => {
        if (name === 'manifest.json' || name === 'manifest.js') return false;
        return IMAGE_EXT.has(path.extname(name).toLowerCase());
    })
    .sort((a, b) => a.localeCompare(b, 'ru'));

fs.writeFileSync(MANIFEST, JSON.stringify(files, null, 2) + '\n', 'utf8');

const manifestJs = path.join(BG_DIR, 'manifest.js');
const jsBody =
    '// Список картинок в папке bg для экрана зала (можно править в блокноте).\n' +
    '// Пересобрать автоматически: node scripts/gen-bg-manifest.js\n' +
    'window.ALIAS_BG_MANIFEST = ' +
    JSON.stringify(files, null, 4) +
    ';\n';
fs.writeFileSync(manifestJs, jsBody, 'utf8');

console.log('bg/manifest.json + manifest.js:', files.length ? files.join(', ') : '(пусто — экран зала без фона)');
