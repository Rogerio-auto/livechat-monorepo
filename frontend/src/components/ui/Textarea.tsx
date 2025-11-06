import { TextareaHTMLAttributes, forwardRef } from 'react';

export interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
  helperText?: string;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ label, error, helperText, className = '', ...props }, ref) => {
    const baseClasses = 
      "w-full rounded-xl px-4 py-2.5 " +
      "bg-gray-100 dark:bg-gray-800 " +
      "border border-gray-300 dark:border-gray-700 " +
      "text-gray-900 dark:text-white " +
      "placeholder:text-gray-500 dark:placeholder:text-gray-400 " +
      "focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 " +
      "disabled:opacity-60 disabled:cursor-not-allowed " +
      "transition-colors duration-200 " +
      "resize-y min-h-[100px]";

    const errorClasses = error 
      ? "border-red-500 dark:border-red-400 focus:ring-red-500 dark:focus:ring-red-400"
      : "";

    return (
      <div className="space-y-2">
        {label && (
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
            {label}
          </label>
        )}
        <textarea
          ref={ref}
          className={`${baseClasses} ${errorClasses} ${className}`}
          {...props}
        />
        {error && (
          <p className="text-sm text-red-600 dark:text-red-400 flex items-center gap-1">
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
            {error}
          </p>
        )}
        {helperText && !error && (
          <p className="text-sm text-gray-600 dark:text-gray-400">
            {helperText}
          </p>
        )}
      </div>
    );
  }
);

Textarea.displayName = 'Textarea';
