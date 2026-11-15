import React, { useEffect, useState } from 'react';
import { 
  X, Star, AlertTriangle, AlertCircle, Target, Sparkles, Crown 
} from 'lucide-react';

export interface RatingAnimationData {
  rating: number;
  symbol: string;
  tradeId: number;
}

export interface TradeRatingAnimationOverlayProps {
  data: RatingAnimationData | null;
  onClose: () => void;
  duration?: number; // default 2600ms
}

const CONFETTI_PIECES = [
  { tx: '-80px', ty: '-60px', rot: '45deg', color: '#fbbf24', delay: '0s', size: 8 },
  { tx: '85px', ty: '-55px', rot: '-35deg', color: '#a855f7', delay: '0.15s', size: 9 },
  { tx: '-95px', ty: '15px', rot: '60deg', color: '#ec4899', delay: '0.1s', size: 7 },
  { tx: '90px', ty: '20px', rot: '-75deg', color: '#06b6d4', delay: '0.25s', size: 8 },
  { tx: '-60px', ty: '70px', rot: '90deg', color: '#10b981', delay: '0.12s', size: 7 },
  { tx: '65px', ty: '65px', rot: '-120deg', color: '#f59e0b', delay: '0.2s', size: 6 },
  { tx: '0px', ty: '-90px', rot: '15deg', color: '#f43f5e', delay: '0.05s', size: 9 },
  { tx: '-40px', ty: '-80px', rot: '-45deg', color: '#8b5cf6', delay: '0.3s', size: 8 },
  { tx: '45px', ty: '-85px', rot: '110deg', color: '#fbbf24', delay: '0.18s', size: 9 },
  { tx: '-85px', ty: '-20px', rot: '-90deg', color: '#3b82f6', delay: '0.22s', size: 7 },
  { tx: '80px', ty: '-25px', rot: '80deg', color: '#ec4899', delay: '0.28s', size: 7 },
  { tx: '0px', ty: '85px', rot: '-15deg', color: '#10b981', delay: '0.1s', size: 8 },
  { tx: '-110px', ty: '-40px', rot: '30deg', color: '#fbbf24', delay: '0.14s', size: 6 },
  { tx: '110px', ty: '-35px', rot: '-50deg', color: '#a855f7', delay: '0.26s', size: 7 },
  { tx: '-70px', ty: '-95px', rot: '70deg', color: '#ec4899', delay: '0.08s', size: 8 },
  { tx: '70px', ty: '-95px', rot: '-60deg', color: '#06b6d4', delay: '0.16s', size: 8 },
];

const RATING_CONFIG: Record<number, {
  label: string;
  sublabel: string;
  badge: string;
  badgeColor: string;
  cardBorder: string;
  starColor: string;
  accentGlow: string;
}> = {
  1: {
    label: '严重失误 / 违背计划',
    sublabel: '冲动追单或未设止损，违背交易系统纪律，须严肃复盘警惕！',
    badge: '🚨 严重违规 · 需严格复盘',
    badgeColor: 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/25',
    cardBorder: 'border-rose-500/30',
    starColor: 'text-rose-500 fill-rose-500',
    accentGlow: 'rgba(244, 63, 94, 0.35)',
  },
  2: {
    label: '执行欠佳 / 存在偏差',
    sublabel: '入场仓促或盘中提前平仓，存在侥幸心理与情绪干扰。',
    badge: '⚠️ 执行欠佳 · 稍有侥幸',
    badgeColor: 'bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-500/25',
    cardBorder: 'border-orange-500/30',
    starColor: 'text-orange-500 fill-orange-500',
    accentGlow: 'rgba(249, 115, 22, 0.35)',
  },
  3: {
    label: '基本合格 / 中规中矩',
    sublabel: '守住纪律底线，按照既定计划执行，无重大纪律过失。',
    badge: '🎯 基本合格 · 守住底线',
    badgeColor: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/25',
    cardBorder: 'border-amber-500/30',
    starColor: 'text-amber-400 fill-amber-400',
    accentGlow: 'rgba(251, 191, 36, 0.35)',
  },
  4: {
    label: '良好执行 / 严格纪律',
    sublabel: '严格遵守开仓与止盈止损风控规则，冷静克制，纪律严明！',
    badge: '✨ 良好执行 · 纪律严明',
    badgeColor: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/25',
    cardBorder: 'border-emerald-500/30',
    starColor: 'text-emerald-500 fill-emerald-500',
    accentGlow: 'rgba(16, 185, 129, 0.35)',
  },
  5: {
    label: '知行合一 / 大师级执行！',
    sublabel: '完美知行合一！心如止水严格执行系统，极佳耐心与纪律典范！',
    badge: '👑 知行合一 · 完美典范',
    badgeColor: 'bg-purple-500/15 text-purple-600 dark:text-purple-300 border-purple-500/30',
    cardBorder: 'border-purple-500/40 dark:border-purple-500/40',
    starColor: 'text-amber-400 fill-amber-400',
    accentGlow: 'rgba(168, 85, 247, 0.45)',
  },
};

export default function TradeRatingAnimationOverlay({
  data,
  onClose,
  duration = 2600,
}: TradeRatingAnimationOverlayProps) {
  const [isClosing, setIsClosing] = useState(false);

  useEffect(() => {
    if (!data || data.rating <= 0) return;
    setIsClosing(false);

    // Auto dismiss after specified duration
    const timer = setTimeout(() => {
      setIsClosing(true);
      setTimeout(() => {
        onClose();
      }, 250);
    }, duration);

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' || e.key === ' ' || e.key === 'Enter') {
        setIsClosing(true);
        setTimeout(onClose, 200);
      }
    };
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      clearTimeout(timer);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [data, duration, onClose]);

  if (!data || data.rating <= 0) return null;

  const config = RATING_CONFIG[data.rating] || RATING_CONFIG[3];

  const handleDismiss = () => {
    setIsClosing(true);
    setTimeout(onClose, 200);
  };

  return (
    <>
      <style>{`
        @keyframes ratingShake {
          0%, 100% { transform: translateX(0) rotate(0deg); }
          15% { transform: translateX(-7px) rotate(-4deg); }
          30% { transform: translateX(6px) rotate(3deg); }
          45% { transform: translateX(-5px) rotate(-2deg); }
          60% { transform: translateX(4px) rotate(2deg); }
          75% { transform: translateX(-2px) rotate(-1deg); }
        }
        @keyframes ratingPulseAlert {
          0%, 100% { transform: scale(1); opacity: 0.9; }
          50% { transform: scale(1.15); opacity: 0.4; }
        }
        @keyframes ratingSway {
          0%, 100% { transform: translateY(0) rotate(0deg); }
          50% { transform: translateY(7px) rotate(-3deg); }
        }
        @keyframes ratingBreathe {
          0%, 100% { transform: scale(1); filter: drop-shadow(0 0 4px rgba(245, 158, 11, 0.4)); }
          50% { transform: scale(1.1); filter: drop-shadow(0 0 18px rgba(245, 158, 11, 0.9)); }
        }
        @keyframes ratingBounceSpring {
          0%, 100% { transform: translateY(0) scale(1); }
          35% { transform: translateY(-14px) scale(1.16); }
          65% { transform: translateY(3px) scale(0.96); }
          85% { transform: translateY(-2px) scale(1.02); }
        }
        @keyframes ratingSparkleTwinkle {
          0%, 100% { transform: scale(0.6) rotate(0deg); opacity: 0.3; }
          50% { transform: scale(1.4) rotate(180deg); opacity: 1; }
        }
        @keyframes ratingSpinRays {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        @keyframes ratingCrownCelebrate {
          0%, 100% { transform: scale(1) translateY(0) rotate(0deg); }
          25% { transform: scale(1.18) translateY(-10px) rotate(-4deg); }
          50% { transform: scale(1.1) translateY(-4px) rotate(4deg); }
          75% { transform: scale(1.14) translateY(-8px) rotate(-2deg); }
        }
        @keyframes ratingConfettiFly {
          0% { transform: translate(0, 0) scale(0.2) rotate(0deg); opacity: 1; }
          60% { opacity: 1; }
          100% { transform: translate(var(--tx), var(--ty)) scale(1.1) rotate(var(--rot)); opacity: 0; }
        }
        @keyframes ratingProgressShrink {
          from { width: 100%; }
          to { width: 0%; }
        }
      `}</style>

      {/* Subtle backdrop overlay */}
      <div 
        onClick={handleDismiss}
        className={`fixed inset-0 z-50 bg-black/30 backdrop-blur-[2px] transition-opacity duration-200 cursor-pointer ${
          isClosing ? 'opacity-0' : 'opacity-100'
        }`}
        title="点击任意位置关闭"
      />

      {/* Floating Center Animation Card */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
        <div 
          onClick={(e) => e.stopPropagation()}
          className={`pointer-events-auto relative w-full max-w-sm bg-white/95 dark:bg-[#0c101c]/95 backdrop-blur-xl rounded-3xl shadow-2xl border ${
            config.cardBorder
          } p-6 text-center overflow-hidden transition-all duration-200 ${
            isClosing 
              ? 'opacity-0 scale-95 translate-y-2' 
              : 'animate-in fade-in zoom-in-90 duration-300'
          }`}
          style={{
            boxShadow: `0 20px 50px -10px ${config.accentGlow}`,
          }}
        >
          {/* Top Close Button & Trade Target Tag */}
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-mono font-semibold px-2 py-0.5 rounded-md bg-gray-100 dark:bg-white/5 text-gray-500 dark:text-gray-400">
              #{data.tradeId} · {data.symbol} 纪律评分已更新
            </span>
            <button
              type="button"
              onClick={handleDismiss}
              className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 rounded-lg transition"
              title="关闭"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Dynamic Animation Figure Area */}
          <div className="relative mx-auto w-32 h-32 flex items-center justify-center my-3">
            {/* 1 STAR: VIBRATING SHAKE + RED ALERT PULSE */}
            {data.rating === 1 && (
              <div className="relative flex items-center justify-center">
                <div 
                  className="absolute inset-0 w-28 h-28 -m-4 rounded-full border-2 border-rose-500/30"
                  style={{ animation: 'ratingPulseAlert 1.4s ease-out infinite' }}
                />
                <div 
                  className="p-4 rounded-2xl bg-rose-500/15 border border-rose-500/35 shadow-xl text-rose-500"
                  style={{ animation: 'ratingShake 0.6s ease-in-out infinite' }}
                >
                  <AlertTriangle className="w-14 h-14 text-rose-500 stroke-[2.2]" />
                </div>
              </div>
            )}

            {/* 2 STAR: SWAY & DIP + ORANGE CAUTION PULSE */}
            {data.rating === 2 && (
              <div className="relative flex items-center justify-center">
                <div 
                  className="absolute w-24 h-24 rounded-full bg-orange-500/15 blur-lg"
                  style={{ animation: 'ratingPulseAlert 2s ease-in-out infinite' }}
                />
                <div 
                  className="p-4 rounded-2xl bg-orange-500/15 border border-orange-500/35 shadow-xl text-orange-500"
                  style={{ animation: 'ratingSway 2s ease-in-out infinite' }}
                >
                  <AlertCircle className="w-14 h-14 text-orange-500 stroke-[2.2]" />
                </div>
              </div>
            )}

            {/* 3 STAR: CALM GOLDEN BREATHING PULSE + RADAR RINGS */}
            {data.rating === 3 && (
              <div className="relative flex items-center justify-center">
                <div className="absolute w-28 h-28 rounded-full border border-amber-400/40 animate-ping opacity-60" />
                <div 
                  className="p-4 rounded-2xl bg-amber-500/15 border border-amber-500/35 shadow-xl text-amber-500"
                  style={{ animation: 'ratingBreathe 2s ease-in-out infinite' }}
                >
                  <Target className="w-14 h-14 text-amber-500 stroke-[2.2]" />
                </div>
              </div>
            )}

            {/* 4 STAR: ENERGETIC SPRING BOUNCE + EMERALD SPARKLES */}
            {data.rating === 4 && (
              <div className="relative flex items-center justify-center">
                <Sparkles 
                  className="absolute -top-2 -right-2 w-6 h-6 text-emerald-400 drop-shadow-[0_0_6px_rgba(16,185,129,0.8)]" 
                  style={{ animation: 'ratingSparkleTwinkle 1.6s ease-in-out infinite' }}
                />
                <Sparkles 
                  className="absolute -bottom-2 -left-2 w-5 h-5 text-emerald-400 drop-shadow-[0_0_6px_rgba(16,185,129,0.8)]" 
                  style={{ animation: 'ratingSparkleTwinkle 1.6s ease-in-out infinite 0.6s' }}
                />
                <div 
                  className="p-4 rounded-2xl bg-emerald-500/15 border border-emerald-500/35 shadow-xl text-emerald-500"
                  style={{ animation: 'ratingBounceSpring 1.3s cubic-bezier(0.28, 0.84, 0.42, 1) infinite' }}
                >
                  <Sparkles className="w-14 h-14 text-emerald-500 stroke-[2.2]" />
                </div>
              </div>
            )}

            {/* 5 STAR: SPECTACULAR CELEBRATION! CONFETTI BURST + ROTATING HALO + CROWN POP */}
            {data.rating === 5 && (
              <div className="relative flex items-center justify-center w-full h-full overflow-visible">
                {/* Rotating radiant rays */}
                <div 
                  className="absolute w-32 h-32 rounded-full border border-dashed border-amber-400/50 pointer-events-none"
                  style={{ animation: 'ratingSpinRays 10s linear infinite' }}
                />
                
                {/* 16 Confetti Particles */}
                {CONFETTI_PIECES.map((piece, i) => (
                  <span
                    key={i}
                    className="absolute rounded-full pointer-events-none"
                    style={{
                      width: piece.size,
                      height: piece.size,
                      backgroundColor: piece.color,
                      boxShadow: `0 0 8px ${piece.color}`,
                      ['--tx' as any]: piece.tx,
                      ['--ty' as any]: piece.ty,
                      ['--rot' as any]: piece.rot,
                      animation: `ratingConfettiFly 1.8s cubic-bezier(0.12, 0.8, 0.32, 1) infinite ${piece.delay}`,
                    }}
                  />
                ))}

                {/* Celebrating Golden Crown */}
                <div 
                  className="relative z-10 p-4 rounded-2xl bg-gradient-to-br from-amber-400/25 via-purple-500/25 to-pink-500/20 border border-amber-400/60 shadow-2xl text-amber-400"
                  style={{ animation: 'ratingCrownCelebrate 1.5s ease-in-out infinite' }}
                >
                  <Crown className="w-14 h-14 text-amber-400 stroke-[2.3] fill-amber-400/40 drop-shadow-[0_0_12px_rgba(251,191,36,0.8)]" />
                </div>
              </div>
            )}
          </div>

          {/* Badge & Feedback Message */}
          <div className="mt-2 mb-3">
            <div className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-full text-xs font-bold border mb-2 shadow-xs">
              <span className={config.badgeColor}>{config.badge}</span>
            </div>
            <h4 className="text-base font-bold text-gray-900 dark:text-white">
              {config.label}
            </h4>
            <p className="text-xs text-gray-500 dark:text-gray-400 max-w-xs mx-auto mt-1 leading-relaxed">
              {config.sublabel}
            </p>

            {/* Stars row */}
            <div className="flex items-center justify-center space-x-1 mt-3">
              {[1, 2, 3, 4, 5].map((star) => (
                <Star
                  key={star}
                  size={16}
                  className={star <= data.rating ? config.starColor : 'text-gray-200 dark:text-gray-700'}
                />
              ))}
            </div>
          </div>

          {/* Auto dismiss progress line at bottom */}
          <div className="absolute bottom-0 left-0 right-0 h-1 bg-gray-100 dark:bg-white/5 overflow-hidden">
            <div 
              className="h-full bg-gradient-to-r from-purple-500 to-indigo-500"
              style={{
                animation: `ratingProgressShrink ${duration}ms linear forwards`,
              }}
            />
          </div>
        </div>
      </div>
    </>
  );
}
