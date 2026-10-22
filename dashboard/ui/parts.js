/* מנועי הגרפים והעיצוב, מתוך מעבדת שפת העיצוב של מור. בלי נתונים של קריאייטלי. נוצר ב-08.10.2026 */

/* קבוצה ב׳: גרפים לאורך זמן. כאן גם שני המנועים: TC לקווים ושטחים, vbars לעמודות */
(function () {
  const LAB = (window.LAB = window.LAB || []), R = (window.R = window.R || {});
  const { ic, n, n1, k, ils, pill, delta } = K;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

  /* ===== מנוע קווים ושטחים ===== */
  K.tc = (el, w, c) => {
    const h = c.h || 230, pr = c.padR ?? 44, pl = c.padL ?? 8, pt = c.padT ?? 14, pb = c.padB ?? 28;
    const N = c.x.length, iw = w - pl - pr, ih = h - pt - pb;
    const vals = c.series.flatMap((s) => s.v).concat(c.band ? c.band.hi : []);
    const nz = K.nice(c.ymax || Math.max(...vals) * 1.06, c.ticks || 4);
    const X = (i) => pl + (N === 1 ? iw / 2 : (i * iw) / (N - 1));
    const Y = K.lin(0, nz.max, pt + ih, pt);
    const g = K.yGrid(nz.ticks, Y, pl, pl + iw, c.yfmt);
    const fmt = c.fmt || n;
    let defs = '', body = '';
    const colw = Math.max(14, (iw / (N - 1 || 1)) * 0.9);
    if (c.column) body += `<rect class="tc-col" y="${pt - 6}" height="${ih + 6}" width="${colw}" rx="9" style="fill:var(--a1);opacity:0;transition:x .12s"/>`;
    if (c.band) {
      const hi = c.band.hi.map((v, i) => [X(i), Y(v)]), lo = c.band.lo.map((v, i) => [X(i), Y(v)]).reverse();
      body += `<path d="${K.smooth(hi)} ${K.smooth(lo).replace(/^M/, 'L')} Z" style="fill:${c.band.color || 'var(--a1)'};opacity:${c.band.op || 0.1}"/>`;
    }
    c.series.forEach((s) => {
      const pts = s.v.map((v, i) => [X(i), Y(v)]);
      const d = (s.straight ? K.straight : K.smooth)(pts);
      if (s.area) {
        const id = K.id('ar');
        defs += `<linearGradient id="${id}" x1="0" x2="0" y1="0" y2="1"><stop offset="0" style="stop-color:${s.areaColor || s.color};stop-opacity:${s.areaOp ?? 0.22}"/><stop offset="1" style="stop-color:${s.areaColor || s.color};stop-opacity:0"/></linearGradient>`;
        body += `<path d="${d} L${X(N - 1)},${pt + ih} L${X(0)},${pt + ih} Z" fill="url(#${id})"/>`;
      }
      let stroke = `style="stroke:${s.color}"`;
      if (s.grad) {
        const id = K.id('lg');
        defs += `<linearGradient id="${id}" gradientUnits="userSpaceOnUse" x1="${pl}" x2="${pl + iw}" y1="0" y2="0">${s.grad.map((col, j) => `<stop offset="${j / (s.grad.length - 1)}" style="stop-color:${col}"/>`).join('')}</linearGradient>`;
        stroke = `stroke="url(#${id})"`;
      }
      if (s.width !== 0) body += `<path d="${d}" fill="none" ${stroke} stroke-width="${s.width || 2.4}" ${s.dash ? `stroke-dasharray="${s.dash}"` : ''} stroke-linecap="round" stroke-linejoin="round"/>`;
      if (s.endDot) {
        const p = pts[N - 1];
        body += `<circle cx="${p[0]}" cy="${p[1]}" r="9" style="fill:${s.endColor || s.color};opacity:.16"/><circle cx="${p[0]}" cy="${p[1]}" r="4.5" style="fill:var(--card);stroke:${s.endColor || s.color}" stroke-width="2.5"/>`;
      }
    });
    const cross = c.cross !== false ? `<line class="tc-x" y1="${pt}" y2="${pt + ih}" style="stroke:${c.crossColor || 'var(--ink)'};opacity:0" stroke-width="1" stroke-dasharray="${c.crossDash ?? '3 3'}"/>` : '';
    const dots = c.series.map((s, si) => (s.noDot ? '' : `<circle class="tc-d" data-s="${si}" r="5" style="fill:var(--card);stroke:${s.endColor || s.color};opacity:0" stroke-width="2.5"/>`)).join('');
    const every = c.every || Math.ceil(N / Math.max(2, Math.floor(iw / 62)));
    const xl = c.x.map((l, i) => (i % every === 0 ? `<span class="k-xl" data-i="${i}" style="left:${X(i)}px;top:${pt + ih + 9}px">${l}</span>` : '')).join('');
    el.style.height = h + 'px';
    el.innerHTML = `<svg width="${w}" height="${h}"><defs>${defs}</defs>${c.grid === false ? '' : g.lines}${body}${cross}${dots}<rect class="hit" x="${pl}" y="${pt}" width="${iw}" height="${ih}"/></svg>${c.grid === false || c.yHide ? '' : g.labels}${xl}<div class="k-tip ${c.tip === 'light' ? 'w' : ''}"></div>`;
    const tip = el.querySelector('.k-tip'), xh = el.querySelector('.tc-x'), col = el.querySelector('.tc-col');
    const tipHtml = c.tipHtml || ((i) => `<div class="tt">${(c.xFull || c.x)[i]}</div>${c.series.filter((s) => s.name).map((s) => `<div class="tr"><span><i style="background:${s.endColor || s.color}"></i>${s.name}</span><b class="n">${fmt(s.v[i])}</b></div>`).join('')}`);
    const show = (i) => {
      const x = X(i);
      if (xh) { xh.setAttribute('x1', x); xh.setAttribute('x2', x); xh.style.opacity = c.crossOp ?? 0.35; }
      if (col) { col.setAttribute('x', x - colw / 2); col.style.opacity = 0.07; }
      el.querySelectorAll('.tc-d').forEach((d) => { const s = c.series[+d.dataset.s]; d.setAttribute('cx', x); d.setAttribute('cy', Y(s.v[i])); d.style.opacity = 1; });
      el.querySelectorAll('.k-xl').forEach((l) => l.classList.toggle('on', +l.dataset.i === i));
      if (c.tip !== false) {
        tip.innerHTML = tipHtml(i);
        K.placeTip(tip, x, Math.min(...c.series.map((s) => Y(s.v[i]))), pl + iw);
        tip.classList.add('on');
      }
      c.onShow && c.onShow(i);
    };
    const hide = () => {
      if (c.active != null) return show(c.active);
      if (xh) xh.style.opacity = 0;
      if (col) col.style.opacity = 0;
      el.querySelectorAll('.tc-d').forEach((d) => (d.style.opacity = 0));
      el.querySelectorAll('.k-xl').forEach((l) => l.classList.remove('on'));
      tip.classList.remove('on');
    };
    const hit = el.querySelector('.hit');
    hit.addEventListener('mousemove', (e) => {
      const r = el.getBoundingClientRect();
      show(clamp(Math.round(((e.clientX - r.left - pl) / iw) * (N - 1)), 0, N - 1));
    });
    hit.addEventListener('mouseleave', hide);
    if (c.active != null) show(c.active);
    return { X, Y, pt, ih, iw, pl };
  };

  /* ===== מנוע עמודות ===== */
  K.vbars = (el, w, c) => {
    const h = c.h || 220, pr = c.padR ?? 44, pl = c.padL ?? 4, pt = c.padT ?? 30, pb = c.padB ?? 28;
    const N = c.v.length, iw = w - pl - pr, ih = h - pt - pb;
    const nz = K.nice(c.ymax || Math.max(...c.v, ...(c.v2 || [0])) * 1.04, c.ticks || 4);
    const Y = K.lin(0, nz.max, pt + ih, pt);
    const slot = iw / N, bw = Math.max(2, slot * (c.fill ?? 0.6)), X = (i) => pl + slot * i + (slot - bw) / 2;
    const g = K.yGrid(nz.ticks, Y, pl, pl + iw, c.yfmt);
    const color = c.color || ((i, a) => (i === a ? 'var(--a1)' : 'var(--gray)'));
    let active = c.active ?? null;
    const shape = (x, y, bw2, hh) => (c.pill ? `<rect x="${x}" y="${y}" width="${bw2}" height="${Math.max(hh, bw2 * 0.2)}" rx="${Math.min(bw2 / 2, hh / 2)}"` : `<path d="${K.rbar(x, y, bw2, hh, c.round ?? Math.min(6, bw2 / 2))}"`);
    let body = '';
    c.v.forEach((v, i) => {
      if (c.track) body += `${shape(X(i), pt, bw, ih)} style="fill:var(--track)"/>`;
      if (c.v2) { const w2 = c.w2 ?? bw; body += `${shape(X(i) - (w2 - bw) / 2, Y(c.v2[i]), w2, pt + ih - Y(c.v2[i]))} class="vb2" style="fill:${c.color2 || 'var(--a1s)'}"/>`; }
      body += `${shape(X(i), Y(v), bw, pt + ih - Y(v))} class="vb" data-i="${i}" style="fill:${color(i, active)};transition:fill .16s"/>`;
    });
    const every = c.every || Math.ceil(N / Math.max(2, Math.floor(iw / 46)));
    const xl = (c.x || []).map((l, i) => (i % every === 0 ? `<span class="k-xl" data-i="${i}" style="left:${X(i) + bw / 2}px;top:${pt + ih + 9}px">${l}</span>` : '')).join('');
    el.style.height = h + 'px';
    el.innerHTML = `<svg width="${w}" height="${h}">${c.grid === false ? '' : g.lines}${c.extra ? c.extra({ X, Y, bw, pt, ih, iw, pl, slot }) : ''}${body}<rect class="hit" x="${pl}" y="${pt - 20}" width="${iw}" height="${ih + 20}"/></svg>${c.grid === false || c.yHide ? '' : g.labels}${xl}<div class="vb-bub" style="position:absolute;transform:translate(-50%,calc(-100% - 8px));pointer-events:none;transition:left .16s,top .16s"></div><div class="k-tip ${c.tip === 'light' ? 'w' : ''}"></div>`;
    const bub = el.querySelector('.vb-bub'), tip = el.querySelector('.k-tip');
    const paint = () => {
      el.querySelectorAll('.vb').forEach((b) => (b.style.fill = color(+b.dataset.i, active)));
      el.querySelectorAll('.k-xl').forEach((l) => l.classList.toggle('on', +l.dataset.i === active));
      if (c.bubble && active != null) {
        bub.innerHTML = c.bubble(active);
        bub.style.left = X(active) + bw / 2 + 'px';
        bub.style.top = Math.min(Y(c.v[active]), c.v2 ? Y(c.v2[active]) : 1e9) + 'px';
        bub.style.opacity = 1;
      } else bub.style.opacity = 0;
      if (c.tipHtml && active != null && (c.tipAlways || active !== c.active)) {
        tip.innerHTML = c.tipHtml(active);
        const ty = Math.min(Y(c.v[active]), c.v2 ? Y(c.v2[active]) : 1e9);
        if (c.tipSide) {
          const flip = X(active) + bw + 10 + tip.offsetWidth > pl + iw;
          tip.classList.add('side'); tip.classList.toggle('flip', flip);
          tip.style.left = (flip ? X(active) - 10 : X(active) + bw + 10) + 'px';
          tip.style.top = (ty + (pt + ih)) / 2 + 'px';
        } else K.placeTip(tip, X(active) + bw / 2, ty, pl + iw);
        tip.classList.add('on');
      } else tip.classList.remove('on');
      c.onShow && c.onShow(active);
    };
    const hit = el.querySelector('.hit');
    if (c.hover !== false) {
      hit.addEventListener('mousemove', (e) => {
        const r = el.getBoundingClientRect();
        const i = clamp(Math.floor((e.clientX - r.left - pl) / slot), 0, N - 1);
        if (i !== active) { active = i; paint(); }
      });
      hit.addEventListener('mouseleave', () => { active = c.active ?? null; paint(); });
    }
    paint();
    return { X, Y, bw, pt, ih };
  };

  const css = `<style>
  .b-head{display:flex;justify-content:space-between;align-items:flex-start;gap:14px;flex-wrap:wrap;margin-bottom:16px}
  .b-num{display:flex;gap:10px;align-items:center;margin-top:6px;flex-wrap:wrap}
  .b6{display:grid;grid-template-columns:270px minmax(0,1fr);gap:28px;align-items:stretch}
  .b6 .side{border-left:1px solid var(--line);padding-left:24px;display:flex;flex-direction:column}
  .b6 .kv{display:flex;justify-content:space-between;padding:9px 0;border-top:1px dashed var(--line2);font-size:13px}
  .b6 .kv:first-of-type{margin-top:auto}
  .vb-bub .bb{background:var(--ink);color:var(--card);font-size:12px;font-weight:700;padding:3px 8px;border-radius:7px;white-space:nowrap;position:relative}
  .vb-bub .bb::after{content:'';position:absolute;left:50%;bottom:-4px;transform:translateX(-50%) rotate(45deg);width:8px;height:8px;background:inherit;border-radius:1px}
  .vb-bub .bb.acc{background:var(--a1)}
  .b8-mark{position:absolute;transform:translateX(-50%);font-size:11.5px;font-weight:600;background:var(--card);border:1px solid var(--line2);border-radius:999px;padding:2px 8px;white-space:nowrap;direction:rtl}
  @media (max-width:760px){.b6{grid-template-columns:minmax(0,1fr)}.b6 .side{border-left:0;padding-left:0}}
  </style>`;
  document.head.insertAdjacentHTML('beforeend', css);
})();

/* קבוצה א׳: כרטיסי מספר */
(function () {
  const LAB = (window.LAB = window.LAB || []), R = (window.R = window.R || {});
  const { ic, n, n1, ils, pill, delta, spark, mbars } = K;
  document.head.insertAdjacentHTML('beforeend', `<style>
  .a1 .top-r{display:flex;justify-content:space-between;align-items:center}
  .a1 .who{display:flex;gap:10px;align-items:center}
  .a1 .big{margin-top:18px}
  .a1 .ft1{display:flex;gap:8px;align-items:center;margin-top:10px}
  .a2{display:flex;padding:0}
  .a2 .sg{flex:1;min-width:0;padding:18px 20px 0;display:flex;flex-direction:column}
  .a2 .sg+.sg{border-right:1px solid var(--line)}
  .a2 .mid{display:flex;align-items:baseline;gap:8px;margin:8px 0 10px;flex-wrap:wrap}
  .a2 .k-spark{margin-top:auto}
  .a3 .mid{display:flex;align-items:flex-end;justify-content:space-between;gap:16px;margin-top:14px}
  .a3 .k-mbars{width:48%}
  .a4 .hd{display:flex;gap:12px;align-items:center}
  .a4 .bd{display:flex;align-items:flex-end;justify-content:space-between;gap:16px;margin-top:16px}
  .a4 .sk{width:46%;max-width:170px;flex:none}
  @media (max-width:640px){.a4 .bd{flex-direction:column;align-items:stretch}.a4 .sk{width:100%;max-width:none}}
  .a5{padding:0}
  .a5 .in{padding:18px 20px}
  .a5 .ft{border-top:1px solid var(--line);padding:11px 20px;display:flex;justify-content:space-between;align-items:center;font-size:12.5px;color:var(--ink2)}
  .a5 .ft a{color:var(--a1);font-weight:600;text-decoration:none;display:flex;gap:2px;align-items:center}
  .a6 .big2{margin:10px 0 10px}
  .a7{padding:0}
  .a7 .live{display:flex;gap:8px;align-items:center;padding:14px 20px;border-bottom:1px solid var(--line);font-size:13px;font-weight:600}
  .a7 .live i{width:8px;height:8px;border-radius:50%;background:var(--ok);box-shadow:0 0 0 0 rgba(0,168,101,.5);animation:pulse 1.8s infinite}
  @keyframes pulse{0%{box-shadow:0 0 0 0 rgba(0,168,101,.45)}70%{box-shadow:0 0 0 8px rgba(0,168,101,0)}100%{box-shadow:0 0 0 0 rgba(0,168,101,0)}}
  .a7 .ms{display:grid;grid-template-columns:repeat(5,minmax(0,1fr))}
  .a7 .m{padding:16px 20px}
  .a7 .m+.m{border-right:1px solid var(--line)}
  .a7 .m .big{font-size:26px}
  .a7 .m .ln{display:flex;gap:8px;align-items:center;margin-top:4px}
  .a7 .k-pill{border-radius:5px}
  .a8 .tile{background:var(--card);border:1px solid var(--line);border-radius:var(--r);padding:14px 16px 16px;position:relative;min-width:0}
  .a8 .tile .k-pill{position:absolute;top:12px;left:12px}
  .a8 .tile .big{font-size:26px;margin-top:22px}
  .a9 .seg3{display:flex;height:10px;border-radius:99px;overflow:hidden;gap:3px;margin:14px 0 18px}
  .a9 .seg3 i{display:block;height:100%;border-radius:99px}
  .a9 .col{padding-bottom:12px;border-bottom:3px solid;min-width:0}
  .a9 .col .lab{display:flex;gap:6px;align-items:center}
  .a9 .col .lab i{width:8px;height:8px;border-radius:50%}
  .a9 .col .big{font-size:24px;margin:6px 0 2px}
  .a10 .bar{height:12px;border-radius:99px;background:var(--track);position:relative;margin:16px 0 10px;overflow:visible}
  .a10 .bar i{position:absolute;inset:0 0 0 auto;border-radius:99px;background:linear-gradient(270deg,var(--r3),var(--a1))}
  .a10 .bar b{position:absolute;top:-5px;width:2px;height:22px;background:var(--ink);border-radius:2px}
  .a10 .scale{display:flex;justify-content:space-between;font-size:11.5px;color:var(--mute)}
  @media (max-width:1180px){.a7 .ms{grid-template-columns:repeat(3,minmax(0,1fr))}.a7 .m:nth-child(4){border-right:0}}
  @media (max-width:760px){.a3 .mid{flex-direction:column;align-items:stretch}.a3 .k-mbars{width:100%}.a2{flex-wrap:wrap}.a2 .sg{flex:1 1 50%}.a2 .sg:nth-child(3){border-right:0}.a7 .ms{grid-template-columns:repeat(2,minmax(0,1fr))}.a7 .m:nth-child(n){border-right:0}}
  </style>`);
})();

/* קבוצה ח׳: כפתורים ומבנה. קבוצה ט׳: מסכים שלמים שבנויים מהרכיבים */
(function () {
  const LAB = (window.LAB = window.LAB || []), R = (window.R = window.R || {});
  const { ic, n, ils, pill, av, mbars } = K;

  document.head.insertAdjacentHTML('beforeend', `<style>
  .h1 .bar{display:flex;justify-content:space-between;align-items:center;gap:14px;flex-wrap:wrap}
  .h1 .acts{display:flex;gap:8px;align-items:center;flex-wrap:wrap;position:relative}
  .h1 .pop{position:absolute;top:calc(100% + 6px);right:0;background:var(--card);border:1px solid var(--line2);border-radius:12px;box-shadow:0 14px 34px rgba(20,21,26,.14);padding:6px;width:220px;z-index:6;display:none}
  .h1 .pop.on{display:block}
  .h1 .pop button{display:flex;justify-content:space-between;width:100%;border:0;background:none;padding:8px 10px;border-radius:8px;cursor:pointer;font-size:13px;text-align:right}
  .h1 .pop button:hover{background:var(--bg)}
  .h1 .pop button.on{background:var(--a1p);color:var(--a1d);font-weight:600}
  .h1 .flt{display:flex;gap:6px;flex-wrap:wrap;margin-top:14px;padding-top:14px;border-top:1px solid var(--line)}
  .h1 .fc{display:flex;gap:6px;align-items:center;background:var(--bg);border:1px solid var(--line2);border-radius:8px;padding:4px 6px 4px 10px;font-size:12.5px}
  .h1 .fc b{font-weight:600}
  .h1 .fc .x{cursor:pointer;color:var(--mute);display:flex}
  .h1 .tog{width:30px;height:18px;border-radius:99px;background:var(--a1);position:relative;flex:none}
  .h1 .tog::after{content:'';position:absolute;top:2px;left:2px;width:14px;height:14px;border-radius:50%;background:var(--card);transition:left .16s}
  .h1 .tog.off{background:var(--gray2)} .h1 .tog.off::after{left:14px}
  .h2 .bigtabs{display:flex;gap:4px;background:var(--card);border:1px solid var(--line);border-radius:14px;padding:5px;overflow-x:auto}
  .h2 .bigtabs button{flex:1;border:0;background:none;border-radius:10px;padding:10px 14px;display:flex;gap:8px;align-items:center;justify-content:center;cursor:pointer;font-weight:500;color:var(--ink2);white-space:nowrap;transition:background .16s,color .16s}
  .h2 .bigtabs button .cnt{font-size:11px;background:var(--track);border-radius:99px;padding:0 7px;font-weight:600}
  .h2 .bigtabs button.on{background:var(--a1);color:var(--on-a1)}
  .h2 .bigtabs button.on .cnt{background:color-mix(in srgb,currentColor 22%,transparent);color:inherit}
  .h3 .vrow{display:flex;justify-content:space-between;align-items:center;gap:14px;padding:13px 0;flex-wrap:wrap}
  .h3 .vrow+.vrow{border-top:1px dashed var(--line2)}
  .h3 .dd{display:inline-flex;gap:8px;align-items:center;border:1px solid var(--line2);border-radius:9px;padding:6px 10px;font-size:13px;background:var(--card);cursor:pointer}
  .h4wrap{display:flex;gap:16px;align-items:stretch}
  .h4{width:248px;flex:none;background:var(--card);border:1px solid var(--line);border-radius:var(--r);padding:14px 12px;display:flex;flex-direction:column;gap:4px;transition:width .2s;overflow:hidden}
  .h4.mini{width:68px}
  .h4 .logo{display:flex;gap:10px;align-items:center;padding:4px 6px 12px;justify-content:space-between}
  .h4 .lg{display:flex;gap:9px;align-items:center;font-weight:800;font-size:16px;white-space:nowrap}
  .h4 .lg i{width:30px;height:30px;border-radius:9px;background:var(--a1);color:var(--on-a1);display:flex;align-items:center;justify-content:center;font-style:normal;font-size:15px;flex:none}
  .h4 .sec{font-size:11px;color:var(--mute);font-weight:600;padding:12px 10px 4px;white-space:nowrap}
  .h4 a{display:flex;gap:10px;align-items:center;padding:8px 10px;border-radius:9px;text-decoration:none;color:var(--ink2);font-size:13.5px;font-weight:500;white-space:nowrap;cursor:pointer;transition:background .16s}
  .h4 a:hover{background:var(--bg)}
  .h4 a.on{background:var(--a1p);color:var(--a1d);font-weight:600}
  .h4 a .bd{margin-right:auto;font-size:11px;font-weight:700;border-radius:99px;padding:0 7px;background:var(--track);color:var(--ink2)}
  .h4 a .bd.r{background:var(--bad);color:#fff}
  .h4 a .beta{margin-right:auto;font-size:10px;font-weight:800;border-radius:5px;padding:1px 5px;background:var(--purplebg);color:var(--purple)}
  .h4 a .kbd{margin-right:auto}
  .h4.mini .t,.h4.mini .bd,.h4.mini .beta,.h4.mini .kbd,.h4.mini .sec,.h4.mini .lg span,.h4.mini .inp span,.h4.mini .me div{display:none}
  .h4.mini .inp{justify-content:center;padding:7px 0}
  .h4 .me{margin-top:auto;display:flex;gap:10px;align-items:center;border-top:1px solid var(--line);padding:12px 6px 2px}
  .h4fake{flex:1;min-width:0;display:flex;flex-direction:column;gap:12px}
  .h4fake .k{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px}
  .h4fake .b{background:var(--card);border:1px solid var(--line);border-radius:var(--r);padding:12px}
  .h4fake .l{height:9px;border-radius:5px;background:var(--track)}
  .h4fake .note{color:var(--mute);font-size:12.5px;line-height:1.5;text-align:center;padding:4px 10px}
  .h5 .q{display:flex;gap:10px;align-items:center;border:1.5px solid var(--a1);border-radius:12px;padding:10px 12px;background:var(--card);box-shadow:0 0 0 4px var(--a1p)}
  .h5 .q input{flex:1;border:0;outline:0;font:inherit;font-size:14px;background:transparent;min-width:0}
  .h5 .sug{display:flex;gap:6px;flex-wrap:wrap;margin:12px 0 16px}
  .h5 .sug button{border:1px solid var(--line2);background:var(--card);border-radius:99px;padding:6px 12px;font-size:12.5px;cursor:pointer;display:flex;gap:6px;align-items:center;color:var(--ink2)}
  .h5 .sug button:hover{border-color:var(--a1);color:var(--a1d)}
  .h5 .ans{background:var(--bg);border-radius:12px;padding:14px 16px}
  .h5 .k-mbars{gap:8px;max-width:360px}
  .h5 .k-mbars i{border-radius:5px}
  .h5 .me-q{display:inline-block;background:var(--ink);color:var(--card);border-radius:12px 12px 4px 12px;padding:8px 12px;font-size:13px;margin-bottom:10px}
  .h6 .crumbs{display:flex;gap:6px;align-items:center;font-size:12.5px;color:var(--mute)}
  .h6 .ttl{display:flex;justify-content:space-between;align-items:flex-end;gap:16px;margin:8px 0 16px;flex-wrap:wrap}
  .h6 h2{margin:0;font-size:26px;font-weight:800;display:flex;gap:10px;align-items:center}
  .h7 .blk{padding:14px 0}
  .h7 .blk+.blk{border-top:1px dashed var(--line2)}
  .h7 .blk>.lab{margin-bottom:10px;display:block}
  .h7 .wr{display:flex;gap:8px;flex-wrap:wrap;align-items:center}
  .h7 .sw{display:flex;flex-direction:column;gap:6px;font-size:11px;color:var(--mute);width:72px}
  .h7 .sw i{height:42px;border-radius:10px;display:block;border:1px solid rgba(0,0,0,.05)}
  .h7 .stack{display:flex;direction:ltr}
  .h7 .stack .k-av{border:2px solid var(--card);margin-left:-8px}
  .h7 .stack .k-av:first-child{margin-left:0}
  .h7 .tipdemo{position:relative;display:inline-block;background:var(--ink);color:var(--card);border-radius:9px;padding:7px 11px;font-size:12px}
  .h7 .tipdemo.w{background:var(--card);color:var(--ink);border:1px solid var(--line);box-shadow:0 8px 22px rgba(20,21,26,.12)}
  .h8 .sk{background:linear-gradient(90deg,var(--track) 0%,var(--card) 40%,var(--track) 80%);background-size:300% 100%;animation:shim 1.4s infinite linear;border-radius:7px}
  @keyframes shim{0%{background-position:100% 0}100%{background-position:0 0}}
  .h8 .empty{display:flex;flex-direction:column;align-items:center;text-align:center;gap:10px;padding:18px 10px}
  .h8 .empty .ill{width:64px;height:64px;border-radius:18px;background:var(--a1p);color:var(--a1);display:flex;align-items:center;justify-content:center;border:1px dashed var(--r2)}
  .scr{border:1px solid var(--line2);border-radius:16px;overflow:hidden;background:var(--bg);box-shadow:0 20px 50px rgba(20,21,26,.08)}
  .scr .chrome{display:flex;gap:6px;align-items:center;padding:10px 14px;background:var(--card);border-bottom:1px solid var(--line)}
  .scr .chrome i{width:10px;height:10px;border-radius:50%;background:var(--gray)}
  .scr .chrome span{margin:0 auto;font-size:12px;color:var(--mute);background:var(--bg);border-radius:7px;padding:3px 40px}
  .scr .body{display:flex;gap:18px;padding:18px;align-items:flex-start}
  .scr .main{flex:1;min-width:0;display:flex;flex-direction:column;gap:18px}
  .scr .two{display:grid;gap:18px}
  .scr .two>*{min-width:0}
  .scr .topnav{display:flex;gap:16px;align-items:center;background:var(--card);border-bottom:1px solid var(--line);padding:12px 18px;flex-wrap:wrap}
  @media (max-width:1180px){.scr .two{grid-template-columns:minmax(0,1fr)!important}.scr .h4{display:none}}
  @media (max-width:760px){.h4wrap{flex-direction:column}.h4{width:100%}.h4fake{display:none}}
  </style>`);
})();

/* קבוצה ג׳: עמודות. קבוצה ד׳: משפכים */
(function () {
  const LAB = (window.LAB = window.LAB || []), R = (window.R = window.R || {});
  const { ic, n, n1, k, ils, pill, delta } = K;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  document.head.insertAdjacentHTML('beforeend', `<style>
  .c-head{display:flex;justify-content:space-between;align-items:flex-start;gap:14px;flex-wrap:wrap;margin-bottom:14px}
  .c5 .r{display:grid;grid-template-columns:76px minmax(0,1fr) 64px;gap:14px;align-items:center;padding:9px 0}
  .c5 .bw{display:flex;align-items:center;gap:10px}
  .c5 .bw .bar{flex:none}
  .c5 .r+.r{border-top:1px dashed var(--line)}
  .c5 .bar{display:flex;height:26px;border-radius:7px;overflow:hidden;gap:2px}
  .c5 .bar i{display:flex;align-items:center;padding:0 8px;font-size:11.5px;font-weight:600;font-style:normal;white-space:nowrap;overflow:hidden}
  .c5 .bar i.a{background:var(--a1);color:var(--on-a1);border-radius:7px 0 0 7px}
  .c5 .bar i.b{background:var(--a1s);color:var(--a1d);border-radius:0 0 0 0}
  .c5 .bar i:first-child{border-radius:0 7px 7px 0}
  .c5 .bar i:last-child{border-radius:7px 0 0 7px}
  .c5 .nm{font-weight:600}
  .c5 .vv{text-align:left}
  .d1-lab{position:absolute;top:0;direction:rtl;text-align:center;transform:translateX(-50%);white-space:nowrap}
  .d1-lab .s{font-size:12px;color:var(--mute);font-weight:500}
  .d1-lab .v{font-size:22px;font-weight:700;margin-top:2px}
  .d1-cv{position:absolute;transform:translate(-50%,-50%);background:var(--card);border:1px solid var(--line2);border-radius:999px;padding:2px 8px;font-size:11.5px;font-weight:700;box-shadow:0 2px 8px rgba(20,21,26,.08);white-space:nowrap}
  .d2 .st{display:grid;grid-template-columns:30px minmax(120px,170px) minmax(0,1fr) 64px 70px 70px;gap:14px;align-items:center;padding:12px 0}
  .d2 .st+.st{border-top:1px solid var(--line)}
  .d2 .no{width:28px;height:28px;border-radius:50%;background:var(--a1s);color:var(--a1d);display:flex;align-items:center;justify-content:center;font-weight:700;font-size:12.5px}
  .d2 .hbar{height:10px}
  .d2 .vv{font-weight:700;font-size:16px;text-align:left}
  .d2 .cv{font-size:12px;color:var(--mute);text-align:left}
  .d2 .hd{font-size:11.5px;color:var(--mute);padding-bottom:6px}
  @media (max-width:760px){.d2 .st{grid-template-columns:26px minmax(0,1fr) 54px 60px}.d2 .st .hbar,.d2 .st .dl{display:none}.c5 .r{grid-template-columns:60px minmax(0,1fr) 46px}}
  </style>`);
})();

/* קבוצה ז׳: רשימות וטבלאות */
(function () {
  const LAB = (window.LAB = window.LAB || []), R = (window.R = window.R || {});
  const { ic, n, n1, ils, pill, av } = K;

  document.head.insertAdjacentHTML('beforeend', `<style>
  .g-who{display:flex;gap:10px;align-items:center;min-width:0}
  .g-who b{font-weight:600}
  .g-thumb{width:38px;height:38px;border-radius:9px;display:flex;align-items:center;justify-content:center;flex:none}
  .g-chk{width:16px;height:16px;border:1.5px solid var(--gray2);border-radius:4px;display:inline-block;vertical-align:middle}
  .g-chk.on{background:var(--a1);border-color:var(--a1);position:relative}
  .g-chk.on::after{content:'';position:absolute;left:4px;top:1px;width:4px;height:8px;border:solid var(--card);border-width:0 2px 2px 0;transform:rotate(45deg)}
  .g-mini{display:flex;gap:8px;align-items:center;min-width:120px}
  .g-mini .hbar{flex:1;height:6px}
  .g-pg{display:flex;justify-content:space-between;align-items:center;margin-top:12px;font-size:12.5px;color:var(--mute)}
  .g3 .it{display:grid;grid-template-columns:36px minmax(0,1fr) auto;gap:12px;align-items:center;padding:11px 0;position:relative}
  .g3 .it+.it{border-top:1px solid var(--line)}
  .g3 .ico{width:36px;height:36px;border-radius:50%;display:flex;align-items:center;justify-content:center}
  .g3 .tx{font-size:13.5px;line-height:1.4}
  .g3 .tx b{font-weight:700}
  .g3 .tx .sub{display:block;margin-top:1px}
  .g4 .it{display:grid;grid-template-columns:38px minmax(0,1fr) auto auto;gap:12px;align-items:center;padding:10px 0}
  .g4 .it+.it{border-top:1px dashed var(--line2)}
  .g4 .hbar{height:5px;margin-top:6px}
  .g5 .hd{display:flex;justify-content:space-between;font-size:11.5px;color:var(--mute);padding:12px 0 6px;font-weight:500}
  .g5 .it{position:relative;display:grid;grid-template-columns:minmax(0,1fr) 70px 54px;gap:10px;align-items:center;padding:8px 10px;border-radius:7px;font-size:13px;margin-bottom:3px}
  .g5 .it .bg{position:absolute;inset:0 0 0 auto;background:var(--a1);opacity:.08;border-radius:7px;transition:width .3s}
  .g5 .it>*{position:relative}
  .g5 .it .t{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
  .g5 .it .t small{color:var(--mute);margin-right:6px;font-size:11.5px;direction:ltr;unicode-bidi:isolate}
  .g5 .it .p{color:var(--mute);text-align:left;font-size:12px}
  .g6 .it{display:grid;grid-template-columns:30px minmax(0,1fr) 70px 110px;gap:12px;align-items:center;padding:10px 0}
  .g6 .it+.it{border-top:1px solid var(--line)}
  .g6 .rk{width:26px;height:26px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:12px;background:var(--track);color:var(--ink2)}
  .g6 .rk.m1{background:#ffd76a;color:#7a5600}.g6 .rk.m2{background:#e2e5eb;color:#4a4f5c}.g6 .rk.m3{background:#f3c6a5;color:#7a3e12}
  .g6 .dots{display:flex;gap:4px;direction:ltr;justify-content:flex-end}
  .g6 .dots i{width:12px;height:12px;border-radius:4px;background:var(--track)}
  .g6 .dots i.on{background:var(--a1)}
  @media (max-width:760px){.g6 .it{grid-template-columns:28px minmax(0,1fr) 90px}.g6 .it .w{display:none}}
  </style>`);
})();
