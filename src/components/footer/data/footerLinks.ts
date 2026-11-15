import { LinkGroup } from '../types';

export const footerLinks: LinkGroup[] = [
  {
    title: '关于与动态',
    links: [
      { label: '关于 TradeZen', href: '/about' },
      { label: '加入我们', href: '/careers' },
      { label: '新闻与动态', href: '/press' },
      { label: '交易专栏', href: '/blog' }
    ]
  },
  {
    title: '帮助与支持',
    links: [
      { label: '联系我们', href: '/contact' },
      { label: '常见问题 FAQ', href: '/faq' },
      { label: '帮助中心', href: '/help' },
      { label: '券商配置指南', href: '/broker-support' }
    ]
  },
  {
    title: '法律合规',
    links: [
      { label: '服务条款', href: '/terms' },
      { label: '隐私政策', href: '/privacy' },
      { label: 'Cookie 声明', href: '/cookies' },
      { label: '无障碍访问', href: '/accessibility' }
    ]
  },
  {
    title: '核心资源',
    links: [
      { label: '交易者社区', href: '/community' },
      { label: '合作计划', href: '/partners' },
      { label: 'K线复盘与回测', href: '/features/backtesting' },
      { label: 'MT5 实盘同步', href: '/features/broker-integration' }
    ]
  }
];
