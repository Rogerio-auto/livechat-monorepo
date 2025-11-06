import { ReactNode } from 'react';

export interface CardProps {
  children: ReactNode;
  className?: string;
  gradient?: boolean;
  hover?: boolean;
  padding?: 'none' | 'sm' | 'md' | 'lg';
}

export function Card({ 
  children, 
  className = '', 
  gradient = true, 
  hover = false,
  padding = 'lg'
}: CardProps) {
  
  const baseClasses = 
    "rounded-3xl border " +
    "shadow-2xl " +
    "transition-all duration-300";

  const gradientClasses = gradient
    ? "bg-linear-to-br from-white to-gray-50 dark:from-gray-800 dark:to-gray-900 " +
      "border-gray-200 dark:border-gray-700"
    : "bg-white dark:bg-gray-800 " +
      "border-gray-300 dark:border-gray-600";

  const hoverClasses = hover
    ? "hover:shadow-3xl hover:scale-[1.02]"
    : "";

  const paddingClasses = {
    none: "",
    sm: "p-4",
    md: "p-6",
    lg: "p-8",
  };

  return (
    <div 
      className={`
        ${baseClasses} 
        ${gradientClasses} 
        ${hoverClasses} 
        ${paddingClasses[padding]}
        ${className}
      `}
    >
      {children}
    </div>
  );
}

export interface CardHeaderProps {
  title: string;
  subtitle?: string;
  icon?: ReactNode;
  iconColor?: 'blue' | 'purple' | 'green' | 'indigo' | 'orange' | 'red';
  actions?: ReactNode;
}

export function CardHeader({ 
  title, 
  subtitle, 
  icon, 
  iconColor = 'blue',
  actions 
}: CardHeaderProps) {
  
  const iconColorClasses = {
    blue: "bg-blue-100 dark:bg-blue-600/20 text-blue-600 dark:text-blue-400",
    purple: "bg-purple-100 dark:bg-purple-600/20 text-purple-600 dark:text-purple-400",
    green: "bg-green-100 dark:bg-green-600/20 text-green-600 dark:text-green-400",
    indigo: "bg-indigo-100 dark:bg-indigo-600/20 text-indigo-600 dark:text-indigo-400",
    orange: "bg-orange-100 dark:bg-orange-600/20 text-orange-600 dark:text-orange-400",
    red: "bg-red-100 dark:bg-red-600/20 text-red-600 dark:text-red-400",
  };

  return (
    <div className="mb-6">
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-3">
            {icon && (
              <div className={`w-10 h-10 rounded-lg flex items-center justify-center transition-colors duration-300 ${iconColorClasses[iconColor]}`}>
                {icon}
              </div>
            )}
            {title}
          </h2>
          {subtitle && (
            <p className="text-gray-600 dark:text-gray-400 mt-1">{subtitle}</p>
          )}
        </div>
        {actions && <div>{actions}</div>}
      </div>
    </div>
  );
}

export interface InfoCardProps {
  title: string;
  description: string;
  icon?: ReactNode;
  color?: 'blue' | 'purple' | 'green' | 'indigo' | 'orange' | 'red';
  actions?: ReactNode;
}

export function InfoCard({ 
  title, 
  description, 
  icon, 
  color = 'blue',
  actions 
}: InfoCardProps) {
  
  const colorClasses = {
    blue: "from-blue-50 to-indigo-50 dark:from-blue-900/10 dark:to-indigo-900/10 border-blue-200 dark:border-blue-800",
    purple: "from-purple-50 to-pink-50 dark:from-purple-900/10 dark:to-pink-900/10 border-purple-200 dark:border-purple-800",
    green: "from-green-50 to-emerald-50 dark:from-green-900/10 dark:to-emerald-900/10 border-green-200 dark:border-green-800",
    indigo: "from-indigo-50 to-blue-50 dark:from-indigo-900/10 dark:to-blue-900/10 border-indigo-200 dark:border-indigo-800",
    orange: "from-orange-50 to-amber-50 dark:from-orange-900/10 dark:to-amber-900/10 border-orange-200 dark:border-orange-800",
    red: "from-red-50 to-rose-50 dark:from-red-900/10 dark:to-rose-900/10 border-red-200 dark:border-red-800",
  };

  const iconColorClasses = {
    blue: "text-blue-600 dark:text-blue-400",
    purple: "text-purple-600 dark:text-purple-400",
    green: "text-green-600 dark:text-green-400",
    indigo: "text-indigo-600 dark:text-indigo-400",
    orange: "text-orange-600 dark:text-orange-400",
    red: "text-red-600 dark:text-red-400",
  };

  return (
  <div className={`p-6 rounded-2xl bg-linear-to-br border transition-colors duration-300 ${colorClasses[color]}`}>
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <div className="font-semibold text-gray-900 dark:text-white mb-1 flex items-center gap-2">
            {icon && (
              <span className={iconColorClasses[color]}>
                {icon}
              </span>
            )}
            {title}
          </div>
          <div className="text-sm text-gray-700 dark:text-gray-300">
            {description}
          </div>
        </div>
        {actions && <div className="flex items-center gap-2">{actions}</div>}
      </div>
    </div>
  );
}
