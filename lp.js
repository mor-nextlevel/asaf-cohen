/* Mor landing page kit: vanilla, no libraries. Order matters: glue, then word split, then observers. */
(function(){
  "use strict";
  var d=document, root=d.documentElement;
  d.body.classList.remove("no-js"); root.classList.add("js");

  /* wrap every word of an element in span.w, keeping inner markup as is */
  function splitWords(el){
    var out=[], walker=d.createTreeWalker(el,NodeFilter.SHOW_TEXT,null), nodes=[], n;
    while((n=walker.nextNode())) nodes.push(n);
    nodes.forEach(function(node){
      var parts=node.nodeValue.split(/(\s+)/), frag=d.createDocumentFragment();
      parts.forEach(function(p){
        if(!p) return;
        if(/^\s+$/.test(p)){ frag.appendChild(d.createTextNode(p)); return; }
        var s=d.createElement("span"); s.className="w"; s.textContent=p; frag.appendChild(s); out.push(s);
      });
      node.parentNode.replaceChild(frag,node);
    });
    return out;
  }

  /* no line with a single word: the last two words of every line of copy travel together.
     Runs before the word split. The copy itself is not touched, only the kind of space. */
  function glue(block){
    var walker=d.createTreeWalker(block,NodeFilter.SHOW_TEXT,null), nodes=[], n;
    while((n=walker.nextNode())) nodes.push(n);
    nodes.forEach(function(node){
      var up=node, nx, end=true;
      while(up && up!==block){
        nx=up.nextSibling;
        while(nx && nx.nodeType===3 && !nx.nodeValue.trim()) nx=nx.nextSibling;
        if(nx){ end=nx.nodeName==="BR"; break; }
        up=up.parentNode;
      }
      if(!end) return;
      var m=node.nodeValue.match(/^([\s\S]*\S)[ \t\n]+(\S+)(\s*)$/);
      if(!m || m[2].length>13 || m[1].trim().split(/\s+/).length<3) return; /* short display lines stay free to balance */
      node.nodeValue=m[1]+"\u00A0"+m[2]+m[3];
    });
  }
  d.querySelectorAll("h1,h2,h3,h4,p,li,summary,figcaption,blockquote,.quote,[data-glue]").forEach(glue);

  /* hero headline */
  d.querySelectorAll(".rise").forEach(function(el){
    splitWords(el).forEach(function(w,i){ w.style.setProperty("--i",i); });
    requestAnimationFrame(function(){ requestAnimationFrame(function(){ el.classList.add("go"); }); });
  });

  /* reveal on scroll */
  function show(t){
    if(t.classList.contains("in")) return;
    t.classList.add("in"); io.unobserve(t); setTimeout(function(){ t.classList.add("done"); },1900);
  }
  var io=new IntersectionObserver(function(es){
    es.forEach(function(e){ if(e.isIntersecting) show(e.target); });
  },{threshold:.14,rootMargin:"0px 0px -6% 0px"});
  var pending=[].slice.call(d.querySelectorAll(".reveal,.fly-r,.fly-l"));
  pending.forEach(function(el){ io.observe(el); });
  /* safety net: whatever the observer missed (fast fling, in-app browsers) is shown once it is
     above the middle of the screen, and everything is shown at the end of the page */
  function sweep(){
    if(!pending.length) return;
    var vh=window.innerHeight, atEnd=window.scrollY+vh>=root.scrollHeight-4;
    pending=pending.filter(function(t){
      if(t.classList.contains("in")) return false;
      if(atEnd||t.getBoundingClientRect().top<vh*.5){ show(t); return false; }
      return true;
    });
  }

  /* lines that light up word by word with the scroll */
  var sf=[];
  d.querySelectorAll("[data-sfade]").forEach(function(el){ sf.push({el:el,words:splitWords(el)}); });
  function runSfade(){
    var vh=window.innerHeight;
    sf.forEach(function(o){
      var r=o.el.getBoundingClientRect(), start=vh*.86, end=vh*.42;
      var p=(start-r.top)/(r.height+start-end); p=Math.max(0,Math.min(1,p));
      var lit=Math.round(p*o.words.length);
      o.words.forEach(function(w,i){ w.classList.toggle("lit",i<lit); });
    });
  }

  /* belt at a fixed speed in px per second */
  function marquee(track,pps){
    if(!track) return;
    track.innerHTML=track.innerHTML+track.innerHTML+track.innerHTML+track.innerHTML;
    var off=0,last=0,half=0;
    function measure(){ half=track.scrollWidth/2; }
    measure(); window.addEventListener("load",measure); window.addEventListener("resize",measure,{passive:true});
    function frame(ts){
      if(!last) last=ts; var dt=Math.min(.1,(ts-last)/1000); last=ts;
      if(half>0){ off-=pps*dt; if(off<=-half) off+=half; track.style.transform="translateX("+off.toFixed(2)+"px)"; }
      requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
  }
  marquee(d.getElementById("seenTrack"),34);

  /* counter */
  var cio=new IntersectionObserver(function(es){
    es.forEach(function(e){
      if(!e.isIntersecting) return; cio.unobserve(e.target);
      var el=e.target, target=+el.getAttribute("data-count"), t0=performance.now();
      (function step(now){
        var p=Math.min((now-t0)/1700,1), v=Math.round(target*(1-Math.pow(1-p,3)));
        el.textContent=v.toLocaleString("en-US"); if(p<1) requestAnimationFrame(step);
      })(t0);
    });
  },{threshold:.6});
  d.querySelectorAll("[data-count]").forEach(function(el){ el.textContent="0"; cio.observe(el); });

  /* cursor light: desktop only */
  if(window.matchMedia && window.matchMedia("(pointer:fine)").matches){
    var mx=0,my=0,pend=false;
    window.addEventListener("pointermove",function(e){
      mx=e.clientX; my=e.clientY; d.body.classList.add("spot-on");
      if(!pend){ pend=true; requestAnimationFrame(function(){ pend=false; root.style.setProperty("--mx",mx+"px"); root.style.setProperty("--my",my+"px"); }); }
    },{passive:true});
  }

  /* smooth jump only on a real click on an in-page link, so scripts and tests scroll instantly */
  var calm=window.matchMedia && window.matchMedia("(prefers-reduced-motion:reduce)").matches;
  d.querySelectorAll('a[href^="#"]').forEach(function(a){
    a.addEventListener("click",function(e){
      var t=d.getElementById(a.getAttribute("href").slice(1)); if(!t) return;
      e.preventDefault(); t.scrollIntoView({behavior:calm?"auto":"smooth",block:"start"});
    });
  });

  /* DEMO ONLY: the form shows its thank-you line and goes nowhere. On a real page replace this
     block with the real checkout or lead submit. */
  d.querySelectorAll(".buyform").forEach(function(f){
    f.addEventListener("submit",function(e){ e.preventDefault(); if(f.checkValidity()) f.classList.add("sent"); else f.reportValidity(); });
  });

  var tick=false;
  window.addEventListener("scroll",function(){ if(!tick){ tick=true; requestAnimationFrame(function(){ runSfade(); sweep(); tick=false; }); } },{passive:true});
  window.addEventListener("resize",runSfade); runSfade();
})();

/* ENRICHMENT: the reels gallery (#reels) and the swipe dots of the proof wall (#pfWall + #pfDots).
   Both do nothing when the page has no such block. See enrich.md. */
(function(){
  var d=document;
  var desk=window.matchMedia("(min-width:860px)");
  var reduce=window.matchMedia("(prefers-reduced-motion:reduce)").matches;

  function nearest(track,items){
    var r=track.getBoundingClientRect(), mid=r.left+r.width/2, best=0, bd=1e9;
    items.forEach(function(c,k){ var b=c.getBoundingClientRect(), dd=Math.abs(b.left+b.width/2-mid); if(dd<bd){ bd=dd; best=k; } });
    return best;
  }
  function center(track,el,smooth){
    var r=track.getBoundingClientRect(), b=el.getBoundingClientRect();
    track.scrollBy({left:(b.left+b.width/2)-(r.left+r.width/2),behavior:smooth?"smooth":"auto"});
  }

  /* ---- reels: one clip plays at a time, muted, loaded only when its turn comes ---- */
  [].slice.call(d.querySelectorAll(".reels")).forEach(function(box){
    var track=box.querySelector(".reels__track");
    var cards=[].slice.call(box.querySelectorAll(".reel"));
    var dots=[].slice.call(box.querySelectorAll(".reels__dots i"));
    var on=-1, visible=false, st;
    function vid(k){ return cards[k].querySelector("video"); }
    function start(k){
      var v=vid(k);
      if(!v.getAttribute("src")) v.src=v.getAttribute("data-src");
      v.loop=!desk.matches;
      var p=v.play(); if(p&&p.catch) p.catch(function(){});
    }
    function setOn(k,force){
      if(k===on&&!force) return;
      on=k;
      cards.forEach(function(c,i){
        c.classList.toggle("is-on",i===k);
        if(dots[i]) dots[i].classList.toggle("on",i===k);
        if(i!==k){ var v=vid(i); if(!v.paused) v.pause(); }
      });
      if(visible&&(!reduce||force)) start(k);
    }
    track.addEventListener("scroll",function(){
      if(desk.matches) return;
      clearTimeout(st); st=setTimeout(function(){ setOn(nearest(track,cards)); },90);
    },{passive:true});
    cards.forEach(function(c,k){
      c.addEventListener("mouseenter",function(){ if(desk.matches) setOn(k); });
      c.addEventListener("click",function(){
        if(!desk.matches) center(track,c,true);
        setOn(k,reduce);
      });
      vid(k).addEventListener("ended",function(){ if(desk.matches&&on===k) setOn((k+1)%cards.length); });
    });
    var mid=Math.floor(cards.length/2);
    if(!desk.matches) center(track,cards[mid],false);
    setOn(mid);
    if("IntersectionObserver" in window){
      new IntersectionObserver(function(es){
        visible=es[0].isIntersecting;
        if(visible){ if(!reduce) start(on); }
        else cards.forEach(function(c,i){ vid(i).pause(); });
      },{threshold:.25}).observe(box);
    }
  });

  /* ---- proof wall: dots follow the swipe on phones ---- */
  var wall=d.getElementById("pfWall");
  if(wall){
    var wc=[].slice.call(wall.children), wd=[].slice.call(d.querySelectorAll("#pfDots i")), wt;
    var upd=function(){ var k=nearest(wall,wc); wd.forEach(function(x,i){ x.classList.toggle("on",i===k); }); };
    wall.addEventListener("scroll",function(){ clearTimeout(wt); wt=setTimeout(upd,60); },{passive:true});
    upd();
  }

  /* ---- money cards (04.10, Mor loved them): the sponsored posts turn like a feed and the count climbs,
     the mail card lights one more week each time a letter rises, and every video[data-auto] loads and
     plays only while on screen. Markup in snippets/money-uses.html ---- */
  var still=window.matchMedia("(prefers-reduced-motion:reduce)").matches;
  d.querySelectorAll("[data-adstack]").forEach(function(st){
    var cards=[].slice.call(st.querySelectorAll(".adc")), num=st.querySelector("[data-adcount]"), pill=st.querySelector(".adcount"), counts=[20,30,50], c=0;
    if(still) return;
    setInterval(function(){
      if(!st.getBoundingClientRect().height) return;
      cards.forEach(function(k){ var p=+k.getAttribute("data-pos"); k.setAttribute("data-pos",String((p+1)%3)); });
      c=(c+1)%counts.length; if(num) num.textContent=counts[c];
      if(pill){ pill.classList.remove("bump"); void pill.offsetWidth; pill.classList.add("bump"); }
    },2800);
  });
  d.querySelectorAll(".ml__weeks").forEach(function(w){
    var ws=[].slice.call(w.children), k=0;
    if(still){ ws.forEach(function(x){ x.classList.add("on"); }); return; }
    setTimeout(function tick(){
      if(k>=ws.length){ ws.forEach(function(x){ x.classList.remove("on"); }); k=0; } else ws[k++].classList.add("on");
      setTimeout(tick,4200);
    },1600);
  });
  var autos=[].slice.call(d.querySelectorAll("video[data-auto]"));
  if(autos.length&&"IntersectionObserver" in window){
    var aio=new IntersectionObserver(function(es){
      es.forEach(function(e){
        var v=e.target;
        if(e.isIntersecting){
          if(!v.getAttribute("src")) v.src=v.getAttribute("data-src");
          if(!still){ var p=v.play(); if(p&&p.catch) p.catch(function(){}); }
        } else if(!v.paused) v.pause();
      });
    },{threshold:.2,rootMargin:"120px 0px"});
    autos.forEach(function(v){ aio.observe(v); });
  }
})();
