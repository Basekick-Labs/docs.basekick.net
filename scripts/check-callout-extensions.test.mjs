import assert from 'node:assert/strict';
import test from 'node:test';

import { hasCalloutJsx } from './check-callout-extensions.mjs';

test('detects a Callout tag split across lines', () => {
  assert.equal(
    hasCalloutJsx('<Callout\n  type="info"\n  title="Example">'),
    true,
  );
});

test('ignores Callout examples in fenced code, inline code, and comments', () => {
  const fence = String.fromCharCode(96).repeat(3);
  const tick = String.fromCharCode(96);
  const markdown = [
    fence + 'mdx',
    '<Callout',
    '  type="info">',
    fence,
    'An inline example starts here ' + tick,
    '<Callout',
    'type="info">' + tick + ' and ends here.',
    '<!--',
    '<Callout type="info">',
    '-->',
  ].join('\n');

  assert.equal(hasCalloutJsx(markdown), false);
});

test('detects markup after a comment and a fenced example', () => {
  const fence = String.fromCharCode(96).repeat(3);
  const markdown = [
    '<!-- <Callout type="info"> -->',
    fence + 'mdx',
    '<Callout type="info">',
    fence,
    '<Callout type="warning">',
  ].join('\n');

  assert.equal(hasCalloutJsx(markdown), true);
});

test('escaped and unmatched backticks do not hide real JSX', () => {
  const tick = String.fromCharCode(96);
  const slash = String.fromCharCode(92);
  const markdown = [
    'An unmatched ' + tick + ' is literal.',
    slash + tick + ' is an escaped delimiter.',
    '<Callout',
    '  type="info">',
  ].join('\n');

  assert.equal(hasCalloutJsx(markdown), true);
  assert.equal(hasCalloutJsx(slash + '<Callout type="info">'), false);
});
