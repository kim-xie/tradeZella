import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import ManualBarReplay from './ManualBarReplay';
import * as api from '../services/api';

vi.mock('../services/api');

// Mock lightweight-charts
vi.mock('lightweight-charts', () => {
  const mockSeries = {
    setData: vi.fn(),
    createPriceLine: vi.fn().mockReturnValue({ applyOptions: vi.fn() }),
    removePriceLine: vi.fn(),
  };

  const mockTimeScale = {
    fitContent: vi.fn(),
    setVisibleLogicalRange: vi.fn(),
    scrollToPosition: vi.fn(),
  };

  const mockChart = {
    addSeries: vi.fn().mockReturnValue(mockSeries),
    remove: vi.fn(),
    applyOptions: vi.fn(),
    timeScale: vi.fn().mockReturnValue(mockTimeScale),
    subscribeCrosshairMove: vi.fn(),
    unsubscribeCrosshairMove: vi.fn(),
  };

  return {
    createChart: vi.fn().mockReturnValue(mockChart),
    CandlestickSeries: {},
    createSeriesMarkers: vi.fn().mockReturnValue({ setMarkers: vi.fn() }),
    ColorType: { Solid: 'solid' },
    LineStyle: { Solid: 0, Dotted: 1, Dashed: 2, LargeDashed: 3, SparseDotted: 4 },
  };
});

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
    global.ResizeObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
    } as any;

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
      timeframe: 'M5',
      contractSize: 100000,
      candles: mockCandles,
    });

    vi.spyOn(api, 'getAvailableCandleSymbols').mockResolvedValue({
      symbols: ['EURUSD', 'GBPUSD', 'USDJPY', 'XAUUSD', '纳斯达克100', 'BTCUSD'],
      popularSymbols: ['EURUSD', 'GBPUSD', 'USDJPY', 'XAUUSD', '纳斯达克100', 'BTCUSD'],
    });
  });

  it('defaults to 5m (M5) timeframe for K-line replay', async () => {
    const fetchCandlesSpy = vi.spyOn(api, 'fetchCandles');
    render(<ManualBarReplay initialSymbol="EURUSD" />);

    const select = screen.getByLabelText(/K线周期/i) as HTMLSelectElement;
    expect(select.value).toBe('M5');

    await waitFor(() => {
      expect(fetchCandlesSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          symbol: 'EURUSD',
          timeframe: 'M5',
        })
      );
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
  }, 15000);

  it('updates Take Profit when clicking R:R presets', async () => {
    render(<ManualBarReplay initialSymbol="EURUSD" />);

    await waitFor(() => {
      expect(screen.getByText('1:2')).toBeInTheDocument();
    });

    // Click 1:3 R:R preset
    const rr3Btn = screen.getByText('1:3');
    fireEvent.click(rr3Btn);

    expect(screen.getByText(/1 : 3.00/i)).toBeInTheDocument();
  }, 15000);

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
  }, 15000);

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

  it('supports multi-window linked backtesting layouts and timeframe controls up to 4 windows', async () => {
    render(<ManualBarReplay initialSymbol="EURUSD" />);

    await waitFor(() => {
      expect(screen.getByText('1 图')).toBeInTheDocument();
      expect(screen.getByText('2 联屏')).toBeInTheDocument();
      expect(screen.getByText('3 联屏')).toBeInTheDocument();
      expect(screen.getByText('4 宫格')).toBeInTheDocument();
    });

    // Default is 1-window mode
    expect(screen.getByText('主控窗口')).toBeInTheDocument();
    expect(screen.queryByText('联动窗口 2')).not.toBeInTheDocument();

    // Switch to 2-window mode
    const btn2 = screen.getByText('2 联屏');
    fireEvent.click(btn2);

    expect(screen.getByText('主控窗口')).toBeInTheDocument();
    expect(screen.getByText('联动窗口 2')).toBeInTheDocument();
    expect(screen.queryByText('联动窗口 3')).not.toBeInTheDocument();

    // Switch to 4-window mode
    const btn4 = screen.getByText('4 宫格');
    fireEvent.click(btn4);

    expect(screen.getByText('主控窗口')).toBeInTheDocument();
    expect(screen.getByText('联动窗口 2')).toBeInTheDocument();
    expect(screen.getByText('联动窗口 3')).toBeInTheDocument();
    expect(screen.getByText('联动窗口 4')).toBeInTheDocument();

    // Sub-window timeframe select exists
    const win2Select = screen.getByLabelText('窗口2周期') as HTMLSelectElement;
    expect(win2Select).toBeInTheDocument();
    fireEvent.change(win2Select, { target: { value: 'H1' } });
    expect(win2Select.value).toBe('H1');

    // Switch back to 1-window mode
    const btn1 = screen.getByText('1 图');
    fireEvent.click(btn1);

    expect(screen.getByText('主控窗口')).toBeInTheDocument();
    expect(screen.queryByText('联动窗口 2')).not.toBeInTheDocument();
  }, 15000);

  it('renders TradingView lightweight-charts container and feeds data from K-line database', async () => {
    const fetchCandlesSpy = vi.spyOn(api, 'fetchCandles');
    render(<ManualBarReplay initialSymbol="EURUSD" />);

    await waitFor(() => {
      expect(screen.getByTestId('tv-container-0')).toBeInTheDocument();
      expect(fetchCandlesSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          symbol: 'EURUSD',
          timeframe: 'M5',
        })
      );
    });
  });
});
