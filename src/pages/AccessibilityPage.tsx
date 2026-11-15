import React from 'react';
import LegalPageLayout from '../components/common/LegalPageLayout';

export default function AccessibilityPage() {
  return (
    <LegalPageLayout
      title="无障碍访问声明 (Accessibility)"
      description="最近更新日期：2026年"
    >
      <h2>1. 我们的承诺</h2>
      <p>TradeZen 致力于为所有交易者打造无障碍的数字体验。我们积极参照国际 Web 内容无障碍指南 (WCAG 2.2 AA) 标准，持续提升界面的可访问性。</p>

      <h2>2. 无障碍技术实践</h2>
      <ul>
        <li>语义化 HTML 结构与标准 ARIA 屏幕阅读标签</li>
        <li>完善的键盘 Tab 键全流程导航支持</li>
        <li>高对比度深色模式与暗光环境护眼色彩体系</li>
        <li>全平台响应式布局，完美适配移动端、平板与超宽带屏显示器</li>
      </ul>

      <h2>3. 意见反馈与支持</h2>
      <p>如果您在使用过程中遇到任何无障碍浏览障碍或有改进建议，请发送邮件至：<br />
      📩 accessibility@tradezen.app</p>
    </LegalPageLayout>
  );
}