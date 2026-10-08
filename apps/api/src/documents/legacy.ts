import { sanitizeScheduleHtml } from './sanitize';

/**
 * Converts a v1 schedule into one continuous v2 schedule.
 *
 * v1 stored either plain HTML or a JSON array with one HTML string per manually created
 * A4 page. Staff padded pages with empty lines to push content onto the next page; with
 * automatic pagination that padding only adds gaps, so it's removed at page edges and
 * long runs of blank lines are collapsed.
 */
export function convertLegacySchedule(raw: string | null | undefined): string {
  const pages = parsePages(raw ?? '');
  const cleaned = pages
    .map(page => trimBlankEdges(sanitizeScheduleHtml(fixMojibake(page))))
    .filter(Boolean);
  return collapseBlankRuns(cleaned.join(''));
}

function parsePages(raw: string): string[] {
  if (!raw.trim()) return [];
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed.filter((p): p is string => typeof p === 'string');
  } catch { /* plain HTML */ }
  return [raw];
}

/** Undo UTF-8 text that was decoded as Latin-1 somewhere along the way (v1 had this bug). */
export function fixMojibake(s: string): string {
  return s
    .replace(/Â£/g, '£')
    .replace(/Â€/g, '€')
    .replace(/Â½/g, '½')
    .replace(/Â¼/g, '¼')
    .replace(/Â¾/g, '¾')
    .replace(/Â /g, ' ')
    // UTF-8 punctuation (E2 80 xx) read as Windows-1252: "â€" followed by the third byte.
    .replace(/â€“/g, '–') // –  (E2 80 93)
    .replace(/â€”/g, '—') // —  (E2 80 94)
    .replace(/â€™/g, '’') // ’  (E2 80 99)
    .replace(/â€˜/g, '‘') // ‘  (E2 80 98)
    .replace(/â€œ/g, '“') // “  (E2 80 9C)
    .replace(/â€¦/g, '…') // …  (E2 80 A6)
    .replace(/â€/g, '”');      // ”  (E2 80 9D: 9D has no 1252 glyph)
}

/** A paragraph with no visible text: <p></p>, <p><br></p>, <p>&nbsp;</p>, <p><strong></strong></p>… */
const BLANK_P = String.raw`<p(?:\s[^>]*)?>(?:\s|&nbsp;|<br\s*/?>|<(strong|em|u|s)>(?:\s|&nbsp;|<br\s*/?>)*</\1>)*</p>`;
const BLANK_EDGE = new RegExp(String.raw`^(?:\s|<br\s*/?>|${BLANK_P})+|(?:\s|<br\s*/?>|${BLANK_P})+$`, 'g');
const BLANK_RUN = new RegExp(String.raw`(?:${BLANK_P}\s*){2,}`, 'g');

function trimBlankEdges(html: string): string {
  return html.replace(BLANK_EDGE, '').trim();
}

/** Keep at most one blank paragraph between blocks (an intentional gap stays). */
function collapseBlankRuns(html: string): string {
  return html.replace(BLANK_RUN, '<p></p>');
}
