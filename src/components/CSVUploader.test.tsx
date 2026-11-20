import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import CSVUploader from './CSVUploader';
import * as api from '../services/api';

vi.mock('../services/api', () => ({
  SERVER_BASE_URL: 'http://localhost:5000',
  getSyncToken: vi.fn(),
}));

vi.mock('../services/realtime', () => ({
  useRealtimeTrades: () => ({ isConnected: true }),
}));

describe('CSVUploader - Sync Center', () => {
  const onUploadSuccess = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    (api.getSyncToken as any).mockResolvedValue('test-ea-token-1234567890abcdef1234567890abcdef');
    Object.assign(navigator, {
      clipboard: {
        writeText: vi.fn().mockResolvedValue(undefined),
      },
    });
  });

  it('renders default MQL EA direct push tab and displays token and endpoints', async () => {
    render(<CSVUploader onUploadSuccess={onUploadSuccess} />);

    // Check title and subtitle
    expect(screen.getByText('交易与行情同步中心（复盘与统计）')).toBeInTheDocument();
    expect(screen.getByText(/支持 MQL EA 自动实时直推/)).toBeInTheDocument();

    // Check tabs
    expect(screen.getByText('MQL EA 自动直推 (订单+K线)')).toBeInTheDocument();
    expect(screen.getByText('报表文件导入 (全格式)')).toBeInTheDocument();

    // Check EA downloads
    expect(screen.getByText('下载 MT5 EA (.mq5)')).toBeInTheDocument();
    expect(screen.getByText('下载 MT4 EA (.mq4)')).toBeInTheDocument();

    // Check API endpoint and Token
    expect(screen.getByText('http://localhost:5000/api')).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByText(/test-ea-token-1234567890abcdef/)).toBeInTheDocument();
    });

    // Check 4-step instructions
    expect(screen.getByText('第一步：放置 EA 插件')).toBeInTheDocument();
    expect(screen.getByText('第二步：开启 WebRequest')).toBeInTheDocument();
    expect(screen.getByText('第三步：挂载并填入密钥')).toBeInTheDocument();
    expect(screen.getByText('第四步：全自动双向同步')).toBeInTheDocument();
  });

  it('switches to report file upload tab and renders format cards', async () => {
    render(<CSVUploader onUploadSuccess={onUploadSuccess} />);

    await waitFor(() => {
      expect(screen.getByText(/test-ea-token-1234567890abcdef/)).toBeInTheDocument();
    });

    // Click file upload tab
    fireEvent.click(screen.getByText('报表文件导入 (全格式)'));

    // Check format items
    expect(screen.getByText('MT4 报表')).toBeInTheDocument();
    expect(screen.getByText('MT5 HTML 报告')).toBeInTheDocument();
    expect(screen.getByText('MT5 XML / Excel')).toBeInTheDocument();
    expect(screen.getByText('CSV / TSV 数据')).toBeInTheDocument();

    // Check sample download buttons
    expect(screen.getByText('MT5 HTML')).toBeInTheDocument();
    expect(screen.getByText('MT5 XML')).toBeInTheDocument();
    expect(screen.getByText('MT4 HTML')).toBeInTheDocument();
    expect(screen.getByText('MT5 CSV')).toBeInTheDocument();
    expect(screen.getByText('TradeZen 标准')).toBeInTheDocument();

    // Check upload button
    expect(screen.getByText('开始导入报表')).toBeInTheDocument();
  });

  it('supports copying api endpoint and ea token to clipboard', async () => {
    render(<CSVUploader onUploadSuccess={onUploadSuccess} />);

    await waitFor(() => {
      expect(screen.getByText(/test-ea-token-1234567890abcdef/)).toBeInTheDocument();
    });

    const copyButtons = screen.getAllByRole('button', { name: /复制/ });
    expect(copyButtons.length).toBeGreaterThan(0);

    // Click first copy button (URL)
    fireEvent.click(copyButtons[0]);
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith('http://localhost:5000/api');
  });
});
