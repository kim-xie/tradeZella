import React from 'react';
    import SectionHeading from '../components/common/SectionHeading';
    import Button from '../components/common/Button';
    
    const openPositions = [
  {
    title: '资深量化系统工程师 (Full-Stack / Rust)',
    location: '远程办公 / Remote',
    description: '负责高性能行情渲染、MT5 原生 IPC 通信引擎架构设计及复杂指标计算优化。',
    link: '#',
    image: 'https://images.unsplash.com/photo-1517245386804-1111d2e49814?auto=format&fit=crop&w=400&q=80'
  },
  {
    title: '交易社区生态增长专家 (Growth Lead)',
    location: '远程办公 / 弹性工作制',
    description: '负责 TradeZen 交易联盟社群运营、战法策略创作者扶持以及海内外交易圈层口碑建设。',
    link: '#',
    image: 'https://images.unsplash.com/photo-1587620962725-abab7fe55159?auto=format&fit=crop&w=400&q=80'
  },
  {
    title: '客户成功与复盘教练 (Trading Coach)',
    location: '远程办公 / Remote',
    description: '解答用户关于指标、对账单解析与量化回放的技术咨询，并协助学员打造稳健的交易纪律体系。',
    link: '#',
    image: 'https://images.unsplash.com/photo-1556761175-b413da4baf72?auto=format&fit=crop&w=400&q=80'
  }
];

export default function CareersPage() {
  return (
    <div className="py-24 bg-white dark:bg-navy-900">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <SectionHeading
          title="加入 TradeZen 团队"
          description="我们正在寻找对金融科技、算法量化与知行合一交易充满热情的伙伴，共同重新定义全球交易员的复盘进化体验。"
          centered
        />
        
        <div className="mt-12">
          <h2 className="text-2xl font-bold mb-6 dark:text-white">热招职位</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {openPositions.map((position, index) => (
              <div key={index} className="bg-gray-50 dark:bg-gray-800 p-6 rounded-xl border border-gray-100 dark:border-gray-700 shadow-2xs flex flex-col justify-between">
                <div>
                  <img src={position.image} alt={position.title} className="rounded-lg mb-4 h-48 w-full object-cover" />
                  <h3 className="text-base font-bold mb-2 text-gray-900 dark:text-white">{position.title}</h3>
                  <p className="text-xs text-gray-600 dark:text-gray-400 mb-4 leading-relaxed">{position.description}</p>
                </div>
                <div className="flex justify-between items-center mt-3 pt-3 border-t border-gray-100 dark:border-gray-700">
                  <span className="text-xs text-gray-500 font-medium">{position.location}</span>
                  <Button variant="gradient">
                    <a href={position.link}>立即投递 &gt;</a>
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
        
        <div className="mt-16">
          <h2 className="text-2xl font-bold mb-6 dark:text-white">薪酬福利与成长</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-gray-50 dark:bg-gray-800 p-6 rounded-xl border border-gray-100 dark:border-gray-700 shadow-2xs">
              <h4 className="text-base font-bold mb-2 dark:text-white">极具竞争力的薪资与期权</h4>
              <p className="text-xs text-gray-600 dark:text-gray-400 leading-relaxed">提供高于行业水准的薪酬架构与早期核心员工期权激励，共享产品长期增长红利。</p>
            </div>
            <div className="bg-gray-50 dark:bg-gray-800 p-6 rounded-xl border border-gray-100 dark:border-gray-700 shadow-2xs">
              <h4 className="text-base font-bold mb-2 dark:text-white">全球化全员远程办公</h4>
              <p className="text-xs text-gray-600 dark:text-gray-400 leading-relaxed">自由灵活的工作时间与地点，自主掌握生活与工作的平衡，提供居家办公设备津贴。</p>
            </div>
            <div className="bg-gray-50 dark:bg-gray-800 p-6 rounded-xl border border-gray-100 dark:border-gray-700 shadow-2xs">
              <h4 className="text-base font-bold mb-2 dark:text-white">无限自我成长预算</h4>
              <p className="text-xs text-gray-600 dark:text-gray-400 leading-relaxed">报销各类书籍、专业交易课程、投研数据订阅及行业技术峰会门票。</p>
            </div>
            <div className="bg-gray-50 dark:bg-gray-800 p-6 rounded-xl border border-gray-100 dark:border-gray-700 shadow-2xs">
              <h4 className="text-base font-bold mb-2 dark:text-white">开放平等的团队文化</h4>
              <p className="text-xs text-gray-600 dark:text-gray-400 leading-relaxed">没有繁文缛节，用数据与代码说话，尊重每一位成员的奇思妙想与极客精神。</p>
            </div>
          </div>
        </div>
          </div>
        </div>
      );
    }
