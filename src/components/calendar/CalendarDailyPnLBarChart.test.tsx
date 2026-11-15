import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { CalendarDailyPnLBarChart } from './CalendarDailyPnLBarChart';
import { Trade } from './calendarTypes';

describe('CalendarDailyPnLBarChart', () => {
  const mockTradesByDay: Record<string, Trade[]> = {
    '2026-11-04': [
      {
        id: 1,
        symbol: 'EURUSD',
        direction: 'long',
        size: 1,
        entryprice: 1.08,
        exitprice: 1.09,
        entry_time: '2026-11-04T10:00:00',
        manual_pnl: 150,
      },
    ],
    '2026-11-05': [
      {
        id: 2,
        symbol: 'XAUUSD',
        direction: 'short',
        size: 1,
        entryprice: 2000,
        exitprice: 2020,
        entry_time: '2026-11-05T14:00:00',
        manual_pnl: -80,
      },
    ],
  };

  it('renders daily PnL bar chart with correct KPIs and day bars', () => {
    const handleSelectDay = vi.fn();

    render(
      <CalendarDailyPnLBarChart
        currentYear={2026}
        currentMonth={10} // 11月 (0-indexed)
        tradesByDay={mockTradesByDay}
        onSelectDay={handleSelectDay}
      />
    );

    // Title and badge
    expect(screen.getByText('当月每日盈亏柱形图 (Daily Net P&L)')).toBeDefined();
    expect(screen.getByText('2026年 11月')).toBeDefined();

    // Total net P&L = 150 - 80 = +$70.00
    expect(screen.getByText('+$70.00')).toBeDefined();

    // 1 Green / 1 Red
    expect(screen.getByText('1绿')).toBeDefined();
    expect(screen.getByText('1红')).toBeDefined();

    // Days 1 to 30 should exist in the chart
    expect(screen.getByText('4')).toBeDefined();
    expect(screen.getByText('5')).toBeDefined();
    expect(screen.getByText('30')).toBeDefined();

    // Clicking on Day 4 triggers onSelectDay
    const day4 = screen.getByText('4');
    fireEvent.click(day4);
    expect(handleSelectDay).toHaveBeenCalledWith('2026-11-04');
  });
});
