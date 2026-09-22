/* Die Spielbildschirme von Wavelength. */

/* ---------- Wer darf was ---------- */

const binMedium=()=>S&&S.mediumId===myPid;
/* Rät diese Runde mit: alle ausser dem Medium, im Teammodus nur das aktive Team. */
function raetMit(p){
  if(!S||!p||p.waiting) return false;
  if(p.pid===S.mediumId) return false;
  return S.modus!=="teams" || p.team===S.aktivesTeam;
}
/* Tippt auf links oder rechts: die Gegenseite. */
function tipptSeite(p){
  if(!S||!p||p.waiting||S.modus!=="teams") return false;
  return p.team!==S.aktivesTeam;
}
const teamName=t=>t==="A"?"Team Blau":"Team Orange";

/* ---------- Die Skala ---------- */

/* Rechnet einen Wert 0–100 in einen Punkt auf dem Halbkreis um.
   0 liegt ganz links, 100 ganz rechts. */
const MITTE={x:200,y:196}, RAUSSEN=180, RINNEN=104;
function punkt(wert,radius){
  const bogen=Math.PI*(1-wert/100);
  return {x:MITTE.x+radius*Math.cos(bogen), y:MITTE.y-radius*Math.sin(bogen)};
}
/* Pfad fuer ein Ringstueck zwischen zwei Werten. */
function ringstueck(v1,v2,rInnen,rAussen){
  v1=Math.max(0,Math.min(100,v1)); v2=Math.max(0,Math.min(100,v2));
  if(v2<=v1) return "";
  const a1=punkt(v1,rAussen), a2=punkt(v2,rAussen);
  const i2=punkt(v2,rInnen),  i1=punkt(v1,rInnen);
  return `M ${a1.x} ${a1.y} A ${rAussen} ${rAussen} 0 0 1 ${a2.x} ${a2.y}`
       + ` L ${i2.x} ${i2.y} A ${rInnen} ${rInnen} 0 0 0 ${i1.x} ${i1.y} Z`;
}

/* Zeichnet die Skala. ziel = Mittelpunkt des Zielbereichs oder null,
   zeiger = Position des Zeigers oder null. */
function skala(opt){
  const {ziel, zeiger, karte, beweglich, tipp} = opt;
  const zonen = ziel===null||ziel===undefined ? "" : `
    <path d="${ringstueck(ziel-8.5,ziel+8.5,RINNEN,RAUSSEN)}" class="zone z2"/>
    <path d="${ringstueck(ziel-5,ziel+5,RINNEN,RAUSSEN)}" class="zone z3"/>
    <path d="${ringstueck(ziel-2,ziel+2,RINNEN,RAUSSEN)}" class="zone z4"/>`;

  const striche=[];
  for(let v=0;v<=100;v+=5){
    const a=punkt(v,RAUSSEN), b=punkt(v,v%25?RAUSSEN-9:RAUSSEN-16);
    striche.push(`<line x1="${a.x}" y1="${a.y}" x2="${b.x}" y2="${b.y}" class="strich ${v%25?"":"gross"}"/>`);
  }

  let nadel="";
  if(zeiger!==null&&zeiger!==undefined){
    const spitze=punkt(zeiger,RAUSSEN-4), fuss=punkt(zeiger,RINNEN-16);
    nadel=`<line x1="${fuss.x}" y1="${fuss.y}" x2="${spitze.x}" y2="${spitze.y}" class="nadel"/>
           <circle cx="${spitze.x}" cy="${spitze.y}" r="7" class="nadelkopf"/>`;
  }
  let tippZeichen="";
  if(tipp!==null&&tipp!==undefined){
    const p=punkt(tipp,RAUSSEN-4), f=punkt(tipp,RINNEN-16);
    tippZeichen=`<line x1="${f.x}" y1="${f.y}" x2="${p.x}" y2="${p.y}" class="nadel tipp"/>`;
  }

  return `<div class="skalawrap">
    <svg viewBox="0 0 400 214" class="skala ${beweglich?"beweglich":""}" id="skala"
         role="img" aria-label="Skala von ${esc(karte?karte[0]:"links")} bis ${esc(karte?karte[1]:"rechts")}">
      <path d="${ringstueck(0,100,RINNEN,RAUSSEN)}" class="bahn"/>
      ${zonen}
      ${striche.join("")}
      ${tippZeichen}
      ${nadel}
      <circle cx="${MITTE.x}" cy="${MITTE.y}" r="9" class="achse"/>
    </svg>
    ${karte?`<div class="pole">
       <span class="pol links">${esc(karte[0])}</span>
       <span class="pol rechts">${esc(karte[1])}</span>
     </div>`:""}
  </div>`;
}

/* Macht die Skala ziehbar und haengt den Schieberegler an. */
function skalaBedienen(beiAenderung, beiLoslassen){
  const svg=el("skala");
  const ausPunkt=ev=>{
    const r=svg.getBoundingClientRect();
    const sx=400/r.width, sy=214/r.height;
    const x=(ev.clientX-r.left)*sx-MITTE.x;
    const y=MITTE.y-(ev.clientY-r.top)*sy;
    let grad=Math.atan2(Math.max(y,0),x);            // nur obere Haelfte
    return Math.max(0,Math.min(100,(1-grad/Math.PI)*100));
  };
  if(svg){
    let zieht=false;
    const start=ev=>{ zieht=true; svg.setPointerCapture&&svg.setPointerCapture(ev.pointerId);
      beiAenderung(ausPunkt(ev)); ev.preventDefault(); };
    const zug=ev=>{ if(zieht) beiAenderung(ausPunkt(ev)); };
    const ende=()=>{ if(!zieht) return; zieht=false; beiLoslassen&&beiLoslassen(); };
    svg.addEventListener("pointerdown",start);
    svg.addEventListener("pointermove",zug);
    svg.addEventListener("pointerup",ende);
    svg.addEventListener("pointercancel",ende);
  }
  const regler=el("regler");
  if(regler){
    regler.addEventListener("input",()=>beiAenderung(+regler.value));
    regler.addEventListener("change",()=>beiLoslassen&&beiLoslassen());
  }
}

/* ---------- Kopfleiste und Rahmen ---------- */

function topbar(){
  const unread=Math.max(0,(S.chat||[]).length-chatSeen);
  const schritte=["hinweis","raten","seite","aufloesung"];
  const idx=schritte.indexOf(S.phase);
  const stand = S.modus==="teams"
    ? `<span class="chip stand"><b class="ta">${S.punkteA}</b> : <b class="tb">${S.punkteB}</b></span>`
    : "";
  return `<div class="chips">
    <span class="chip code btn" id="codechip" title="Einladungslink kopieren">${
      Date.now()<copiedUntil
        ? `<span class="ok">Link kopiert ✓</span>`
        : `<span class="cl">Raum</span> <b>${esc(S.code)}</b> <span class="ci">⧉ kopieren</span>`}</span>
    ${S.round?`<span class="chip">Runde ${S.round}</span>`:""}
    ${stand}
    <span class="chip btn only-mobile" id="plbtn">Spieler (${S.players.length})</span>
    <span class="chip btn" id="sndbtn" title="Ton an- oder ausschalten">${soundOn?"🔊 Ton an":"🔇 Ton aus"}</span>
    ${S.deadline?`<span class="chip clock"><span class="clockv">${fmtTime(timeLeft()||0)}</span></span>`:""}
    <span class="chip btn only-mobile ${unread?"act":""}" id="chattop">Chat${unread?` <span class="bdg">${unread}</span>`:""}</span>
    ${isHost?`<span class="chip btn" id="resetchip" title="Alle Punkte auf null">↺ Punkte zurücksetzen</span>`:""}
    <span class="chip btn danger" id="${isHost?"closeroom":"leave"}">${isHost?"Raum schließen":"Raum verlassen"}</span>
  </div>`+(idx>=0?`<div class="steps">${schritte.map((x,i)=>`<div class="step ${i<=idx?"on":""}"></div>`).join("")}</div>`:"");
}
function frame(main,players,chat){
  return topbar()+`<div class="wrap">
    <div class="main">${main}</div>
    <aside class="colA">${players?`<button class="closex" id="pclose">Schließen</button>${players}`:""}</aside>
    <aside class="colB">${chat||""}</aside>
  </div><div class="scrim" id="scrim"></div>`;
}

/* ---------- Chat ---------- */

/* Ein Chatfenster, zweimal genutzt: einmal fuer alle, einmal fuers Team. */
function chatBlock(kennung,titel,msgs,offen,ungelesen){
  const team = kennung==="team";
  if(!offen) return `<div class="card tight rise" id="chatcard-${kennung}">
    <div data-chathead="${kennung}" style="cursor:pointer;display:flex;justify-content:space-between;align-items:center">
      <b style="font-size:15px">${titel}</b>
      <span class="pts">${ungelesen?`<span class="bdg" style="background:var(--p);color:#fff;padding:1px 7px;border-radius:99px">${ungelesen} neu</span>`:`${msgs.length} Nachrichten · öffnen`}</span>
    </div></div>`;
  return `<div class="card rise chatfull" id="chatcard-${kennung}">
    <div data-chathead="${kennung}" style="cursor:pointer;display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
      <b style="font-size:15px">${titel}</b><span class="pts">zuklappen</span></div>
    <div class="chat-log">${
      msgs.length?msgs.map(m=>{
        const mein=m.pid===myPid;
        const spieler=S.players.find(x=>x.pid===m.pid)||{};
        const reaktionen=Object.keys(m.r||{});
        return `<div class="msg ${mein?"me":""}" data-mid="${esc(m.id)}" data-liste="${kennung}">
          ${avatar(Object.assign({pid:m.pid,name:m.name},spieler))}
          <div class="bub">
            ${m.re?`<div class="zitat"><b>${esc(m.re.name)}</b>${esc(m.re.text)}</div>`:""}
            <div class="au">${esc(m.name)} <span class="uhr">${uhrzeit(m.ts)}</span></div>
            <div class="tx">${esc(m.text)}</div>
            ${reaktionen.length?`<div class="reakt">${reaktionen.map(e=>
               `<button class="rbtn ${(m.r[e]||[]).indexOf(myPid)>=0?"on":""}" data-re="${esc(m.id)}" data-remo="${e}" data-reteam="${team?1:0}">${e} ${m.r[e].length}</button>`).join("")}</div>`:""}
            ${menuFuer===m.id?`<div class="mact">
              <button data-antw="${esc(m.id)}" data-aliste="${kennung}">↩ Antworten</button>
              ${REAKTIONEN.map(e=>`<button data-re="${esc(m.id)}" data-remo="${e}" data-reteam="${team?1:0}">${e}</button>`).join("")}
            </div>`:""}
          </div></div>`;
      }).join("")
      :`<div class="chat-empty">Noch nichts geschrieben.</div>`}</div>
    ${antwortAuf&&antwortAuf.liste===kennung?`<div class="antwortbar"><div class="zitat"><b>${esc(antwortAuf.name)}</b>${esc(antwortAuf.text)}</div>
       <button data-antwx="1" title="Abbrechen">✕</button></div>`:""}
    ${chatEmojiOpen===kennung?`<div class="chatemo">${CHATEMOJIS.map(e=>
        `<button data-ce="${e}" data-celiste="${kennung}">${e}</button>`).join("")}</div>`:""}
    <div class="chat-in" style="flex:none">
      <button data-ceb="${kennung}" class="emobtn" title="Emoji einfügen">${chatEmojiOpen===kennung?"✕":"🙂"}</button>
      <input id="ci-${kennung}" maxlength="300" placeholder="Nachricht…" autocomplete="off" enterkeyhint="send">
      <button data-csend="${kennung}">→</button></div></div>`;
}
function chatSpalte(){
  const alle=S.chat||[];
  const ungelesen=Math.max(0,alle.length-chatSeen);
  let out=chatBlock("alle","Chat – alle",alle,chatOpen,ungelesen);
  if(S.modus==="teams"){
    const me=S.players.find(p=>p.pid===myPid);
    const t=me?teamName(me.team):"Team";
    out += chatBlock("team",t+" – nur intern",teamChat||[],teamChatOffen,
                     Math.max(0,(teamChat||[]).length-teamChatSeen));
  }
  return out;
}

/* ---------- Spielerliste ---------- */

function playersCard(modus){
  const list=modus==="lobby"?S.players:S.players.filter(p=>!p.waiting);
  const rows=modus==="score"?[...list].sort((x,y)=>y.score-x.score):list;
  const inTeams=S.modus==="teams";
  const zeile=p=>`<li class="${p.pid===S.mediumId&&S.phase!=="lobby"?"istmedium":""}">${avatar(p)}
      <span class="nm">${esc(p.name)}${p.pid===S.mediumId&&S.phase!=="lobby"?'<span class="tag medium">📡 Medium</span>':""}${p.pid===myPid?'<span class="tag you">du</span>':""}${p.pid===S.hostId?'<span class="tag host">Host</span>':""}
      ${p.online?"":"<small>nicht verbunden</small>"}</span>
      <span class="pts">${p.score} Pkt</span>
      ${isHost&&p.pid!==myPid?`<button class="mini" data-kick="${esc(p.pid)}" title="Spieler entfernen">✕</button>`:""}</li>`;

  if(!inTeams) return `<div class="card rise">
    <h2>Spieler (${rows.length})</h2>
    <ul class="plist">${rows.map(zeile).join("")}</ul></div>`;

  const team=t=>rows.filter(p=>p.team===t);
  const kopf=(t,punkte)=>`<div class="teamkopf ${t==="A"?"ta":"tb"}">
      <b>${teamName(t)}</b>
      <span class="teampunkte">${punkte} ${punkte===1?"Punkt":"Punkte"}</span>
      ${S.phase!=="lobby"&&S.aktivesTeam===t?'<span class="tag aktiv">am Zug</span>':""}
    </div>`;
  return `<div class="card rise">
    ${kopf("A",S.punkteA)}
    <ul class="plist">${team("A").map(zeile).join("")||'<li class="leer">noch niemand</li>'}</ul>
    ${kopf("B",S.punkteB)}
    <ul class="plist">${team("B").map(zeile).join("")||'<li class="leer">noch niemand</li>'}</ul>
  </div>`;
}

/* ---------- gemeinsame Verdrahtung ---------- */

function wire(){
  const cc=el("codechip");
  if(cc) cc.onclick=async()=>{
    const link=location.origin+location.pathname+"?r="+S.code;
    if(await inZwischenablage(link)){ copiedUntil=Date.now()+2000; beep("soft"); render(); setTimeout(render,2100); }
    else prompt("Link zum Teilen:",link);
  };
  const shut=()=>document.body.classList.remove("pl-open");
  const pb=el("plbtn"); if(pb) pb.onclick=()=>document.body.classList.toggle("pl-open");
  const rc=el("resetchip");
  if(rc) rc.onclick=()=>{ if(confirm("Alle Punkte auf null setzen und zurück in den Warteraum?")) act({t:"reset"}); };
  const sb=el("sndbtn"); if(sb) sb.onclick=()=>{ soundOn=!soundOn; LS.set("fi_sound",soundOn); if(soundOn) beep("soft"); render(); };
  const sc=el("scrim"); if(sc) sc.onclick=shut;
  const pc=el("pclose"); if(pc) pc.onclick=shut;
  const ct=el("chattop");
  if(ct) ct.onclick=()=>{ chatOpen=true; LS.set("wl_chatopen",true); render(); };
  wireExit();

  app.querySelectorAll("[data-chathead]").forEach(h=>h.onclick=()=>{
    const k=h.dataset.chathead;
    if(k==="team"){ teamChatOffen=!teamChatOffen; if(teamChatOffen) teamChatSeen=(teamChat||[]).length; }
    else { chatOpen=!chatOpen; LS.set("wl_chatopen",chatOpen); }
    render();
  });
  app.querySelectorAll("[data-ceb]").forEach(b=>b.onclick=()=>{
    const k=b.dataset.ceb;
    chatEmojiOpen = chatEmojiOpen===k ? false : k;
    render();
  });
  app.querySelectorAll("[data-ce]").forEach(b=>b.onclick=()=>{
    const f=el("ci-"+b.dataset.celiste); if(!f) return;
    const e=b.dataset.ce;
    const a=f.selectionStart==null?f.value.length:f.selectionStart;
    const z=f.selectionEnd==null?f.value.length:f.selectionEnd;
    f.value=f.value.slice(0,a)+e+f.value.slice(z);
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
    const liste=b.dataset.aliste;
    const quelle = liste==="team" ? (teamChat||[]) : (S.chat||[]);
    const m=quelle.find(x=>x.id===b.dataset.antw);
    if(!m) return;
    antwortAuf={id:m.id,name:m.name,text:m.text.slice(0,90),liste};
    menuFuer=null; render();
    setTimeout(()=>{ const f=el("ci-"+liste); if(f) f.focus(); },30);
  });
  app.querySelectorAll("[data-antwx]").forEach(b=>b.onclick=()=>{ antwortAuf=null; render(); });
  app.querySelectorAll("[data-re]").forEach(b=>b.onclick=()=>{
    menuFuer=null;
    act({t:"react",id:b.dataset.re,emoji:b.dataset.remo,team:b.dataset.reteam==="1"});
  });
  app.querySelectorAll("[data-csend]").forEach(b=>{
    const k=b.dataset.csend, feld=el("ci-"+k);
    const senden=()=>{
      const v=feld.value.trim(); if(!v) return;
      feld.value="";
      act({t:k==="team"?"teamchat":"chat", text:v,
           replyTo:antwortAuf&&antwortAuf.liste===k?antwortAuf.id:null});
      antwortAuf=null; feld.focus();
    };
    b.onclick=senden;
    if(feld) feld.onkeydown=e=>{ if(e.key==="Enter") senden(); };
  });
  app.querySelectorAll("[data-kick]").forEach(b=>b.onclick=()=>{
    if(confirm("Diesen Spieler entfernen?")) act({t:"kick",pid:b.dataset.kick});
  });
}
function exitBtn(){ return ""; }
function wireExit(){
  const b=el("leave");
  if(b) b.onclick=()=>{
    if(!confirm("Raum wirklich verlassen? Deine Punkte in diesem Raum sind dann weg.")) return;
    act({t:"leave"}); LS.delMine("wl_room");
    setTimeout(()=>{ teardown(); location.replace(location.pathname); },250);
  };
  const c=el("closeroom");
  if(c) c.onclick=()=>{
    if(!confirm("Raum wirklich schließen? Alle Mitspieler fliegen raus.")) return;
    LS.delMine("wl_host"); teardown(); location.replace(location.pathname);
  };
}
function klapp(id,titel,inhalt,kurz,vorne){
  const offen=!!offeneKarten[id];
  return `<div class="card rise">
    <div class="klapp" data-klapp="${id}">
      ${vorne||""}<b>${titel}</b><span class="kurz">${kurz||""}</span>
      <span class="pfeil">${offen?"▾":"▸"}</span>
    </div>
    ${offen?`<div class="klappinhalt">${inhalt}</div>`:""}
  </div>`;
}
function zeitKurz(v){ return v?secLabel(v):"ohne"; }
function uhrCard(titel){
  if(!S.deadline) return "";
  return `<div class="card center rise" style="padding:18px">
    <div class="qlbl" style="margin-bottom:4px">${titel}</div>
    <div class="bigclock clockv">${fmtTime(timeLeft()||0)}</div></div>`;
}

/* ---------- Warteraum ---------- */

function viewLobby(){
  const on=S.players.filter(p=>p.online).length;
  const ich=S.players.find(x=>x.pid===myPid)||{};
  const teams=S.modus==="teams";
  const a=S.players.filter(p=>p.online&&p.team==="A").length;
  const b=S.players.filter(p=>p.online&&p.team==="B").length;

  const spielInhalt=isHost
    ? `<label>Spielart</label>
       <div class="seg seg2">
         <button data-modus="teams" class="${teams?"on":""}">Zwei Teams</button>
         <button data-modus="einzeln" class="${teams?"":"on"}">Jeder für sich</button>
       </div>
       <div class="note">${teams
         ? "Zwei Teams treten gegeneinander an. Ein Team rät, das andere tippt zusätzlich auf links oder rechts."
         : "Reihum ist einer das Medium, alle anderen raten gemeinsam. Punkte gibt es für alle zusammen – auch fürs Medium."}</div>

       <label style="margin-top:16px">Spiel geht bis</label>
       <div class="seg" style="grid-template-columns:repeat(4,1fr)">${[10,20,30,0].map(n=>
          `<button data-ziel="${n}" class="${S.zielPunkte===n?"on":""}">${n?n:"∞"}</button>`).join("")}</div>
       <div class="minrow">
         <input class="mininput" type="number" min="1" max="99" step="1" inputmode="numeric"
                id="zielzahl" placeholder="eigene Zahl" value="${[10,20,30,0].indexOf(S.zielPunkte)<0?S.zielPunkte:""}">
         <button class="minset ${[10,20,30,0].indexOf(S.zielPunkte)<0?"on":""}" id="zielset">übernehmen</button>
       </div>
       <div class="note">${S.zielPunkte?`Wer zuerst ${S.zielPunkte} Punkte hat, gewinnt.`:"Ohne Ende – ihr hört auf, wann ihr wollt."}</div>`
    : `<div class="zeile"><span class="pts">Spielart</span><b>${teams?"Zwei Teams":"Jeder für sich"}</b></div>
       <div class="zeile"><span class="pts">Spiel geht bis</span><b>${S.zielPunkte?S.zielPunkte+" Punkte":"ohne Ende"}</b></div>`;

  const zeitInhalt=isHost
    ? ["hinweis","raten"].map(k=>{
        const titel={hinweis:"Zeit für den Hinweis",raten:"Zeit zum Raten"}[k];
        const wert={hinweis:S.tHinweis,raten:S.tRaten}[k];
        return `<label style="margin-top:14px">${titel}</label>
          <div class="seg seg3">${[0,60,120].map(v=>
             `<button data-t="${k}" data-sec="${v}" class="${wert===v?"on":""}">${v?secLabel(v):"ohne"}</button>`).join("")}</div>
          <div class="minrow">
            <input class="mininput" type="number" min="1" max="60" step="1" inputmode="numeric"
                   id="min-${k}" placeholder="Minuten" value="${wert>120?wert/60:""}">
            <button class="minset ${wert>120?"on":""}" data-min="${k}">übernehmen</button>
          </div>`;
      }).join("")
    : [["Zeit für den Hinweis",S.tHinweis],["Zeit zum Raten",S.tRaten]].map(([t,v])=>
        `<div class="zeile"><span class="pts">${t}</span><b>${v?secLabel(v):"ohne Limit"}</b></div>`).join("");

  const teamInhalt=`<div class="teamwahl">
      ${["A","B"].map(t=>`
        <div class="teamspalte ${t==="A"?"ta":"tb"}">
          <b>${teamName(t)}</b>
          <ul class="plist klein">${S.players.filter(p=>p.team===t).map(p=>`<li>${avatar(p)}
            <span class="nm">${esc(p.name)}${p.pid===myPid?'<span class="tag you">du</span>':""}</span>
            ${(isHost||p.pid===myPid)?`<button class="mini" data-team="${esc(p.pid)}" data-nach="${t==="A"?"B":"A"}"
               title="In das andere Team">${t==="A"?"→":"←"}</button>`:""}</li>`).join("")
            ||'<li class="leer">noch niemand</li>'}</ul>
        </div>`).join("")}
    </div>
    ${isHost?`<button id="mischen" class="sec">Teams neu auslosen</button>`:""}
    <div class="note">In beiden Teams müssen mindestens zwei Leute sein: Sie kommen abwechselnd dran, und wer am Zug ist, braucht jemanden fürs Medium und jemanden zum Raten. Also ab vier Spielern.</div>`;

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

  const zuwenig = teams ? (a<2||b<2) : on<2;
  const startKnopf=n=>isHost
    ? `<button id="go${n}" ${zuwenig?"disabled":""}>Runde starten</button>`+
      (zuwenig?`<div class="note" style="text-align:center">${teams
        ? `In beiden Teams müssen mindestens zwei Leute sein – eines gibt den Hinweis, das andere rät. Gerade: ${a} gegen ${b}. Zu zweit oder zu dritt passt „Jeder für sich“ besser.`
        : "Ihr braucht mindestens zwei Spieler: einer gibt den Hinweis, die anderen raten."}</div>`:"")
    : `<div class="card tight center note rise" style="margin:0 0 13px">Warte auf den Host…</div>`;

  paint(HEAD+frame(
    `<div class="card glow rise">
       <div class="qlbl">So läuft Wavelength</div>
       <div class="note" style="margin-top:6px">Auf der Skala stehen sich zwei Begriffe gegenüber, etwa <b>kalt</b> und <b>heiß</b>.
         Irgendwo dazwischen liegt ein verstecktes Ziel – <b>nur das Medium sieht es</b>. Es gibt einen einzigen Hinweis,
         und die anderen drehen den Zeiger dorthin, wo sie das Ziel vermuten. Je näher, desto mehr Punkte:
         <b>4</b> im Zentrum, dann 3 und 2 nach außen.</div>
     </div>`+
    klapp("spiel","Spielart & Ziel",spielInhalt,
          `${teams?"zwei Teams":"jeder für sich"} · ${S.zielPunkte?"bis "+S.zielPunkte:"ohne Ende"}`)+
    (teams?klapp("teams","Teams",teamInhalt,`${a} gegen ${b}`):"")+
    klapp("zeit","Zeitlimits",zeitInhalt,`${zeitKurz(S.tHinweis)} · ${zeitKurz(S.tRaten)}`)+
    klapp("skin","Dein Aussehen",skinInhalt,"",
          avatar({pid:myPid,name:ich.name||myName,emoji:myEmoji,color:myColor}))+
    ((canNotify()&&!notifyOn&&Notification.permission!=="denied")
      ? klapp("notif","Benachrichtigungen",
          `<div class="note" style="margin-top:0">Damit du es mitbekommst, wenn eine neue Runde startet.</div>
           <button id="notif" class="sec">Einschalten</button>`,"aus")
      : "")+
    `<div class="onlymob">${startKnopf("2")}</div>`,
    playersCard("lobby")+`<div class="onlydesk">${startKnopf("")}</div>`,
    chatSpalte()));

  wire();
  app.querySelectorAll("[data-klapp]").forEach(b=>b.onclick=()=>{
    const id=b.dataset.klapp; offeneKarten[id]=!offeneKarten[id];
    LS.set("wl_offen",offeneKarten); render();
  });
  if(el("notif")) el("notif").onclick=askNotify;
  app.querySelectorAll("[data-modus]").forEach(b=>b.onclick=()=>act({t:"modus",m:b.dataset.modus}));
  app.querySelectorAll("[data-ziel]").forEach(b=>b.onclick=()=>act({t:"ziel",n:+b.dataset.ziel}));
  if(el("zielset")) el("zielset").onclick=()=>{
    const n=Math.round(+el("zielzahl").value);
    if(!(n>=1&&n<=99)){ el("zielzahl").focus(); return; }
    act({t:"ziel",n});
  };
  app.querySelectorAll("[data-sec]").forEach(b=>b.onclick=()=>act({t:"timer",which:b.dataset.t,sec:+b.dataset.sec}));
  app.querySelectorAll("[data-min]").forEach(b=>{
    const k=b.dataset.min, feld=el("min-"+k);
    const nimm=()=>{ const m=Math.round(+feld.value);
      if(!(m>=1&&m<=60)){ feld.focus(); return; }
      act({t:"timer",which:k,sec:m*60}); };
    b.onclick=nimm;
    if(feld) feld.onkeydown=e=>{ if(e.key==="Enter") nimm(); };
  });
  app.querySelectorAll("[data-team]").forEach(b=>b.onclick=()=>
    act({t:"team",pid:b.dataset.team,team:b.dataset.nach}));
  if(el("mischen")) el("mischen").onclick=()=>act({t:"mischen"});

  const zeigeVorschau=()=>{
    const v=el("prev"); if(!v) return;
    v.innerHTML=`<div class="prevrow">${avatar({pid:myPid,name:ich.name||myName,emoji:myEmoji,color:myColor})}
      <span class="nm">${esc(ich.name||myName)}<span class="tag you">du</span></span>
      <span class="pts">${ich.score||0} Pkt</span></div>`;
  };
  zeigeVorschau();
  const merke=()=>{ LS.set("fi_emoji",myEmoji); LS.set("fi_color",myColor);
    zeigeVorschau(); act({t:"skin",emoji:myEmoji,color:myColor}); };
  app.querySelectorAll("#emo [data-e]").forEach(b=>b.onclick=()=>{
    myEmoji=(myEmoji===b.dataset.e)?"":b.dataset.e;
    app.querySelectorAll("#emo [data-e]").forEach(x=>x.classList.toggle("on",x.dataset.e===myEmoji));
    merke();
  });
  const waehle=c=>{ myColor=c;
    app.querySelectorAll("#col [data-c]").forEach(x=>x.classList.toggle("on",x.dataset.c===myColor));
    merke(); };
  app.querySelectorAll("#col [data-c]").forEach(b=>b.onclick=()=>waehle(b.dataset.c));
  const pick=el("colpick");
  if(pick){
    if(document.activeElement!==pick) pick.value=(typeof myColor==="string"?myColor:FARBEN[0]);
    pick.oninput=()=>{ myColor=pick.value;
      app.querySelectorAll("#col [data-c]").forEach(x=>x.classList.remove("on")); zeigeVorschau(); };
    pick.onchange=()=>waehle(pick.value);
  }
  ["go","go2"].forEach(id=>{ if(el(id)) el(id).onclick=()=>act({t:"start"}); });
}

function viewWaiting(){
  paint(HEAD+frame(
    `<div class="card glow center rise" style="padding:34px 20px">
       <div class="big"><span class="spin" style="width:19px;height:19px"></span>Gleich geht's los</div>
       <div class="note">Du bist im Raum <b>${esc(S.code)}</b>. Die anderen sind mitten in Runde ${S.round} –
         sobald die nächste startet, bist du dabei.</div>
     </div>`,"",chatSpalte()));
  wire();
}

/* ---------- Das Medium gibt den Hinweis ---------- */

function viewHinweis(me){
  const medium=S.players.find(p=>p.pid===S.mediumId)||{name:"?"};
  const ich=binMedium();

  const mitte = ich
    ? `<div class="card rise">
         ${skala({ziel:meinZiel, zeiger:null, karte:S.karte, beweglich:false})}
         <div class="note center" style="margin-top:4px">Nur du siehst den Zielbereich. Beschreibe ihn mit <b>einem</b> Hinweis –
           einem Wort oder einer kurzen Wendung. Danach sagst du nichts mehr.</div>
       </div>
       <div class="card rise">
         <label for="hi">Dein Hinweis</label>
         <input id="hi" maxlength="60" placeholder="z.B. „Kaffee am Morgen“" autocomplete="off" enterkeyhint="send">
         <div class="zaehler"><span id="zrest">60</span> Zeichen frei</div>
         <button id="sb">Hinweis geben</button>
         <div class="hint">Zeig dein Handy niemandem.</div>
       </div>`
    : `<div class="card rise">
         ${skala({ziel:null, zeiger:null, karte:S.karte, beweglich:false})}
       </div>
       <div class="card center rise" style="padding:26px 18px">
         <div class="grossemoji">📡</div>
         <div class="big">${esc(medium.name)} überlegt</div>
         <div class="note">Das Medium sieht als Einziges, wo der Zielbereich liegt, und sucht gerade einen Hinweis dafür.</div>
       </div>`;

  paint(HEAD+frame(mitte+uhrCard("Zeit für den Hinweis"),
    playersCard("spiel"),chatSpalte()));
  wire();
  if(ich){
    const hi=el("hi"); hi.focus();
    const zeige=()=>{ const z=el("zrest"); if(z) z.textContent=String(60-hi.value.length); };
    zeige(); hi.addEventListener("input",zeige);
    const send=()=>{ const v=hi.value.trim(); if(!v) return; act({t:"hinweis",text:v}); };
    el("sb").onclick=send; hi.onkeydown=e=>{ if(e.key==="Enter") send(); };
  }
}

/* ---------- Der Zeiger wird gesetzt ---------- */

function viewRaten(me){
  const medium=S.players.find(p=>p.pid===S.mediumId)||{name:"?"};
  const darf=raetMit(me);
  const wert = zeigerEntwurf!==null ? zeigerEntwurf : S.zeiger;

  const hinweisKarte=`<div class="card glow center rise" style="padding:20px 18px">
      <div class="qlbl">📡 ${esc(medium.name)} sagt</div>
      <div class="big" style="font-size:28px">„${esc(S.hinweis)}“</div>
    </div>`;

  let unten;
  if(darf){
    unten=`<div class="card rise">
        ${skala({ziel:binMedium()?meinZiel:null, zeiger:wert, karte:S.karte, beweglich:true})}
        <input type="range" id="regler" min="0" max="100" step="0.5" value="${wert}"
               aria-label="Position auf der Skala" class="regler">
        <div class="zeigerwert">Position <b>${Math.round(wert)}</b> von 100</div>
        <button id="fest">Zeiger festlegen</button>
        <div class="hint">Alle im Team dürfen schieben – ihr seht die Bewegung gegenseitig. Festlegen kann jeder.</div>
      </div>`;
  }else if(binMedium()){
    unten=`<div class="card rise">
        ${skala({ziel:meinZiel, zeiger:wert, karte:S.karte, beweglich:false})}
        <div class="note center">Du siehst mit, wohin sie drehen – sagen darfst du jetzt nichts mehr.</div>
      </div>`;
  }else{
    unten=`<div class="card rise">
        ${skala({ziel:null, zeiger:wert, karte:S.karte, beweglich:false})}
        <div class="note center">${S.modus==="teams"
          ? "Das andere Team ist am Zug. Gleich dürft ihr tippen, ob das Ziel weiter links oder rechts liegt."
          : "Die anderen sind am Zug."}</div>
      </div>`;
  }

  paint(HEAD+frame(hinweisKarte+uhrCard("Zeit zum Raten")+unten,
    playersCard("spiel"),chatSpalte()));
  wire();
  if(darf){
    skalaBedienen(
      w=>{ zeigerEntwurf=Math.round(w*10)/10;
           const s=el("skala"), r=el("regler");
           if(r) r.value=zeigerEntwurf;
           const wert=app.querySelector(".zeigerwert b"); if(wert) wert.textContent=Math.round(zeigerEntwurf);
           if(s) zeichneNadel(s,zeigerEntwurf); },
      ()=>{ if(zeigerEntwurf!==null) act({t:"zeiger",wert:zeigerEntwurf}); }
    );
    el("fest").onclick=()=>{
      if(zeigerEntwurf!==null) act({t:"zeiger",wert:zeigerEntwurf});
      act({t:"fest"});
    };
  }
}
/* Nadel waehrend des Ziehens direkt verschieben, ohne alles neu zu zeichnen. */
function zeichneNadel(svg,wert){
  const spitze=punkt(wert,RAUSSEN-4), fuss=punkt(wert,RINNEN-16);
  const linie=svg.querySelector(".nadel:not(.tipp)"), kopf=svg.querySelector(".nadelkopf");
  if(linie){ linie.setAttribute("x1",fuss.x); linie.setAttribute("y1",fuss.y);
             linie.setAttribute("x2",spitze.x); linie.setAttribute("y2",spitze.y); }
  if(kopf){ kopf.setAttribute("cx",spitze.x); kopf.setAttribute("cy",spitze.y); }
}

/* ---------- Links oder rechts? ---------- */

function viewSeite(me){
  const darf=tipptSeite(me);
  const aktiv=teamName(S.aktivesTeam);
  paint(HEAD+frame(
    `<div class="card glow center rise" style="padding:20px 18px">
       <div class="qlbl">Der Hinweis war</div>
       <div class="big" style="font-size:26px">„${esc(S.hinweis)}“</div>
     </div>
     <div class="card rise">
       ${skala({ziel:binMedium()?meinZiel:null, zeiger:S.zeiger, karte:S.karte, beweglich:false})}
       <div class="note center">${esc(aktiv)} hat sich festgelegt.</div>
     </div>`+
    (darf
      ? `<div class="card rise">
           <h2>Liegt das Ziel weiter links oder rechts?</h2>
           <div class="note" style="margin-top:0">Ein richtiger Tipp bringt eurem Team einen Extrapunkt.</div>
           <div class="seitenwahl">
             <button data-seite="links" class="seitenknopf">⬅<span>weiter links</span><small>${esc(S.karte?S.karte[0]:"")}</small></button>
             <button data-seite="rechts" class="seitenknopf">➡<span>weiter rechts</span><small>${esc(S.karte?S.karte[1]:"")}</small></button>
           </div>
         </div>`
      : `<div class="card center rise" style="padding:24px 18px">
           <div class="big">${esc(teamName(S.aktivesTeam==="A"?"B":"A"))} ist dran</div>
           <div class="note">Sie tippen jetzt, ob das Ziel weiter links oder weiter rechts liegt.</div>
         </div>`),
    playersCard("spiel"),chatSpalte()));
  wire();
  if(darf) app.querySelectorAll("[data-seite]").forEach(b=>b.onclick=()=>act({t:"seite",seite:b.dataset.seite}));
}

/* ---------- Auflösung ---------- */

function viewAufloesung(me){
  const r=S.letzteRunde||{};
  const medium=S.players.find(p=>p.pid===r.mediumId)||{name:"?"};
  const teams=S.modus==="teams";
  const meins = teams ? (me&&me.team===r.team) : true;
  const gut = r.treffer>0;

  const darfWeiter=isHost||binMedium();

  paint(HEAD+frame(
    `<div class="card ${gut?"win":"lose"} center rise" style="padding:24px 20px">
       <div class="verdict ${gut?"g":"r"}">${
         r.treffer===4?"Volltreffer":r.treffer===3?"Ganz nah dran":r.treffer===2?"Noch im Ziel":"Daneben"}</div>
       <div class="vsub">${r.treffer} ${r.treffer===1?"Punkt":"Punkte"} für ${teams?esc(teamName(r.team)):"alle"}
         · ${r.abstand} Schritte vom Zentrum entfernt</div>
     </div>
     <div class="card rise">
       ${skala({ziel:r.ziel, zeiger:r.zeiger, karte:r.karte, beweglich:false})}
       <div class="aufl">
         <div class="zeile"><span class="pts">📡 Hinweis</span><b>„${esc(r.hinweis||"")}“</b></div>
         <div class="zeile"><span class="pts">vom Medium</span><b>${esc(medium.name)}</b></div>
         <div class="zeile"><span class="pts">Ziel lag bei</span><b>${Math.round(r.ziel)}</b></div>
         <div class="zeile"><span class="pts">Zeiger stand auf</span><b>${Math.round(r.zeiger)}</b></div>
         ${teams&&r.seite?`<div class="zeile"><span class="pts">Tipp der Gegenseite</span>
            <b class="${r.seiteRichtig?"gut":"schlecht"}">${r.seite==="links"?"weiter links":"weiter rechts"} –
            ${r.seiteRichtig?"richtig, +1":"daneben"}</b></div>`:""}
       </div>
     </div>
     ${teams?`<div class="card rise center">
        <div class="standgross"><span class="ta">${S.punkteA}</span> : <span class="tb">${S.punkteB}</span></div>
        <div class="note" style="margin-top:2px">${teamName("A")} gegen ${teamName("B")}${S.zielPunkte?` · bis ${S.zielPunkte}`:""}</div>
      </div>`:""}
     ${darfWeiter?`<button id="weiter">Nächste Runde</button>
        ${isHost?`<button id="lb2" class="sec">Zurück in den Warteraum</button>`:""}`
       :`<div class="card center note rise">Gleich geht die nächste Runde los.</div>`}`,
    playersCard(teams?"spiel":"score"),chatSpalte()));
  wire();
  if(el("weiter")) el("weiter").onclick=()=>act({t:"start"});
  if(el("lb2")) el("lb2").onclick=()=>act({t:"lobby"});
}

/* ---------- Endstand ---------- */

function viewPodium(){
  const teams=S.modus==="teams";
  let kopf;
  if(teams){
    const sieger = S.punkteA===S.punkteB ? null : (S.punkteA>S.punkteB?"A":"B");
    kopf=`<div class="card glow center rise" style="padding:26px 18px">
       <div class="qlbl">Endstand nach ${S.round} ${S.round===1?"Runde":"Runden"}</div>
       <div class="big" style="font-size:30px">${sieger?esc(teamName(sieger))+" gewinnt":"Unentschieden"}</div>
       <div class="standgross" style="margin-top:10px"><span class="ta">${S.punkteA}</span> : <span class="tb">${S.punkteB}</span></div>
     </div>`;
  }else{
    const sortiert=[...S.players].sort((a,b)=>b.score-a.score);
    const podest=sortiert.slice(0,3), plaetze=["🥇","🥈","🥉"];
    kopf=`<div class="card glow center rise" style="padding:24px 18px">
       <div class="qlbl">Endstand nach ${S.round} ${S.round===1?"Runde":"Runden"}</div>
       <div class="big" style="font-size:30px">${podest.length?esc(podest[0].name)+" gewinnt":"Kein Ergebnis"}</div>
     </div>
     <div class="card rise"><div class="podium">${podest.map((p,i)=>`
       <div class="platz p${i+1}"><div class="krone">${plaetze[i]}</div>${avatar(p)}
         <div class="pname">${esc(p.name)}</div><div class="ppkt">${p.score} Pkt</div></div>`).join("")}</div></div>`;
  }
  paint(HEAD+frame(kopf+
    (isHost?`<button id="neu">Neues Spiel starten</button>
             <button id="lb2" class="sec">Zurück in den Warteraum</button>`
           :`<div class="card center note rise">Der Host startet ein neues Spiel.</div>`),
    playersCard("score"),chatSpalte()));
  wire();
  if(el("neu")) el("neu").onclick=()=>act({t:"reset"});
  if(el("lb2")) el("lb2").onclick=()=>act({t:"lobby"});
}
