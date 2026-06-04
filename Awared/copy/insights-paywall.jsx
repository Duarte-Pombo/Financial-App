// Paywall — editorial premium upsell sheet.
// Slides from the bottom, cream paper, Playfair headline, comparison table.

const { useEffect: useEffectPW, useState: useStatePW } = React;

const PW_ROWS = [
  { free: 'Impulse risk score',     pro: 'Vector behavioral fingerprint', highlight: true },
  { free: 'Emotion pattern flags',  pro: 'Pearson correlation engine' },
  { free: 'Category breakdown',     pro: 'Merchant vulnerability mapping' },
  { free: 'Late-night detection',   pro: 'Weekly rhythm + circadian map' },
  { free: '—',                      pro: 'Predictive risk-session alerts' },
  { free: '—',                      pro: 'Personalised coaching prompts' },
];

function PaywallSheet({ open, onClose, onUnlock }) {
  // mount/unmount with a tiny delay for transitions
  const [mounted, setMounted] = useStatePW(false);
  const [visible, setVisible] = useStatePW(false);
  useEffectPW(() => {
    if (open) {
      setMounted(true);
      requestAnimationFrame(() => setVisible(true));
    } else {
      setVisible(false);
      const t = setTimeout(() => setMounted(false), 320);
      return () => clearTimeout(t);
    }
  }, [open]);
  if (!mounted) return null;

  return (
    <div style={{
      position: 'absolute', inset: 0, zIndex: 50,
      pointerEvents: open ? 'auto' : 'none',
    }}>
      {/* scrim */}
      <div onClick={onClose} style={{
        position: 'absolute', inset: 0,
        background: 'rgba(31,27,22,0.42)',
        backdropFilter: 'blur(2px)',
        WebkitBackdropFilter: 'blur(2px)',
        opacity: visible ? 1 : 0,
        transition: 'opacity 300ms ease',
      }}/>
      {/* sheet */}
      <div style={{
        position: 'absolute', left: 0, right: 0, bottom: 0,
        background: 'var(--bg)',
        borderTopLeftRadius: 32, borderTopRightRadius: 32,
        boxShadow: '0 -16px 40px rgba(31,27,22,0.18)',
        transform: visible ? 'translateY(0)' : 'translateY(100%)',
        transition: 'transform 360ms cubic-bezier(.18,.74,.16,1)',
        overflow: 'hidden',
        paddingBottom: 22,
      }}>
        {/* warm grain top edge */}
        <div style={{
          position: 'absolute', top: 0, left: 0, right: 0, height: 1,
          background: 'linear-gradient(90deg, transparent 0%, rgba(155,130,201,0.45) 50%, transparent 100%)',
        }}/>
        {/* drag handle */}
        <div style={{ display: 'flex', justifyContent: 'center', padding: '10px 0 0' }}>
          <div style={{ width: 36, height: 4, borderRadius: 4, background: 'rgba(31,27,22,0.18)' }}/>
        </div>

        <div style={{ padding: '14px 26px 0' }}>
          {/* small premium ribbon */}
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            padding: '6px 12px', borderRadius: 999,
            background: 'rgba(126,100,179,0.10)',
            border: '1px solid rgba(126,100,179,0.30)',
          }}>
            <svg width="12" height="12" viewBox="0 0 24 24">
              <path d="M12 2 L13 9 L20 10 L13 11 L12 18 L11 11 L4 10 L11 9 Z" fill="var(--purple-deep)"/>
            </svg>
            <span style={{
              fontFamily: 'Inter', fontSize: 10, letterSpacing: 2,
              color: 'var(--purple-deep)', fontWeight: 600,
            }}>AWARED PREMIUM</span>
          </div>

          {/* headline */}
          <div className="italic-display" style={{
            fontSize: 32, lineHeight: 1.08, letterSpacing: -0.4,
            color: 'var(--ink)', marginTop: 14, textWrap: 'pretty',
          }}>
            See <span style={{ color: 'var(--purple-deep)' }}>why</span><br/>
            you spend — not<br/>just <span style={{ textDecoration: 'underline', textDecorationStyle: 'wavy', textDecorationColor: 'rgba(155,130,201,0.6)', textUnderlineOffset: 4 }}>that</span> you did.
          </div>

          <div style={{ marginTop: 12, fontSize: 13.5, color: 'var(--ink-soft)',
                        fontFamily: 'Playfair Display', fontStyle: 'italic', lineHeight: 1.45 }}>
            Powered by vector similarity, Pearson correlation, and behavioral
            clustering — not rule-based flags.
          </div>

          {/* comparison table */}
          <div style={{
            marginTop: 22,
            borderTop: '1px solid var(--rule)',
            borderBottom: '1px solid var(--rule)',
          }}>
            {/* header row */}
            <div style={{
              display: 'grid', gridTemplateColumns: '1fr 1fr',
              padding: '10px 0',
              borderBottom: '1px solid var(--rule)',
            }}>
              <div className="eyebrow" style={{ color: 'var(--ink-mute)' }}>FREE</div>
              <div className="eyebrow" style={{ color: 'var(--purple-deep)', letterSpacing: 1.8 }}>
                ✦ &nbsp;PREMIUM
              </div>
            </div>
            {PW_ROWS.map((r, i) => (
              <div key={i} style={{
                display: 'grid', gridTemplateColumns: '1fr 1fr',
                padding: '9px 0',
                borderBottom: i < PW_ROWS.length - 1 ? '1px solid var(--rule-soft)' : 'none',
                animation: `float-up 380ms ease ${120 + i * 50}ms backwards`,
              }}>
                <div style={{
                  fontSize: 12.5, color: r.free === '—' ? 'var(--ink-mute)' : 'var(--ink-soft)',
                  fontFamily: 'Playfair Display', fontStyle: r.free === '—' ? 'italic' : 'normal',
                }}>{r.free}</div>
                <div style={{
                  fontSize: 12.5, color: 'var(--purple-deep)', fontWeight: 600,
                  fontFamily: 'Playfair Display',
                }}>{r.pro}</div>
              </div>
            ))}
          </div>

          {/* price line */}
          <div style={{
            display: 'flex', alignItems: 'baseline', gap: 8,
            marginTop: 18, marginBottom: 6,
          }}>
            <span style={{ fontFamily: 'Playfair Display, Georgia, serif', fontSize: 38, fontWeight: 500, lineHeight: 1, color: 'var(--ink)' }}>
              €1.99
            </span>
            <span className="italic-display" style={{ fontSize: 16, color: 'var(--ink-soft)' }}>/ month</span>
            <span style={{ marginLeft: 'auto', fontSize: 10.5, letterSpacing: 1.4, color: 'var(--ink-mute)' }}>
              CANCEL ANYTIME
            </span>
          </div>

          {/* CTA */}
          <button onClick={onUnlock} style={{
            width: '100%', marginTop: 12,
            padding: '15px 16px', borderRadius: 14,
            border: 'none', cursor: 'pointer',
            background: 'radial-gradient(120% 140% at 30% 20%, #B9A2DE 0%, #9B82C9 45%, #7E64B3 100%)',
            color: '#fff',
            fontSize: 15.5, fontWeight: 600, letterSpacing: 0.3,
            fontFamily: 'Inter',
            boxShadow: '0 14px 28px rgba(126,100,179,0.34), inset 0 1px 0 rgba(255,255,255,0.4)',
            position: 'relative', overflow: 'hidden',
          }}>
            Unlock Awared Premium
            {/* shimmer */}
            <span aria-hidden="true" style={{
              position: 'absolute', inset: 0, pointerEvents: 'none',
              background: 'linear-gradient(110deg, transparent 30%, rgba(255,255,255,0.30) 50%, transparent 70%)',
              backgroundSize: '200% 100%',
              animation: 'shimmer 2.6s linear infinite',
            }}/>
          </button>

          <button onClick={onClose} style={{
            display: 'block', margin: '12px auto 0',
            background: 'transparent', border: 'none', cursor: 'pointer',
            fontFamily: 'Playfair Display', fontStyle: 'italic', fontSize: 13.5,
            color: 'var(--ink-soft)',
          }}>maybe later</button>
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { PaywallSheet });
