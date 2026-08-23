import React, { useState, useRef, useEffect } from 'react';
import { Calendar, Clock, ChevronLeft, ChevronRight, X } from 'lucide-react';

interface DateTimePickerProps {
    value: string;
    onChange: (value: string) => void;
    placeholder?: string;
    className?: string;
    disabled?: boolean;
    max?: string;
    error?: string;
}

const MONTHS = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December',
];
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function pad(n: number): string {
    return n < 10 ? `0${n}` : String(n);
}

function toISODate(year: number, month: number, day: number): string {
    return `${year}-${pad(month + 1)}-${pad(day)}`;
}

function combine(dateISO: string, timeStr: string): string {
    if (!dateISO) return '';
    if (!timeStr) return dateISO;
    return `${dateISO}T${timeStr}`;
}

function parseValue(v: string): { date: string; time: string } {
    if (!v) return { date: '', time: '' };
    const [date, time] = v.split('T');
    return { date: date || '', time: time || '' };
}

function parseISODate(s: string): { year: number; month: number; day: number } | null {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
    if (!m) return null;
    return { year: +m[1], month: +m[2] - 1, day: +m[3] };
}

function makeHours(): number[] {
    return Array.from({ length: 24 }, (_, i) => i);
}
function makeMinutes(): number[] {
    return Array.from({ length: 60 }, (_, i) => i);
}

export default function DateTimePicker({
    value,
    onChange,
    placeholder = 'Select date & time',
    className = '',
    disabled = false,
    max,
    error,
}: DateTimePickerProps) {
    const [open, setOpen] = useState(false);
    const ref = useRef<HTMLDivElement>(null);

    const { date: dateStr, time: timeStr } = parseValue(value);
    const [hour, minute] = timeStr.split(':').map((n) => (n ? parseInt(n, 10) : NaN));

    const today = new Date();
    const todayStr = toISODate(today.getFullYear(), today.getMonth(), today.getDate());

    const initial = dateStr ? parseISODate(dateStr) : null;
    const [viewYear, setViewYear] = useState(initial?.year ?? today.getFullYear());
    const [viewMonth, setViewMonth] = useState(initial?.month ?? today.getMonth());

    useEffect(() => {
        if (!open) return;
        const base = dateStr ? parseISODate(dateStr) : null;
        setViewYear(base?.year ?? today.getFullYear());
        setViewMonth(base?.month ?? today.getMonth());
    }, [open]);

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

    const prevMonth = () => {
        if (viewMonth === 0) {
            setViewMonth(11);
            setViewYear((y) => y - 1);
        } else {
            setViewMonth((m) => m - 1);
        }
    };
    const nextMonth = () => {
        if (viewMonth === 11) {
            setViewMonth(0);
            setViewYear((y) => y + 1);
        } else {
            setViewMonth((m) => m + 1);
        }
    };

    const firstDayOfMonth = new Date(viewYear, viewMonth, 1).getDay();
    const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();

    const cells: (number | null)[] = [];
    for (let i = 0; i < firstDayOfMonth; i++) cells.push(null);
    for (let d = 1; d <= daysInMonth; d++) cells.push(d);

    const maxDate = max ? parseValue(max).date : '';
    const maxTime = max ? parseValue(max).time : '';

    const isDayDisabled = (day: number) => {
        if (!maxDate) return false;
        return toISODate(viewYear, viewMonth, day) > maxDate;
    };

    const isTimeDisabled = (h: number, m: number) => {
        if (!maxDate || !maxTime) return false;
        if (dateStr !== maxDate) return false;
        const [maxH, maxM] = maxTime.split(':').map((n) => parseInt(n, 10));
        return h > maxH || (h === maxH && m > maxM);
    };

    const handleSelectDate = (day: number) => {
        if (isDayDisabled(day)) return;
        const newDate = toISODate(viewYear, viewMonth, day);
        const newTime = timeStr || '00:00';
        onChange(combine(newDate, newTime));
    };

    const handleHourChange = (h: number) => {
        const m = isNaN(minute) ? 0 : minute;
        onChange(combine(dateStr || todayStr, `${pad(h)}:${pad(m)}`));
    };

    const handleMinuteChange = (m: number) => {
        const h = isNaN(hour) ? 0 : hour;
        onChange(combine(dateStr || todayStr, `${pad(h)}:${pad(m)}`));
    };

    const handleClear = () => onChange('');

    const displayValue = value
        ? value.replace('T', ' ')
        : '';

    const isToday = (day: number) => toISODate(viewYear, viewMonth, day) === todayStr;
    const isSelected = (day: number) => toISODate(viewYear, viewMonth, day) === dateStr;

    return (
        <div ref={ref} className={`relative ${className}`}>
            <div className="relative">
                <button
                    type="button"
                    disabled={disabled}
                    onClick={() => setOpen((o) => !o)}
                    className={`w-full flex items-center px-2 py-2 text-sm border rounded-md bg-white dark:bg-gray-700 dark:text-white hover:border-purple-400 dark:hover:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-500/30 focus:border-purple-500 transition-all disabled:opacity-50 disabled:cursor-not-allowed ${value ? 'pr-8' : ''} ${error ? 'border-red-500' : 'border-gray-300 dark:border-gray-600'
                        }`}
                >
                    <Calendar size={16} className="text-gray-400 dark:text-gray-400 mr-1.5 shrink-0" />
                    <span className={`flex-1 text-left truncate ${displayValue ? 'text-gray-900 dark:text-white' : 'text-gray-400 dark:text-gray-500'}`}>
                        {displayValue || placeholder}
                    </span>
                </button>
                {value && (
                    <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); handleClear(); }}
                        className="absolute right-1 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 p-0.5"
                    >
                        <X size={14} />
                    </button>
                )}
            </div>

            {open && (
                <div className="absolute z-30 mt-1 w-72 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md shadow-lg p-3">
                    <div className="flex items-center justify-between mb-3">
                        <button
                            type="button"
                            onClick={prevMonth}
                            className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-300"
                        >
                            <ChevronLeft size={18} />
                        </button>
                        <span className="text-sm font-medium text-gray-900 dark:text-white">
                            {MONTHS[viewMonth]} {viewYear}
                        </span>
                        <button
                            type="button"
                            onClick={nextMonth}
                            className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-300"
                        >
                            <ChevronRight size={18} />
                        </button>
                    </div>

                    <div className="grid grid-cols-7 gap-1 mb-1">
                        {WEEKDAYS.map((d) => (
                            <div key={d} className="text-center text-xs text-gray-500 dark:text-gray-400 font-medium">
                                {d}
                            </div>
                        ))}
                    </div>

                    <div className="grid grid-cols-7 gap-1">
                        {cells.map((day, i) =>
                            day === null ? (
                                <div key={i} />
                            ) : (
                                <button
                                    key={i}
                                    type="button"
                                    onClick={() => handleSelectDate(day)}
                                    disabled={isDayDisabled(day)}
                                    className={`text-center text-sm py-1.5 rounded transition-colors
                    ${isSelected(day)
                                            ? 'bg-purple-600 text-white font-medium'
                                            : isToday(day)
                                                ? 'bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300 font-medium'
                                                : 'text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700'}
                    ${isDayDisabled(day) ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'}
                  `}
                                >
                                    {day}
                                </button>
                            )
                        )}
                    </div>

                    <div className="flex items-center gap-2 mt-3 pt-3 border-t border-gray-100 dark:border-gray-700">
                        <Clock size={16} className="text-gray-400 dark:text-gray-400" />
                        <select
                            value={isNaN(hour) ? 0 : hour}
                            onChange={(e) => handleHourChange(parseInt(e.target.value, 10))}
                            className="flex-1 px-2 py-1 text-sm border border-gray-300 rounded bg-white dark:bg-gray-700 dark:text-white dark:border-gray-600 focus:outline-none focus:border-purple-500"
                        >
                            {makeHours().map((h) => {
                                const disabled = isTimeDisabled(h, isNaN(minute) ? 0 : minute);
                                return (
                                    <option key={h} value={h} disabled={disabled}>
                                        {pad(h)}
                                    </option>
                                );
                            })}
                        </select>
                        <span className="text-gray-500 dark:text-gray-400">:</span>
                        <select
                            value={isNaN(minute) ? 0 : minute}
                            onChange={(e) => handleMinuteChange(parseInt(e.target.value, 10))}
                            className="flex-1 px-2 py-1 text-sm border border-gray-300 rounded bg-white dark:bg-gray-700 dark:text-white dark:border-gray-600 focus:outline-none focus:border-purple-500"
                        >
                            {makeMinutes().map((m) => {
                                const disabled = isTimeDisabled(isNaN(hour) ? 0 : hour, m);
                                return (
                                    <option key={m} value={m} disabled={disabled}>
                                        {pad(m)}
                                    </option>
                                );
                            })}
                        </select>
                    </div>
                </div>
            )}
            {error && <p className="mt-1 text-xs text-red-500">{error}</p>}
        </div>
    );
}
