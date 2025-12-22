import { forwardRef, InputHTMLAttributes } from 'react';

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helperText?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, helperText, className = '', ...props }, ref) => {
    const baseClasses = 
      "w-full rounded-xl px-4 py-2.5 " +
      "bg-white dark:bg-[#151b23] " +
      "border border-slate-200 dark:border-slate-800 " +
      "text-slate-900 dark:text-white " +
      "placeholder:text-slate-400 " +
      "focus:outline-none focus:ring-2 focus:ring-[#2fb463]/50 focus:border-[#2fb463] " +
      "disabled:opacity-60 disabled:cursor-not-allowed " +
      "transition-all duration-200";

    const errorClasses = error 
      ? "border-rose-500 dark:border-rose-400 focus:ring-rose-500 dark:focus:ring-rose-400"
      : "";

    return (
      <div className="space-y-2">
        {label && (
          <label className="block text-sm font-bold text-slate-700 dark:text-slate-300">
            {label}
          </label>
        )}
        <input
          ref={ref}
          className={`${baseClasses} ${errorClasses} ${className}`}
          {...props}
        />
        {error && (
          <p className="text-sm text-rose-600 dark:text-rose-400 flex items-center gap-1 font-medium">
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
            {error}
          </p>
        )}
        {helperText && !error && (
          <p className="text-sm text-slate-500">
            {helperText}
          </p>
        )}
      </div>
    );
  }
);

Input.displayName = 'Input';
