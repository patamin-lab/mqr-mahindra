import React from 'react';
import fs from 'fs';
import path from 'path';
import { View, Image, StyleSheet } from '@react-pdf/renderer';

/**
 * Single configurable path every PDF document in the app resolves its
 * corporate logo from - never hardcode a logo path inside an individual
 * document component. Drop a real PNG at this path (react-pdf's <Image>
 * does not render SVG) and every PDF (MQR, PM, and any future module)
 * picks it up automatically with no code change.
 */
export const BRAND_LOGO_PATH = path.join(process.cwd(), 'public', 'assets', 'branding', 'mahindra-logo.png');

let cachedLogoExists: boolean | null = null;

function brandLogoExists(): boolean {
  if (cachedLogoExists === null) {
    try {
      cachedLogoExists = fs.existsSync(BRAND_LOGO_PATH) && fs.statSync(BRAND_LOGO_PATH).isFile();
    } catch {
      cachedLogoExists = false;
    }
  }
  return cachedLogoExists;
}

const styles = StyleSheet.create({
  logoSlot: { width: 96, height: 32, marginBottom: 6 },
  logoImage: { width: 96, height: 32, objectFit: 'contain', marginBottom: 6 },
});

/**
 * Reserves a fixed-size logo slot at the top of a PDF document's header.
 * Renders the real logo once a file exists at BRAND_LOGO_PATH; until then,
 * renders an empty View of the same footprint so the rest of the header
 * never shifts once the asset is added.
 */
export function PdfBrandLogo() {
  if (!brandLogoExists()) return <View style={styles.logoSlot} />;
  return <Image src={BRAND_LOGO_PATH} style={styles.logoImage} />;
}
