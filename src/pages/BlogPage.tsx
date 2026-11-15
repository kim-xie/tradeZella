import React from 'react';
    import SectionHeading from '../components/common/SectionHeading';
    
    const blogPosts = [
  {
    title: '5 个被验证能够显著改善交易期望的系统化战法',
    date: '2026年6月10日',
    author: 'TradeZen 投研组',
    link: '#',
    description: '通过严格的入场防守边界、动态盈亏比管理与分批止盈策略，系统化打造经得起周期考验的正期望模型。',
    image: 'https://images.unsplash.com/photo-1579546929662-711aa81148cf?auto=format&fit=crop&w=400&q=80'
  },
  {
    title: '知行合一：为什么日常复盘与情绪记录是交易员的分水岭',
    date: '2026年5月28日',
    author: '交易心理导师',
    link: '#',
    description: '探索如何通过日内笔记与行为标签，正视恐惧与贪婪，将模糊的心态波动转化为可量化防范的风控规则。',
    image: 'https://images.unsplash.com/photo-1587620962725-abab7fe55159?auto=format&fit=crop&w=400&q=80'
  },
  {
    title: '如何利用 MFE / MAE 最大潜力与不利偏离优化出场',
    date: '2026年5月15日',
    author: '量化分析师',
    link: '#',
    description: '告别凭感觉平仓。借助散点透视图识别提前离场或过度抗单，让每一笔赢利单都吃透主升浪。',
    image: 'https://images.unsplash.com/photo-1517245386804-1111d2e49814?auto=format&fit=crop&w=400&q=80'
  }
];

export default function BlogPage() {
  return (
    <div className="py-24 bg-white dark:bg-navy-900">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <SectionHeading
          title="交易学院与专栏博客"
          description="获取最新的市场微观结构分析、前沿量化复盘方法论与知行合一交易心得，赋能您的交易成长之路。"
          centered
        />
        
        <div className="mt-12 grid grid-cols-1 md:grid-cols-3 gap-8">
          {blogPosts.map((post, index) => (
            <div key={index} className="bg-gray-50 dark:bg-gray-800 p-6 rounded-xl border border-gray-100 dark:border-gray-700 shadow-2xs flex flex-col justify-between">
              <div>
                <img src={post.image} alt={post.title} className="rounded-lg mb-4 h-48 w-full object-cover" />
                <h3 className="text-base font-bold mb-2 text-gray-900 dark:text-white leading-snug">{post.title}</h3>
                <p className="text-xs text-gray-600 dark:text-gray-400 mb-4 leading-relaxed">{post.description}</p>
              </div>
              <div className="flex justify-between items-center mt-2 pt-3 border-t border-gray-100 dark:border-gray-700 text-xs">
                <span className="text-gray-500 font-mono">{post.date}</span>
                <a href={post.link} className="text-purple-600 hover:text-purple-700 dark:text-purple-400 dark:hover:text-purple-300 font-semibold">阅读全文 &gt;</a>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
