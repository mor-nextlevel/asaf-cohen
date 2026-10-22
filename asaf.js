/* Student video testimonials: tap plays with sound, pauses the others. */
(function(d){
  var cards=[].slice.call(d.querySelectorAll(".vt"));
  function stop(c){var v=c.querySelector("video");if(!v.paused)v.pause();c.classList.remove("is-on");}
  cards.forEach(function(c){
    var v=c.querySelector("video");
    v.addEventListener("pause",function(){c.classList.remove("is-on");});
    v.addEventListener("ended",function(){c.classList.remove("is-on");});
    c.addEventListener("click",function(){
      if(c.classList.contains("is-on")){stop(c);return;}
      cards.forEach(function(o){if(o!==c)stop(o);});
      [].slice.call(d.querySelectorAll(".reel video,video[data-auto]")).forEach(function(o){o.muted=true;});
      if(!v.getAttribute("src")&&v.dataset.src)v.src=v.dataset.src;
      v.muted=false;c.classList.add("is-on");
      var p=v.play();if(p&&p.catch)p.catch(function(){c.classList.remove("is-on");});
    });
  });
})(document);
/* Volume buttons (22.10): every silent clip and the record start muted. A tap swaps in the version with sound
   from the same moment, one sound at a time. A clip that stops playing goes quiet again. */
(function(d){
  var OFF='<svg class="snd__off" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9v6h4l5 4V5L8 9z"/><path d="M17 9.5l5 5M22 9.5l-5 5"/></svg>',
      ON='<svg class="snd__on" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9v6h4l5 4V5L8 9z"/><path d="M16.5 8.5a5 5 0 010 7M19.5 5.5a9 9 0 010 13"/></svg>',
      cur=null;
  function btn(host){
    var b=d.createElement("button");b.type="button";b.className="snd";b.innerHTML=OFF+ON;
    mark(b,false);host.appendChild(b);return b;
  }
  function mark(b,on){b.classList.toggle("is-on",on);b.setAttribute("aria-pressed",on?"true":"false");b.setAttribute("aria-label",on?"להשתיק":"להפעיל סאונד");}
  function take(o){if(cur&&cur!==o)cur.off();cur=o;}
  [].slice.call(d.querySelectorAll(".vt video")).forEach(function(v){v.addEventListener("play",function(){if(cur)cur.off();});});

  [].slice.call(d.querySelectorAll("video[data-snd]")).forEach(function(v){
    var b=btn(v.parentNode),sw=false,o={off:function(){v.muted=true;}};
    v.addEventListener("volumechange",function(){mark(b,!v.muted);if(v.muted&&cur===o)cur=null;});
    v.addEventListener("playing",function(){sw=false;});
    v.addEventListener("pause",function(){if(!sw&&!v.muted)v.muted=true;});
    b.addEventListener("click",function(){
      if(!v.muted){v.muted=true;return;}
      take(o);
      if(!v._snd){
        var t=v.getAttribute("src")?v.currentTime:0;
        sw=true;v._snd=true;v.src=v.getAttribute("data-snd")+(t>.2?"#t="+t.toFixed(2):"");
      }
      v.muted=false;
      var p=v.play();if(p&&p.catch)p.catch(function(e){if(e&&e.name==="NotAllowedError"){sw=false;v.muted=true;}});
    });
  });

  var vin=d.querySelector(".vinyl[data-song]");
  if(vin){
    var a=new Audio(),b=btn(vin),o={off:function(){a.pause();}};
    a.preload="none";
    a.addEventListener("play",function(){mark(b,true);vin.classList.add("is-on");});
    a.addEventListener("pause",function(){mark(b,false);vin.classList.remove("is-on");if(cur===o)cur=null;});
    b.addEventListener("click",function(){
      if(!a.paused){a.pause();return;}
      take(o);
      if(!a.getAttribute("src"))a.src=vin.getAttribute("data-song");
      var p=a.play();if(p&&p.catch)p.catch(function(){mark(b,false);});
    });
  }
})(document);
