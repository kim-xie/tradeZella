import React, { useState, useEffect } from 'react';
import { 
  Activity, Sun, Moon, RefreshCw, BarChart2, 
  TrendingUp, BookOpen, Layers, LogOut, Calendar
} from 'lucide-react';
import Button from './common/Button';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useTheme } from './common/ThemeContext';

interface NavItem {
  label: string;
  href: string;
  icon: React.ElementType;
  altMatch?: string;
}

const NAV_ITEMS: NavItem[] = [
  { label: '仪表盘', href: '/', icon: BarChart2 },
  { label: '交易明细', href: '/trades', icon: Layers },
  { label: '交易日历', href: '/calendar', icon: Calendar, altMatch: '/stats' },
  { label: 'K线回测', href: '/features/backtesting', icon: TrendingUp },
  { label: '实盘同步', href: '/features/broker-integration', icon: RefreshCw },
  { label: '新手教程', href: '/tutorial', icon: BookOpen, altMatch: '/guide' },
];

export default function Navbar() {
  const { theme, toggleTheme } = useTheme();
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  // 检查 token 是否存在并同步状态
  const syncAuthState = () => {
    const token = localStorage.getItem('token');
    setIsAuthenticated(!!token);
  };

  useEffect(() => {
    syncAuthState();

    const handleAuthChange = () => syncAuthState();
    window.addEventListener('auth-change', handleAuthChange);

    const handleStorage = (e: StorageEvent) => {
      if (e.key === 'token') syncAuthState();
    };
    window.addEventListener('storage', handleStorage);

    return () => {
      window.removeEventListener('auth-change', handleAuthChange);
      window.removeEventListener('storage', handleStorage);
    };
  }, [location.pathname]);

  const handleLogout = () => {
    localStorage.removeItem('token');
    setIsAuthenticated(false);
    window.dispatchEvent(new Event('auth-change'));
    navigate('/');
  };

  const isActive = (path: string) => location.pathname === path;

  return (
    <nav className="fixed top-0 left-0 right-0 z-40 backdrop-blur-xl bg-white/85 dark:bg-[#0b0f19]/90 border-b border-gray-200/80 dark:border-white/10 transition-colors duration-200 shadow-xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          {/* Brand Logo & MT5 Live Pulse */}
          <div className="flex items-center space-x-3">
            <Link to="/" className="flex items-center space-x-2.5 group">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-purple-600 via-indigo-600 to-cyan-400 flex items-center justify-center text-white shadow-[0_0_12px_rgba(147,51,234,0.35)] group-hover:scale-105 transition-transform duration-200">
                <Activity className="w-4 h-4" />
              </div>
              <span className="text-lg font-black tracking-tight text-gray-950 dark:text-white font-sans flex items-center space-x-1">
                <span>Trade<span className="text-emerald-500 dark:text-emerald-400">Zen</span></span>
              </span>
            </Link>
          </div>

          {/* Navigation Links: Consistent styling across all items */}
          <div className="hidden md:flex items-center space-x-1 lg:space-x-1.5 text-sm font-medium">
            {NAV_ITEMS.map((item) => {
              const Icon = item.icon;
              const isCurrentActive = isActive(item.href) || (item.altMatch && isActive(item.altMatch));
              return (
                <Link
                  key={item.href}
                  to={item.href}
                  className={`px-3 py-1.5 rounded-lg transition-all flex items-center space-x-1.5 ${
                    isCurrentActive
                      ? 'bg-purple-100 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 font-bold shadow-2xs'
                      : 'text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-navy-800'
                  }`}
                >
                  <Icon className={`w-4 h-4 ${isCurrentActive ? 'text-purple-600 dark:text-purple-400' : 'text-gray-400 dark:text-gray-500'}`} />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </div>

          {/* Right Actions: Theme + Auth */}
          <div className="flex items-center space-x-2.5">
            <button 
              onClick={toggleTheme} 
              data-testid="theme-switcher" 
              className="p-2 rounded-xl text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-navy-800 border border-gray-200 dark:border-white/10 transition-colors"
              title={theme === 'light' ? '当前为白天白色模式（点击切换夜间黑色）' : '当前为夜间黑色模式（点击切换白天白色）'}
              aria-label="切换明暗主题"
            >
              {theme === 'light' ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4 text-amber-400" />}
            </button>

            {isAuthenticated ? (
              <button 
                onClick={handleLogout}
                className="px-3 py-1.5 rounded-xl text-sm font-medium text-gray-600 dark:text-gray-300 hover:bg-red-50 dark:hover:bg-red-950/40 hover:text-red-600 dark:hover:text-red-400 border border-gray-200 dark:border-white/10 transition-colors flex items-center space-x-1.5"
              >
                <LogOut className="w-4 h-4" />
                <span>退出</span>
              </button>
            ) : (
              <div className="flex items-center space-x-2">
                <Link 
                  to="/login" 
                  className="px-3 py-1.5 text-sm font-medium text-gray-700 dark:text-gray-300 hover:text-purple-600 dark:hover:text-purple-400"
                >
                  登录
                </Link>
                <Link to="/signup">
                  <Button variant="gradient" className="text-sm px-3.5 py-1.5 shadow-sm">
                    免费体验 &gt;
                  </Button>
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
}
