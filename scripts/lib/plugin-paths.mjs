import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

export const repoRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
export const templateRoot = path.join(repoRoot, 'template');
export const scaffoldSrc = path.join(repoRoot, 'scaffold', 'src');
export const pluginsRoot = path.join(repoRoot, 'plugins');
export const activeFile = path.join(pluginsRoot, '.active');

const SLUG_RE = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/;

export function isValidSlug(slug) {
  return SLUG_RE.test(slug);
}

export function titleFromSlug(slug) {
  return slug
    .split('-')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

export function readActiveSlug() {
  if (!fs.existsSync(activeFile)) return null;
  const slug = fs.readFileSync(activeFile, 'utf8').trim();
  if (!slug || slug === 'comparison' || slug === 'template') return null;
  return slug;
}

export function writeActiveSlug(slug) {
  fs.mkdirSync(pluginsRoot, { recursive: true });
  if (!slug || slug === 'comparison' || slug === 'template') {
    if (fs.existsSync(activeFile)) fs.unlinkSync(activeFile);
    return null;
  }
  if (!isValidSlug(slug)) {
    throw new Error(`Invalid plugin slug: ${slug}`);
  }
  fs.writeFileSync(activeFile, `${slug}\n`, 'utf8');
  return slug;
}

export function pluginDir(slug) {
  return path.join(pluginsRoot, slug);
}

export function resolvePluginRoot() {
  const slug = readActiveSlug();
  if (slug) {
    const dir = pluginDir(slug);
    if (!fs.existsSync(dir)) {
      throw new Error(`Active plugin "${slug}" not found at ${dir}. Run: npm run new-plugin ${slug}`);
    }
    return { mode: 'plugin', slug, root: dir, manifest: path.join(dir, 'manifest.json') };
  }
  return {
    mode: 'comparison',
    slug: null,
    root: templateRoot,
    manifest: path.join(templateRoot, 'manifest.json'),
  };
}
