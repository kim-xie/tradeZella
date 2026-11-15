import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import TradeRatingAnimationOverlay from './TradeRatingAnimationOverlay';

describe('TradeRatingAnimationOverlay', () => {
  it('does not render when data is null or rating is 0', () => {
    const { container: c1 } = render(
      <TradeRatingAnimationOverlay data={null} onClose={vi.fn()} />
    );
    expect(c1.firstChild).toBeNull();

    const { container: c2 } = render(
      <TradeRatingAnimationOverlay data={{ rating: 0, symbol: 'BTCUSD', tradeId: 1 }} onClose={vi.fn()} />
    );
    expect(c2.firstChild).toBeNull();
  });

  it('renders 5-star celebration animation after modal closes', () => {
    render(
      <TradeRatingAnimationOverlay
        data={{ rating: 5, symbol: 'BTCUSD', tradeId: 22 }}
        onClose={vi.fn()}
      />
    );

    expect(screen.getByText(/#22 · BTCUSD 纪律评分已更新/)).toBeInTheDocument();
    expect(screen.getByText('知行合一 / 大师级执行！')).toBeInTheDocument();
    expect(screen.getByText(/知行合一 · 完美典范/)).toBeInTheDocument();
  });

  it('renders 4-star emerald animation', () => {
    render(
      <TradeRatingAnimationOverlay
        data={{ rating: 4, symbol: 'ETHUSD', tradeId: 33 }}
        onClose={vi.fn()}
      />
    );

    expect(screen.getByText('良好执行 / 严格纪律')).toBeInTheDocument();
    expect(screen.getByText(/良好执行 · 纪律严明/)).toBeInTheDocument();
  });

  it('renders 1-star warning alert animation', () => {
    render(
      <TradeRatingAnimationOverlay
        data={{ rating: 1, symbol: 'XAUUSD', tradeId: 44 }}
        onClose={vi.fn()}
      />
    );

    expect(screen.getByText('严重失误 / 违背计划')).toBeInTheDocument();
    expect(screen.getByText(/严重违规 · 需严格复盘/)).toBeInTheDocument();
  });

  it('closes when clicking the close button or backdrop', async () => {
    const onClose = vi.fn();
    render(
      <TradeRatingAnimationOverlay
        data={{ rating: 5, symbol: 'BTCUSD', tradeId: 22 }}
        onClose={onClose}
      />
    );

    const closeBtn = screen.getByTitle('关闭');
    fireEvent.click(closeBtn);

    await waitFor(() => {
      expect(onClose).toHaveBeenCalled();
    });
  });

  it('closes when pressing Escape key', async () => {
    const onClose = vi.fn();
    render(
      <TradeRatingAnimationOverlay
        data={{ rating: 3, symbol: 'BTCUSD', tradeId: 22 }}
        onClose={onClose}
      />
    );

    fireEvent.keyDown(window, { key: 'Escape' });

    await waitFor(() => {
      expect(onClose).toHaveBeenCalled();
    });
  });

  it('auto-dismisses after duration', async () => {
    const onClose = vi.fn();
    render(
      <TradeRatingAnimationOverlay
        data={{ rating: 4, symbol: 'BTCUSD', tradeId: 22 }}
        onClose={onClose}
        duration={100}
      />
    );

    await waitFor(() => {
      expect(onClose).toHaveBeenCalled();
    }, { timeout: 1000 });
  });
});
