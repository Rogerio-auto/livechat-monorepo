import { ButtonHTMLAttributes, forwardRef } from 'react';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost' | 'gradient' | 'outline';
  size?: 'sm' | 'md' | 'lg';
  fullWidth?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ 
    variant = 'secondary', 
    size = 'md', 
    fullWidth = false,
    className = '', 
    children, 
    ...props 
  }, ref) => {
    
    const baseClasses = 
      "inline-flex items-center justify-center font-bold " +
      "transition-all duration-200 " +
      "disabled:opacity-60 disabled:cursor-not-allowed " +
      "focus:outline-none focus:ring-2 focus:ring-offset-2 " +
      "dark:focus:ring-offset-[#0b1015]";

    const sizeClasses = {
      sm: "px-3 py-1.5 text-xs rounded-lg",
      md: "px-4 py-2.5 text-sm rounded-xl",
      lg: "px-6 py-3 text-base rounded-xl",
    };

    const variantClasses = {
      primary: 
        "bg-[#2fb463] hover:bg-[#1f8b49] " +
        "text-white shadow-lg shadow-[#2fb463]/20  " +
        "focus:ring-[#2fb463]",
      
      gradient: 
        "bg-gradient-to-r from-[#2fb463] to-[#1f8b49] " +
        "hover:from-[#1f8b49] hover:to-[#1a7a40] " +
        "text-white shadow-lg shadow-[#2fb463]/20  " +
        "focus:ring-[#2fb463]",
      
      secondary: 
        "bg-white dark:bg-[#151b23] " +
        "text-slate-700 dark:text-slate-300 " +
        "border border-slate-200 dark:border-slate-800 " +
        "hover:bg-slate-50 dark:hover:bg-slate-800/50 " +
        "focus:ring-slate-500 dark:focus:ring-slate-400",
      
      danger: 
        "bg-rose-600 hover:bg-rose-700 " +
        "text-white shadow-lg shadow-rose-600/20  " +
        "focus:ring-rose-500",
      
      ghost: 
        "text-slate-700 dark:text-slate-300 " +
        "hover:bg-slate-100 dark:hover:bg-slate-800 " +
        "focus:ring-slate-500 dark:focus:ring-slate-400",
      
      outline:
        "bg-transparent border border-slate-200 dark:border-slate-800 " +
        "text-slate-700 dark:text-slate-300 " +
        "hover:bg-slate-50 dark:hover:bg-slate-800 " +
        "focus:ring-slate-500 dark:focus:ring-slate-400",
    };

    const widthClasses = fullWidth ? "w-full" : "";

    return (
      <button
        ref={ref}
        className={`
          ${baseClasses} 
          ${sizeClasses[size]} 
          ${variantClasses[variant]} 
          ${widthClasses}
          ${className}
        `}
        {...props}
      >
        {children}
      </button>
    );
  }
);

Button.displayName = 'Button';
