import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, Check } from 'lucide-react';

export interface SelectOption {
    value: string;
    label: string;
}

interface SelectProps {
    value: string;
    onChange: (value: string) => void;
    options: SelectOption[];
    placeholder?: string;
    className?: string;
    disabled?: boolean;
    buttonClassName?: string;
    menuClassName?: string;
    'aria-label'?: string;
}

export default function Select({
    value,
    onChange,
    options,
    placeholder = 'Select...',
    className = '',
    disabled = false,
    buttonClassName = '',
    menuClassName = '',
    'aria-label': ariaLabel,
}: SelectProps) {
    const [open, setOpen] = useState(false);
    const ref = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!open) return;
        const handleClick = (e: MouseEvent) => {
            if (ref.current && !ref.current.contains(e.target as Node)) {
                setOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClick);
        return () => document.removeEventListener('mousedown', handleClick);
    }, [open]);

    useEffect(() => {
        if (!open) return;
        const handleKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') setOpen(false);
        };
        document.addEventListener('keydown', handleKey);
        return () => document.removeEventListener('keydown', handleKey);
    }, [open]);

    const selected = options.find((opt) => opt.value === value);

    return (
        <div ref={ref} className={`relative ${open ? 'z-50' : 'z-10'} ${className}`}>
            <button
                type="button"
                disabled={disabled}
                aria-label={ariaLabel}
                onClick={() => setOpen((o) => !o)}
                className={`w-full h-[38px] flex items-center justify-between px-3.5 text-sm border border-gray-200 dark:border-white/10 rounded-xl bg-white dark:bg-[#070a13] text-gray-900 dark:text-white hover:border-purple-400 dark:hover:border-purple-500/80 focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 transition-all shadow-2xs disabled:opacity-50 disabled:cursor-not-allowed ${buttonClassName}`}
            >
                <span className={`truncate text-sm ${selected ? 'text-gray-900 dark:text-white' : 'text-gray-400 dark:text-gray-500'}`}>
                    {selected ? selected.label : placeholder}
                </span>
                <ChevronDown
                    size={16}
                    className={`text-gray-400 dark:text-gray-400 transition-transform duration-200 shrink-0 ml-1.5 ${open ? 'rotate-180 text-purple-500' : ''}`}
                />
            </button>
            {open && (
                <div className={`absolute z-50 mt-1.5 w-full bg-white dark:bg-[#0c101c] border border-gray-200 dark:border-white/10 rounded-xl shadow-xl py-1 max-h-60 overflow-auto ${menuClassName}`}>
                    {options.map((opt) => (
                        <button
                            key={opt.value}
                            type="button"
                            onClick={() => {
                                onChange(opt.value);
                                setOpen(false);
                            }}
                            className="w-full flex items-center justify-between px-3.5 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-purple-50 dark:hover:bg-purple-900/30 hover:text-purple-600 dark:hover:text-purple-300 transition-colors"
                        >
                            <span className="truncate">{opt.label}</span>
                            {opt.value === value && (
                                <Check size={14} className="text-purple-600 dark:text-purple-400 shrink-0 ml-2" />
                            )}
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}
