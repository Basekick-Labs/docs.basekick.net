import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';

const root = path.resolve('content/docs');
const violations = [];

function hasCalloutJsx(source) {
  let fence;
  let insideHtmlComment = false;
  for (const line of source.split(/\r?\n/)) {
    if (fence) {
      const closing = line.match(/^\s*(\x60{3,}|~{3,})\s*$/);
      if (
        closing &&
        closing[1][0] === fence.character &&
        closing[1].length >= fence.length
      ) {
        fence = undefined;
      }
      continue;
    }

    let content = line;
    while (content) {
      if (insideHtmlComment) {
        const end = content.indexOf('-->');
        if (end === -1) {
          content = '';
          break;
        }
        content = content.slice(end + 3);
        insideHtmlComment = false;
        continue;
      }

      const start = content.indexOf('<!--');
      if (start === -1) break;
      const end = content.indexOf('-->', start + 4);
      if (end === -1) {
        content = content.slice(0, start);
        insideHtmlComment = true;
        break;
      }
      content = content.slice(0, start) + content.slice(end + 3);
    }

    if (insideHtmlComment) continue;
    const marker = content.match(/^\s*(\x60{3,}|~{3,})/);
    if (marker) {
      fence = { character: marker[1][0], length: marker[1].length };
      continue;
    }

    const withoutInlineCode = content.replace(/\x60+[^\x60]*?\x60+/g, '');
    if (/<Callout(?:\s|\/?>)/.test(withoutInlineCode)) return true;
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

await visit(root);

if (violations.length > 0) {
  console.error('Callout JSX must be placed in .mdx files:');
  for (const file of violations) console.error(`- ${file}`);
  process.exitCode = 1;
}
