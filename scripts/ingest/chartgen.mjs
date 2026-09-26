// HD SVG generators for pie & bar charts (data-driven, theme-neutral, print-clean).
// Exported helpers used by chartbuild.mjs.
export const PALETTE = ['#4f46e5', '#e07b39', '#9aa0a6', '#d4a017', '#3aa17e', '#c0392b', '#5b8def', '#8e6fc4'];
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

export function pieSVG({ title, slices, mode = 'percent' }) {
  // slices: [{label, value, color?}]  mode: percent|degree|raw
  const W = 760, H = 460, cx = 250, cy = 250, r = 180;
  const total = mode === 'degree' ? 360 : slices.reduce((a, s) => a + s.value, 0);
  let a0 = -90, paths = '', labels = '';
  const pol = (rr, deg) => [cx + rr * Math.cos(deg * Math.PI / 180), cy + rr * Math.sin(deg * Math.PI / 180)];
  slices.forEach((s, i) => {
    const frac = (mode === 'degree' ? s.value / 360 : s.value / total);
    const a1 = a0 + frac * 360;
    const [x0, y0] = pol(r, a0), [x1, y1] = pol(r, a1);
    const large = frac > 0.5 ? 1 : 0;
    const col = s.color || PALETTE[i % PALETTE.length];
    paths += `<path d="M${cx},${cy} L${x0.toFixed(1)},${y0.toFixed(1)} A${r},${r} 0 ${large} 1 ${x1.toFixed(1)},${y1.toFixed(1)} Z" fill="${col}" stroke="#fff" stroke-width="2"/>`;
    const mid = (a0 + a1) / 2, [lx, ly] = pol(r * 0.62, mid);
    const val = mode === 'degree' ? `${s.value}°` : mode === 'raw' ? `${s.value}` : `${s.value}%`;
    labels += `<text x="${lx.toFixed(1)}" y="${(ly - 6).toFixed(1)}" font-family="Arial" font-size="16" font-weight="700" fill="#fff" text-anchor="middle" dominant-baseline="central">${esc(s.label)}</text>`;
    labels += `<text x="${lx.toFixed(1)}" y="${(ly + 12).toFixed(1)}" font-family="Arial" font-size="15" font-weight="700" fill="#fff" text-anchor="middle" dominant-baseline="central">${val}</text>`;
    a0 = a1;
  });
  let leg = '';
  slices.forEach((s, i) => { const ly = 70 + i * 34, col = s.color || PALETTE[i % PALETTE.length];
    leg += `<rect x="500" y="${ly}" width="22" height="22" rx="4" fill="${col}"/><text x="532" y="${ly + 16}" font-family="Arial" font-size="17" fill="#1e293b">${esc(s.label)}</text>`; });
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" font-family="Arial, sans-serif"><rect width="${W}" height="${H}" fill="#fff"/>` +
    (title ? `<text x="${cx}" y="34" font-size="21" font-weight="700" fill="#0f172a" text-anchor="middle">${esc(title)}</text>` : '') +
    paths + labels + leg + `</svg>`;
}

export function barSVG({ title, categories, series, ylabel, showValues = true }) {
  // series: [{name, color?, values:[...]}]
  const W = 820, H = 470, mL = 70, mR = 150, mT = 54, mB = 70;
  const plotW = W - mL - mR, plotH = H - mT - mB;
  const maxV = Math.max(...series.flatMap((s) => s.values));
  const rough = maxV / 5, mag = Math.pow(10, Math.floor(Math.log10(rough)));
  const frac = rough / mag, step = (frac <= 1 ? 1 : frac <= 2 ? 2 : frac <= 5 ? 5 : 10) * mag;
  const niceMax = Math.ceil(maxV / step) * step, ticks = Math.round(niceMax / step);
  const y = (v) => mT + plotH - (v / niceMax) * plotH;
  const nCat = categories.length, groupW = plotW / nCat, barW = Math.min(46, (groupW * 0.7) / series.length);
  let grid = '';
  for (let t = 0; t <= ticks; t++) { const v = step * t, yy = y(v);
    grid += `<line x1="${mL}" y1="${yy}" x2="${mL + plotW}" y2="${yy}" stroke="#e2e8f0" stroke-width="1"/><text x="${mL - 8}" y="${yy + 4}" font-size="12" fill="#64748b" text-anchor="end">${Math.round(v)}</text>`; }
  let bars = '', xlab = '';
  categories.forEach((cat, ci) => {
    const gx = mL + ci * groupW, totalBarsW = barW * series.length, start = gx + (groupW - totalBarsW) / 2;
    series.forEach((s, si) => { const bx = start + si * barW, val = s.values[ci], col = s.color || PALETTE[si % PALETTE.length];
      bars += `<rect x="${bx.toFixed(1)}" y="${y(val).toFixed(1)}" width="${(barW - 3).toFixed(1)}" height="${(mT + plotH - y(val)).toFixed(1)}" fill="${col}"/>`;
      if (showValues) bars += `<text x="${(bx + (barW - 3) / 2).toFixed(1)}" y="${(y(val) - 4).toFixed(1)}" font-size="11" font-weight="700" fill="#334155" text-anchor="middle">${val}</text>`; });
    xlab += `<text x="${(gx + groupW / 2).toFixed(1)}" y="${mT + plotH + 20}" font-size="13" fill="#1e293b" text-anchor="middle">${esc(cat)}</text>`;
  });
  let leg = '';
  series.forEach((s, i) => { const lx = mL + plotW + 20, ly = mT + 10 + i * 26, col = s.color || PALETTE[i % PALETTE.length];
    leg += `<rect x="${lx}" y="${ly}" width="18" height="18" rx="3" fill="${col}"/><text x="${lx + 24}" y="${ly + 14}" font-size="14" fill="#1e293b">${esc(s.name)}</text>`; });
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" font-family="Arial, sans-serif"><rect width="${W}" height="${H}" fill="#fff"/>` +
    (title ? `<text x="${W / 2}" y="30" font-size="19" font-weight="700" fill="#0f172a" text-anchor="middle">${esc(title)}</text>` : '') +
    grid + bars + xlab +
    (ylabel ? `<text x="18" y="${mT + plotH / 2}" font-size="13" fill="#334155" text-anchor="middle" transform="rotate(-90 18 ${mT + plotH / 2})">${esc(ylabel)}</text>` : '') +
    `<line x1="${mL}" y1="${mT + plotH}" x2="${mL + plotW}" y2="${mT + plotH}" stroke="#334155" stroke-width="1.5"/>` + leg + `</svg>`;
}
