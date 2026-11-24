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
 * Rewrites that apply to prose only, never inside a code fence.
 *
 * @param {string} line
 * @param {string} siteUrl
 */
function rewriteProse(line, siteUrl) {
  return (
    line
      // "## Quick start [#quick-start]": the anchor id is fumadocs syntax.
      .replace(/^(#{1,6} .*?)\s+\[#[^\]]+\]\s*$/, '$1')
      // The release number is fetched in the browser; link to where it lives.
      .replace(
        /<LatestVersion\s+[^>]*?repo="([^"]+)"[^>]*\/>/g,
        '[latest release](https://github.com/$1/releases/latest)',
      )
      // remark-stringify escapes a literal asterisk beside emphasis this way.
      .replace(/&#x2A;/g, '*')
      .replace(/(\]\()(\/[^)\s]*)/g, (_, open, href) => open + absolute(href, siteUrl))
  );
}

/**
 * @param {string} text processed MDX of one page
 * @param {string} siteUrl origin for site-relative links, no trailing slash
 * @returns {string}
 */
export function toPlainMarkdown(text, siteUrl) {
  /** @type {string[]} */
  const out = [];
  // Open components, outermost first. A callout renders as a blockquote, so
  // it contributes a prefix; every component contributes one indent level.
  /** @type {{ name: string, quote: boolean }[]} */
  const stack = [];
  /** @type {string | null} */
  let fence = null;

  const prefix = () => (stack.some((c) => c.quote) ? '> ' : '');
  const emit = (/** @type {string} */ line) => {
    const p = prefix();
    out.push(line === '' ? p.trimEnd() : p + line);
  };
  /** A separator, unless the output already ends with one. */
  const blank = () => {
    const last = out[out.length - 1];
    if (last !== undefined && last !== '' && last !== '>') emit('');
  };

  for (const raw of text.split('\n')) {
    // Strip the indentation the enclosing components added, and no more:
    // what is left is the content's own (a nested list, a code line).
    const pad = raw.match(/^ */)?.[0].length ?? 0;
    const line = raw.slice(Math.min(pad, stack.length * INDENT));
    const tag = line.trim();

    if (fence) {
      emit(line);
      if (tag.startsWith(fence) && /^(`+|~+)$/.test(tag)) fence = null;
      continue;
    }
    const opened = FENCE.exec(line);
    if (opened) {
      fence = opened[1];
      emit(line);
      continue;
    }

    const open = /^<(Callout|Tabs|Tab|Cards|Steps|Step)(\s[^>]*)?>$/.exec(tag);
    if (open) {
      const [, name, rest = ''] = open;
      const a = attrs(rest);
      blank();
      if (name === 'Callout') {
        stack.push({ name, quote: true });
        emit(`**${a.title || CALLOUT_LABEL[a.type] || 'Note'}**`);
        emit('');
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
      while (out[out.length - 1] === '' || out[out.length - 1] === '>') out.pop();
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
        // read better tight.
        while (out[out.length - 1] === '' && /^- /.test(out[out.length - 2] ?? '')) out.pop();
        emit(`- ${label}${a.description ? `: ${a.description}` : ''}`);
        continue;
      }
    }

    emit(rewriteProse(line, siteUrl));
  }

  return out.join('\n').replace(/\n{3,}/g, '\n\n');
}
