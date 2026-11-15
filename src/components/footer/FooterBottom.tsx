import React from 'react';

const legalLinks = [
  { label: '服务条款', href: '/terms' },
  { label: '隐私政策', href: '/privacy' },
  { label: 'Cookie 声明', href: '/cookies' }
];

export default function FooterBottom() {
  return (
    <div className="border-t border-gray-800 pt-8">
      <div className="flex flex-col md:flex-row justify-between items-center gap-4">
        <p className="text-gray-400 text-sm">
          © {new Date().getFullYear()} TradeZen. All rights reserved.
        </p>
        <div className="flex gap-6 text-sm">
          {legalLinks.map(({ label, href }) => (
            <a
              key={label}
              href={href}
              className="text-gray-400 hover:text-white transition-colors"
            >
              {label}
            </a>
          ))}
        </div>
      </div>
    </div>
  );
}
