import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
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
        onSelectRating={vi.fn()}
      />
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders modal with trade information and 5 stars', () => {
    render(
      <TradeRatingModal
        isOpen={true}
        onClose={vi.fn()}
        trade={mockTrade}
        onSelectRating={vi.fn()}
      />
    );

    expect(screen.getByText('设置交易纪律评分')).toBeInTheDocument();
    expect(screen.getByText('BTCUSD')).toBeInTheDocument();
    expect(screen.getByText('#101')).toBeInTheDocument();
    expect(screen.getByText('多 BUY')).toBeInTheDocument();
    expect(screen.getByText(/2手/)).toBeInTheDocument();

    // 5 star buttons are rendered
    expect(screen.getByTitle('评定为 1 星')).toBeInTheDocument();
    expect(screen.getByTitle('评定为 2 星')).toBeInTheDocument();
    expect(screen.getByTitle('评定为 3 星')).toBeInTheDocument();
    expect(screen.getByTitle('评定为 4 星')).toBeInTheDocument();
    expect(screen.getByTitle('评定为 5 星')).toBeInTheDocument();
  });

  it('clicking a star directly calls onSelectRating and closes modal', () => {
    const onSelectRating = vi.fn();
    const onClose = vi.fn();

    render(
      <TradeRatingModal
        isOpen={true}
        onClose={onClose}
        trade={mockTrade}
        onSelectRating={onSelectRating}
      />
    );

    // Clicking 4-star directly closes and sets rating
    const star4Btn = screen.getByTitle('评定为 4 星');
    fireEvent.click(star4Btn);

    expect(onSelectRating).toHaveBeenCalledWith(101, 4);
    expect(onClose).toHaveBeenCalled();
  });

  it('supports mouse hover preview of star descriptions', () => {
    render(
      <TradeRatingModal
        isOpen={true}
        onClose={vi.fn()}
        trade={mockTrade}
        onSelectRating={vi.fn()}
      />
    );

    const star5Btn = screen.getByTitle('评定为 5 星');
    fireEvent.mouseEnter(star5Btn);
    expect(screen.getByText('5星 · 知行合一')).toBeInTheDocument();

    const star1Btn = screen.getByTitle('评定为 1 星');
    fireEvent.mouseEnter(star1Btn);
    expect(screen.getByText('1星 · 严重违规')).toBeInTheDocument();
  });

  it('allows clearing rating to 0', () => {
    const onSelectRating = vi.fn();
    const onClose = vi.fn();

    render(
      <TradeRatingModal
        isOpen={true}
        onClose={onClose}
        trade={mockTrade}
        onSelectRating={onSelectRating}
      />
    );

    const clearBtn = screen.getByText('清空评分');
    fireEvent.click(clearBtn);

    expect(onSelectRating).toHaveBeenCalledWith(101, 0);
    expect(onClose).toHaveBeenCalled();
  });

  it('handles Escape key to close modal', () => {
    const onClose = vi.fn();
    render(
      <TradeRatingModal
        isOpen={true}
        onClose={onClose}
        trade={mockTrade}
        onSelectRating={vi.fn()}
      />
    );

    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onClose).toHaveBeenCalled();
  });

  it('handles number key 1~5 to quick rate and close', () => {
    const onSelectRating = vi.fn();
    const onClose = vi.fn();

    render(
      <TradeRatingModal
        isOpen={true}
        onClose={onClose}
        trade={mockTrade}
        onSelectRating={onSelectRating}
      />
    );

    fireEvent.keyDown(window, { key: '5' });
    expect(onSelectRating).toHaveBeenCalledWith(101, 5);
    expect(onClose).toHaveBeenCalled();
  });
});
