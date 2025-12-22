/**
 * Design System - Tokens de Cores e Estilos
 * 
 * Este arquivo centraliza todas as definições de cores, gradientes e estilos
 * para facilitar a manutenção e aplicação consistente em todo o projeto.
 */

export const colors = {
  // Cores principais
  primary: {
    light: 'blue-600',
    dark: 'blue-500',
  },
  secondary: {
    light: 'gray-700',
    dark: 'gray-300',
  },
  
  // Cores de status
  success: {
    light: 'green-600',
    dark: 'green-400',
  },
  warning: {
    light: 'yellow-600',
    dark: 'yellow-400',
  },
  danger: {
    light: 'red-600',
    dark: 'red-400',
  },
  info: {
    light: 'blue-600',
    dark: 'blue-400',
  },
  
  // Cores de contexto
  accent: {
    blue: { light: 'blue-600', dark: 'blue-400' },
    purple: { light: 'purple-600', dark: 'purple-400' },
    green: { light: 'green-600', dark: 'green-400' },
    indigo: { light: 'indigo-600', dark: 'indigo-400' },
    orange: { light: 'orange-600', dark: 'orange-400' },
    red: { light: 'red-600', dark: 'red-400' },
  },
};

/**
 * Classes base para inputs
 */
export const inputStyles = {
  base: [
    'w-full rounded-xl px-4 py-2.5',
    'bg-gray-100 dark:bg-gray-800',
    'border border-gray-300 dark:border-gray-700',
    'text-gray-900 dark:text-white',
    'placeholder:text-gray-500 dark:placeholder:text-gray-400',
    'focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400',
    'disabled:opacity-60 disabled:cursor-not-allowed',
    'transition-colors duration-200',
  ].join(' '),
  
  error: [
    'border-red-500 dark:border-red-400',
    'focus:ring-red-500 dark:focus:ring-red-400',
  ].join(' '),
};

/**
 * Classes base para botões
 */
export const buttonStyles = {
  base: [
    'inline-flex items-center justify-center font-medium',
    'transition-all duration-200',
    'disabled:opacity-60 disabled:cursor-not-allowed',
    'focus:outline-none focus:ring-2 focus:ring-offset-2',
    'dark:focus:ring-offset-gray-900',
  ].join(' '),
  
  variants: {
    primary: [
      'bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600',
      'text-white shadow-md hover:shadow-lg',
      'focus:ring-blue-500 dark:focus:ring-blue-400',
    ].join(' '),
    
    gradient: [
      'bg-linear-to-r from-blue-600 to-indigo-600',
      'hover:from-blue-700 hover:to-indigo-700',
      'text-white shadow-md hover:shadow-lg',
      'focus:ring-blue-500',
    ].join(' '),
    
    secondary: [
      'bg-white dark:bg-gray-800',
      'text-gray-700 dark:text-gray-300',
      'border border-gray-300 dark:border-gray-700',
      'hover:bg-gray-50 dark:hover:bg-gray-750',
      'focus:ring-gray-500 dark:focus:ring-gray-400',
    ].join(' '),
    
    danger: [
      'bg-linear-to-r from-red-600 to-red-700',
      'hover:from-red-700 hover:to-red-800',
      'text-white shadow-md hover:shadow-lg',
      'focus:ring-red-500',
    ].join(' '),
  },
  
  sizes: {
    sm: 'px-3 py-1.5 text-sm rounded-lg',
    md: 'px-4 py-2.5 text-base rounded-xl',
    lg: 'px-6 py-3 text-lg rounded-xl',
  },
};

/**
 * Classes base para cards
 */
export const cardStyles = {
  base: [
    'rounded-xl border shadow-md',
    'transition-all duration-300',
  ].join(' '),
  
  gradient: [
    'bg-linear-to-br from-white to-gray-50',
    'dark:from-gray-800 dark:to-gray-900',
    'border-gray-200 dark:border-gray-700',
  ].join(' '),
  
  solid: [
    'bg-white dark:bg-gray-800',
    'border-gray-300 dark:border-gray-600',
  ].join(' '),
  
  hover: 'hover:shadow-3xl hover:scale-[1.02]',
  
  padding: {
    none: '',
    sm: 'p-4',
    md: 'p-6',
    lg: 'p-8',
  },
};

/**
 * Classes para backgrounds com gradiente
 */
export const gradientBackgrounds = {
  page: {
    light: 'from-gray-50 via-gray-100 to-blue-50',
    dark: 'from-gray-900 via-gray-900 to-blue-900/20',
  },
  
  card: {
    light: 'from-white to-gray-50',
    dark: 'from-gray-800 to-gray-900',
  },
  
  accent: {
    blue: {
      light: 'from-blue-50 to-indigo-50',
      dark: 'from-blue-900/10 to-indigo-900/10',
    },
    purple: {
      light: 'from-purple-50 to-pink-50',
      dark: 'from-purple-900/10 to-pink-900/10',
    },
    green: {
      light: 'from-green-50 to-emerald-50',
      dark: 'from-green-900/10 to-emerald-900/10',
    },
  },
};

/**
 * Classes para ícones com badges coloridos
 */
export const iconBadgeStyles = {
  base: 'w-10 h-10 rounded-lg flex items-center justify-center transition-colors duration-300',
  
  colors: {
    blue: 'bg-blue-100 dark:bg-blue-600/20 text-blue-600 dark:text-blue-400',
    purple: 'bg-purple-100 dark:bg-purple-600/20 text-purple-600 dark:text-purple-400',
    green: 'bg-green-100 dark:bg-green-600/20 text-green-600 dark:text-green-400',
    indigo: 'bg-indigo-100 dark:bg-indigo-600/20 text-indigo-600 dark:text-indigo-400',
    orange: 'bg-orange-100 dark:bg-orange-600/20 text-orange-600 dark:text-orange-400',
    red: 'bg-red-100 dark:bg-red-600/20 text-red-600 dark:text-red-400',
  },
};

/**
 * Classes de texto adaptativas
 */
export const textStyles = {
  heading: 'text-gray-900 dark:text-white',
  body: 'text-gray-700 dark:text-gray-300',
  muted: 'text-gray-600 dark:text-gray-400',
  disabled: 'text-gray-500 dark:text-gray-500',
};

/**
 * Classes de transição
 */
export const transitions = {
  colors: 'transition-colors duration-300',
  all: 'transition-all duration-300',
  fast: 'transition-all duration-200',
  slow: 'transition-all duration-500',
};

/**
 * Utilitário para combinar classes condicionalmente
 */
export function cn(...classes: (string | undefined | null | false)[]): string {
  return classes.filter(Boolean).join(' ');
}
