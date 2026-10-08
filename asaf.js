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
