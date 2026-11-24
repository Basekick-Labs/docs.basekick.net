// Turns a page's processed MDX into plain Markdown for the AI-facing output:
// /llms.mdx/<path>/content.md and the llms-full files.
//
// fumadocs' "processed" text keeps JSX components as written, so a reader got
// `<Tabs items="[...]">`, `<Card title=... />` and `<Callout type="warn">`
// in the middle of the prose, plus site-relative links that mean nothing once
// the file is read away from the site. This rewrites the components the docs
// use into the nearest Markdown and makes links absolute.
//
// Plain .mjs with JSDoc rather than TypeScript so `node --test` can run the
// tests on every Node version the repo supports (see package.json engines).

const CALLOUT_LABEL = {
  info: 'Note',
  idea: 'Tip',
  success: 'Tip',
  warn: 'Warning',
  warning: 'Warning',
  error: 'Caution',
};

// Each level of JSX nesting indents its children by two spaces.
const INDENT = 2;

const FENCE = /^\s*(`{3,}|~{3,})/;
const ATTR = /([A-Za-z]+)="([^"]*)"/g;

/** @param {string} tag */
function attrs(tag) {
  /** @type {Record<string, string>} */
  const out = {};
  for (const [, name, value] of tag.matchAll(ATTR)) out[name] = value;
  return out;
}

/**
 * @param {string} href
 * @param {string} siteUrl
 */
function absolute(href, siteUrl) {
  return href.startsWith('/') && !href.startsWith('//') ? siteUrl + href : href;
}

/**
 * Local images in source order, read from the page's raw MDX.
 *
 * fumadocs turns `![alt](/img/x.png)` into an imported image, and the
 * processed text is left with `<img alt="alt" src="__img0" />`: the number is
 * the image's position among the page's local images, the path is gone.
 *
 * @param {string} raw
 * @returns {string[]}
 */
function localImages(raw) {
  /** @type {string[]} */
  const found = [];
  /** @type {string | null} */
  let fence = null;
  for (const line of raw.split('\n')) {
    const tag = line.trim();
    if (fence) {
      if (tag.startsWith(fence) && /^(`+|~+)$/.test(tag)) fence = null;
      continue;
    }
    const opened = FENCE.exec(line);
    if (opened) {
      fence = opened[1];
      continue;
    }
    for (const [, src] of line.matchAll(/!\[[^\]]*\]\(\s*([^)\s]+)/g)) {
      if (!/^[a-z]+:\/\//i.test(src)) found.push(src);
    }
  }
  return found;
}

/**
 * Rewrites that apply to prose only: never inside a code fence, and never
 * inside an inline code span, where a path or an asterisk is literal.
 *
 * @param {string} line
 * @param {{ siteUrl: string, pageUrl: string, images: string[] }} ctx
 */
function rewriteProse(line, ctx) {
  // "## Quick start [#quick-start]": the anchor id is fumadocs syntax.
  const text = line.replace(/^(#{1,6} .*?)\s+\[#[^\]]+\]\s*$/, '$1');

  return text
    .split(/(`+[^`]*`+)/)
    .map((part, i) => {
      if (i % 2 === 1) return part;
      return (
        part
          // The release number is fetched in the browser; link to where it lives.
          .replace(
            /<LatestVersion\s+[^>]*?repo="([^"]+)"[^>]*\/>/g,
            '[latest release](https://github.com/$1/releases/latest)',
          )
          .replace(/<img alt="([^"]*)" src="__img(\d+)"\s*\/>/g, (_, alt, n) => {
            const src = ctx.images[Number(n)];
            return src ? `![${alt}](${absolute(src, ctx.siteUrl)})` : `*Image: ${alt}*`;
          })
          .replace(/(\]\()(\/[^)\s]*)/g, (_, open, href) => open + absolute(href, ctx.siteUrl))
          // A same-page anchor points nowhere once pages are concatenated.
          .replace(/(\]\()(#[^)\s]*)/g, (_, open, hash) => open + ctx.pageUrl + hash)
      );
    })
    .join('')
    // remark-stringify escapes an asterisk or a backtick it considers
    // ambiguous as an entity, which leaves `code&#x60; unterminated.
    .replace(/&#x2A;/g, '*')
    .replace(/&#x60;/g, '`');
}

/**
 * @param {string} text processed MDX of one page
 * @param {object} options
 * @param {string} options.siteUrl origin for site-relative links, no trailing slash
 * @param {string} [options.pageUrl] absolute URL of this page, for same-page anchors
 * @param {string} [options.raw] the page's raw MDX, to recover image paths
 * @returns {string}
 */
export function toPlainMarkdown(text, { siteUrl, pageUrl = '', raw = '' }) {
  const ctx = { siteUrl, pageUrl, images: localImages(raw) };
  /** @type {string[]} */
  const out = [];
  // Open components, outermost first. A callout renders as a blockquote, so
  // it contributes a prefix; every component contributes one indent level.
  /** @type {{ name: string, quote: boolean }[]} */
  const stack = [];
  /** @type {string | null} */
  let fence = null;
  // Inside a {/* ... */} comment: authoring notes, not content.
  let comment = false;

  const prefix = () => (stack.some((c) => c.quote) ? '> ' : '');
  const isBlank = (/** @type {string | undefined} */ l) => l === '' || l === '>';
  /**
   * Blank lines collapse to one in prose. A code block is emitted verbatim.
   * @param {string} line
   * @param {boolean} [verbatim]
   */
  const emit = (line, verbatim = false) => {
    const p = prefix();
    if (line === '' && !verbatim && (out.length === 0 || isBlank(out[out.length - 1]))) return;
    out.push(line === '' ? p.trimEnd() : p + line);
  };

  for (const raw of text.split('\n')) {
    // Strip the indentation the enclosing components added, and no more:
    // what is left is the content's own (a nested list, a code line).
    const pad = raw.match(/^ */)?.[0].length ?? 0;
    const line = raw.slice(Math.min(pad, stack.length * INDENT));
    const tag = line.trim();

    if (fence) {
      emit(line, true);
      if (tag.startsWith(fence) && /^(`+|~+)$/.test(tag)) fence = null;
      continue;
    }

    if (comment || tag.startsWith('{/*')) {
      comment = !tag.endsWith('*/}');
      continue;
    }

    const opened = FENCE.exec(line);
    if (opened) {
      fence = opened[1];
      emit(line, true);
      continue;
    }

    const open = /^<(Callout|Tabs|Tab|Cards|Steps|Step)(\s[^>]*)?>$/.exec(tag);
    if (open) {
      const [, name, rest = ''] = open;
      const a = attrs(rest);
      emit('');
      if (name === 'Callout') {
        stack.push({ name, quote: true });
        // The page shows severity with colour; here the label has to say it.
        const label = CALLOUT_LABEL[a.type] ?? 'Note';
        const severe = label === 'Warning' || label === 'Caution';
        emit(`**${a.title ? (severe ? `${label}: ${a.title}` : a.title) : label}**`);
        out.push('>');
      } else {
        // The tab's label is the only thing that says which variant follows.
        if (name === 'Tab' && a.value) {
          emit(`**${a.value}**`);
          emit('');
        }
        stack.push({ name, quote: false });
      }
      continue;
    }

    const close = /^<\/(Callout|Tabs|Tab|Cards|Steps|Step)>$/.exec(tag);
    if (close && stack.length > 0 && stack[stack.length - 1].name === close[1]) {
      // Drop blank lines left at the end of the component's content.
      while (isBlank(out[out.length - 1])) out.pop();
      stack.pop();
      emit('');
      continue;
    }

    const card = /^<Card\s([^>]*?)\/>$/.exec(tag);
    if (card) {
      const a = attrs(card[1]);
      if (a.title) {
        const label = a.href ? `[${a.title}](${absolute(a.href, siteUrl)})` : a.title;
        // Cards are separated by blank lines in the source; as a list they
        // read better tight. `*` to match the bullets remark writes.
        if (out[out.length - 1] === '' && /^\* /.test(out[out.length - 2] ?? '')) out.pop();
        emit(`* ${label}${a.description ? `: ${a.description}` : ''}`);
        continue;
      }
    }

    emit(rewriteProse(line, ctx));
  }

  return out.join('\n');
}
