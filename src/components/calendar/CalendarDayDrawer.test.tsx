import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { CalendarDayDrawer } from './CalendarDayDrawer';
import { CalendarMonthBanner } from './CalendarMonthBanner';
import { Trade, MonthStats } from './calendarTypes';

describe('CalendarDayDrawer', () => {
  const mockTrades: Trade[] = [
    {
      id: 101,
      symbol: 'EURUSD',
      direction: 'long',
      size: 1.5,
      entryprice: 1.0850,
      exitprice: 1.0920,
      entry_time: '2026-11-15T09:30:00',
      exit_time: '2026-11-15T11:45:00',
      manual_pnl: 105.00,
      notes: 'Good breakout on London session',
      tags: ['London', 'Breakout'],
    },
  ];

  it('renders day summary and trade list correctly, removes K-line button, and opens trade detail drawer on click', () => {
    const handleClose = vi.fn();
    const handleSelectTrade = vi.fn();

    render(
      <CalendarDayDrawer
        dateStr="2026-11-15"
        trades={mockTrades}
        onClose={handleClose}
        onSelectTrade={handleSelectTrade}
      />
    );

    expect(screen.getByText('2026-11-15')).toBeDefined();
    expect(screen.getByText('EURUSD')).toBeDefined();
    expect(screen.getAllByText('+$105.00').length).toBeGreaterThan(0);
    expect(screen.getByText('#London')).toBeDefined();

    // Verify K-line marker button is removed and new hint is present
    expect(screen.queryByText('K线打点')).toBeNull();
    expect(screen.getByText('点击订单查看详情')).toBeDefined();

    // Click order item to open TradeDetailDrawer
    const orderBtn = screen.getByRole('button', { name: '查看订单详情' });
    fireEvent.click(orderBtn);
    expect(handleSelectTrade).toHaveBeenCalledWith(mockTrades[0]);
    expect(screen.getByText('交易复盘详情')).toBeDefined();

    // Close detail drawer returns to day drawer
    const closeDetailBtn = screen.getByLabelText('关闭详情抽屉');
    fireEvent.click(closeDetailBtn);
    expect(screen.queryByText('交易复盘详情')).toBeNull();

    // Close day drawer
    const closeBtn = screen.getByLabelText('关闭抽屉');
    fireEvent.click(closeBtn);
    expect(handleClose).toHaveBeenCalled();
  });

  it('toggles maximize and restore full width', () => {
    const handleClose = vi.fn();
    const handleOpenChart = vi.fn();

    render(
      <CalendarDayDrawer
        dateStr="2026-11-15"
        trades={mockTrades}
        onClose={handleClose}
        onOpenChart={handleOpenChart}
      />
    );

    const toggleBtn = screen.getByTitle('全屏铺满抽屉');
    expect(toggleBtn).toBeDefined();

    // Click to maximize
    fireEvent.click(toggleBtn);
    expect(screen.getByTitle('还原抽屉宽度')).toBeDefined();

    // Click to restore
    fireEvent.click(screen.getByTitle('还原抽屉宽度'));
    expect(screen.getByTitle('全屏铺满抽屉')).toBeDefined();
  });

  it('locks background scroll and applies highest z-index & overflow-x-hidden', () => {
    const handleClose = vi.fn();
    const handleOpenChart = vi.fn();

    const { unmount } = render(
      <CalendarDayDrawer
        dateStr="2026-11-15"
        trades={mockTrades}
        onClose={handleClose}
        onOpenChart={handleOpenChart}
      />
    );

    // Verify background scroll lock
    expect(document.body.style.overflow).toBe('hidden');
    expect(document.documentElement.style.overflow).toBe('hidden');

    // Verify highest z-index on drawer panel
    const drawerAside = screen.getByRole('complementary', { name: '日内交易复盘抽屉' });
    expect(drawerAside.className).toContain('z-[1000]');

    // Verify backdrop has z-[999]
    const backdrop = document.querySelector('.z-\\[999\\]');
    expect(backdrop).not.toBeNull();

    // Verify scrollable body has overflow-y-auto and overflow-x-hidden
    const scrollBody = drawerAside.querySelector('.overflow-y-auto');
    expect(scrollBody).not.toBeNull();
    expect(scrollBody?.className).toContain('overflow-x-hidden');
    expect(scrollBody?.className).toContain('overscroll-contain');

    // Unmount and verify scroll unlock restoration
    unmount();
    expect(document.body.style.overflow).toBe('');
    expect(document.documentElement.style.overflow).toBe('');
  });

  it('allows rating daily journal score, highlights low score with alert banner, and saves to localStorage', () => {
    localStorage.clear();
    const handleClose = vi.fn();
    const handleOpenChart = vi.fn();

    render(
      <CalendarDayDrawer
        dateStr="2026-11-15"
        trades={mockTrades}
        onClose={handleClose}
        onOpenChart={handleOpenChart}
      />
    );

    // Initial state:未打分
    expect(screen.getByText(/日内复盘执行打分/)).toBeDefined();

    // Click 1 star / 1分 (严重违规)
    const score1Btn = screen.getByTitle(/1分 · 严重违规/);
    fireEvent.click(score1Btn);

    // Verify low score warning banner appears
    expect(screen.getByText(/严重违纪低分预警（重点突出复盘日）/)).toBeDefined();

    // Click 保存日记
    const saveBtn = screen.getByText('保存日记');
    fireEvent.click(saveBtn);

    // Verify persisted into localStorage with score = 1
    const stored = localStorage.getItem('tradezella_daily_notes_2026-11-15');
    expect(stored).not.toBeNull();
    const parsed = JSON.parse(stored!);
    expect(parsed.score).toBe(1);
  });
});

describe('CalendarMonthBanner', () => {
  const mockStats: MonthStats = {
    netPnL: 3450.50,
    grossProfit: 5200,
    grossLoss: 1749.50,
    winRate: 68.5,
    profitFactor: 2.97,
    totalTrades: 32,
    completedTrades: 30,
    greenDaysCount: 14,
    redDaysCount: 4,
    breakevenDaysCount: 2,
    tradingDaysCount: 20,
    avgDailyPnL: 172.525,
    bestDay: { date: '2026-11-04', pnl: 1250, count: 4 },
    worstDay: { date: '2026-11-12', pnl: -450, count: 2 },
    totalVolume: 42.5,
    expectancy: 115.02,
  };

  it('renders monthly net pnl, green/red days ratio, and extremes', () => {
    render(<CalendarMonthBanner stats={mockStats} currentDate={new Date('2026-11-01')} />);

    expect(screen.getByText('+$3,450.50')).toBeDefined();
    expect(screen.getByText('14 绿日')).toBeDefined();
    expect(screen.getByText('4 红日')).toBeDefined();
    expect(screen.getByText('2.97')).toBeDefined();
    expect(screen.getByText('+$1,250.00')).toBeDefined();
    expect(screen.getByText('-$450.00')).toBeDefined();
  });
});
