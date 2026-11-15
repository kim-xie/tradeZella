import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { CalendarYearMonthMatrix } from './CalendarYearMonthMatrix';
import { Trade } from './calendarTypes';

describe('CalendarYearMonthMatrix', () => {
  const mockTrades: Trade[] = [
    {
      id: 1,
      symbol: 'BTCUSD',
      direction: 'long',
      size: 1,
      entryprice: 60000,
      exitprice: 60060,
      entry_time: '2026-11-15T10:00:00',
      manual_pnl: 60,
    },
    {
      id: 2,
      symbol: 'ETHUSD',
      direction: 'short',
      size: 1,
      entryprice: 3000,
      exitprice: 3210,
      entry_time: '2026-10-10T10:00:00',
      manual_pnl: -210,
    },
    {
      id: 3,
      symbol: 'SOLUSD',
      direction: 'long',
      size: 10,
      entryprice: 150,
      exitprice: 120,
      entry_time: '2026-11-20T10:00:00',
      manual_pnl: -2132,
    },
  ];

  it('renders monthly performance breakdown and yearly archive', () => {
    const handleSelectMonth = vi.fn();
    const handleSelectYear = vi.fn();

    render(
      <CalendarYearMonthMatrix
        trades={mockTrades}
        currentYear={2026}
        currentMonth={10} // 11月 (0-indexed)
        onSelectMonth={handleSelectMonth}
        onSelectYear={handleSelectYear}
      />
    );

    // Terminal titles
    expect(screen.getByText('MONTHLY_PERFORMANCE_BREAKDOWN')).toBeDefined();
    expect(screen.getByText(/2026年度月份复盘/)).toBeDefined();
    expect(screen.getByText('YEARLY_ARCHIVE_DATA')).toBeDefined();

    // Month headers
    expect(screen.getByText('1月')).toBeDefined();
    expect(screen.getByText('11月')).toBeDefined();
    expect(screen.getByText('1-6月 [半年度]')).toBeDefined();
    expect(screen.getByText('7-12月 [半年度]')).toBeDefined();

    // Check CURRENT badge for 11月
    expect(screen.getByText('CURRENT')).toBeDefined();

    // Check ACTIVE badge for 2026年
    expect(screen.getByText('ACTIVE')).toBeDefined();
    expect(screen.getByText('2026年')).toBeDefined();

    // Click on 10月
    const octCard = screen.getByText('10月');
    fireEvent.click(octCard);
    expect(handleSelectMonth).toHaveBeenCalledWith(2026, 9);

    // Click on 2026年
    const yearCard = screen.getByText('2026年');
    fireEvent.click(yearCard);
    expect(handleSelectYear).toHaveBeenCalledWith(2026);
  });
});
