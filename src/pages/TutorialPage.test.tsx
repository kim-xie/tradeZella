import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { HelmetProvider } from 'react-helmet-async';
import TutorialPage from './TutorialPage';

describe('TutorialPage (新手快速上手指南)', () => {
  const renderTutorial = () => {
    return render(
      <HelmetProvider>
        <MemoryRouter>
          <TutorialPage />
        </MemoryRouter>
      </HelmetProvider>
    );
  };

  it('renders beginner guide hero banner and starting point', () => {
    renderTutorial();

    expect(screen.getByText('TradeZen 新手快速上手指南')).toBeInTheDocument();
    expect(screen.getAllByText('实盘数据同步').length).toBeGreaterThan(0);
    expect(screen.getByText('STEP 01 · 核心起点')).toBeInTheDocument();
  });

  it('displays live sync as the first step with MT5 IPC and CSV guides', () => {
    renderTutorial();

    expect(screen.getByText('实盘交易数据同步与导入 (Live Sync)')).toBeInTheDocument();
    expect(screen.getByText('MT5 本地客户端极速直连 (最推荐)')).toBeInTheDocument();
    expect(screen.getByText('券商与交易所 CSV 账单导入')).toBeInTheDocument();
    expect(screen.getByText('立即开始实盘同步 (第一步)')).toBeInTheDocument();
  });

  it('allows clicking tabs to switch between tutorial steps', () => {
    renderTutorial();

    const calendarTab = screen.getByText('交易日历与每日复盘');
    fireEvent.click(calendarTab);

    expect(screen.getByText('STEP 04 · 周期归纳')).toBeInTheDocument();
    expect(screen.getByText('交易日历与当月盈亏柱形图 (Calendar)')).toBeInTheDocument();
  });

  it('introduces available features: Dashboard, Trades, Calendar, Replay, and Backtesting', () => {
    renderTutorial();

    expect(screen.getByText('仪表盘量化统计与全景透视 (Dashboard)')).toBeInTheDocument();
    expect(screen.getByText('交易明细表与多维过滤筛选 (Trades Journal)')).toBeInTheDocument();
    expect(screen.getByText('TradingView K线打点与逐帧动态复盘 (Replay Player)')).toBeInTheDocument();
    expect(screen.getByText('策略回测与知行合一手册 (Playbooks & Backtesting)')).toBeInTheDocument();
  });
});
