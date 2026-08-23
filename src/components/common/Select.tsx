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
}

export default function Select({
    value,
    onChange,
    options,
    placeholder = 'Select...',
    className = '',
    disabled = false,
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
        <div ref={ref} className={`relative ${className}`}>
            <button
                type="button"
                disabled={disabled}
                onClick={() => setOpen((o) => !o)}
                className="w-full flex items-center justify-between px-3 py-2 text-sm border border-gray-300 rounded-md bg-white dark:bg-gray-700 dark:border-gray-600 dark:text-white hover:border-purple-400 dark:hover:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-500/30 focus:border-purple-500 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
                <span className={selected ? 'text-gray-900 dark:text-white' : 'text-gray-400 dark:text-gray-500'}>
                    {selected ? selected.label : placeholder}
                </span>
                <ChevronDown
                    size={16}
                    className={`text-gray-400 dark:text-gray-400 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
                />
            </button>
            {open && (
                <div className="absolute z-20 mt-1 w-full bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-md shadow-lg py-1 max-h-60 overflow-auto">
                    {options.map((opt) => (
                        <button
                            key={opt.value}
                            type="button"
                            onClick={() => {
                                onChange(opt.value);
                                setOpen(false);
                            }}
                            className="w-full flex items-center justify-between px-3 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-purple-50 dark:hover:bg-gray-600 transition-colors"
                        >
                            <span>{opt.label}</span>
                            {opt.value === value && (
                                <Check size={14} className="text-purple-600 dark:text-purple-400" />
                            )}
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}
