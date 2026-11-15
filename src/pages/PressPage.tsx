import React from 'react';
    import SectionHeading from '../components/common/SectionHeading';
    
    const pressReleases = [
  {
    title: 'TradeZen 宣布推出全新 MT5 原生零延迟直连同步引擎',
    date: '2026年5月15日',
    link: '#',
    description: '通过本地高速 IPC 管道，TradeZen 打通了 MetaTrader 5 实盘账单的无缝同步，极大降低了交易员的记账与复盘门槛。',
    image: 'https://images.unsplash.com/photo-1590283603948-42461b357991?auto=format&fit=crop&w=400&q=80'
  },
  {
    title: 'TradeZen 发布「知行合一」心理情绪量化与纪律评分体系',
    date: '2026年4月20日',
    link: '#',
    description: '首次将交易执行力、提前平仓、FOMO 追高及抗单等心理偏差引入量化分析框架，帮助交易员建立严谨风控习惯。',
    image: 'https://images.unsplash.com/photo-1587620962725-abab7fe55159?auto=format&fit=crop&w=400&q=80'
  },
  {
    title: 'TradeZen 完成数百万种子轮融资，加速量化复盘生态建设',
    date: '2026年3月10日',
    link: '#',
    description: '本轮融资将重点投入于 TradingView 级 K 线逐根回放引擎的研发，以及多周期策略验证工具的持续升级。',
    image: 'https://images.unsplash.com/photo-1517245386804-1111d2e49814?auto=format&fit=crop&w=400&q=80'
  }
];

const mediaMentions = [
  {
    title: '海外顶级交易专刊专访：TradeZen 如何重塑个人交易员认知进化',
    date: '2026年6月1日',
    link: '#',
    source: 'Quantitative Trading Review',
    description: '深入剖析 TradeZen 的复盘闭环架构，探讨数据驱动与心理自律如何帮助交易员度过盈亏平衡期。',
    image: 'https://images.unsplash.com/photo-1579546929662-711aa81148cf?auto=format&fit=crop&w=400&q=80'
  },
  {
    title: '金融科技先锋播客对话创始人：知行合一的底层量化逻辑',
    date: '2026年5月25日',
    link: '#',
    source: 'FinTech Alpha Podcast',
    description: '分享打造 TradeZen 的初衷，以及未来 AI 行为分析如何自动诊断交易失误与提供纠偏建议。',
    image: 'https://images.unsplash.com/photo-1590283603948-42461b357991?auto=format&fit=crop&w=400&q=80'
  }
];

export default function PressPage() {
  return (
    <div className="py-24 bg-white dark:bg-navy-900">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <SectionHeading
          title="新闻与媒体动态"
          description="了解 TradeZen 的最新产品发布、行业合作及媒体专访报道。我们坚持开放透明，与全球交易员共同见证成长。"
          centered
        />
        
        <div className="mt-12">
          <h2 className="text-2xl font-bold mb-6 dark:text-white">官方新闻动态</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {pressReleases.map((release, index) => (
              <div key={index} className="bg-gray-50 dark:bg-gray-800 p-6 rounded-xl border border-gray-100 dark:border-gray-700 shadow-2xs flex flex-col justify-between">
                <div>
                  <img src={release.image} alt={release.title} className="rounded-lg mb-4 h-48 w-full object-cover" />
                  <h3 className="text-base font-bold mb-2 text-gray-900 dark:text-white leading-snug">{release.title}</h3>
                  <p className="text-xs text-gray-600 dark:text-gray-400 mb-4 leading-relaxed">{release.description}</p>
                </div>
                <div className="flex justify-between items-center mt-2 pt-3 border-t border-gray-100 dark:border-gray-700 text-xs">
                  <span className="text-gray-500 font-mono">{release.date}</span>
                  <a href={release.link} className="text-purple-600 hover:text-purple-700 dark:text-purple-400 dark:hover:text-purple-300 font-semibold">阅读详情 &gt;</a>
                </div>
              </div>
            ))}
          </div>
        </div>
        
        <div className="mt-16">
          <h2 className="text-2xl font-bold mb-6 dark:text-white">媒体深度报道</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {mediaMentions.map((mention, index) => (
              <div key={index} className="bg-gray-50 dark:bg-gray-800 p-6 rounded-xl border border-gray-100 dark:border-gray-700 shadow-2xs flex flex-col justify-between">
                <div>
                  <img src={mention.image} alt={mention.title} className="rounded-lg mb-4 h-48 w-full object-cover" />
                  <h3 className="text-base font-bold mb-2 text-gray-900 dark:text-white leading-snug">{mention.title}</h3>
                  <p className="text-xs text-gray-600 dark:text-gray-400 mb-4 leading-relaxed">{mention.description}</p>
                </div>
                <div className="flex justify-between items-center mt-2 pt-3 border-t border-gray-100 dark:border-gray-700 text-xs">
                  <span className="text-gray-500 font-mono">{mention.date} · {mention.source}</span>
                  <a href={mention.link} className="text-purple-600 hover:text-purple-700 dark:text-purple-400 dark:hover:text-purple-300 font-semibold">阅读报道 &gt;</a>
                </div>
              </div>
            ))}
          </div>
        </div>
        
        <div className="mt-16">
          <h2 className="text-2xl font-bold mb-4 dark:text-white">品牌视觉资产下载</h2>
          <p className="text-xs text-gray-500 mb-6">
            媒体与合作伙伴可在此下载 TradeZen 的官方高清矢量 Logo、VI 标准色板与产品宣传物料。
          </p>
          <div className="flex flex-wrap gap-4">
            <a href="#" className="bg-gray-100 dark:bg-gray-800 px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 hover:bg-gray-200 dark:hover:bg-gray-700 transition flex items-center space-x-2 text-xs font-semibold text-gray-800 dark:text-gray-200">
              <span>下载官方高清 Logo</span>
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4 text-purple-600">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
              </svg>
            </a>
            <a href="#" className="bg-gray-100 dark:bg-gray-800 px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 hover:bg-gray-200 dark:hover:bg-gray-700 transition flex items-center space-x-2 text-xs font-semibold text-gray-800 dark:text-gray-200">
              <span>下载产品宣传图集</span>
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4 text-purple-600">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
              </svg>
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
