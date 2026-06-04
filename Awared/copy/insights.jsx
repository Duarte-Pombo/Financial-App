// Insights — editorial spending awareness report.
// Free + Premium modes, with paywall sheet.

const { useState: useStateI, useEffect: useEffectI, useMemo: useMemoI } = React;

// ────────────────────────────────────────────────────
// DATA  (mocked — replace with real values from store)
// ────────────────────────────────────────────────────
const INS_DATA = {
  period: 'Last 30 days',
  spent: 312,
  purchases: 14,
  riskScore: 3.1,
  topEmotion: 'stress',
  highSpend: 42,
  lowSpend: 18,
  highEmo: 'stress',
  lowEmo: 'calm',

  weekly: [
    { label: 'M', total: 22, dominant: 'calm' },
    { label: 'T', total: 41, dominant: 'anxiety' },
    { label: 'W', total: 18, dominant: 'happy' },
    { label: 'T', total: 89, dominant: 'stress' },
    { label: 'F', total: 64, dominant: 'excited' },
    { label: 'S', total: 47, dominant: 'happy' },
    { label: 'S', total: 31, dominant: 'calm' },
  ],
  weeklyPeak: 3,

  scatter: [
    { x: 0.10, y: 0.18, emo: 'calm' },
    { x: 0.18, y: 0.12, emo: 'calm' },
    { x: 0.22, y: 0.30, emo: 'happy' },
    { x: 0.30, y: 0.22, emo: 'happy' },
    { x: 0.42, y: 0.34, emo: 'boredom' },
    { x: 0.50, y: 0.46, emo: 'anxiety' },
    { x: 0.58, y: 0.40, emo: 'anxiety' },
    { x: 0.68, y: 0.62, emo: 'stress' },
    { x: 0.74, y: 0.55, emo: 'stress' },
    { x: 0.82, y: 0.78, emo: 'stress' },
    { x: 0.88, y: 0.70, emo: 'anger' },
    { x: 0.92, y: 0.88, emo: 'anger' },
  ],

  fingerprint: {
    sadness: 0.30, stress: 0.82, happy: 0.55, anxiety: 0.62,
    boredom: 0.40, excited: 0.48, calm: 0.28, anger: 0.36,
  },

  hours: [
    0.05,0.02,0.01,0.00,0.00,0.02,
    0.10,0.18,0.25,0.20,0.15,0.22,
    0.30,0.20,0.18,0.22,0.30,0.45,
    0.55,0.68,0.78,0.92,0.74,0.40,
  ],

  vulnerable: [
    { name: 'Uber Eats',   pct: 78, emo: 'stress' },
    { name: 'Amazon',      pct: 64, emo: 'boredom' },
    { name: 'Worten',      pct: 52, emo: 'anxiety' },
    { name: 'Spotify ads', pct: 41, emo: 'sadness' },
  ],

  findings: [
    {
      kind: 'flag', tone: 'warn',
      title: 'You spend most when stressed',
      body: 'On 4 of the past 7 stressed entries, the purchase exceeded your average by 2×. Consider a 10-minute pause when you feel this.',
      emo: 'stress',
    },
    {
      kind: 'category', tone: 'neutral',
      title: 'Entertainment is your biggest category',
      body: '€118 across cinema, streaming and bars — 38% of total spend.',
      emo: 'happy',
    },
    {
      kind: 'streak', tone: 'good',
      title: '3 calm purchases in a row',
      body: 'Your last three logged purchases were tagged calm — a sign you\u2019re buying intentionally.',
      emo: 'calm',
    },
    {
      kind: 'flag', tone: 'warn',
      title: 'Late-night purchases doubled',
      body: 'Compared to the previous 30 days, purchases after 21:00 doubled in count and amount.',
      emo: 'anxiety',
    },
  ],
};

// ────────────────────────────────────────────────────
// FRAME
// ────────────────────────────────────────────────────
function InsightFrame({ children }) {
  return (
    <div style={{
      width: 402, height: 872, borderRadius: 44,
      background: 'var(--bg)', overflow: 'hidden', position: 'relative',
      boxShadow: '0 30px 80px rgba(0,0,0,0.18), 0 0 0 1px rgba(0,0,0,0.10), inset 0 0 0 8px #FFFCF6',
      display: 'flex', flexDirection: 'column'
    }} className="no-scroll">
      {children}
    </div>
  );
}

// ────────────────────────────────────────────────────
// HEADER
// ────────────────────────────────────────────────────
function InsHeader({ premium, period }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between',
      padding: '37px 24px 6px', flexShrink: 0,
    }}>
      <div>
        <div className="italic-display" style={{ fontSize: 28, letterSpacing: -0.3, whiteSpace: 'nowrap' }}>insights</div>
        <div style={{ fontFamily: 'Playfair Display', fontStyle: 'italic', fontSize: 13, color: 'var(--ink-mute)', marginTop: 2 }}>
          {period}
        </div>
      </div>
      {premium ? (
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: 5,
          padding: '5px 9px', borderRadius: 999,
          background: 'rgba(126,100,179,0.10)',
          border: '1px solid rgba(126,100,179,0.30)',
        }}>
          <svg width="11" height="11" viewBox="0 0 24 24">
            <path d="M12 2 L13 9 L20 10 L13 11 L12 18 L11 11 L4 10 L11 9 Z" fill="var(--purple-deep)"/>
          </svg>
          <span style={{ fontFamily: 'Inter', fontSize: 9.5, letterSpacing: 1.6, color: 'var(--purple-deep)', fontWeight: 600 }}>
            PREMIUM
          </span>
        </div>
      ) : (
        <button style={{
          background: 'transparent', border: 'none', padding: 6, cursor: 'pointer',
          color: 'var(--ink-soft)',
        }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
            <path d="M4 6 L20 6 M4 12 L20 12 M4 18 L14 18"/>
          </svg>
        </button>
      )}
    </div>
  );
}

// ────────────────────────────────────────────────────
// HERO LEAD — big editorial headline
// ────────────────────────────────────────────────────
function HeroLead({ d }) {
  return (
    <div style={{ padding: '14px 24px 0' }}>
      <div className="eyebrow" style={{ marginBottom: 10 }}>THE FINDING</div>
      <div className="italic-display" style={{
        fontSize: 26, lineHeight: 1.22, letterSpacing: -0.3,
        fontStyle: 'normal', fontWeight: 700, textWrap: 'pretty',
        fontFamily: 'Playfair Display, Georgia, serif',
      }}>
        Your <span style={{ color: EMOTION_COLORS[d.highEmo], fontStyle: 'italic' }}>{d.highEmo}</span> purchases
        averaged <span style={{ fontStyle: 'italic' }}>€{d.highSpend}</span>
        <span style={{ color: 'var(--ink-soft)' }}> — your </span>
        <span style={{ color: EMOTION_COLORS[d.lowEmo], fontStyle: 'italic' }}>{d.lowEmo}</span> ones <span style={{ fontStyle: 'italic' }}>€{d.lowSpend}</span>.
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────
// RISK + STATS BLOCK
// ────────────────────────────────────────────────────
function RiskBlock({ d }) {
  return (
    <div style={{ padding: '20px 24px 0' }}>
      <div className="eyebrow" style={{ marginBottom: 12 }}>IMPULSE RISK · 30 DAYS</div>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 14 }}>
        {/* arc */}
        <div style={{ width: 178, marginLeft: -14, marginBottom: -10 }}>
          <RiskArc score={d.riskScore} size={178}/>
        </div>
        {/* annotations */}
        <div style={{ flex: 1, minWidth: 0, paddingBottom: 10 }}>
          <div className="italic-display" style={{ fontSize: 22, lineHeight: 1.12, color: 'var(--ink)', letterSpacing: -0.2 }}>
            mild risk —
          </div>
          <div className="italic-display" style={{ fontSize: 16, lineHeight: 1.25, color: 'var(--ink-soft)', fontWeight: 500, marginTop: 4 }}>
            watch your<br/>Thursdays.
          </div>
        </div>
      </div>
    </div>
  );
}

function StatsRow({ d }) {
  const cells = [
    { label: 'SPENT', value: `€${d.spent}` },
    { label: 'PURCHASES', value: d.purchases },
    { label: 'TOP MOOD', value: d.topEmotion, italic: true, color: EMOTION_COLORS[d.topEmotion] },
  ];
  return (
    <div style={{ padding: '8px 24px 0' }}>
      <div style={{ borderTop: '1px solid var(--rule)', margin: '14px 0 12px' }}/>
      <div style={{ display: 'flex', gap: 8 }}>
        {cells.map((c, i) => (
          <div key={i} style={{ flex: 1 }}>
            <div className="eyebrow" style={{ marginBottom: 5 }}>{c.label}</div>
            <div style={{
              fontSize: 24, fontWeight: 400, lineHeight: 1,
              fontFamily: 'Playfair Display, Georgia, serif',
              fontStyle: c.italic ? 'italic' : 'normal',
              color: c.color || 'var(--ink)',
            }}>
              {c.value}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────
// FINDING ROW (free section)
// ────────────────────────────────────────────────────
function FindingRow({ f, last }) {
  const color = EMOTION_COLORS[f.emo];
  const [open, setOpen] = useStateI(false);
  return (
    <div style={{
      borderBottom: last ? 'none' : '1px solid var(--rule-soft)',
    }}>
      <button onClick={() => setOpen(o => !o)} style={{
        width: '100%', boxSizing: 'border-box',
        display: 'flex', alignItems: 'flex-start', gap: 10,
        background: 'transparent', border: 'none', padding: '14px 0',
        textAlign: 'left', cursor: 'pointer', fontFamily: 'inherit',
      }}>
        <div style={{ width: 3, alignSelf: 'stretch', minHeight: 28, borderRadius: 2, background: color, flexShrink: 0, marginTop: 2 }}/>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink)', lineHeight: 1.3 }}>
            {f.title}
          </div>
          <div style={{
            fontSize: 12.5, color: 'var(--ink-soft)',
            fontFamily: 'Playfair Display', fontStyle: 'italic',
            marginTop: 4, lineHeight: 1.4,
            maxHeight: open ? 200 : 0,
            overflow: 'hidden',
            transition: 'max-height 320ms ease',
          }}>
            {f.body}
          </div>
        </div>
        <svg width="14" height="14" viewBox="0 0 24 24" style={{
          marginTop: 4, flexShrink: 0,
          transform: open ? 'rotate(180deg)' : 'rotate(0)',
          transition: 'transform 200ms ease',
        }}>
          <path d="M6 9 L12 15 L18 9" stroke="var(--ink-soft)" strokeWidth="1.6" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </button>
    </div>
  );
}

function FindingsList({ findings }) {
  return (
    <div style={{ padding: '0 24px' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between',
                    paddingBottom: 6, borderBottom: '1px solid var(--paper-edge)', marginTop: 22 }}>
        <span className="italic-display" style={{ fontSize: 22 }}>what we found</span>
        <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 10, color: 'var(--ink-mute)' }}>
          {findings.length} signals
        </span>
      </div>
      <div>
        {findings.map((f, i) => (
          <FindingRow key={i} f={f} last={i === findings.length - 1}/>
        ))}
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────
// PREMIUM CARD WRAPPER
// Locked = renders preview behind a veil + unlock button
// Unlocked = renders content cleanly
// ────────────────────────────────────────────────────
function PremiumCard({ title, subtitle, locked, onUnlock, children, denseHeader }) {
  return (
    <div style={{
      position: 'relative', marginTop: 14,
      padding: '14px 16px 16px',
      background: 'var(--panel)',
      border: '1px solid var(--rule)',
      borderRadius: 18,
      overflow: 'hidden',
    }}>
      {/* corner ornament */}
      <span aria-hidden="true" style={{
        position: 'absolute', top: 10, right: 10, width: 18, height: 18,
        opacity: 0.5,
      }}>
        <svg viewBox="0 0 24 24" width="18" height="18">
          <path d="M12 2 L13 9 L20 10 L13 11 L12 18 L11 11 L4 10 L11 9 Z" fill="var(--purple)"/>
        </svg>
      </span>

      <div style={{
        display: 'flex', alignItems: 'baseline', gap: 8,
        marginBottom: denseHeader ? 6 : 10,
      }}>
        <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--ink)' }}>{title}</div>
      </div>
      {subtitle && (
        <div style={{
          fontFamily: 'Playfair Display', fontStyle: 'italic', fontSize: 12,
          color: 'var(--ink-soft)', marginTop: -6, marginBottom: 12, lineHeight: 1.4,
        }}>{subtitle}</div>
      )}

      <div style={{
        position: 'relative',
        filter: locked ? 'blur(5px) saturate(0.85)' : 'none',
        opacity: locked ? 0.65 : 1,
        pointerEvents: locked ? 'none' : 'auto',
        transition: 'filter 260ms ease, opacity 260ms ease',
      }}>
        {children}
      </div>

      {locked && (
        <div style={{
          position: 'absolute', inset: 0,
          display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
          padding: 14,
          background: 'linear-gradient(180deg, rgba(250,246,239,0.10) 0%, rgba(250,246,239,0.70) 65%, rgba(250,246,239,0.95) 100%)',
        }}>
          <button onClick={onUnlock} style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            padding: '9px 16px', borderRadius: 999,
            border: '1px solid rgba(126,100,179,0.45)',
            background: 'rgba(255,253,247,0.92)',
            color: 'var(--purple-deep)',
            fontFamily: 'Inter', fontSize: 12.5, fontWeight: 600, letterSpacing: 0.3,
            cursor: 'pointer',
            boxShadow: '0 4px 12px rgba(126,100,179,0.16)',
            backdropFilter: 'blur(6px)',
          }}>
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
              <rect x="5" y="11" width="14" height="10" rx="2"/>
              <path d="M8 11 V8 a4 4 0 0 1 8 0 V11"/>
            </svg>
            Unlock with Premium
          </button>
        </div>
      )}
    </div>
  );
}

// ────────────────────────────────────────────────────
// DEEPER ANALYSIS SECTION (premium-only viz)
// ────────────────────────────────────────────────────
function DeeperAnalysis({ d, premium, onUnlock }) {
  return (
    <div style={{ padding: '24px 24px 0' }}>
      <div style={{
        display: 'flex', alignItems: 'baseline', justifyContent: 'space-between',
        paddingBottom: 6, borderBottom: '1px solid var(--paper-edge)',
      }}>
        <span className="italic-display" style={{ fontSize: 22 }}>deeper analysis</span>
        <span style={{
          display: 'inline-flex', alignItems: 'center', gap: 5,
          fontFamily: 'JetBrains Mono, monospace', fontSize: 9.5, letterSpacing: 0.6,
          color: premium ? '#5F7A4F' : 'var(--purple-deep)',
        }}>
          <span style={{
            width: 5, height: 5, borderRadius: '50%',
            background: premium ? '#5F7A4F' : 'var(--purple-deep)',
            boxShadow: premium ? '0 0 0 0 currentColor' : 'none',
            animation: premium ? 'pulse-purple 2s ease infinite' : 'none',
          }}/>
          {premium ? 'PREMIUM · ACTIVE' : 'LOCKED'}
        </span>
      </div>

      {/* CARD 1 — Emotion ↔ Spend correlation */}
      <PremiumCard
        title="Emotion–spend correlation"
        subtitle="Pearson r between mood intensity and purchase amount."
        locked={!premium} onUnlock={onUnlock}>
        <CorrelationScatter points={d.scatter} r={0.62}/>
        <div style={{ marginTop: 6, fontFamily: 'Playfair Display', fontStyle: 'italic', fontSize: 12, color: 'var(--ink-soft)' }}>
          A moderate positive correlation: as stress rises, so does the amount you spend.
        </div>
      </PremiumCard>

      {/* CARD 2 — Behavioral fingerprint */}
      <PremiumCard
        title="Your spending fingerprint"
        subtitle="Vector clustering across 8 emotion dimensions — uniquely yours."
        locked={!premium} onUnlock={onUnlock}>
        <div style={{ display: 'flex', justifyContent: 'center' }}>
          <Fingerprint values={d.fingerprint}/>
        </div>
      </PremiumCard>

      {/* CARD 3 — Weekly rhythm */}
      <PremiumCard
        title="Weekly rhythm"
        subtitle="Spend per day across the past four weeks, coloured by dominant emotion."
        locked={!premium} onUnlock={onUnlock}>
        <WeeklyPulse data={d.weekly} peakDay={d.weeklyPeak}/>
        <div style={{ marginTop: 10, padding: '8px 10px', borderRadius: 8, background: 'rgba(155,130,201,0.10)',
                      fontFamily: 'Playfair Display', fontStyle: 'italic', fontSize: 12, color: 'var(--ink)' }}>
          Thursday is your highest-risk day — average spend{' '}
          <span style={{ fontWeight: 700 }}>€89</span> with{' '}
          <span style={{ color: EMOTION_COLORS.stress, fontWeight: 700 }}>stress</span> dominant.
        </div>
      </PremiumCard>

      {/* CARD 4 — Merchant vulnerability */}
      <PremiumCard
        title="Merchant vulnerability"
        subtitle="Places you are most likely to overspend at, given your mood."
        locked={!premium} onUnlock={onUnlock}>
        {d.vulnerable.map((v, i) => (
          <VulnRow key={i} {...v} last={i === d.vulnerable.length - 1}/>
        ))}
      </PremiumCard>

      {/* CARD 5 — Late-night ring */}
      <PremiumCard
        title="Circadian map"
        subtitle="Where your impulse purchases cluster across the 24-hour day."
        locked={!premium} onUnlock={onUnlock}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <HourRing hours={d.hours}/>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="italic-display" style={{ fontSize: 16, lineHeight: 1.25, color: 'var(--ink)' }}>
              Most of your risky spending happens between{' '}
              <span style={{ color: 'var(--purple-deep)' }}>20:00 and 22:00</span>.
            </div>
            <div style={{ fontFamily: 'Playfair Display', fontStyle: 'italic', fontSize: 12, color: 'var(--ink-soft)', marginTop: 6 }}>
              Setting a 21:00 reminder could prevent ~3 impulse purchases / week.
            </div>
          </div>
        </div>
      </PremiumCard>

      {/* CARD 6 — Predictive alert */}
      <PremiumCard
        title="Next high-risk session"
        subtitle="Predicted from your last 90 days of behaviour."
        locked={!premium} onUnlock={onUnlock} denseHeader>
        <div style={{
          padding: '12px 14px',
          background: 'rgba(155,130,201,0.10)',
          borderRadius: 12,
          border: '1px dashed rgba(126,100,179,0.40)',
        }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
            <span style={{ fontFamily: 'Playfair Display, Georgia, serif', fontSize: 22, color: 'var(--purple-deep)' }}>
              Thursday
            </span>
            <span className="italic-display" style={{ fontSize: 14, color: 'var(--ink-soft)' }}>21:00 — 23:00</span>
          </div>
          <div style={{ marginTop: 6, fontFamily: 'Playfair Display', fontStyle: 'italic', fontSize: 13, color: 'var(--ink)', lineHeight: 1.4 }}>
            Probability of an impulse session: <span style={{ fontWeight: 700, color: 'var(--purple-deep)' }}>72%</span>.
            We will nudge you 20 minutes before it begins.
          </div>
        </div>
      </PremiumCard>
    </div>
  );
}

// ────────────────────────────────────────────────────
// PREMIUM PILL (bottom CTA bar — only when not premium)
// ────────────────────────────────────────────────────
function PremiumPill({ onClick }) {
  return (
    <button onClick={onClick} style={{
      position: 'absolute', left: 16, right: 16, bottom: 108,
      padding: '12px 14px 12px 16px', borderRadius: 18,
      border: 'none', cursor: 'pointer',
      background: 'linear-gradient(180deg, rgba(255,251,243,0.92) 0%, rgba(245,238,224,0.88) 100%)',
      backdropFilter: 'blur(18px) saturate(150%)',
      WebkitBackdropFilter: 'blur(18px) saturate(150%)',
      boxShadow: [
        '0 14px 32px rgba(31,27,22,0.14)',
        '0 2px 6px rgba(31,27,22,0.06)',
        'inset 0 1px 0 rgba(255,255,255,0.85)',
        'inset 0 0 0 1px rgba(126,100,179,0.18)',
      ].join(', '),
      display: 'flex', alignItems: 'center', gap: 12,
      textAlign: 'left',
      zIndex: 20,
    }}>
      <div style={{
        width: 36, height: 36, borderRadius: 12,
        background: 'radial-gradient(circle at 30% 25%, #B9A2DE 0%, #9B82C9 55%, #7E64B3 100%)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.5), 0 6px 14px rgba(126,100,179,0.30)',
        flexShrink: 0,
      }}>
        <svg width="18" height="18" viewBox="0 0 24 24">
          <path d="M12 2 L13 9 L20 10 L13 11 L12 18 L11 11 L4 10 L11 9 Z" fill="#fff"/>
        </svg>
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div className="italic-display" style={{ fontSize: 16, lineHeight: 1.1, color: 'var(--ink)' }}>
          unlock the full report
        </div>
        <div style={{ fontFamily: 'Inter', fontSize: 11, color: 'var(--ink-soft)', marginTop: 2 }}>
          vector analysis · behavioral clusters · €1.99/mo
        </div>
      </div>
      <svg width="18" height="18" viewBox="0 0 24 24">
        <path d="M9 6 L15 12 L9 18" stroke="var(--purple-deep)" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    </button>
  );
}

// ────────────────────────────────────────────────────
// FOOTNOTE (premium only — replaces upgrade pill)
// ────────────────────────────────────────────────────
function Footnote() {
  return (
    <div style={{
      padding: '0 24px 18px', marginTop: 22,
      fontFamily: 'Playfair Display', fontStyle: 'italic',
      fontSize: 11, color: 'var(--ink-mute)', textAlign: 'center', lineHeight: 1.5,
    }}>
      Scores reflect your patterns — not judgements.<br/>
      Awared is here to help you understand the feeling,<br/>not shame the purchase.
    </div>
  );
}

// ────────────────────────────────────────────────────
// APP
// ────────────────────────────────────────────────────
const INS_DEFAULTS = /*EDITMODE-BEGIN*/{
  "premium": false,
  "showPaywall": false,
  "period": "Last 30 days"
}/*EDITMODE-END*/;

function InsightsApp() {
  const [t, setTweak] = useTweaks(INS_DEFAULTS);
  const [premium, setPremium] = useStateI(t.premium);
  const [paywallOpen, setPaywallOpen] = useStateI(t.showPaywall);

  // sync external tweak changes → state
  useEffectI(() => { setPremium(t.premium); }, [t.premium]);
  useEffectI(() => { setPaywallOpen(t.showPaywall); }, [t.showPaywall]);

  const openPaywall = () => { setPaywallOpen(true); setTweak('showPaywall', true); };
  const closePaywall = () => { setPaywallOpen(false); setTweak('showPaywall', false); };
  const unlockPremium = () => {
    setPremium(true);
    setTweak({ premium: true, showPaywall: false });
    setPaywallOpen(false);
  };

  const d = INS_DATA;

  return (
    <>
      <InsightFrame>
        {/* Scrolling content */}
        <div style={{ flex: 1, overflowY: 'auto', minHeight: 0 }} className="no-scroll">
          <InsHeader premium={premium} period={t.period}/>
          <RiskBlock d={d}/>
          <StatsRow d={d}/>
          <FindingsList findings={d.findings}/>
          <DeeperAnalysis d={d} premium={premium} onUnlock={openPaywall}/>
          {premium ? <Footnote/> : <div style={{ height: 96 }}/>}
        </div>

        {/* Floating upgrade pill (free only) */}
        {!premium && <PremiumPill onClick={openPaywall}/>}

        {/* Bottom nav */}
        <Footer active="insight" onAdd={() => { window.location.href = 'Log Expense.html'; }}/>

        {/* Paywall */}
        <PaywallSheet open={paywallOpen} onClose={closePaywall} onUnlock={unlockPremium}/>
      </InsightFrame>

      {/* Tweaks */}
      <TweaksPanel title="Insights tweaks">
        <TweakSection label="Mode">
          <TweakToggle
            label="Premium unlocked"
            value={t.premium}
            onChange={(v) => setTweak('premium', v)}/>
          <TweakToggle
            label="Show paywall"
            value={t.showPaywall}
            onChange={(v) => setTweak('showPaywall', v)}/>
        </TweakSection>
        <TweakSection label="Copy">
          <TweakSelect
            label="Period"
            value={t.period}
            onChange={(v) => setTweak('period', v)}
            options={['Last 7 days', 'Last 30 days', 'Last 90 days', 'This year']}/>
        </TweakSection>
      </TweaksPanel>
    </>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<InsightsApp/>);
