/* ערכת עזר לכל הרכיבים: אייקונים, פורמט מספרים, סקאלות, קווים חלקים, ציור לפי רוחב אמיתי. */
(function () {
  const P = window.ICON_PATHS;
  Object.assign(P, {
    'plus': '<path d="M5 12h14"/><path d="M12 5v14"/>',
    'ellipsis': '<circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/><circle cx="5" cy="12" r="1"/>',
    'gift': '<rect x="3" y="8" width="18" height="4" rx="1"/><path d="M12 8v13"/><path d="M19 12v7a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2v-7"/><path d="M7.5 8a2.5 2.5 0 0 1 0-5A4.8 8 0 0 1 12 8a4.8 8 0 0 1 4.5-5 2.5 2.5 0 0 1 0 5"/>',
    'house': '<path d="M15 21v-8a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v8"/><path d="M3 10a2 2 0 0 1 .709-1.528l7-5.999a2 2 0 0 1 2.582 0l7 5.999A2 2 0 0 1 21 10v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>',
    'arrow-down-right': '<path d="m7 7 10 10"/><path d="M17 7v10H7"/>',
    'funnel': '<path d="M10 20a1 1 0 0 0 .553.895l2 1A1 1 0 0 0 14 21v-7a2 2 0 0 1 .517-1.341L21.74 4.67A1 1 0 0 0 21 3H3a1 1 0 0 0-.742 1.67l7.225 7.989A2 2 0 0 1 10 14z"/>',
    'arrow-up-down': '<path d="m21 16-4 4-4-4"/><path d="M17 20V4"/><path d="m3 8 4-4 4 4"/><path d="M7 4v16"/>',
    'download': '<path d="M12 15V3"/><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="m7 10 5 5 5-5"/>',
    'panel': '<rect width="18" height="18" x="3" y="3" rx="2"/><path d="M15 3v18"/>',
    'user': '<path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>',
    'chart-bar': '<path d="M3 3v16a2 2 0 0 0 2 2h16"/><path d="M18 17V9"/><path d="M13 17V5"/><path d="M8 17v-3"/>',
    'help': '<circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><path d="M12 17h.01"/>',
    'moon': '<path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/>',
    'bell': '<path d="M10.268 21a2 2 0 0 0 3.464 0"/><path d="M3.262 15.326A1 1 0 0 0 4 17h16a1 1 0 0 0 .74-1.673C19.41 13.956 18 12.499 18 8A6 6 0 0 0 6 8c0 4.499-1.411 5.956-2.738 7.326"/>',
    'settings': '<path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/>',
  });

  const K = {};
  K.ic = (name, size = 16, sw = 1.9) =>
    `<svg class="ic" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${P[name] || ''}</svg>`;

  /* מספרים: תמיד בכיוון שמאל לימין ומבודדים מהעברית שמסביב */
  const nf = new Intl.NumberFormat('en-US');
  const nf1 = new Intl.NumberFormat('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  const nf2 = new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  K.n = (v) => nf.format(Math.round(v));
  K.n1 = (v) => nf1.format(v);
  K.n2 = (v) => nf2.format(v);
  K.k = (v) => (v >= 1000 ? nf1.format(v / 1000).replace(/\.0$/, '') + 'K' : nf.format(Math.round(v)));
  K.ils = (v, dec) => '₪' + (dec ? nf2.format(v) : nf.format(Math.round(v)));
  K.num = (txt, cls = '') => `<span class="n ${cls}">${txt}</span>`;

  /* תג שינוי: חץ למעלה ירוק, חץ למטה אדום. inverse = כשירידה היא דבר טוב */
  K.pill = (d, opt = {}) => {
    const up = d >= 0;
    const good = opt.inverse ? !up : up;
    const arrow = opt.noArrow ? '' : K.ic(up ? 'arrow-up-right' : 'arrow-down-right', 12, 2.4);
    const txt = (opt.sign ? (up ? '+' : '−') : '') + K.n1(Math.abs(d)) + '%';
    return `<span class="k-pill ${good ? 'up' : 'down'} ${opt.cls || ''}">${arrow}<span>${txt}</span></span>`;
  };
  K.delta = (cur, prev) => (prev ? ((cur - prev) / prev) * 100 : 0);
  /* אחוזים שלמים שמסתכמים בדיוק ל-100 (שיטת השארית הגדולה) */
  K.pct100 = (vals) => {
    const tot = vals.reduce((a, b) => a + b, 0) || 1, raw = vals.map((v) => (v / tot) * 100), out = raw.map(Math.floor);
    let left = 100 - out.reduce((a, b) => a + b, 0);
    raw.map((r, i) => [r - out[i], i]).sort((a, b) => b[0] - a[0]).forEach(([, i]) => { if (left > 0) { out[i]++; left--; } });
    return out;
  };

  K.lin = (d0, d1, r0, r1) => (v) => r0 + ((v - d0) / (d1 - d0 || 1)) * (r1 - r0);

  /* מקסימום עגול לציר וחמש שנתות */
  K.nice = (max, n = 4) => {
    if (max <= 0) return { max: 1, ticks: [0, 1] };
    /* בוחר את הצעד שנותן את התקרה הכי קרובה למקסימום, עם 3 עד 6 קווים */
    const mag0 = Math.pow(10, Math.floor(Math.log10(max / n)));
    let best = null;
    [mag0 / 10, mag0, mag0 * 10].forEach((mag) => [1, 2, 2.5, 5].forEach((m) => {
      const s = m * mag, t = Math.ceil(max / s) * s, cnt = t / s;
      if (cnt < 3 || cnt > 6 || (s < 1 && max > 6)) return;
      if (!best || t < best[1] - 1e-9 || (Math.abs(t - best[1]) < 1e-9 && cnt < best[2])) best = [s, t, cnt];
    }));
    const step = best ? best[0] : max / n;
    const top = best ? best[1] : max;
    const ticks = [];
    for (let t = 0; t <= top + 1e-9; t += step) ticks.push(+t.toFixed(6));
    return { max: top, ticks };
  };

  /* קו חלק (מונוטוני) שלא עובר את הנקודות */
  K.smooth = (pts) => {
    if (pts.length < 2) return '';
    const n = pts.length, dx = [], dy = [], m = [], t = [];
    for (let i = 0; i < n - 1; i++) { dx[i] = pts[i + 1][0] - pts[i][0]; dy[i] = pts[i + 1][1] - pts[i][1]; m[i] = dy[i] / dx[i]; }
    t[0] = m[0]; t[n - 1] = m[n - 2];
    for (let i = 1; i < n - 1; i++) t[i] = m[i - 1] * m[i] <= 0 ? 0 : (m[i - 1] + m[i]) / 2;
    for (let i = 0; i < n - 1; i++) {
      if (m[i] === 0) { t[i] = 0; t[i + 1] = 0; continue; }
      const a = t[i] / m[i], b = t[i + 1] / m[i], s = a * a + b * b;
      if (s > 9) { const k = 3 / Math.sqrt(s); t[i] = k * a * m[i]; t[i + 1] = k * b * m[i]; }
    }
    let d = `M${pts[0][0]},${pts[0][1]}`;
    for (let i = 0; i < n - 1; i++) {
      const h = dx[i] / 3;
      d += ` C${pts[i][0] + h},${pts[i][1] + t[i] * h} ${pts[i + 1][0] - h},${pts[i + 1][1] - t[i + 1] * h} ${pts[i + 1][0]},${pts[i + 1][1]}`;
    }
    return d;
  };
  K.straight = (pts) => pts.map((p, i) => (i ? 'L' : 'M') + p[0] + ',' + p[1]).join(' ');

  /* מצייר לפי הרוחב האמיתי של הקופסה, ומצייר שוב כשהרוחב משתנה */
  K.mount = (el, draw) => {
    let last = -1;
    const run = () => { const w = Math.round(el.clientWidth); if (w && w !== last) { last = w; draw(el, w); } };
    new ResizeObserver(run).observe(el);
    requestAnimationFrame(run);
  };

  let uid = 0;
  K.id = (p = 'g') => p + (++uid);

  /* ציר y בצד ימין עם קווים מקווקווים, תוויות ב-HTML כדי שעברית ומספרים לא יתבלבלו */
  K.yGrid = (ticks, y, x0, x1, fmt) => {
    const lines = ticks.map((t) => `<line x1="${x0}" x2="${x1}" y1="${y(t)}" y2="${y(t)}" class="k-grid${t === 0 ? ' zero' : ''}"/>`).join('');
    const labels = ticks.map((t) => `<span class="k-yl" style="top:${y(t)}px;left:${x1 + 8}px">${fmt ? fmt(t) : K.k(t)}</span>`).join('');
    return { lines, labels };
  };

  /* טולטיפ: לא יוצא מהגרף, לא מכסה את הציר, ויורד מתחת לנקודה כשאין מקום למעלה */
  K.placeTip = (tip, x, y, maxX) => {
    tip.classList.remove('below');
    const tw = tip.offsetWidth, th = tip.offsetHeight;
    tip.style.left = Math.max(tw / 2 + 4, Math.min(maxX - tw / 2 - 4, x)) + 'px';
    tip.style.top = y + 'px';
    if (y - th - 12 < 0) tip.classList.add('below');
  };

  K.seed = (s) => () => { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; };

  /* עמודה עם פינות עגולות רק למעלה */
  K.rbar = (x, y, w, h, r) => {
    if (h <= 0.5) return '';
    r = Math.min(r, w / 2, h);
    return `M${x},${y + h}V${y + r}Q${x},${y} ${x + r},${y}H${x + w - r}Q${x + w},${y} ${x + w},${y + r}V${y + h}Z`;
  };

  /* ספארקליין קטן שנמתח לרוחב הקופסה */
  K.spark = (v, opt = {}) => {
    const h = opt.h || 34, n = v.length, mx = Math.max(...v) || 1, mn = opt.zero ? 0 : Math.min(...v);
    const pts = v.map((x, i) => [(i / (n - 1)) * 100, 3 + (1 - (x - mn) / (mx - mn || 1)) * 24]);
    const d = K.smooth(pts), id = K.id('sp'), col = opt.color || 'var(--a1)';
    const area = opt.area
      ? `<defs><linearGradient id="${id}" x1="0" x2="0" y1="0" y2="1"><stop offset="0" style="stop-color:${col};stop-opacity:.28"/><stop offset="1" style="stop-color:${col};stop-opacity:0"/></linearGradient></defs><path d="${d} L100,30 L0,30 Z" fill="url(#${id})"/>`
      : '';
    return `<svg class="k-spark" viewBox="0 0 100 30" preserveAspectRatio="none" style="height:${h}px">${area}<path d="${d}" fill="none" style="stroke:${col}" stroke-width="${opt.sw || 2}" vector-effect="non-scaling-stroke" stroke-linecap="round"/></svg>`;
  };

  /* עמודות קטנות ב-HTML, הזמן זורם משמאל לימין */
  K.mbars = (v, opt = {}) => {
    const mx = Math.max(...v) || 1, hi = opt.hi ?? v.length - 1;
    return `<div class="k-mbars" style="height:${opt.h || 40}px">${v
      .map((x, i) => `<i style="height:${Math.max(6, (x / mx) * 100)}%" class="${i === hi ? 'on' : ''}"></i>`)
      .join('')}</div>`;
  };

  /* ראשי תיבות וצבע קבוע לאווטאר */
  const AV = ['#ff2e6e', '#a25ddc', '#579bfc', '#2ec4b6', '#fdab3d', '#e2445c', '#00a865', '#6d6af0'];
  K.av = (name, size = 30) => {
    const c = AV[[...name].reduce((a, ch) => a + ch.charCodeAt(0), 0) % AV.length];
    const ini = name.trim().split(/\s+/).slice(0, 2).map((w) => w[0]).join('');
    return `<span class="k-av" style="width:${size}px;height:${size}px;background:${c}1f;color:${c};font-size:${Math.round(size * 0.38)}px">${ini}</span>`;
  };

  K.pct = (a, b) => (b ? (a / b) * 100 : 0);

  window.K = K;
})();
