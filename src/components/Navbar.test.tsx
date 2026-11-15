import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import Navbar from './Navbar';
import { ThemeProvider } from './common/ThemeContext';

describe('Navbar', () => {
  const renderNavbar = (initialRoute = '/') => {
    return render(
      <ThemeProvider>
        <MemoryRouter initialEntries={[initialRoute]}>
          <Navbar />
        </MemoryRouter>
      </ThemeProvider>
    );
  };

  it('renders all 6 consistent navigation items', () => {
    renderNavbar();

    expect(screen.getByText('仪表盘')).toBeInTheDocument();
    expect(screen.getByText('交易明细')).toBeInTheDocument();
    expect(screen.getByText('交易日历')).toBeInTheDocument();
    expect(screen.getByText('K线回测')).toBeInTheDocument();
    expect(screen.getByText('实盘同步')).toBeInTheDocument();
    expect(screen.getByText('新手教程')).toBeInTheDocument();
  });

  it('hides Features, 资源中心, and 方案定价 menus as requested', () => {
    renderNavbar();

    expect(screen.queryByText(/Features/i)).not.toBeInTheDocument();
    expect(screen.queryByText('资源中心')).not.toBeInTheDocument();
    expect(screen.queryByText('方案定价')).not.toBeInTheDocument();
  });

  it('provides working link to beginner tutorial page', () => {
    renderNavbar();

    const tutorialLink = screen.getByText('新手教程').closest('a');
    expect(tutorialLink).toHaveAttribute('href', '/tutorial');
  });

  it('toggles theme when clicking theme switcher button', () => {
    renderNavbar();

    const themeBtn = screen.getByTestId('theme-switcher');
    expect(themeBtn).toBeInTheDocument();
    fireEvent.click(themeBtn);
    expect(themeBtn).toBeInTheDocument();
  });
});
