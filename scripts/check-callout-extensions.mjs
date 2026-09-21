import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';

const root = path.resolve('content/docs');
const violations = [];

async function visit(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const file = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      await visit(file);
    } else if (entry.isFile() && path.extname(file) === '.md') {
      const source = await readFile(file, 'utf8');
      if (source.includes('<Callout')) violations.push(file);
    }
  }
}

await visit(root);

if (violations.length > 0) {
  console.error('Callout JSX must be placed in .mdx files:');
  for (const file of violations) console.error(`- ${file}`);
  process.exitCode = 1;
}
