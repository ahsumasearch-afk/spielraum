/* Start-, Einladungs- und Fehlerbildschirme. */

/* ============================ Rendering ============================ */
/* ---------- Startbildschirme ---------- */
function viewStart(){
  const saved=LS.get("mm_host",null), room=LS.get("mm_room",null);
  const fresh=o=>o&&Date.now()-o.ts<MAXAGE&&(!o.owner||o.owner===myPid);
  paint(`<div class="start">`+HEAD+
  `<p class="sub">Der King antwortet zuerst. Alle anderen müssen etwas <em>anderes</em> sagen – gleiche Antwort kostet ein Leben.</p>`+
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
         <div class="note" style="margin-top:0">Du bist der Host, stellst Runden, Fragen und Zeiten ein und startest das Spiel.</div>
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
   <div class="foot">Läuft direkt zwischen euren Geräten.<br>Kein Konto, keine Daten auf einem Server.</div></div>`);

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
  el("mk").onclick=()=>{ LS.delMine("mm_host"); LS.delMine("mm_room"); startHost(name()); };
  el("jn").onclick=()=>{ const c=cd.value.trim().toUpperCase(); if(c.length<4){cd.focus();return;} LS.delMine("mm_host"); startClient(c,name()); };
  cd.oninput=()=>cd.value=cd.value.toUpperCase().replace(/[^A-Z0-9]/g,"");
  cd.onkeydown=e=>{ if(e.key==="Enter") el("jn").click(); };
  nm.onkeydown=e=>{ if(e.key==="Enter") el("mk").click(); };
  if(el("res"))  el("res").onclick=()=>startHost(LS.get("fi_name","Host"),saved);
  if(el("resx")) el("resx").onclick=()=>{ LS.delMine("mm_host"); render(); };
  if(el("back")) el("back").onclick=()=>startClient(room.code,room.name);
  if(el("backx"))el("backx").onclick=()=>{ LS.delMine("mm_room"); render(); };
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
  el("rl").onclick=()=>{ LS.delMine("mm_room"); LS.delMine("mm_host"); location.replace(location.pathname); };
}
function viewKicked(){
  paint(`<div class="solo">`+HEAD+`<div class="card bad rise"><h2>Du bist raus</h2>
    <div class="note">Der Host hat dich aus dem Raum entfernt.</div></div>
    <button id="rl">Zur Startseite</button></div>`);
  el("rl").onclick=()=>location.replace(location.pathname);
}


/* ---------- Verbindungstest ----------
   Zeigt, ob dieses Geraet ueber das eigene Netz hinaus erreichbar ist. Wer
   nicht mit Leuten aus anderen Netzen spielen kann, sieht hier, woran es
   liegt – und kann eigene Relay-Zugangsdaten hinterlegen. */
let netzStand=null, netzLaeuft=false;

function viewNetztest(){
  const e=netzStand;
  const zeile=(titel,wert,gut,erklaerung)=>`<div class="pruef ${gut===null?"":gut?"gut":"schlecht"}">
    <span class="pz">${gut===null?"…":gut?"✓":"✗"}</span>
    <span class="pt"><b>${titel}</b><small>${erklaerung}</small></span>
    <span class="pw">${esc(wert)}</span></div>`;

  const eigen=LS.get("mm_turn",null);

  paint(`<div class="solo">`+HEAD+
   `<div class="card rise"><h2>Verbindung testen</h2>
      <div class="note" style="margin-top:0">Mind-Match verbindet die Geräte direkt miteinander.
        Hier siehst du, ob das über dein Netz hinaus funktioniert.</div>
      ${netzLaeuft?`<div class="center" style="margin-top:16px"><span class="spin"></span>Prüfe…</div>`:""}
      ${e?`<div style="margin-top:16px">
         ${zeile("Treffpunkt-Server",e.broker?"erreichbar":"nicht erreichbar",e.broker,
                 "Über ihn finden sich zwei Geräte anhand des Raum-Codes.")}
         ${zeile("Deine öffentliche Adresse",e.stun?"gefunden":"nicht gefunden",e.stun,
                 "Nötig, damit dich Leute aus anderen Netzen erreichen können.")}
         ${zeile("Relay für strenge Netze",e.turn?"vorhanden":"keins verfügbar",e.turn,
                 "Nur nötig, wenn der Router keine direkte Verbindung zulässt.")}
       </div>
       <div class="card ${e.broker&&e.stun?"win":"lose"} center" style="margin-top:16px;padding:18px">
         <div class="verdict ${e.broker&&e.stun?"g":"r"}" style="font-size:19px">${
           !e.broker ? "Keine Verbindung möglich"
           : e.stun&&e.turn ? "Bestens – auch strenge Netze"
           : e.stun ? "Sollte funktionieren"
           : "Nur im selben Netz"}</div>
         <div class="vsub">${
           !e.broker ? "Der Treffpunkt-Server ist gerade nicht erreichbar. Das liegt meist an einem Firmen- oder Schulnetz, das WebSockets blockiert. Probiert es über ein Mobilfunknetz."
           : e.stun&&e.turn ? "Dein Gerät ist von außen erreichbar und es steht ein Relay bereit. Spiele über verschiedene Netze hinweg sollten klappen."
           : e.stun ? "Dein Gerät ist von außen erreichbar. In den meisten Netzen genügt das. Klappt es mit jemandem trotzdem nicht, ist eines der beiden Netze besonders streng – dann hilft nur ein Relay (siehe unten)."
           : "Dein Gerät ist von außen nicht erreichbar. Mit Leuten aus anderen Netzen wird es so nicht gehen – dafür braucht es ein Relay."}</div>
       </div>`:""}
      <button id="start" style="margin-top:16px">${e?"Nochmal prüfen":"Prüfung starten"}</button>
    </div>

    <div class="card rise"><h2>Eigenes Relay hinterlegen</h2>
      <div class="note" style="margin-top:0">Nur nötig, wenn oben „keins verfügbar" steht <em>und</em> das Spielen
        über verschiedene Netze nicht klappt. Ein kostenloses Konto bei einem TURN-Anbieter liefert dir die drei Angaben.
        Sie bleiben nur auf diesem Gerät.</div>
      <label for="tu" style="margin-top:14px">Adresse</label>
      <input id="tu" placeholder="turn:beispiel.de:3478" autocomplete="off" value="${esc(eigen&&eigen.urls||"")}">
      <label for="tn" style="margin-top:12px">Benutzername</label>
      <input id="tn" autocomplete="off" value="${esc(eigen&&eigen.username||"")}">
      <label for="tp" style="margin-top:12px">Passwort</label>
      <input id="tp" autocomplete="off" value="${esc(eigen&&eigen.credential||"")}">
      <button id="tsave" class="sec" style="margin-top:14px">Speichern und prüfen</button>
      ${eigen?`<button id="tdel" class="sec">Relay entfernen</button>`:""}
    </div>
    <button id="zurueck" class="sec">Zurück</button></div>`);

  el("zurueck").onclick=()=>{ screen="start"; render(); };
  el("start").onclick=starteNetztest;
  el("tsave").onclick=()=>{
    const u=el("tu").value.trim();
    if(!u){ el("tu").focus(); return; }
    LS.set("mm_turn",{urls:u, username:el("tn").value.trim(), credential:el("tp").value.trim()});
    starteNetztest();
  };
  if(el("tdel")) el("tdel").onclick=()=>{ LS.del("mm_turn"); netzStand=null; render(); };
}

function starteNetztest(){
  if(netzLaeuft) return;
  netzLaeuft=true; netzStand=null; render();
  const stand={broker:false, stun:false, turn:false};
  let offen=2;
  const fertig=()=>{ if(--offen) return; netzLaeuft=false; netzStand=stand; render(); };

  /* 1. Treffpunkt-Server */
  let p=null;
  const brokerFertig=()=>{ try{p&&p.destroy();}catch(_){} p=null; fertig(); };
  try{
    p=new Peer(PEEROPT());
    const frist=setTimeout(()=>{ if(p) brokerFertig(); },9000);
    p.on("open",()=>{ stand.broker=true; clearTimeout(frist); brokerFertig(); });
    p.on("error",()=>{ clearTimeout(frist); if(p) brokerFertig(); });
  }catch(_){ fertig(); }

  /* 2. Welche Wege ins Netz stehen zur Verfuegung? */
  try{
    const pc=new RTCPeerConnection({iceServers:eisServer()});
    pc.createDataChannel("test");
    pc.onicecandidate=ev=>{
      const c=ev.candidate&&ev.candidate.candidate;
      if(!c) return;
      if(/ typ srflx/.test(c)) stand.stun=true;
      if(/ typ relay/.test(c)) stand.turn=true;
    };
    pc.createOffer().then(o=>pc.setLocalDescription(o));
    setTimeout(()=>{ try{pc.close();}catch(_){} fertig(); },9000);
  }catch(_){ fertig(); }
}
