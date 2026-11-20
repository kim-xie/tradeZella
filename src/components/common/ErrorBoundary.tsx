import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw, Home, ChevronDown, ChevronUp } from 'lucide-react';

interface Props {
  children: ReactNode;
  fallbackTitle?: string;
  onReset?: () => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  showDetails: boolean;
}

export default class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null,
    showDetails: false,
  };

  public static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      error,
      errorInfo: null,
      showDetails: false,
    };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary caught an unhandled error:', error, errorInfo);
    this.setState({ errorInfo });
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
    if (this.props.onReset) {
      this.props.onReset();
    } else {
      window.location.reload();
    }
  };

  public render() {
    if (this.state.hasError) {
      const title = this.props.fallbackTitle || '页面加载或渲染异常 (Page Render Error)';
      return (
        <div className="min-h-[380px] p-6 sm:p-8 flex flex-col items-center justify-center bg-white dark:bg-[#0b0f19] rounded-2xl border border-rose-200 dark:border-rose-900/40 text-center my-4 shadow-sm">
          <div className="w-14 h-14 rounded-2xl bg-rose-100 dark:bg-rose-950/60 flex items-center justify-center text-rose-600 dark:text-rose-400 mb-4 border border-rose-200 dark:border-rose-800/80">
            <AlertTriangle className="w-7 h-7" />
          </div>

          <h3 className="text-lg sm:text-xl font-bold text-gray-900 dark:text-white mb-2">
            {title}
          </h3>

          <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 max-w-lg mb-6 leading-relaxed">
            系统已拦截此异常并阻止了页面白屏崩溃。
            {this.state.error?.message ? (
              <span className="block mt-1 font-mono text-xs text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/40 px-2 py-1 rounded border border-rose-200 dark:border-rose-900/50">
                {this.state.error.message}
              </span>
            ) : null}
          </p>

          <div className="flex flex-wrap items-center justify-center gap-3 mb-4">
            <button
              type="button"
              onClick={this.handleReset}
              className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white text-xs sm:text-sm font-semibold rounded-xl flex items-center space-x-2 transition shadow-sm"
            >
              <RefreshCw className="w-4 h-4" />
              <span>重新加载当前组件 / 页面</span>
            </button>
            <a
              href="/"
              className="px-4 py-2 bg-gray-100 hover:bg-gray-200 dark:bg-navy-800 dark:hover:bg-navy-700 text-gray-700 dark:text-gray-200 text-xs sm:text-sm font-semibold rounded-xl flex items-center space-x-2 transition"
            >
              <Home className="w-4 h-4" />
              <span>返回主页仪表盘</span>
            </a>
          </div>

          {this.state.error && (
            <div className="w-full max-w-xl text-left mt-4 border-t border-gray-100 dark:border-white/5 pt-3">
              <button
                type="button"
                onClick={() => this.setState(prev => ({ showDetails: !prev.showDetails }))}
                className="text-xs text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 flex items-center space-x-1 mx-auto"
              >
                <span>{this.state.showDetails ? '收起排错堆栈信息' : '展开排错堆栈信息 (Technical Details)'}</span>
                {this.state.showDetails ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
              </button>

              {this.state.showDetails && (
                <pre className="mt-3 p-3 bg-gray-50 dark:bg-[#070a13] rounded-xl text-[11px] font-mono text-gray-700 dark:text-gray-300 overflow-x-auto max-h-48 border border-gray-200 dark:border-white/10 whitespace-pre-wrap">
                  {this.state.error.stack || this.state.error.message}
                  {this.state.errorInfo?.componentStack}
                </pre>
              )}
            </div>
          )}
        </div>
      );
    }

    return this.props.children;
  }
}
