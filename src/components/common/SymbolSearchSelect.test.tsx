import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import SymbolSearchSelect from './SymbolSearchSelect';

describe('SymbolSearchSelect', () => {
  const mockSymbols = ['EURUSD', 'GBPUSD', 'USDJPY', 'XAUUSD', '纳斯达克100', '中国A50指数', '标普500'];
  const popularSymbols = ['EURUSD', '纳斯达克100'];

  it('renders initial value', () => {
    const handleChange = vi.fn();
    render(
      <SymbolSearchSelect
        value="EURUSD"
        onChange={handleChange}
        symbols={mockSymbols}
        popularSymbols={popularSymbols}
      />
    );

    const input = screen.getByRole('textbox') as HTMLInputElement;
    expect(input.value).toBe('EURUSD');
  });

  it('filters symbols when user types Chinese query', () => {
    const handleChange = vi.fn();
    render(
      <SymbolSearchSelect
        value="EURUSD"
        onChange={handleChange}
        symbols={mockSymbols}
        popularSymbols={popularSymbols}
      />
    );

    const input = screen.getByRole('textbox');
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: '纳斯' } });

    expect(screen.getByText('纳斯达克100')).toBeInTheDocument();
    expect(screen.queryByText('EURUSD')).not.toBeInTheDocument();
    expect(screen.queryByText('中国A50指数')).not.toBeInTheDocument();
  });

  it('filters symbols case-insensitively for English tickers', () => {
    const handleChange = vi.fn();
    render(
      <SymbolSearchSelect
        value="EURUSD"
        onChange={handleChange}
        symbols={mockSymbols}
        popularSymbols={popularSymbols}
      />
    );

    const input = screen.getByRole('textbox');
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: 'usdjpy' } });

    expect(screen.getByText('USDJPY')).toBeInTheDocument();
    expect(screen.queryByText('纳斯达克100')).not.toBeInTheDocument();
  });

  it('calls onChange when user clicks a filtered option', () => {
    const handleChange = vi.fn();
    render(
      <SymbolSearchSelect
        value="EURUSD"
        onChange={handleChange}
        symbols={mockSymbols}
        popularSymbols={popularSymbols}
      />
    );

    const input = screen.getByRole('textbox');
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: '500' } });

    const option = screen.getByText('标普500');
    fireEvent.click(option);

    expect(handleChange).toHaveBeenCalledWith('标普500');
  });

  it('supports Enter key to select top highlighted match', () => {
    const handleChange = vi.fn();
    render(
      <SymbolSearchSelect
        value="EURUSD"
        onChange={handleChange}
        symbols={mockSymbols}
        popularSymbols={popularSymbols}
      />
    );

    const input = screen.getByRole('textbox');
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: 'A50' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    expect(handleChange).toHaveBeenCalledWith('中国A50指数');
  });
});
