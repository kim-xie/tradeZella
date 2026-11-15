import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import TradesPage from './TradesPage';
import * as api from '../services/api';

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
    const pad = (n: number) => String(n).padStart(2, '0');
    const now = new Date();
    const today = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
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
    const searchInput = screen.getByPlaceholderText('搜索标的');
    fireEvent.change(searchInput, { target: { value: 'EURUSD' } });

    await waitFor(() => {
      expect(screen.queryByText('XAUUSD')).not.toBeInTheDocument();
      expect(screen.getByText('EURUSD')).toBeInTheDocument();
    });
  });

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
});
