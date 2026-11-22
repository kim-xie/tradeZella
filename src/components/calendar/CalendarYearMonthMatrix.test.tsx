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

    // Section titles
    expect(screen.getByText('月度总览')).toBeDefined();
    expect(screen.getByText('年度总览')).toBeDefined();

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

  it('prominently highlights month and year cards when low-score days exist in localStorage', () => {
    localStorage.clear();
    // Simulate low score journal entry (1 star / 1分) on 2026-11-15 and 2026-11-16
    localStorage.setItem(
      'tradezella_daily_notes_2026-11-15',
      JSON.stringify({ note: 'FOMO追高亏损', tags: ['追高FOMO'], score: 1 })
    );
    localStorage.setItem(
      'tradezella_daily_notes_2026-11-16',
      JSON.stringify({ note: '重仓扛单', tags: ['重仓抗单'], score: 2 })
    );

    render(
      <CalendarYearMonthMatrix
        trades={mockTrades}
        currentYear={2026}
        currentMonth={10} // 11月
        onSelectMonth={vi.fn()}
        onSelectYear={vi.fn()}
      />
    );

    // Verify month card shows low score highlight badge: "2天低分"
    const lowScoreBadges = screen.getAllByText('2天低分');
    expect(lowScoreBadges.length).toBeGreaterThan(0);
  });
});
