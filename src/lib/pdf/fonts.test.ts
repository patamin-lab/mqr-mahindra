import React from 'react';
import { describe, it, expect } from 'vitest';
import { Document, Page, Text, renderToBuffer } from '@react-pdf/renderer';
import { ensureFontsRegistered } from './fonts';

// fontkit is used by @react-pdf/font at runtime but has no published types.
const fontkit = require('fontkit') as {
  openSync: (source: string) => {
    layout: (text: string) => {
      glyphs: Array<{ codePoints: number[] }>;
      positions: Array<{ xAdvance: number }>;
    };
  };
};

describe('shared PDF Sarabun font registration', () => {
  it('renders Thai and English fallback text without requiring an italic font face', async () => {
    ensureFontsRegistered();

    const pdf = await renderToBuffer(
      React.createElement(
        Document,
        null,
        React.createElement(
          Page,
          { style: { fontFamily: 'Sarabun' } },
          React.createElement(Text, null, 'ภาษาไทย / English')
        )
      )
    );

    expect(pdf.length).toBeGreaterThan(0);
  });

  it('keeps Thai Sara Am as a single Unicode glyph for PDF text output', () => {
    ensureFontsRegistered();

    const font = fontkit.openSync('public/fonts/Sarabun-Regular.ttf');
    const layout = font.layout('อำเภอสระโบสถ์ / ฝาถังน้ำมัน ยุบตัว / อยู่ในประกัน');
    const glyphCodePoints = layout.glyphs.flatMap((glyph) => glyph.codePoints);

    expect(glyphCodePoints).toEqual(Array.from('อำเภอสระโบสถ์ / ฝาถังน้ำมัน ยุบตัว / อยู่ในประกัน', (character) => character.codePointAt(0)));

    const toneMarkIndex = glyphCodePoints.indexOf('่'.codePointAt(0)!);
    expect(layout.positions[toneMarkIndex].xAdvance).toBe(1);
  });
});
