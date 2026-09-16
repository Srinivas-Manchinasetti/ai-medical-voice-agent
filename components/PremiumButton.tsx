'use client';

import React, { type ReactNode, type MouseEventHandler } from 'react';
import SpecularButton from './SpecularButton';

export type PremiumButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
export type PremiumButtonSize = 'sm' | 'md' | 'lg';

export interface PremiumButtonProps {
  children: ReactNode;
  variant?: PremiumButtonVariant;
  size?: PremiumButtonSize;
  icon?: ReactNode;
  onClick?: MouseEventHandler<HTMLButtonElement>;
  disabled?: boolean;
  className?: string;
  type?: 'button' | 'submit' | 'reset';
  fullWidth?: boolean;
}

export const PremiumButton: React.FC<PremiumButtonProps> = ({
  children,
  variant = 'primary',
  size = 'md',
  icon,
  onClick,
  disabled = false,
  className = '',
  type = 'button',
  fullWidth = false,
}) => {
  // Primary variant uses the full Specular raymarched rim-light engine
  if (variant === 'primary') {
    return (
      <SpecularButton
        size={size}
        lineColor="#06B6D4"
        baseColor="#0F172A"
        textColor="#FFFFFF"
        intensity={1.25}
        shineSize={28}
        shineFade={35}
        autoAnimate={true}
        onClick={onClick}
        disabled={disabled}
        type={type}
        className={(fullWidth ? 'w-full ' : '') + className}
      >
        <span className="inline-flex items-center justify-center gap-2">
          {icon}
          <span>{children}</span>
        </span>
      </SpecularButton>
    );
  }

  // Danger variant uses red specular rim-light
  if (variant === 'danger') {
    return (
      <SpecularButton
        size={size}
        lineColor="#F43F5E"
        baseColor="#881337"
        textColor="#FFFFFF"
        intensity={1.15}
        shineSize={28}
        shineFade={35}
        autoAnimate={true}
        onClick={onClick}
        disabled={disabled}
        type={type}
        className={(fullWidth ? 'w-full ' : '') + className}
      >
        <span className="inline-flex items-center justify-center gap-2 text-rose-100">
          {icon}
          <span>{children}</span>
        </span>
      </SpecularButton>
    );
  }

  // Size styling for secondary & ghost
  const sizeClasses = {
    sm: 'px-3 py-1.5 text-xs rounded-lg gap-1.5',
    md: 'px-4 py-2.5 text-sm rounded-xl gap-2 font-bold',
    lg: 'px-6 py-3.5 text-base rounded-2xl gap-2.5 font-bold',
  }[size];

  // Secondary variant: Refined elevated surface with luminous hover glow and subtle border
  if (variant === 'secondary') {
    return (
      <button
        type={type}
        onClick={onClick}
        disabled={disabled}
        className={
          'inline-flex items-center justify-center transition-all duration-200 cursor-pointer border bg-white/95 hover:bg-white text-slate-900 border-slate-200/90 hover:border-cyan-400/80 shadow-xs hover:shadow-md hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-50 disabled:pointer-events-none ' +
          sizeClasses +
          (fullWidth ? ' w-full ' : ' ') +
          className
        }
      >
        {icon && <span className="flex-shrink-0 text-cyan-600">{icon}</span>}
        <span>{children}</span>
      </button>
    );
  }

  // Ghost variant: Clean, subtle hover lift, icon emphasis
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={
        'inline-flex items-center justify-center transition-all duration-200 cursor-pointer text-slate-600 hover:text-slate-950 hover:bg-slate-100/80 active:bg-slate-200/80 rounded-xl disabled:opacity-50 disabled:pointer-events-none ' +
        sizeClasses +
        (fullWidth ? ' w-full ' : ' ') +
        className
      }
    >
      {icon && <span className="flex-shrink-0">{icon}</span>}
      <span>{children}</span>
    </button>
  );
};

export default PremiumButton;
