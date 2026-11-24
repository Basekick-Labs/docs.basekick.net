import assert from 'node:assert/strict';
import test from 'node:test';

import { toPlainMarkdown } from './llm-markdown.mjs';

const SITE = 'https://docs.example';
const fence = String.fromCharCode(96).repeat(3);
const md = (/** @type {string[]} */ ...lines) => toPlainMarkdown(lines.join('\n'), SITE);

test('a callout becomes a blockquote led by its title', () => {
  assert.equal(
    md('Before.', '', '<Callout type="warn" title="Careful">', '  Body text.', '</Callout>', '', 'After.'),
    ['Before.', '', '> **Careful**', '>', '> Body text.', '', 'After.'].join('\n'),
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
    ['- [Install](https://docs.example/arcli/install/): Pick a package.', '- [Query](https://docs.example/arcli/query/): Run SQL.', ''].join('\n'),
  );
});

test('steps keep their content and drop the wrapper', () => {
  assert.equal(
    md('<Steps>', '  <Step>', '    ### Create a token [#create-a-token]', '', '    Do it.', '  </Step>', '</Steps>'),
    ['### Create a token', '', 'Do it.', ''].join('\n'),
  );
});

test('prose links are made absolute; external and anchor links are left alone', () => {
  assert.equal(
    md('See [install](/arc/installation/), [GitHub](https://github.com/x) and [below](#here).'),
    'See [install](https://docs.example/arc/installation/), [GitHub](https://github.com/x) and [below](#here).',
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
