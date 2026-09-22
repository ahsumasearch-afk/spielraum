/* Host-Logik fuer Wavelength. Der Host ist der Spielserver und haelt den
   Zustand. Das versteckte Ziel bekommt nur das Medium zu sehen. */

function freshState(){
  return {phase:"lobby", round:0, players:[],
          modus:"teams",              // "teams" oder "einzeln"
          mediumId:null,              // wer diese Runde das Medium ist
          aktivesTeam:"A",            // welches Team rät (nur im Teammodus)
          karte:null,                 // [links, rechts]
          ziel:50,                    // 0-100, geheim bis zur Aufloesung
          hinweis:"",
          zeiger:50,                  // gemeinsamer Zeiger des Teams (Teammodus)
          zeigerGesetzt:false,
          tipps:{},                   // "Jeder fuer sich": pid -> eigener Tipp
          seite:null,                 // "links" oder "rechts" – Tipp der Gegner
          letzteRunde:null,           // Ergebnis der letzten Runde
          punkteA:0, punkteB:0,       // Teamstand
          zielPunkte:10,              // 0 = ohne Ende
          tHinweis:0, tRaten:0, deadline:0,
          reihum:0,                   // Zaehler fuer den Rollenwechsel
          chat:[], kicked:[]};
}

const GRACE=18000, QUICK=4000, BEAT=2500, DEAD=6500, HOSTDEAD=14000;
const PAUSE=10000;   // so lange bleibt die Aufloesung stehen, dann geht es weiter

const hp=pid=>H.players.find(p=>p.pid===pid);
const mit=()=>H.players.filter(p=>!p.waiting);
const teamVon=pid=>{ const p=hp(pid); return p?p.team:null; };

/* Wer diese Runde raten muss. Im Teammodus das aktive Team ohne das Medium,
   sonst alle ausser dem Medium. */
function raterInnen(){
  return mit().filter(p=>p.pid!==H.mediumId &&
    (H.modus!=="teams" || p.team===H.aktivesTeam));
}
/* Die Gegenseite, die auf links oder rechts tippt. */
function gegner(){
  if(H.modus!=="teams") return [];
  return mit().filter(p=>p.team!==H.aktivesTeam);
}

let graceTimer=null;
function armGrace(ms){
  clearTimeout(graceTimer);
  graceTimer=setTimeout(()=>{ if(!H) return; broadcast(); },ms);
}
function saveHost(){
  if(!H||!roomCode) return;
  LS.set("wl_host",{code:roomCode,ts:Date.now(),owner:myPid,
    state:{...H,players:H.players.map(p=>({...p,online:false}))}});
}
function sendTo(p,msg,beilaeufig){ sendeAn(p.pid,msg,beilaeufig); }

/* Doppelte Nachrichten abfangen – jede Handlung wird bestaetigt zugestellt
   und kann im Zweifel zweimal ankommen. */
const gesehen={};
function schonGesehen(pid,mid){
  if(!mid) return false;
  const liste=gesehen[pid]||(gesehen[pid]=[]);
  if(liste.indexOf(mid)>=0) return true;
  liste.push(mid); if(liste.length>80) liste.shift();
  return false;
}

/* ---------------------------------------------------------------- Spieler */

function hostJoin(connId,pid,name,emoji,color){
  if(H.kicked.includes(pid)){ sendeAn(pid,{t:"denied"}); return; }
  let p=hp(pid);
  if(p){
    p.connId=pid; p.online=true; p.offSince=0; p.quick=false; p.lastSeen=Date.now();
    p.gesendetesZiel=null; p.gesendeterChat=null;     // nach Neuladen neu schicken
    if(name) p.name=uniqueName(name,pid);
    if(emoji) p.emoji=emoji;
    if(color===null||typeof color==="number"||
       (typeof color==="string"&&/^#[0-9a-fA-F]{6}$/.test(color))) p.color=color;
  }else{
    p={pid,name:uniqueName(name||"Spieler",pid),emoji:emoji||"",
       color:(color===0||color)?color:null, score:0, team:kleineresTeam(),
       online:true,connId:pid,lastSeen:Date.now(),waiting:H.phase!=="lobby"};
    H.players.push(p);
  }
  broadcast();
}
function uniqueName(n,pid){
  n=String(n).trim().slice(0,16)||"Spieler";
  const taken=H.players.filter(p=>p.pid!==pid).map(p=>p.name.toLowerCase());
  if(!taken.includes(n.toLowerCase())) return n;
  for(let i=2;i<40;i++) if(!taken.includes((n+" "+i).toLowerCase())) return n+" "+i;
  return n;
}
/* Neue Spieler landen im kleineren Team, damit es von allein ausgeglichen bleibt. */
function kleineresTeam(){
  const a=H.players.filter(p=>p.team==="A").length;
  const b=H.players.filter(p=>p.team==="B").length;
  return a<=b?"A":"B";
}
function hostKick(pid){
  const p=hp(pid); if(!p||pid===myPid) return;
  H.kicked.push(pid);
  sendTo(p,{t:"kick"});
  H.players=H.players.filter(x=>x.pid!==pid);
  if(H.mediumId===pid&&H.phase!=="lobby"&&H.phase!=="podium"){
    H.phase="lobby"; H.deadline=0;          // ohne Medium geht die Runde nicht weiter
  }
  pruefe(); broadcast();
}

/* ---------------------------------------------------------------- Runde */

function zieheKarte(){
  if(!H.used) H.used=[];
  if(H.used.length>=KARTEN.length) H.used=[];
  let i;
  do{ i=(Math.random()*KARTEN.length)|0; }while(H.used.indexOf(i)>=0);
  H.used.push(i);
  return KARTEN[i].slice();
}
/* Das Ziel liegt nie ganz am Rand – sonst waere die Haelfte der Skala tot. */
function zieheZiel(){ return Math.round(120+Math.random()*760)/10; }   // 12,0 – 88,0

/* Reihum: jede Runde ist ein anderer Spieler das Medium. Im Teammodus
   wechselt dabei auch das ratende Team. */
function naechstesMedium(){
  const da=mit().filter(p=>p.online);
  if(!da.length) return null;
  if(H.modus!=="teams"){
    const k=da[H.reihum%da.length]; H.reihum++; return k.pid;
  }
  H.aktivesTeam = H.round%2 ? "B" : "A";
  const team=da.filter(p=>p.team===H.aktivesTeam);
  if(!team.length) return da[H.reihum++%da.length].pid;
  const k=team[(H.reihum++)%team.length];
  return k.pid;
}

function spielbar(){
  const da=H.players.filter(p=>p.online).length;
  if(H.modus==="teams"){
    /* Beide Teams kommen abwechselnd dran, und das Team am Zug braucht
       mindestens zwei Leute: eines gibt den Hinweis, eines rät. */
    const a=H.players.filter(p=>p.online&&p.team==="A").length;
    const b=H.players.filter(p=>p.online&&p.team==="B").length;
    return a>=2&&b>=2;
  }
  return da>=2;             // ein Medium und mindestens ein Rater
}

function hostStartRound(){
  if(!spielbar()) return;
  H.round++;
  H.players.forEach(p=>{ p.waiting=!p.online; p.gesendetesZiel=null; });
  H.mediumId=naechstesMedium();
  H.karte=zieheKarte();
  H.ziel=zieheZiel();
  H.hinweis=""; H.zeiger=50; H.zeigerGesetzt=false; H.seite=null; H.letzteRunde=null;
  H.tipps={};
  H.players.forEach(p=>{ p.gesendeterTipp=null; });
  H.phase="hinweis"; setDeadline();
  clearTimeout(graceTimer);
  broadcast();
}
function setDeadline(){
  const sek = H.phase==="hinweis" ? H.tHinweis
            : H.phase==="raten"   ? H.tRaten : 0;
  H.deadline = sek ? Date.now()+sek*1000 : 0;
}

/* Das Medium hat seinen Hinweis gegeben. */
function hinweisGeben(text){
  if(H.phase!=="hinweis") return;
  H.hinweis=String(text||"").trim().slice(0,60)||"—";
  H.phase="raten"; setDeadline();
  broadcast();
}
/* "Jeder fuer sich": ein Spieler legt seinen eigenen Tipp fest. */
function tippSetzen(pid,wert){
  if(H.phase!=="raten"||H.modus==="teams") return;
  const p=hp(pid); if(!p||p.waiting||pid===H.mediumId) return;
  const w=Number(wert);
  if(!isFinite(w)) return;
  H.tipps[pid]=Math.max(0,Math.min(100,Math.round(w*10)/10));
  p.gesendeterTipp=null;
  pruefeTipps();
  broadcast();
}
/* Haben alle, die da sind, getippt? Dann aufdecken. */
function pruefeTipps(){
  if(H.phase!=="raten"||H.modus==="teams") return;
  const offen=raterInnen().filter(p=>p.online&&H.tipps[p.pid]===undefined);
  if(!offen.length) aufloesen();
}

/* Das ratende Team legt den gemeinsamen Zeiger fest (Teammodus). */
function zeigerFest(){
  if(H.phase!=="raten") return;
  H.zeigerGesetzt=true;
  if(H.modus==="teams"&&gegner().length){ H.phase="seite"; H.deadline=0; }
  else aufloesen();
  broadcast();
}
function seiteTippen(seite){
  if(H.phase!=="seite") return;
  H.seite = seite==="links"?"links":"rechts";
  aufloesen();
}

/* Wertung: je naeher am Mittelpunkt, desto mehr Punkte.
   Die Zonen entsprechen den Ringen auf der Scheibe im Originalspiel. */
function punkteFuer(abstand){
  if(abstand<=2)   return 4;
  if(abstand<=5)   return 3;
  if(abstand<=8.5) return 2;
  return 0;
}
function aufloesen(){
  if(H.modus==="teams") aufloesenTeams();
  else aufloesenEinzeln();
  H.phase="aufloesung";
  /* Die Auflösung bleibt kurz stehen, damit alle sie lesen können – danach
     geht es von selbst weiter. Wer nicht warten will, drückt den Knopf. */
  H.deadline=Date.now()+PAUSE;
  if(zielErreicht()){ H.phase="podium"; H.deadline=0; }
  broadcast();
}

function aufloesenTeams(){
  const abstand=Math.abs(H.zeiger-H.ziel);
  const treffer=punkteFuer(abstand);

  let bonus=0, seiteRichtig=null;
  if(H.seite){
    const wirklich = H.ziel<H.zeiger ? "links" : H.ziel>H.zeiger ? "rechts" : null;
    seiteRichtig = wirklich!==null && H.seite===wirklich;
    bonus = seiteRichtig?1:0;
  }
  if(H.aktivesTeam==="A"){ H.punkteA+=treffer; H.punkteB+=bonus; }
  else                   { H.punkteB+=treffer; H.punkteA+=bonus; }
  /* Fuer die Spielerliste zaehlen wir den Anteil auch je Person mit – das
     Medium geht dabei leer aus, es hat ja nicht geraten. */
  mit().forEach(p=>{
    if(p.pid===H.mediumId) return;
    if(p.team===H.aktivesTeam) p.score+=treffer; else p.score+=bonus;
  });

  H.letzteRunde={
    ziel:H.ziel, zeiger:H.zeiger, abstand:Math.round(abstand*10)/10,
    treffer, bonus, seite:H.seite, seiteRichtig,
    karte:H.karte, hinweis:H.hinweis, mediumId:H.mediumId, team:H.aktivesTeam
  };
}

/* Jeder fuer sich: jeder hat seinen eigenen Tipp abgegeben und bekommt dafuer
   seine eigene Punktzahl. Das Medium bekommt nichts – es kannte das Ziel. */
function aufloesenEinzeln(){
  const ergebnisse=[];
  raterInnen().forEach(p=>{
    const w=H.tipps[p.pid];
    if(w===undefined){                       // nichts abgegeben, etwa Zeit abgelaufen
      ergebnisse.push({pid:p.pid, wert:null, abstand:null, punkte:0});
      return;
    }
    const abstand=Math.abs(w-H.ziel);
    const punkte=punkteFuer(abstand);
    p.score+=punkte;
    ergebnisse.push({pid:p.pid, wert:w, abstand:Math.round(abstand*10)/10, punkte});
  });
  ergebnisse.sort((a,b)=>b.punkte-a.punkte||(a.abstand??999)-(b.abstand??999));

  const bester=ergebnisse.length?ergebnisse[0]:null;
  H.letzteRunde={
    ziel:H.ziel, ergebnisse,
    treffer: bester?bester.punkte:0,
    abstand: bester?bester.abstand:null,
    zeiger: bester&&bester.wert!==null?bester.wert:H.ziel,
    karte:H.karte, hinweis:H.hinweis, mediumId:H.mediumId, team:null,
    bestePid: bester?bester.pid:null
  };
}
function zielErreicht(){
  if(!H.zielPunkte) return false;
  if(H.modus==="teams") return H.punkteA>=H.zielPunkte||H.punkteB>=H.zielPunkte;
  return H.players.some(p=>p.score>=H.zielPunkte);
}

/* ---------------------------------------------------------------- Chat */

function chatEintrag(liste,pid,text,replyTo){
  const p=hp(pid); if(!p) return null;
  text=String(text||"").trim().slice(0,300); if(!text) return null;
  const bezug=replyTo&&liste.find(x=>x.id===replyTo);
  const n={id:uid(),pid,name:p.name,text,ts:Date.now(),
    re:bezug?{id:bezug.id,name:bezug.name,text:bezug.text.slice(0,90)}:null};
  liste.push(n);
  if(liste.length>120) liste.splice(0,liste.length-120);
  return n;
}
function hostChat(pid,text,replyTo){ if(chatEintrag(H.chat,pid,text,replyTo)) broadcast(); }

/* Der Teamchat liegt getrennt je Team und wird nur an das eigene Team
   geschickt – die andere Seite soll ihn nicht mitlesen. */
function teamListe(team){
  H.teamchat=H.teamchat||{A:[],B:[]};
  return H.teamchat[team]||(H.teamchat[team]=[]);
}
function hostTeamChat(pid,text,replyTo){
  if(H.modus!=="teams") return;
  const team=teamVon(pid); if(!team) return;
  if(chatEintrag(teamListe(team),pid,text,replyTo)){
    H.players.forEach(p=>{ if(p.team===team) p.gesendeterChat=null; });
    broadcast();
  }
}

/* ---------------------------------------------------------------- Wachdienst */

let sweepTimer=null,beatCount=0;
function hostSweep(){
  if(!H) return;
  let changed=false;
  H.players.forEach(p=>{
    if(p.pid===myPid){ p.online=true; p.lastSeen=Date.now(); return; }
    if(p.online&&Date.now()-(p.lastSeen||0)>DEAD){
      p.online=false; p.quick=true; p.offSince=Date.now(); changed=true;
    }
  });
  if(H.deadline&&Date.now()>H.deadline){
    if(H.phase==="hinweis"){ hinweisGeben(H.hinweis||"—"); return; }
    if(H.phase==="raten"){ if(H.modus==="teams") zeigerFest(); else aufloesen(); return; }
    if(H.phase==="aufloesung"){
      H.deadline=0;
      if(spielbar()) hostStartRound();
      else { H.phase="lobby"; broadcast(); }   // zu wenige Leute – zurück in den Warteraum
      return;
    }
    H.deadline=0;
  }
  const vorher=H.phase;
  pruefe();
  if(changed||H.phase!==vorher){ broadcast(); return; }
  if(++beatCount%3===0&&roomCode) sende(tAlle(roomCode),{t:"hb"},true);
  if(beatCount%5===0) verteile(publicState());
}
/* Ist das Medium verschwunden, kann die Runde nicht weitergehen. */
function pruefe(){
  if(H.phase==="lobby"||H.phase==="podium"||H.phase==="aufloesung") return;
  const m=hp(H.mediumId);
  if(!m||(!m.online&&Date.now()-(m.offSince||0)>GRACE)){
    H.phase="lobby"; H.deadline=0; return;
  }
  /* Wer weg ist, soll die Runde nicht aufhalten. */
  if(H.phase==="raten"&&H.modus!=="teams") pruefeTipps();
}

/* ---------------------------------------------------------------- Zustand */

function publicState(){
  const zeigen=H.phase==="aufloesung"||H.phase==="podium";
  return {
    phase:H.phase, round:H.round, code:roomCode, hostId:myPid,
    modus:H.modus, mediumId:H.mediumId, aktivesTeam:H.aktivesTeam,
    karte:H.karte, hinweis:H.hinweis,
    zeiger:H.zeiger, zeigerGesetzt:H.zeigerGesetzt, seite:H.seite,
    /* Waehrend des Ratens verraten wir nur, wer schon fertig ist – nicht wohin. */
    fertig: H.modus==="teams" ? [] : Object.keys(H.tipps||{}),
    /* Das Ziel geht erst bei der Aufloesung an alle. Vorher bekommt es nur
       das Medium – auf seinem eigenen Weg, nicht im gemeinsamen Zustand. */
    ziel: zeigen ? H.ziel : null,
    letzteRunde:H.letzteRunde,
    punkteA:H.punkteA, punkteB:H.punkteB, zielPunkte:H.zielPunkte,
    tHinweis:H.tHinweis||0, tRaten:H.tRaten||0, deadline:H.deadline||0,
    kartenVorrat:KARTEN.length,
    chat:(H.chat||[]).slice(-50),
    players:H.players.map(p=>({
      pid:p.pid, name:p.name, emoji:p.emoji||"",
      color:(p.color===0||p.color)?p.color:null, score:p.score,
      team:p.team, online:p.online, waiting:!!p.waiting
    }))
  };
}
let netzTimer=null, nochMal=false;
function verteile(s){
  /* Das geheime Ziel und der Teamchat gehen einzeln – beides darf nicht im
     gemeinsamen Zustand stehen. */
  H.players.forEach(p=>{
    if(p.pid!==myPid&&p.pid===H.mediumId&&H.phase!=="lobby"&&H.phase!=="podium"
       && p.gesendetesZiel!==H.ziel){
      p.gesendetesZiel=H.ziel;
      sendTo(p,{t:"ziel",z:H.ziel});
    }
    if(p.pid!==myPid&&H.modus!=="teams"){
      const w=(H.tipps||{})[p.pid];
      if(w!==undefined&&p.gesendeterTipp!==w){
        p.gesendeterTipp=w;
        sendTo(p,{t:"meintipp",w});          // damit ein Neuladen den Tipp nicht verliert
      }
    }
    if(p.pid!==myPid&&H.modus==="teams"){
      const liste=teamListe(p.team);
      if(p.gesendeterChat!==liste.length){
        p.gesendeterChat=liste.length;
        sendTo(p,{t:"tc",c:liste.slice(-50)});
      }
    }
  });
  if(roomCode) sende(tAlle(roomCode),{t:"state",s});
}
function broadcast(){
  const s=publicState();
  S=s;
  meinZiel = (H.mediumId===myPid&&H.phase!=="lobby"&&H.phase!=="podium") ? H.ziel : null;
  meinTipp = H.modus==="teams" ? null : ((H.tipps||{})[myPid]!==undefined?H.tipps[myPid]:null);
  if(H.modus==="teams"){ const me=hp(myPid); if(me) teamChat=teamListe(me.team).slice(-50); }
  saveHost(); render();
  if(netzTimer){ nochMal=true; return; }
  verteile(s);
  netzTimer=setTimeout(()=>{ netzTimer=null; if(nochMal){ nochMal=false; broadcast(); } },140);
}

/* ---------------------------------------------------------------- Nachrichten */

function hostHandle(connId,pid,msg){
  if(!H||!msg) return;
  if(msg.t==="join"){ hostJoin(msg.pid,msg.pid,msg.name,msg.emoji,msg.color); return; }
  const p=hp(pid); if(!p) return;
  p.lastSeen=Date.now();
  if(schonGesehen(pid,msg.mid)) return;
  if(msg.t==="ping"){
    if(!p.online){ p.online=true; p.quick=false; p.offSince=0; broadcast(); }
    return;
  }
  switch(msg.t){
    case "hinweis":
      if(pid===H.mediumId) hinweisGeben(msg.text);
      return;
    case "zeiger": {
      /* Jeder aus dem ratenden Team darf den Zeiger bewegen – man einigt sich
         ja ohnehin laut. Das Medium darf nicht. */
      if(H.phase!=="raten"||pid===H.mediumId) return;
      if(H.modus==="teams"&&p.team!==H.aktivesTeam) return;
      const w=Number(msg.wert);
      if(!isFinite(w)) return;
      H.zeiger=Math.max(0,Math.min(100,Math.round(w*10)/10));
      broadcast(); return;
    }
    case "fest":
      if(H.phase!=="raten"||pid===H.mediumId) return;
      if(H.modus!=="teams") return;                 // dort zaehlt der eigene Tipp
      if(p.team!==H.aktivesTeam) return;
      zeigerFest(); return;
    case "tipp":
      tippSetzen(pid,msg.wert); return;
    case "seite":
      if(H.phase!=="seite") return;
      if(H.modus==="teams"&&p.team===H.aktivesTeam) return;
      seiteTippen(msg.seite); return;
    case "chat":     hostChat(pid,msg.text,msg.replyTo); return;
    case "teamchat": hostTeamChat(pid,msg.text,msg.replyTo); return;
    case "bye":
      p.online=false; p.quick=true; p.offSince=Date.now();
      armGrace(QUICK+400); broadcast(); return;
    case "skin":
      if(msg.emoji!==undefined) p.emoji=String(msg.emoji||"").slice(0,8);
      if(msg.color===null||typeof msg.color==="number"||
         (typeof msg.color==="string"&&/^#[0-9a-fA-F]{6}$/.test(msg.color))) p.color=msg.color;
      broadcast(); return;
    case "team":
      /* In der Lobby darf jeder sein eigenes Team wechseln, der Host jedes. */
      if(H.phase!=="lobby") return;
      if(pid!==myPid&&msg.pid!==pid) return;
      { const z=hp(msg.pid)||p; z.team = msg.team==="B"?"B":"A"; broadcast(); }
      return;
    case "mischen":
      if(pid!==myPid||H.phase!=="lobby") return;
      { const da=H.players.slice();
        for(let i=da.length-1;i>0;i--){ const j=(Math.random()*(i+1))|0; [da[i],da[j]]=[da[j],da[i]]; }
        da.forEach((x,i)=>{ x.team = i%2 ? "B" : "A"; });
        broadcast(); }
      return;
    case "start":
      if(pid===myPid&&(H.phase==="lobby"||H.phase==="aufloesung")) hostStartRound();
      return;
    case "lobby":  if(pid===myPid){ H.phase="lobby"; H.deadline=0; broadcast(); } return;
    case "kick":   if(pid===myPid) hostKick(msg.pid); return;
    case "leave":
      H.players=H.players.filter(x=>x.pid!==pid);
      if(H.mediumId===pid&&H.phase!=="lobby") { H.phase="lobby"; H.deadline=0; }
      broadcast(); return;
    case "modus":
      if(pid===myPid&&H.phase==="lobby"&&(msg.m==="teams"||msg.m==="einzeln")){
        H.modus=msg.m; broadcast();
      } return;
    case "ziel":
      if(pid===myPid&&H.phase==="lobby"&&typeof msg.n==="number"&&msg.n>=0&&msg.n<=99){
        H.zielPunkte=Math.round(msg.n); broadcast();
      } return;
    case "timer":
      if(pid===myPid&&H.phase==="lobby"&&typeof msg.sec==="number"&&msg.sec>=0&&msg.sec<=3600){
        if(msg.which==="hinweis") H.tHinweis=msg.sec;
        else if(msg.which==="raten") H.tRaten=msg.sec;
        broadcast();
      } return;
    case "reset":
      if(pid===myPid){
        H.players.forEach(x=>{ x.score=0; });
        H.punkteA=0; H.punkteB=0; H.round=0; H.reihum=0;
        H.phase="lobby"; H.deadline=0; broadcast();
      } return;
    case "react": {
      if(!msg.id||!msg.emoji) return;
      const liste = msg.team && H.modus==="teams" ? teamListe(teamVon(pid)) : H.chat;
      const n=liste.find(x=>x.id===msg.id);
      if(!n) return;
      n.r=n.r||{};
      const wer=n.r[msg.emoji]||[];
      const i=wer.indexOf(pid);
      if(i>=0) wer.splice(i,1); else wer.push(pid);
      if(wer.length) n.r[msg.emoji]=wer; else delete n.r[msg.emoji];
      if(msg.team&&H.modus==="teams") H.players.forEach(x=>{ if(x.team===teamVon(pid)) x.gesendeterChat=null; });
      broadcast(); return;
    }
  }
}

let actNr=0;
function act(msg){
  if(isHost) hostHandle(myPid,myPid,msg);
  else if(roomCode)
    sende(tHost(roomCode),Object.assign({from:myPid,mid:myPid+"-"+(++actNr)},msg));
}
