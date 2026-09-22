/* Start-, Einladungs- und Fehlerbildschirme. */

/* ============================ Rendering ============================ */
/* ---------- Startbildschirme ---------- */
function viewStart(){
  const saved=LS.get("wl_host",null), room=LS.get("wl_room",null);
  const fresh=o=>o&&Date.now()-o.ts<MAXAGE&&(!o.owner||o.owner===myPid);
  paint(`<div class="start">`+HEAD+
  `<p class="sub">Zwischen zwei Gegensätzen liegt ein verstecktes Ziel. Nur das <em>Medium</em> sieht es und gibt einen einzigen Hinweis – der Rest dreht den Zeiger.</p>`+
  (fresh(saved)?`<div class="card glow rise"><h2>Raum ${esc(saved.code)} fortsetzen</h2>
     <div class="note" style="margin-top:0">Dein letzter Raum läuft noch – Punkte und Spieler bleiben erhalten.</div>
     <button id="res">Raum ${esc(saved.code)} wieder öffnen</button>
     <button id="resx" class="sec">Verwerfen</button></div>`:"")+
  (!fresh(saved)&&fresh(room)?`<div class="card glow rise"><h2>Zurück zu Raum ${esc(room.code)}</h2>
     <div class="note" style="margin-top:0">Du warst als <b>${esc(room.name)}</b> dabei.</div>
     <button id="back">Wieder beitreten</button>
     <button id="backx" class="sec">Verwerfen</button></div>`:"")+
  `<div class="startwrap">
     <div class="startaktionen">
       <div class="card rise"><h2>Neuen Raum aufmachen</h2>
         <div class="note" style="margin-top:0">Du bist der Host, wählst Teams oder Einzelspiel, Punktziel und Zeiten – und startest die Runden.</div>
         <button id="mk">Raum erstellen</button></div>
       <div class="card rise"><h2>Einem Raum beitreten</h2>
         <label for="cd" style="margin-top:10px">Raum-Code</label>
         <input id="cd" class="code" maxlength="4" placeholder="XXXX" autocomplete="off" autocapitalize="characters">
         <button id="jn" class="sec">Beitreten</button></div>
     </div>
     <div class="card rise startprofil">
       <label for="nm">Dein Name</label>
       <input id="nm" maxlength="16" placeholder="z.B. Alex" autocomplete="nickname">
       <label style="margin-top:16px">Dein Emoji</label>
       <div class="emogrid" id="emo">${EMOJIS.map(e=>
          `<button data-e="${e}" class="${myEmoji===e?"on":""}">${e}</button>`).join("")}</div>
       <label style="margin-top:16px">Deine Farbe</label>
       <div class="colgrid" id="col">${FARBEN.map(c=>
          `<button data-c="${c}" class="${myColor===c?"on":""}" title="Farbe"
            style="background:linear-gradient(140deg,${c},${mische(c,.65)})"></button>`).join("")}
         <label class="eigen ${FARBEN.indexOf(myColor)<0&&myColor?"on":""}" title="Eigene Farbe">
           <input type="color" id="colpick"><span>+</span>
         </label></div>
       <div id="prev"></div>
     </div>
   </div>
   <div class="netzzeile"><button id="netz" class="sec">Verbindung testen</button></div>
   <div class="foot">Kein Konto, kein Download – nur der Raum-Code.<br>Läuft in jedem Netz: WLAN, Mobilfunk, quer durcheinander.</div></div>`);

  const nm=el("nm"),cd=el("cd");
  nm.value=LS.get("fi_name","")||"";
  /* Live-Vorschau: genau so taucht man gleich in der Spielerliste auf. */
  const prev=()=>{
    el("prev").innerHTML=`<div class="prevrow">
      ${avatar({pid:myPid,name:nm.value.trim()||"Spieler",emoji:myEmoji,color:myColor})}
      <span class="nm">${esc(nm.value.trim()||"Spieler")}<span class="tag you">du</span></span>
      <span class="pts">0 Pkt</span></div>`;
  };
  prev();
  nm.oninput=prev;
  app.querySelectorAll("#emo [data-e]").forEach(b=>b.onclick=()=>{
    myEmoji=(myEmoji===b.dataset.e)?"":b.dataset.e;
    LS.set("fi_emoji",myEmoji);
    app.querySelectorAll("#emo [data-e]").forEach(x=>x.classList.toggle("on",x.dataset.e===myEmoji));
    prev();
  });
  const setzeFarbe=c=>{
    myColor=c; LS.set("fi_color",c);
    app.querySelectorAll("#col [data-c]").forEach(x=>x.classList.toggle("on",x.dataset.c===myColor));
    prev();
  };
  app.querySelectorAll("#col [data-c]").forEach(b=>b.onclick=()=>setzeFarbe(b.dataset.c));
  const pick=el("colpick");
  if(pick){
    if(document.activeElement!==pick) pick.value=(typeof myColor==="string"?myColor:FARBEN[0]);
    pick.oninput=()=>setzeFarbe(pick.value);
  }

  const name=()=>{ const n=(nm.value.trim()||"Spieler").slice(0,16); LS.set("fi_name",nm.value.trim()); return n; };
  if(el("netz")) el("netz").onclick=()=>{ screen="netz"; render(); };
  el("mk").onclick=()=>{ LS.delMine("wl_host"); LS.delMine("wl_room"); startHost(name()); };
  el("jn").onclick=()=>{ const c=cd.value.trim().toUpperCase(); if(c.length<4){cd.focus();return;} LS.delMine("wl_host"); startClient(c,name()); };
  cd.oninput=()=>cd.value=cd.value.toUpperCase().replace(/[^A-Z0-9]/g,"");
  cd.onkeydown=e=>{ if(e.key==="Enter") el("jn").click(); };
  nm.onkeydown=e=>{ if(e.key==="Enter") el("mk").click(); };
  if(el("res"))  el("res").onclick=()=>startHost(LS.get("fi_name","Host"),saved);
  if(el("resx")) el("resx").onclick=()=>{ LS.delMine("wl_host"); render(); };
  if(el("back")) el("back").onclick=()=>startClient(room.code,room.name);
  if(el("backx"))el("backx").onclick=()=>{ LS.delMine("wl_room"); render(); };
}
function viewInvite(){
  paint(`<div class="solo">`+HEAD+
  `<p class="sub">Du wurdest eingeladen</p>
   <div class="card glow code-hero rise"><div class="lbl">Raum</div><div class="val">${esc(inviteCode)}</div></div>
   <div class="card rise">
     <label for="nm">Wie heißt du?</label>
     <input id="nm" maxlength="16" placeholder="Dein Name" autocomplete="nickname" enterkeyhint="go">
     <label style="margin-top:16px">Dein Emoji</label>
     <div class="emogrid" id="emo">${EMOJIS.map(e=>
        `<button data-e="${e}" class="${myEmoji===e?"on":""}">${e}</button>`).join("")}</div>
     <label style="margin-top:16px">Deine Farbe</label>
     <div class="colgrid" id="col">${FARBEN.map(c=>
        `<button data-c="${c}" class="${myColor===c?"on":""}" title="Farbe"
          style="background:linear-gradient(140deg,${c},${mische(c,.65)})"></button>`).join("")}
       <label class="eigen ${FARBEN.indexOf(myColor)<0&&myColor?"on":""}" title="Eigene Farbe">
         <input type="color" id="colpick"><span>+</span>
       </label></div>
     <div id="prev"></div>
     <button id="jn">Raum beitreten</button>
   </div>
   <button id="own" class="sec">Lieber einen eigenen Raum erstellen</button>
   <div class="foot">Ab 3 Spielern kann der Host die Runde starten.</div></div>`);
  const nm=el("nm"); nm.value=LS.get("fi_name","")||"";
  const prev=()=>{
    el("prev").innerHTML=`<div class="prevrow">
      ${avatar({pid:myPid,name:nm.value.trim()||"Spieler",emoji:myEmoji,color:myColor})}
      <span class="nm">${esc(nm.value.trim()||"Spieler")}<span class="tag you">du</span></span>
      <span class="pts">0 Pkt</span></div>`;
  };
  prev(); nm.oninput=prev;
  app.querySelectorAll("#emo [data-e]").forEach(b=>b.onclick=()=>{
    myEmoji=(myEmoji===b.dataset.e)?"":b.dataset.e;
    LS.set("fi_emoji",myEmoji);
    app.querySelectorAll("#emo [data-e]").forEach(x=>x.classList.toggle("on",x.dataset.e===myEmoji));
    prev();
  });
  const setzeFarbe=c=>{
    myColor=c; LS.set("fi_color",c);
    app.querySelectorAll("#col [data-c]").forEach(x=>x.classList.toggle("on",x.dataset.c===myColor));
    prev();
  };
  app.querySelectorAll("#col [data-c]").forEach(b=>b.onclick=()=>setzeFarbe(b.dataset.c));
  const pick=el("colpick");
  if(pick){
    if(document.activeElement!==pick) pick.value=(typeof myColor==="string"?myColor:FARBEN[0]);
    pick.oninput=()=>setzeFarbe(pick.value);
  }
  const go=()=>{ const n=(nm.value.trim()||"Spieler").slice(0,16); LS.set("fi_name",nm.value.trim()); startClient(inviteCode,n); };
  el("jn").onclick=go; nm.onkeydown=e=>{ if(e.key==="Enter") go(); };
  el("own").onclick=()=>{ inviteCode=""; screen="start"; render(); };
  nm.focus();
}
function viewWait(){ document.title=TITLE; paint(`<div class="solo">`+HEAD+`<div class="card center rise"><span class="spin"></span>Verbinde…</div></div>`); }
function viewError(){
  paint(`<div class="solo">`+HEAD+
    `<div class="card bad rise"><h2>Da ist was schiefgelaufen</h2><div class="note">${esc(errMsg)}</div></div>`+
    (fehlerRaum?`<button id="nochmal">Nochmal versuchen</button>`:"")+
    `<button id="rl" class="${fehlerRaum?"sec":""}">${fehlerRaum?"Neuen Raum aufmachen":"Von vorn anfangen"}</button>
     <button id="hub" class="sec">Zurück zum Spielraum</button></div>`);
  if(el("nochmal")) el("nochmal").onclick=()=>location.replace(location.pathname);
  el("hub").onclick=()=>{ location.href="../"; };
  /* Wichtig: auch den gespeicherten Raum des Hosts vergessen – sonst landet
     man beim Neuladen sofort wieder im selben Fehler. */
  el("rl").onclick=()=>{ LS.delMine("wl_room"); LS.delMine("wl_host"); location.replace(location.pathname); };
}
function viewKicked(){
  paint(`<div class="solo">`+HEAD+`<div class="card bad rise"><h2>Du bist raus</h2>
    <div class="note">Der Host hat dich aus dem Raum entfernt.</div></div>
    <button id="rl">Zur Startseite</button></div>`);
  el("rl").onclick=()=>location.replace(location.pathname);
}


/* ---------- Verbindungstest ----------
   Zeigt, ob der Relay-Dienst erreichbar ist und ob Nachrichten wirklich
   durchkommen. Mehr braucht es nicht: es gibt keine Direktverbindung
   zwischen den Geraeten, an der ein Netz scheitern koennte. */
let netzStand=null, netzLaeuft=false;

function viewNetztest(){
  const e=netzStand;
  const zeile=(titel,wert,gut,erklaerung)=>`<div class="pruef ${gut===null?"":gut?"gut":"schlecht"}">
    <span class="pz">${gut===null?"…":gut?"✓":"✗"}</span>
    <span class="pt"><b>${titel}</b><small>${erklaerung}</small></span>
    <span class="pw">${esc(wert)}</span></div>`;

  paint(`<div class="solo">`+HEAD+
   `<div class="card rise"><h2>Verbindung testen</h2>
      <div class="note" style="margin-top:0">Wavelength läuft über einen Relay-Dienst im Internet.
        Jedes Gerät baut nur eine ausgehende Verbindung dorthin auf – so wie beim Laden einer Webseite.
        Deshalb ist es egal, wer in welchem WLAN oder Mobilfunknetz sitzt.</div>
      ${netzLaeuft?`<div class="center" style="margin-top:16px"><span class="spin"></span>Prüfe…</div>`:""}
      ${e?`<div style="margin-top:16px">
         ${zeile("Relay erreichbar",e.verbunden?"ja":"nein",e.verbunden,
                 "Die Verbindung, über die alle Mitspieler zusammenfinden.")}
         ${zeile("Nachrichten kommen an",e.durchgang?"ja":"nein",e.durchgang,
                 "Eine Testnachricht wurde gesendet und wieder empfangen.")}
         ${zeile("Antwortzeit",e.ms?e.ms+" ms":"—",e.ms?e.ms<3000:null,
                 "So lange braucht eine Nachricht hin und zurück.")}
       </div>
       <div class="card ${e.durchgang?"win":"lose"} center" style="margin-top:16px;padding:18px">
         <div class="verdict ${e.durchgang?"g":"r"}" style="font-size:19px">${
           e.durchgang?"Alles bereit":"Keine Verbindung"}</div>
         <div class="vsub">${e.durchgang
           ? "Du kannst mit allen spielen – egal in welchem Netz sie sind."
           : "Der Relay-Dienst ist von hier aus nicht erreichbar. Das passiert in Netzen, die WebSockets blockieren – etwa in manchen Firmen- und Schulnetzen. Probier es über ein Mobilfunknetz oder ein anderes WLAN."}</div>
       </div>`:""}
      <button id="start" style="margin-top:16px">${e?"Nochmal prüfen":"Prüfung starten"}</button>
    </div>
    <button id="zurueck" class="sec">Zurück</button></div>`);

  el("zurueck").onclick=()=>{ screen="start"; render(); };
  el("start").onclick=starteNetztest;
}

function starteNetztest(){
  if(netzLaeuft) return;
  netzLaeuft=true; netzStand=null; render();
  const stand={verbunden:false, durchgang:false, ms:0};
  const t0=Date.now();
  const thema=APP+"test/"+Math.random().toString(36).slice(2,10);
  let c=null, fertigGemeldet=false;
  const fertig=()=>{
    if(fertigGemeldet) return;
    fertigGemeldet=true;
    try{ c&&c.end(true); }catch(_){}
    netzLaeuft=false; netzStand=stand; render();
  };
  const frist=setTimeout(fertig,14000);
  try{
    c=mqtt.connect(RELAYS[relaisNr%RELAYS.length],
      {clean:true,connectTimeout:8000,reconnectPeriod:0,
       clientId:"srtest_"+Math.random().toString(36).slice(2,9)});
  }catch(_){ clearTimeout(frist); fertig(); return; }
  c.on("connect",()=>{
    stand.verbunden=true;
    c.subscribe(thema,{qos:0},err=>{
      if(err){ clearTimeout(frist); fertig(); return; }
      c.publish(thema,JSON.stringify({probe:Date.now()}),{qos:0});
    });
  });
  c.on("message",()=>{
    stand.durchgang=true; stand.ms=Date.now()-t0;
    clearTimeout(frist); fertig();
  });
  c.on("error",()=>{ clearTimeout(frist); fertig(); });
}
