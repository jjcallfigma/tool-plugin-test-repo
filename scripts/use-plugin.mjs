#!/usr/bin/env node
import fs from 'fs';
import { writeActiveSlug, resolvePluginRoot, pluginDir, isValidSlug } from './lib/plugin-paths.mjs';

function usage() {
  console.log(`Usage: npm run use-plugin -- <slug|comparison>

Sets the active plugin target for Cursor generation.

  npm run use-plugin -- org-chart     # write to plugins/org-chart/
  npm run use-plugin -- comparison    # write to template/ (GenTool comparison harness)
`);
}

const target = process.argv[2];

if (!target) {
  usage();
  process.exit(1);
}

if (target === 'comparison' || target === 'template') {
  writeActiveSlug(null);
  const { root, manifest } = resolvePluginRoot();
  console.log(`Active target: comparison harness`);
  console.log(`  Folder:   ${root}`);
  console.log(`  Manifest: ${manifest}`);
  process.exit(0);
}

if (!isValidSlug(target)) {
  console.error(`Invalid slug "${target}".`);
  usage();
  process.exit(1);
}

const dir = pluginDir(target);
if (!fs.existsSync(dir)) {
  console.error(`Plugin not found: ${dir}`);
  console.error(`Create it with: npm run new-plugin -- ${target}`);
  process.exit(1);
}

writeActiveSlug(target);
const { root, manifest } = resolvePluginRoot();
console.log(`Active target: ${target}`);
console.log(`  Folder:   ${root}`);
console.log(`  Manifest: ${manifest}`);
