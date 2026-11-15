import React from 'react';
import SectionHeading from '../components/common/SectionHeading';
import Button from '../components/common/Button';
import { Check } from 'lucide-react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';

const plans = [
  {
    name: '基础版 (Basic)',
    price: '$19',
    description: '适合刚起步建立个人交易体系的初级交易员。',
    features: [
      '基础交易日志与标签记录',
      '月度与周度日历统计',
      '标准盈亏与胜率分析',
      '社区与知识库访问权限',
    ],
    buttonVariant: 'primary',
    link: '/signup',
  },
  {
    name: '进阶版 (Pro)',
    price: '$49',
    description: '专为严守纪律、追求稳定盈利的进阶交易员打造。',
    features: [
      '无限制交易记录与导入',
      'MT5 / MT4 / 交易所直连同步',
      '知行合一情绪状态与纪律评分',
      '多维度时段与标的量化统计',
      '战法策略库 (Playbooks)',
    ],
    buttonVariant: 'gradient',
    recommended: true,
    link: '/signup',
  },
  {
    name: '大师版 (Premium)',
    price: '$99',
    description: '为职业交易员与量化复盘大师打造的终极武器库。',
    features: [
      '包含 Pro 版全部功能',
      'TradingView 级逐根 K 线历史回放',
      '策略回测与多周期验证',
      'MFE / MAE 最大潜力与回撤分析',
      '专业投研报表导出与打印',
      'VIP 专属交易圈子与优先支持',
    ],
    buttonVariant: 'primary',
    link: '/signup',
  },
];

export default function PricingPage() {
  return (
    <div className="py-24 bg-gray-50 dark:bg-navy-900">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <SectionHeading
          title="方案与定价"
          description="选择最适合您交易进阶阶段的方案。灵活的订阅模式，助您知行合一、实现稳定复利。"
          centered
        />

        <div className="mt-16 grid grid-cols-1 md:grid-cols-3 gap-8">
          {plans.map((plan, index) => (
            <motion.div
              key={plan.name}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: index * 0.1 }}
              className={`relative bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-8 flex flex-col transform hover:-translate-y-2 transition-transform duration-300 ${plan.recommended ? 'border-4 border-purple-600' : 'border border-gray-200 dark:border-gray-700'}`}
            >
              {plan.recommended && (
                <div className="absolute top-0 -translate-y-1/2 left-1/2 -translate-x-1/2">
                  <span className="bg-purple-600 text-white px-3 py-1 text-sm font-semibold tracking-wide rounded-full uppercase">
                    最受欢迎
                  </span>
                </div>
              )}
              <h3 className="text-2xl font-bold text-center dark:text-white">{plan.name}</h3>
              <p className="mt-2 text-gray-600 dark:text-gray-400 text-center h-12">{plan.description}</p>
              <p className="mt-6 text-5xl font-bold text-center dark:text-white">
                {plan.price}<span className="text-lg font-medium text-gray-500 dark:text-gray-400">/月</span>
              </p>
              <ul className="mt-8 space-y-4 flex-grow">
                {plan.features.map((feature) => (
                  <li key={feature} className="flex items-center">
                    <Check className="flex-shrink-0 w-6 h-6 text-green-500" />
                    <span className="ml-3 text-gray-600 dark:text-gray-300">{feature}</span>
                  </li>
                ))}
              </ul>
              <div className="mt-8">
                <Link to={plan.link}>
                  <Button variant={plan.buttonVariant as 'primary' | 'gradient'} className="w-full">
                    立即开启体验
                  </Button>
                </Link>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
}
