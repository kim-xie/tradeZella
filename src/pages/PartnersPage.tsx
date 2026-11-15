import React from 'react';
    import SectionHeading from '../components/common/SectionHeading';
    import Button from '../components/common/Button';
    
    export default function PartnersPage() {
  return (
    <div className="py-24 bg-white dark:bg-navy-900">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <SectionHeading
          title="生态伙伴与合伙人计划"
          description="加入 TradeZen 官方生态伙伴计划，与全球顶级交易社群、投研 KOL 及经纪商共同推广「知行合一」交易理念，共享行业领先的长期返佣分成。"
          centered
        />
        
        <div className="mt-12 grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
          <div>
            <h2 className="text-2xl font-bold mb-4 dark:text-white">伙伴专属权益</h2>
            <ul className="list-disc list-inside text-gray-600 dark:text-gray-400 space-y-2 text-sm leading-relaxed">
              <li>阶梯式高额佣金分成：终身享有被推荐用户订阅续费分成。</li>
              <li>官方品牌宣发与媒体物料库授权，提供定制化推广落地页。</li>
              <li>专属合伙人支持经理与量化技术专家 1v1 对接。</li>
              <li>独立透明的合伙人管理后台，实时查看点击、转化与结算流水。</li>
            </ul>
          </div>
          <div>
            <img 
              src="https://images.unsplash.com/photo-1556761175-b413da4baf72?auto=format&fit=crop&w=600&q=80" 
              alt="生态伙伴计划" 
              className="rounded-xl shadow-md"
            />
          </div>
        </div>
        
        <div className="mt-16">
          <h2 className="text-2xl font-bold mb-3 dark:text-white">准入合作要求</h2>
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-6 leading-relaxed">
            无论您是拥有专属粉丝群体的财经自媒体、专业交易学院、策略团队还是金融经纪服务商，只要您认可「知行合一、纪律交易」的价值观，均可申请成为 TradeZen 认证合伙人。
          </p>
          
          <h2 className="text-2xl font-bold mb-3 dark:text-white">申请加入流程</h2>
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-6 leading-relaxed">
            点击下方按钮填写合伙人意向申请表，我们的商务团队将在 2 个工作日内与您取得联系并开通专属合伙人权限。
          </p>
          
          <Button variant="gradient">
            <a href="mailto:partner@tradezen.app">立即申请成为合伙人 &gt;</a>
          </Button>
        </div>
      </div>
    </div>
  );
}
