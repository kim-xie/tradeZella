import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Calendar, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, X, ChevronDown } from 'lucide-react';

export interface DateRangePickerProps {
  startDate: string; // YYYY-MM-DD
  endDate: string;   // YYYY-MM-DD
  onChange: (start: string, end: string) => void;
  onClear?: () => void;
  className?: string;
  disabled?: boolean;
}

function pad(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

function toISODate(year: number, month: number, day: number): string {
  return `${year}-${pad(month + 1)}-${pad(day)}`;
}

function parseISODate(s: string): { year: number; month: number; day: number } | null {
  if (!s) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (!m) return null;
  return { year: parseInt(m[1], 10), month: parseInt(m[2], 10) - 1, day: parseInt(m[3], 10) };
}

const WEEKDAYS = ['一', '二', '三', '四', '五', '六', '日'];

const PRESETS = [
  {
    label: '今日',
    getValue: () => {
      const now = new Date();
      const s = toISODate(now.getFullYear(), now.getMonth(), now.getDate());
      return { start: s, end: s };
    },
  },
  {
    label: '昨日',
    getValue: () => {
      const d = new Date();
      d.setDate(d.getDate() - 1);
      const s = toISODate(d.getFullYear(), d.getMonth(), d.getDate());
      return { start: s, end: s };
    },
  },
  {
    label: '近7天',
    getValue: () => {
      const now = new Date();
      const end = toISODate(now.getFullYear(), now.getMonth(), now.getDate());
      const d = new Date();
      d.setDate(d.getDate() - 6);
      const start = toISODate(d.getFullYear(), d.getMonth(), d.getDate());
      return { start, end };
    },
  },
  {
    label: '近30天',
    getValue: () => {
      const now = new Date();
      const end = toISODate(now.getFullYear(), now.getMonth(), now.getDate());
      const d = new Date();
      d.setDate(d.getDate() - 29);
      const start = toISODate(d.getFullYear(), d.getMonth(), d.getDate());
      return { start, end };
    },
  },
  {
    label: '本月',
    getValue: () => {
      const now = new Date();
      const start = toISODate(now.getFullYear(), now.getMonth(), 1);
      const end = toISODate(now.getFullYear(), now.getMonth(), now.getDate());
      return { start, end };
    },
  },
  {
    label: '上月',
    getValue: () => {
      const now = new Date();
      const firstDay = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const lastDay = new Date(now.getFullYear(), now.getMonth(), 0);
      return {
        start: toISODate(firstDay.getFullYear(), firstDay.getMonth(), firstDay.getDate()),
        end: toISODate(lastDay.getFullYear(), lastDay.getMonth(), lastDay.getDate()),
      };
    },
  },
];

export default function DateRangePicker({
  startDate,
  endDate,
  onChange,
  onClear,
  className = '',
  disabled = false,
}: DateRangePickerProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Raw string inputs for test compatibility and manual editing
  const [startInputVal, setStartInputVal] = useState(startDate || '');
  const [endInputVal, setEndInputVal] = useState(endDate || '');

  // Selection state when clicking on the calendar
  const [selectingStep, setSelectingStep] = useState<'start' | 'end'>('start');
  const [tempStart, setTempStart] = useState<string>('');
  const [tempEnd, setTempEnd] = useState<string>('');
  const [hoverDate, setHoverDate] = useState<string>('');

  const today = new Date();
  const todayStr = toISODate(today.getFullYear(), today.getMonth(), today.getDate());

  // Current calendar view (year and month)
  const initial = parseISODate(startDate || endDate || todayStr);
  const [viewYear, setViewYear] = useState(initial?.year ?? today.getFullYear());
  const [viewMonth, setViewMonth] = useState(initial?.month ?? today.getMonth());

  // Keep raw inputs in sync with props
  useEffect(() => {
    setStartInputVal(startDate || '');
  }, [startDate]);

  useEffect(() => {
    setEndInputVal(endDate || '');
  }, [endDate]);

  // When popover opens, sync temp selection and view
  useEffect(() => {
    if (open) {
      setTempStart(startDate || '');
      setTempEnd(endDate || '');
      setSelectingStep(startDate && !endDate ? 'end' : 'start');
      const base = parseISODate(startDate || endDate || todayStr);
      if (base) {
        setViewYear(base.year);
        setViewMonth(base.month);
      }
    }
  }, [open, startDate, endDate, todayStr]);

  // Click outside to close
  useEffect(() => {
    if (!open) return;
    const handleClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open]);

  // Escape key to close
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

  const prevYear = () => setViewYear((y) => y - 1);
  const nextYear = () => setViewYear((y) => y + 1);

  // Month calendar grid computation
  const { days, prevMonthTail, nextMonthHead } = useMemo(() => {
    const firstDayIndex = (new Date(viewYear, viewMonth, 1).getDay() + 6) % 7; // Monday = 0
    const totalDays = new Date(viewYear, viewMonth + 1, 0).getDate();
    const prevMonthDays = new Date(viewYear, viewMonth, 0).getDate();

    const prevTail: number[] = [];
    for (let i = firstDayIndex - 1; i >= 0; i--) {
      prevTail.push(prevMonthDays - i);
    }

    const currentDays: number[] = [];
    for (let d = 1; d <= totalDays; d++) {
      currentDays.push(d);
    }

    const remaining = (7 - ((prevTail.length + currentDays.length) % 7)) % 7;
    const nextHead: number[] = [];
    for (let d = 1; d <= remaining; d++) {
      nextHead.push(d);
    }

    return { days: currentDays, prevMonthTail: prevTail, nextMonthHead: nextHead };
  }, [viewYear, viewMonth]);

  const handleDateClick = (day: number) => {
    const dateStr = toISODate(viewYear, viewMonth, day);

    if (selectingStep === 'start') {
      setTempStart(dateStr);
      setTempEnd('');
      setSelectingStep('end');
    } else {
      // selecting end
      let finalStart = tempStart;
      let finalEnd = dateStr;
      if (finalEnd < finalStart) {
        // Swap if end is earlier than start
        finalStart = dateStr;
        finalEnd = tempStart;
      }
      setTempStart(finalStart);
      setTempEnd(finalEnd);
      setSelectingStep('start');
      onChange(finalStart, finalEnd);
      setOpen(false);
    }
  };

  const handleClear = () => {
    setTempStart('');
    setTempEnd('');
    setStartInputVal('');
    setEndInputVal('');
    setSelectingStep('start');
    if (onClear) {
      onClear();
    } else {
      onChange('', '');
    }
    setOpen(false);
  };

  const handlePresetClick = (preset: typeof PRESETS[0]) => {
    const { start, end } = preset.getValue();
    setTempStart(start);
    setTempEnd(end);
    onChange(start, end);
    setOpen(false);
  };

  const handleStartInputChange = (val: string) => {
    setStartInputVal(val);
    if (/^\d{4}-\d{2}-\d{2}$/.test(val)) {
      onChange(val, endDate);
    } else if (!val) {
      onChange('', endDate);
    }
  };

  const handleEndInputChange = (val: string) => {
    setEndInputVal(val);
    if (/^\d{4}-\d{2}-\d{2}$/.test(val)) {
      onChange(startDate, val);
    } else if (!val) {
      onChange(startDate, '');
    }
  };

  // Determine active visual range for days
  const effectiveStart = tempStart || startDate;
  const effectiveEnd = selectingStep === 'end' ? (hoverDate || tempEnd || endDate) : (tempEnd || endDate);
  const minRange = effectiveStart && effectiveEnd ? (effectiveStart <= effectiveEnd ? effectiveStart : effectiveEnd) : effectiveStart;
  const maxRange = effectiveStart && effectiveEnd ? (effectiveStart <= effectiveEnd ? effectiveEnd : effectiveStart) : effectiveEnd;

  const hasValue = !!(startDate || endDate);

  return (
    <div ref={containerRef} className={`relative select-none ${className}`}>
      {/* Sleek Mainstream Trigger Input */}
      <div
        onClick={() => {
          if (!disabled) setOpen(true);
        }}
        className={`group flex items-center h-[38px] px-3 bg-white dark:bg-[#070a13] border rounded-xl transition-all shadow-xs cursor-pointer ${
          open
            ? 'border-purple-500 ring-2 ring-purple-500/20'
            : 'border-gray-200 dark:border-white/10 hover:border-purple-400 dark:hover:border-purple-500/80'
        } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
      >
        <Calendar className="w-4 h-4 text-purple-500 shrink-0 mr-2 pointer-events-none group-hover:scale-110 transition-transform duration-200" />
        
        <input
          type="text"
          title="开始日期"
          placeholder="开始日期"
          value={startInputVal}
          onChange={(e) => handleStartInputChange(e.target.value)}
          onClick={(e) => {
            e.stopPropagation();
            setOpen(true);
          }}
          disabled={disabled}
          className="w-[88px] sm:w-[90px] bg-transparent text-sm text-gray-800 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none text-center font-mono cursor-pointer"
        />
        
        <span className="text-gray-400 dark:text-gray-500 text-sm px-1 select-none font-sans">至</span>
        
        <input
          type="text"
          title="结束日期"
          placeholder="结束日期"
          value={endInputVal}
          onChange={(e) => handleEndInputChange(e.target.value)}
          onClick={(e) => {
            e.stopPropagation();
            setOpen(true);
          }}
          disabled={disabled}
          className="w-[88px] sm:w-[90px] bg-transparent text-sm text-gray-800 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none text-center font-mono cursor-pointer"
        />

        {hasValue ? (
          <button
            type="button"
            title="清除时间段筛选"
            onClick={(e) => {
              e.stopPropagation();
              handleClear();
            }}
            className="ml-1 p-0.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 rounded hover:bg-gray-100 dark:hover:bg-white/10 transition"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        ) : (
          <ChevronDown className="w-3.5 h-3.5 text-gray-400 ml-1 pointer-events-none group-hover:text-purple-500 transition-colors" />
        )}
      </div>

      {/* Mainstream Dropdown Calendar Popover */}
      {open && (
        <div
          className="absolute left-0 mt-2 z-50 w-[310px] bg-white/95 dark:bg-[#0c101c]/95 backdrop-blur-xl border border-gray-200/90 dark:border-white/10 rounded-2xl shadow-2xl p-3.5 text-sm animate-in fade-in zoom-in-95 duration-150"
        >
          {/* Quick Presets Bar */}
          <div className="flex flex-wrap items-center gap-1.5 pb-2.5 mb-2.5 border-b border-gray-100 dark:border-white/5">
            {PRESETS.map((p) => (
              <button
                key={p.label}
                type="button"
                onClick={() => handlePresetClick(p)}
                className="text-[11px] px-2 py-0.5 rounded-md bg-gray-100 dark:bg-white/5 text-gray-600 dark:text-gray-300 hover:bg-purple-50 hover:text-purple-600 dark:hover:bg-purple-900/30 dark:hover:text-purple-300 transition-colors font-medium"
              >
                {p.label}
              </button>
            ))}
          </div>

          {/* Month / Year Navigator */}
          <div className="flex items-center justify-between px-1 mb-2">
            <div className="flex items-center gap-0.5">
              <button
                type="button"
                onClick={prevYear}
                title="上一年"
                className="p-1 rounded-lg text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-white/5 transition"
              >
                <ChevronsLeft className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={prevMonth}
                title="上个月"
                className="p-1 rounded-lg text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-white/5 transition"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
            </div>

            <span className="text-xs font-semibold text-gray-800 dark:text-gray-100">
              {viewYear}年 {viewMonth + 1}月
            </span>

            <div className="flex items-center gap-0.5">
              <button
                type="button"
                onClick={nextMonth}
                title="下个月"
                className="p-1 rounded-lg text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-white/5 transition"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={nextYear}
                title="下一年"
                className="p-1 rounded-lg text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-white/5 transition"
              >
                <ChevronsRight className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Weekday Names */}
          <div className="grid grid-cols-7 gap-1 text-center text-[11px] font-medium text-gray-400 dark:text-gray-500 mb-1">
            {WEEKDAYS.map((w) => (
              <span key={w} className="py-1">
                {w}
              </span>
            ))}
          </div>

          {/* Days Grid */}
          <div
            className="grid grid-cols-7 gap-y-1 text-xs"
            onMouseLeave={() => setHoverDate('')}
          >
            {/* Previous month tail */}
            {prevMonthTail.map((d, i) => (
              <div
                key={`prev-${i}`}
                className="h-8 flex items-center justify-center text-gray-300 dark:text-gray-600 cursor-not-allowed text-[11px]"
              >
                {d}
              </div>
            ))}

            {/* Current month days */}
            {days.map((d) => {
              const currentIso = toISODate(viewYear, viewMonth, d);
              const isToday = currentIso === todayStr;
              const isStart = currentIso === minRange;
              const isEnd = currentIso === maxRange;
              const isSingle = isStart && isEnd;
              const inRange =
                minRange && maxRange && currentIso >= minRange && currentIso <= maxRange;

              let cellStyle =
                'text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-white/10 rounded-lg';
              let containerStyle = '';

              if (isSingle) {
                cellStyle = 'bg-purple-600 text-white font-semibold rounded-lg shadow-sm';
              } else if (isStart) {
                cellStyle = 'bg-purple-600 text-white font-semibold rounded-l-lg shadow-sm';
                containerStyle = inRange ? 'bg-purple-50 dark:bg-purple-900/30 rounded-l-lg' : '';
              } else if (isEnd) {
                cellStyle = 'bg-purple-600 text-white font-semibold rounded-r-lg shadow-sm';
                containerStyle = inRange ? 'bg-purple-50 dark:bg-purple-900/30 rounded-r-lg' : '';
              } else if (inRange) {
                cellStyle =
                  'bg-purple-50 dark:bg-purple-900/40 text-purple-700 dark:text-purple-200 font-medium rounded-none';
                containerStyle = 'bg-purple-50 dark:bg-purple-900/40';
              }

              return (
                <div
                  key={d}
                  className={`h-8 flex items-center justify-center p-0 ${containerStyle}`}
                >
                  <button
                    type="button"
                    onClick={() => handleDateClick(d)}
                    onMouseEnter={() => {
                      if (selectingStep === 'end') setHoverDate(currentIso);
                    }}
                    className={`w-full h-full flex flex-col items-center justify-center text-xs relative transition-colors ${cellStyle}`}
                  >
                    <span>{d}</span>
                    {isToday && !isStart && !isEnd && (
                      <span className="w-1 h-1 rounded-full bg-purple-500 absolute bottom-1"></span>
                    )}
                  </button>
                </div>
              );
            })}

            {/* Next month head */}
            {nextMonthHead.map((d, i) => (
              <div
                key={`next-${i}`}
                className="h-8 flex items-center justify-center text-gray-300 dark:text-gray-600 cursor-not-allowed text-[11px]"
              >
                {d}
              </div>
            ))}
          </div>

          {/* Footer Bar */}
          <div className="flex items-center justify-between pt-2.5 mt-2 border-t border-gray-100 dark:border-white/5 text-xs">
            <span className="text-gray-500 dark:text-gray-400 text-[11px] font-mono truncate max-w-[170px]">
              {tempStart && tempEnd
                ? `${tempStart} ~ ${tempEnd}`
                : tempStart
                ? `${tempStart} ~ 选结束日`
                : '请选择时间段'}
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleClear}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 px-2 py-1 rounded hover:bg-gray-100 dark:hover:bg-white/5 transition text-[11px]"
              >
                清空
              </button>
              <button
                type="button"
                onClick={() => {
                  if (tempStart && tempEnd) {
                    onChange(tempStart, tempEnd);
                  }
                  setOpen(false);
                }}
                className="bg-purple-600 hover:bg-purple-700 text-white px-3 py-1 rounded-lg font-medium transition shadow-xs text-[11px]"
              >
                确定
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
