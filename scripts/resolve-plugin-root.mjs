#!/usr/bin/env node
import { resolvePluginRoot } from './lib/plugin-paths.mjs';

const target = resolvePluginRoot();
console.log(target.root);
