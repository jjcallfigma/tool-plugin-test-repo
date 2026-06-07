#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import {
  repoRoot,
  templateRoot,
  scaffoldSrc,
  pluginDir,
  isValidSlug,
  titleFromSlug,
  writeActiveSlug,
} from './lib/plugin-paths.mjs';

const INFRA_FILES = ['package.json', 'tsconfig.json'];
const INFRA_DIRS = ['scripts'];

function parseArgs(argv) {
  const args = { slug: null, name: null, from: 'scaffold' };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--name' && argv[i + 1]) {
      args.name = argv[++i];
    } else if (arg === '--from' && argv[i + 1]) {
      args.from = argv[++i];
    } else if (!arg.startsWith('-') && !args.slug) {
      args.slug = arg;
    }
  }
  return args;
}

function copyDir(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const from = path.join(src, entry.name);
    const to = path.join(dest, entry.name);
    if (entry.isDirectory()) copyDir(from, to);
    else fs.copyFileSync(from, to);
  }
}

function copyFileIfExists(src, dest) {
  if (!fs.existsSync(src)) return;
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.copyFileSync(src, dest);
}

function usage() {
  console.log(`Usage: npm run new-plugin -- <slug> [--name "Display Name"] [--from scaffold|template]

Creates plugins/<slug>/ with a unique manifest, empty src (or copies template/src), npm install, and build.
Sets plugins/.active so Cursor writes to the new plugin until you switch.

Examples:
  npm run new-plugin -- org-chart
  npm run new-plugin -- bento-grid --name "Bento Grid"
  npm run new-plugin -- org-chart --from template   # seed from current comparison plugin src
`);
}

const { slug, name, from } = parseArgs(process.argv.slice(2));

if (!slug) {
  usage();
  process.exit(1);
}

if (!isValidSlug(slug)) {
  console.error(`Invalid slug "${slug}". Use lowercase letters, numbers, and hyphens (e.g. org-chart).`);
  process.exit(1);
}

const destRoot = pluginDir(slug);
if (fs.existsSync(destRoot)) {
  console.error(`Plugin already exists: ${destRoot}`);
  console.error(`Switch to it with: npm run use-plugin -- ${slug}`);
  process.exit(1);
}

const displayName = name || titleFromSlug(slug);
const manifestId = slug;

fs.mkdirSync(destRoot, { recursive: true });

for (const file of INFRA_FILES) {
  copyFileIfExists(path.join(templateRoot, file), path.join(destRoot, file));
}

for (const dir of INFRA_DIRS) {
  copyDir(path.join(templateRoot, dir), path.join(destRoot, dir));
}

copyFileIfExists(path.join(templateRoot, 'package-lock.json'), path.join(destRoot, 'package-lock.json'));

const manifest = {
  name: displayName,
  id: manifestId,
  api: '1.0.0',
  main: 'src/code.js',
  ui: 'src/ui.html',
  editorType: ['figma'],
  networkAccess: {
    allowedDomains: ['*'],
    reasoning:
      'Generated tools may call public open HTTP APIs that do not require API keys or user authentication.',
  },
  documentAccess: 'dynamic-page',
  relaunchButtons: [
    { command: 'regenerate', name: 'Regenerate', multipleSelection: false },
    { command: 'edit', name: 'Edit', multipleSelection: false },
  ],
};

fs.writeFileSync(path.join(destRoot, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');

const destSrc = path.join(destRoot, 'src');
const sourceSrc = from === 'template' ? path.join(templateRoot, 'src') : scaffoldSrc;

if (!fs.existsSync(sourceSrc)) {
  console.error(`Missing source folder: ${sourceSrc}`);
  process.exit(1);
}

copyDir(sourceSrc, destSrc);

const pkgPath = path.join(destRoot, 'package.json');
if (fs.existsSync(pkgPath)) {
  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
  pkg.name = `plugin-${slug}`;
  pkg.description = `${displayName} — Figma plugin`;
  fs.writeFileSync(pkgPath, `${JSON.stringify(pkg, null, 2)}\n`, 'utf8');
}

console.log(`Creating plugin "${displayName}" at plugins/${slug}/ ...`);
execSync('npm install', { cwd: destRoot, stdio: 'inherit' });
execSync('npm run build', { cwd: destRoot, stdio: 'inherit' });

writeActiveSlug(slug);

const manifestPath = path.join(destRoot, 'manifest.json');
console.log('');
console.log('Plugin ready.');
console.log(`  Folder:   plugins/${slug}/`);
console.log(`  Active:   plugins/.active → ${slug}`);
console.log(`  Manifest: ${manifestPath}`);
console.log('');
console.log('Next in Figma:');
console.log('  Plugins → Development → Import plugin from manifest');
console.log(`  Select: ${manifestPath}`);
console.log(`  Run as: ${displayName}`);
console.log('');
console.log('In Cursor, build with the same docs/rules/skills. Writes go to plugins/' + slug + '/src/.');
console.log('Switch plugins: npm run use-plugin -- <slug>');
console.log('Comparison harness: npm run use-plugin -- comparison');
