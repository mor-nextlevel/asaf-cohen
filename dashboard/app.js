/* לוח המעקב של אסף: הצד של הדפדפן. משיכה אחת מהשרת, והכל מחושב כאן.
   החישובים הם של התבנית מהלוח של לנה (sales-dashboard). התצוגה היא אופציה א׳ שמור בחר
   ב-08.10.2026: כותרת עמוד, שמונה מספרים מול התקופה הקודמת, בדיקות, משפך, הכנסה מצטברת,
   טבלת מודעות וטבלת אנשים עם וואטסאפ. הרכיבים והמנועים מ-ui/, משפת העיצוב של מור. */
(function () {
  'use strict';

  const { ic, n, n1, n2, av } = K;

  const KEY_STORE = 'dash-code';
  const KEY_VIEW = 'asaf-dash-view';
  let code = new URLSearchParams(location.search).get('k') || readStore(KEY_STORE) || '';

  const state = { preset: 'last_30_days', since: '', until: '' };
  let peopleTab = 'sales';
  let peopleSort = { key: 'at', dir: -1 };
  let peoplePage = 0;
  let peopleQuery = '';
  let adsSort = { key: 'spend', dir: -1 };
  let campSort = { key: 'spend', dir: -1 };
  let DATA = null;
  let noPrevText = 'אין השוואה לטווח הזה';
  let picker = null;
  const PER_PAGE = 10;

  function readStore(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function writeStore(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* מצב פרטי */ } }
  function dropStore(k) { try { localStorage.removeItem(k); } catch (e) { /* מצב פרטי */ } }

  /* הטווח והלשונית נשמרים, כדי שרענון לא יחזיר למקום אחר */
  function saveView() {
    writeStore(KEY_VIEW, JSON.stringify({ preset: state.preset, since: state.since, until: state.until, tab: peopleTab }));
  }
  function restoreView() {
    let v;
    try { v = JSON.parse(readStore(KEY_VIEW) || 'null'); } catch (e) { return; }
    if (!v || typeof v !== 'object') return;
    if (v.preset) { state.preset = v.preset; state.since = v.since || ''; state.until = v.until || ''; }
    if (v.tab) peopleTab = v.tab;
  }

  /* ------------------------------ עיצוב מספרים ------------------------------ */

  const money = (v, dec) => (v < 0 ? '-' : '') + K.ils(Math.abs(Number(v) || 0), dec);
  const esc = (s) => String(s === null || s === undefined ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const num = (txt) => `<span class="n">${txt}</span>`;
  const dayOf = (ts) => String(ts || '').slice(0, 10);
  const dm = (iso) => (String(iso).length >= 10 ? iso.slice(8, 10) + '.' + iso.slice(5, 7) : String(iso));
  const dmy = (iso) => dm(iso) + '.' + String(iso).slice(2, 4);
  const when = (ts) => { const s = String(ts || ''); return s.length < 16 ? s : dm(s) + ', ' + s.slice(11, 16); };
  const WD = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'];
  const weekday = (iso) => { const d = new Date(iso + 'T12:00:00'); return isNaN(d) ? '' : WD[d.getDay()]; };
  const rangeText = (r) => {
    if (r.since === r.until) return num(dm(r.since));
    const f = r.since.slice(0, 4) === r.until.slice(0, 4) ? dm : dmy;
    return `${num(f(r.since))} עד ${num(f(r.until))}`;
  };
  const many = (c, one, more) => (c === 1 ? one : num(n(c)) + ' ' + more);
  /* תג שינוי מול התקופה הקודמת. בלי בסיס אין תג, ובלי שינוי התג אפור */
  const chg = (cur, prev, opt) => {
    if (!prev) return '';
    const d = K.delta(cur, prev);
    const o = Object.assign({}, opt);
    if (Math.abs(d) < 0.05) { o.cls = 'as-neu'; o.noArrow = true; }
    return K.pill(d, o);
  };

  /* --------------------------------- תאריכים -------------------------------- */

  const isoOf = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const addDays = (iso, k) => { const d = new Date(iso + 'T12:00:00'); d.setDate(d.getDate() + k); return isoOf(d); };
  const span = (r) => Math.round((new Date(r.until + 'T12:00:00') - new Date(r.since + 'T12:00:00')) / 86400000) + 1;
  const viewRange = () => window.CDP.calcRange(state);

  /* התקופה הקודמת: אותו מספר ימים, מיד לפני הטווח. בטווח של יותר מחצי שנה אין השוואה,
     כדי לא למשוך שנתיים מהסליקה בשביל שורה קטנה מתחת למספר */
  const PREV_MAX_DAYS = 190;
  function prevOf(v) {
    const len = span(v);
    if (len > PREV_MAX_DAYS) return null;
    return { since: addDays(v.since, -len), until: addDays(v.since, -1) };
  }
  /* מה מבקשים מהשרת: הטווח, התקופה שלפניו, ולפחות שבוע בשביל הגרף */
  const CHART_MIN_DAYS = 7;
  function fetchWindow(v) {
    const p = prevOf(v);
    let since = v.since;
    const floor = addDays(v.until, -(CHART_MIN_DAYS - 1));
    if (floor < since) since = floor;
    if (p && p.since < since) since = p.since;
    return { since, until: v.until };
  }

  /* ---------------------------------- משיכה --------------------------------- */

  /* טווח שכבר נצפה מצויר מהזיכרון מיד, ומתרענן בשקט מאחור */
  const rangeCache = {};
  const FRESH_MS = 90000;
  let loadSeq = 0;

  const apiUrl = (f, v) => '/api/data?k=' + encodeURIComponent(code) +
    '&since=' + f.since + '&until=' + f.until + '&vsince=' + v.since + '&vuntil=' + v.until;

  function paintPicker() {
    const el = document.getElementById('picker');
    if (!el) return;
    el.innerHTML = picker.html();
    picker.wire();
  }
  function setBusy(on) {
    document.getElementById('app').classList.toggle('busy', !!on);
    if (on) { const s = document.getElementById('stamp'); if (s) s.textContent = 'טוען…'; }
  }

  /* לחיצה על טווח בבורר מתחילה למשוך עוד לפני ״עדכן״, כי קארדקום איטי בטווח ארוך */
  function prefetch(preset) {
    if (!preset || preset === 'custom') return;
    let v;
    try { v = window.CDP.calcRange({ preset }); } catch (e) { return; }
    const f = fetchWindow(v), key = f.since + '|' + f.until;
    const hit = rangeCache[key];
    if ((hit && Date.now() - hit.at < FRESH_MS) || rangeCache[key + '|pending']) return;
    rangeCache[key + '|pending'] = true;
    fetch(apiUrl(f, v)).then((r) => r.json())
      .then((j) => { if (j && j.ok) rangeCache[key] = { at: Date.now(), data: j }; })
      .catch(() => { /* אם נכשל, המשיכה הרגילה תרוץ */ })
      .then(() => { delete rangeCache[key + '|pending']; });
  }

  function load(opts) {
    let quiet = opts && opts.quiet;
    const v = viewRange(), f = fetchWindow(v), key = f.since + '|' + f.until;
    const seq = ++loadSeq;
    paintPicker();

    const hit = opts && opts.force ? null : rangeCache[key];
    if (hit && !quiet) {
      DATA = hit.data;
      render();
      if (Date.now() - hit.at < FRESH_MS) return Promise.resolve();
      quiet = true;
    }
    if (!quiet) setBusy(true);

    return fetch(apiUrl(f, v))
      .then((res) => { if (res.status === 401) throw new Error('unauthorized'); return res.json(); })
      .then((j) => {
        if (!j.ok) throw new Error(j.error || 'failed');
        rangeCache[key] = { at: Date.now(), data: j };
        if (seq !== loadSeq) return;
        setBusy(false);
        DATA = j;
        render();
      })
      .catch((e) => {
        if (e.message === 'unauthorized') { dropStore(KEY_STORE); location.href = location.pathname; return; }
        setBusy(false);
        if (seq !== loadSeq || quiet) return;
        const s = document.getElementById('stamp'); if (s) s.textContent = '';
        document.getElementById('k1').innerHTML = `<div class="cd"><div class="cd-t">${ic('circle-alert', 17)} לא הצלחתי למשוך נתונים</div><div class="cd-s">${esc(e.message)}</div></div>`;
      });
  }

  /* --------------------------------- חישובים -------------------------------- */

  /* מה שלא תלוי בטווח: מי קנה אי פעם, כדי לסמן ״רכש״ ליד מי שהגיע לתשלום */
  function buyerIndex() {
    const phoneKey = (p) => { const d = String(p || '').replace(/\D/g, ''); return d.length >= 9 ? d.slice(-9) : ''; };
    const seen = {};
    const add = (list) => list.forEach((b) => { if (b.email) seen[b.email] = true; if (phoneKey(b.phone)) seen[phoneKey(b.phone)] = true; });
    add(DATA.ravmesser.buyers);
    if (DATA.cardcom && DATA.cardcom.ok) add(DATA.cardcom.transactions.filter((t) => t.kind === 'sale'));
    return (p) => !!(seen[p.email] || (phoneKey(p.phone) && seen[phoneKey(p.phone)]));
  }

  /* רק מטא מחובר, בלי סליקה ובלי רב מסר: הרכישות, ההכנסה, הטופס והתשלום מגיעים מהפיקסל */
  const metaOnly = () => !!(DATA.sources.meta && !DATA.sources.cardcom && !DATA.sources.ravmesser);
  /* מה נחשב ״הגיעו לתשלום״ לפי הפיקסל: התחלת תשלום אם הדף שולח אותה, ואם לא, מילוי הטופס */
  const reachedKey = () => (DATA.meta.daily.some((d) => d.checkouts) ? 'checkouts' : 'leads');
  const tracksReached = () => DATA.meta.daily.some((d) => d.checkouts || d.leads);
  /* שעון חשבון המודעות, רק כשהוא לא שעון ישראל */
  const ZONES = { 'America/Los_Angeles': 'לוס אנג׳לס', 'America/New_York': 'ניו יורק', 'Europe/London': 'לונדון' };
  const metaZone = () => {
    const z = DATA.meta.timezone;
    return z && z !== 'Asia/Jerusalem' ? ZONES[z] || z : '';
  };
  /* פיקסל שיורה בלי סכום עדיין סופר רכישות, אז מתמחרים אותן לפי המחיר */
  const pixelGross = (d) => d.metaRevenue || (d.purchases || 0) * DATA.prices.main;

  /* כל המספרים של טווח אחד. אותו חשבון כמו בלוח של לנה */
  function metrics(r) {
    const mo = metaOnly();
    const inRange = (row) => { const d = dayOf(row.at); return d >= r.since && d <= r.until; };
    const ccUp = !!(DATA.cardcom && DATA.cardcom.ok);
    const cc = ccUp ? DATA.cardcom.transactions.filter(inRange) : [];
    const by = (k) => cc.filter((t) => t.kind === k);
    const sales = by('sale');
    const tests = by('test');
    const failed = by('failed').filter((t) => t.course);
    const refunds = by('refund').filter((t) => t.course);
    const other = cc.filter((t) => t.kind === 'other' || ((t.kind === 'refund' || t.kind === 'failed') && !t.course));
    const sum = (rows) => rows.reduce((a, t) => a + Math.abs(t.amount), 0);
    const leads = DATA.ravmesser.leads.filter(inRange);
    const rmBuyers = DATA.ravmesser.buyers.filter(inRange);
    const md = DATA.meta.daily.filter((d) => d.date >= r.since && d.date <= r.until);
    const mSum = (k) => md.reduce((a, d) => a + (d[k] || 0), 0);
    const count = mo ? mSum('purchases') : ccUp ? sales.length : rmBuyers.length;
    /* בלי סליקה, ההכנסה היא הרוכשים ברב מסר כפול המחיר. בלי שניהם, מה שהפיקסל ספר */
    const revenue = mo ? md.reduce((a, d) => a + pixelGross(d), 0) : ccUp ? sum(sales) - sum(refunds) : count * DATA.prices.main;
    const bumps = DATA.hasBump ? sales.filter((t) => t.amount > DATA.prices.main + 1) : [];
    /* כשרוכש יוצא מרשימת הלידים, הרשימה היא הנוטשים, וההגיעו לתשלום הם הרשימה ועוד הרוכשים */
    const dropped = !!DATA.leadsDropBuyers;
    const reached = mo ? mSum(reachedKey()) : dropped ? leads.length + count : leads.length;
    const abandoned = mo ? Math.max(0, reached - count) : dropped ? leads.length : Math.max(0, leads.length - count);
    /* המחירים כוללים מע״מ, ולכן נטו הוא חלקי 1.18 */
    const revenueNet = revenue / (1 + (DATA.vat || 0));
    const spend = mSum('spend');
    return {
      r, mo, ccUp, sales, tests, failed, refunds, other, bumps, leads, rmBuyers,
      count, revenue, revenueNet, vat: revenue - revenueNet, refunded: sum(refunds),
      reached, abandoned, spend, profit: revenueNet - spend,
      roas: spend > 0 ? revenueNet / spend : null,
      cpa: count > 0 && spend > 0 ? spend / count : null,
      views: mSum('landingViews'), clicks: mSum('linkClicks'),
    };
  }

  /* הכנסה ורכישות לכל יום, כדי שיום בלי מכירות יצויר כאפס */
  function daily(r) {
    const ccUp = !!(DATA.cardcom && DATA.cardcom.ok);
    const rows = [];
    for (let d = r.since; d <= r.until && rows.length < 1500; d = addDays(d, 1)) rows.push({ date: d, gross: 0, purchases: 0, spend: 0, reached: 0, abandoned: 0, failed: 0 });
    const at = {};
    rows.forEach((x) => (at[x.date] = x));
    if (ccUp) {
      DATA.cardcom.transactions.forEach((t) => {
        const x = at[dayOf(t.at)];
        if (!x) return;
        if (t.kind === 'sale') { x.gross += Math.abs(t.amount); x.purchases++; }
        if (t.kind === 'refund' && t.course) x.gross -= Math.abs(t.amount);
        if (t.kind === 'failed' && t.course) x.failed++;
      });
    } else if (metaOnly()) {
      DATA.meta.daily.forEach((m) => { const x = at[m.date]; if (x) { x.purchases += m.purchases || 0; x.gross += pixelGross(m); } });
    } else {
      DATA.ravmesser.buyers.forEach((b) => { const x = at[dayOf(b.at)]; if (x) { x.purchases++; x.gross += DATA.prices.main; } });
    }
    const leadsBy = {};
    DATA.ravmesser.leads.forEach((l) => { const d = dayOf(l.at); leadsBy[d] = (leadsBy[d] || 0) + 1; });
    if (metaOnly()) {
      /* מהפיקסל מגיע ״הגיעו לתשלום״, ולא רשימה של מי שנשאר, אז הנוטשים הם ההפרש */
      const k = reachedKey();
      DATA.meta.daily.forEach((m) => { if (at[m.date]) leadsBy[m.date] = m[k] || 0; });
    }
    DATA.meta.daily.forEach((m) => { const x = at[m.date]; if (x) x.spend += m.spend || 0; });
    rows.forEach((x) => {
      const l = leadsBy[x.date] || 0;
      x.reached = DATA.leadsDropBuyers ? l + x.purchases : l;
      x.abandoned = DATA.leadsDropBuyers ? l : Math.max(0, l - x.purchases);
      x.net = x.gross / (1 + (DATA.vat || 0));
    });
    return rows;
  }

  function derive() {
    const win = DATA.range;
    const v = viewRange();
    const r = { since: v.since < win.since ? win.since : v.since, until: v.until > win.until ? win.until : v.until };
    const p = prevOf(v);
    const cur = metrics(r);
    let prev = p && p.since >= win.since ? metrics(p) : null;
    const prevEmpty = !!(prev && !prev.count && !prev.spend && !prev.leads.length && !prev.failed.length);
    if (prevEmpty) prev = null;
    noPrevText = prevEmpty ? 'אין נתונים בתקופה הקודמת' : 'אין השוואה לטווח הזה';
    return { cur, prev, p: prev ? p : null, matched: buyerIndex() };
  }

  /* ---------------------------------- כותרת --------------------------------- */

  function renderHeader() {
    document.getElementById('hdr').innerHTML = `<div class="cd h6">
      <div class="crumbs">${ic('house', 14)}<span>נקסט לבל</span>${ic('chevron-left', 13)}<span>אסף כהן</span>${ic('chevron-left', 13)}<b style="color:var(--ink)">לוח המעקב</b></div>
      <div class="ttl"><div class="row" style="gap:14px"><img class="as-av" src="/img/asaf.jpg" alt=""><div><h2 id="hdrTitle">לוח המעקב של אסף <span class="tag t-ok" id="hdrTag" style="font-size:12px">מתעדכן חי</span></h2><div class="cd-s" id="hdrSub" style="font-size:13.5px"></div></div></div>
      <div class="row as-btns" style="gap:8px"><div id="picker"></div><button class="btn" id="btnRefresh" type="button">${ic('refresh-cw', 15)}רענון</button><button class="btn" id="btnExport" type="button">${ic('download', 15)}ייצוא</button></div></div>
      <div class="utabs"><button class="on" data-go="s-top" type="button">סקירה</button><button data-go="s-sales" type="button">מכירות</button><button data-go="s-ads" type="button">מודעות</button><button data-go="s-people" type="button">אנשים</button></div></div>`;
  }

  function paintHeader(X) {
    const d = DATA.display || {};
    const name = d.business ? 'לוח המעקב של ' + d.business : 'לוח המעקב';
    document.title = name;
    const tag = DATA.demo ? '<span class="tag t-warn" style="font-size:12px">מצב הדגמה</span>' : '<span class="tag t-ok" style="font-size:12px">מתעדכן חי</span>';
    document.getElementById('hdrTitle').innerHTML = esc(name) + ' ' + tag;
    const peopleBtn = document.querySelector('.h6 .utabs [data-go="s-people"]');
    if (peopleBtn) peopleBtn.textContent = X.cur.mo ? 'קמפיינים' : 'אנשים';
    const t = new Date(DATA.generatedAt).toLocaleTimeString('he-IL', { timeZone: 'Asia/Jerusalem', hour: '2-digit', minute: '2-digit' });
    const today = X.cur.r.since === X.cur.r.until && X.cur.r.until === DATA.today;
    const prevTxt = X.p ? (today ? ' · מול אתמול, כל היום' : ' · מול ' + rangeText(X.p)) : '';
    document.getElementById('hdrSub').innerHTML = (d.product ? esc(d.product) + ' · ' : '') +
      `<span id="stamp">עודכן ${num(t)}</span> · ${rangeText(X.cur.r)}${prevTxt}`;
    document.getElementById('demo').innerHTML = DATA.demo
      ? `<div class="cd as-demo"><span class="tag t-warn">מצב הדגמה</span><span><b>המספרים והשמות כאן מומצאים</b>, כדי לראות איך הלוח נראה. ברגע שמחברים את הסליקה, רשימת התפוצה ומטא, הם מתחלפים במספרים האמיתיים.</span></div>`
      : '';
  }

  /* --------------------------------- מספרים --------------------------------- */

  /* כרטיס a6: כותרת, מספר גדול, ותג שינוי מול התקופה הקודמת.
     good: עלייה טובה. bad: עלייה רעה (עלות לרכישה, נוטשים). neu: אין טוב ורע (הוצאה) */
  function kpis(el, items) {
    el.innerHTML = `<div class="cols c4">${items.map((it) => {
      const has = it.cur !== null && it.cur !== undefined;
      let pill = '', sub;
      if (!has) sub = it.empty;
      else if (it.prev === null || it.prev === undefined) sub = it.noPrev || noPrevText;
      else {
        pill = chg(it.cur, it.prev, { inverse: it.mode === 'bad', cls: it.mode === 'neu' ? 'as-neu' : '' });
        sub = `לעומת ${num(it.f(it.prev))}<span class="as-long"> בתקופה הקודמת</span>`;
      }
      return `<div class="cd a6"><div class="lab">${it.lab}</div><div class="big2 n">${has ? it.f(it.cur) : '—'}</div>
        <div class="row" style="gap:8px">${pill}<span class="sub">${sub}</span></div></div>`;
    }).join('')}</div>`;
  }

  function renderKpis(X) {
    const c = X.cur, p = X.prev;
    const pv = (k) => (p ? p[k] : null);
    const ils = (v) => money(v);
    kpis(document.getElementById('k1'), [
      { lab: DATA.vat ? 'הכנסה, כולל מע״מ' : 'הכנסה', cur: c.revenue, prev: pv('revenue'), f: ils, mode: 'good' },
      { lab: 'הכנסה בלי מע״מ', cur: c.revenueNet, prev: pv('revenueNet'), f: ils, mode: 'good' },
      { lab: 'הוצאה על פרסום', cur: c.spend, prev: pv('spend'), f: ils, mode: 'neu' },
      { lab: 'רווח נקי', cur: c.profit, prev: pv('profit'), f: ils, mode: 'good' },
    ]);
    kpis(document.getElementById('k2'), [
      { lab: 'תשואה על הפרסום', cur: c.roas, prev: p ? p.roas : null, f: n2, mode: 'good', empty: 'אין הוצאה על פרסום בטווח', noPrev: p ? 'לא הייתה הוצאה בתקופה הקודמת' : null },
      { lab: 'רכישות', cur: c.count, prev: pv('count'), f: n, mode: 'good' },
      { lab: 'עלות לרכישה', cur: c.cpa, prev: p ? p.cpa : null, f: ils, mode: 'bad', empty: c.count ? 'אין הוצאה על פרסום בטווח' : 'אין רכישות בטווח', noPrev: p ? 'אין עלות לרכישה בתקופה הקודמת' : null },
      /* כשהדף עוד לא שולח למטא את הטופס או התשלום, אין נוטשים לספור, ובמקומם הצפיות בדף */
      c.mo && !tracksReached()
        ? { lab: 'צפו בדף', cur: c.views, prev: pv('views'), f: n, mode: 'good' }
        : { lab: 'נטשו את העגלה', cur: c.abandoned, prev: pv('abandoned'), f: n, mode: 'bad' },
    ]);
  }

  /* --------------------------------- בדיקות --------------------------------- */

  /* דברים נכונים שלא נכנסים למספרים הגדולים: כרטיסים שנדחו, זיכויים, בדיקות,
     מוצרים אחרים במסוף, והפער בין הסליקה לרב מסר ולמטא */
  function renderChecks(X) {
    const c = X.cur, chips = [];
    if (!DATA.sources.meta && !DATA.demo) chips.push(['t-gray', 'מטא עוד לא מחובר, אין הוצאה על פרסום']);
    const tz = metaZone();
    if (tz) chips.push(['t-warn', `חשבון המודעות על שעון ${esc(tz)}, אז היום במטא לא מתחיל בחצות שלנו`]);
    if (c.mo) {
      chips.push(['t-gray', 'כל המספרים מהפיקסל של מטא, רק ממי שהגיע מהמודעות']);
      if (!DATA.meta.ads.length) chips.push(['t-warn', 'לא רצו מודעות בטווח הזה']);
      else if (c.spend > 0 && c.views > 0 && !DATA.meta.daily.some((d) => d.purchases)) chips.push(['t-warn', 'הפיקסל עוד לא ספר אף רכישה. שווה לבדוק שהוא יורה בדף התודה']);
    } else if (!c.ccUp) {
      const err = DATA.cardcom && DATA.cardcom.error && DATA.cardcom.error !== 'not configured' ? ' · ' + esc(DATA.cardcom.error) : '';
      chips.push(['t-bad', 'אין חיבור לסליקה, המספרים מגיעים מרב מסר' + err]);
    } else {
      if (c.failed.length) chips.push(['t-bad', many(c.failed.length, 'כרטיס אחד נדחה, שווה להתקשר', 'כרטיסים נדחו, שווה להתקשר')]);
      if (c.refunds.length) chips.push(['t-purple', many(c.refunds.length, 'זיכוי אחד', 'זיכויים') + ' · ' + num(money(c.refunded))]);
      if (c.tests.length) chips.push(['t-gray', many(c.tests.length, 'חיוב בדיקה אחד, לא נספר', 'חיובי בדיקה, לא נספרים')]);
      if (c.other.length) chips.push(['t-gray', many(c.other.length, 'עסקה אחת של מוצר אחר במסוף, לא נספרת', 'עסקאות של מוצרים אחרים במסוף, לא נספרות')]);
      if (DATA.sources.ravmesser && DATA.lists.buyers) {
        const gap = c.rmBuyers.length - c.sales.length;
        chips.push(gap === 0 ? ['t-ok', 'הסליקה ורב מסר מסונכרנים']
          : ['t-warn', `פער מול רב מסר: ${num(n(c.sales.length))} בסליקה מול ${num(n(c.rmBuyers.length))} ברשימה`]);
      }
    }
    const metaP = DATA.meta.ads.reduce((s, a) => s + (a.purchases || 0), 0);
    if (!c.mo && DATA.meta.ads.length && metaP !== c.count) chips.push(['t-warn', `מטא ספר ${num(n(metaP))} רכישות, ${c.ccUp ? 'הסליקה' : 'רב מסר'} ${num(n(c.count))}`]);
    if (!chips.length) chips.push(['t-ok', 'הכל תקין בטווח הזה']);
    document.getElementById('chk').innerHTML = `<div class="cd as-chk"><span class="lab">${ic('badge-check', 15)} בדיקות</span>${chips.map(([cls, txt]) => `<span class="tag ${cls}">${txt}</span>`).join('')}</div>`;
  }

  /* ---------------------------------- משפך ---------------------------------- */

  function renderFunnel(X) {
    const c = X.cur, p = X.prev, metaUp = DATA.sources.meta || DATA.demo;
    const F = [];
    if (metaUp) F.push(['קליקים על המודעה', c.clicks, p && p.clicks], ['צפו בדף', c.views, p && p.views]);
    if (!c.mo || tracksReached()) F.push([c.mo && reachedKey() === 'leads' ? 'מילאו את הטופס' : 'הגיעו לתשלום', c.reached, p && p.reached]);
    F.push(['רכשו', c.count, p && p.count]);
    if (DATA.hasBump) F.push(['לקחו אפסייל', c.bumps.length, p && p.bumps.length]);
    const top = Math.max(1, F[0][1]);
    const note = metaUp && c.views > 0
      ? `מהדף ועד הרכישה: ${num(n1((c.count / c.views) * 100) + '%')}. ${c.mo ? 'כל השלבים' : 'צפיות בדף'} נספרים רק ממי שהגיע מהמודעות במטא, בלי תנועה אורגנית או ממייל.`
      : metaUp ? 'כל השלבים נספרים מהפיקסל של מטא, רק ממי שהגיע מהמודעות.' : 'בלי מטא אין צפיות בדף, ולכן המשפך מתחיל בדף התשלום.';
    document.getElementById('fun').innerHTML = `<div class="cd d2"><div class="c-head"><div><div class="cd-t">${ic('funnel', 17)} המשפך</div><div class="cd-s">מהקליק במודעה ועד התשלום, ${rangeText(c.r)}</div></div></div>
      <div class="st hd" style="padding:0 0 6px"><span></span><span>שלב</span><span></span><span style="text-align:left">כמה</span><span style="text-align:left">מהשלב הקודם</span><span style="text-align:left" class="dl">שינוי</span></div>
      ${F.map(([lab, v, pv], i) => {
        const from = i ? F[i - 1][1] : 0;
        const rate = i ? (from > 0 ? num(n1((v / from) * 100) + '%') : '<span class="muted">—</span>') : '<span class="muted">התחלה</span>';
        const dl = (p && chg(v, pv)) || '<span class="muted">—</span>';
        return `<div class="st"><span class="no n">${i + 1}</span><span style="font-weight:600">${lab}</span><div class="hbar"><i style="width:${Math.min(100, (v / top) * 100)}%;opacity:${1 - i * 0.12}"></i></div>
          <span class="vv n">${n(v)}</span><span class="cv">${rate}</span><span class="dl" style="text-align:left">${dl}</span></div>`;
      }).join('')}
      <div class="as-note">${ic('info', 14)}<span>${note}</span></div></div>`;
  }

  /* ----------------------------- הכנסה מצטברת ------------------------------ */

  function renderCum(X) {
    const c = X.cur, p = X.prev;
    /* יום אחד לא עושה קו, אז בטווח של יום הגרף מראה את השבוע שנגמר בו */
    const short = span(c.r) < 2;
    const cr = short ? { since: addDays(c.r.until, -(CHART_MIN_DAYS - 1)), until: c.r.until } : c.r;
    let rows = daily(cr);
    const first = rows.findIndex((x) => x.gross || x.spend || x.reached || x.failed);
    if (first > 0) rows = rows.slice(Math.min(first, rows.length - CHART_MIN_DAYS));
    let acc = 0;
    const v = rows.map((x) => (acc += x.gross));
    const long = rows.length > 120;
    const pill = p ? chg(c.revenue, p.revenue) : '';
    const sub = p ? `לעומת ${num(money(p.revenue))} בתקופה הקודמת` : noPrevText;
    document.getElementById('cum').innerHTML = `<div class="cd"><div class="b-head"><div><div class="lab">${DATA.vat ? 'הכנסה מצטברת, כולל מע״מ' : 'הכנסה מצטברת'}</div>
      <div class="b-num"><span class="big2 n">${money(c.revenue)}</span>${pill}</div>
      <div class="cd-s">${sub}${short ? '. הגרף מראה את השבוע שנגמר ביום הזה' : ''}</div></div></div><div class="ch" id="cumCh"></div></div>`;
    K.mount(document.getElementById('cumCh'), (ch, w) => K.tc(ch, w, {
      h: 230, x: rows.map((x) => (long ? dmy(x.date) : dm(x.date))), tip: 'dark', yfmt: (t) => '₪' + K.k(t),
      tipHtml: (i) => `<div class="tt">יום ${weekday(rows[i].date)}, ${dmy(rows[i].date)}</div><div class="tr"><span>עד היום</span><b class="n">${money(v[i])}</b></div><div class="tr"><span>רכישות ביום הזה</span><b class="n">${rows[i].purchases}</b></div>`,
      series: [{ v, color: 'var(--c2)', grad: ['var(--c5)', 'var(--c1)', 'var(--c2)', 'var(--c3)'], area: true, areaColor: 'var(--c2)', areaOp: 0.1, width: 3.4, endDot: true, endColor: 'var(--c3)', name: 'עד היום' }],
    }));
  }

  /* --------------------------------- מודעות --------------------------------- */

  function adRows(list) {
    const toNet = (val) => val / (1 + (DATA.vat || 0));
    return (list || DATA.meta.ads).map((a) => {
      const rev = toNet(pixelGross(a));
      return Object.assign({}, a, {
        rev, roas: a.spend > 0 ? rev / a.spend : 0, cpa: a.purchases > 0 ? a.spend / a.purchases : 0,
        live: String(a.status).toUpperCase() === 'ACTIVE',
        ctr: a.impressions ? ((a.linkClicks || 0) / a.impressions) * 100 : 0,
      });
    });
  }

  function sortIcon(on, dir) { return ic(on ? (dir > 0 ? 'arrow-up' : 'arrow-down') : 'chevrons-up-down', 12, 2.2); }
  function th(key, label, sort, cls) {
    return `<th class="s ${cls || ''} ${sort.key === key ? 'on' : ''}" data-k="${key}">${label}${sortIcon(sort.key === key, sort.dir)}</th>`;
  }
  function sortBy(rows, sort) {
    return rows.slice().sort((a, b) => {
      const x = a[sort.key], y = b[sort.key];
      if (typeof x === 'string' || typeof y === 'string') return String(x || '').localeCompare(String(y || ''), 'he') * sort.dir;
      return ((Number(x) || 0) - (Number(y) || 0)) * sort.dir;
    });
  }

  function renderAds(X) {
    const el = document.getElementById('adt');
    const rows = adRows();
    const metaP = rows.reduce((s, a) => s + a.purchases, 0);
    const sub = X.cur.mo
      ? `${rangeText(X.cur.r)}. הרכישות וההכנסה לפי הפיקסל של מטא, בלי מע״מ`
      : `${rangeText(X.cur.r)}. הרכישות וההכנסה לפי הפיקסל של מטא, בלי מע״מ: ${num(n(metaP))} רכישות, ${X.cur.ccUp ? 'בסליקה' : 'ברב מסר'} ${num(n(X.cur.count))}. ההכנסה האמיתית היא זו שבכרטיסים למעלה`;
    const head = `<div class="cd-h"><div><div class="cd-t">${ic('megaphone', 17)} המודעות</div><div class="cd-s">${sub}</div></div>${rows.length ? `<button class="btn" id="btnAdsCsv" type="button">${ic('download', 14)}ייצוא</button>` : ''}</div>`;
    if (!rows.length) {
      el.innerHTML = `<div class="cd">${head}<div class="as-empty">${DATA.sources.meta || DATA.demo ? 'לא רצו מודעות בטווח הזה' : 'מטא עוד לא מחובר'}</div></div>`;
      return;
    }
    const T = (k) => rows.reduce((s, a) => s + (a[k] || 0), 0);
    const tS = T('spend'), tP = T('purchases'), tR = T('rev'), tImp = T('impressions');
    const roasTag = (v, spend) => (spend > 0 ? `<span class="tag nodot n ${v >= 1.5 ? 't-ok' : v >= 1 ? 't-warn' : 't-bad'}">${n2(v)}</span>` : '<span class="muted">—</span>');
    const body = sortBy(rows, adsSort).map((a) => `<tr>
      <td><div class="as-ad">${a.thumb ? `<img class="as-th" src="${esc(a.thumb)}" alt="">` : '<span class="as-th"></span>'}<div style="min-width:0"><b>${esc(a.name || '—')}</b><span class="sub">${esc(a.campaign || '')}</span></div></div></td>
      <td><span class="tag ${a.live ? 't-ok' : 't-gray'}">${a.live ? 'פעילה' : 'מושהית'}</span></td>
      <td class="num n">${money(a.spend)}</td><td class="num"><b class="n">${n(a.purchases)}</b></td><td class="num n">${a.rev ? money(a.rev) : '—'}</td>
      <td class="num">${roasTag(a.roas, a.spend)}</td><td class="num n">${a.purchases ? money(a.cpa) : '—'}</td>
      <td class="num n">${n(a.landingViews || 0)}</td><td class="num n">${n(a.linkClicks || 0)}</td><td class="num n">${n2(a.ctr || 0)}%</td></tr>`).join('');
    el.innerHTML = `<div class="cd">${head}<div class="tbl-wrap"><table class="tbl"><thead><tr><th>מודעה</th><th>מצב</th>${th('spend', 'הוצאה', adsSort, 'num')}${th('purchases', 'רכישות', adsSort, 'num')}${th('rev', 'הכנסה נטו', adsSort, 'num')}${th('roas', 'תשואה', adsSort, 'num')}${th('cpa', 'עלות לרכישה', adsSort, 'num')}${th('landingViews', 'צפיות בדף', adsSort, 'num')}${th('linkClicks', 'קליקים', adsSort, 'num')}${th('ctr', 'אחוז הקלקה', adsSort, 'num')}</tr></thead>
      <tbody>${body}</tbody>
      <tfoot><tr class="as-tot"><td>סה״כ</td><td></td><td class="num n">${money(tS)}</td><td class="num n">${n(tP)}</td><td class="num n">${money(tR)}</td><td class="num n">${tS > 0 ? n2(tR / tS) : '—'}</td><td class="num n">${tP ? money(tS / tP) : '—'}</td><td class="num n">${n(T('landingViews'))}</td><td class="num n">${n(T('linkClicks'))}</td><td class="num n">${tImp ? n2((T('linkClicks') / tImp) * 100) + '%' : '—'}</td></tr></tfoot></table></div></div>`;
    el.querySelectorAll('th.s').forEach((h) => (h.onclick = () => {
      const k = h.dataset.k;
      adsSort = { key: k, dir: adsSort.key === k ? -adsSort.dir : -1 };
      renderAds(X);
    }));
  }

  /* -------------------------------- קמפיינים -------------------------------- */

  /* בלי סליקה ובלי רב מסר אין שמות וטלפונים, אז במקום האנשים יש טבלת קמפיינים */
  function renderCampaigns(X) {
    const el = document.getElementById('ppl');
    const rk = reachedKey(), withReached = tracksReached();
    const rows = adRows(DATA.meta.campaigns).map((a) => Object.assign(a, { reached: a[rk] || 0 }));
    const head = `<div class="cd-h"><div><div class="cd-t">${ic('layers', 17)} הקמפיינים</div><div class="cd-s">${rangeText(X.cur.r)}. אותם מספרים כמו המודעות, מחוברים לפי קמפיין</div></div>${rows.length ? `<button class="btn" id="btnPplCsv" type="button">${ic('download', 14)}ייצוא</button>` : ''}</div>`;
    if (!rows.length) {
      el.innerHTML = `<div class="cd">${head}<div class="as-empty">לא רצו קמפיינים בטווח הזה</div></div>`;
      return;
    }
    const T = (k) => rows.reduce((s, a) => s + (a[k] || 0), 0);
    const tS = T('spend'), tP = T('purchases'), tR = T('rev');
    const rLab = rk === 'leads' ? 'מילאו טופס' : 'הגיעו לתשלום';
    const body = sortBy(rows, campSort).map((a) => `<tr>
      <td><b>${esc(a.name || '—')}</b></td>
      <td class="num n">${money(a.spend)}</td><td class="num"><b class="n">${n(a.purchases)}</b></td><td class="num n">${a.rev ? money(a.rev) : '—'}</td>
      <td class="num n">${a.spend > 0 ? n2(a.roas) : '—'}</td><td class="num n">${a.purchases ? money(a.cpa) : '—'}</td>
      ${withReached ? `<td class="num n">${n(a.reached)}</td>` : ''}<td class="num n">${n(a.landingViews || 0)}</td><td class="num n">${n(a.linkClicks || 0)}</td></tr>`).join('');
    el.innerHTML = `<div class="cd">${head}<div class="tbl-wrap"><table class="tbl"><thead><tr><th>קמפיין</th>${th('spend', 'הוצאה', campSort, 'num')}${th('purchases', 'רכישות', campSort, 'num')}${th('rev', 'הכנסה נטו', campSort, 'num')}${th('roas', 'תשואה', campSort, 'num')}${th('cpa', 'עלות לרכישה', campSort, 'num')}${withReached ? th('reached', rLab, campSort, 'num') : ''}${th('landingViews', 'צפיות בדף', campSort, 'num')}${th('linkClicks', 'קליקים', campSort, 'num')}</tr></thead>
      <tbody>${body}</tbody>
      <tfoot><tr class="as-tot"><td>סה״כ</td><td class="num n">${money(tS)}</td><td class="num n">${n(tP)}</td><td class="num n">${money(tR)}</td><td class="num n">${tS > 0 ? n2(tR / tS) : '—'}</td><td class="num n">${tP ? money(tS / tP) : '—'}</td>${withReached ? `<td class="num n">${n(T('reached'))}</td>` : ''}<td class="num n">${n(T('landingViews'))}</td><td class="num n">${n(T('linkClicks'))}</td></tr></tfoot></table></div></div>`;
    el.querySelectorAll('th.s').forEach((h) => (h.onclick = () => {
      const k = h.dataset.k;
      campSort = { key: k, dir: campSort.key === k ? -campSort.dir : -1 };
      renderCampaigns(X);
    }));
  }

  /* ---------------------------------- אנשים --------------------------------- */

  const TABS = {
    sales: { label: 'רכשו', note: 'עסקאות שעברו בפועל במסוף הסליקה' },
    failed: { label: 'כרטיסים שנדחו', note: 'ניסו לשלם והכרטיס לא עבר. אלה הלידים הכי חמים שיש' },
    leads: { label: 'הגיעו לתשלום', note: 'האימייל בטופס והאימייל בסליקה לרוב שונים, ולכן הסימון ״רכש״ חלקי' },
    refunds: { label: 'זיכויים', note: 'כסף שחזר ללקוח ויורד מההכנסה' },
    other: { label: 'מוצרים אחרים', note: 'עסקאות אחרות שעברו באותו מסוף. לא נכנסות לאף מספר בלוח' },
    tests: { label: 'בדיקות', note: '' },
  };
  const ORDER = ['sales', 'failed', 'leads', 'refunds', 'other', 'tests'];

  function peopleRows(X, tab) {
    const c = X.cur;
    if (tab === 'leads') return c.leads.map((p) => Object.assign({}, p, { bought: X.matched(p) }));
    const src = tab === 'sales' ? c.sales : tab === 'failed' ? c.failed : tab === 'refunds' ? c.refunds : tab === 'other' ? c.other : c.tests;
    return src.map((t) => Object.assign({}, t, { amountAbs: Math.abs(t.amount) }));
  }

  function waLink(phone, label) {
    const d = String(phone || '').replace(/\D/g, '');
    if (!d) return '';
    return `<a class="as-wa" href="https://wa.me/972${esc(d.replace(/^0/, '').replace(/^972/, ''))}" target="_blank" rel="noopener">${ic('message-circle', 14)}${label}</a>`;
  }

  function statusTag(tab, p) {
    if (tab === 'sales') return DATA.hasBump && p.amount > DATA.prices.main + 1 ? '<span class="tag t-acc">עם אפסייל</span>' : '<span class="tag t-ok">שולם</span>';
    if (tab === 'failed') return '<span class="tag t-bad">נדחה</span>';
    if (tab === 'leads') return DATA.leadsDropBuyers ? '<span class="tag t-warn">נטש</span>' : p.bought ? '<span class="tag t-ok">רכש</span>' : '<span class="tag t-gray">לא ידוע</span>';
    if (tab === 'refunds') return '<span class="tag t-purple">זוכה</span>';
    if (tab === 'other') return `<span class="tag t-gray">${{ refund: 'זיכוי', failed: 'נדחה' }[p.kind] || 'מוצר אחר'}</span>`;
    return '<span class="tag t-gray">בדיקה</span>';
  }

  function cols(tab) {
    const C = [['at', 'מתי', true], ['name', 'שם'], ['phone', 'טלפון']];
    if (tab !== 'leads') C.push(['amountAbs', 'סכום', true]);
    if (tab === 'sales') C.push(['payments', 'תשלומים', true]);
    if (tab === 'failed') C.push(['reason', 'סיבה']);
    C.push(['status', 'מצב']);
    if (tab !== 'other' && tab !== 'tests') C.push(['wa', '']);
    return C;
  }

  function cell(tab, key, p) {
    if (key === 'at') return `<td class="n muted" style="white-space:nowrap">${esc(when(p.at))}</td>`;
    if (key === 'name') return `<td><div class="g-who">${av(p.name || '?', 28)}<div style="min-width:0"><b>${esc(p.name || '—')}</b>${p.email ? `<span class="as-mail">${esc(p.email)}</span>` : ''}</div></div></td>`;
    if (key === 'phone') return `<td class="n as-ph">${esc(p.phone || '—')}</td>`;
    if (key === 'amountAbs') return `<td class="num"><b class="n">${money(Math.abs(p.amount), Math.abs(p.amount) % 1 ? 2 : 0)}</b></td>`;
    if (key === 'payments') return `<td class="n">${p.payments || 1}</td>`;
    if (key === 'reason') return `<td class="muted">${esc(p.reason || '—')}</td>`;
    if (key === 'status') return `<td>${statusTag(tab, p)}</td>`;
    if (key === 'wa') return `<td style="text-align:left">${waLink(p.phone, tab === 'sales' || tab === 'refunds' ? 'וואטסאפ' : 'לשלוח הודעה')}</td>`;
    return '<td></td>';
  }

  function filtered(X) {
    const q = peopleQuery.trim().toLowerCase(), qd = q.replace(/\D/g, '');
    const rows = peopleRows(X, peopleTab);
    if (!q) return rows;
    return rows.filter((p) => String(p.name || '').toLowerCase().includes(q) || String(p.email || '').toLowerCase().includes(q) ||
      (qd.length >= 3 && String(p.phone || '').replace(/\D/g, '').includes(qd)));
  }

  function renderPeople(X) {
    const c = X.cur;
    const counts = { sales: c.ccUp ? c.sales.length : c.rmBuyers.length, failed: c.failed.length, leads: c.leads.length, refunds: c.refunds.length, other: c.other.length, tests: c.tests.length };
    const visible = ORDER.filter((k) => k === 'sales' || k === 'leads' || counts[k] > 0);
    if (!visible.includes(peopleTab)) peopleTab = 'sales';
    if (DATA.leadsDropBuyers) { TABS.leads.label = 'נטשו את העגלה'; TABS.leads.note = 'הגיעו לתשלום ולא קנו. מי שקונה יוצא מהרשימה הזאת ברב מסר'; }
    TABS.tests.note = `חיובים מתחת ל ${money(DATA.minRealAmount)}. הלוח מזהה אותם לפי הסכום ולא סופר אותם כמכירה`;

    const el = document.getElementById('ppl');
    el.innerHTML = `<div class="cd"><div class="cd-h"><div><div class="cd-t">${ic('users', 17)} האנשים</div><div class="cd-s" id="pplNote"></div></div>
      <div class="row" style="gap:8px;flex-wrap:wrap"><label class="as-search">${ic('search', 14)}<input class="as-in" id="pplQ" type="search" placeholder="חיפוש שם או טלפון" value="${esc(peopleQuery)}"></label><button class="btn" id="btnPplCsv" type="button">${ic('download', 14)}ייצוא</button></div></div>
      <div class="utabs as-tabs">${visible.map((k) => `<button data-t="${k}" class="${k === peopleTab ? 'on' : ''}" type="button">${TABS[k].label}<span class="n">${counts[k]}</span></button>`).join('')}</div>
      <div class="tbl-wrap"><table class="tbl"><thead></thead><tbody></tbody></table></div><div class="g-pg"></div></div>`;
    el.querySelectorAll('.as-tabs button').forEach((b) => (b.onclick = () => {
      peopleTab = b.dataset.t; peoplePage = 0; peopleSort = { key: 'at', dir: -1 }; saveView(); renderPeople(X);
    }));
    const q = el.querySelector('#pplQ');
    q.oninput = () => { peopleQuery = q.value; peoplePage = 0; drawPeople(X); };
    drawPeople(X);
  }

  function drawPeople(X) {
    const el = document.getElementById('ppl');
    const C = cols(peopleTab);
    if (!C.some(([k, , s]) => s && k === peopleSort.key)) peopleSort = { key: 'at', dir: -1 };
    const rows = sortBy(filtered(X), peopleSort);
    const pages = Math.max(1, Math.ceil(rows.length / PER_PAGE));
    peoplePage = Math.min(peoplePage, pages - 1);
    el.querySelector('#pplNote').textContent = TABS[peopleTab].note;
    el.querySelector('thead').innerHTML = `<tr>${C.map(([k, l, s]) => (s ? th(k, l, peopleSort, k === 'amountAbs' ? 'num' : '') : `<th>${l}</th>`)).join('')}</tr>`;
    el.querySelector('tbody').innerHTML = rows.slice(peoplePage * PER_PAGE, peoplePage * PER_PAGE + PER_PAGE)
      .map((p) => `<tr>${C.map(([k]) => cell(peopleTab, k, p)).join('')}</tr>`).join('') ||
      `<tr><td colspan="${C.length}" class="as-empty">${peopleQuery ? 'אף אחד לא מתאים לחיפוש' : 'אין כאן אף אחד בטווח הזה'}</td></tr>`;
    const a = rows.length ? peoplePage * PER_PAGE + 1 : 0, b = Math.min(rows.length, peoplePage * PER_PAGE + PER_PAGE);
    el.querySelector('.g-pg').innerHTML = `<span>מציג ${num(a)} עד ${num(b)} מתוך ${num(rows.length)}</span><div class="row" style="gap:6px"><button class="iconbtn" data-pg="-1" type="button" aria-label="הקודם">${ic('chevron-right', 15)}</button><span class="n" style="font-size:12px">${peoplePage + 1}/${pages}</span><button class="iconbtn" data-pg="1" type="button" aria-label="הבא">${ic('chevron-left', 15)}</button></div>`;
    el.querySelectorAll('thead th.s').forEach((h) => (h.onclick = () => {
      const k = h.dataset.k;
      peopleSort = { key: k, dir: peopleSort.key === k ? -peopleSort.dir : -1 };
      drawPeople(X);
    }));
    el.querySelectorAll('[data-pg]').forEach((bt) => (bt.onclick = () => { peoplePage = Math.max(0, Math.min(pages - 1, peoplePage + Number(bt.dataset.pg))); drawPeople(X); }));
  }

  /* ---------------------------------- ייצוא --------------------------------- */

  function csv(name, header, rows) {
    const q = (v) => { const s = String(v === null || v === undefined ? '' : v); return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
    const body = '﻿' + [header].concat(rows).map((r) => r.map(q).join(',')).join('\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([body], { type: 'text/csv;charset=utf-8' }));
    const r = window.__X.cur.r;
    a.download = `${name}-${r.since}-${r.until}.csv`;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  }
  function exportDays() {
    const rows = daily(window.__X.cur.r);
    csv('אסף-יום-אחר-יום', ['תאריך', 'הוצאה על פרסום', 'רכישות', 'הכנסה כולל מע״מ', 'הכנסה בלי מע״מ', 'הגיעו לתשלום', 'נטשו', 'כרטיסים שנדחו'],
      rows.map((x) => [x.date, x.spend.toFixed(2), x.purchases, x.gross.toFixed(2), x.net.toFixed(2), x.reached, x.abandoned, x.failed]));
  }
  function exportAds() {
    csv('אסף-מודעות', ['מודעה', 'קמפיין', 'מצב', 'הוצאה', 'רכישות', 'הכנסה נטו', 'תשואה', 'עלות לרכישה', 'צפיות בדף', 'קליקים', 'אחוז הקלקה', 'הצגות'],
      adRows().map((a) => [a.name, a.campaign, a.live ? 'פעילה' : 'מושהית', a.spend.toFixed(2), a.purchases, a.rev.toFixed(2), a.roas.toFixed(2), a.cpa.toFixed(2), a.landingViews || 0, a.linkClicks || 0, (a.ctr || 0).toFixed(2), a.impressions || 0]));
  }
  function exportPeople() {
    const X = window.__X;
    if (X.cur.mo) {
      csv('אסף-קמפיינים', ['קמפיין', 'הוצאה', 'רכישות', 'הכנסה נטו', 'תשואה', 'עלות לרכישה', 'מילאו טופס', 'הגיעו לתשלום', 'צפיות בדף', 'קליקים'],
        sortBy(adRows(DATA.meta.campaigns), campSort).map((a) => [a.name, a.spend.toFixed(2), a.purchases, a.rev.toFixed(2), a.roas.toFixed(2), a.cpa.toFixed(2), a.leads || 0, a.checkouts || 0, a.landingViews || 0, a.linkClicks || 0]));
      return;
    }
    const rows = sortBy(filtered(X), peopleSort);
    csv('אסף-' + TABS[peopleTab].label.replace(/\s+/g, '-'), ['מתי', 'שם', 'אימייל', 'טלפון', 'סכום', 'תשלומים', 'סיבה'],
      rows.map((p) => [p.at, p.name, p.email, p.phone, p.amount !== undefined ? Math.abs(p.amount) : '', p.payments || '', p.reason || '']));
  }

  /* --------------------------------- הסבר -------------------------------- */

  function renderFoot() {
    const vatPct = Math.round((DATA.vat || 0) * 100) + '%';
    const amounts = (DATA.courseAmounts || []).map((a) => money(a)).join(' או ');
    const how = DATA.onlyThisProduct
      ? 'המסוף מסליק רק את המוצר הזה, ולכן כל חיוב אמיתי נספר כמכירה. '
      : 'עסקה נחשבת של המוצר אם המשלם נכנס לרשימת הרוכשים ברב מסר בתוך שעה מהחיוב' + (amounts ? ', או אם הסכום הוא ' + amounts : '') + '. כל השאר מופיע בלשונית מוצרים אחרים. ';
    const ccUp = !!(DATA.cardcom && DATA.cardcom.ok);
    document.getElementById('foot').innerHTML =
      (metaOnly() ? 'הלוח מחובר רק למטא. הרכישות, ההכנסה, הטופס והתשלום נספרים מהפיקסל, רק ממי שהגיע מהמודעות, ולכן מכירה ממייל או מתנועה אורגנית לא מופיעה כאן. רכישה בלי סכום בפיקסל נספרת לפי ' + money(DATA.prices.main) + '. '
        : ccUp ?'ההכנסה נספרת מהסכומים האמיתיים במסוף הסליקה, פחות זיכויים. חיוב מתחת ל ' + money(DATA.minRealAmount) + ' נחשב בדיקה. ' + how
        : 'אין חיבור לסליקה, ולכן ההכנסה מחושבת מרשימות רב מסר לפי ' + money(DATA.prices.main) + ' למכירה. ') +
      (DATA.vat ? 'כל מקום שכתוב בו בלי מע״מ הוא אחרי הורדת מע״מ ' + vatPct + ', כלומר חלקי ' + (1 + DATA.vat).toFixed(2) + '. הוצאת הפרסום מגיעה ממטא לפני מע״מ ולכן לא יורדת שוב. '
        : 'העסק פטור ממע״מ, ולכן ההכנסה בלי מע״מ שווה להכנסה. ') +
      (DATA.campaignFilter ? 'נספרים רק קמפיינים במטא ששמם מכיל ״' + esc(DATA.campaignFilter) + '״. ' : 'נספר כל חשבון המודעות במטא, בלי סינון לפי שם קמפיין. ') +
      'התקופה הקודמת היא אותו מספר ימים מיד לפני הטווח שנבחר. ' +
      (metaZone() ? 'הימים של מטא נספרים לפי שעון ' + esc(metaZone()) + ', כי כך מוגדר חשבון המודעות.' : 'כל התאריכים בשעון ישראל.');
  }

  /* ---------------------------------- ציור ---------------------------------- */

  function render() {
    const X = derive();
    window.__X = X;
    paintHeader(X);
    renderKpis(X);
    renderChecks(X);
    renderFunnel(X);
    renderCum(X);
    renderAds(X);
    if (X.cur.mo) renderCampaigns(X); else renderPeople(X);
    renderFoot();
  }

  document.addEventListener('click', (e) => {
    const pre = e.target.closest('.cdp-preset');
    if (pre) { prefetch(pre.dataset.preset); return; }
    if (e.target.closest('#btnRefresh')) { load({ force: true }); return; }
    if (!DATA) return;
    if (e.target.closest('#btnExport')) { exportDays(); return; }
    if (e.target.closest('#btnAdsCsv')) { exportAds(); return; }
    if (e.target.closest('#btnPplCsv')) { exportPeople(); return; }
    const go = e.target.closest('.h6 .utabs button');
    if (go) {
      document.querySelectorAll('.h6 .utabs button').forEach((b) => b.classList.toggle('on', b === go));
      const t = document.getElementById(go.dataset.go);
      if (t) t.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  });

  /* ------------------------------ רענון לבד ------------------------------ */

  /* השרת שומר כל תשובה לתשעים שניות, אז שתי דקות תמיד נוחתות על מספרים טריים */
  const AUTO_MS = 120000;
  function startAuto() {
    setInterval(() => {
      if (document.hidden) return;
      const pop = document.getElementById('cdpPopup');
      if (pop && pop.classList.contains('open')) return;
      load({ quiet: true });
    }, AUTO_MS);
    document.addEventListener('visibilitychange', () => {
      if (document.hidden || !DATA) return;
      if (Date.now() - new Date(DATA.generatedAt).getTime() > AUTO_MS) load({ quiet: true });
    });
  }

  /* ---------------------------------- כניסה --------------------------------- */

  function start() {
    restoreView();
    document.getElementById('gate').style.display = 'none';
    document.getElementById('app').style.display = '';
    renderHeader();
    picker = window.CDP.create(state, () => { saveView(); load(); });
    load();
    startAuto();
  }

  /* בדיקת קוד מהירה: השרת עונה לפני שהוא פונה לקארדקום, רב מסר או מטא */
  function tryCode(c) {
    return fetch('/api/data?probe=1&k=' + encodeURIComponent(c)).then((r) => r.status !== 401).catch(() => null);
  }

  document.getElementById('gateBtn').addEventListener('click', () => {
    const v = document.getElementById('gateInput').value.trim();
    if (!v) return;
    const err = document.getElementById('gateErr');
    err.textContent = 'בודק…';
    tryCode(v).then((ok) => {
      if (ok === false) { err.textContent = 'קוד שגוי'; return; }
      if (ok === null) { err.textContent = 'אין חיבור, נסה שוב'; return; }
      code = v;
      writeStore(KEY_STORE, v);
      history.replaceState(null, '', location.pathname);
      start();
    });
  });
  document.getElementById('gateInput').addEventListener('keydown', (e) => { if (e.key === 'Enter') document.getElementById('gateBtn').click(); });

  /* קוד שנזכר נכנס ישר. אם בוטל, המשיכה מקבלת 401 וחוזרת למסך הכניסה */
  if (code) {
    writeStore(KEY_STORE, code);
    history.replaceState(null, '', location.pathname);
    start();
  } else {
    tryCode('').then((ok) => { if (ok === true) start(); else document.getElementById('gateInput').focus(); });
  }
})();
