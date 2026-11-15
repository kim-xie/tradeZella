import React from 'react';
    import SectionHeading from '../components/common/SectionHeading';
    
    const helpArticles = [
  {
    title: 'TradeZen 快速入门与体系搭建',
    description: '了解如何快速设置交易账户、配置个人风控参数，并开始知行合一的复盘之旅。',
    link: '#'
  },
  {
    title: '如何高效使用交易日志与心理追踪',
    description: '探索如何记录交易细节、打上情绪标签，并借助纪律评分审视真实的交易执行力。',
    link: '#'
  },
  {
    title: '多维量化指标与 MFE/MAE 透视指南',
    description: '深入掌握胜率、盈亏比、最大潜在利润 (MFE) 与最大不利回撤 (MAE) 的量化精髓。',
    link: '#'
  },
  {
    title: 'K线逐根回放与策略回测实战技巧',
    description: '学习如何使用复盘回放引擎、拖动多空标尺演练买卖点并沉淀稳健的个人战法。',
    link: '#'
  },
  {
    title: 'MT5 直连与经纪商数据导入常见问题',
    description: '解决 MetaTrader 5 本地直连报错、Deals 账单识别与跨时区对齐等常见技术问题。',
    link: '#'
  }
];

export default function HelpPage() {
  return (
    <div className="py-24 bg-white dark:bg-navy-900">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <SectionHeading
          title="帮助与知识中心"
          description="查阅操作指南、视频教程与专业交易复盘方法论，助您全面释放 TradeZen 的量化实力。"
          centered
        />
        
        <div className="mt-12 grid grid-cols-1 md:grid-cols-2 gap-8">
          {helpArticles.map((article, index) => (
            <div key={index} className="bg-gray-50 dark:bg-gray-800 p-6 rounded-xl border border-gray-100 dark:border-gray-700 shadow-2xs flex flex-col justify-between">
              <div>
                <h3 className="text-base font-bold mb-2 text-gray-900 dark:text-white">{article.title}</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-4 leading-relaxed">{article.description}</p>
              </div>
              <div className="flex justify-between items-center mt-2 pt-2 border-t border-gray-100 dark:border-gray-700">
                <a href={article.link} className="text-xs text-purple-600 hover:text-purple-700 dark:text-purple-400 dark:hover:text-purple-300 font-semibold">阅读完整教程 &gt;</a>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
