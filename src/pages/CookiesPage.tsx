import React from 'react';
import LegalPageLayout from '../components/common/LegalPageLayout';

export default function CookiesPage() {
  return (
    <LegalPageLayout
      title="Cookie 政策 (Cookie Policy)"
      description="最近更新日期：2026年"
    >
      <h2>1. 什么是 Cookie？</h2>
      <p>Cookie 是当您访问网站时存储在您设备上的微小文本文件，用于保障网站基础运行、维持登录状态并优化用户交互体验。</p>

      <h2>2. 我们使用的 Cookie 类型</h2>
      <h3>a) 核心必要型 Cookie</h3>
      <p>用于维持您的安全登录状态、记住当前工作区及身份权限验证，是平台运行必不可少的基础。</p>

      <h3>b) 功能与偏好型 Cookie</h3>
      <p>记住您偏好的深浅色主题模式（Dark/Light）、图表缩放比例及默认交易品种。</p>

      <h3>c) 性能与统计型 Cookie</h3>
      <p>收集匿名的系统报错及页面加载速度数据，帮助工程团队排查量化卡顿与图表渲染性能瓶颈。</p>

      <h2>3. 如何管理 Cookie</h2>
      <p>您可以在浏览器的安全设置中随时查看、限制或清除已保存的 Cookie。请注意，若完全禁用必要型 Cookie，可能会导致无法正常登录或使用 TradeZen 的复盘功能。</p>

      <h2>4. 联系我们</h2>
      <p>如有关于 Cookie 政策的疑问，请联系：cookies@tradezen.app</p>
    </LegalPageLayout>
  );
}