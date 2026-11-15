import React from 'react';
    import SectionHeading from '../components/common/SectionHeading';
    import Button from '../components/common/Button';
    
    export default function ContactPage() {
  return (
    <div className="py-24 bg-white dark:bg-navy-900">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <SectionHeading
          title="联系我们"
          description="无论您对功能有任何疑问、需要定制机构版服务，或是对 TradeZen 有任何宝贵建议，我们都期待与您交流。"
          centered
        />
        
        <div className="mt-12 grid grid-cols-1 md:grid-cols-2 gap-8">
          <div>
            <form className="space-y-6">
              <div>
                <label htmlFor="name" className="block text-gray-700 dark:text-gray-300 font-medium mb-2 text-sm">您的姓名 / 昵称</label>
                <input type="text" id="name" placeholder="请输入您的称呼" className="w-full px-4 py-2 text-sm rounded-lg border border-gray-300 dark:bg-gray-800 dark:border-gray-600 dark:text-white focus:ring-2 focus:ring-purple-600 focus:border-transparent" required />
              </div>
              <div>
                <label htmlFor="email" className="block text-gray-700 dark:text-gray-300 font-medium mb-2 text-sm">电子邮箱</label>
                <input type="email" id="email" placeholder="name@example.com" className="w-full px-4 py-2 text-sm rounded-lg border border-gray-300 dark:bg-gray-800 dark:border-gray-600 dark:text-white focus:ring-2 focus:ring-purple-600 focus:border-transparent" required />
              </div>
              <div>
                <label htmlFor="subject" className="block text-gray-700 dark:text-gray-300 font-medium mb-2 text-sm">咨询主题</label>
                <input type="text" id="subject" placeholder="例如：MT5 直连技术咨询 / 机构订阅方案" className="w-full px-4 py-2 text-sm rounded-lg border border-gray-300 dark:bg-gray-800 dark:border-gray-600 dark:text-white focus:ring-2 focus:ring-purple-600 focus:border-transparent" required />
              </div>
              <div>
                <label htmlFor="message" className="block text-gray-700 dark:text-gray-300 font-medium mb-2 text-sm">详细留言内容</label>
                <textarea id="message" rows={5} placeholder="请详细描述您遇到的问题或合作需求..." className="w-full px-4 py-2 text-sm rounded-lg border border-gray-300 dark:bg-gray-800 dark:border-gray-600 dark:text-white focus:ring-2 focus:ring-purple-600 focus:border-transparent" required></textarea>
              </div>
              <Button variant="gradient">发送留言 &gt;</Button>
            </form>
          </div>
          <div>
            <h3 className="text-xl font-bold mb-4 dark:text-white">官方联系渠道</h3>
            <p className="text-gray-600 dark:text-gray-400 mb-3 text-sm">
              <strong>服务支持邮箱:</strong> <a href="mailto:support@tradezen.app" className="text-purple-600 hover:text-purple-700 dark:text-purple-400 dark:hover:text-purple-300">support@tradezen.app</a>
            </p>
            <p className="text-gray-600 dark:text-gray-400 mb-3 text-sm">
              <strong>客服微信 / TG:</strong> @TradeZenSupport
            </p>
            <p className="text-gray-600 dark:text-gray-400 mb-3 text-sm">
              <strong>服务时间:</strong> 周一至周五 09:00 - 22:00 (GMT+8)
            </p>
            <div className="mt-8">
              <h4 className="text-base font-bold mb-3 dark:text-white">关注 TradeZen 交易社区</h4>
              <p className="text-xs text-gray-500 mb-4 leading-relaxed">加入全球知行合一交易员复盘联盟，每日获取前沿行情透视、高盈亏比战法拆解与量化策略交流。</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
