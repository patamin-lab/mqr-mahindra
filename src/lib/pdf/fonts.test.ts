import React from 'react';
import { describe, it, expect } from 'vitest';
import { Document, Page, Text, renderToBuffer } from '@react-pdf/renderer';
import { ensureFontsRegistered } from './fonts';

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
});
