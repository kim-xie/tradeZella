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
      expect(screen.getByText('月盈亏统计')).toBeInTheDocument();
      expect(screen.getByText('月度总览')).toBeInTheDocument();
    });

    // Navigate to previous month: "回到今日" should now appear
    fireEvent.click(screen.getByTitle('上个月'));
    expect(screen.getByText('回到今日')).toBeInTheDocument();

    // Click "回到今日": navigates back to current month and hides the button
    fireEvent.click(screen.getByText('回到今日'));
    expect(screen.queryByText('回到今日')).toBeNull();
  });

  it('renders modern Select component for month and removed year dropdown', async () => {
    const mockTrades = [
      {
        id: 1,
        symbol: 'XAUUSD',
        direction: 'long',
        size: 1.0,
        entryprice: 2600,
        exitprice: 2620,
        entry_time: '2026-06-15T10:00:00',
        createdat: '2026-06-15T10:00:00',
        manual_pnl: 200,
      },
    ];
    vi.spyOn(api, 'getUserTrades').mockResolvedValue(mockTrades as any);
    localStorage.setItem('token', 'test-token');

    renderWithProviders(<StatsPage />);

    // Verify year select dropdown is NOT present
    expect(screen.queryByRole('button', { name: '选择年份' })).toBeNull();

    // Check that aria-label "选择月份" button exists
    const monthSelectBtn = await screen.findByRole('button', { name: '选择月份' });
    expect(monthSelectBtn).toBeInTheDocument();

    // Click month select dropdown and choose a specific month (e.g. 5月)
    fireEvent.click(monthSelectBtn);
    const mayOption = screen.getByRole('button', { name: '5月' });
    expect(mayOption).toBeInTheDocument();
    fireEvent.click(mayOption);

    // Verify month changed: month select button now displays '5月'
    expect(monthSelectBtn).toHaveTextContent('5月');
  });

  it('prominently highlights low score days on the calendar grid', async () => {
    const today = new Date().toISOString().split('T')[0];
    const mockTrades = [
      {
        id: 99,
        symbol: 'BTCUSD',
        direction: 'long',
        size: 0.5,
        entryprice: 60000,
        exitprice: 59000,
        entry_time: `${today}T11:00:00`,
        createdat: `${today}T11:00:00`,
        manual_pnl: -500,
      },
    ];
    vi.spyOn(api, 'getUserTrades').mockResolvedValue(mockTrades as any);
    localStorage.setItem('token', 'test-token');
    // Set a low review score (1 star / 1分) for today
    localStorage.setItem(
      `tradezella_daily_notes_${today}`,
      JSON.stringify({ note: '情绪失控严重违规', tags: ['报复性交易'], score: 1 })
    );

    renderWithProviders(<StatsPage />);

    // Verify low score highlight badge and warning label
    await waitFor(() => {
      expect(screen.getByText('1分')).toBeInTheDocument();
      expect(screen.getByText(/重点复盘日 \(1分\)/)).toBeInTheDocument();
    });
  });
});
