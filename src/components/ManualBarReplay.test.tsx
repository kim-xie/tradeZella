import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import ManualBarReplay from './ManualBarReplay';
import * as api from '../services/api';

vi.mock('../services/api');

describe('ManualBarReplay - TradingView Position Sizing & Order Placement', () => {
  const mockCandles = Array.from({ length: 60 }, (_, i) => ({
    time: `2026-03-01 ${String(i).padStart(2, '0')}:00`,
    open: 1.0800 + i * 0.0001,
    high: 1.0820 + i * 0.0001,
    low: 1.0790 + i * 0.0001,
    close: 1.0810 + i * 0.0001,
    volume: 1000,
  }));

  beforeEach(() => {
    // Mock Canvas getContext
    HTMLCanvasElement.prototype.getContext = vi.fn().mockReturnValue({
      scale: vi.fn(),
      fillRect: vi.fn(),
      strokeRect: vi.fn(),
      beginPath: vi.fn(),
      moveTo: vi.fn(),
      lineTo: vi.fn(),
      arc: vi.fn(),
      arcTo: vi.fn(),
      closePath: vi.fn(),
      stroke: vi.fn(),
      fill: vi.fn(),
      fillText: vi.fn(),
      setLineDash: vi.fn(),
      clearRect: vi.fn(),
      save: vi.fn(),
      restore: vi.fn(),
      measureText: vi.fn().mockReturnValue({ width: 60 }),
    });

    vi.spyOn(api, 'fetchCandles').mockResolvedValue({
      symbol: 'EURUSD',
      timeframe: 'H1',
      contractSize: 100000,
      candles: mockCandles,
    });
  });

  it('renders TradingView Long/Short tool and position sizing metrics', async () => {
    render(<ManualBarReplay initialSymbol="EURUSD" />);

    await waitFor(() => {
      expect(screen.getByText(/看涨做多 \(Long Tool\)/i)).toBeInTheDocument();
      expect(screen.getByText(/看跌做空 \(Short Tool\)/i)).toBeInTheDocument();
    });

    // Check presence of Account Capital and Risk % inputs
    expect(screen.getByText(/账户资金 \(Capital\)/i)).toBeInTheDocument();
    expect(screen.getByText(/单笔风险比例 \(Risk %\)/i)).toBeInTheDocument();
    expect(screen.getByText(/推荐开仓手数:/i)).toBeInTheDocument();
    expect(screen.getByText(/预估止损亏损:/i)).toBeInTheDocument();
    expect(screen.getByText(/预估止盈收益:/i)).toBeInTheDocument();
  });

  it('switches between Long and Short modes seamlessly', async () => {
    render(<ManualBarReplay initialSymbol="EURUSD" />);

    await waitFor(() => {
      expect(screen.getByText(/看跌做空 \(Short Tool\)/i)).toBeInTheDocument();
    });

    // Click Short Tool
    const shortBtn = screen.getByText(/看跌做空 \(Short Tool\)/i);
    fireEvent.click(shortBtn);

    // Order execution button should now show SELL
    expect(screen.getByRole('button', { name: /看跌做空下单 \(SELL/i })).toBeInTheDocument();

    // Click Long Tool back
    const longBtn = screen.getByText(/看涨做多 \(Long Tool\)/i);
    fireEvent.click(longBtn);

    expect(screen.getByRole('button', { name: /看涨做多下单 \(BUY/i })).toBeInTheDocument();
  });

  it('updates Take Profit when clicking R:R presets', async () => {
    render(<ManualBarReplay initialSymbol="EURUSD" />);

    await waitFor(() => {
      expect(screen.getByText('1:2')).toBeInTheDocument();
    });

    // Click 1:3 R:R preset
    const rr3Btn = screen.getByText('1:3');
    fireEvent.click(rr3Btn);

    expect(screen.getByText(/1 : 3.00/i)).toBeInTheDocument();
  });

  it('allows placing a Long order and displays active position info', async () => {
    render(<ManualBarReplay initialSymbol="EURUSD" />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /看涨做多下单 \(BUY/i })).toBeInTheDocument();
    });

    const buyBtn = screen.getByRole('button', { name: /看涨做多下单 \(BUY/i });
    fireEvent.click(buyBtn);

    // Active position banner should now be visible
    await waitFor(() => {
      expect(screen.getByText(/市价平仓当前持仓/i)).toBeInTheDocument();
    });
  });

  it('renders TradingView manual chart drawing toolbar and allows tool switching', async () => {
    render(<ManualBarReplay initialSymbol="EURUSD" />);

    await waitFor(() => {
      expect(screen.getByText(/手动画线工具:/i)).toBeInTheDocument();
    });

    // Check all drawing tool buttons are present
    expect(screen.getByRole('button', { name: /指针 \/ 拖动手柄/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /做多画线标尺/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /做空画线标尺/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /水平支撑阻力线/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /趋势线/i })).toBeInTheDocument();

    // Check floating order execution button on chart
    expect(screen.getByRole('button', { name: /以当前画线下单/i })).toBeInTheDocument();

    // Switch to Horizontal Line Tool
    const hLineBtn = screen.getByRole('button', { name: /水平支撑阻力线/i });
    fireEvent.click(hLineBtn);

    // Tooltip should show horizontal line guidance
    expect(screen.getByText(/水平线工具已就绪/i)).toBeInTheDocument();

    // Switch to Trendline Tool
    const trendBtn = screen.getByRole('button', { name: /趋势线/i });
    fireEvent.click(trendBtn);

    expect(screen.getByText(/趋势线工具已就绪/i)).toBeInTheDocument();

    // Switch back to Pointer Tool
    const pointerBtn = screen.getByRole('button', { name: /指针 \/ 拖动手柄/i });
    fireEvent.click(pointerBtn);

    expect(screen.getByText(/按住鼠标上下拖拽/i)).toBeInTheDocument();
  }, 15000);
});
