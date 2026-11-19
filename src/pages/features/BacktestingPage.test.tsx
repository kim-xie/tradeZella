import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import BacktestingPage from './BacktestingPage';
import * as api from '../../services/api';

vi.mock('../../services/api');

describe('BacktestingPage - Dedicated TradingView K-Line Backtest & Strategy Tester', () => {
  const mockCandles = Array.from({ length: 60 }, (_, i) => ({
    time: `2026-03-01 ${String(i).padStart(2, '0')}:00`,
    open: 1.0800 + i * 0.0001,
    high: 1.0820 + i * 0.0001,
    low: 1.0790 + i * 0.0001,
    close: 1.0810 + i * 0.0001,
    volume: 1000,
  }));

  beforeEach(() => {
    // Mock HTMLCanvasElement
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

    vi.spyOn(api, 'getMT5Status').mockResolvedValue({
      connected: true,
      account: {
        login: 123456,
        company: 'TradeZen MetaQuotes MT5',
        currency: 'USD',
        balance: 10000,
        equity: 10000,
      },
      symbolsTotal: 58,
      popularSymbols: ['EURUSD', 'GBPUSD', 'USDJPY', 'XAUUSD', '纳斯达克100', 'BTCUSD'],
    });

    vi.spyOn(api, 'getAvailableCandleSymbols').mockResolvedValue({
      symbols: ['EURUSD', 'GBPUSD', 'USDJPY', 'XAUUSD', '纳斯达克100', 'BTCUSD'],
      popularSymbols: ['EURUSD', 'GBPUSD', 'USDJPY', 'XAUUSD', '纳斯达克100', 'BTCUSD'],
    });

    vi.spyOn(api, 'fetchCandles').mockResolvedValue({
      success: true,
      symbol: 'EURUSD',
      timeframe: 'M5',
      contractSize: 100000,
      dataSource: 'MT5 Direct',
      count: mockCandles.length,
      candles: mockCandles,
    });
  });

  it('renders immersive replay workspace without redundant top header or MT5 banner, and NO legacy strategy builder tab', async () => {
    render(<BacktestingPage />);

    await waitFor(() => {
      expect(screen.getByTitle(/选择切片复盘起点/i)).toBeInTheDocument();
    });

    // 1. Redundant Page Title & MT5 Banner are removed for clean immersive charting
    expect(screen.queryByText(/TradingView 风格 K线重播回测系统/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/参考 TradingView 实现的逐根K线重播与多空标尺回测引擎/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/MT5 终端行情直连引擎就绪/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/未连接本地 MT5 终端/i)).not.toBeInTheDocument();

    // 2. LEGACY STRATEGY BUILDER IS GONE
    expect(screen.queryByText(/自动策略回测 \(Strategy Builder\)/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/双均线交叉趋势策略/i)).not.toBeInTheDocument();
  });

  it('renders TradingView K-line Bar Replay player, drawing tools, and order console directly', async () => {
    render(<BacktestingPage />);

    // Check Replay player controls
    await waitFor(() => {
      expect(screen.getByTitle(/选择切片复盘起点/i)).toBeInTheDocument();
      expect(screen.getByTitle(/前进一根 K 线/i)).toBeInTheDocument();
      expect(screen.getByTitle(/重置到起点/i)).toBeInTheDocument();
    });

    // Check TradingView order console
    expect(screen.getByText(/看涨做多 \(Long Tool\)/i)).toBeInTheDocument();
    expect(screen.getByText(/看跌做空 \(Short Tool\)/i)).toBeInTheDocument();
    expect(screen.getByText(/账户资金 \(Capital\)/i)).toBeInTheDocument();
    expect(screen.getByText(/单笔风险比例 \(Risk %\)/i)).toBeInTheDocument();
  });

  it('renders Backtest Result Statistics (Strategy Tester) with Performance Summary, Equity Curve, and Trade List', async () => {
    render(<BacktestingPage />);

    await waitFor(() => {
      expect(screen.getByText(/回测结果统计与策略报告 \(Strategy Tester\)/i)).toBeInTheDocument();
    });

    // Sub-tab navigation
    expect(screen.getByText(/核心绩效指标 \(Summary\)/i)).toBeInTheDocument();
    expect(screen.getByText(/资金权益曲线 \(Equity Curve\)/i)).toBeInTheDocument();
    expect(screen.getByText(/成交流水明细/i)).toBeInTheDocument();

    // KPI cards in Performance Summary
    expect(screen.getByText(/当前\/最终净值/i)).toBeInTheDocument();
    expect(screen.getByText(/累计净利润 \(Net Profit\)/i)).toBeInTheDocument();
    expect(screen.getByText(/胜率 \(Win Rate\)/i)).toBeInTheDocument();
    expect(screen.getByText(/利润因子 \(Profit Factor\)/i)).toBeInTheDocument();
    expect(screen.getByText(/最大资金回撤 \(Drawdown\)/i)).toBeInTheDocument();
    expect(screen.getByText(/平均单笔盈亏 \(Avg Trade\)/i)).toBeInTheDocument();

    // Export action button
    expect(screen.getByRole('button', { name: /导出成交 \(CSV\)/i })).toBeInTheDocument();
  });
});
