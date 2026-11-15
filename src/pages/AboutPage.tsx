import React from 'react';
    import SectionHeading from '../components/common/SectionHeading';
    
    export default function AboutPage() {
  return (
    <div className="py-24 bg-white dark:bg-navy-900">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <SectionHeading
          title="我们的品牌愿景"
          description="TradeZen 秉承「知行合一」的理念而创立，致力于为交易者提供全维度的交易管理与认知进化工具。我们相信系统性的数据洞察、克制的情绪纪律与科学的复盘回测，是走向稳定盈利的必经之路。"
          centered
        />
        
        <div className="mt-12 grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
          <div className="space-y-6">
            <h3 className="text-xl font-bold dark:text-white">使命 Mission</h3>
            <p className="text-gray-600 dark:text-gray-400 text-sm leading-relaxed">
              为广大自主交易员与量化团队提供最强大、最直观的交易日志、多维量化透视与心理纪律管理系统，把复杂的复盘变得轻松而科学。
            </p>
            
            <h3 className="text-xl font-bold dark:text-white">愿景 Vision</h3>
            <p className="text-gray-600 dark:text-gray-400 text-sm leading-relaxed">
              打造全球领先的交易认知成长引擎，帮助各个阶段的交易者克服人性的贪婪与恐惧，达到「知行合一」的专业交易境界。
            </p>
          </div>
          <div>
            <img 
              src="https://images.unsplash.com/photo-1556761175-b413da4baf72?auto=format&fit=crop&w=600&q=80" 
              alt="团队协作" 
              className="rounded-xl shadow-md"
            />
          </div>
        </div>
        
        <div className="mt-16">
          <h2 className="text-2xl font-bold mb-6 dark:text-white">核心价值观</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-gray-50 dark:bg-gray-800 p-6 rounded-xl border border-gray-100 dark:border-gray-700 shadow-2xs">
              <h4 className="text-base font-bold mb-2 dark:text-white">持续迭代与极客创新</h4>
              <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">不断探索原生 IPC 直连、TradingView 级图形渲染与 AI 复盘深度模型，为交易者提供领先的技术武器。</p>
            </div>
            <div className="bg-gray-50 dark:bg-gray-800 p-6 rounded-xl border border-gray-100 dark:border-gray-700 shadow-2xs">
              <h4 className="text-base font-bold mb-2 dark:text-white">客观严谨与数据透明</h4>
              <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">直面每一次亏损与违规交易，拒绝粉饰数据，用真实的数学期望与盈亏比构建坚不可摧的底层逻辑。</p>
            </div>
            <div className="bg-gray-50 dark:bg-gray-800 p-6 rounded-xl border border-gray-100 dark:border-gray-700 shadow-2xs">
              <h4 className="text-base font-bold mb-2 dark:text-white">以交易员为中心</h4>
              <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">每一项功能设计都源于一线操盘手的真实痛点，以流畅的交互体验提升复盘效率。</p>
            </div>
            <div className="bg-gray-50 dark:bg-gray-800 p-6 rounded-xl border border-gray-100 dark:border-gray-700 shadow-2xs">
              <h4 className="text-base font-bold mb-2 dark:text-white">知行合一追求卓越</h4>
              <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">交易不仅是一门技术，更是一场修行。我们致力于陪伴交易者实现认知与执行的完美统一。</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
