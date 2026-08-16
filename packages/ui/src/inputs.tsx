import type {
  InputHTMLAttributes,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
  ReactNode,
} from "react";

const baseFieldClasses =
  "w-full rounded-lg border border-slate-300 px-4 py-3 text-slate-900 outline-none placeholder:text-slate-400 focus:border-blue-600 focus:ring-2 focus:ring-blue-100";

export interface FieldProps {
  id: string;
  label: string;
  hint?: string;
  children: ReactNode;
}

export function Field({ id, label, hint, children }: FieldProps) {
  return (
    <div>
      <label htmlFor={id} className="mb-2 block text-sm font-medium text-slate-700">
        {label}
      </label>
      {children}
      {hint ? <p className="mt-2 text-xs leading-5 text-slate-500">{hint}</p> : null}
    </div>
  );
}

export interface TextInputProps extends InputHTMLAttributes<HTMLInputElement> {
  id: string;
  label: string;
  hint?: string;
}

export function TextInput({ id, label, hint, className = "", ...rest }: TextInputProps) {
  return (
    <Field id={id} label={label} hint={hint}>
      <input id={id} name={id} className={`${baseFieldClasses} ${className}`} {...rest} />
    </Field>
  );
}

export interface TextAreaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  id: string;
  label: string;
  hint?: string;
}

export function TextArea({ id, label, hint, className = "", ...rest }: TextAreaProps) {
  return (
    <Field id={id} label={label} hint={hint}>
      <textarea id={id} name={id} className={`${baseFieldClasses} resize-y ${className}`} {...rest} />
    </Field>
  );
}

export interface SelectOption {
  value: string;
  label: string;
}

export interface SelectProps extends Omit<SelectHTMLAttributes<HTMLSelectElement>, "id"> {
  id: string;
  label: string;
  hint?: string;
  options: SelectOption[];
  placeholder?: string;
}

export function Select({
  id,
  label,
  hint,
  options,
  placeholder,
  className = "",
  ...rest
}: SelectProps) {
  return (
    <Field id={id} label={label} hint={hint}>
      <select id={id} name={id} className={`${baseFieldClasses} ${className}`} {...rest}>
        {placeholder ? <option value="">{placeholder}</option> : null}
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </Field>
  );
}
