import { render, screen, waitFor, fireEvent, act, within } from '@testing-library/react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import DashboardPage, { TIME_RANGE_STORAGE_KEY } from './DashboardPage';
import * as api from '../services/api';

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

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

    // Refresh button is located in the left toolbar next to 交易日统计
    const refreshBtn = screen.getByTitle('刷新数据');
    expect(refreshBtn).toBeInTheDocument();
    await act(async () => {
      fireEvent.click(refreshBtn);
    });
    expect(api.getUserTrades).toHaveBeenCalled();
  });

  it('allows toggling global trading day cutoff between MT5 aligned trading day and Beijing natural day 00:00', async () => {
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
      expect(screen.getByText(/MT5 交易日/)).toBeInTheDocument();
      expect(screen.getByText('北京自然日 (00:00)')).toBeInTheDocument();
    });

    const naturalBtn = screen.getByText('北京自然日 (00:00)');
    fireEvent.click(naturalBtn);

    expect(localStorage.getItem('tradezella_trading_day_cutoff')).toBe('0');

    const tradingBtn = screen.getByText(/MT5 交易日/);
    fireEvent.click(tradingBtn);

    expect(localStorage.getItem('tradezella_trading_day_cutoff')).toBe('6');
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

    // Equity Curve: starting point shows actual date instead of '起点'
    expect(screen.queryByText('起点')).not.toBeInTheDocument();
    expect(screen.getAllByText(today.slice(5, 10)).length).toBeGreaterThan(0);

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
    expect(screen.getByText(/08:00 - 15:00/)).toBeInTheDocument();
    expect(screen.getByText(/15:00 - 21:00/)).toBeInTheDocument();
    expect(screen.getByText(/21:00 - 次日 08:00/)).toBeInTheDocument();
    expect(screen.getByText(/北京时间 \(UTC\+8\)/)).toBeInTheDocument();
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

    // Equity Curve: starting point shows actual date instead of '起点'
    expect(screen.queryByText('起点')).not.toBeInTheDocument();
    expect(screen.getAllByText(today.slice(5, 10)).length).toBeGreaterThan(0);

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

  it('renders exit method stats (TP, SL, Manual with win/loss breakdown) and holding duration stats', async () => {
    const today = new Date().toISOString().split('T')[0];
    const mockTrades = [
      {
        id: 1,
        symbol: 'EURUSD',
        direction: 'long',
        size: 1.0,
        entryprice: 1.1000,
        exitprice: 1.1050, // Win: +$0.005
        take_profit: 1.1050,
        final_trigger: 'takeProfit',
        entry_time: `${today}T10:00:00`,
        exit_time: `${today}T12:00:00`, // 120 mins = 2h
        createdat: `${today}T10:00:00`,
      },
      {
        id: 2,
        symbol: 'GBPUSD',
        direction: 'long',
        size: 1.0,
        entryprice: 1.2500,
        exitprice: 1.2450, // Loss: -$0.005
        stop_loss: 1.2450,
        final_trigger: 'stopLoss',
        entry_time: `${today}T10:00:00`,
        exit_time: `${today}T10:30:00`, // 30 mins
        createdat: `${today}T10:00:00`,
      },
      {
        id: 3,
        symbol: 'BTCUSD',
        direction: 'long',
        size: 0.1,
        entryprice: 60000,
        exitprice: 62000, // Win: +$200 (manual close win)
        entry_time: `${today}T08:00:00`,
        exit_time: `${today}T10:00:00`, // 120 mins = 2h
        createdat: `${today}T08:00:00`,
      },
      {
        id: 4,
        symbol: 'ETHUSD',
        direction: 'long',
        size: 1.0,
        entryprice: 3000,
        exitprice: 2900, // Loss: -$100 (manual close loss)
        entry_time: `${today}T14:00:00`,
        exit_time: `${today}T14:50:00`, // 50 mins
        createdat: `${today}T14:00:00`,
      }
    ];

    vi.spyOn(api, 'getUserTrades').mockResolvedValue(mockTrades);
    localStorage.setItem('token', 'test-token');

    renderWithProviders(<DashboardPage />);

    await waitFor(() => {
      expect(screen.getByText('平仓执行方式透视')).toBeInTheDocument();
      expect(screen.getByText('订单持仓时长透视')).toBeInTheDocument();
    });

    // 1. Exit Method Titles & Pillars
    expect(screen.getByText('触发止盈')).toBeInTheDocument();
    expect(screen.getByText('触发止损')).toBeInTheDocument();
    expect(screen.getByText('手动平仓')).toBeInTheDocument();

    // 2. Manual Close Breakdown (User requirement: 手动平仓盈和亏的单子数量)
    expect(screen.getByText('手动平仓盈亏细分')).toBeInTheDocument();
    expect(screen.getByText('手动盈利:')).toBeInTheDocument();
    expect(screen.getByText('手动亏损:')).toBeInTheDocument();

    // 3. Holding Duration
    expect(screen.getByText('盈利订单平均持仓')).toBeInTheDocument();
    expect(screen.getByText('亏损订单平均持仓')).toBeInTheDocument();
    expect(screen.getByText('盈亏持仓时间比:')).toBeInTheDocument();
    expect(screen.getByText('全部订单平均持仓:')).toBeInTheDocument();

    // Win duration: 120m & 120m -> 2h
    // Loss duration: 30m & 50m -> 40m
    expect(screen.getAllByText('2h').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('40m').length).toBeGreaterThanOrEqual(1);
  });

  it('navigates to /trades with timeframe and conditions when clicking exit method cards', async () => {
    const today = new Date().toISOString().split('T')[0];
    const mockTrades = [
      {
        id: 1,
        symbol: 'EURUSD',
        direction: 'long',
        size: 1.0,
        entryprice: 1.1000,
        exitprice: 1.1050,
        take_profit: 1.1050,
        entry_time: `${today}T10:00:00`,
        exit_time: `${today}T12:00:00`,
        createdat: `${today}T10:00:00`,
      },
    ];

    vi.spyOn(api, 'getUserTrades').mockResolvedValue(mockTrades);
    localStorage.setItem('token', 'test-token');
    mockNavigate.mockClear();

    renderWithProviders(<DashboardPage />);

    await waitFor(() => {
      expect(screen.getByText('平仓执行方式透视')).toBeInTheDocument();
    });

    // 1. Click "本周" timeframe button first to switch time range to week
    const weekBtn = screen.getByText('本周');
    fireEvent.click(weekBtn);

    // 2. Click "触发止盈" card
    const tpCard = screen.getByTitle('点击在交易明细中查看触发止盈订单');
    fireEvent.click(tpCard);
    expect(mockNavigate).toHaveBeenCalledWith('/trades?quick=week&exitMethod=takeProfit');

    // 3. Click "触发止损" card
    const slCard = screen.getByTitle('点击在交易明细中查看触发止损订单');
    fireEvent.click(slCard);
    expect(mockNavigate).toHaveBeenCalledWith('/trades?quick=week&exitMethod=stopLoss');

    // 4. Click "手动平仓" card
    const manualCard = screen.getByTitle('点击在交易明细中查看手动平仓订单');
    fireEvent.click(manualCard);
    expect(mockNavigate).toHaveBeenCalledWith('/trades?quick=week&exitMethod=manual');

    // 5. Click "手动盈利"
    const manualWinBtn = screen.getByTitle('点击在交易明细中查看手动盈利订单');
    fireEvent.click(manualWinBtn);
    expect(mockNavigate).toHaveBeenCalledWith('/trades?quick=week&exitMethod=manual&result=profit');

    // 6. Click "手动亏损"
    const manualLossBtn = screen.getByTitle('点击在交易明细中查看手动亏损订单');
    fireEvent.click(manualLossBtn);
    expect(mockNavigate).toHaveBeenCalledWith('/trades?quick=week&exitMethod=manual&result=loss');
  });

  describe('TimeRange localStorage caching', () => {
    afterEach(() => {
      localStorage.removeItem(TIME_RANGE_STORAGE_KEY);
    });

    it('defaults to "month" (本月) when localStorage is empty', async () => {
      vi.spyOn(api, 'getUserTrades').mockResolvedValue([]);
      localStorage.setItem('token', 'test-token');
      localStorage.removeItem(TIME_RANGE_STORAGE_KEY);

      renderWithProviders(<DashboardPage />);

      await waitFor(() => {
        expect(screen.getByText('本月')).toBeInTheDocument();
      });

      const monthBtn = screen.getByText('本月');
      expect(monthBtn).toHaveClass('dark:bg-purple-600');
    });

    it('loads cached time range from localStorage if present', async () => {
      vi.spyOn(api, 'getUserTrades').mockResolvedValue([]);
      localStorage.setItem('token', 'test-token');
      localStorage.setItem(TIME_RANGE_STORAGE_KEY, 'week');

      renderWithProviders(<DashboardPage />);

      await waitFor(() => {
        expect(screen.getByText('本周')).toBeInTheDocument();
      });

      const weekBtn = screen.getByText('本周');
      expect(weekBtn).toHaveClass('dark:bg-purple-600');
      const monthBtn = screen.getByText('本月');
      expect(monthBtn).not.toHaveClass('dark:bg-purple-600');
    });

    it('falls back to "month" (本月) if cached value is invalid', async () => {
      vi.spyOn(api, 'getUserTrades').mockResolvedValue([]);
      localStorage.setItem('token', 'test-token');
      localStorage.setItem(TIME_RANGE_STORAGE_KEY, 'invalid_range');

      renderWithProviders(<DashboardPage />);

      await waitFor(() => {
        expect(screen.getByText('本月')).toBeInTheDocument();
      });

      const monthBtn = screen.getByText('本月');
      expect(monthBtn).toHaveClass('dark:bg-purple-600');
    });

    it('saves newly selected time range into localStorage upon clicking', async () => {
      vi.spyOn(api, 'getUserTrades').mockResolvedValue([]);
      localStorage.setItem('token', 'test-token');
      localStorage.removeItem(TIME_RANGE_STORAGE_KEY);

      renderWithProviders(<DashboardPage />);

      await waitFor(() => {
        expect(screen.getByText('今年')).toBeInTheDocument();
      });

      const yearBtn = screen.getByText('今年');
      await act(async () => {
        fireEvent.click(yearBtn);
      });

      expect(yearBtn).toHaveClass('dark:bg-purple-600');
      expect(localStorage.getItem(TIME_RANGE_STORAGE_KEY)).toBe('year');
    });

    it('sorts recent trades feed by entry time descending and handles trailed SL correctly', async () => {
      const mockTrades = [
        {
          id: 1,
          symbol: 'OLD_TRADE',
          direction: 'short' as const,
          size: 0.1,
          entryprice: 87.673,
          exitprice: 86.888,
          stop_loss: 87.657, // Trailed SL in profit for short -> should NOT be +49.1R, should be '-'
          entry_time: '2026-11-14T01:06:00',
          exit_time: '2026-11-16T13:54:00',
          manual_pnl: 7.85,
        },
        {
          id: 2,
          symbol: 'NEW_TRADE',
          direction: 'short' as const,
          size: 1,
          entryprice: 3548.63,
          exitprice: 3544.91,
          stop_loss: 3557.93, // Valid protective SL
          entry_time: '2026-11-20T23:56:00',
          exit_time: '2026-11-21T00:10:00',
          manual_pnl: 3.72,
        },
      ];

      vi.spyOn(api, 'getUserTrades').mockResolvedValue(mockTrades);
      localStorage.setItem('token', 'test-token');
      localStorage.setItem(TIME_RANGE_STORAGE_KEY, 'all');

      renderWithProviders(<DashboardPage />);

      await waitFor(() => {
        expect(screen.getByText('最新实盘交易动态')).toBeInTheDocument();
      });

      // NEW_TRADE (11-20) should appear before OLD_TRADE (11-14) in recent trades table
      const recentHeader = screen.getByText('最新实盘交易动态');
      const table = recentHeader.closest('.rounded-2xl')!.querySelector('table')!;
      const rows = within(table).getAllByRole('row');
      // row[0] is thead, row[1] is first trade, row[2] is second trade
      expect(rows[1]).toHaveTextContent('NEW_TRADE');
      expect(rows[2]).toHaveTextContent('OLD_TRADE');

      // OLD_TRADE should NOT show +49.1R (which was a bug when dividing by trailed SL)
      expect(within(table).queryByText('+49.1R')).not.toBeInTheDocument();
      // Should show '-' for uncalculable RR when SL is trailed into profit
      expect(within(rows[2]).getByText('-')).toBeInTheDocument();
    });

    it('calculates win rate including breakeven trades and drawdown by exit time (matching MT5)', async () => {
      const mockTrades = [
        // Opened first, closed LAST (-60) -> exit order settles +100 -> -50 -> 0 -> -60 (DD = $110.00)
        // Entry order would give -60 -> +100 -> -50 -> 0 (DD = $60.00)
        {
          id: 1,
          symbol: 'XAUUSD',
          direction: 'long' as const,
          size: 1.0,
          entryprice: 2650,
          exitprice: 2644,
          entry_time: '2026-11-10T09:00:00',
          exit_time: '2026-11-15T15:00:00',
          manual_pnl: -60,
        },
        // Closed first (+100)
        {
          id: 2,
          symbol: 'EURUSD',
          direction: 'long' as const,
          size: 1.0,
          entryprice: 1.08,
          exitprice: 1.09,
          entry_time: '2026-11-10T10:00:00',
          exit_time: '2026-11-10T12:00:00',
          manual_pnl: 100,
        },
        // Closed second (-50)
        {
          id: 3,
          symbol: 'USDJPY',
          direction: 'long' as const,
          size: 1.0,
          entryprice: 150,
          exitprice: 149.5,
          entry_time: '2026-11-11T10:00:00',
          exit_time: '2026-11-11T12:00:00',
          manual_pnl: -50,
        },
        // Breakeven (0) -> must be counted in MT5 total trades denominator (1/4 = 25.0%, NOT 1/3 = 33.3%)
        {
          id: 4,
          symbol: 'GBPUSD',
          direction: 'long' as const,
          size: 1.0,
          entryprice: 1.25,
          exitprice: 1.25,
          entry_time: '2026-11-12T10:00:00',
          exit_time: '2026-11-12T12:00:00',
          manual_pnl: 0,
        },
      ];

      vi.spyOn(api, 'getUserTrades').mockResolvedValue(mockTrades);
      localStorage.setItem('token', 'test-token');
      localStorage.setItem(TIME_RANGE_STORAGE_KEY, 'all');

      renderWithProviders(<DashboardPage />);

      await waitFor(() => {
        expect(screen.getByText('净利润 (Net P&L)')).toBeInTheDocument();
      });

      // Win rate: 1 win out of 4 total completed trades = 25.0%
      expect(screen.getByText('25.0%')).toBeInTheDocument();
      // Max drawdown by exit order (+100 -> +50 -> +50 -> -10): -$110.00
      expect(screen.getByText('-$110.00')).toBeInTheDocument();
    });
  });
});
