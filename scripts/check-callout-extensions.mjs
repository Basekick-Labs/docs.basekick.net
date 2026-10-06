import { readdir, readFile } from 'node:fs/promises';
import { fromMarkdown } from 'mdast-util-from-markdown';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve('content/docs');
const violations = [];

export function hasCalloutJsx(source) {
  const pending = [fromMarkdown(source)];
  while (pending.length > 0) {
    const node = pending.pop();
    if (node.type === 'html') {
      const visibleHtml = node.value
        .replace(/<!--[\s\S]*?-->/g, '')
        .replace(/<(script|style|textarea|title|xmp|iframe|noembed|noframes)\b[^>]*>[\s\S]*?<\/\1\s*>/gi, '')
        .replace(/<plaintext\b[^>]*>[\s\S]*$/i, '');
      if (/<Callout(?:\s|\/?>)/.test(visibleHtml)) return true;
    }
    if (node.children) pending.push(...node.children);
  }
  return false;
}

async function visit(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const file = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      await visit(file);
    } else if (entry.isFile() && path.extname(file) === '.md') {
      const source = await readFile(file, 'utf8');
      if (hasCalloutJsx(source)) violations.push(file);
    }
  }
}

async function main() {
  await visit(root);
  if (violations.length > 0) {
    console.error('Callout JSX must be placed in .mdx files:');
    for (const file of violations) console.error(`- ${file}`);
    process.exitCode = 1;
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await main();
}
