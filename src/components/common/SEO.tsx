import React from 'react';
import { Helmet } from 'react-helmet-async';

interface SEOProps {
  title?: string;
  description?: string;
  keywords?: string;
  image?: string;
  url?: string;
  author?: string;
  type?: string;
}

const SEO: React.FC<SEOProps> = ({
  title = 'TradeZen - 知行合一 交易管理与复盘系统',
  description = 'TradeZen 是专为交易者打造的交易管理大师平台。集成交易日志、知行纪律与情绪分析、多维数据统计、逐根K线复盘与实盘直连同步。',
  keywords = 'TradeZen, 交易日志, 交易复盘, 交易管理, 模拟回测, 情绪追踪, 知行合一, 交易数据分析, trading journal',
  image = '/assets/1.png',
  url = 'https://tradezen.app/',
  author = 'TradeZen',
  type = 'website'
}) => {
  const fullTitle = title === 'TradeZen - 知行合一 交易管理与复盘系统' 
    ? title 
    : `${title} | TradeZen`;

  return (
    <Helmet>
      {/* Primary Meta Tags */}
      <title>{fullTitle}</title>
      <meta name="title" content={fullTitle} />
      <meta name="description" content={description} />
      <meta name="keywords" content={keywords} />
      <meta name="author" content={author} />
      <meta name="robots" content="index, follow" />
      
      {/* Open Graph / Facebook */}
      <meta property="og:type" content={type} />
      <meta property="og:url" content={url} />
      <meta property="og:title" content={fullTitle} />
      <meta property="og:description" content={description} />
      <meta property="og:image" content={image} />
      <meta property="og:site_name" content="TradeZen" />
      
      {/* Twitter */}
      <meta property="twitter:card" content="summary_large_image" />
      <meta property="twitter:url" content={url} />
      <meta property="twitter:title" content={fullTitle} />
      <meta property="twitter:description" content={description} />
      <meta property="twitter:image" content={image} />
      
      {/* Additional SEO Tags */}
      <link rel="canonical" href={url} />
    </Helmet>
  );
};

export default SEO;