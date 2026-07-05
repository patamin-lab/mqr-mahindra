'use client';

/**
 * Universal Import Framework — 5-step wizard shell (Download Template →
 * Upload → Preview & Validation → Confirm Import → Import Complete).
 *
 * Pure UI shell: renders the progress indicator and whatever step content
 * the caller passes as `children` for the current step. Owns no upload,
 * parsing, or business logic - every module (NTR today) drives its own
 * step transitions and content, so this component has no NTR-specific (or
 * any module-specific) knowledge at all. Consistent with the app's
 * existing Card-based layout convention (see `components/shared/layout/Card.tsx`).
 */
import { ReactNode } from 'react';
import Card from '@/components/shared/layout/Card';
import StepIndicator from './StepIndicator';

export const IMPORT_WIZARD_STEPS = ['Download Template', 'Upload File', 'Preview & Validation', 'Confirm Import', 'Import Complete'];

export interface ImportWizardProps {
  currentStep: number;
  title: string;
  children: ReactNode;
}

export default function ImportWizard({ currentStep, title, children }: ImportWizardProps) {
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-brand-dark">{title}</h1>
      <Card variant="compact" className="overflow-x-auto p-4">
        <StepIndicator steps={IMPORT_WIZARD_STEPS} currentStep={currentStep} />
      </Card>
      <Card variant="compact" className="p-4 sm:p-6">
        {children}
      </Card>
    </div>
  );
}
