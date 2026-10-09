import { readdir, readFile } from 'node:fs/promises';
import { fromMarkdown } from 'mdast-util-from-markdown';
import { mdxFromMarkdown } from 'mdast-util-mdx';
import { mdxjs } from 'micromark-extension-mdxjs';
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
        .replace(/<(script|style|textarea|title|xmp|iframe|noembed|noframes)\b[^>]*>[\s\S]*?(?:<\/\1\s*>|$)/gi, '')
        .replace(/<plaintext\b[^>]*>[\s\S]*$/i, '');
      if (/<Callout(?:\s|\/?>)/.test(visibleHtml)) return true;
    } else if (node.type === 'text' && node.position) {
      const start = node.position.start.offset;
      const end = node.position.end.offset;
      const rawText = source.slice(start, end);
      const opening = /<Callout(?=\s|\/?>)/g;
      let match;
      while ((match = opening.exec(rawText))) {
        const absoluteOffset = start + match.index;
        if (isEscaped(source, absoluteOffset)) continue;

        for (let closing = rawText.indexOf('>', match.index); closing !== -1; closing = rawText.indexOf('>', closing + 1)) {
          if (isCalloutMdxTag(rawText.slice(match.index, closing + 1))) return true;
        }

        const standaloneCloser = source.slice(end).match(/^\r?\n[ \t]*>/);
        if (standaloneCloser && isCalloutMdxTag(`${rawText.slice(match.index)}${standaloneCloser[0]}`)) {
          return true;
        }
      }
    }
    if (node.children) pending.push(...node.children);
  }
  return false;
}

function isEscaped(source, index) {
  let slashes = 0;
  for (let cursor = index - 1; cursor >= 0 && source[cursor] === '\\'; cursor--) {
    slashes++;
  }
  return slashes % 2 === 1;
}

function isCalloutMdxTag(openingTag) {
  const content = openingTag.trimEnd();
  const source = /\/\s*>$/.test(content) ? content : `${content}\n</Callout>`;
  let tree;

  try {
    tree = fromMarkdown(source, {
      extensions: [mdxjs()],
      mdastExtensions: [mdxFromMarkdown()],
    });
  } catch {
    return false;
  }

  const pending = [tree];
  while (pending.length > 0) {
    const node = pending.pop();
    if (
      (node.type === 'mdxJsxFlowElement' || node.type === 'mdxJsxTextElement') &&
      node.name === 'Callout'
    ) {
      return true;
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
