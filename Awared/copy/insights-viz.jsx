// Editorial data-visualisations for the Insights screen.
// Hand-drawn, paper-feel: thin warm strokes, emotion-tinted accents,
// numbers in Playfair, axis labels in italic.

const { useEffect: useEffectV, useState: useStateV, useRef: useRefV } = React;

// ────────────────────────────────────────────────────
// RISK ARC — hand-drawn gauge from 0 → 10
// ────────────────────────────────────────────────────
function RiskArc({ score = 3.1, max = 10, size = 158 }) {
  // arc spans from -210° to +30° (240° total)
  const cx = size / 2, cy = size / 2 + 10, r = size / 2 - 14;
  const startA = -210, endA = 30;
  const pct = Math.min(1, score / max);
  const valA = startA + (endA - startA) * pct;

  const polar = (a, rad = r) => {
    const rr = (a * Math.PI) / 180;
    return [cx + rr * 0 + rad * Math.cos(rr), cy + rad * Math.sin(rr)];
  };
  const arcPath = (a0, a1) => {
    const [x0, y0] = polar(a0);
    const [x1, y1] = polar(a1);
    const large = a1 - a0 > 180 ? 1 : 0;
    return `M ${x0} ${y0} A ${r} ${r} 0 ${large} 1 ${x1} ${y1}`;
  };

  // dominant emotion → arc color
  const color = score < 2 ? '#5F7A4F' : score < 4 ? '#D4A24C' : score < 7 ? '#B97A5C' : '#9B3A2F';

  // tick marks at 0, 2.5, 5, 7.5, 10
  const ticks = [0, 2.5, 5, 7.5, 10];

  return (
    <svg width={size} height={size * 0.78} viewBox={`0 0 ${size} ${size * 0.78}`} style={{ display: 'block' }}>
      {/* paper rule, full arc */}
      <path d={arcPath(startA, endA)} stroke="rgba(31,27,22,0.12)" strokeWidth="1.4" fill="none" strokeLinecap="round"/>
      {/* value arc */}
      <path d={arcPath(startA, valA)} stroke={color} strokeWidth="2.6" fill="none" strokeLinecap="round"
            style={{ filter: 'drop-shadow(0 1px 0 rgba(155,130,201,0.10))' }}/>
      {/* ticks */}
      {ticks.map((t, i) => {
        const a = startA + (endA - startA) * (t / max);
        const [x0, y0] = polar(a, r + 4);
        const [x1, y1] = polar(a, r - 4);
        return <line key={i} x1={x0} y1={y0} x2={x1} y2={y1} stroke="rgba(31,27,22,0.18)" strokeWidth="1"/>;
      })}
      {/* hand of needle */}
      {(() => {
        const [hx, hy] = polar(valA, r - 2);
        return <>
          <line x1={cx} y1={cy} x2={hx} y2={hy} stroke="var(--ink)" strokeWidth="1.4" strokeLinecap="round"/>
          <circle cx={cx} cy={cy} r="3.2" fill="var(--ink)"/>
        </>;
      })()}
      {/* center text */}
      <text x={cx} y={cy - 18} textAnchor="middle"
            fontFamily="Playfair Display, Georgia, serif" fontSize="34" fontWeight="500" fill="var(--ink)">
        {score.toFixed(1)}
      </text>
      <text x={cx} y={cy - 4} textAnchor="middle"
            fontFamily="Inter" fontSize="9" letterSpacing="1.6" fill="var(--ink-mute)">
        OUT OF 10
      </text>
    </svg>
  );
}

// ────────────────────────────────────────────────────
// WEEKLY PULSE — 7 stacked emotion bars
// ────────────────────────────────────────────────────
function WeeklyPulse({ data, height = 96, peakDay = null }) {
  // data: array of 7 { label, total, dominant }
  const max = Math.max(...data.map(d => d.total), 1);
  return (
    <div style={{ width: '100%' }}>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6, height }}>
        {data.map((d, i) => {
          const h = (d.total / max) * (height - 16);
          const isPeak = peakDay === i;
          const color = EMOTION_COLORS[d.dominant] || 'var(--ink-mute)';
          return (
            <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
              <div style={{ fontFamily: 'Playfair Display, Georgia, serif', fontSize: 10, color: 'var(--ink-mute)' }}>
                {d.total > 0 ? `€${d.total}` : ''}
              </div>
              <div style={{
                width: '70%', height: Math.max(2, h),
                background: color, opacity: d.total === 0 ? 0.15 : 1,
                borderRadius: 1.5,
                boxShadow: isPeak ? `0 0 0 2px var(--bg), 0 0 0 3px ${color}` : 'none',
                transition: 'height 600ms cubic-bezier(.2,.7,.2,1)',
              }}/>
            </div>
          );
        })}
      </div>
      <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
        {data.map((d, i) => (
          <div key={i} style={{
            flex: 1, textAlign: 'center',
            fontFamily: 'Inter', fontSize: 10, letterSpacing: 0.5,
            color: peakDay === i ? EMOTION_COLORS[d.dominant] : 'var(--ink-mute)',
            fontWeight: peakDay === i ? 600 : 400,
          }}>{d.label}</div>
        ))}
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────
// PEARSON CORRELATION SCATTER
// X = mood (calm → stressed), Y = purchase amount
// ────────────────────────────────────────────────────
function CorrelationScatter({ points, r = 0.62 }) {
  // points: { x: 0..1, y: 0..1, emo }
  const W = 290, H = 150, pad = 18;
  const xy = (p) => [pad + p.x * (W - pad * 2), H - pad - p.y * (H - pad * 2)];

  // regression line endpoints (rough, for visual feel)
  const [lx0, ly0] = xy({ x: 0.05, y: 0.05 + r * 0.6 - 0.3 });
  const [lx1, ly1] = xy({ x: 0.95, y: 0.05 + r * 0.6 + 0.4 });

  return (
    <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{ display: 'block' }}>
      {/* axis */}
      <line x1={pad} y1={H - pad} x2={W - pad} y2={H - pad} stroke="rgba(31,27,22,0.18)" strokeWidth="1"/>
      <line x1={pad} y1={pad} x2={pad} y2={H - pad} stroke="rgba(31,27,22,0.18)" strokeWidth="1"/>
      {/* light grid */}
      {[0.25, 0.5, 0.75].map(t => (
        <line key={t} x1={pad} y1={H - pad - t * (H - pad * 2)} x2={W - pad}
              y2={H - pad - t * (H - pad * 2)} stroke="rgba(31,27,22,0.05)" strokeDasharray="2 3"/>
      ))}
      {/* regression line */}
      <line x1={lx0} y1={ly0} x2={lx1} y2={ly1} stroke="var(--purple-deep)" strokeWidth="1.4"
            strokeDasharray="4 3" strokeLinecap="round"/>
      {/* points */}
      {points.map((p, i) => {
        const [x, y] = xy(p);
        return <circle key={i} cx={x} cy={y} r={p.r || 3.4}
                       fill={EMOTION_COLORS[p.emo]} fillOpacity="0.85"
                       stroke="var(--bg)" strokeWidth="1"/>;
      })}
      {/* axis labels */}
      <text x={pad} y={H - 4} fontFamily="Playfair Display" fontStyle="italic" fontSize="10" fill="var(--ink-mute)">calm</text>
      <text x={W - pad} y={H - 4} textAnchor="end" fontFamily="Playfair Display" fontStyle="italic" fontSize="10" fill="var(--ink-mute)">stressed</text>
      <text x={pad + 4} y={pad - 4} fontFamily="Playfair Display" fontStyle="italic" fontSize="10" fill="var(--ink-mute)">amount €</text>
      {/* r value tag */}
      <g transform={`translate(${W - 76}, ${pad + 8})`}>
        <rect x="0" y="0" rx="3" width="62" height="18" fill="var(--purple-soft)"/>
        <text x="6" y="12.5" fontFamily="JetBrains Mono, monospace" fontSize="11" fill="var(--purple-deep)" fontWeight="500">
          r = {r.toFixed(2)}
        </text>
      </g>
    </svg>
  );
}

// ────────────────────────────────────────────────────
// BEHAVIORAL FINGERPRINT — radial polar shape
// 8 emotion axes, each with intensity → forms unique blob
// ────────────────────────────────────────────────────
function Fingerprint({ values, size = 200 }) {
  // values: { emotion: 0..1 } for the 8 emotions
  const cx = size / 2, cy = size / 2;
  const rMax = size / 2 - 24;
  const N = EMOTIONS.length;
  const angle = (i) => -Math.PI / 2 + (i / N) * Math.PI * 2;

  // build polygon for shape
  const pts = EMOTIONS.map((e, i) => {
    const v = values[e] || 0;
    const a = angle(i);
    return [cx + Math.cos(a) * rMax * v, cy + Math.sin(a) * rMax * v];
  });

  // smooth path through points (cubic-ish)
  const pathFrom = (pts) => {
    let d = `M ${pts[0][0].toFixed(1)} ${pts[0][1].toFixed(1)} `;
    for (let i = 0; i < pts.length; i++) {
      const p0 = pts[i];
      const p1 = pts[(i + 1) % pts.length];
      const mx = (p0[0] + p1[0]) / 2, my = (p0[1] + p1[1]) / 2;
      d += `Q ${p0[0].toFixed(1)} ${p0[1].toFixed(1)} ${mx.toFixed(1)} ${my.toFixed(1)} `;
    }
    d += 'Z';
    return d;
  };

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ display: 'block' }}>
      <defs>
        <radialGradient id="fp-fill" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="rgba(155,130,201,0.45)"/>
          <stop offset="100%" stopColor="rgba(155,130,201,0.10)"/>
        </radialGradient>
      </defs>
      {/* concentric rings */}
      {[0.33, 0.66, 1].map(t => (
        <circle key={t} cx={cx} cy={cy} r={rMax * t} fill="none"
                stroke="rgba(31,27,22,0.08)" strokeWidth="1"
                strokeDasharray={t === 1 ? 'none' : '2 3'}/>
      ))}
      {/* axis lines */}
      {EMOTIONS.map((e, i) => {
        const a = angle(i);
        return <line key={e}
                     x1={cx} y1={cy}
                     x2={cx + Math.cos(a) * rMax}
                     y2={cy + Math.sin(a) * rMax}
                     stroke="rgba(31,27,22,0.06)" strokeWidth="1"/>;
      })}
      {/* shape */}
      <path d={pathFrom(pts)} fill="url(#fp-fill)" stroke="var(--purple-deep)" strokeWidth="1.4"
            strokeLinejoin="round"/>
      {/* points */}
      {pts.map((p, i) => (
        <circle key={i} cx={p[0]} cy={p[1]} r="2.4"
                fill={EMOTION_COLORS[EMOTIONS[i]]} stroke="var(--bg)" strokeWidth="1"/>
      ))}
      {/* labels */}
      {EMOTIONS.map((e, i) => {
        const a = angle(i);
        const lx = cx + Math.cos(a) * (rMax + 12);
        const ly = cy + Math.sin(a) * (rMax + 12);
        return <text key={e} x={lx} y={ly} textAnchor="middle" dominantBaseline="middle"
                     fontFamily="Playfair Display" fontStyle="italic" fontSize="10"
                     fill={EMOTION_COLORS[e]} fontWeight="600">{e}</text>;
      })}
    </svg>
  );
}

// ────────────────────────────────────────────────────
// 24-HOUR RING — late-night detection
// ────────────────────────────────────────────────────
function HourRing({ hours, size = 168 }) {
  // hours: array of 24 risk values 0..1
  const cx = size / 2, cy = size / 2;
  const rInner = size / 2 - 30, rOuter = size / 2 - 8;
  const segA = (Math.PI * 2) / 24;

  const arcs = hours.map((v, i) => {
    const a0 = -Math.PI / 2 + i * segA;
    const a1 = a0 + segA;
    const r0 = rInner, r1 = rInner + v * (rOuter - rInner);
    const p0 = [cx + Math.cos(a0) * r0, cy + Math.sin(a0) * r0];
    const p1 = [cx + Math.cos(a1) * r0, cy + Math.sin(a1) * r0];
    const p2 = [cx + Math.cos(a1) * r1, cy + Math.sin(a1) * r1];
    const p3 = [cx + Math.cos(a0) * r1, cy + Math.sin(a0) * r1];
    return { p0, p1, p2, p3, v, i };
  });

  // peak hour
  const peak = hours.reduce((acc, v, i) => v > hours[acc] ? i : acc, 0);

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ display: 'block' }}>
      {/* inner circle */}
      <circle cx={cx} cy={cy} r={rInner - 2} fill="none" stroke="rgba(31,27,22,0.08)" strokeWidth="1"/>
      {/* 6/12/18/24 ticks */}
      {[0, 6, 12, 18].map(h => {
        const a = -Math.PI / 2 + (h / 24) * Math.PI * 2;
        const x = cx + Math.cos(a) * (rOuter + 8);
        const y = cy + Math.sin(a) * (rOuter + 8);
        return <text key={h} x={x} y={y} textAnchor="middle" dominantBaseline="middle"
                     fontFamily="JetBrains Mono, monospace" fontSize="9"
                     fill="var(--ink-mute)">{String(h).padStart(2, '0')}</text>;
      })}
      {arcs.map(a => (
        <path key={a.i}
              d={`M ${a.p0[0]} ${a.p0[1]} L ${a.p1[0]} ${a.p1[1]} L ${a.p2[0]} ${a.p2[1]} L ${a.p3[0]} ${a.p3[1]} Z`}
              fill={a.i === peak ? 'var(--purple-deep)' : 'var(--purple)'}
              fillOpacity={0.25 + a.v * 0.65}/>
      ))}
      <text x={cx} y={cy - 4} textAnchor="middle"
            fontFamily="Playfair Display" fontStyle="italic" fontSize="11"
            fill="var(--ink-mute)">peak at</text>
      <text x={cx} y={cy + 14} textAnchor="middle"
            fontFamily="Playfair Display, Georgia, serif" fontSize="22"
            fill="var(--ink)" fontWeight="500">{String(peak).padStart(2, '0')}:00</text>
    </svg>
  );
}

// ────────────────────────────────────────────────────
// MERCHANT VULNERABILITY ROW
// ────────────────────────────────────────────────────
function VulnRow({ name, pct, emo, last }) {
  const color = EMOTION_COLORS[emo];
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 12,
      padding: '10px 0',
      borderBottom: last ? 'none' : '1px solid var(--rule-soft)',
    }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--ink)' }}>{name}</div>
        <div style={{ fontSize: 11, color: 'var(--ink-soft)', marginTop: 1, fontFamily: 'Playfair Display', fontStyle: 'italic' }}>
          while feeling <span style={{ color, fontWeight: 600 }}>{emo}</span>
        </div>
      </div>
      <div style={{ width: 80, height: 4, background: 'var(--rule-soft)', borderRadius: 2, position: 'relative', overflow: 'hidden' }}>
        <div style={{
          position: 'absolute', left: 0, top: 0, bottom: 0,
          width: `${pct}%`, background: color, borderRadius: 2,
        }}/>
      </div>
      <div style={{ width: 36, textAlign: 'right',
                    fontFamily: 'Playfair Display, Georgia, serif', fontSize: 16, color: 'var(--ink)' }}>
        {pct}%
      </div>
    </div>
  );
}

Object.assign(window, {
  RiskArc, WeeklyPulse, CorrelationScatter, Fingerprint, HourRing, VulnRow
});
