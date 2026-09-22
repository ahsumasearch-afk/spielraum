/* Die Spielbildschirme. */

/* ---------- Spielbildschirme ---------- */
function topbar(){
  const unread=Math.max(0,(S.chat||[]).length-chatSeen);
  const steps=["answer","reveal","vote","result"];
  const idx=steps.indexOf(S.phase);
  return `<div class="chips">
    <span class="chip code btn" id="codechip" title="Einladungslink kopieren">${
      Date.now()<copiedUntil
        ? `<span class="ok">Link kopiert ✓</span>`
        : `<span class="cl">Raum</span> <b>${esc(S.code)}</b> <span class="ci">⧉ kopieren</span>`}</span>
    ${S.round?`<span class="chip">Runde ${S.round}</span>`:""}
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
      prompt("Link zum Teilen:",link);          // letzter Ausweg: von Hand kopieren
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
  if(ct) ct.onclick=()=>{ chatOpen=true; LS.set("fi_chatopen",true); render();
    setTimeout(()=>{ const c=el("chatcard"); if(c) c.scrollIntoView({behavior:"smooth",block:"end"}); },60); };
  const th=el("chathead");
  if(th) th.onclick=()=>{ chatOpen=!chatOpen; LS.set("fi_chatopen",chatOpen); render(); };
  wireExit();
  const ceb=el("ceb");
  if(ceb) ceb.onclick=()=>{ chatEmojiOpen=!chatEmojiOpen; render();
    setTimeout(()=>{ const f=el("ci"); if(f&&chatEmojiOpen) f.focus(); },30); };
  /* Emoji an der Schreibmarke einfuegen, nicht einfach hinten anhaengen. */
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
  /* Tippen auf eine Nachricht oeffnet ihre Aktionen – funktioniert auch auf dem Handy,
     und da die Leiste im Fluss steht, kann sie nicht abgeschnitten werden. */
  app.querySelectorAll(".msg .bub").forEach(b=>b.onclick=e=>{
    if(e.target.closest("button")) return;             // Knoepfe darin nicht abfangen
    const id=b.parentElement.dataset.mid;
    menuFuer=(menuFuer===id)?null:id;
    render();
    /* Die geoeffnete Leiste in den sichtbaren Bereich holen – sonst liegt sie
       auf schmalen Bildschirmen unterhalb des Chatfensters. */
    if(menuFuer){
      const m=app.querySelector(".mact");
      if(m) m.scrollIntoView({block:"nearest"});
    }
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

/* Spielerliste – je nach Phase mit Punkten, Status oder Kick-Knopf. */
function playersCard(mode){
  const list=mode==="lobby"?S.players:S.players.filter(p=>!p.waiting);
  const rows=mode==="score"?[...list].sort((x,y)=>y.score-x.score):list;
  const best=rows.length?Math.max(...rows.map(p=>p.score)):0;
  const status=p=>{
    if(!p.online) return `<span class="pts off">weg</span>`;
    if(mode==="answer") return `<span class="pts ${p.answered?"ok":""}">${p.answered?"fertig":"tippt…"}</span>`;
    if(mode==="vote")   return `<span class="pts ${p.voted?"ok":""}">${p.voted?"gewählt":"überlegt…"}</span>`;
    return `<span class="pts">${p.score} Pkt</span>`;
  };
  return `<div class="card rise">
    <h2>${mode==="score"?"Punkte":"Spieler"} (${rows.length})</h2>
    <ul class="plist">${rows.map(p=>`<li>${avatar(p)}
      <span class="nm">${esc(p.name)}${p.pid===myPid?'<span class="tag you">du</span>':""}${p.pid===S.hostId?'<span class="tag host">Host</span>':""}${mode==="score"&&p.score===best&&best>0?'<span class="tag win">vorn</span>':""}
      ${p.online?"":"<small>nicht verbunden</small>"}</span>
      ${status(p)}
      ${isHost&&p.pid!==myPid?`<button class="mini" data-kick="${esc(p.pid)}" title="Spieler entfernen">✕</button>`:""}</li>`).join("")}</ul>
    ${mode==="score"?`<div class="note">Erwischt die Mehrheit den Lügner, bekommt das ganze Team +1. Kommt er durch, bekommt er allein +1.</div>`:""}
  </div>`;
}
/* Ausstieg – in jeder Phase sichtbar. Der Host schliesst den Raum, alle anderen gehen. */
/* Der Ausstieg sitzt oben in der Kopfleiste (rot) – unten daher nichts mehr. */
function exitBtn(){ return ""; }
function wireExit(){
  const b=el("leave");
  if(b) b.onclick=()=>{
    if(!confirm("Raum wirklich verlassen? Deine Punkte in diesem Raum sind dann weg.")) return;
    act({t:"leave"}); LS.delMine("fi_room");
    setTimeout(()=>{ teardown(); location.replace(location.pathname); },250);
  };
  const c=el("closeroom");
  if(c) c.onclick=()=>{
    if(!confirm("Raum wirklich schließen? Alle Mitspieler fliegen raus.")) return;
    LS.delMine("fi_host"); teardown(); location.replace(location.pathname);
  };
}
/* Host-Knopf: weiter, ohne auf Abwesende zu warten. */
function forceBtn(kind){
  if(!isHost) return "";
  const inR=S.players.filter(p=>!p.waiting);
  const gone=inR.filter(p=>!p.online);
  if(!gone.length) return "";
  const done=inR.filter(p=>p.online).every(p=>kind==="answer"?p.answered:p.voted);
  if(!done) return "";
  return `<button id="force" class="sec">Ohne ${gone.length===1?esc(gone[0].name):gone.length+" Abwesende"} weitermachen</button>`;
}

/* Ein einheitlicher Klapp-Baustein. Die Kopfzeile zeigt immer eine kurze
   Zusammenfassung, damit man den Stand auch im zugeklappten Zustand sieht. */
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

function viewLobby(){
  const on=S.players.filter(p=>p.online).length;
  const alle=S.kat.length===KATEGORIEN.length;
  const keine=S.kat.length===0;
  const aktiv=id=>S.kat.indexOf(id)>=0;

  const katInhalt=`<div class="katgrid">${KATEGORIEN.map(k=>{
      const anzahl=PAIRS.filter(x=>x[2]===k.id).length;
      return `<button class="katbtn ${aktiv(k.id)?"on":""}" data-kat="${k.id}" ${isHost?"":"disabled"}>
        <span class="kate">${k.emoji}</span>
        <span class="katn">${esc(k.name)}<small>${anzahl} Paare</small></span>
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
       <div class="note">Nach der letzten Runde wird das Podium gezeigt. ∞ heißt: es geht weiter, bis ihr aufhört.</div>
       <label style="margin-top:16px">Anzahl der Lügner</label>
       <div class="seg" id="impseg" style="grid-template-columns:repeat(${Math.min(S.maxImp,5)+1},1fr)">${
         Array.from({length:Math.min(S.maxImp,5)},(_,i)=>i+1).map(n=>
          `<button data-imps="${n}" class="${!S.impRandom&&S.impCount===n?"on":""}">${n}</button>`).join("")}
         <button data-imps="0" class="${S.impRandom?"on":""}" title="Jede Runde neu auslosen">🎲</button></div>
       <div class="note">${S.impRandom
         ?`Jede Runde wird neu ausgelost – mal einer, mal mehrere.`
         :`Bei ${zahlwort(S.players.filter(p=>p.online).length,"Spieler","Spielern")} sind bis zu ${S.maxImp} möglich – ein ehrlicher Spieler muss übrig bleiben.`}</div>`
    : `<div class="zeile"><span class="pts">Runden</span><b>${S.maxRounds?S.maxRounds:"ohne Ende"}</b></div>
       <div class="zeile"><span class="pts">Lügner</span><b>${S.impRandom?"zufällig":S.impCount}</b></div>`;

  const zeitInhalt=isHost
    ? ["answer","talk","vote"].map(k=>{
        const titel={answer:"Antwortzeit",talk:"Besprechungszeit",vote:"Zeit zum Abstimmen"}[k];
        const wert={answer:S.tAnswer,talk:S.tTalk,vote:S.tVote}[k];
        return `<label style="margin-top:14px">${titel}</label>
          <div class="seg seg3">${[0,30,60].map(v=>
             `<button data-t="${k}" data-sec="${v}" class="${wert===v?"on":""}">${v?secLabel(v):"ohne"}</button>`).join("")}</div>
          <div class="minrow">
            <input class="mininput" type="number" min="2" max="60" step="1" inputmode="numeric"
                   id="min-${k}" placeholder="Minuten" value="${wert>60?wert/60:""}">
            <button class="minset ${wert>60?"on":""}" data-min="${k}">übernehmen</button>
          </div>`;
      }).join("")
    : [["Antwortzeit",S.tAnswer],["Besprechungszeit",S.tTalk],["Abstimmung",S.tVote]].map(([t,v])=>
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

  const startKnopf=n=>isHost
    ? `<button id="go${n}" ${on<3||!S.vorrat?"disabled":""}>Runde starten</button>`+
      (S.vorrat?"":`<div class="note" style="text-align:center">Wähle mindestens eine Fragen-Kategorie aus.</div>`)
    : `<div class="card tight center note rise" style="margin:0 0 13px">Warte auf den Host…</div>`;

  paint(HEAD+frame(
    klapp("kat","Fragen-Kategorien",katInhalt,
          keine?`keine gewählt`
               :alle?`alle · ${S.vorrat} Paare`
                    :`${S.kat.length} von ${KATEGORIEN.length} · ${S.vorrat} Paare`)+
    klapp("spiel","Spielverlauf",spielInhalt,
          `${S.maxRounds?S.maxRounds+" Runden":"ohne Ende"} · ${S.impRandom?"zufällig viele":S.impCount} Lügner`)+
    klapp("zeit","Zeitlimits",zeitInhalt,
          `${zeitKurz(S.tAnswer)} · ${zeitKurz(S.tTalk)} · ${zeitKurz(S.tVote)}`)+
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
    LS.set("fi_offen",offeneKarten);
    render();
  });

  if(el("notif")) el("notif").onclick=askNotify;

  if(isHost){
    app.querySelectorAll("[data-kat]").forEach(b=>b.onclick=()=>{
      const id=b.dataset.kat;
      const liste=S.kat.slice();
      const i=liste.indexOf(id);
      if(i>=0) liste.splice(i,1); else liste.push(id);  // frei an- und abwaehlbar
      act({t:"kat",ids:liste});
    });
    if(el("katalle")) el("katalle").onclick=()=>act({t:"kat",ids:KATEGORIEN.map(k=>k.id)});
    if(el("katnix"))  el("katnix").onclick=()=>act({t:"kat",ids:[]});
  }

  app.querySelectorAll("[data-rounds]").forEach(b=>b.onclick=()=>act({t:"rounds",n:+b.dataset.rounds}));
  app.querySelectorAll("[data-imps]").forEach(b=>b.onclick=()=>act({t:"imps",n:+b.dataset.imps}));
  if(el("rundenset")) el("rundenset").onclick=()=>{
    const n=Math.round(+el("rundenzahl").value);
    if(!(n>=1&&n<=99)){ el("rundenzahl").focus(); return; }
    act({t:"rounds",n});
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
    /* Wert nur setzen, solange niemand im Waehler steht – sonst springt die
       Auswahl beim naechsten Abgleich mit dem Raum zurueck. */
    if(document.activeElement!==pick) pick.value=(typeof myColor==="string"?myColor:FARBEN[0]);
    pick.oninput=()=>{                       // waehrend des Ziehens nur die Vorschau
      myColor=pick.value;
      app.querySelectorAll("#col [data-c]").forEach(x=>x.classList.remove("on"));
      zeigeVorschau();
    };
    pick.onchange=()=>waehleFarbe(pick.value);   // beim Loslassen an alle melden
  }

  ["go","go2"].forEach(id=>{ if(el(id)) el(id).onclick=()=>act({t:"start"}); });
  app.querySelectorAll("[data-kick]").forEach(b=>b.onclick=()=>{
    if(confirm("Diesen Spieler entfernen?")) act({t:"kick",pid:b.dataset.kick});
  });
}

/* Nachzügler sehen nur einen Wartebildschirm – nichts aus der laufenden Runde. */
function viewWaiting(){
  paint(HEAD+frame(
    `<div class="card glow center rise" style="padding:34px 20px">
       <div class="big"><span class="spin" style="width:19px;height:19px"></span>Gleich geht's los</div>
       <div class="note">Du bist im Raum <b>${esc(S.code)}</b>. Die anderen sind noch mitten in Runde ${S.round} –
         sobald die nächste startet, bist du dabei.</div>
     </div>`+exitBtn(),
    "",chatCard()));
  wire();
}
function viewAnswer(me){
  const done=me&&me.answered;
  paint(HEAD+frame(
    `<div class="card qhero rise"><div class="qlbl">Deine Frage</div><div class="q">${esc(myQuestion)}</div></div>`+
    (S.deadline?`<div class="card center rise" style="padding:20px">
        <div class="qlbl" style="margin-bottom:4px">Noch Zeit</div>
        <div class="bigclock clockv">${fmtTime(timeLeft()||0)}</div></div>`:"")+
    (done?`<div class="card center rise"><span class="spin"></span>Warte auf die anderen…</div>${forceBtn("answer")}`
         :`<div class="card rise"><label for="ai">Deine Antwort – kurz halten</label>
             <input id="ai" maxlength="250" placeholder="Antwort…" autocomplete="off" enterkeyhint="send">
             <div class="zaehler"><span id="zrest">250</span> Zeichen frei</div>
             <button id="sb">Antwort abschicken</button>
             <div class="hint">Zeig dein Handy niemandem – nicht jeder hat dieselbe Frage.</div></div>`)
    +(isHost?`<button id="skip" class="sec">Frage überspringen</button>
        <div class="note" style="margin-top:6px">Zieht sofort eine neue Frage für alle. Bisherige Antworten dieser Runde verfallen.</div>`:"")
    +exitBtn(),
    playersCard("answer"),chatCard()));
  wire();
  if(isHost&&el("skip")) el("skip").onclick=()=>{
    if(confirm("Neue Frage für alle ziehen? Die bisherigen Antworten dieser Runde verfallen.")) act({t:"skip"});
  };
  if(!done){
    const ai=el("ai"); ai.focus();
    const zeige=()=>{ const z=el("zrest"); if(z) z.textContent=String(250-ai.value.length); };
    zeige();
    ai.addEventListener("input",zeige);
    const send=()=>{ const v=ai.value.trim(); if(!v) return; draftAnswer=""; act({t:"answer",text:v}); };
    el("sb").onclick=send; ai.onkeydown=e=>{ if(e.key==="Enter") send(); };
  }
}
function viewReveal(){
  const inR=S.players.filter(p=>!p.waiting);
  paint(HEAD+frame(
    (S.deadline?`<div class="card center rise" style="padding:16px"><div class="qlbl" style="margin-bottom:3px">Besprechungszeit</div>
       <div class="bigclock clockv" style="font-size:30px">${fmtTime(timeLeft()||0)}</div></div>`:"")+
    `<div class="card qhero rise"><div class="qlbl">Die Hauptfrage war</div><div class="q">${esc(S.mainQuestion)}</div></div>
     <div class="card rise"><h2>Alle Antworten</h2>
       ${inR.map(p=>`<div class="ans">${avatar(p)}<div><div class="who">${esc(p.name)}${p.pid===myPid?" · du":""}</div>
         <div class="txt">${esc(p.answer||"—")}</div></div></div>`).join("")}
       <div class="hint">Jetzt laut diskutieren: Wessen Antwort passt nicht zur Frage?</div></div>
     ${isHost?`<button id="v">Weiter zur Abstimmung</button>`:`<div class="card center note rise">Der Host startet die Abstimmung.</div>`}
     ${exitBtn()}`,
    playersCard("plain"),chatCard()));
  wire();
  if(isHost) el("v").onclick=()=>act({t:"tovote"});
}
function viewVote(me){
  const voted=me&&me.voted;
  const others=S.players.filter(p=>!p.waiting&&p.pid!==myPid);
  paint(HEAD+frame(
    (S.deadline?`<div class="card center rise" style="padding:16px"><div class="qlbl" style="margin-bottom:3px">Noch Zeit zum Abstimmen</div>
       <div class="bigclock clockv" style="font-size:30px">${fmtTime(timeLeft()||0)}</div></div>`:"")+
    `<div class="card qhero rise"><div class="qlbl">Hauptfrage</div><div class="q">${esc(S.mainQuestion)}</div></div>
     <div class="card rise"><h2>Wer hatte die andere Frage?</h2>
       ${voted?`<div class="center note" style="margin-top:0"><span class="spin"></span>Warte auf die anderen…</div>`
              :others.map(p=>`<button class="pick" data-v="${esc(p.pid)}">${avatar(p)}
                 <span class="nm">${esc(p.name)}<small>${esc(p.answer||"")}</small></span></button>`).join("")}
     </div>${voted?forceBtn("vote"):""}${exitBtn()}`,
    playersCard("vote"),chatCard()));
  wire();
  if(!voted) app.querySelectorAll("[data-v]").forEach(b=>b.onclick=()=>act({t:"vote",target:b.dataset.v}));
}
/* Nach der letzten Runde: Podium mit den ersten drei, der Rest darunter. */
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

function viewResult(){
  const imps=S.players.filter(p=>(S.impIds||[]).indexOf(p.pid)>=0);
  const istLuegner=pid=>(S.impIds||[]).indexOf(pid)>=0;
  const impNamen=imps.map(p=>esc(p.name)).join(" & ")||"—";
  const inR=S.players.filter(p=>!p.waiting);
  const me=S.players.find(p=>p.pid===myPid);
  const votesFor=pid=>inR.filter(p=>p.vote===pid).map(p=>p.name);

  /* Teamwertung: Die Gruppe gewinnt oder verliert gemeinsam.
     Ein einzelner richtiger Tipp zaehlt nicht, wenn die Mehrheit danebenliegt. */
  let verdict="";
  if(me&&!me.waiting){
    const bin=istLuegner(me.pid);
    const won=bin?!S.caught:S.caught;
    const selbstRichtig=!bin&&istLuegner(me.vote);
    const why=bin
      ?(won?"Niemand hat euch erwischt. +1 Punkt."
           :"Die Mehrheit hat euch erwischt. Diese Runde geht an die anderen.")
      :(won?"Ihr habt den Lügner gemeinsam erwischt. +1 Punkt für jeden im Team."
           :(selbstRichtig?"Dein Tipp war richtig – aber die Mehrheit lag daneben. Keine Punkte."
                          :"Die Mehrheit lag daneben. Der Punkt geht an den Lügner."));
    verdict=`<div class="card ${won?"win":"lose"} center rise" style="padding:26px 20px">
      <div class="verdict ${won?"g":"r"}">${won?"Gewonnen":"Verloren"}</div>
      <div class="vsub">${bin?"Du warst der Lügner. ":""}${why}</div></div>`;
  }

  paint(HEAD+frame(
    verdict+
    `<div class="card glow rise">
       <div class="qlbl">${imps.length>1?"Die Lügner waren":"Der Lügner war"}</div>
       <div class="big" style="margin:2px 0 14px">${impNamen}</div>
       <div class="qpair">
         <div class="qbox"><div class="k">Alle anderen bekamen</div><div class="v">${esc(S.mainQuestion)}</div></div>
         <div class="qbox imp"><div class="k">${imps.length>1?"Die Lügner bekamen":impNamen+" bekam"}</div>
           <div class="v">${esc(S.impostorQuestion||"—")}</div></div>
       </div></div>
     <div class="card rise"><h2>Die Runde im Überblick</h2>
       ${inR.map(p=>{
         const ziel=p.vote?S.players.find(x=>x.pid===p.vote):null;
         const richtig=ziel&&istLuegner(ziel.pid);
         const bekommen=votesFor(p.pid).length;
         const luegner=istLuegner(p.pid);
         return `<div class="rundenzeile">
           <div class="kopf">${avatar(p)}
             <span class="who">${esc(p.name)}${p.pid===myPid?" · du":""}${luegner?'<span class="tag imp">Lügner</span>':""}</span>
             ${bekommen?`<span class="pts">${bekommen} ${bekommen===1?"Stimme":"Stimmen"}</span>`:""}
           </div>
           <div class="unten">
             <span class="azeile">${esc(p.answer||"keine Antwort")}</span>
             <span class="vzeile">${
               ziel?`→ ${esc(ziel.name)}${richtig?' <span style="color:var(--ok)">✓</span>':""}`
                   :"nicht abgestimmt"}</span>
           </div>
         </div>`;
       }).join("")}</div>
     ${isHost?`<button id="nx">Nächste Runde</button><button id="lb" class="sec">Zurück in den Warteraum</button>`
             :`<div class="card center note rise">Der Host startet die nächste Runde.</div>`}
     ${exitBtn()}`,
    playersCard("score"),chatCard()));
  wire();
  if(isHost){ el("nx").onclick=()=>act({t:"next"}); el("lb").onclick=()=>act({t:"lobby"}); }
}
