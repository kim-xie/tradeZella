import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import DateRangePicker from './DateRangePicker';

describe('DateRangePicker', () => {
  it('renders start and end date inputs with correct titles', () => {
    const handleChange = vi.fn();
    render(
      <DateRangePicker
        startDate="2026-11-01"
        endDate="2026-11-15"
        onChange={handleChange}
      />
    );

    const startInput = screen.getByTitle('开始日期') as HTMLInputElement;
    const endInput = screen.getByTitle('结束日期') as HTMLInputElement;

    expect(startInput).toBeInTheDocument();
    expect(endInput).toBeInTheDocument();
    expect(startInput.value).toBe('2026-11-01');
    expect(endInput.value).toBe('2026-11-15');
  });

  it('triggers onChange when manual date inputs are edited', () => {
    const handleChange = vi.fn();
    render(
      <DateRangePicker
        startDate="2026-11-01"
        endDate="2026-11-15"
        onChange={handleChange}
      />
    );

    const startInput = screen.getByTitle('开始日期');
    fireEvent.change(startInput, { target: { value: '2026-11-05' } });
    expect(handleChange).toHaveBeenCalledWith('2026-11-05', '2026-11-15');

    const endInput = screen.getByTitle('结束日期');
    fireEvent.change(endInput, { target: { value: '2026-11-20' } });
    expect(handleChange).toHaveBeenCalledWith('2026-11-01', '2026-11-20');
  });

  it('opens dropdown calendar on click and allows selecting presets', () => {
    const handleChange = vi.fn();
    render(
      <DateRangePicker
        startDate=""
        endDate=""
        onChange={handleChange}
      />
    );

    // Click input to open calendar popover
    const startInput = screen.getByTitle('开始日期');
    fireEvent.click(startInput);

    // Popover should be visible with presets
    expect(screen.getByText('今日')).toBeInTheDocument();
    expect(screen.getByText('近7天')).toBeInTheDocument();

    // Click preset "近7天"
    fireEvent.click(screen.getByText('近7天'));
    expect(handleChange).toHaveBeenCalled();
  });

  it('clears date selection when clear button is clicked', () => {
    const handleChange = vi.fn();
    const handleClear = vi.fn();
    render(
      <DateRangePicker
        startDate="2026-11-01"
        endDate="2026-11-15"
        onChange={handleChange}
        onClear={handleClear}
      />
    );

    const clearBtn = screen.getByTitle('清除时间段筛选');
    fireEvent.click(clearBtn);

    expect(handleClear).toHaveBeenCalled();
  });
});
