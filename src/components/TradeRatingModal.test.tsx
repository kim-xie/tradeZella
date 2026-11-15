import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import TradeRatingModal from './TradeRatingModal';

describe('TradeRatingModal', () => {
  const mockTrade = {
    id: 101,
    symbol: 'BTCUSD',
    direction: 'long' as const,
    rating: 3,
    size: 2,
    entryprice: 50000,
    exitprice: 52000,
  };

  it('does not render when isOpen is false', () => {
    const { container } = render(
      <TradeRatingModal
        isOpen={false}
        onClose={vi.fn()}
        trade={mockTrade}
        onSaveRating={vi.fn()}
      />
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders modal with trade information and initial rating animation on open', () => {
    render(
      <TradeRatingModal
        isOpen={true}
        onClose={vi.fn()}
        trade={mockTrade}
        onSaveRating={vi.fn()}
      />
    );

    expect(screen.getByText('设置交易纪律评分')).toBeInTheDocument();
    expect(screen.getByText('BTCUSD')).toBeInTheDocument();
    expect(screen.getByText('#101')).toBeInTheDocument();
    expect(screen.getByText('多 BUY')).toBeInTheDocument();
    expect(screen.getByText(/2手/)).toBeInTheDocument();

    // Initial rating is 3 -> Should display 3-star feedback
    expect(screen.getByText('基本合格 / 中规中矩')).toBeInTheDocument();
    expect(screen.getByText(/基本合格 · 守住底线/)).toBeInTheDocument();
  });

  it('switches dynamic animation and feedback for 1, 2, 4, and 5 star ratings', () => {
    render(
      <TradeRatingModal
        isOpen={true}
        onClose={vi.fn()}
        trade={mockTrade}
        onSaveRating={vi.fn()}
      />
    );

    // 1-star
    const star1Btn = screen.getByTitle('评定为 1 星');
    fireEvent.click(star1Btn);
    expect(screen.getByText('严重失误 / 违背计划')).toBeInTheDocument();
    expect(screen.getByText(/严重违规 · 需严格复盘/)).toBeInTheDocument();

    // 2-star
    const star2Btn = screen.getByTitle('评定为 2 星');
    fireEvent.click(star2Btn);
    expect(screen.getByText('执行欠佳 / 存在偏差')).toBeInTheDocument();
    expect(screen.getByText(/执行欠佳 · 稍有侥幸/)).toBeInTheDocument();

    // 4-star
    const star4Btn = screen.getByTitle('评定为 4 星');
    fireEvent.click(star4Btn);
    expect(screen.getByText('良好执行 / 严格纪律')).toBeInTheDocument();
    expect(screen.getByText(/良好执行 · 纪律严明/)).toBeInTheDocument();

    // 5-star
    const star5Btn = screen.getByTitle('评定为 5 星');
    fireEvent.click(star5Btn);
    expect(screen.getByText('知行合一 / 大师级执行！')).toBeInTheDocument();
    expect(screen.getByText(/知行合一 · 完美典范/)).toBeInTheDocument();
  });

  it('supports mouse hover preview of ratings', () => {
    render(
      <TradeRatingModal
        isOpen={true}
        onClose={vi.fn()}
        trade={mockTrade}
        onSaveRating={vi.fn()}
      />
    );

    const star5Btn = screen.getByTitle('评定为 5 星');
    fireEvent.mouseEnter(star5Btn);
    expect(screen.getByText('知行合一 / 大师级执行！')).toBeInTheDocument();

    fireEvent.mouseLeave(star5Btn);
    // Returns to selected rating (3)
    expect(screen.getByText('基本合格 / 中规中矩')).toBeInTheDocument();
  });

  it('calls onSaveRating with selected rating and closes smoothly', async () => {
    const onSaveRating = vi.fn().mockResolvedValue(undefined);
    const onClose = vi.fn();

    render(
      <TradeRatingModal
        isOpen={true}
        onClose={onClose}
        trade={mockTrade}
        onSaveRating={onSaveRating}
      />
    );

    // Select 5-star
    fireEvent.click(screen.getByTitle('评定为 5 星'));

    // Click Save
    const saveBtn = screen.getByRole('button', { name: '保存评分' });
    fireEvent.click(saveBtn);

    expect(onSaveRating).toHaveBeenCalledWith(101, 5);

    await waitFor(() => {
      expect(screen.getByText('已保存')).toBeInTheDocument();
    });

    await waitFor(() => {
      expect(onClose).toHaveBeenCalled();
    }, { timeout: 1000 });
  });

  it('allows clearing rating to 0', async () => {
    const onSaveRating = vi.fn().mockResolvedValue(undefined);
    const onClose = vi.fn();

    render(
      <TradeRatingModal
        isOpen={true}
        onClose={onClose}
        trade={mockTrade}
        onSaveRating={onSaveRating}
      />
    );

    // Click clear button
    const clearBtn = screen.getByText('清空评分');
    fireEvent.click(clearBtn);

    expect(screen.getByText('请为本笔交易设定纪律评分')).toBeInTheDocument();

    // Click Save
    fireEvent.click(screen.getByRole('button', { name: '保存评分' }));
    expect(onSaveRating).toHaveBeenCalledWith(101, 0);

    await waitFor(() => {
      expect(screen.getByText('已保存')).toBeInTheDocument();
    });
  });

  it('handles Escape key to close modal', () => {
    const onClose = vi.fn();
    render(
      <TradeRatingModal
        isOpen={true}
        onClose={onClose}
        trade={mockTrade}
        onSaveRating={vi.fn()}
      />
    );

    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onClose).toHaveBeenCalled();
  });
});
