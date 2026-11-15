import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import DashboardPage from './DashboardPage';
import * as api from '../services/api';

vi.mock('../services/api');
vi.mock('../components/common/SEO', () => ({
  default: () => null,
}));

const renderWithProviders = (ui: React.ReactElement) => {
  return render(
    <MemoryRouter>
      {ui}
    </MemoryRouter>
  );
};

describe('DashboardPage (TradeZella & TradeSync Style)', () => {
  it('does NOT render the old clunky title banner', async () => {
    vi.spyOn(api, 'getUserTrades').mockResolvedValue([]);
    localStorage.setItem('token', 'test-token');

    renderWithProviders(<DashboardPage />);

    await waitFor(() => {
      expect(screen.queryByText(/量化交易总览终端/)).not.toBeInTheDocument();
      expect(screen.queryByText(/全资产实时多账户接入/)).not.toBeInTheDocument();
      expect(screen.queryByText('综合账户实盘总览')).not.toBeInTheDocument();
    });
  });

  it('renders modern TradeZella KPI metrics and header controls', async () => {
    const today = new Date().toISOString().split('T')[0];
    const mockTrades = [
      {
        id: 1,
        symbol: 'EURUSD',
        direction: 'long',
        size: 1.0,
        entryprice: 100,
        exitprice: 150,
        entry_time: `${today}T10:00:00`,
        createdat: `${today}T10:00:00`,
        rating: 5,
        sentiment: 'Zen'
      },
      {
        id: 2,
        symbol: 'XAUUSD',
        direction: 'short',
        size: 1.0,
        entryprice: 2000,
        exitprice: 2020,
        entry_time: `${today}T11:00:00`,
        createdat: `${today}T11:00:00`,
        rating: 4,
        sentiment: 'Composed'
      }
    ];

    vi.spyOn(api, 'getUserTrades').mockResolvedValue(mockTrades);
    localStorage.setItem('token', 'test-token');

    renderWithProviders(<DashboardPage />);

    await waitFor(() => {
      expect(screen.getByText('净利润 (Net P&L)')).toBeInTheDocument();
    });

    // Timeframe selector
    expect(screen.getByText('今日')).toBeInTheDocument();
    expect(screen.getByText('本周')).toBeInTheDocument();
    expect(screen.getByText('本月')).toBeInTheDocument();
    expect(screen.getByText('今年')).toBeInTheDocument();
    expect(screen.getByText('全部')).toBeInTheDocument();

    // Primary KPI cards
    expect(screen.getByText('净利润 (Net P&L)')).toBeInTheDocument();
    expect(screen.getByText('综合胜率 (Win Rate)')).toBeInTheDocument();
    expect(screen.getByText('盈亏比 (Profit Factor)')).toBeInTheDocument();
    expect(screen.getByText('最大资金回撤 (Drawdown)')).toBeInTheDocument();

    // Chart tabs
    expect(screen.getByText(/资金净值走势/)).toBeInTheDocument();
    expect(screen.getByText(/每日盈亏柱状/)).toBeInTheDocument();
    expect(screen.getByText(/时段透视/)).toBeInTheDocument();

    // Secondary deep insight panels
    expect(screen.getByText('多空方向深度透视')).toBeInTheDocument();
    expect(screen.getByText('盈利 Top')).toBeInTheDocument();
    expect(screen.getByText('亏损 Top')).toBeInTheDocument();
    expect(screen.getByText('知行合一纪律与心智')).toBeInTheDocument();

    // Net PnL value: +50 - 20 = +$30.00
    expect(screen.getByText('+$30.00')).toBeInTheDocument();
  });

  it('allows switching chart tabs between Equity Curve, Daily P&L and Sessions', async () => {
    const today = new Date().toISOString().split('T')[0];
    const mockTrades = [
      {
        id: 1,
        symbol: 'BTCUSD',
        direction: 'long',
        size: 0.1,
        entryprice: 60000,
        exitprice: 62000,
        entry_time: `${today}T09:30:00`,
        createdat: `${today}T09:30:00`,
      }
    ];

    vi.spyOn(api, 'getUserTrades').mockResolvedValue(mockTrades);
    localStorage.setItem('token', 'test-token');

    renderWithProviders(<DashboardPage />);

    await waitFor(() => {
      expect(screen.getByText('净利润 (Net P&L)')).toBeInTheDocument();
    });

    // Switch to Daily P&L tab
    const dailyPnlTab = screen.getByText(/每日盈亏柱状/);
    fireEvent.click(dailyPnlTab);
    expect(screen.getByText(/基准零轴/)).toBeInTheDocument();
    expect(screen.getAllByText(/胜率/).length).toBeGreaterThan(0);

    // Switch to Sessions tab
    const sessionTab = screen.getByText(/时段透视/);
    fireEvent.click(sessionTab);
    expect(screen.getByText(/亚盘 \(Asia\)/)).toBeInTheDocument();
    expect(screen.getByText(/欧盘 \(London\)/)).toBeInTheDocument();
    expect(screen.getByText(/美盘 \(New York\)/)).toBeInTheDocument();
  });

  it('allows switching between 盈利 Top and 亏损 Top ranking tabs', async () => {
    const today = new Date().toISOString().split('T')[0];
    const mockTrades = [
      {
        id: 1,
        symbol: 'BTCUSD',
        direction: 'long',
        size: 1.0,
        entryprice: 60000,
        exitprice: 61000,
        entry_time: `${today}T10:00:00`,
        createdat: `${today}T10:00:00`,
      },
      {
        id: 2,
        symbol: 'ETHUSD',
        direction: 'long',
        size: 1.0,
        entryprice: 3000,
        exitprice: 2800,
        entry_time: `${today}T11:00:00`,
        createdat: `${today}T11:00:00`,
      }
    ];

    vi.spyOn(api, 'getUserTrades').mockResolvedValue(mockTrades);
    localStorage.setItem('token', 'test-token');

    renderWithProviders(<DashboardPage />);

    await waitFor(() => {
      expect(screen.getByText('净利润 (Net P&L)')).toBeInTheDocument();
    });

    // Default tab is 盈利 Top
    expect(screen.getByText('最佳盈利标的:')).toBeInTheDocument();
    expect(screen.getAllByText('BTCUSD').length).toBeGreaterThan(0);

    // Click 亏损 Top tab
    const lossTab = screen.getByText('亏损 Top');
    fireEvent.click(lossTab);

    expect(screen.getByText('最大亏损标的:')).toBeInTheDocument();
    expect(screen.getAllByText('ETHUSD').length).toBeGreaterThan(0);
  });

  it('renders dual profit and loss bars with amounts and trade counts in Daily P&L tab', async () => {
    const today = new Date().toISOString().split('T')[0];
    const mockTrades = [
      {
        id: 1,
        symbol: 'BTCUSD',
        direction: 'long',
        size: 1.0,
        entryprice: 60000,
        exitprice: 60500, // +$500
        entry_time: `${today}T10:00:00`,
        createdat: `${today}T10:00:00`,
      },
      {
        id: 2,
        symbol: 'BTCUSD',
        direction: 'long',
        size: 1.0,
        entryprice: 60000,
        exitprice: 60300, // +$300
        entry_time: `${today}T11:00:00`,
        createdat: `${today}T11:00:00`,
      },
      {
        id: 3,
        symbol: 'ETHUSD',
        direction: 'long',
        size: 1.0,
        entryprice: 3000,
        exitprice: 2800, // -$200
        entry_time: `${today}T14:00:00`,
        createdat: `${today}T14:00:00`,
      }
    ];

    vi.spyOn(api, 'getUserTrades').mockResolvedValue(mockTrades);
    localStorage.setItem('token', 'test-token');

    renderWithProviders(<DashboardPage />);

    await waitFor(() => {
      expect(screen.getByText('净利润 (Net P&L)')).toBeInTheDocument();
    });

    // Switch to Daily P&L tab
    const dailyPnlTab = screen.getByText(/每日盈亏柱状/);
    fireEvent.click(dailyPnlTab);

    // Verify subheader and dual bar legend
    expect(screen.getByText(/零轴双柱/)).toBeInTheDocument();
    expect(screen.getByText('同向并排双柱')).toBeInTheDocument();
    expect(screen.getByText(/基准零轴/)).toBeInTheDocument();

    // Verify profit amount and win count (+800, 2单)
    expect(screen.getAllByText('+$800').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('2单').length).toBeGreaterThanOrEqual(1);

    // Verify loss amount and loss count (-200, 1单)
    expect(screen.getAllByText('-$200').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('1单').length).toBeGreaterThanOrEqual(1);

    // Test switching to side-by-side mode
    const sideBySideBtn = screen.getByText('同向并排双柱');
    fireEvent.click(sideBySideBtn);
    expect(screen.getByText(/并排对比/)).toBeInTheDocument();
  });
});
