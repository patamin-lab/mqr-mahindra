'use client';

/**
 * Shared labeled text input. Covers two usages that existed identically
 * across the admin tables:
 *  - top-of-page "create new row" form fields (label + input, py-1.5)
 *  - inline-edit table-cell inputs (no label, py-1, sometimes a fixed width)
 *
 * Pass `label` to get the labeled wrapper; omit it to get a bare input for
 * inline-edit cells, matching the original markup exactly either way.
 */
export type TextFieldProps = {
  label?: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  wrapperClassName?: string;
  inputClassName?: string;
  disabled?: boolean;
  /** Renders a consistent `<span className="text-brand-red">*</span>`
   *  after the label (Form Standard) - the one required-indicator marker
   *  every field should use going forward, instead of each caller baking
   *  a literal " *" into its own label string. */
  required?: boolean;
};

export default function TextField({
  label,
  value,
  onChange,
  placeholder,
  wrapperClassName,
  inputClassName = 'border rounded px-2 py-1.5 text-sm w-full',
  disabled,
  required,
}: TextFieldProps) {
  const input = (
    <input
      className={inputClassName}
      value={value}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
      disabled={disabled}
      required={required}
    />
  );

  if (!label) return input;

  return (
    <div className={wrapperClassName}>
      <label className="block text-xs text-gray-500 mb-1">
        {label} {required && <span className="text-brand-red">*</span>}
      </label>
      {input}
    </div>
  );
}
