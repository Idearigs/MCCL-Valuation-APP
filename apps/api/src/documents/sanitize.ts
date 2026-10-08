import sanitizeHtml from 'sanitize-html';
import { parseDocument } from 'htmlparser2';
import { Element, type ChildNode } from 'domhandler';
import render from 'dom-serializer';

const BLOCK_TAGS = new Set(['p', 'div', 'ul', 'ol', 'li', 'table', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'blockquote', 'hr']);

/**
 * Word wraps every line as <div><p>…</p></div>, and the old editor typed lines as
 * <div>text</div>. Turning every div into a <p> would nest paragraphs, which browsers
 * split into extra empty paragraphs (big gaps on every line). So: a div that holds
 * block content is unwrapped; a div holding only inline content becomes a paragraph.
 */
function normaliseDivs(html: string): string {
  const doc = parseDocument(html, { decodeEntities: false });
  const walk = (nodes: ChildNode[]): ChildNode[] => nodes.flatMap(node => {
    if (!(node instanceof Element)) return [node];
    node.children = walk(node.children);
    for (const child of node.children) child.parent = node;
    if (node.name !== 'div') return [node];
    const hasBlock = node.children.some(c => c instanceof Element && BLOCK_TAGS.has(c.name));
    if (hasBlock) return node.children;
    node.name = 'p';
    return [node];
  });
  doc.children = walk(doc.children);
  return render(doc, { decodeEntities: false });
}

/**
 * Allowlist for schedule content: paragraphs, emphasis, lists, headings, simple tables.
 *
 * Most real schedules are pasted from Microsoft Word, which expresses bold/italic as
 * inline styles on <span>s (e.g. `font-weight: bold`, `font-style: normal`) rather than
 * <strong>/<em>. Those few emphasis styles are kept so documents read as they were
 * written; everything else (fonts, sizes, colours, margins, scripts, event handlers)
 * is stripped so the document template alone controls layout.
 */
const EMPHASIS_STYLES = {
  'font-weight': [/^(bold|bolder|[6-9]00)$/],
  'font-style': [/^(normal|italic)$/],
  'text-decoration': [/^underline$/],
  'text-decoration-line': [/^underline$/],
};

const OPTIONS: sanitizeHtml.IOptions = {
  allowedTags: [
    'p', 'br', 'span', 'strong', 'b', 'em', 'i', 'u', 's',
    'ul', 'ol', 'li', 'h2', 'h3', 'h4', 'blockquote', 'hr',
    'table', 'thead', 'tbody', 'tr', 'th', 'td',
  ],
  allowedAttributes: {
    span: ['style'],
    p: ['style'], h2: ['style'], h3: ['style'], h4: ['style'], li: ['style'],
    th: ['colspan', 'rowspan', 'style'], td: ['colspan', 'rowspan', 'style'],
  },
  allowedStyles: {
    '*': { 'text-align': [/^(left|right|center|justify)$/], ...EMPHASIS_STYLES },
  },
  transformTags: {
    b: 'strong',
    i: 'em',
    span: (tagName, attribs) => {
      let style = attribs.style ?? '';
      // Word marks some bold runs with a bold font name instead of font-weight.
      if (/font-family:[^;]*bold/i.test(style) && !/font-weight/i.test(style)) style += ';font-weight:bold';
      // A span with no emphasis left carries no meaning: rename it to a tag that isn't
      // allowed, which sanitize-html drops while keeping its text.
      if (!hasEmphasis(style)) return { tagName: 'unwrap', attribs: {} };
      return { tagName, attribs: { ...attribs, style } };
    },
  },
};

function hasEmphasis(style: string): boolean {
  return style.split(';').some(decl => {
    const [prop = '', ...rest] = decl.split(':');
    const rules = EMPHASIS_STYLES[prop.trim().toLowerCase() as keyof typeof EMPHASIS_STYLES];
    const value = rest.join(':').trim().toLowerCase();
    return !!rules?.some(re => re.test(value));
  });
}

export function sanitizeScheduleHtml(html: string): string {
  return sanitizeHtml(normaliseDivs(html), OPTIONS).trim();
}
