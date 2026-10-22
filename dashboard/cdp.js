/* נבחרת סופטלה — the ONE standard date-range picker (Facebook-style),
   ported 1:1 from the high-ysm dashboard (analytics.js + abandoned.css cdp-*).
   Usage:
     var picker = CDP.create(state, onApply);   // state = {preset, since, until} owned by caller
     html += picker.html();                     // renders the trigger + popup
     picker.wire();                             // after innerHTML
     var r = CDP.calcRange(state);              // -> {since:'YYYY-MM-DD', until:'YYYY-MM-DD'}
*/
window.CDP = (function () {
  // Everything is counted in Asia/Jerusalem. Someone opening the dashboard from
  // another time zone (Thailand is UTC+7) would otherwise ask for tomorrow's
  // date at 1am their time, and the dashboard would come back empty.
  function nowIL() { return new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Jerusalem' })); }
  var DAYS_HE = ['א', 'ב', 'ג', 'ד', 'ה', 'ו', 'ש'];
  var MONTHS_HE = ['ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני', 'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר'];
  var PRESETS = [
    { key: 'today', label: 'היום' }, { key: 'yesterday', label: 'אתמול' },
    { key: 'maximum', label: 'מקסימום' },
    { key: 'last_7_days', label: '7 ימים אחרונים' }, { key: 'last_14_days', label: '14 ימים אחרונים' },
    { key: 'last_30_days', label: '30 ימים אחרונים' },
    { key: 'this_month', label: 'החודש' }, { key: 'last_month', label: 'חודש שעבר' },
    { key: 'last_3_months', label: '3 חודשים אחרונים' }, { key: 'last_6_months', label: '6 חודשים אחרונים' },
    { key: 'this_year', label: 'מתחילת השנה' },
  ];
  function isoOf(d) { return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }
  function calcRange(st) {
    var p = st.preset || 'last_7_days';
    var now = nowIL(); var today = isoOf(now);
    if (p === 'custom') return { since: st.since || today, until: st.until || today };
    if (p === 'today') return { since: today, until: today };
    if (p === 'yesterday') { var y = new Date(now); y.setDate(y.getDate() - 1); return { since: isoOf(y), until: isoOf(y) }; }
    var off = function (n) { var d = new Date(now); d.setDate(d.getDate() - n); return isoOf(d); };
    if (p === 'last_7_days') return { since: off(6), until: today };
    if (p === 'last_14_days') return { since: off(13), until: today };
    if (p === 'last_30_days') return { since: off(29), until: today };
    if (p === 'this_month') return { since: isoOf(new Date(now.getFullYear(), now.getMonth(), 1)), until: today };
    if (p === 'last_month') { var f = new Date(now.getFullYear(), now.getMonth() - 1, 1); var l = new Date(now.getFullYear(), now.getMonth(), 0); return { since: isoOf(f), until: isoOf(l) }; }
    if (p === 'last_3_months') return { since: off(89), until: today };
    if (p === 'last_6_months') return { since: off(182), until: today };
    if (p === 'this_year') return { since: isoOf(new Date(now.getFullYear(), 0, 1)), until: today };
    if (p === 'maximum') return { since: off(729), until: today };
    return { since: off(6), until: today };
  }
  function heDateShort(s) { var p = (s || '').split('-'); return p.length === 3 ? p[2] + '/' + p[1] + '/' + p[0] : s; }

  function create(st, onApply) {
    var el = function (id) { return document.getElementById(id); };
    var dpLeftY, dpLeftM, dpStart = null, dpEnd = null, dpHover = null, dpOpen = false, dpPending = null;

    function triggerLabel() {
      if (st.preset === 'custom' && st.since && st.until) return st.since === st.until ? heDateShort(st.since) : heDateShort(st.since) + ' — ' + heDateShort(st.until);
      var p = PRESETS.find(function (x) { return x.key === st.preset; });
      return p ? p.label : 'בחר טווח';
    }
    function dpMonthHTML(y, m, showPrev, showNext) {
      var today = nowIL(); today.setHours(0, 0, 0, 0);
      var firstDay = new Date(y, m, 1).getDay();
      var daysInMonth = new Date(y, m + 1, 0).getDate();
      var daysInPrev = new Date(y, m, 0).getDate();
      var h = '<div class="cdp-month-head">';
      h += showPrev ? '<button class="cdp-nav" data-nav="-1">❯</button>' : '<span style="width:28px"></span>';
      h += '<div class="cdp-month-title">' + MONTHS_HE[m] + ' ' + y + '</div>';
      h += showNext ? '<button class="cdp-nav" data-nav="1">❮</button>' : '<span style="width:28px"></span>';
      h += '</div><div class="cdp-weekdays">';
      DAYS_HE.forEach(function (d) { h += '<div class="cdp-wd">' + d + '</div>'; });
      h += '</div><div class="cdp-days">';
      for (var i = firstDay - 1; i >= 0; i--) h += '<div class="cdp-day cdp-other">' + (daysInPrev - i) + '</div>';
      for (var d = 1; d <= daysInMonth; d++) {
        var date = new Date(y, m, d); date.setHours(0, 0, 0, 0);
        var iso = y + '-' + String(m + 1).padStart(2, '0') + '-' + String(d).padStart(2, '0');
        var tc = date.getTime() === today.getTime() ? ' cdp-today' : '';
        h += '<div class="cdp-day' + tc + '" data-date="' + iso + '"><span>' + d + '</span></div>';
      }
      var total = firstDay + daysInMonth, rem = total % 7 === 0 ? 0 : 7 - (total % 7);
      for (var x = 1; x <= rem; x++) h += '<div class="cdp-day cdp-other">' + x + '</div>';
      return h + '</div>';
    }
    function dpBuild() {
      var ry = dpLeftM === 11 ? dpLeftY + 1 : dpLeftY, rm = dpLeftM === 11 ? 0 : dpLeftM + 1;
      if (el('cdpMonthL')) el('cdpMonthL').innerHTML = dpMonthHTML(dpLeftY, dpLeftM, true, false);
      if (el('cdpMonthR')) el('cdpMonthR').innerHTML = dpMonthHTML(ry, rm, false, true);
      dpHighlight();
    }
    function dpHighlight() {
      var s = dpStart, e = dpEnd || dpHover, pop = el('cdpPopup'); if (!pop) return;
      pop.querySelectorAll('.cdp-day[data-date]').forEach(function (cell) {
        cell.classList.remove('cdp-start', 'cdp-end', 'cdp-in-range', 'cdp-same-day');
        var d = new Date(cell.dataset.date); d.setHours(0, 0, 0, 0); if (!s) return;
        if (!e || (s.getTime() === d.getTime() && !dpEnd && !dpHover)) { if (d.getTime() === s.getTime()) cell.classList.add('cdp-start'); return; }
        var lo = s <= e ? s : e, hi = s <= e ? e : s, t = d.getTime();
        if (t === lo.getTime() && t === hi.getTime()) { cell.classList.add('cdp-start', 'cdp-same-day'); return; }
        if (t === lo.getTime()) { cell.classList.add('cdp-start', 'cdp-in-range'); return; }
        if (t === hi.getTime()) { cell.classList.add('cdp-end', 'cdp-in-range'); return; }
        if (d > lo && d < hi) cell.classList.add('cdp-in-range');
      });
    }
    function dpUpdateRange() {
      var elr = el('cdpRange'); if (!elr) return;
      if (dpPending && dpPending !== 'custom') { var p = PRESETS.find(function (x) { return x.key === dpPending; }); elr.textContent = p ? p.label : '—'; return; }
      if (!dpStart) { elr.textContent = '—'; return; }
      var he = function (d) { return String(d.getDate()).padStart(2, '0') + '/' + String(d.getMonth() + 1).padStart(2, '0') + '/' + d.getFullYear(); };
      var end = dpEnd || dpStart;
      elr.textContent = dpStart.getTime() === end.getTime() ? he(dpStart) : he(dpStart) + ' — ' + he(end);
    }
    function dpBuildPresets() {
      var panel = el('cdpPresets'); if (!panel) return;
      panel.innerHTML = PRESETS.map(function (p) {
        return '<div class="cdp-preset' + ((dpPending || st.preset) === p.key ? ' active' : '') + '" data-preset="' + p.key + '">' + p.label + '</div>';
      }).join('');
    }
    function dpPosition() {
      var wrap = el('cdpWrap'), pop = el('cdpPopup'); if (!wrap || !pop) return;
      pop.style.left = ''; pop.style.right = '';
      var wr = wrap.getBoundingClientRect(), pw = pop.offsetWidth, vw = window.innerWidth;
      var left = wr.right - pw;
      if (left < 12) left = 12;
      if (left + pw > vw - 12) left = Math.max(12, vw - 12 - pw);
      pop.style.right = 'auto';
      pop.style.left = (left - wr.left) + 'px';
    }
    function dpToggle() { dpOpen = !dpOpen; var pop = el('cdpPopup'); if (pop) pop.classList.toggle('open', dpOpen); if (dpOpen) { dpPending = st.preset; dpBuild(); dpBuildPresets(); dpUpdateRange(); dpPosition(); } }
    function dpClose() { dpOpen = false; dpPending = null; var pop = el('cdpPopup'); if (pop) pop.classList.remove('open'); }
    function dpApply() {
      if (dpPending && dpPending !== 'custom') { st.preset = dpPending; st.since = ''; st.until = ''; dpStart = dpEnd = null; dpClose(); onApply(); return; }
      if (!dpStart) return;
      var from = dpStart, to = dpEnd || dpStart;
      st.preset = 'custom'; st.since = isoOf(from); st.until = isoOf(to);
      dpPending = null; dpClose(); onApply();
    }
    function dpNav(dir) { dpLeftM += dir; if (dpLeftM > 11) { dpLeftM = 0; dpLeftY++; } if (dpLeftM < 0) { dpLeftM = 11; dpLeftY--; } dpBuild(); }
    function html() {
      return '<div class="cdp-wrap" id="cdpWrap">' +
        '<button class="cdp-trigger" id="cdpTrigger" type="button">' +
          '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="3"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>' +
          '<span id="cdpLabel">' + triggerLabel() + '</span>' +
          '<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="6 9 12 15 18 9"/></svg>' +
        '</button>' +
        '<div class="cdp-popup" id="cdpPopup"><div class="cdp-body">' +
          '<div class="cdp-cal"><div class="cdp-months"><div class="cdp-month" id="cdpMonthL"></div><div class="cdp-month" id="cdpMonthR"></div></div>' +
          '<div class="cdp-foot"><div class="cdp-range" id="cdpRange">—</div><div class="cdp-foot-btns"><button class="cdp-btn-cancel" id="cdpCancel" type="button">ביטול</button><button class="cdp-btn-apply" id="cdpApply" type="button">עדכן</button></div></div></div>' +
          '<div class="cdp-presets" id="cdpPresets"></div>' +
        '</div></div></div>';
    }
    function wire() {
      var now = nowIL(); dpLeftY = now.getFullYear(); dpLeftM = now.getMonth() - 1;
      if (dpLeftM < 0) { dpLeftM = 11; dpLeftY--; }
      var trig = el('cdpTrigger'); if (trig) trig.addEventListener('click', function (e) { e.stopPropagation(); dpToggle(); });
      var cancel = el('cdpCancel'); if (cancel) cancel.addEventListener('click', dpClose);
      var apply = el('cdpApply'); if (apply) apply.addEventListener('click', dpApply);
      var presets = el('cdpPresets');
      if (presets) presets.addEventListener('click', function (e) {
        var t = e.target.closest('.cdp-preset'); if (!t) return;
        dpPending = t.dataset.preset; dpStart = dpEnd = dpHover = null;
        presets.querySelectorAll('.cdp-preset').forEach(function (n) { n.classList.toggle('active', n === t); });
        dpUpdateRange();
      });
      var pop = el('cdpPopup');
      if (pop) {
        pop.addEventListener('click', function (e) {
          var nav = e.target.closest('.cdp-nav'); if (nav) { e.stopPropagation(); dpNav(parseInt(nav.dataset.nav, 10)); return; }
          var cell = e.target.closest('.cdp-day[data-date]'); if (!cell) return;
          e.stopPropagation(); dpPending = null;
          var date = new Date(cell.dataset.date); date.setHours(0, 0, 0, 0);
          if (!dpStart || (dpStart && dpEnd)) { dpStart = date; dpEnd = null; dpHover = null; }
          else { dpEnd = date; if (dpEnd < dpStart) { var tmp = dpStart; dpStart = dpEnd; dpEnd = tmp; } }
          dpHighlight(); dpUpdateRange();
          el('cdpPresets').querySelectorAll('.cdp-preset').forEach(function (n) { n.classList.remove('active'); });
        });
        pop.addEventListener('mouseover', function (e) {
          if (!dpStart || dpEnd) return;
          var cell = e.target.closest('.cdp-day[data-date]'); if (!cell) return;
          dpHover = new Date(cell.dataset.date); dpHover.setHours(0, 0, 0, 0); dpHighlight();
        });
      }
      // screens re-create the picker on every render; keep one document listener
      // that always talks to the CURRENT instance
      window.__cdpActive = function (e) { if (dpOpen && !e.target.closest('#cdpWrap')) dpClose(); };
      if (!window.__cdpDocClose) {
        window.__cdpDocClose = true;
        document.addEventListener('click', function (e) { if (window.__cdpActive) window.__cdpActive(e); });
      }
    }
    return { html: html, wire: wire };
  }
  return { create: create, calcRange: calcRange };
})();
