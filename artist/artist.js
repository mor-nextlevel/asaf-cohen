/* מדיג׳יי לאומן · page behaviour on top of lp.js and asaf.js. */
(function(d){
  /* The questionnaire (apply/index.html). It reads name, email and phone from the address and skips asking them again. */
  var QUIZ="/apply";

  /* the playlist: one wish plays at a time, in turn */
  var trks=[].slice.call(d.querySelectorAll(".trk")),cur=-1,timer=null;
  function play(k){trks.forEach(function(t,i){t.classList.toggle("on",i===k);});cur=k;}
  if(trks.length){
    var tio=new IntersectionObserver(function(es){
      es.forEach(function(e){
        if(e.isIntersecting&&!timer){play(0);timer=setInterval(function(){play((cur+1)%trks.length);},2600);}
      });
    },{threshold:.4});
    tio.observe(trks[0].parentNode);
    trks.forEach(function(t,i){t.addEventListener("mouseenter",function(){play(i);});});
  }

  /* the arrangement: the playhead runs the width of the timeline */
  var daw=d.querySelector(".daw");
  function measure(){
    if(!daw) return;
    var t=daw.querySelector(".lane__time");
    if(t) daw.style.setProperty("--tw",t.getBoundingClientRect().width+"px");
  }
  measure(); window.addEventListener("resize",measure,{passive:true}); window.addEventListener("load",measure);

  /* the form: name, mail, phone, then on to the questionnaire */
  d.querySelectorAll(".applyform").forEach(function(f){
    var note=f.querySelector(".thanks");
    f.addEventListener("submit",function(e){
      e.preventDefault();
      if(!f.checkValidity()){f.reportValidity();return;}
      f.classList.add("sent");
      try{fbq("track","Lead");}catch(_){}
      note.textContent="עוברים לשאלון…";
      var qs=new URLSearchParams({name:f.name.value.trim(),email:f.email.value.trim(),phone:f.phone.value.trim()});
      var here=new URLSearchParams(location.search);
      ["utm_source","utm_medium","utm_campaign","utm_content","utm_term","fbclid","ref"].forEach(function(k){if(here.get(k))qs.set(k,here.get(k));});
      setTimeout(function(){location.href=QUIZ+"?"+qs.toString();},350);
    });
  });
})(document);
