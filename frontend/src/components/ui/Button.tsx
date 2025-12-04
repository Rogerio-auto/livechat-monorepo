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
      "inline-flex items-center justify-center font-medium " +
      "transition-all duration-200 " +
      "disabled:opacity-60 disabled:cursor-not-allowed " +
      "focus:outline-none focus:ring-2 focus:ring-offset-2 " +
      "dark:focus:ring-offset-gray-900";

    const sizeClasses = {
      sm: "px-3 py-1.5 text-sm rounded-lg",
      md: "px-4 py-2.5 text-base rounded-xl",
      lg: "px-6 py-3 text-lg rounded-xl",
    };

    const variantClasses = {
      primary: 
        "bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 " +
        "text-white shadow-md hover:shadow-lg " +
        "focus:ring-blue-500 dark:focus:ring-blue-400",
      
      gradient: 
        "bg-gradient-to-r from-blue-600 to-indigo-600 " +
        "hover:from-blue-700 hover:to-indigo-700 " +
        "text-white shadow-md hover:shadow-lg " +
        "focus:ring-blue-500",
      
      secondary: 
        "bg-white dark:bg-gray-800 " +
        "text-gray-700 dark:text-gray-300 " +
        "border border-gray-300 dark:border-gray-700 " +
        "hover:bg-gray-50 dark:hover:bg-gray-750 " +
        "focus:ring-gray-500 dark:focus:ring-gray-400",
      
      danger: 
        "bg-gradient-to-r from-red-600 to-red-700 " +
        "hover:from-red-700 hover:to-red-800 " +
        "text-white shadow-md hover:shadow-lg " +
        "focus:ring-red-500",
      
      ghost: 
        "text-gray-700 dark:text-gray-300 " +
        "hover:bg-gray-100 dark:hover:bg-gray-800 " +
        "focus:ring-gray-500 dark:focus:ring-gray-400",
      
      outline:
        "bg-transparent border border-gray-300 dark:border-gray-700 " +
        "text-gray-700 dark:text-gray-300 " +
        "hover:bg-gray-50 dark:hover:bg-gray-800 " +
        "focus:ring-gray-500 dark:focus:ring-gray-400",
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
