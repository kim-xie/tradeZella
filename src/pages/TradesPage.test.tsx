import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import TradesPage from './TradesPage';
import * as api from '../services/api';
import { getCurrentTradingDate } from '../components/calendar/calendarUtils';

vi.mock('../services/api');

describe('TradesPage', () => {
  it('renders loading state initially', () => {
    vi.spyOn(api, 'getUserTrades').mockReturnValue(new Promise(() => {}));
    localStorage.setItem('token', 'test-token');
    render(
      <MemoryRouter>
        <TradesPage />
      </MemoryRouter>
    );
    expect(screen.getByText('Loading trades...')).toBeInTheDocument();
  });

  it('renders trades after successful fetch', async () => {
    const today = getCurrentTradingDate();
    const mockTrades = [
      { id: 1, symbol: 'AAPL', direction: 'long', size: 10, entryprice: 150, entry_time: `${today}T10:00:00`, createdat: `${today}T10:00:00` },
      { id: 2, symbol: 'GOOG', direction: 'short', size: 5, entryprice: 2800, entry_time: `${today}T10:00:00`, createdat: `${today}T10:00:00` },
    ];
    vi.spyOn(api, 'getUserTrades').mockResolvedValue(mockTrades);
    localStorage.setItem('token', 'test-token');

    render(
      <MemoryRouter>
        <TradesPage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('AAPL')).toBeInTheDocument();
      expect(screen.getByText('GOOG')).toBeInTheDocument();
    });
  });

  it('filters trades by symbol when search criteria is entered', async () => {
    const mockTrades = [
      { id: 1, symbol: 'EURUSD', direction: 'long', size: 1, entryprice: 100, exitprice: 150, entry_time: '2026-11-04T10:00:00', createdat: '2026-11-04T10:00:00' }, // +50
      { id: 2, symbol: 'XAUUSD', direction: 'long', size: 1, entryprice: 2000, exitprice: 1980, entry_time: '2026-11-05T11:00:00', createdat: '2026-11-05T11:00:00' }, // -20
    ];
    vi.spyOn(api, 'getUserTrades').mockResolvedValue(mockTrades);
    localStorage.setItem('token', 'test-token');

    render(
      <MemoryRouter>
        <TradesPage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.queryByText('Loading trades...')).not.toBeInTheDocument();
    });

    // Click "全部" to view all trades across dates
    const allBtn = screen.getByRole('button', { name: '全部' });
    fireEvent.click(allBtn);

    await waitFor(() => {
      expect(screen.getByText('EURUSD')).toBeInTheDocument();
      expect(screen.getByText('XAUUSD')).toBeInTheDocument();
    });

    // Now filter by symbol "EURUSD"
    const searchInput = screen.getByPlaceholderText('全部标的');
    fireEvent.change(searchInput, { target: { value: 'EURUSD' } });

    await waitFor(() => {
      expect(screen.queryByText('XAUUSD')).not.toBeInTheDocument();
      expect(screen.getByText('EURUSD')).toBeInTheDocument();
    });
  });

  it('supports selecting an existing symbol from the dropdown list and clearing it', async () => {
    const mockTrades = [
      { id: 1, symbol: 'EURUSD', direction: 'long', size: 1, entryprice: 1.1, exitprice: 1.12, entry_time: '2026-11-20T10:00:00', createdat: '2026-11-20T10:00:00' },
      { id: 2, symbol: 'XAUUSD', direction: 'long', size: 1, entryprice: 2000, exitprice: 2050, entry_time: '2026-11-20T10:00:00', createdat: '2026-11-20T10:00:00' },
      { id: 3, symbol: 'EURUSD', direction: 'short', size: 2, entryprice: 1.15, exitprice: 1.14, entry_time: '2026-11-20T11:00:00', createdat: '2026-11-20T11:00:00' },
    ];
    vi.spyOn(api, 'getUserTrades').mockResolvedValue(mockTrades);
    localStorage.setItem('token', 'test-token');

    render(
      <MemoryRouter>
        <TradesPage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.queryByText('Loading trades...')).not.toBeInTheDocument();
    });

    // View all trades
    fireEvent.click(screen.getByRole('button', { name: '全部' }));
    await waitFor(() => {
      expect(screen.getByText('XAUUSD')).toBeInTheDocument();
    });

    // Open dropdown by clicking the dropdown button
    const dropdownBtn = screen.getByRole('button', { name: '选择已有标的' });
    fireEvent.click(dropdownBtn);

    // Verify "全部标的" and available symbols with counts are displayed
    expect(screen.getByText('全部标的')).toBeInTheDocument();
    expect(screen.getByText('2 笔')).toBeInTheDocument(); // EURUSD has 2 trades
    expect(screen.getByText('1 笔')).toBeInTheDocument(); // XAUUSD has 1 trade

    // Click EURUSD in the dropdown
    const eurusdOption = screen.getAllByRole('button').find((b) => b.textContent?.includes('EURUSD') && b.textContent?.includes('2 笔'));
    expect(eurusdOption).toBeDefined();
    fireEvent.click(eurusdOption!);

    // Dropdown closes and search input is updated to EURUSD
    const searchInput = screen.getByPlaceholderText('全部标的') as HTMLInputElement;
    expect(searchInput.value).toBe('EURUSD');

    // XAUUSD is filtered out, both EURUSD rows visible
    await waitFor(() => {
      expect(screen.queryByText('XAUUSD')).not.toBeInTheDocument();
      expect(screen.getAllByText('EURUSD').length).toBe(2);
    });

    // Click clear button (X)
    const clearBtn = screen.getByRole('button', { name: '清空标的' });
    fireEvent.click(clearBtn);

    expect(searchInput.value).toBe('');
    await waitFor(() => {
      expect(screen.getByText('XAUUSD')).toBeInTheDocument();
    });
  }, 15000);

  it('renders "订单同步" button, unifies exit method, and filters by custom date range', async () => {
    const mockTrades = [
      { id: 1, symbol: 'BTCUSD', direction: 'long', size: 1, entryprice: 60000, exitprice: 61000, entry_time: '2026-10-10T10:00:00', createdat: '2026-10-10T10:00:00', notes: '用户手动创建' },
      { id: 2, symbol: 'ETHUSD', direction: 'long', size: 1, entryprice: 3000, exitprice: 3100, entry_time: '2026-11-05T10:00:00', createdat: '2026-11-05T10:00:00', tags: ['MT5', 'ETHUSD'] },
      { id: 3, symbol: 'SOLUSD', direction: 'long', size: 1, entryprice: 150, exitprice: 160, entry_time: '2026-12-01T10:00:00', createdat: '2026-12-01T10:00:00', notes: 'Ticket/ID: 123456 | MetaTrader 5 导入交易记录' },
    ];
    vi.spyOn(api, 'getUserTrades').mockResolvedValue(mockTrades);
    localStorage.setItem('token', 'test-token');

    render(
      <MemoryRouter>
        <TradesPage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.queryByText('Loading trades...')).not.toBeInTheDocument();
    });

    // 1. Verify "订单同步" button and "平仓方式" column are present, "订单来源" column is NOT displayed in list
    expect(screen.getByRole('button', { name: /订单同步/ })).toBeInTheDocument();
    expect(screen.getByText('平仓方式')).toBeInTheDocument();
    expect(screen.queryByText('订单来源')).not.toBeInTheDocument();

    // 2. Click "全部" to view all trades
    fireEvent.click(screen.getByRole('button', { name: '全部' }));
    await waitFor(() => {
      expect(screen.getByText('BTCUSD')).toBeInTheDocument();
      expect(screen.getByText('ETHUSD')).toBeInTheDocument();
      expect(screen.getByText('SOLUSD')).toBeInTheDocument();
    });

    // 3. Verify record count text
    expect(screen.getByText('笔交易记录')).toBeInTheDocument();

    // 4. Filter by custom date range (2026-11-01 to 2026-11-30)
    const startDateInput = screen.getByTitle('开始日期');
    const endDateInput = screen.getByTitle('结束日期');
    fireEvent.change(startDateInput, { target: { value: '2026-11-01' } });
    fireEvent.change(endDateInput, { target: { value: '2026-11-30' } });

    await waitFor(() => {
      expect(screen.queryByText('BTCUSD')).not.toBeInTheDocument();
      expect(screen.getByText('ETHUSD')).toBeInTheDocument();
      expect(screen.queryByText('SOLUSD')).not.toBeInTheDocument();
    });
  });

  it('renders error message on fetch failure', async () => {
    vi.spyOn(api, 'getUserTrades').mockRejectedValue(new Error('Failed to fetch trades.'));
    localStorage.setItem('token', 'test-token');
    render(
      <MemoryRouter>
        <TradesPage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Failed to fetch trades.')).toBeInTheDocument();
    });
  });

  it('renders error message if no token is found', () => {
    localStorage.removeItem('token');
    render(
      <MemoryRouter>
        <TradesPage />
      </MemoryRouter>
    );
    expect(screen.getByText('No authentication token found. Please log in.')).toBeInTheDocument();
  });

  it('renders "手数" column after "多空方向", left-aligned "操作" header, and unified duration style', async () => {
    const mockTrades = [
      { id: 1, symbol: 'EURUSD', direction: 'long', size: 1.5, entryprice: 1.1, exitprice: 1.12, entry_time: '2026-11-15T10:00:00', exit_time: '2026-11-15T10:30:00', createdat: '2026-11-15T10:00:00' },
    ];
    vi.spyOn(api, 'getUserTrades').mockResolvedValue(mockTrades);
    localStorage.setItem('token', 'test-token');

    render(
      <MemoryRouter>
        <TradesPage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.queryByText('Loading trades...')).not.toBeInTheDocument();
    });

    // Click "全部" to view trade across dates
    fireEvent.click(screen.getByRole('button', { name: '全部' }));

    await waitFor(() => {
      expect(screen.getByText('EURUSD')).toBeInTheDocument();
    });

    // Check "手数" header exists and is positioned right after "多空方向"
    const headers = screen.getAllByRole('columnheader').map((th) => th.textContent);
    expect(headers).toContain('手数');
    const dirIdx = headers.indexOf('多空方向');
    const sizeIdx = headers.indexOf('手数');
    expect(sizeIdx).toBe(dirIdx + 1);

    // Check "操作" header is left-aligned
    const actionTh = screen.getByRole('columnheader', { name: '操作' });
    expect(actionTh).toHaveClass('text-left');
    expect(actionTh).not.toHaveClass('text-right');

    // Check size value is rendered
    expect(screen.getByText('1.5')).toBeInTheDocument();
  });

  it('opens rating modal when clicking row discipline rating stars and updates trade rating', async () => {
    const mockTrades = [
      { id: 42, symbol: 'XAUUSD', direction: 'short', size: 0.5, entryprice: 2000, exitprice: 1980, rating: 2, entry_time: '2026-11-15T10:00:00', exit_time: '2026-11-15T10:30:00', createdat: '2026-11-15T10:00:00' },
    ];
    vi.spyOn(api, 'getUserTrades').mockResolvedValue(mockTrades);
    const updateSpy = vi.spyOn(api, 'updateTrade').mockResolvedValue({ ...mockTrades[0], rating: 5 });
    localStorage.setItem('token', 'test-token');

    render(
      <MemoryRouter>
        <TradesPage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.queryByText('Loading trades...')).not.toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: '全部' }));

    await waitFor(() => {
      expect(screen.getByText('XAUUSD')).toBeInTheDocument();
    });

    // Find the rating button on the row
    const ratingBtn = screen.getByTitle('点击设置交易纪律评分');
    expect(ratingBtn).toBeInTheDocument();
    fireEvent.click(ratingBtn);

    // Verify modal is open
    expect(screen.getByText('设置交易纪律评分')).toBeInTheDocument();
    expect(screen.getByText('#42')).toBeInTheDocument();

    // Click 5-star rating: Modal immediately closes, and animation overlay appears!
    const star5Btn = screen.getByTitle('评定为 5 星');
    fireEvent.click(star5Btn);

    // 1. Modal is now closed
    expect(screen.queryByText('设置交易纪律评分')).not.toBeInTheDocument();

    // 2. updateTrade was called
    expect(updateSpy).toHaveBeenCalledWith('test-token', 42, { rating: 5 });

    // 3. Animation overlay is now rendered on screen with 5-star feedback
    await waitFor(() => {
      expect(screen.getByText('知行合一 / 大师级执行！')).toBeInTheDocument();
      expect(screen.getByText(/知行合一 · 完美典范/)).toBeInTheDocument();
    });
  });

  it('renders "清空全部订单" button, opens confirmation modal and clears all trades', async () => {
    const today = getCurrentTradingDate();
    const mockTrades = [
      { id: 1, symbol: 'BTCUSD', direction: 'long', size: 1, entryprice: 60000, entry_time: `${today}T10:00:00`, createdat: `${today}T10:00:00` },
    ];
    vi.spyOn(api, 'getUserTrades').mockResolvedValue(mockTrades);
    const clearSpy = vi.spyOn(api, 'clearAllTrades').mockResolvedValue({ success: true, count: 1 });
    localStorage.setItem('token', 'test-token');

    render(
      <MemoryRouter>
        <TradesPage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('BTCUSD')).toBeInTheDocument();
    });

    // 默认选中“今日”时不显示“清空全部订单”按钮
    expect(screen.queryByText('清空全部订单')).not.toBeInTheDocument();
    expect(screen.queryByTitle('一键清空全部历史交易订单数据')).not.toBeInTheDocument();

    // 点击切换为“全部”视图
    const allFilterBtn = screen.getByRole('button', { name: '全部' });
    fireEvent.click(allFilterBtn);

    // 只有选择“全部”才显示“清空全部订单”按钮
    const clearBtn = screen.getByTitle('一键清空全部历史交易订单数据');
    expect(clearBtn).toBeInTheDocument();
    expect(screen.getByText('清空全部订单')).toBeInTheDocument();

    // 切换为其他筛选条件（例如“今日”）时，按钮自动隐藏
    const todayFilterBtn = screen.getByRole('button', { name: '今日' });
    fireEvent.click(todayFilterBtn);
    expect(screen.queryByText('清空全部订单')).not.toBeInTheDocument();

    // 重新切回“全部”
    fireEvent.click(allFilterBtn);
    expect(screen.getByText('清空全部订单')).toBeInTheDocument();

    // 点击清空按钮弹出确认弹窗
    fireEvent.click(screen.getByTitle('一键清空全部历史交易订单数据'));
    expect(screen.getByText('确定要清空全部历史订单吗？')).toBeInTheDocument();

    // Click confirm
    const confirmBtn = screen.getByRole('button', { name: '确认一键清空' });
    fireEvent.click(confirmBtn);

    await waitFor(() => {
      expect(clearSpy).toHaveBeenCalled();
    });
  }, 15000);

  it('supports pagination with default 50 items per page and page controls', async () => {
    const today = getCurrentTradingDate();

    // Create 60 mock trades
    const mockTrades = Array.from({ length: 60 }, (_, i) => ({
      id: i + 1,
      symbol: `SYM${i + 1}`,
      direction: 'long' as const,
      size: 1,
      entryprice: 100 + i,
      entry_time: `${today}T10:00:00`,
      createdat: `${today}T10:00:00`,
    }));

    vi.spyOn(api, 'getUserTrades').mockResolvedValue(mockTrades);
    localStorage.setItem('token', 'test-token');

    render(
      <MemoryRouter>
        <TradesPage />
      </MemoryRouter>
    );

    // Initial render should show page 1 items (up to 50)
    await waitFor(() => {
      expect(screen.getByText('SYM1')).toBeInTheDocument();
      expect(screen.getByText('SYM50')).toBeInTheDocument();
      expect(screen.queryByText('SYM51')).not.toBeInTheDocument();
    });

    // Check pagination information
    expect(screen.getByText('50 条 (默认)')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '1' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '2' })).toBeInTheDocument();

    // Click page 2
    fireEvent.click(screen.getByRole('button', { name: '2' }));

    // Now page 2 items should appear
    await waitFor(() => {
      expect(screen.queryByText('SYM1')).not.toBeInTheDocument();
      expect(screen.getByText('SYM51')).toBeInTheDocument();
      expect(screen.getByText('SYM60')).toBeInTheDocument();
    });

    // Change page size to 100
    const pageSizeSelect = screen.getByTitle('选择每页显示条数');
    fireEvent.change(pageSizeSelect, { target: { value: '100' } });

    // Now all 60 items should fit on page 1
    await waitFor(() => {
      expect(screen.getByText('SYM1')).toBeInTheDocument();
      expect(screen.getByText('SYM60')).toBeInTheDocument();
    });
  }, 30000);

  it('supports sorting by net P&L (平仓净盈亏), duration (持仓时长), and rating (纪律评分)', async () => {
    const today = getCurrentTradingDate();

    const mockTrades = [
      {
        id: 1,
        symbol: 'TRADE_A',
        direction: 'long' as const,
        size: 1,
        entryprice: 100,
        exitprice: 120, // +$20
        entry_time: `${today}T09:00:00`,
        exit_time: `${today}T09:10:00`, // 10m
        createdat: `${today}T09:00:00`,
        rating: 5,
      },
      {
        id: 2,
        symbol: 'TRADE_B',
        direction: 'long' as const,
        size: 1,
        entryprice: 100,
        exitprice: 50, // -$50
        entry_time: `${today}T10:00:00`,
        exit_time: `${today}T11:00:00`, // 1h
        createdat: `${today}T10:00:00`,
        rating: 2,
      },
      {
        id: 3,
        symbol: 'TRADE_C',
        direction: 'long' as const,
        size: 1,
        entryprice: 100,
        exitprice: 200, // +$100
        entry_time: `${today}T08:00:00`,
        exit_time: `${today}T10:00:00`, // 2h
        createdat: `${today}T08:00:00`,
        rating: 3,
      },
    ];

    vi.spyOn(api, 'getUserTrades').mockResolvedValue(mockTrades);
    localStorage.setItem('token', 'test-token');

    render(
      <MemoryRouter>
        <TradesPage />
      </MemoryRouter>
    );

    // Initial load: Default sort by entry_time desc:
    // TRADE_B (10:00) -> TRADE_A (09:00) -> TRADE_C (08:00)
    await waitFor(() => {
      expect(screen.getByText('TRADE_A')).toBeInTheDocument();
      expect(screen.getByText('TRADE_B')).toBeInTheDocument();
      expect(screen.getByText('TRADE_C')).toBeInTheDocument();
    });

    const getRowSymbols = () => {
      const rows = screen.getAllByRole('row');
      // row 0 is header, rows 1..3 are data
      return rows.slice(1).map(r => r.textContent || '');
    };

    let rows = getRowSymbols();
    expect(rows[0]).toContain('TRADE_B');
    expect(rows[1]).toContain('TRADE_A');
    expect(rows[2]).toContain('TRADE_C');

    // 1. Click "平仓净盈亏" -> sort PnL desc (+100 -> +20 -> -50):
    // TRADE_C (+$100) -> TRADE_A (+$20) -> TRADE_B (-$50)
    const pnlHeader = screen.getByTitle('点击按平仓净盈亏排序');
    fireEvent.click(pnlHeader);

    await waitFor(() => {
      rows = getRowSymbols();
      expect(rows[0]).toContain('TRADE_C');
      expect(rows[1]).toContain('TRADE_A');
      expect(rows[2]).toContain('TRADE_B');
    });

    // Click "平仓净盈亏" again -> sort PnL asc (-$50 -> +$20 -> +$100):
    // TRADE_B (-$50) -> TRADE_A (+$20) -> TRADE_C (+$100)
    fireEvent.click(pnlHeader);

    await waitFor(() => {
      rows = getRowSymbols();
      expect(rows[0]).toContain('TRADE_B');
      expect(rows[1]).toContain('TRADE_A');
      expect(rows[2]).toContain('TRADE_C');
    });

    // 2. Click "持仓时长" -> sort duration desc (2h -> 1h -> 10m):
    // TRADE_C (2h) -> TRADE_B (1h) -> TRADE_A (10m)
    const durationHeader = screen.getByTitle('点击按持仓时长排序');
    fireEvent.click(durationHeader);

    await waitFor(() => {
      rows = getRowSymbols();
      expect(rows[0]).toContain('TRADE_C');
      expect(rows[1]).toContain('TRADE_B');
      expect(rows[2]).toContain('TRADE_A');
    });

    // Click "持仓时长" again -> sort duration asc (10m -> 1h -> 2h):
    // TRADE_A (10m) -> TRADE_B (1h) -> TRADE_C (2h)
    fireEvent.click(durationHeader);

    await waitFor(() => {
      rows = getRowSymbols();
      expect(rows[0]).toContain('TRADE_A');
      expect(rows[1]).toContain('TRADE_B');
      expect(rows[2]).toContain('TRADE_C');
    });

    // 3. Click "纪律评分" -> sort rating desc (5星 -> 3星 -> 2星):
    // TRADE_A (5) -> TRADE_C (3) -> TRADE_B (2)
    const ratingHeader = screen.getByTitle('点击按纪律评分排序');
    fireEvent.click(ratingHeader);

    await waitFor(() => {
      rows = getRowSymbols();
      expect(rows[0]).toContain('TRADE_A');
      expect(rows[1]).toContain('TRADE_C');
      expect(rows[2]).toContain('TRADE_B');
    });

    // Click "纪律评分" again -> sort rating asc (2星 -> 3星 -> 5星):
    // TRADE_B (2) -> TRADE_C (3) -> TRADE_A (5)
    fireEvent.click(ratingHeader);

    await waitFor(() => {
      rows = getRowSymbols();
      expect(rows[0]).toContain('TRADE_B');
      expect(rows[1]).toContain('TRADE_C');
      expect(rows[2]).toContain('TRADE_A');
    });

    // 4. Reset sort by clicking the sort badge close button '×'
    const resetSortBtn = screen.getByTitle('恢复默认时间降序');
    fireEvent.click(resetSortBtn);

    await waitFor(() => {
      rows = getRowSymbols();
      expect(rows[0]).toContain('TRADE_B');
      expect(rows[1]).toContain('TRADE_A');
      expect(rows[2]).toContain('TRADE_C');
    });
  });

  it('supports sorting by lot size (手数) and risk-reward ratio (盈亏比)', async () => {
    const today = getCurrentTradingDate();

    const mockTrades = [
      {
        id: 1,
        symbol: 'TRADE_A',
        direction: 'long' as const,
        size: 2.5,
        entryprice: 100,
        exitprice: 120, // +$20 diff
        stop_loss: 90, // risk = 10, rr = 20 / 10 = 2.0R
        entry_time: `${today}T09:00:00`,
        exit_time: `${today}T09:10:00`,
        createdat: `${today}T09:00:00`,
      },
      {
        id: 2,
        symbol: 'TRADE_B',
        direction: 'long' as const,
        size: 0.5,
        entryprice: 100,
        exitprice: 50, // -$50 diff
        stop_loss: 90, // risk = 10, rr = -50 / 10 = -5.0R
        entry_time: `${today}T10:00:00`,
        exit_time: `${today}T11:00:00`,
        createdat: `${today}T10:00:00`,
      },
      {
        id: 3,
        symbol: 'TRADE_C',
        direction: 'long' as const,
        size: 5.0,
        entryprice: 100,
        exitprice: 200, // +$100 diff
        stop_loss: 80, // risk = 20, rr = 100 / 20 = 5.0R
        entry_time: `${today}T08:00:00`,
        exit_time: `${today}T10:00:00`,
        createdat: `${today}T08:00:00`,
      },
    ];

    vi.spyOn(api, 'getUserTrades').mockResolvedValue(mockTrades);
    localStorage.setItem('token', 'test-token');

    render(
      <MemoryRouter>
        <TradesPage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('TRADE_A')).toBeInTheDocument();
      expect(screen.getByText('TRADE_B')).toBeInTheDocument();
      expect(screen.getByText('TRADE_C')).toBeInTheDocument();
    });

    const getRowSymbols = () => {
      const rows = screen.getAllByRole('row');
      return rows.slice(1).map(r => r.textContent || '');
    };

    // 1. Click "手数" -> sort size desc (5.0 -> 2.5 -> 0.5):
    // TRADE_C (5.0) -> TRADE_A (2.5) -> TRADE_B (0.5)
    const sizeHeader = screen.getByTitle('点击按手数排序');
    fireEvent.click(sizeHeader);

    await waitFor(() => {
      const rows = getRowSymbols();
      expect(rows[0]).toContain('TRADE_C');
      expect(rows[1]).toContain('TRADE_A');
      expect(rows[2]).toContain('TRADE_B');
    });
    expect(screen.getByText(/当前排序:\s*手数\s*\(降序\s*↓\)/)).toBeInTheDocument();

    // Click "手数" again -> sort size asc (0.5 -> 2.5 -> 5.0):
    // TRADE_B (0.5) -> TRADE_A (2.5) -> TRADE_C (5.0)
    fireEvent.click(sizeHeader);

    await waitFor(() => {
      const rows = getRowSymbols();
      expect(rows[0]).toContain('TRADE_B');
      expect(rows[1]).toContain('TRADE_A');
      expect(rows[2]).toContain('TRADE_C');
    });
    expect(screen.getByText(/当前排序:\s*手数\s*\(升序\s*↑\)/)).toBeInTheDocument();

    // 2. Click "盈亏比" -> sort rr desc (+5.0R -> +2.0R -> -5.0R):
    // TRADE_C (+5.0R) -> TRADE_A (+2.0R) -> TRADE_B (-5.0R)
    const rrHeader = screen.getByTitle('点击按盈亏比排序');
    fireEvent.click(rrHeader);

    await waitFor(() => {
      const rows = getRowSymbols();
      expect(rows[0]).toContain('TRADE_C');
      expect(rows[1]).toContain('TRADE_A');
      expect(rows[2]).toContain('TRADE_B');
    });
    expect(screen.getByText(/当前排序:\s*盈亏比\s*\(降序\s*↓\)/)).toBeInTheDocument();

    // Click "盈亏比" again -> sort rr asc (-5.0R -> +2.0R -> +5.0R):
    // TRADE_B (-5.0R) -> TRADE_A (+2.0R) -> TRADE_C (+5.0R)
    fireEvent.click(rrHeader);

    await waitFor(() => {
      const rows = getRowSymbols();
      expect(rows[0]).toContain('TRADE_B');
      expect(rows[1]).toContain('TRADE_A');
      expect(rows[2]).toContain('TRADE_C');
    });
    expect(screen.getByText(/当前排序:\s*盈亏比\s*\(升序\s*↑\)/)).toBeInTheDocument();

    // Reset sort
    const resetSortBtn = screen.getByTitle('恢复默认时间降序');
    fireEvent.click(resetSortBtn);

    await waitFor(() => {
      const rows = getRowSymbols();
      expect(rows[0]).toContain('TRADE_B');
      expect(rows[1]).toContain('TRADE_A');
      expect(rows[2]).toContain('TRADE_C');
    });
  });

  it('accurately calculates risk-reward ratio without contract multiplier distortion for manual_pnl trades', async () => {
    // USOIL trade: entry 70.00, exit 69.042 (diff 0.958), SL 70.52 (risk 0.52).
    // Broker net PnL is +$9.58 (0.1 lot * 100 multiplier). Real RR = 0.958 / 0.52 = 1.84R (~1.8R).
    // Previously, formula calculated 9.58 / (0.52 * 0.1) = 184.2R!
    const mockTrades = [
      {
        id: 101,
        symbol: '美国原油',
        direction: 'short' as const,
        size: 0.1,
        entryprice: 70.00,
        exitprice: 69.042,
        stop_loss: 70.52,
        manual_pnl: 9.58,
        entry_time: '2026-11-17T18:48:00',
        exit_time: '2026-11-18T01:13:00',
        createdat: '2026-11-17T18:48:00',
      },
    ];

    vi.spyOn(api, 'getUserTrades').mockResolvedValue(mockTrades);
    localStorage.setItem('token', 'test-token');

    render(
      <MemoryRouter>
        <TradesPage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('全部')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole('button', { name: '全部' }));

    await waitFor(() => {
      expect(screen.getByText('美国原油')).toBeInTheDocument();
    });

    // Check that RR is rendered accurately as 1.8R (not 184.2R!)
    expect(screen.getByText('1.8R')).toBeInTheDocument();
    expect(screen.queryByText('184.2R')).not.toBeInTheDocument();
  });

  it('calculates planned risk-reward ratio based on set stop_loss and take_profit (even for open trades)', async () => {
    // Trade 201: Open trade (no exitprice), Entry 100, SL 90, TP 125 -> Target RR = (125 - 100) / (100 - 90) = 2.5R
    // Trade 202: Closed trade, Entry 200, SL 190, TP 230, Exit 215 -> Target RR = 3.0R, Actual Exit RR = 1.5R
    const mockTrades = [
      {
        id: 201,
        symbol: 'OPEN_TRADE',
        direction: 'long' as const,
        size: 1.0,
        entryprice: 100,
        stop_loss: 90,
        take_profit: 125,
        entry_time: '2026-11-20T10:00:00',
        createdat: '2026-11-20T10:00:00',
      },
      {
        id: 202,
        symbol: 'CLOSED_WITH_TP_SL',
        direction: 'long' as const,
        size: 1.0,
        entryprice: 200,
        exitprice: 215,
        stop_loss: 190,
        take_profit: 230,
        entry_time: '2026-11-20T11:00:00',
        exit_time: '2026-11-20T12:00:00',
        createdat: '2026-11-20T11:00:00',
      },
    ];

    vi.spyOn(api, 'getUserTrades').mockResolvedValue(mockTrades as any);
    localStorage.setItem('token', 'test-token');

    render(
      <MemoryRouter>
        <TradesPage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('全部')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole('button', { name: '全部' }));

    await waitFor(() => {
      expect(screen.getByText('OPEN_TRADE')).toBeInTheDocument();
      expect(screen.getByText('CLOSED_WITH_TP_SL')).toBeInTheDocument();
    });

    // OPEN_TRADE: shows 2.5R from configured stop_loss and take_profit even though position is still open!
    expect(screen.getByText('2.5R')).toBeInTheDocument();

    // CLOSED_WITH_TP_SL: shows 3.0R from configured TP & SL, and also shows actual exit RR
    expect(screen.getByText('3.0R')).toBeInTheDocument();
    expect(screen.getByText('实: 1.5R')).toBeInTheDocument();
  });

  it('opens trade review detail drawer, disables background scrolling and hides root scrollbars, then restores scrolling upon closing', async () => {
    const mockTrades = [
      {
        id: 77,
        symbol: 'XAUUSD',
        direction: 'short',
        size: 1,
        entryprice: 3548.63,
        exitprice: 3544.91,
        entry_time: '2026-11-20T23:56:00',
        exit_time: '2026-11-21T00:01:00',
        createdat: '2026-11-20T16:01:00',
      },
    ];
    vi.spyOn(api, 'getUserTrades').mockResolvedValue(mockTrades as any);
    localStorage.setItem('token', 'test-token');

    render(
      <MemoryRouter>
        <TradesPage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('全部')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole('button', { name: '全部' }));

    await waitFor(() => {
      expect(screen.getByText('XAUUSD')).toBeInTheDocument();
    });

    // Initially, background scrolling is not locked
    expect(document.body.style.overflow).toBe('');
    expect(document.documentElement.style.overflow).toBe('');

    // Click "详情" button to open detail drawer
    const detailBtn = screen.getByRole('button', { name: '详情' });
    fireEvent.click(detailBtn);

    // Verify detail drawer is open
    expect(screen.getByText('交易复盘详情')).toBeInTheDocument();

    // Verify background scroll lock and hidden root scrollbar
    expect(document.body.style.overflow).toBe('hidden');
    expect(document.documentElement.style.overflow).toBe('hidden');

    // Click header close button
    const closeBtn = screen.getByLabelText('关闭详情抽屉');
    fireEvent.click(closeBtn);

    // Drawer is closed
    expect(screen.queryByText('交易复盘详情')).not.toBeInTheDocument();

    // Background scrolling is restored
    expect(document.body.style.overflow).toBe('');
    expect(document.documentElement.style.overflow).toBe('');
  });

  it('removes status column header and status filter dropdown, and displays final price TP/SL trigger for manual trades', async () => {
    const mockTrades = [
      {
        id: 101,
        symbol: 'BTCUSDT',
        direction: 'long',
        size: 0.5,
        entryprice: 50000,
        exitprice: 50500,
        stop_loss: 49000,
        take_profit: 52000,
        final_trigger: 'takeProfit',
        entry_time: '2026-11-20T10:00:00',
        exit_time: '2026-11-20T11:00:00',
        createdat: '2026-11-20T10:00:00',
      },
      {
        id: 102,
        symbol: 'ETHUSDT',
        direction: 'short',
        size: 2,
        entryprice: 3000,
        exitprice: 3020,
        stop_loss: 3100,
        take_profit: 2800,
        final_trigger: 'stopLoss',
        entry_time: '2026-11-20T10:00:00',
        exit_time: '2026-11-20T11:00:00',
        createdat: '2026-11-20T10:00:00',
      },
      {
        id: 103,
        symbol: 'SOLUSDT',
        direction: 'long',
        size: 10,
        entryprice: 150,
        exitprice: 155,
        stop_loss: 140,
        take_profit: 170,
        entry_time: '2026-11-20T10:00:00',
        exit_time: '2026-11-20T11:00:00',
        createdat: '2026-11-20T10:00:00',
      },
    ];
    vi.spyOn(api, 'getUserTrades').mockResolvedValue(mockTrades as any);
    vi.spyOn(api, 'updateTrade').mockResolvedValue({} as any);
    localStorage.setItem('token', 'test-token');

    render(
      <MemoryRouter>
        <TradesPage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('全部')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole('button', { name: '全部' }));

    await waitFor(() => {
      expect(screen.getByText('BTCUSDT')).toBeInTheDocument();
    });

    // 1. Verify "状态" column header is NOT present
    const tableHeaders = screen.getAllByRole('columnheader').map((th) => th.textContent);
    expect(tableHeaders).not.toContain('状态');

    // 2. Verify "全部状态" dropdown filter is NOT present
    expect(screen.queryByPlaceholderText('全部状态')).not.toBeInTheDocument();
    expect(screen.queryByText('已平仓结算')).not.toBeInTheDocument();

    // 3. Verify manual close trades display final price triggers
    // Trade 101: manual close + final_trigger = 'takeProfit' -> displays "达止盈"
    expect(screen.getByText('达止盈')).toBeInTheDocument();

    // Trade 102: manual close + final_trigger = 'stopLoss' -> displays "达止损"
    expect(screen.getByText('达止损')).toBeInTheDocument();

    // Trade 103: plain manual close
    expect(screen.getAllByText('手动平仓').length).toBeGreaterThanOrEqual(3);

    // 4. Clicking manual close badge opens FinalTriggerModal
    const manualBtns = screen.getAllByTitle('点击快速标记或修改最终价格达止盈/达止损走势');
    expect(manualBtns.length).toBe(3);
    fireEvent.click(manualBtns[0]);

    expect(screen.getByText('手动平仓 · 标记最终价格走势')).toBeInTheDocument();
    expect(screen.getByText('最终价格达止盈')).toBeInTheDocument();
    expect(screen.getByText('最终价格达止损')).toBeInTheDocument();
    expect(screen.getByText(/仅手动平仓 \(清除标记\)/)).toBeInTheDocument();
  });

  it('reads URL query params (?quick=week&exitMethod=takeProfit) and carries time and conditions into filter', async () => {
    const today = getCurrentTradingDate();
    const mockTrades = [
      {
        id: 1,
        symbol: 'TP_TRADE',
        direction: 'long',
        size: 1,
        entryprice: 100,
        exitprice: 120,
        take_profit: 120,
        entry_time: `${today}T10:00:00`,
        createdat: `${today}T10:00:00`,
      },
      {
        id: 2,
        symbol: 'SL_TRADE',
        direction: 'long',
        size: 1,
        entryprice: 100,
        exitprice: 90,
        stop_loss: 90,
        entry_time: `${today}T10:00:00`,
        createdat: `${today}T10:00:00`,
      },
      {
        id: 3,
        symbol: 'MANUAL_TRADE',
        direction: 'long',
        size: 1,
        entryprice: 100,
        exitprice: 105,
        entry_time: `${today}T10:00:00`,
        createdat: `${today}T10:00:00`,
      },
    ];
    vi.spyOn(api, 'getUserTrades').mockResolvedValue(mockTrades);
    localStorage.setItem('token', 'test-token');

    render(
      <MemoryRouter initialEntries={['/trades?quick=week&exitMethod=takeProfit']}>
        <TradesPage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('TP_TRADE')).toBeInTheDocument();
      expect(screen.queryByText('SL_TRADE')).not.toBeInTheDocument();
      expect(screen.queryByText('MANUAL_TRADE')).not.toBeInTheDocument();
    });

    // Check exit method dropdown and row badge reflect "止盈触发"
    expect(screen.getAllByText('止盈触发').length).toBeGreaterThanOrEqual(2);
  });

  it('reads URL query params (?quick=all&exitMethod=manual&result=profit) and filters manual winning trades', async () => {
    const mockTrades = [
      {
        id: 1,
        symbol: 'MANUAL_WIN',
        direction: 'long',
        size: 1,
        entryprice: 100,
        exitprice: 110, // profit
        entry_time: '2026-10-01T10:00:00',
        createdat: '2026-10-01T10:00:00',
      },
      {
        id: 2,
        symbol: 'MANUAL_LOSS',
        direction: 'long',
        size: 1,
        entryprice: 100,
        exitprice: 95, // loss
        entry_time: '2026-10-02T10:00:00',
        createdat: '2026-10-02T10:00:00',
      },
    ];
    vi.spyOn(api, 'getUserTrades').mockResolvedValue(mockTrades);
    localStorage.setItem('token', 'test-token');

    render(
      <MemoryRouter initialEntries={['/trades?quick=all&exitMethod=manual&result=profit']}>
        <TradesPage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('MANUAL_WIN')).toBeInTheDocument();
      expect(screen.queryByText('MANUAL_LOSS')).not.toBeInTheDocument();
    });

    expect(screen.getByText('全部手动平仓')).toBeInTheDocument();
    expect(screen.getByText('盈利')).toBeInTheDocument();
  });

  it('renders "智能清理重复" button and triggers duplicate cleanup', async () => {
    const today = getCurrentTradingDate();
    const mockTrades = [
      { id: 1, symbol: 'XAUUSD', direction: 'short', size: 1, entryprice: 2650, exitprice: 2646, entry_time: `${today}T10:00:00`, createdat: `${today}T10:00:00` },
      { id: 2, symbol: 'XAUUSD', direction: 'short', size: 1, entryprice: 2650, exitprice: 2646, entry_time: `${today}T10:00:15`, createdat: `${today}T10:00:15` },
    ];
    vi.spyOn(api, 'getUserTrades').mockResolvedValue(mockTrades);
    vi.spyOn(api, 'cleanupDuplicateTrades').mockResolvedValue({
      success: true,
      data: { cleanedCount: 1, mergedCount: 1, remainingCount: 1 },
      message: '成功智能合并清理了 1 笔重复订单！',
    } as any);
    localStorage.setItem('token', 'test-token');

    render(
      <MemoryRouter>
        <TradesPage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('智能清理重复')).toBeInTheDocument();
    });

    const cleanBtn = screen.getByText('智能清理重复');
    fireEvent.click(cleanBtn);

    await waitFor(() => {
      expect(api.cleanupDuplicateTrades).toHaveBeenCalled();
      expect(screen.getByText(/成功智能合并清理了 1 笔重复订单！/)).toBeInTheDocument();
    });
  });
});
