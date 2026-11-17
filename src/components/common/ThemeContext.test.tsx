import { render, screen, fireEvent, act } from '@testing-library/react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  ThemeProvider,
  useTheme,
  getTimeBasedTheme,
  getInitialThemeState,
} from './ThemeContext';

const TestConsumer: React.FC = () => {
  const { theme, toggleTheme, setTheme, isAuto, resetToAuto } = useTheme();
  return (
    <div>
      <span data-testid="current-theme">{theme}</span>
      <span data-testid="is-auto">{isAuto ? 'true' : 'false'}</span>
      <button data-testid="toggle-btn" onClick={toggleTheme}>
        Toggle
      </button>
      <button data-testid="set-dark-btn" onClick={() => setTheme('dark')}>
        Set Dark
      </button>
      <button data-testid="set-light-btn" onClick={() => setTheme('light')}>
        Set Light
      </button>
      <button data-testid="reset-auto-btn" onClick={resetToAuto}>
        Reset Auto
      </button>
    </div>
  );
};

describe('ThemeContext (Time-based default & manual switching)', () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.classList.remove('light', 'dark');
    vi.useRealTimers();
  });

  afterEach(() => {
    localStorage.clear();
    document.documentElement.classList.remove('light', 'dark');
    vi.useRealTimers();
  });

  describe('getTimeBasedTheme', () => {
    it('returns "dark" during night time (18:00 - 05:59)', () => {
      // 18:00
      expect(getTimeBasedTheme(new Date('2026-11-17T18:00:00'))).toBe('dark');
      // 21:30
      expect(getTimeBasedTheme(new Date('2026-11-17T21:30:00'))).toBe('dark');
      // 00:00
      expect(getTimeBasedTheme(new Date('2026-11-17T00:00:00'))).toBe('dark');
      // 03:00
      expect(getTimeBasedTheme(new Date('2026-11-17T03:00:00'))).toBe('dark');
      // 05:59
      expect(getTimeBasedTheme(new Date('2026-11-17T05:59:59'))).toBe('dark');
    });

    it('returns "light" during day time (06:00 - 17:59)', () => {
      // 06:00
      expect(getTimeBasedTheme(new Date('2026-11-17T06:00:00'))).toBe('light');
      // 09:15
      expect(getTimeBasedTheme(new Date('2026-11-17T09:15:00'))).toBe('light');
      // 12:00
      expect(getTimeBasedTheme(new Date('2026-11-17T12:00:00'))).toBe('light');
      // 15:45
      expect(getTimeBasedTheme(new Date('2026-11-17T15:45:00'))).toBe('light');
      // 17:59
      expect(getTimeBasedTheme(new Date('2026-11-17T17:59:59'))).toBe('light');
    });
  });

  describe('getInitialThemeState', () => {
    it('uses stored theme when localStorage has valid preference', () => {
      localStorage.setItem('theme', 'dark');
      expect(getInitialThemeState()).toEqual({ theme: 'dark', isManual: true });

      localStorage.setItem('theme', 'light');
      expect(getInitialThemeState()).toEqual({ theme: 'light', isManual: true });
    });

    it('derives from current time when localStorage is empty', () => {
      const mockDate = new Date('2026-11-17T20:00:00'); // night
      vi.setSystemTime(mockDate);
      expect(getInitialThemeState()).toEqual({ theme: 'dark', isManual: false });

      const dayDate = new Date('2026-11-17T11:00:00'); // day
      vi.setSystemTime(dayDate);
      expect(getInitialThemeState()).toEqual({ theme: 'light', isManual: false });
    });
  });

  describe('ThemeProvider integration', () => {
    it('defaults to dark at night and sets document class', () => {
      vi.setSystemTime(new Date('2026-11-17T22:00:00'));

      render(
        <ThemeProvider>
          <TestConsumer />
        </ThemeProvider>
      );

      expect(screen.getByTestId('current-theme')).toHaveTextContent('dark');
      expect(screen.getByTestId('is-auto')).toHaveTextContent('true');
      expect(document.documentElement.classList.contains('dark')).toBe(true);
      expect(document.documentElement.classList.contains('light')).toBe(false);
    });

    it('defaults to light during daytime and sets document class', () => {
      vi.setSystemTime(new Date('2026-11-17T10:00:00'));

      render(
        <ThemeProvider>
          <TestConsumer />
        </ThemeProvider>
      );

      expect(screen.getByTestId('current-theme')).toHaveTextContent('light');
      expect(screen.getByTestId('is-auto')).toHaveTextContent('true');
      expect(document.documentElement.classList.contains('light')).toBe(true);
      expect(document.documentElement.classList.contains('dark')).toBe(false);
    });

    it('allows manual toggling, updates localStorage and DOM classList', () => {
      vi.setSystemTime(new Date('2026-11-17T10:00:00')); // default: light

      render(
        <ThemeProvider>
          <TestConsumer />
        </ThemeProvider>
      );

      expect(screen.getByTestId('current-theme')).toHaveTextContent('light');

      // Click toggle -> switches to dark
      fireEvent.click(screen.getByTestId('toggle-btn'));

      expect(screen.getByTestId('current-theme')).toHaveTextContent('dark');
      expect(screen.getByTestId('is-auto')).toHaveTextContent('false');
      expect(localStorage.getItem('theme')).toBe('dark');
      expect(document.documentElement.classList.contains('dark')).toBe(true);
      expect(document.documentElement.classList.contains('light')).toBe(false);

      // Click toggle again -> switches to light
      fireEvent.click(screen.getByTestId('toggle-btn'));

      expect(screen.getByTestId('current-theme')).toHaveTextContent('light');
      expect(screen.getByTestId('is-auto')).toHaveTextContent('false');
      expect(localStorage.getItem('theme')).toBe('light');
      expect(document.documentElement.classList.contains('light')).toBe(true);
      expect(document.documentElement.classList.contains('dark')).toBe(false);
    });

    it('allows resetting back to auto time-based theme', () => {
      vi.setSystemTime(new Date('2026-11-17T23:00:00')); // Night: should be dark in auto

      // User previously set manual 'light'
      localStorage.setItem('theme', 'light');

      render(
        <ThemeProvider>
          <TestConsumer />
        </ThemeProvider>
      );

      expect(screen.getByTestId('current-theme')).toHaveTextContent('light');
      expect(screen.getByTestId('is-auto')).toHaveTextContent('false');

      // Click reset to auto
      fireEvent.click(screen.getByTestId('reset-auto-btn'));

      expect(screen.getByTestId('current-theme')).toHaveTextContent('dark');
      expect(screen.getByTestId('is-auto')).toHaveTextContent('true');
      expect(localStorage.getItem('theme')).toBeNull();
      expect(document.documentElement.classList.contains('dark')).toBe(true);
    });
  });
});
