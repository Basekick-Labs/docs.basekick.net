import assert from 'node:assert/strict';
import test from 'node:test';

import { toPlainMarkdown } from './llm-markdown.mjs';

const SITE = 'https://docs.example';
const fence = String.fromCharCode(96).repeat(3);
const md = (/** @type {string[]} */ ...lines) =>
  toPlainMarkdown(lines.join('\n'), { siteUrl: SITE, pageUrl: `${SITE}/arc/page/` });

test('a callout becomes a blockquote led by its title', () => {
  assert.equal(
    md('Before.', '', '<Callout type="warn" title="Careful">', '  Body text.', '</Callout>', '', 'After.'),
    ['Before.', '', '> **Warning: Careful**', '>', '> Body text.', '', 'After.'].join('\n'),
  );
});

test('a callout with no title is labelled by its type', () => {
  assert.match(md('<Callout type="info">', '  Body.', '</Callout>'), /^> \*\*Note\*\*\n>\n> Body\.\n$/);
  assert.match(md('<Callout type="warn">', '  Body.', '</Callout>'), /^> \*\*Warning\*\*/);
});

test('tabs become labelled blocks and their code loses the JSX indent', () => {
  assert.equal(
    md(
      `<Tabs items="['Docker', 'Native']">`,
      '  <Tab value="Docker">',
      `    ${fence}bash`,
      '    docker run \\',
      '      arc',
      `    ${fence}`,
      '  </Tab>',
      '',
      '  <Tab value="Native">',
      '    Run the binary.',
      '  </Tab>',
      '</Tabs>',
    ),
    ['**Docker**', '', `${fence}bash`, 'docker run \\', '  arc', fence, '', '**Native**', '', 'Run the binary.', ''].join('\n'),
  );
});

test('a callout nested in a tab is still a blockquote', () => {
  const out = md('<Tabs items="[\'A\']">', '  <Tab value="A">', '    <Callout type="idea" title="Hint">', '      Text.', '    </Callout>', '  </Tab>', '</Tabs>');
  assert.match(out, /\*\*A\*\*\n\n> \*\*Hint\*\*\n>\n> Text\./);
  assert.doesNotMatch(out, /<\/?(Tabs|Tab|Callout)/);
});

test('cards become a tight list with absolute links', () => {
  assert.equal(
    md('<Cards>', '  <Card title="Install" href="/arcli/install/" description="Pick a package." />', '', '  <Card title="Query" href="/arcli/query/" description="Run SQL." />', '</Cards>'),
    ['* [Install](https://docs.example/arcli/install/): Pick a package.', '* [Query](https://docs.example/arcli/query/): Run SQL.', ''].join('\n'),
  );
});

test('steps keep their content and drop the wrapper', () => {
  assert.equal(
    md('<Steps>', '  <Step>', '    ### Create a token [#create-a-token]', '', '    Do it.', '  </Step>', '</Steps>'),
    ['### Create a token', '', 'Do it.', ''].join('\n'),
  );
});

test('site links are made absolute and same-page anchors get the page URL', () => {
  assert.equal(
    md('See [install](/arc/installation/), [GitHub](https://github.com/x) and [below](#here).'),
    'See [install](https://docs.example/arc/installation/), [GitHub](https://github.com/x) and [below](https://docs.example/arc/page/#here).',
  );
});

test('LatestVersion becomes a link to the releases page', () => {
  assert.equal(
    md('The latest release is <LatestVersion repo="Basekick-Labs/arcli" />.'),
    'The latest release is [latest release](https://github.com/Basekick-Labs/arcli/releases/latest).',
  );
});

test('nothing inside a code fence is rewritten', () => {
  const block = [`${fence}mdx`, '<Callout type="info">', '  [link](/arc/)', '</Callout>', '## Heading [#id]', fence];
  assert.equal(md(...block), block.join('\n'));
});

test('angle brackets that are not components survive', () => {
  assert.equal(md('Delete where id = <N> and <BigQuery Google identity>.'), 'Delete where id = <N> and <BigQuery Google identity>.');
});

test('an informational callout keeps its title as the label', () => {
  assert.match(md('<Callout type="idea" title="Air-gapped?">', '  Body.', '</Callout>'), /^> \*\*Air-gapped\?\*\*\n>\n> Body\./);
  assert.match(md('<Callout type="error" title="Data loss">', '  Body.', '</Callout>'), /^> \*\*Caution: Data loss\*\*/);
});

test('image placeholders get their path back from the raw source', () => {
  const raw = [`${fence}md`, '![in a fence](/img/ignored.png)', fence, '![First](/img/a.png)', '![Remote](https://x.example/b.png) ![Second](/img/c.jpg)'].join('\n');
  const processed = ['<img alt="First" src="__img0" />', '', '<img alt="Second" src="__img1" />', '', '<img alt="Lost" src="__img7" />'].join('\n');
  assert.equal(
    toPlainMarkdown(processed, { siteUrl: SITE, raw }),
    ['![First](https://docs.example/img/a.png)', '', '![Second](https://docs.example/img/c.jpg)', '', '*Image: Lost*'].join('\n'),
  );
});

test('MDX comments are dropped, single-line and multi-line', () => {
  assert.equal(
    md('Before.', '', '{/* TODO(diagram): one line */}', '', 'Middle.', '', '{/* TODO(screenshot): spans', 'two lines */}', '', 'After.'),
    ['Before.', '', 'Middle.', '', 'After.'].join('\n'),
  );
});

test('escaped backticks and asterisks are restored', () => {
  assert.equal(md('`a` and `b&#x60; return &#x2A;*bold**.'), '`a` and `b` return **bold**.');
});

test('inline code is left alone', () => {
  assert.equal(md('Write `[x](/arc/)` to link, see [docs](/arc/).'), 'Write `[x](/arc/)` to link, see [docs](https://docs.example/arc/).');
});

test('blank lines collapse in prose but not in code', () => {
  assert.equal(md('A.', '', '', '', 'B.', fence, 'x', '', '', 'y', fence), ['A.', '', 'B.', fence, 'x', '', '', 'y', fence].join('\n'));
});
