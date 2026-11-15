import React from 'react';
    
export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children: React.ReactNode;
  variant?: 'primary' | 'gradient' | 'secondary' | 'outline';
  className?: string;
}

export default function Button({ 
  children, 
  variant = 'primary', 
  className = '', 
  disabled = false,
  ...props 
}: ButtonProps) {
  const hasPadding = /\b(px|py|p|h)-\S+/.test(className);
  const hasRounded = /\brounded(-\S+)?\b/.test(className);

  const defaultPadding = hasPadding ? '' : 'px-6 py-2.5';
  const defaultRounded = hasRounded ? '' : 'rounded-md';
  const baseStyles = 'font-medium transition-all duration-200 inline-flex items-center justify-center';
  const variants = {
    primary: 'bg-purple-600 text-white hover:bg-purple-700 shadow-xs',
    gradient: 'bg-gradient-to-r from-purple-600 to-pink-600 text-white hover:opacity-90 shadow-xs',
    secondary: 'bg-gray-100 hover:bg-gray-200 dark:bg-white/10 dark:hover:bg-white/15 text-gray-700 dark:text-gray-200 border border-gray-200 dark:border-white/10 shadow-xs',
    outline: 'border border-gray-200 dark:border-white/10 bg-white dark:bg-[#070a13] text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-white/5 hover:border-purple-300 dark:hover:border-purple-500/50 shadow-xs'
  };

  const disabledStyles = 'opacity-50 cursor-not-allowed';

  return (
    <button 
      className={`${baseStyles} ${defaultPadding} ${defaultRounded} ${variants[variant]} ${className} ${disabled ? disabledStyles : ''}`}
      disabled={disabled}
      {...props}
    >
      {children}
    </button>
  );
}