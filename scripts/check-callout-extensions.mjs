import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve('content/docs');
const violations = [];

export function hasCalloutJsx(source) {
  let fence;
  let insideHtmlComment = false;
  let inlineCodeTicks = 0;
  const visibleLines = [];

  const lines = source.split(/\r?\n/);
  let sourceOffset = 0;
  for (const line of lines) {
    const lineOffset = sourceOffset;
    sourceOffset += line.length + 1;

    if (fence || (!insideHtmlComment && inlineCodeTicks === 0)) {
      const marker = line.match(/^ {0,3}(\x60{3,}|~{3,})(.*)$/);
      if (!fence && marker) {
        fence = { character: marker[1][0], length: marker[1].length };
        visibleLines.push('');
        continue;
      }
      const closing = fence && line.match(/^ {0,3}(\x60{3,}|~{3,})\s*$/);
      if (
        fence &&
        closing &&
        closing[1][0] === fence.character &&
        closing[1].length >= fence.length
      ) {
        fence = undefined;
      }
      if (fence || closing) {
        visibleLines.push('');
        continue;
      }
    }
    if (fence) {
      visibleLines.push('');
      continue;
    }

    let visible = '';
    for (let index = 0; index < line.length; ) {
      if (insideHtmlComment) {
        const end = line.indexOf('-->', index);
        if (end === -1) {
          break;
        }
        index = end + 3;
        insideHtmlComment = false;
        continue;
      }

      if (inlineCodeTicks > 0) {
        if (line[index] === '\x60') {
          let end = index + 1;
          while (line[end] === '\x60') end++;
          if (end - index === inlineCodeTicks) inlineCodeTicks = 0;
          index = end;
        } else {
          index++;
        }
        continue;
      }

      if (line.startsWith('<!--', index)) {
        if (!isEscaped(line, index)) {
          insideHtmlComment = true;
          index += 4;
          continue;
        }
      }

      if (line[index] === '\x60') {
        let end = index + 1;
        while (line[end] === '\x60') end++;
        const ticks = end - index;
        if (isEscaped(line, index) || !hasMatchingBacktick(source, lineOffset + index, ticks)) {
          visible += line.slice(index, end);
          index = end;
          continue;
        }
        inlineCodeTicks = ticks;
        index = end;
        continue;
      }

      if (line.startsWith('<Callout', index) && isEscaped(line, index)) {
        visible += ' ';
        index++;
        continue;
      }

      visible += line[index];
      index++;
    }

    visibleLines.push(visible);
  }

  return /<Callout(?:\s|\/?>)/.test(visibleLines.join('\n'));
}

function isEscaped(source, index) {
  let slashes = 0;
  for (let cursor = index - 1; cursor >= 0 && source[cursor] === '\\'; cursor--) {
    slashes++;
  }
  return slashes % 2 === 1;
}

function hasMatchingBacktick(source, start, length) {
  for (let cursor = start + length; cursor < source.length; ) {
    if (source[cursor] !== '\x60') {
      cursor++;
      continue;
    }

    let end = cursor + 1;
    while (source[end] === '\x60') end++;
    if (end - cursor === length && !isEscaped(source, cursor)) return true;
    cursor = end;
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
