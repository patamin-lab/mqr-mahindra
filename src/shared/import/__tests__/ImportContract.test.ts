import { describe, it, expect } from 'vitest';
import { aliasesOf, ImportContract, optionalFieldsOf, requiredFieldsOf } from '../ImportContract';

const contract: ImportContract = {
  module: 'test',
  templateName: 'Test Template',
  templateVersion: '1.0',
  fields: [
    { canonicalKey: 'dealer_id', displayLabel: 'Dealer Code', required: true, aliases: ['Dealer'] },
    { canonicalKey: 'model', displayLabel: 'Model', required: false, aliases: ['Tractor Model'] },
  ],
};

describe('ImportContract derivations', () => {
  it('requiredFieldsOf returns only required fields', () => {
    expect(requiredFieldsOf(contract).map((f) => f.canonicalKey)).toEqual(['dealer_id']);
  });

  it('optionalFieldsOf returns only optional fields', () => {
    expect(optionalFieldsOf(contract).map((f) => f.canonicalKey)).toEqual(['model']);
  });

  it('aliasesOf includes canonicalKey and displayLabel alongside declared aliases', () => {
    expect(aliasesOf(contract).dealer_id).toEqual(['dealer_id', 'Dealer Code', 'Dealer']);
    expect(aliasesOf(contract).model).toEqual(['model', 'Model', 'Tractor Model']);
  });
});
