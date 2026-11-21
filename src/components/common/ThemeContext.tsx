import React, { createContext, useState, useContext, ReactNode, useEffect, useCallback } from 'react';

export type Theme = 'light' | 'dark';

export interface ThemeContextType {
  theme: Theme;
  toggleTheme: () => void;
  setTheme: (theme: Theme) => void;
  isAuto: boolean;
  resetToAuto: () => void;
}

const THEME_STORAGE_KEY = 'theme';

/**
 * 根据时间自动推导默认主题：
 * 晚上（18:00 至次日 06:00）显示黑色暗色模式 (dark)
 * 白天（06:00 至 18:00）显示白色亮色模式 (light)
 */
export const getTimeBasedTheme = (date: Date = new Date()): Theme => {
  const hour = date.getHours();
  return hour >= 18 || hour < 6 ? 'dark' : 'light';
};

/**
 * 读取当前存储或初始主题
 */
export const getInitialThemeState = (): { theme: Theme; isManual: boolean } => {
  if (typeof window === 'undefined') {
    return { theme: 'light', isManual: false };
  }
  try {
    const saved = localStorage.getItem(THEME_STORAGE_KEY);
    if (saved === 'light' || saved === 'dark') {
      return { theme: saved, isManual: true };
    }
  } catch (e) {
    // 忽略 localStorage 访问异常（例如隐私模式禁用）
  }
  return { theme: getTimeBasedTheme(), isManual: false };
};

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    const isDark = typeof document !== 'undefined' && document.documentElement.classList.contains('dark');
    return {
      theme: (isDark ? 'dark' : 'light') as Theme,
      toggleTheme: () => {},
      setTheme: () => {},
      isAuto: false,
      resetToAuto: () => {},
    };
  }
  return context;
};

interface ThemeProviderProps {
  children: ReactNode;
}

export const ThemeProvider: React.FC<ThemeProviderProps> = ({ children }) => {
  const [state, setState] = useState<{ theme: Theme; isManual: boolean }>(() => getInitialThemeState());

  const { theme, isManual } = state;

  // 同步更新 documentElement class 样式
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const root = window.document.documentElement;
    root.classList.remove('light', 'dark');
    root.classList.add(theme);
  }, [theme]);

  // 如果处于时间自动模式，定时（每分钟）或页面重新激活聚焦时动态检查并同步白天/夜晚切换
  useEffect(() => {
    if (isManual) return;

    const checkTimeTheme = () => {
      const autoTheme = getTimeBasedTheme();
      setState((prev) => {
        if (!prev.isManual && prev.theme !== autoTheme) {
          return { ...prev, theme: autoTheme };
        }
        return prev;
      });
    };

    const interval = setInterval(checkTimeTheme, 60000);
    window.addEventListener('focus', checkTimeTheme);
    document.addEventListener('visibilitychange', checkTimeTheme);

    return () => {
      clearInterval(interval);
      window.removeEventListener('focus', checkTimeTheme);
      document.removeEventListener('visibilitychange', checkTimeTheme);
    };
  }, [isManual]);

  // 手动切换主题：记录到 localStorage 并保持用户手动偏好
  const toggleTheme = useCallback(() => {
    setState((prev) => {
      const nextTheme: Theme = prev.theme === 'light' ? 'dark' : 'light';
      try {
        localStorage.setItem(THEME_STORAGE_KEY, nextTheme);
      } catch (e) {}
      return { theme: nextTheme, isManual: true };
    });
  }, []);

  // 手动设置指定主题
  const setTheme = useCallback((newTheme: Theme) => {
    try {
      localStorage.setItem(THEME_STORAGE_KEY, newTheme);
    } catch (e) {}
    setState({ theme: newTheme, isManual: true });
  }, []);

  // 恢复为跟随时间自动切换
  const resetToAuto = useCallback(() => {
    try {
      localStorage.removeItem(THEME_STORAGE_KEY);
    } catch (e) {}
    setState({ theme: getTimeBasedTheme(), isManual: false });
  }, []);

  return (
    <ThemeContext.Provider
      value={{
        theme,
        toggleTheme,
        setTheme,
        isAuto: !isManual,
        resetToAuto,
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
};
