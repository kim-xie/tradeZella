import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import StatsPage from './StatsPage';
import * as api from '../services/api';

vi.mock('../services/api');
vi.mock('../components/TradeExecutionChart', () => ({
  default: () => <div data-testid="mock-trade-execution-chart" />,
}));

const renderWithProviders = (ui: React.ReactElement) => {
  return render(
    <MemoryRouter>
      {ui}
    </MemoryRouter>
  );
};

describe('StatsPage (Trading Calendar)', () => {
  it('renders prompt if not logged in', async () => {
    localStorage.removeItem('token');
    renderWithProviders(<StatsPage />);
    expect(await screen.findByText('请登录后查看交易日历与统计数据。')).toBeInTheDocument();
  });

  it('renders trading calendar and matrix successfully when logged in', async () => {
    const today = new Date().toISOString().split('T')[0];
    const mockTrades = [
      {
        id: 1,
        symbol: 'XAUUSD',
        direction: 'long',
        size: 1.0,
        entryprice: 2600,
        exitprice: 2620,
        entry_time: `${today}T10:00:00`,
        createdat: `${today}T10:00:00`,
        manual_pnl: 200,
      },
      {
        id: 2,
        symbol: 'EURUSD',
        direction: 'short',
        size: 2.0,
        entryprice: 1.0850,
        exitprice: 1.0880,
        entry_time: `${today}T14:30:00`,
        createdat: `${today}T14:30:00`,
        manual_pnl: -60,
      },
    ];
    vi.spyOn(api, 'getUserTrades').mockResolvedValue(mockTrades as any);
    localStorage.setItem('token', 'test-token');

    renderWithProviders(<StatsPage />);

    // Check calendar navigation & elements
    await waitFor(() => {
      // In current month/year, "回到今日" should NOT be shown
      expect(screen.queryByText('回到今日')).toBeNull();
      expect(screen.getByText('周汇总')).toBeInTheDocument();
      expect(screen.getByText('当月每日盈亏柱形图 (Daily Net P&L)')).toBeInTheDocument();
      expect(screen.getByText('MONTHLY_PERFORMANCE_BREAKDOWN')).toBeInTheDocument();
    });

    // Navigate to previous month: "回到今日" should now appear
    fireEvent.click(screen.getByTitle('上个月'));
    expect(screen.getByText('回到今日')).toBeInTheDocument();

    // Click "回到今日": navigates back to current month and hides the button
    fireEvent.click(screen.getByText('回到今日'));
    expect(screen.queryByText('回到今日')).toBeNull();
  });
});
