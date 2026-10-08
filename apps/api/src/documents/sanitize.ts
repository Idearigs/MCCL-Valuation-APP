import sanitizeHtml from 'sanitize-html';

/**
 * Allowlist for schedule content. Matches what the editor can produce: paragraphs,
 * emphasis, lists, headings, simple tables and text alignment. Everything else
 * (scripts, event handlers, fonts, fixed sizes, spacer hacks) is stripped so the
 * document template alone controls layout.
 */
const OPTIONS: sanitizeHtml.IOptions = {
  allowedTags: [
    'p', 'br', 'strong', 'b', 'em', 'i', 'u', 's',
    'ul', 'ol', 'li', 'h2', 'h3', 'h4', 'blockquote', 'hr',
    'table', 'thead', 'tbody', 'tr', 'th', 'td',
  ],
  allowedAttributes: {
    p: ['style'], h2: ['style'], h3: ['style'], h4: ['style'], li: ['style'],
    th: ['colspan', 'rowspan', 'style'], td: ['colspan', 'rowspan', 'style'],
  },
  allowedStyles: {
    '*': { 'text-align': [/^(left|right|center|justify)$/] },
  },
  transformTags: { b: 'strong', i: 'em', div: 'p' },
};

export function sanitizeScheduleHtml(html: string): string {
  return sanitizeHtml(html, OPTIONS).trim();
}
