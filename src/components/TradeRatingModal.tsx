import React, { useState, useEffect } from 'react';
import { 
  X, Star, AlertTriangle, AlertCircle, Target, Sparkles, Crown, Check, Loader2, RotateCcw 
} from 'lucide-react';

export interface TradeRatingModalProps {
  isOpen: boolean;
  onClose: () => void;
  trade: {
    id: number;
    symbol: string;
    direction?: 'long' | 'short';
    rating?: number;
    entry_time?: string;
    size?: number;
    entryprice?: number;
    exitprice?: number;
  } | null;
  onSaveRating: (tradeId: number, rating: number) => Promise<void> | void;
}

const CONFETTI_PIECES = [
  { tx: '-60px', ty: '-50px', rot: '45deg', color: '#fbbf24', delay: '0s', size: 7 },
  { tx: '65px', ty: '-45px', rot: '-35deg', color: '#a855f7', delay: '0.2s', size: 8 },
  { tx: '-75px', ty: '10px', rot: '60deg', color: '#ec4899', delay: '0.1s', size: 6 },
  { tx: '70px', ty: '15px', rot: '-75deg', color: '#06b6d4', delay: '0.3s', size: 7 },
  { tx: '-45px', ty: '55px', rot: '90deg', color: '#10b981', delay: '0.15s', size: 6 },
  { tx: '50px', ty: '50px', rot: '-120deg', color: '#f59e0b', delay: '0.25s', size: 6 },
  { tx: '0px', ty: '-70px', rot: '15deg', color: '#f43f5e', delay: '0.05s', size: 8 },
  { tx: '-30px', ty: '-60px', rot: '-45deg', color: '#8b5cf6', delay: '0.35s', size: 7 },
  { tx: '35px', ty: '-65px', rot: '110deg', color: '#fbbf24', delay: '0.18s', size: 8 },
  { tx: '-65px', ty: '-15px', rot: '-90deg', color: '#3b82f6', delay: '0.22s', size: 6 },
  { tx: '60px', ty: '-20px', rot: '80deg', color: '#ec4899', delay: '0.28s', size: 6 },
  { tx: '0px', ty: '65px', rot: '-15deg', color: '#10b981', delay: '0.12s', size: 7 },
];

const RATING_CONFIG: Record<number, {
  label: string;
  sublabel: string;
  badge: string;
  badgeColor: string;
  bgGradient: string;
  cardBorder: string;
  starColor: string;
  accentGlow: string;
}> = {
  1: {
    label: '严重失误 / 违背计划',
    sublabel: '冲动追单或未设止损，违背交易系统纪律，须严肃复盘警惕！',
    badge: '🚨 严重违规 · 需严格复盘',
    badgeColor: 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/25',
    bgGradient: 'from-rose-500/15 via-rose-500/5 to-transparent',
    cardBorder: 'border-rose-500/30',
    starColor: 'text-rose-500 fill-rose-500',
    accentGlow: 'rgba(244, 63, 94, 0.35)',
  },
  2: {
    label: '执行欠佳 / 存在偏差',
    sublabel: '入场稍显仓促或盘中提前平仓，存在侥幸心理与情绪干扰。',
    badge: '⚠️ 执行欠佳 · 稍有侥幸',
    badgeColor: 'bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-500/25',
    bgGradient: 'from-orange-500/15 via-orange-500/5 to-transparent',
    cardBorder: 'border-orange-500/30',
    starColor: 'text-orange-500 fill-orange-500',
    accentGlow: 'rgba(249, 115, 22, 0.35)',
  },
  3: {
    label: '基本合格 / 中规中矩',
    sublabel: '守住纪律底线，按照既定计划执行，无重大纪律过失。',
    badge: '🎯 基本合格 · 守住底线',
    badgeColor: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/25',
    bgGradient: 'from-amber-500/15 via-amber-500/5 to-transparent',
    cardBorder: 'border-amber-500/30',
    starColor: 'text-amber-400 fill-amber-400',
    accentGlow: 'rgba(251, 191, 36, 0.35)',
  },
  4: {
    label: '良好执行 / 严格纪律',
    sublabel: '严格遵守开仓与止盈止损风控规则，冷静克制，纪律严明！',
    badge: '✨ 良好执行 · 纪律严明',
    badgeColor: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/25',
    bgGradient: 'from-emerald-500/15 via-emerald-500/5 to-transparent',
    cardBorder: 'border-emerald-500/30',
    starColor: 'text-emerald-500 fill-emerald-500',
    accentGlow: 'rgba(16, 185, 129, 0.35)',
  },
  5: {
    label: '知行合一 / 大师级执行！',
    sublabel: '完美知行合一！心如止水严格执行系统，极佳耐心与纪律典范！',
    badge: '👑 知行合一 · 完美典范',
    badgeColor: 'bg-purple-500/15 text-purple-600 dark:text-purple-300 border-purple-500/30',
    bgGradient: 'from-purple-500/20 via-amber-500/15 to-pink-500/15',
    cardBorder: 'border-purple-500/40 dark:border-purple-500/40',
    starColor: 'text-amber-400 fill-amber-400',
    accentGlow: 'rgba(168, 85, 247, 0.45)',
  },
};

export default function TradeRatingModal({
  isOpen,
  onClose,
  trade,
  onSaveRating,
}: TradeRatingModalProps) {
  const [selectedRating, setSelectedRating] = useState<number>(0);
  const [hoverRating, setHoverRating] = useState<number | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Sync initial rating when modal opens with a trade
  useEffect(() => {
    if (isOpen && trade) {
      setSelectedRating(trade.rating || 0);
      setHoverRating(null);
      setIsSaving(false);
      setSaveSuccess(false);
    }
  }, [isOpen, trade]);

  // Handle Escape key
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key >= '1' && e.key <= '5') {
        setSelectedRating(parseInt(e.key, 10));
      }
      if (e.key === '0') {
        setSelectedRating(0);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || !trade) return null;

  const activeRating = hoverRating !== null ? hoverRating : selectedRating;
  const config = RATING_CONFIG[activeRating];

  const handleSave = async (ratingToSave: number = selectedRating) => {
    if (isSaving) return;
    setIsSaving(true);
    try {
      await onSaveRating(trade.id, ratingToSave);
      setSaveSuccess(true);
      setTimeout(() => {
        onClose();
      }, 350);
    } catch (err) {
      console.error('Failed to save rating:', err);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <>
      {/* Keyframe definitions for rating animations */}
      <style>{`
        @keyframes ratingShake {
          0%, 100% { transform: translateX(0) rotate(0deg); }
          15% { transform: translateX(-6px) rotate(-4deg); }
          30% { transform: translateX(5px) rotate(3deg); }
          45% { transform: translateX(-4px) rotate(-2deg); }
          60% { transform: translateX(3px) rotate(2deg); }
          75% { transform: translateX(-1px) rotate(-1deg); }
        }
        @keyframes ratingPulseAlert {
          0%, 100% { transform: scale(1); opacity: 0.9; }
          50% { transform: scale(1.12); opacity: 0.5; }
        }
        @keyframes ratingSway {
          0%, 100% { transform: translateY(0) rotate(0deg); }
          50% { transform: translateY(6px) rotate(-2.5deg); }
        }
        @keyframes ratingBreathe {
          0%, 100% { transform: scale(1); filter: drop-shadow(0 0 4px rgba(245, 158, 11, 0.4)); }
          50% { transform: scale(1.09); filter: drop-shadow(0 0 16px rgba(245, 158, 11, 0.85)); }
        }
        @keyframes ratingBounceSpring {
          0%, 100% { transform: translateY(0) scale(1); }
          35% { transform: translateY(-12px) scale(1.14); }
          65% { transform: translateY(3px) scale(0.97); }
          85% { transform: translateY(-2px) scale(1.02); }
        }
        @keyframes ratingSparkleTwinkle {
          0%, 100% { transform: scale(0.7) rotate(0deg); opacity: 0.4; }
          50% { transform: scale(1.3) rotate(180deg); opacity: 1; }
        }
        @keyframes ratingSpinRays {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        @keyframes ratingCrownCelebrate {
          0%, 100% { transform: scale(1) translateY(0) rotate(0deg); }
          25% { transform: scale(1.15) translateY(-8px) rotate(-3.5deg); }
          50% { transform: scale(1.08) translateY(-4px) rotate(3.5deg); }
          75% { transform: scale(1.12) translateY(-6px) rotate(-2deg); }
        }
        @keyframes ratingConfettiFly {
          0% { transform: translate(0, 0) scale(0.2) rotate(0deg); opacity: 1; }
          60% { opacity: 1; }
          100% { transform: translate(var(--tx), var(--ty)) scale(1.1) rotate(var(--rot)); opacity: 0; }
        }
      `}</style>

      {/* Backdrop */}
      <div
        className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs transition-opacity duration-200"
        onClick={onClose}
      />

      {/* Centered Modal */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 pointer-events-none">
        <div 
          onClick={(e) => e.stopPropagation()}
          className="pointer-events-auto relative w-full max-w-md bg-white dark:bg-[#0c101c] rounded-2xl shadow-2xl border border-gray-200/90 dark:border-white/10 overflow-hidden animate-in fade-in zoom-in-95 duration-200"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-white/10 bg-gray-50/70 dark:bg-white/[0.02]">
            <div className="flex items-center space-x-2.5">
              <span className="p-1.5 rounded-xl bg-amber-500/10 text-amber-500 border border-amber-500/20">
                <Star className="w-4 h-4 fill-amber-400 text-amber-400" />
              </span>
              <div>
                <h3 className="text-sm font-bold text-gray-900 dark:text-white flex items-center space-x-2">
                  <span>设置交易纪律评分</span>
                  <span className="text-xs font-mono font-medium text-gray-400 dark:text-gray-500">
                    #{trade.id}
                  </span>
                </h3>
                <div className="text-xs text-gray-500 dark:text-gray-400 flex items-center space-x-1.5 mt-0.5 font-mono">
                  <span className="font-bold text-gray-800 dark:text-gray-200">{trade.symbol}</span>
                  {trade.direction && (
                    <span className={`px-1.5 py-0.2 rounded text-[10px] font-bold ${
                      trade.direction === 'long' 
                        ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' 
                        : 'bg-rose-500/10 text-rose-600 dark:text-rose-400'
                    }`}>
                      {trade.direction === 'long' ? '多 BUY' : '空 SELL'}
                    </span>
                  )}
                  {trade.size != null && <span>· {trade.size}手</span>}
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 rounded-lg hover:bg-gray-100 dark:hover:bg-white/5 transition"
              title="关闭"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Dynamic Animation Display Area (根据不同评分给个动效) */}
          <div className="px-6 pt-6 pb-2 text-center">
            <div 
              className={`relative mx-auto w-32 h-32 rounded-2xl flex items-center justify-center border transition-all duration-300 ${
                activeRating > 0 ? config.cardBorder : 'border-dashed border-gray-200 dark:border-white/10'
              }`}
              style={{
                boxShadow: activeRating > 0 ? `0 10px 30px -10px ${config.accentGlow}` : undefined,
                background: activeRating > 0 
                  ? `radial-gradient(circle, ${config.accentGlow.replace('0.35', '0.15').replace('0.45', '0.2')} 0%, transparent 70%)` 
                  : undefined,
              }}
            >
              {/* 1 STAR ANIMATION: SHAKE / VIBRATE + EXPANDING RED ALERT RINGS */}
              {activeRating === 1 && (
                <div className="relative flex items-center justify-center">
                  <div 
                    className="absolute inset-0 w-24 h-24 -m-4 rounded-full border-2 border-rose-500/30"
                    style={{ animation: 'ratingPulseAlert 1.5s ease-out infinite' }}
                  />
                  <div 
                    className="p-4 rounded-2xl bg-rose-500/15 border border-rose-500/30 shadow-lg text-rose-500"
                    style={{ animation: 'ratingShake 0.6s ease-in-out infinite' }}
                  >
                    <AlertTriangle className="w-12 h-12 text-rose-500 stroke-[2.2]" />
                  </div>
                </div>
              )}

              {/* 2 STAR ANIMATION: SWAY & DIP + CAUTION ORANGE PULSE */}
              {activeRating === 2 && (
                <div className="relative flex items-center justify-center">
                  <div 
                    className="absolute w-20 h-20 rounded-full bg-orange-500/10 blur-md"
                    style={{ animation: 'ratingPulseAlert 2s ease-in-out infinite' }}
                  />
                  <div 
                    className="p-4 rounded-2xl bg-orange-500/15 border border-orange-500/30 shadow-lg text-orange-500"
                    style={{ animation: 'ratingSway 2s ease-in-out infinite' }}
                  >
                    <AlertCircle className="w-12 h-12 text-orange-500 stroke-[2.2]" />
                  </div>
                </div>
              )}

              {/* 3 STAR ANIMATION: CALM BREATHING PULSE + GOLDEN RADAR RINGS */}
              {activeRating === 3 && (
                <div className="relative flex items-center justify-center">
                  <div className="absolute w-24 h-24 rounded-full border border-amber-400/30 animate-ping opacity-60" />
                  <div 
                    className="p-4 rounded-2xl bg-amber-500/15 border border-amber-500/30 shadow-lg text-amber-500"
                    style={{ animation: 'ratingBreathe 2s ease-in-out infinite' }}
                  >
                    <Target className="w-12 h-12 text-amber-500 stroke-[2.2]" />
                  </div>
                </div>
              )}

              {/* 4 STAR ANIMATION: ENERGETIC SPRING BOUNCE + EMERALD TWINKLING SPARKLES */}
              {activeRating === 4 && (
                <div className="relative flex items-center justify-center">
                  {/* Orbiting sparkles */}
                  <Sparkles 
                    className="absolute -top-1 -right-1 w-5 h-5 text-emerald-400" 
                    style={{ animation: 'ratingSparkleTwinkle 1.6s ease-in-out infinite' }}
                  />
                  <Sparkles 
                    className="absolute -bottom-1 -left-1 w-4 h-4 text-emerald-400" 
                    style={{ animation: 'ratingSparkleTwinkle 1.6s ease-in-out infinite 0.6s' }}
                  />
                  <div 
                    className="p-4 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 shadow-lg text-emerald-500"
                    style={{ animation: 'ratingBounceSpring 1.3s cubic-bezier(0.28, 0.84, 0.42, 1) infinite' }}
                  >
                    <Sparkles className="w-12 h-12 text-emerald-500 stroke-[2.2]" />
                  </div>
                </div>
              )}

              {/* 5 STAR ANIMATION: SPECTACULAR CELEBRATION! CONFETTI FLYING + ROTATING HALO RAYS + CROWN POP */}
              {activeRating === 5 && (
                <div className="relative flex items-center justify-center w-full h-full overflow-visible">
                  {/* Rotating radiant rays */}
                  <div 
                    className="absolute w-28 h-28 rounded-full border border-dashed border-amber-400/40 pointer-events-none"
                    style={{ animation: 'ratingSpinRays 10s linear infinite' }}
                  />
                  
                  {/* Flying Confetti Particles */}
                  {CONFETTI_PIECES.map((piece, i) => (
                    <span
                      key={i}
                      className="absolute rounded-full pointer-events-none"
                      style={{
                        width: piece.size,
                        height: piece.size,
                        backgroundColor: piece.color,
                        boxShadow: `0 0 6px ${piece.color}`,
                        ['--tx' as any]: piece.tx,
                        ['--ty' as any]: piece.ty,
                        ['--rot' as any]: piece.rot,
                        animation: `ratingConfettiFly 1.8s cubic-bezier(0.12, 0.8, 0.32, 1) infinite ${piece.delay}`,
                      }}
                    />
                  ))}

                  {/* Celebrating Crown */}
                  <div 
                    className="relative z-10 p-4 rounded-2xl bg-gradient-to-br from-amber-400/20 via-purple-500/20 to-pink-500/20 border border-amber-400/50 shadow-xl text-amber-400"
                    style={{ animation: 'ratingCrownCelebrate 1.5s ease-in-out infinite' }}
                  >
                    <Crown className="w-12 h-12 text-amber-400 stroke-[2.3] fill-amber-400/30 drop-shadow-[0_0_8px_rgba(251,191,36,0.6)]" />
                  </div>
                </div>
              )}

              {/* 0 STARS: NEUTRAL HINT */}
              {activeRating === 0 && (
                <div className="text-gray-300 dark:text-gray-600 flex flex-col items-center justify-center">
                  <Star className="w-12 h-12 stroke-[1.5]" />
                  <span className="text-[11px] font-medium text-gray-400 dark:text-gray-500 mt-1">未评分</span>
                </div>
              )}
            </div>

            {/* Title & Feedback Text */}
            <div className="mt-4 min-h-[56px] flex flex-col items-center justify-center">
              {activeRating > 0 ? (
                <>
                  <div className="inline-flex items-center space-x-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold border mb-1.5 transition-all">
                    <span className={config.badgeColor}>{config.badge}</span>
                  </div>
                  <h4 className="text-sm font-bold text-gray-900 dark:text-white">
                    {config.label}
                  </h4>
                  <p className="text-xs text-gray-500 dark:text-gray-400 max-w-xs mt-0.5 leading-relaxed">
                    {config.sublabel}
                  </p>
                </>
              ) : (
                <>
                  <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                    请为本笔交易设定纪律评分
                  </h4>
                  <p className="text-xs text-gray-400 dark:text-gray-500 max-w-xs mt-0.5">
                    客观评估自己对入场策略、止损防守与离场执行的遵守程度
                  </p>
                </>
              )}
            </div>
          </div>

          {/* Interactive Star Selection Bar */}
          <div className="px-6 py-4 bg-gray-50/60 dark:bg-white/[0.01] border-t border-b border-gray-100 dark:border-white/5">
            <div className="flex items-center justify-center space-x-2 sm:space-x-3">
              {[1, 2, 3, 4, 5].map((star) => {
                const isLit = (hoverRating !== null ? hoverRating : selectedRating) >= star;
                const isSelected = selectedRating === star;
                return (
                  <button
                    key={star}
                    type="button"
                    onMouseEnter={() => setHoverRating(star)}
                    onMouseLeave={() => setHoverRating(null)}
                    onClick={() => {
                      setSelectedRating(star);
                      setHoverRating(null);
                    }}
                    className={`relative p-2 rounded-xl transition-all duration-200 transform ${
                      isLit
                        ? 'scale-110 -translate-y-0.5'
                        : 'opacity-40 hover:opacity-80 hover:scale-105'
                    } ${
                      isSelected
                        ? 'ring-2 ring-purple-500/50 bg-purple-50 dark:bg-purple-950/40 shadow-xs'
                        : 'hover:bg-gray-100 dark:hover:bg-white/5'
                    }`}
                    title={`评定为 ${star} 星`}
                  >
                    <Star
                      className={`w-7 h-7 sm:w-8 sm:h-8 transition-colors ${
                        isLit
                          ? (star === 1 ? 'text-rose-500 fill-rose-500' :
                             star === 2 ? 'text-orange-500 fill-orange-500' :
                             star === 3 ? 'text-amber-400 fill-amber-400' :
                             star === 4 ? 'text-emerald-500 fill-emerald-500' :
                             'text-amber-400 fill-amber-400 drop-shadow-[0_0_6px_rgba(251,191,36,0.7)]')
                          : 'text-gray-400 dark:text-gray-600'
                      }`}
                    />
                    <span className="block text-[10px] font-mono font-bold text-center mt-1 text-gray-500 dark:text-gray-400">
                      {star}星
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Footer Actions */}
          <div className="flex items-center justify-between px-6 py-4 bg-gray-50/80 dark:bg-white/[0.02]">
            <div>
              {selectedRating > 0 ? (
                <button
                  type="button"
                  onClick={() => {
                    setSelectedRating(0);
                    setHoverRating(null);
                  }}
                  className="text-xs text-gray-500 hover:text-red-500 dark:text-gray-400 dark:hover:text-red-400 transition flex items-center space-x-1"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>清空评分</span>
                </button>
              ) : (
                <span className="text-xs text-gray-400 font-mono">按 1~5 数字键快速评分</span>
              )}
            </div>

            <div className="flex items-center space-x-2.5">
              <button
                type="button"
                onClick={onClose}
                className="px-3.5 py-2 text-xs font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-200/70 dark:hover:bg-white/10 rounded-xl transition"
              >
                取消
              </button>
              <button
                type="button"
                disabled={isSaving}
                onClick={() => handleSave()}
                className={`px-5 py-2 text-xs font-semibold rounded-xl text-white shadow-sm transition flex items-center space-x-1.5 ${
                  saveSuccess
                    ? 'bg-emerald-600'
                    : 'bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 active:scale-95'
                } ${isSaving ? 'opacity-75 cursor-not-allowed' : ''}`}
              >
                {isSaving ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>保存中...</span>
                  </>
                ) : saveSuccess ? (
                  <>
                    <Check className="w-3.5 h-3.5" />
                    <span>已保存</span>
                  </>
                ) : (
                  <span>保存评分</span>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
