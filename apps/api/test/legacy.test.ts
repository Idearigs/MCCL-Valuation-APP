import { describe, expect, it } from 'vitest';
import { convertLegacySchedule, fixMojibake } from '../src/documents/legacy';

describe('convertLegacySchedule', () => {
  it('joins manual pages into one schedule', () => {
    const raw = JSON.stringify(['<p>Ring one</p>', '<p>Ring two</p>']);
    expect(convertLegacySchedule(raw)).toBe('<p>Ring one</p><p>Ring two</p>');
  });

  it('accepts plain (pre-pages) HTML', () => {
    expect(convertLegacySchedule('<p>Watch</p>')).toBe('<p>Watch</p>');
  });

  it('removes spacer lines staff used to push content onto the next page', () => {
    const raw = JSON.stringify([
      '<p>Item 1</p><p><br></p><p><br></p><p><br></p><p>&nbsp;</p>',
      '<p><br></p><p><br></p><p>Item 2</p>',
    ]);
    expect(convertLegacySchedule(raw)).toBe('<p>Item 1</p><p>Item 2</p>');
  });

  it('keeps a single intentional gap between paragraphs', () => {
    const raw = '<p>Item 1</p><p><br></p><p><br></p><p><br></p><p>Item 2</p>';
    expect(convertLegacySchedule(raw)).toBe('<p>Item 1</p><p></p><p>Item 2</p>');
  });

  it('drops empty pages and fixes mojibake', () => {
    const raw = JSON.stringify(['', '<p>Value Â£3,000 â€“ size NÂ½</p>', '<p><br></p>']);
    expect(convertLegacySchedule(raw)).toBe('<p>Value £3,000 – size N½</p>');
  });

  it('strips unsafe markup and inline layout hacks', () => {
    const raw = '<div style="margin-top:90px">Ring<script>x()</script></div><font size="7">Big</font>';
    expect(convertLegacySchedule(raw)).toBe('<p>Ring</p>Big');
  });

  it('handles empty input', () => {
    expect(convertLegacySchedule('')).toBe('');
    expect(convertLegacySchedule(null)).toBe('');
    expect(convertLegacySchedule('[]')).toBe('');
  });
});

describe('fixMojibake', () => {
  it('repairs pound signs and quotes', () => {
    expect(fixMojibake('Â£400 â€œoldâ€')).toBe('£400 “old”');
  });
});

describe('Word-pasted schedules', () => {
  it('keeps bold, upright and underline from Word spans, drops fonts and sizes', () => {
    const word = '<p><span style="font-size: 14pt; font-family: Vijaya, sans-serif; font-weight: bold; color: #333">18ct ring</span>'
      + '<span style="font-style: normal; font-size: 12px; -webkit-user-drag: none">set with a diamond</span>'
      + '<span style="font-family: TimesNewRomanPS-BoldMT">Valued at</span>'
      + '<span style="font-size: 20px">plain</span></p>';
    expect(convertLegacySchedule(word)).toBe(
      '<p><span style="font-weight:bold">18ct ring</span>'
      + '<span style="font-style:normal">set with a diamond</span>'
      + '<span style="font-weight:bold">Valued at</span>plain</p>',
    );
  });

  it('unwraps nested meaningless spans without moving styles', () => {
    expect(convertLegacySchedule('<p><span>a<span style="font-weight:bold">b</span>c</span></p>'))
      .toBe('<p>a<span style="font-weight:bold">b</span>c</p>');
  });
});

describe('block structure', () => {
  it('unwraps Word <div><p> line wrappers instead of nesting paragraphs', () => {
    const word = '<div><p><span>Line one</span></p></div><div><p><span>Line two</span></p></div>';
    expect(convertLegacySchedule(word)).toBe('<p>Line one</p><p>Line two</p>');
  });

  it('turns typed <div> lines into paragraphs', () => {
    expect(convertLegacySchedule('<div>Ring</div><div>Watch</div>')).toBe('<p>Ring</p><p>Watch</p>');
  });

  it('drops tracking pixels pasted from email', () => {
    const pasted = '<div><p><span><img width="1" height="1" src="data:image/png;base64,AAAA"></span><span>Brooch</span></p></div>';
    expect(convertLegacySchedule(pasted)).toBe('<p>Brooch</p>');
  });
});
