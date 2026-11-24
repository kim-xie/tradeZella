import React from 'react';

interface FeaturePageLayoutProps {
  title?: string;
  description?: string;
  image?: string;
  hideHeader?: boolean;
  fullWidth?: boolean;
  children: React.ReactNode;
}

const FeaturePageLayout: React.FC<FeaturePageLayoutProps> = ({ title, description, hideHeader, fullWidth, children }) => {
  return (
    <div className="min-h-screen bg-gray-50/50 dark:bg-[#070a13] text-gray-900 dark:text-gray-100 transition-colors">
      {/* Sleek High-Tech Header Section */}
      {!hideHeader && title && (
        <div className="relative border-b border-gray-200/80 dark:border-white/10 bg-gradient-to-b from-white via-purple-50/20 to-gray-50 dark:from-[#0b0f19] dark:via-[#0b0f19]/80 dark:to-[#070a13] overflow-hidden">
          {/* Subtle Cyber Glow Orb */}
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-96 h-36 bg-purple-500/10 dark:bg-purple-600/15 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute -top-10 right-10 w-64 h-32 bg-cyan-500/10 dark:bg-cyan-500/10 rounded-full blur-2xl pointer-events-none" />

          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-10 relative">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <div className="inline-flex items-center space-x-2 px-2.5 py-1 rounded-full bg-purple-100/80 dark:bg-purple-950/60 border border-purple-200 dark:border-purple-800/80 text-[11px] font-bold text-purple-700 dark:text-purple-300 tracking-wider uppercase mb-2.5 shadow-xs">
                  <span className="w-1.5 h-1.5 rounded-full bg-purple-500 dark:bg-purple-400 animate-pulse" />
                  <span>TradeZen Quant Suite</span>
                </div>
                <h1 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-gray-900 via-purple-900 to-indigo-900 dark:from-white dark:via-purple-100 dark:to-cyan-200">
                  {title}
                </h1>
                {description && (
                  <p className="mt-1.5 text-xs sm:text-sm text-gray-600 dark:text-gray-400 max-w-2xl leading-relaxed">
                    {description}
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Main Feature Content Container */}
      <div className={fullWidth ? 'w-full px-1 sm:px-2 py-2' : 'max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8'}>
        {children}
      </div>
    </div>
  );
};

export default FeaturePageLayout;
