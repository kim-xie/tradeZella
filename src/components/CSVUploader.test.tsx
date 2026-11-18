import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import CSVUploader from './CSVUploader';
import * as api from '../services/api';

vi.mock('../services/api', () => ({
  SERVER_BASE_URL: 'http://localhost:5000',
  getMT5Status: vi.fn(),
  syncMT5Trades: vi.fn(),
  getSyncToken: vi.fn(),
}));

describe('CSVUploader - Sync Range Options', () => {
  const onUploadSuccess = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    (api.getMT5Status as any).mockResolvedValue({
      connected: true,
      account: {
        login: 123456,
        server: 'Demo-Server',
        balance: 10000,
        currency: 'USD',
      },
      symbolsTotal: 50,
    });
  });

  it('renders default sync range options including 本周, 本月, 今年, 全部 and DateRangePicker', async () => {
    render(<CSVUploader onUploadSuccess={onUploadSuccess} />);

    await waitFor(() => {
      expect(screen.getByText('本周')).toBeInTheDocument();
    });

    expect(screen.getByText('本周')).toBeInTheDocument();
    expect(screen.getByText('本月')).toBeInTheDocument();
    expect(screen.getByText('今年')).toBeInTheDocument();
    expect(screen.getByText('全部')).toBeInTheDocument();
    expect(screen.getByText('最近 30 天')).toBeInTheDocument();
    expect(screen.getByText('日历自选')).toBeInTheDocument();
    expect(screen.getByTitle('开始日期')).toBeInTheDocument();
    expect(screen.getByTitle('结束日期')).toBeInTheDocument();

    // Default is 本月
    expect(screen.getByText(/（本月）/)).toBeInTheDocument();
  });

  it('switches to 本周, 今年, 全部 and updates preview', async () => {
    render(<CSVUploader onUploadSuccess={onUploadSuccess} />);

    await waitFor(() => {
      expect(screen.getByText('本周')).toBeInTheDocument();
    });

    // Click 本周
    fireEvent.click(screen.getByText('本周'));
    expect(screen.getByText(/（本周）/)).toBeInTheDocument();

    // Click 今年
    fireEvent.click(screen.getByText('今年'));
    expect(screen.getByText(/（今年）/)).toBeInTheDocument();

    // Click 全部
    fireEvent.click(screen.getByText('全部'));
    expect(screen.getByText('全量历史平仓订单')).toBeInTheDocument();
  });

  it('allows selecting custom dates via DateRangePicker calendar', async () => {
    render(<CSVUploader onUploadSuccess={onUploadSuccess} />);

    await waitFor(() => {
      expect(screen.getByTitle('开始日期')).toBeInTheDocument();
    });

    const startInput = screen.getByTitle('开始日期');
    fireEvent.change(startInput, { target: { value: '2026-10-01' } });
    expect(screen.getByText(/（自定义区间）/)).toBeInTheDocument();
  });

  it('toggles real-time incremental sync switch', async () => {
    render(<CSVUploader onUploadSuccess={onUploadSuccess} />);

    await waitFor(() => {
      expect(screen.getByText('实时增量同步开关')).toBeInTheDocument();
    });

    // Default is ON
    expect(screen.getByText(/已开启（默认自动抓取增量订单）/)).toBeInTheDocument();

    // Toggle switch to OFF
    const toggleCheckbox = screen.getByRole('checkbox');
    expect(toggleCheckbox).toBeChecked();
    fireEvent.click(toggleCheckbox);

    // Now should be OFF
    expect(screen.getByText(/已关闭（已暂停实时同步/)).toBeInTheDocument();
    expect(toggleCheckbox).not.toBeChecked();
  });
});
