/* Die Spielbildschirme von Mind-Match. */

/* Leben als Herzen – verbrauchte bleiben als Schatten stehen,
   damit man sieht, wie knapp es schon ist. */
function herzen(p){
  if(p.pid===S.kingId) return `<span class="krone" title="King">👑</span>`;
  if(p.raus) return `<span class="leben raus">raus</span>`;
  const max=S.startLeben||3;
  let out="";
  for(let i=0;i<max;i++) out+=`<span class="hz ${i<p.leben?"an":"weg"}">${i<p.leben?"❤️":"🖤"}</span>`;
  return `<span class="leben">${out}</span>`;
}

function topbar(){
  const unread=Math.max(0,(S.chat||[]).length-chatSeen);
  const steps=["king","answer","reveal"];
  const idx=steps.indexOf(S.phase);
  return `<div class="chips">
    <span class="chip code btn" id="codechip" title="Einladungslink kopieren">${
      Date.now()<copiedUntil
        ? `<span class="ok">Link kopiert ✓</span>`
        : `<span class="cl">Raum</span> <b>${esc(S.code)}</b> <span class="ci">⧉ kopieren</span>`}</span>
    ${S.round?`<span class="chip">Runde ${S.round}</span>`:""}
    ${S.anzahlFragen&&S.phase!=="lobby"&&S.phase!=="podium"
      ?`<span class="chip">Frage ${Math.min(S.qi+1,S.anzahlFragen)} / ${S.anzahlFragen}</span>`:""}
    <span class="chip btn only-mobile" id="plbtn">Spieler (${S.players.length})</span>
    <span class="chip btn" id="sndbtn" title="Ton an- oder ausschalten">${soundOn?"🔊 Ton an":"🔇 Ton aus"}</span>
    ${S.deadline?`<span class="chip clock"><span class="clockv">${fmtTime(timeLeft()||0)}</span></span>`:""}
    <span class="chip btn only-mobile ${unread?"act":""}" id="chattop">Chat${unread?` <span class="bdg">${unread}</span>`:""}</span>
    ${isHost?`<span class="chip btn" id="resetchip" title="Alle Punkte auf null">↺ Punkte zurücksetzen</span>`:""}
    <span class="chip btn danger" id="${isHost?"closeroom":"leave"}">${isHost?"Raum schließen":"Raum verlassen"}</span>
  </div>`+(idx>=0?`<div class="steps">${steps.map((x,i)=>`<div class="step ${i<=idx?"on":""}"></div>`).join("")}</div>`:"");
}
function frame(main,players,chat){
  return topbar()+`<div class="wrap">
    <div class="main">${main}</div>
    <aside class="colA">${players?`<button class="closex" id="pclose">Schließen</button>${players}`:""}</aside>
    <aside class="colB">${chat||""}</aside>
  </div><div class="scrim" id="scrim"></div>`;
}
function wire(){
  const cc=el("codechip");
  if(cc) cc.onclick=async()=>{
    const link=location.origin+location.pathname+"?r="+S.code;
    if(await inZwischenablage(link)){
      copiedUntil=Date.now()+2000; beep("soft"); render();
      setTimeout(render,2100);
    }else{
      prompt("Link zum Teilen:",link);
    }
  };
  const shut=()=>document.body.classList.remove("pl-open");
  const pb=el("plbtn"); if(pb) pb.onclick=()=>document.body.classList.toggle("pl-open");
  const rc=el("resetchip");
  if(rc) rc.onclick=()=>{ if(confirm("Alle Punkte auf null setzen und zurück in den Warteraum?")) act({t:"reset"}); };
  const sb=el("sndbtn"); if(sb) sb.onclick=()=>{ soundOn=!soundOn; LS.set("fi_sound",soundOn); if(soundOn) beep("soft"); render(); };
  const sc=el("scrim"); if(sc) sc.onclick=shut;
  const pc=el("pclose"); if(pc) pc.onclick=shut;
  const ct=el("chattop");
  if(ct) ct.onclick=()=>{ chatOpen=true; LS.set("mm_chatopen",true); render();
    setTimeout(()=>{ const c=el("chatcard"); if(c) c.scrollIntoView({behavior:"smooth",block:"end"}); },60); };
  const th=el("chathead");
  if(th) th.onclick=()=>{ chatOpen=!chatOpen; LS.set("mm_chatopen",chatOpen); render(); };
  wireExit();
  const ceb=el("ceb");
  if(ceb) ceb.onclick=()=>{ chatEmojiOpen=!chatEmojiOpen; render();
    setTimeout(()=>{ const f=el("ci"); if(f&&chatEmojiOpen) f.focus(); },30); };
  app.querySelectorAll("[data-ce]").forEach(b=>b.onclick=()=>{
    const f=el("ci"); if(!f) return;
    const e=b.dataset.ce;
    const a=f.selectionStart==null?f.value.length:f.selectionStart;
    const z=f.selectionEnd==null?f.value.length:f.selectionEnd;
    f.value=f.value.slice(0,a)+e+f.value.slice(z);
    draftChat=f.value;
    f.focus();
    try{ f.setSelectionRange(a+e.length,a+e.length); }catch(_){}
  });
  app.querySelectorAll(".msg .bub").forEach(b=>b.onclick=e=>{
    if(e.target.closest("button")) return;
    const id=b.parentElement.dataset.mid;
    menuFuer=(menuFuer===id)?null:id;
    render();
    if(menuFuer){ const m=app.querySelector(".mact"); if(m) m.scrollIntoView({block:"nearest"}); }
  });
  app.querySelectorAll("[data-antw]").forEach(b=>b.onclick=()=>{
    const m=(S.chat||[]).find(x=>x.id===b.dataset.antw);
    if(!m) return;
    antwortAuf={id:m.id,name:m.name,text:m.text.slice(0,90)};
    menuFuer=null;
    render(); setTimeout(()=>{ const f=el("ci"); if(f) f.focus(); },30);
  });
  if(el("antwx")) el("antwx").onclick=()=>{ antwortAuf=null; render(); };
  app.querySelectorAll("[data-re]").forEach(b=>b.onclick=()=>{
    menuFuer=null;
    act({t:"react",id:b.dataset.re,emoji:b.dataset.remo});
  });
  const cs=el("csend"), ci=el("ci");
  if(cs&&ci){
    const send=()=>{ const v=ci.value.trim(); if(!v) return;
      draftChat=""; ci.value="";
      act({t:"chat",text:v,replyTo:antwortAuf?antwortAuf.id:null});
      antwortAuf=null; ci.focus(); };
    cs.onclick=send; ci.onkeydown=e=>{ if(e.key==="Enter") send(); };
  }
  const f=el("force"); if(f) f.onclick=()=>act({t:"force"});
  app.querySelectorAll("[data-kick]").forEach(b=>b.onclick=()=>{
    if(confirm("Diesen Spieler entfernen?")) act({t:"kick",pid:b.dataset.kick});
  });
}
function chatCard(){
  const msgs=S.chat||[], unread=Math.max(0,msgs.length-chatSeen);
  if(!chatOpen) return `<div class="card tight rise" id="chatcard">
    <div id="chathead" style="cursor:pointer;display:flex;justify-content:space-between;align-items:center">
      <b style="font-size:15px">Chat</b>
      <span class="pts">${unread?`<span class="bdg" style="background:var(--p);color:#fff;padding:1px 7px;border-radius:99px">${unread} neu</span>`:`${msgs.length} Nachrichten · öffnen`}</span>
    </div></div>`;
  return `<div class="card rise chatfull" id="chatcard">
    <div id="chathead" style="cursor:pointer;display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
      <b style="font-size:15px">Chat</b><span class="pts">zuklappen</span></div>
    <div class="chat-log" id="clog">${
      msgs.length?msgs.map(m=>{
        const mein=m.pid===myPid;
        const spieler=S.players.find(x=>x.pid===m.pid)||{};
        const reaktionen=Object.keys(m.r||{});
        return `<div class="msg ${mein?"me":""}" data-mid="${esc(m.id)}">
          ${avatar(Object.assign({pid:m.pid,name:m.name},spieler))}
          <div class="bub">
            ${m.re?`<div class="zitat"><b>${esc(m.re.name)}</b>${esc(m.re.text)}</div>`:""}
            <div class="au">${esc(m.name)} <span class="uhr">${uhrzeit(m.ts)}</span></div>
            <div class="tx">${esc(m.text)}</div>
            ${reaktionen.length?`<div class="reakt">${reaktionen.map(e=>
               `<button class="rbtn ${(m.r[e]||[]).indexOf(myPid)>=0?"on":""}" data-re="${esc(m.id)}" data-remo="${e}">${e} ${m.r[e].length}</button>`).join("")}</div>`:""}
            ${menuFuer===m.id?`<div class="mact">
              <button data-antw="${esc(m.id)}">↩ Antworten</button>
              ${REAKTIONEN.map(e=>`<button data-re="${esc(m.id)}" data-remo="${e}">${e}</button>`).join("")}
            </div>`:""}
          </div></div>`;
      }).join("")
      :`<div class="chat-empty">Noch nichts geschrieben.</div>`}</div>
    ${antwortAuf?`<div class="antwortbar"><div class="zitat"><b>${esc(antwortAuf.name)}</b>${esc(antwortAuf.text)}</div>
       <button id="antwx" title="Abbrechen">✕</button></div>`:""}
    ${chatEmojiOpen?`<div class="chatemo" id="cemo">${CHATEMOJIS.map(e=>
        `<button data-ce="${e}">${e}</button>`).join("")}</div>`:""}
    <div class="chat-in" style="flex:none">
      <button id="ceb" class="emobtn" title="Emoji einfügen">${chatEmojiOpen?"✕":"🙂"}</button>
      <input id="ci" maxlength="300" placeholder="Nachricht…" autocomplete="off" enterkeyhint="send">
      <button id="csend">→</button></div></div>`;
}

/* Spielerliste – im Spiel mit Leben und Krone, sonst mit Punkten. */
function playersCard(mode){
  const list=mode==="lobby"?S.players:S.players.filter(p=>!p.waiting);
  const rows=mode==="score"?[...list].sort((x,y)=>y.score-x.score):list;
  const best=rows.length?Math.max(...rows.map(p=>p.score)):0;
  const status=p=>{
    if(!p.online) return `<span class="pts off">weg</span>`;
    if(mode==="king")   return p.pid===S.kingId?`<span class="pts">${S.kingFertig} / ${S.anzahlFragen}</span>`:herzen(p);
    if(mode==="answer"){
      if(p.pid===S.kingId||p.raus) return herzen(p);
      return `<span class="pts ${p.geantwortet?"ok":""}">${p.geantwortet?"fertig":"überlegt…"}</span>`;
    }
    if(mode==="leben")  return herzen(p);
    return `<span class="pts">${p.score} Pkt</span>`;
  };
  return `<div class="card rise">
    <h2>${mode==="score"?"Punkte":"Spieler"} (${rows.length})</h2>
    <ul class="plist">${rows.map(p=>`<li class="${p.raus&&mode!=="lobby"&&mode!=="score"?"istraus":""}">${avatar(p)}
      <span class="nm">${esc(p.name)}${p.pid===S.kingId&&mode!=="lobby"&&mode!=="score"?'<span class="tag king">👑 King</span>':""}${p.pid===myPid?'<span class="tag you">du</span>':""}${p.pid===S.hostId?'<span class="tag host">Host</span>':""}${mode==="score"&&p.score===best&&best>0?'<span class="tag win">vorn</span>':""}
      ${p.online?"":"<small>nicht verbunden</small>"}</span>
      ${status(p)}
      ${isHost&&p.pid!==myPid?`<button class="mini" data-kick="${esc(p.pid)}" title="Spieler entfernen">✕</button>`:""}</li>`).join("")}</ul>
    ${mode==="score"?`<div class="note">Überlebt niemand, bekommt der King +2. Hält mindestens einer durch, bekommen alle außer dem King +1.</div>`:""}
  </div>`;
}
function exitBtn(){ return ""; }
function wireExit(){
  const b=el("leave");
  if(b) b.onclick=()=>{
    if(!confirm("Raum wirklich verlassen? Deine Punkte in diesem Raum sind dann weg.")) return;
    act({t:"leave"}); LS.delMine("mm_room");
    setTimeout(()=>{ teardown(); location.replace(location.pathname); },250);
  };
  const c=el("closeroom");
  if(c) c.onclick=()=>{
    if(!confirm("Raum wirklich schließen? Alle Mitspieler fliegen raus.")) return;
    LS.delMine("mm_host"); teardown(); location.replace(location.pathname);
  };
}
/* Host-Knopf: weiter, ohne auf Abwesende zu warten. */
function forceBtn(){
  if(!isHost) return "";
  const inR=S.players.filter(p=>!p.waiting&&!p.raus&&p.pid!==S.kingId);
  const gone=inR.filter(p=>!p.online);
  if(!gone.length) return "";
  if(!inR.filter(p=>p.online).every(p=>p.geantwortet)) return "";
  return `<button id="force" class="sec">Ohne ${gone.length===1?esc(gone[0].name):gone.length+" Abwesende"} weitermachen</button>`;
}

function klapp(id,titel,inhalt,kurz,vorne){
  const offen=!!offeneKarten[id];
  return `<div class="card rise">
    <div class="klapp" data-klapp="${id}">
      ${vorne||""}
      <b>${titel}</b>
      <span class="kurz">${kurz||""}</span>
      <span class="pfeil">${offen?"▾":"▸"}</span>
    </div>
    ${offen?`<div class="klappinhalt">${inhalt}</div>`:""}
  </div>`;
}
function zeitKurz(v){ return v?secLabel(v):"ohne"; }

/* ---------- Warteraum ---------- */

function viewLobby(){
  const on=S.players.filter(p=>p.online).length;
  const alle=S.kat.length===KATEGORIEN.length;
  const keine=S.kat.length===0;
  const aktiv=id=>S.kat.indexOf(id)>=0;

  const katInhalt=`<div class="katgrid">${KATEGORIEN.map(k=>{
      const anzahl=FRAGEN.filter(x=>x[1]===k.id).length;
      return `<button class="katbtn ${aktiv(k.id)?"on":""}" data-kat="${k.id}" ${isHost?"":"disabled"}>
        <span class="kate">${k.emoji}</span>
        <span class="katn">${esc(k.name)}<small>${anzahl} Fragen</small></span>
        <span class="hak">${aktiv(k.id)?"✓":""}</span></button>`;
    }).join("")}</div>
    ${isHost?`<div class="katact">
       <button id="katalle" class="sec">Alle auswählen</button>
       <button id="katnix" class="sec">Alle abwählen</button>
     </div>`:""}`;

  const spielInhalt=isHost
    ? `<label>Anzahl der Runden</label>
       <div class="seg" style="grid-template-columns:repeat(4,1fr)">${[0,3,5,10].map(n=>
          `<button data-rounds="${n}" class="${S.maxRounds===n?"on":""}">${n?n:"∞"}</button>`).join("")}</div>
       <div class="minrow">
         <input class="mininput" type="number" min="1" max="99" step="1" inputmode="numeric"
                id="rundenzahl" placeholder="eigene Zahl" value="${[0,3,5,10].indexOf(S.maxRounds)<0?S.maxRounds:""}">
         <button class="minset ${[0,3,5,10].indexOf(S.maxRounds)<0?"on":""}" id="rundenset">übernehmen</button>
       </div>
       <div class="note">Jede Runde ist ein anderer Spieler der King – reihum. Nach der letzten Runde kommt das Podium.</div>

       <label style="margin-top:16px">Fragen pro Runde</label>
       <div class="seg" style="grid-template-columns:repeat(4,1fr)">${[3,5,10,15].map(n=>
          `<button data-pro="${n}" class="${S.proRunde===n?"on":""}">${n}</button>`).join("")}</div>
       <div class="minrow">
         <input class="mininput" type="number" min="1" max="20" step="1" inputmode="numeric"
                id="prozahl" placeholder="eigene Zahl" value="${[3,5,10,15].indexOf(S.proRunde)<0?S.proRunde:""}">
         <button class="minset ${[3,5,10,15].indexOf(S.proRunde)<0?"on":""}" id="proset">übernehmen</button>
       </div>
       <div class="note">Jede Runde beginnt harmlos und endet in der Zwickmühle: „Hund oder Katze?" – da trifft man den King fast zwangsläufig. Ab 4 Fragen sind alle vier Schwierigkeitsstufen dabei.</div>

       <label style="margin-top:16px">Leben pro Spieler</label>
       <div class="seg" style="grid-template-columns:repeat(5,1fr)">${[1,2,3,4,5].map(n=>
          `<button data-leben="${n}" class="${S.startLeben===n?"on":""}">${n}</button>`).join("")}</div>
       <div class="note">Wer dieselbe Antwort gibt wie der King, verliert ein Leben.</div>`
    : `<div class="zeile"><span class="pts">Runden</span><b>${S.maxRounds?S.maxRounds:"ohne Ende"}</b></div>
       <div class="zeile"><span class="pts">Fragen pro Runde</span><b>${S.proRunde}</b></div>
       <div class="zeile"><span class="pts">Leben</span><b>${S.startLeben}</b></div>`;

  const zeitInhalt=isHost
    ? ["king","answer"].map(k=>{
        const titel={king:"Zeit für den King (je Frage)",answer:"Antwortzeit der anderen"}[k];
        const wert={king:S.tKing,answer:S.tAnswer}[k];
        return `<label style="margin-top:14px">${titel}</label>
          <div class="seg seg3">${[0,30,60].map(v=>
             `<button data-t="${k}" data-sec="${v}" class="${wert===v?"on":""}">${v?secLabel(v):"ohne"}</button>`).join("")}</div>
          <div class="minrow">
            <input class="mininput" type="number" min="2" max="60" step="1" inputmode="numeric"
                   id="min-${k}" placeholder="Minuten" value="${wert>60?wert/60:""}">
            <button class="minset ${wert>60?"on":""}" data-min="${k}">übernehmen</button>
          </div>`;
      }).join("")
    : [["Zeit für den King",S.tKing],["Antwortzeit",S.tAnswer]].map(([t,v])=>
        `<div class="zeile"><span class="pts">${t}</span><b>${v?secLabel(v):"ohne Limit"}</b></div>`).join("");

  const ich=S.players.find(x=>x.pid===myPid)||{};
  const skinInhalt=`<div id="prev"></div>
     <label style="margin-top:14px">Emoji</label>
     <div class="emogrid" id="emo">${EMOJIS.map(e=>
        `<button data-e="${e}" class="${myEmoji===e?"on":""}">${e}</button>`).join("")}</div>
     <label style="margin-top:14px">Farbe</label>
     <div class="colgrid" id="col">${FARBEN.map(c=>
        `<button data-c="${c}" class="${myColor===c?"on":""}"
          style="background:linear-gradient(140deg,${c},${mische(c,.65)})"></button>`).join("")}
       <label class="eigen ${FARBEN.indexOf(myColor)<0&&myColor?"on":""}" title="Eigene Farbe">
         <input type="color" id="colpick"><span>+</span>
       </label></div>`;

  const zuwenig=on<2, knapp=S.vorrat<S.proRunde;
  const startKnopf=n=>isHost
    ? `<button id="go${n}" ${zuwenig||knapp?"disabled":""}>Runde starten</button>`+
      (zuwenig?`<div class="note" style="text-align:center">Ihr braucht mindestens 2 Spieler: einen King und einen, der rät.</div>`
       :knapp?`<div class="note" style="text-align:center">Nur ${S.vorrat} Fragen in der Auswahl – wähle mehr Kategorien oder weniger Fragen pro Runde.</div>`:"")
    : `<div class="card tight center note rise" style="margin:0 0 13px">Warte auf den Host…</div>`;

  paint(HEAD+frame(
    `<div class="card glow rise">
       <div class="qlbl">So läuft Mind-Match</div>
       <div class="note" style="margin-top:6px">Der <b>King</b> beantwortet alle Fragen zuerst und allein.
         Danach seid ihr dran – und müsst etwas <b>anderes</b> antworten als er.
         Gleiche Antwort kostet ein Leben. Sind am Ende alle raus, holt der King <b>+2</b>.
         Hält mindestens einer durch, bekommen alle außer dem King <b>+1</b>.</div>
     </div>`+
    klapp("kat","Fragen-Kategorien",katInhalt,
          keine?`keine gewählt`
               :alle?`alle · ${S.vorrat} Fragen`
                    :`${S.kat.length} von ${KATEGORIEN.length} · ${S.vorrat} Fragen`)+
    klapp("spiel","Spielverlauf",spielInhalt,
          `${S.maxRounds?S.maxRounds+" Runden":"ohne Ende"} · ${S.proRunde} Fragen · ${S.startLeben} Leben`)+
    klapp("zeit","Zeitlimits",zeitInhalt,
          `${zeitKurz(S.tKing)} · ${zeitKurz(S.tAnswer)}`)+
    klapp("skin","Dein Aussehen",skinInhalt,"",
          avatar({pid:myPid,name:ich.name||myName,emoji:myEmoji,color:myColor}))+
    ((canNotify()&&!notifyOn&&Notification.permission!=="denied")
      ? klapp("notif","Benachrichtigungen",
          `<div class="note" style="margin-top:0">Damit du es mitbekommst, wenn eine neue Runde startet – auch wenn der Tab im Hintergrund liegt.</div>
           <button id="notif" class="sec">Einschalten</button>`,"aus")
      : "")+
    `<div class="onlymob">${startKnopf("2")}</div>`,
    playersCard("lobby")+`<div class="onlydesk">${startKnopf("")}</div>`,
    chatCard()));

  wire();

  app.querySelectorAll("[data-klapp]").forEach(b=>b.onclick=()=>{
    const id=b.dataset.klapp;
    offeneKarten[id]=!offeneKarten[id];
    LS.set("mm_offen",offeneKarten);
    render();
  });

  if(el("notif")) el("notif").onclick=askNotify;

  if(isHost){
    app.querySelectorAll("[data-kat]").forEach(b=>b.onclick=()=>{
      const id=b.dataset.kat;
      const liste=S.kat.slice();
      const i=liste.indexOf(id);
      if(i>=0) liste.splice(i,1); else liste.push(id);
      act({t:"kat",ids:liste});
    });
    if(el("katalle")) el("katalle").onclick=()=>act({t:"kat",ids:KATEGORIEN.map(k=>k.id)});
    if(el("katnix"))  el("katnix").onclick=()=>act({t:"kat",ids:[]});
  }

  app.querySelectorAll("[data-rounds]").forEach(b=>b.onclick=()=>act({t:"rounds",n:+b.dataset.rounds}));
  app.querySelectorAll("[data-pro]").forEach(b=>b.onclick=()=>act({t:"prorunde",n:+b.dataset.pro}));
  app.querySelectorAll("[data-leben]").forEach(b=>b.onclick=()=>act({t:"leben",n:+b.dataset.leben}));
  if(el("rundenset")) el("rundenset").onclick=()=>{
    const n=Math.round(+el("rundenzahl").value);
    if(!(n>=1&&n<=99)){ el("rundenzahl").focus(); return; }
    act({t:"rounds",n});
  };
  if(el("proset")) el("proset").onclick=()=>{
    const n=Math.round(+el("prozahl").value);
    if(!(n>=1&&n<=20)){ el("prozahl").focus(); return; }
    act({t:"prorunde",n});
  };
  app.querySelectorAll("[data-sec]").forEach(b=>b.onclick=()=>act({t:"timer",which:b.dataset.t,sec:+b.dataset.sec}));
  app.querySelectorAll("[data-min]").forEach(b=>{
    const k=b.dataset.min, feld=el("min-"+k);
    const uebernehmen=()=>{
      const m=Math.round(+feld.value);
      if(!(m>=2&&m<=60)){ feld.focus(); return; }
      act({t:"timer",which:k,sec:m*60});
    };
    b.onclick=uebernehmen;
    if(feld) feld.onkeydown=e=>{ if(e.key==="Enter") uebernehmen(); };
  });

  const zeigeVorschau=()=>{
    const v=el("prev"); if(!v) return;
    v.innerHTML=`<div class="prevrow">${avatar({pid:myPid,name:ich.name||myName,emoji:myEmoji,color:myColor})}
      <span class="nm">${esc(ich.name||myName)}<span class="tag you">du</span></span>
      <span class="pts">${ich.score||0} Pkt</span></div>`;
  };
  zeigeVorschau();
  const merkeSkin=()=>{ LS.set("fi_emoji",myEmoji); LS.set("fi_color",myColor);
    zeigeVorschau(); act({t:"skin",emoji:myEmoji,color:myColor}); };
  app.querySelectorAll("#emo [data-e]").forEach(b=>b.onclick=()=>{
    myEmoji=(myEmoji===b.dataset.e)?"":b.dataset.e;
    app.querySelectorAll("#emo [data-e]").forEach(x=>x.classList.toggle("on",x.dataset.e===myEmoji));
    merkeSkin();
  });
  const waehleFarbe=c=>{
    myColor=c;
    app.querySelectorAll("#col [data-c]").forEach(x=>x.classList.toggle("on",x.dataset.c===myColor));
    merkeSkin();
  };
  app.querySelectorAll("#col [data-c]").forEach(b=>b.onclick=()=>waehleFarbe(b.dataset.c));
  const pick=el("colpick");
  if(pick){
    if(document.activeElement!==pick) pick.value=(typeof myColor==="string"?myColor:FARBEN[0]);
    pick.oninput=()=>{
      myColor=pick.value;
      app.querySelectorAll("#col [data-c]").forEach(x=>x.classList.remove("on"));
      zeigeVorschau();
    };
    pick.onchange=()=>waehleFarbe(pick.value);
  }

  ["go","go2"].forEach(id=>{ if(el(id)) el(id).onclick=()=>act({t:"start"}); });
  app.querySelectorAll("[data-kick]").forEach(b=>b.onclick=()=>{
    if(confirm("Diesen Spieler entfernen?")) act({t:"kick",pid:b.dataset.kick});
  });
}

/* Nachzügler sehen nur einen Wartebildschirm. */
function viewWaiting(){
  paint(HEAD+frame(
    `<div class="card glow center rise" style="padding:34px 20px">
       <div class="big"><span class="spin" style="width:19px;height:19px"></span>Gleich geht's los</div>
       <div class="note">Du bist im Raum <b>${esc(S.code)}</b>. Die anderen sind noch mitten in Runde ${S.round} –
         sobald die nächste startet, bist du dabei.</div>
     </div>`,
    "",chatCard()));
  wire();
}

function uhrCard(titel){
  if(!S.deadline) return "";
  return `<div class="card center rise" style="padding:18px">
    <div class="qlbl" style="margin-bottom:4px">${titel}</div>
    <div class="bigclock clockv">${fmtTime(timeLeft()||0)}</div></div>`;
}

/* ---------- Der King legt vor ---------- */

function viewKing(me){
  const king=S.players.find(p=>p.pid===S.kingId)||{name:"?"};
  const binKing=S.kingId===myPid;

  if(!binKing){
    paint(HEAD+frame(
      `<div class="card glow center rise" style="padding:30px 20px">
         <div class="krone gross">👑</div>
         <div class="big">${esc(king.name)} legt vor</div>
         <div class="note">Der King beantwortet gerade alle ${S.anzahlFragen} Fragen allein.
           Gleich bist du dran – und musst etwas <b>anderes</b> antworten als er.</div>
         <div class="fortschritt"><div class="balken" style="width:${Math.round(100*S.kingFertig/Math.max(1,S.anzahlFragen))}%"></div></div>
         <div class="note">${S.kingFertig} von ${S.anzahlFragen} Fragen beantwortet</div>
       </div>`+uhrCard("Der King überlegt"),
      playersCard("king"),chatCard()));
    wire();
    return;
  }

  paint(HEAD+frame(
    `<div class="card qhero rise">
       <div class="qlbl">👑 Du bist der King · Frage ${S.qi+1} von ${S.anzahlFragen}</div>
       <div class="q">${esc(S.frage?S.frage.text:"—")}</div></div>`+
    uhrCard("Noch Zeit")+
    `<div class="card rise"><label for="ai">Deine Antwort – kurz und eindeutig</label>
       <input id="ai" maxlength="120" placeholder="Antwort…" autocomplete="off" enterkeyhint="next">
       <div class="zaehler"><span id="zrest">120</span> Zeichen frei</div>
       <button id="sb">${S.qi+1<S.anzahlFragen?"Weiter zur nächsten Frage":"Fertig – die anderen sind dran"}</button>
       <div class="hint">Zeig dein Handy niemandem. Die anderen versuchen, deine Antworten <b>nicht</b> zu treffen.</div></div>`,
    playersCard("king"),chatCard()));
  wire();
  const ai=el("ai"); ai.focus();
  const zeige=()=>{ const z=el("zrest"); if(z) z.textContent=String(120-ai.value.length); };
  zeige(); ai.addEventListener("input",zeige);
  const send=()=>{ const v=ai.value.trim(); if(!v) return; ai.value=""; act({t:"king",text:v}); };
  el("sb").onclick=send; ai.onkeydown=e=>{ if(e.key==="Enter") send(); };
}

/* ---------- Alle anderen antworten ---------- */

function viewAnswer(me){
  const king=S.players.find(p=>p.pid===S.kingId)||{name:"?"};
  const binKing=S.kingId===myPid;
  const raus=me&&me.raus;
  const fertig=me&&me.geantwortet;

  const kopf=`<div class="card qhero rise">
      <div class="qlbl">Frage ${S.qi+1} von ${S.anzahlFragen}</div>
      <div class="q">${esc(S.frage?S.frage.text:"—")}</div>
      <div class="qsub">👑 ${esc(king.name)} hat schon geantwortet – triff seine Antwort <b>nicht</b>.</div></div>`;

  let mitte;
  if(binKing){
    mitte=`<div class="card center rise" style="padding:26px 18px">
      <div class="krone gross">👑</div>
      <div class="big">Lehn dich zurück</div>
      <div class="note">Die anderen raten jetzt gegen deine Antwort. Du siehst gleich, wen es erwischt hat.</div></div>`+forceBtn();
  }else if(raus){
    mitte=`<div class="card center rise" style="padding:26px 18px">
      <div class="big">Du bist raus</div>
      <div class="note">Keine Leben mehr. Du schaust zu, bis die Runde vorbei ist – im Chat darfst du natürlich weiter mitreden.</div></div>`;
  }else if(fertig){
    mitte=`<div class="card center rise"><span class="spin"></span>Warte auf die anderen…</div>`+forceBtn();
  }else{
    mitte=`<div class="card rise"><label for="ai">Deine Antwort</label>
      <input id="ai" maxlength="120" placeholder="Antwort…" autocomplete="off" enterkeyhint="send">
      <div class="zaehler"><span id="zrest">120</span> Zeichen frei</div>
      <button id="sb">Antwort abschicken</button>
      <div class="hint">Schreibweise zählt nicht: Groß- und Kleinschreibung, Umlaute, Satzzeichen, Artikel, Mehrzahl und Vertipper werden ignoriert. „Der Hund", „hund" und „Hunde" sind dieselbe Antwort – und „zwei" ist dasselbe wie „2". Mit anderer Schreibweise kommst du also nicht davon.</div></div>`;
  }

  paint(HEAD+frame(
    kopf+uhrCard("Noch Zeit")+mitte+
    (me&&!binKing&&!raus?`<div class="card tight center rise"><span class="pts">Deine Leben</span> ${herzen(me)}</div>`:""),
    playersCard("answer"),chatCard()));
  wire();
  if(!binKing&&!raus&&!fertig){
    const ai=el("ai"); ai.focus();
    const zeige=()=>{ const z=el("zrest"); if(z) z.textContent=String(120-ai.value.length); };
    zeige(); ai.addEventListener("input",zeige);
    const send=()=>{ const v=ai.value.trim(); if(!v) return; draftAnswer=""; act({t:"answer",text:v}); };
    el("sb").onclick=send; ai.onkeydown=e=>{ if(e.key==="Enter") send(); };
  }
}

/* ---------- Aufdecken ---------- */

function viewReveal(me){
  const king=S.players.find(p=>p.pid===S.kingId)||{name:"?"};
  const andere=S.players.filter(p=>!p.waiting&&p.pid!==S.kingId);
  const getroffen=andere.filter(p=>p.getroffen);
  const letzte=S.verlauf&&S.verlauf.length?S.verlauf[S.verlauf.length-1]:null;
  const meinTreffer=me&&me.pid!==S.kingId&&me.getroffen;
  const fertig=S.qi+1>=S.anzahlFragen||andere.every(p=>p.raus);

  paint(HEAD+frame(
    `<div class="card qhero rise">
       <div class="qlbl">Frage ${S.qi+1} von ${S.anzahlFragen}</div>
       <div class="q">${esc(letzte?letzte.frage:(S.frage?S.frage.text:"—"))}</div></div>
     <div class="card glow center rise" style="padding:22px 18px">
       <div class="qlbl">👑 ${esc(king.name)} hatte geschrieben</div>
       <div class="big" style="font-size:27px">${esc(S.kingAntwort||"—")}</div>
     </div>`+
    (me&&me.pid!==S.kingId&&!me.waiting
      ?`<div class="card ${meinTreffer?"lose":"win"} center rise" style="padding:22px 18px">
          <div class="verdict ${meinTreffer?"r":"g"}">${meinTreffer?"Erwischt":"Durch"}</div>
          <div class="vsub">${meinTreffer
            ?(me.raus?"Gleiche Antwort wie der King – dein letztes Leben ist weg."
                     :"Gleiche Antwort wie der King. Ein Leben weniger.")
            :"Deine Antwort war anders. Alle Leben bleiben."}</div>
          <div style="margin-top:10px">${herzen(me)}</div>
        </div>`:"")+
    `<div class="card rise"><h2>Alle Antworten</h2>
       ${andere.map(p=>`<div class="ans ${p.getroffen?"tref":""}">${avatar(p)}
         <div><div class="who">${esc(p.name)}${p.pid===myPid?" · du":""} ${herzen(p)}</div>
         <div class="txt">${esc(p.antwort||"— nichts geschickt")}</div></div>
         <div class="mark">${p.getroffen?"💥":"✅"}</div></div>`).join("")}
       <div class="hint">${getroffen.length
          ?`${zahlwort(getroffen.length,"Treffer","Treffer")} – ${getroffen.map(p=>esc(p.name)).join(", ")} ${getroffen.length===1?"verliert":"verlieren"} ein Leben.`
          :"Niemand hat den King getroffen. Alle Leben bleiben."}</div></div>
     ${isHost?`<button id="w">${fertig?"Runde auswerten":"Nächste Frage"}</button>`
             :`<div class="card center note rise">${fertig?"Der Host wertet die Runde aus.":"Der Host startet die nächste Frage."}</div>`}`,
    playersCard("leben"),chatCard()));
  wire();
  if(isHost&&el("w")) el("w").onclick=()=>act({t:"weiter"});
}

/* ---------- Rundenende ---------- */

function viewRoundend(){
  const king=S.players.find(p=>p.pid===S.kingId)||{name:"?"};
  const e=S.ergebnis||{};
  const ueberlebt=S.players.filter(p=>(e.ueberlebt||[]).indexOf(p.pid)>=0);
  const binKing=S.kingId===myPid;
  const binUeberlebt=(e.ueberlebt||[]).indexOf(myPid)>=0;
  const gewonnen=binKing?e.kingGewinnt:!e.kingGewinnt;

  paint(HEAD+frame(
    `<div class="card ${gewonnen?"win":"lose"} center rise" style="padding:28px 20px">
       <div class="verdict ${gewonnen?"g":"r"}">${gewonnen?"Gewonnen":"Verloren"}</div>
       <div class="vsub">${e.kingGewinnt
         ?(binKing?"Du hast alle ausgeknockt. +2 Punkte für dich."
                  :`${esc(king.name)} hat alle ausgeknockt. Der King bekommt +2.`)
         :(binKing?"Es haben nicht alle aufgegeben. Alle außer dir bekommen +1."
                  :(binUeberlebt?"Du hast durchgehalten. +1 Punkt für alle außer dem King."
                                :"Nicht du, aber jemand hat durchgehalten – dafür gibt es +1 für alle außer dem King."))}</div>
     </div>
     <div class="card rise">
       <h2>Runde ${S.round} im Überblick</h2>
       <div class="zeile"><span class="pts">👑 King</span><b>${esc(king.name)}</b></div>
       <div class="zeile"><span class="pts">Durchgehalten</span><b>${ueberlebt.length?ueberlebt.map(p=>esc(p.name)).join(", "):"niemand"}</b></div>
       <div class="zeile"><span class="pts">Gespielte Fragen</span><b>${(S.verlauf||[]).length} von ${S.anzahlFragen}</b></div>
     </div>
     <div class="card rise"><h2>Die Antworten des Kings</h2>
       ${(S.verlauf||[]).map((v,i)=>`<div class="vrow">
          <div class="vfrage"><span class="vnr">${i+1}</span>${esc(v.frage)}</div>
          <div class="vking">👑 ${esc(v.king)}</div>
          <div class="vtreffer">${v.antworten.filter(a=>a.getroffen).length
            ?v.antworten.filter(a=>a.getroffen).map(a=>{
                const p=S.players.find(x=>x.pid===a.pid)||{name:"?"};
                return `<span class="tchip">💥 ${esc(p.name)}</span>`;
              }).join("")
            :`<span class="tchip ok">niemand getroffen</span>`}</div>
        </div>`).join("")}
     </div>
     ${isHost?`<button id="nr">Nächste Runde</button>
               <button id="lb2" class="sec">Zurück in den Warteraum</button>`
             :`<div class="card center note rise">Der Host startet die nächste Runde.</div>`}`,
    playersCard("score"),chatCard()));
  wire();
  if(isHost){
    if(el("nr"))  el("nr").onclick=()=>act({t:"start"});
    if(el("lb2")) el("lb2").onclick=()=>act({t:"lobby"});
  }
}

/* ---------- Podium ---------- */

function viewPodium(){
  const sortiert=[...S.players].sort((a,b)=>b.score-a.score);
  const podest=sortiert.slice(0,3), rest=sortiert.slice(3);
  const plaetze=["🥇","🥈","🥉"];
  paint(HEAD+frame(
    `<div class="card glow center rise" style="padding:24px 18px">
       <div class="qlbl">Endstand nach ${S.round} ${S.round===1?"Runde":"Runden"}</div>
       <div class="big" style="font-size:30px">${podest.length?esc(podest[0].name)+" gewinnt":"Kein Ergebnis"}</div>
     </div>
     <div class="card rise">
       <div class="podium">${podest.map((p,i)=>`
         <div class="platz p${i+1}">
           <div class="krone">${plaetze[i]}</div>
           ${avatar(p)}
           <div class="pname">${esc(p.name)}</div>
           <div class="ppkt">${p.score} Pkt</div>
         </div>`).join("")}</div>
       ${rest.length?`<ul class="plist" style="margin-top:16px">${rest.map((p,i)=>`<li>
         <span class="pts" style="width:26px">${i+4}.</span>${avatar(p)}
         <span class="nm">${esc(p.name)}${p.pid===myPid?'<span class="tag you">du</span>':""}</span>
         <span class="pts">${p.score} Pkt</span></li>`).join("")}</ul>`:""}
     </div>
     ${isHost?`<button id="neuesspiel">Neues Spiel starten</button>
               <button id="lb2" class="sec">Zurück in den Warteraum</button>`
             :`<div class="card center note rise">Der Host startet ein neues Spiel.</div>`}`,
    playersCard("score"),chatCard()));
  wire();
  if(isHost){
    el("neuesspiel").onclick=()=>act({t:"reset"});
    el("lb2").onclick=()=>act({t:"lobby"});
  }
}
