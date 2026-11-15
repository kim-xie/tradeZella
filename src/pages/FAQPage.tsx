import React, { useState } from 'react';
    import SectionHeading from '../components/common/SectionHeading';
    
    const faqData = [
  {
    category: '账户与登录',
    questions: [
      {
        question: '如何注册 TradeZen 账号？',
        answer: '点击页面右上角的「免费体验」或「注册」按钮，填写您的邮箱及密码即可快速开启知行合一交易复盘体验。'
      },
      {
        question: '忘记密码时如何找回？',
        answer: '在登录界面点击「忘记密码」，输入您的注册邮箱，系统将自动向您发送安全重置密码的邮件链接。'
      }
    ]
  },
  {
    category: '订阅与付款',
    questions: [
      {
        question: '支持哪些支付方式？',
        answer: '我们支持主流信用卡、借记卡、支付宝及微信支付（通过国际安全网关结算），保障您的账单安全。'
      },
      {
        question: '如何管理或取消自动续订？',
        answer: '进入「个人账户设置」页面中的「订阅管理」，您可以随时暂停、升级、降级或取消当前的订阅计划。'
      }
    ]
  },
  {
    category: '系统核心功能',
    questions: [
      {
        question: '如何使用 MT5 实盘直连同步？',
        answer: '在 Windows 环境启动本地 MetaTrader 5 客户端，进入 TradeZen「经纪商对接」页面，点击「本地 MT5 智能直连」，系统将通过安全 IPC 管道自动同步平仓交易记录。'
      },
      {
        question: '什么是「知行合一」交易复盘与情绪追踪？',
        answer: '系统在每笔交易中引入心理状态（紧张、焦虑、平和理性、从容自信）和执行纪律评分，帮助交易员量化情绪偏差，克服 FOMO 与抗单坏习惯。'
      },
      {
        question: 'K线逐根回放复盘如何使用？',
        answer: '进入「策略回测」页面即可使用类似 TradingView 的 Bar Replay 逐根回放功能。支持多空标尺直接拖拽调整止损止盈并计算真实盈亏比。'
      }
    ]
  },
  {
    category: '技术支持与兼容',
    questions: [
      {
        question: 'TradeZen 对电脑硬件与浏览器有什么要求？',
        answer: 'TradeZen 采用现代 Web 与量化渲染技术，推荐使用 Chrome、Edge 或 Safari 等现代浏览器，具备稳定网络即可流畅运行。'
      },
      {
        question: '数据安全与隐私如何保障？',
        answer: 'TradeZen 严格遵守隐私保护合规标准，所有数据传输均采用 TLS 1.3 高强度加密，直连经纪商仅使用只读权限，绝不会触碰您的资金安全。'
      }
    ]
  }
];

export default function FAQPage() {
  const [activeCategory, setActiveCategory] = useState(faqData[0].category);

  return (
    <div className="py-24 bg-white dark:bg-navy-900">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <SectionHeading
          title="常见问题解答 (FAQ)"
          description="快速了解 TradeZen 的功能亮点、MT5 对接方式与订阅方案。如需更多帮助，欢迎随时联系官方技术支持。"
          centered
        />
        
        <div className="mt-12">
          <div className="flex flex-wrap gap-2 mb-8">
            {faqData.map((item) => (
              <button
                key={item.category}
                className={`px-4 py-2 rounded-lg text-sm font-semibold transition ${activeCategory === item.category ? 'bg-purple-600 text-white shadow-sm' : 'bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700'}`}
                onClick={() => setActiveCategory(item.category)}
              >
                {item.category}
              </button>
            ))}
          </div>
          
          {faqData.map((item) => (
            item.category === activeCategory && (
              <div key={item.category} className="space-y-4">
                {item.questions.map((faq, index) => (
                  <div key={index} className="bg-gray-50 dark:bg-gray-800 p-6 rounded-xl border border-gray-100 dark:border-gray-700 shadow-2xs">
                    <h3 className="text-base font-bold mb-2 text-gray-900 dark:text-white">{faq.question}</h3>
                    <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">{faq.answer}</p>
                  </div>
                ))}
              </div>
            )
          ))}
        </div>
      </div>
    </div>
  );
}
