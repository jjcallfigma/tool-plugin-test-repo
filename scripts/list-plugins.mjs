#!/usr/bin/env node
import fs from 'fs';
import { pluginsRoot, readActiveSlug, resolvePluginRoot, templateRoot } from './lib/plugin-paths.mjs';

const active = readActiveSlug();
const { mode } = resolvePluginRoot();

console.log(`Active: ${mode === 'comparison' ? 'comparison (template/)' : active}`);
console.log('');

if (!fs.existsSync(pluginsRoot)) {
  console.log('No plugins/ folder yet. Create one with: npm run new-plugin -- <slug>');
  process.exit(0);
}

const entries = fs
  .readdirSync(pluginsRoot, { withFileTypes: true })
  .filter((e) => e.isDirectory())
  .map((e) => e.name)
  .sort();

if (!entries.length) {
  console.log('No plugins yet. Create one with: npm run new-plugin -- <slug>');
} else {
  console.log('Plugins:');
  for (const slug of entries) {
    const marker = slug === active ? ' *' : '';
    let name = slug;
    try {
      const manifest = JSON.parse(
        fs.readFileSync(`${pluginsRoot}/${slug}/manifest.json`, 'utf8'),
      );
      name = manifest.name || slug;
    } catch {
      name = slug;
    }
    console.log(`  ${slug}${marker}  (${name})`);
  }
}

console.log('');
console.log(`Comparison harness: ${templateRoot}/  (npm run use-plugin -- comparison)`);
