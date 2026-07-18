import React from 'react';
import { View, Text, StyleSheet } from '@react-pdf/renderer';
import { PDF_BRAND_RED } from './brand';
import type { TranslationResult } from '../translation/types';

const styles = StyleSheet.create({
  wrap: { marginTop: 8, marginBottom: 8 },
  fieldLabel: { fontSize: 9, fontWeight: 'bold', color: PDF_BRAND_RED, marginBottom: 3 },
  langRow: { flexDirection: 'row', marginTop: 2 },
  langTag: { width: 22, fontSize: 7, fontWeight: 'bold', color: '#888', paddingTop: 1 },
  langText: { flex: 1, fontSize: 8.5, lineHeight: 1.4 },
  unavailableText: { flex: 1, fontSize: 8.5, lineHeight: 1.4, color: '#999', fontStyle: 'italic' },
});

/**
 * Corporate PDF Standardization - Defect 2's bilingual TH/EN layout. Thai
 * stays the source of truth (always shown, untouched); English is
 * whatever `TranslationService.translateToEnglish()` produced for this
 * field - never computed here. This component ONLY renders what it's
 * handed; it has no translation logic of its own, per "the PDF renderer
 * must never perform translation directly."
 *
 * Renders nothing when the source Thai text itself is empty - matching
 * every other section's existing hide-if-empty convention rather than
 * showing an empty bilingual block.
 */
export function BilingualField({
  label,
  thaiText,
  translation,
}: {
  label: string;
  thaiText: string | null | undefined;
  translation: TranslationResult;
}) {
  const thai = (thaiText ?? '').trim();
  if (!thai) return null;

  return (
    <View style={styles.wrap} wrap={false}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <View style={styles.langRow}>
        <Text style={styles.langTag}>TH</Text>
        <Text style={styles.langText}>{thai}</Text>
      </View>
      <View style={styles.langRow}>
        <Text style={styles.langTag}>EN</Text>
        {translation.ok ? (
          <Text style={styles.langText}>{translation.text}</Text>
        ) : (
          <Text style={styles.unavailableText}>Translation unavailable ({translation.reason})</Text>
        )}
      </View>
    </View>
  );
}
