import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import TradeDrawer from './TradeDrawer';
import * as api from '../services/api';

vi.mock('../services/api');

describe('TradeDrawer - Layout & Spacing', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.setItem('token', 'mock-token');
  });

  const mockTrade = {
    id: 123,
    symbol: 'BTCUSD',
    direction: 'short' as const,
    size: 0.1,
    entryprice: 65415.77,
    exitprice: 65387.63,
    createdat: '2026-03-01 10:00:00',
    notes: 'Good execution',
    session: 'US' as const,
    final_trigger: 'takeProfit' as const,
  };

  it('renders modern categorized navigation tabs and spacious card layout', () => {
    render(
      <TradeDrawer
        isOpen={true}
        onClose={vi.fn()}
        onSuccess={vi.fn()}
        trade={mockTrade}
        availableSymbols={['BTCUSD', 'ETHUSD']}
      />
    );

    // Verify Tab buttons exist
    expect(screen.getByRole('button', { name: /全部内容/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /订单参数/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /信号与心智/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /复盘与笔记/i })).toBeInTheDocument();

    // Verify Card section titles are rendered
    expect(screen.getByText('订单核心参数')).toBeInTheDocument();
    expect(screen.getByText('策略信号与交易心智')).toBeInTheDocument();
    expect(screen.getByText('复盘反思与执行评估')).toBeInTheDocument();
  }, 15000);

  it('filters visible sections when switching tabs', () => {
    render(
      <TradeDrawer
        isOpen={true}
        onClose={vi.fn()}
        onSuccess={vi.fn()}
        trade={mockTrade}
        availableSymbols={['BTCUSD']}
      />
    );

    // Click "订单参数" tab
    fireEvent.click(screen.getByRole('button', { name: /订单参数/i }));
    expect(screen.getByText('订单核心参数')).toBeInTheDocument();
    expect(screen.queryByText('策略信号与交易心智')).not.toBeInTheDocument();
    expect(screen.queryByText('复盘反思与执行评估')).not.toBeInTheDocument();

    // Click "信号与心智" tab
    fireEvent.click(screen.getByRole('button', { name: /信号与心智/i }));
    expect(screen.queryByText('订单核心参数')).not.toBeInTheDocument();
    expect(screen.getByText('策略信号与交易心智')).toBeInTheDocument();
    expect(screen.queryByText('复盘反思与执行评估')).not.toBeInTheDocument();

    // Click "复盘与笔记" tab
    fireEvent.click(screen.getByRole('button', { name: /复盘与笔记/i }));
    expect(screen.queryByText('订单核心参数')).not.toBeInTheDocument();
    expect(screen.queryByText('策略信号与交易心智')).not.toBeInTheDocument();
    expect(screen.getByText('复盘反思与执行评估')).toBeInTheDocument();
  });

  it('switches to strategy tab automatically if required entry conditions are missing on submit', async () => {
    render(
      <TradeDrawer
        isOpen={true}
        onClose={vi.fn()}
        onSuccess={vi.fn()}
        trade={mockTrade}
        availableSymbols={['BTCUSD']}
      />
    );

    // Switch to details tab
    fireEvent.click(screen.getByRole('button', { name: /订单参数/i }));

    // Click save button
    const saveBtn = screen.getByRole('button', { name: /保存修改/i });
    fireEvent.click(saveBtn);

    // Should have switched to strategy tab and rendered entry conditions
    expect(screen.getByText('策略信号与交易心智')).toBeInTheDocument();
    expect(screen.getAllByText(/请至少选择一个入场形态或信号条件/i).length).toBeGreaterThanOrEqual(1);
  });

  it('supports maximizing and restoring drawer width, and closing via header button', () => {
    const handleClose = vi.fn();
    render(
      <TradeDrawer
        isOpen={true}
        onClose={handleClose}
        onSuccess={vi.fn()}
        trade={mockTrade}
        availableSymbols={['BTCUSD']}
      />
    );

    const toggleBtn = screen.getByTitle('全屏铺满抽屉');
    expect(toggleBtn).toBeInTheDocument();

    // Click to maximize
    fireEvent.click(toggleBtn);
    expect(screen.getByTitle('还原抽屉宽度')).toBeInTheDocument();

    // Click to restore
    fireEvent.click(screen.getByTitle('还原抽屉宽度'));
    expect(screen.getByTitle('全屏铺满抽屉')).toBeInTheDocument();

    // Click close button in header
    const closeBtn = screen.getByTitle('Close drawer');
    fireEvent.click(closeBtn);
    expect(handleClose).toHaveBeenCalled();
  });
});
