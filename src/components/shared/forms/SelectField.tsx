'use client';

/**
 * Shared labeled select. Same dual usage as TextField - a labeled wrapper
 * for the top "create new row" form, or a bare select (omit `label`) for
 * inline-edit table cells.
 */
export type SelectOption = {
  value: string;
  label: string;
};

export type SelectFieldProps = {
  label?: string;
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  wrapperClassName?: string;
  selectClassName?: string;
  /** Same required-indicator convention as TextField (Form Standard). */
  required?: boolean;
  disabled?: boolean;
};

export default function SelectField({
  label,
  value,
  onChange,
  options,
  wrapperClassName,
  selectClassName = 'border rounded px-2 py-1.5 text-sm w-full',
  required,
  disabled,
}: SelectFieldProps) {
  const select = (
    <select className={selectClassName} value={value} onChange={(e) => onChange(e.target.value)} required={required} disabled={disabled}>
      {options.map((opt) => (
        <option key={opt.value} value={opt.value}>
          {opt.label}
        </option>
      ))}
    </select>
  );

  if (!label) return select;

  return (
    <div className={wrapperClassName}>
      <label className="block text-xs text-gray-500 mb-1">
        {label} {required && <span className="text-brand-red">*</span>}
      </label>
      {select}
    </div>
  );
}
