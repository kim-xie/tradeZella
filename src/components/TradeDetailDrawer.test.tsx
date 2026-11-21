import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import TradeDetailDrawer, { DetailTrade } from './TradeDetailDrawer';

describe('TradeDetailDrawer', () => {
  const mockTrade: DetailTrade = {
    id: 99,
    symbol: 'XAUUSD',
    direction: 'long',
    size: 2.0,
    entryprice: 2650.50,
    exitprice: 2665.80,
    stop_loss: 2640.00,
    take_profit: 2670.00,
    entry_time: '2026-11-20T10:00:00',
    exit_time: '2026-11-20T14:30:00',
    createdat: '2026-11-20T10:00:00',
    notes: 'Gold breakout continuation setup',
    tags: ['Gold', 'Breakout'],
    sentiment: 'Zen',
    session: 'Europe',
    rating: 5,
  };

  it('renders trade detail drawer header, pnl badge, and parameters', () => {
    const handleClose = vi.fn();
    render(<TradeDetailDrawer trade={mockTrade} onClose={handleClose} />);

    expect(screen.getByText('交易复盘详情')).toBeInTheDocument();
    expect(screen.getAllByText('XAUUSD').length).toBeGreaterThan(0);
    expect(screen.getByText('做多 (Long)')).toBeInTheDocument();
    expect(screen.getByText('#Gold')).toBeInTheDocument();
    expect(screen.getByText('#Breakout')).toBeInTheDocument();
    expect(screen.getByText('Gold breakout continuation setup')).toBeInTheDocument();

    // Close button in header
    const closeBtn = screen.getByTitle('Close drawer');
    fireEvent.click(closeBtn);
    expect(handleClose).toHaveBeenCalled();
  });

  it('supports maximizing to full-width and restoring drawer width', () => {
    const handleClose = vi.fn();
    render(<TradeDetailDrawer trade={mockTrade} onClose={handleClose} />);

    const toggleBtn = screen.getByTitle('全屏铺满抽屉');
    expect(toggleBtn).toBeInTheDocument();

    // Toggle maximize
    fireEvent.click(toggleBtn);
    expect(screen.getByTitle('还原抽屉宽度')).toBeInTheDocument();

    // Toggle restore
    fireEvent.click(screen.getByTitle('还原抽屉宽度'));
    expect(screen.getByTitle('全屏铺满抽屉')).toBeInTheDocument();
  });

  it('locks background scroll and restores on unmount', () => {
    const handleClose = vi.fn();
    const { unmount } = render(<TradeDetailDrawer trade={mockTrade} onClose={handleClose} />);

    expect(document.body.style.overflow).toBe('hidden');
    expect(document.documentElement.style.overflow).toBe('hidden');

    unmount();
    expect(document.body.style.overflow).toBe('');
    expect(document.documentElement.style.overflow).toBe('');
  });
});
