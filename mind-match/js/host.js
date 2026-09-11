/* Host-Logik fuer Mind-Match. Der Host ist der Spielserver und haelt den Zustand.
   Die Verbindungspflege ist dieselbe wie beim Fragen-Impostor. */

function freshState(){
  return {phase:"lobby", round:0, players:[],
          kingId:null, kingZaehler:0,      // reihum, damit jeder einmal King ist
          fragen:[],                       // die Fragen dieser Runde
          qi:0,                            // welche Frage gerade laeuft
          kingAntworten:[],                // Antworten des Kings, eine je Frage
          verlauf:[],                      // abgeschlossene Fragen zum Nachlesen
          ergebnis:null,                   // wer hat die Runde gewonnen
          maxRounds:0,                     // 0 = unbegrenzt
          proRunde:5,                      // Fragen je Runde
          startLeben:3,
          tKing:0, tAnswer:0, deadline:0,
          used:[], chat:[], kicked:[],
          kat:KATEGORIEN.map(function(k){return k.id;})};
}

const GRACE=18000;   // Reserve fuer stille Faelle
const QUICK=4000;    // abgemeldet oder Herzschlag ausgeblieben: nur kurz warten
const BEAT=2500;     // so oft meldet sich jeder Spieler beim Host
const DEAD=6500;     // so lange Stille, dann gilt jemand als weg
const HOSTDEAD=14000;// so lange Stille vom Host, dann verbindet der Client neu

const hp=pid=>H.players.find(p=>p.pid===pid);
const active=()=>H.players.filter(p=>p.online&&!p.waiting);
const mit=()=>H.players.filter(p=>!p.waiting);                       // in der Runde dabei
const istKing=pid=>H.kingId===pid;
/* Wer gerade antworten muss: alle ausser dem King, die noch Leben haben. */
const dran=()=>mit().filter(p=>p.pid!==H.kingId&&!p.raus);
const blockers=()=>dran().filter(p=>p.online||Date.now()-(p.offSince||0)<(p.quick?QUICK:GRACE));

let graceTimer=null;
function armGrace(ms){
  clearTimeout(graceTimer);
  graceTimer=setTimeout(()=>{ if(!H) return; pruefeAntworten(); broadcast(); },ms);
}

function saveHost(){
  if(!H||!roomCode) return;
  LS.set("mm_host",{code:roomCode,ts:Date.now(),owner:myPid,
    state:{...H,players:H.players.map(p=>({...p,connId:null,online:false}))}});
}
function sendTo(p,msg){ const c=p.connId&&conns[p.connId]; if(c&&c.open){ try{c.send(msg);}catch(_){} } }

function hostJoin(connId,pid,name,emoji,color){
  if(H.kicked.includes(pid)){
    const c=conns[connId]; if(c&&c.open) c.send({t:"denied"});
    return;
  }
  let p=hp(pid);
  if(p){                                   // Wiederkehrer: alles bleibt erhalten
    p.connId=connId; p.online=true; p.offSince=0; p.quick=false; p.lastSeen=Date.now();
    if(name) p.name=uniqueName(name,pid);
    if(emoji) p.emoji=emoji;
    if(color===null||typeof color==="number"||
       (typeof color==="string"&&/^#[0-9a-fA-F]{6}$/.test(color))) p.color=color;
  }else{
    p={pid,name:uniqueName(name||"Spieler",pid),emoji:emoji||"",
       color:(color===0||color)?color:null,score:0,
       leben:H.startLeben,raus:false,antwort:null,getroffen:false,
       online:true,connId,lastSeen:Date.now(),waiting:H.phase!=="lobby"};
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
function hostOffline(connId){
  const p=H.players.find(x=>x.connId===connId);
  delete conns[connId];
  if(!p) return;
  const saidBye=p.quick&&Date.now()-(p.offSince||0)<3000;
  p.online=false; p.connId=null;
  if(!saidBye){ p.quick=false; p.offSince=Date.now(); }
  armGrace(saidBye?QUICK+400:GRACE+500); broadcast();
}
function hostKick(pid){
  const p=hp(pid); if(!p||pid===myPid) return;
  H.kicked.push(pid);
  sendTo(p,{t:"kick"});
  const c=p.connId&&conns[p.connId];
  H.players=H.players.filter(x=>x.pid!==pid);
  setTimeout(()=>{ try{c&&c.close();}catch(_){} },300);
  if(H.kingId===pid&&H.phase!=="lobby"){ H.phase="lobby"; H.deadline=0; }   // King weg: zurueck
  pruefeAntworten(); broadcast();
}

/* ---------------------------------------------------------------- Fragen */

/* Alle Fragen der gewaehlten Kategorien. */
function vorrat(){
  const aktiv=H.kat||[];
  const liste=[];
  for(let i=0;i<FRAGEN.length;i++) if(aktiv.indexOf(FRAGEN[i][1])>=0) liste.push(i);
  return liste;
}
/* Zieht die Fragen einer Runde ohne Zuruecklegen. Aus jeder Schwierigkeits-
   stufe kommt eine feste Anzahl, sonst waeren zufaellig auch mal drei
   harmlose Fragen hintereinander moeglich. Am Ende jeder Runde steht immer
   mindestens eine Zwickmuehle (Stufe 4) – da wird es richtig eng. */
function zieheFragen(anzahl){
  if(!H.used) H.used=[];
  const pool=vorrat();
  if(pool.filter(i=>H.used.indexOf(i)<0).length<anzahl)
    H.used=H.used.filter(i=>pool.indexOf(i)<0);            // Vorrat war leer: neu mischen
  const frei={1:[],2:[],3:[],4:[]};
  pool.forEach(i=>{ if(H.used.indexOf(i)<0) frei[FRAGEN[i][2]].push(i); });

  /* Bei kurzen Runden zaehlt die Spannweite mehr als die Verteilung:
     lieber leicht -> brutal als dreimal Mittelfeld. */
  let quote;
  if(anzahl===1)      quote={1:0,2:1,3:0,4:0};
  else if(anzahl===2) quote={1:1,2:0,3:0,4:1};
  else if(anzahl===3) quote={1:1,2:0,3:1,4:1};
  else{
    /* Von hinten rechnen: die schweren Stufen bekommen ihren Anteil zuerst,
       sonst frisst das Aufrunden am Ende die Zwickmuehlen weg. */
    quote={4:Math.max(1,Math.round(anzahl*0.2)),
           3:Math.max(1,Math.round(anzahl*0.25)),
           2:Math.max(1,Math.round(anzahl*0.3))};
    quote[1]=anzahl-quote[2]-quote[3]-quote[4];
    /* Passt der Rest nicht mehr, oben wieder etwas abknapsen. */
    for(let st=2; quote[1]<1 && st<=3; st++)
      while(quote[1]<1 && quote[st]>1){ quote[st]--; quote[1]++; }
    if(quote[1]<1){ quote[1]=1; quote[2]=Math.max(0,anzahl-1-quote[3]-quote[4]); }
  }

  const gezogen=[];
  const zieh=st=>{
    const liste=frei[st]; if(!liste.length) return false;
    const i=liste.splice((Math.random()*liste.length)|0,1)[0];
    H.used.push(i); gezogen.push(i); return true;
  };
  [1,2,3,4].forEach(st=>{ for(let n=0;n<quote[st];n++) if(!zieh(st)) break; });
  /* Fehlt noch etwas, weil eine Stufe leer war: von den Nachbarn auffuellen. */
  while(gezogen.length<anzahl && (frei[1].length||frei[2].length||frei[3].length||frei[4].length))
    if(!zieh(2)&&!zieh(3)&&!zieh(1)&&!zieh(4)) break;

  gezogen.sort((a,b)=>FRAGEN[a][2]-FRAGEN[b][2]);
  return gezogen.map(i=>({text:FRAGEN[i][0], kat:FRAGEN[i][1], schwer:FRAGEN[i][2]}));
}

/* Antworten vergleichbar machen: Gross- und Kleinschreibung, Satzzeichen,
   doppelte Leerzeichen und ein fuehrender Artikel sollen keine Rolle spielen. */
function normal(s){
  return String(s||"").toLowerCase()
    .replace(/[.,!?;:"'`´()\[\]-]/g," ")
    .replace(/\s+/g," ").trim()
    .replace(/^(der|die|das|ein|eine|einen|einem|einer|den|dem)\s+/,"")
    .trim();
}

function setDeadline(phase){
  const sec=phase==="king"?H.tKing:phase==="answer"?H.tAnswer:0;
  H.deadline=sec?Date.now()+sec*1000:0;
}

/* ---------------------------------------------------------------- Runde */

function naechsterKing(){
  const da=H.players.filter(p=>p.online);
  if(!da.length) return null;
  const k=da[H.kingZaehler%da.length];
  H.kingZaehler++;
  return k.pid;
}
function hostStartRound(){
  const da=H.players.filter(p=>p.online);
  if(da.length<2) return;                    // ein King und mindestens einer, der raet
  if(vorrat().length<H.proRunde) return;     // zu wenig Fragen in der Auswahl
  H.round++;
  H.kingId=naechsterKing();
  H.fragen=zieheFragen(H.proRunde);
  H.kingAntworten=[]; H.verlauf=[]; H.qi=0; H.ergebnis=null;
  H.players.forEach(p=>{
    p.waiting=!p.online;                     // wer gerade weg ist, sitzt die Runde aus
    p.leben=H.startLeben; p.raus=false; p.antwort=null; p.getroffen=false;
  });
  H.phase="king"; setDeadline("king");
  clearTimeout(graceTimer);
  broadcast();
}

/* Der King hat eine Frage beantwortet. */
function kingAntwort(text){
  if(H.phase!=="king") return;
  H.kingAntworten[H.qi]=String(text||"").trim().slice(0,120)||"—";
  H.qi++;
  if(H.qi>=H.fragen.length){                 // fertig, jetzt sind die anderen dran
    H.qi=0;
    H.players.forEach(p=>{ p.antwort=null; p.getroffen=false; });
    H.phase="answer"; setDeadline("answer");
  }else{
    setDeadline("king");
  }
  broadcast();
}

/* Haben alle geantwortet? Dann aufdecken. */
function pruefeAntworten(force){
  if(H.phase!=="answer") return;
  const b=force?dran().filter(p=>p.online):blockers();
  if(!b.length){ aufdecken(); return; }
  if(b.every(p=>p.antwort!=null)) aufdecken();
}

/* Vergleich mit dem King, Leben abziehen, Ergebnis festhalten. */
function aufdecken(){
  const kingA=normal(H.kingAntworten[H.qi]);
  dran().forEach(p=>{
    p.getroffen = p.antwort!=null && normal(p.antwort)===kingA;
    if(p.getroffen){
      p.leben=Math.max(0,p.leben-1);
      if(p.leben===0) p.raus=true;
    }
  });
  H.verlauf.push({
    frage:H.fragen[H.qi].text,
    king:H.kingAntworten[H.qi],
    antworten:mit().filter(p=>p.pid!==H.kingId).map(p=>({
      pid:p.pid, text:p.antwort, getroffen:!!p.getroffen, leben:p.leben
    }))
  });
  H.phase="reveal"; H.deadline=0;
  broadcast();
}

/* Weiter zur naechsten Frage – oder Runde beenden. */
function weiter(){
  if(H.phase!=="reveal") return;
  const uebrig=mit().filter(p=>p.pid!==H.kingId&&!p.raus);
  H.qi++;
  if(!uebrig.length||H.qi>=H.fragen.length){ rundeEnde(); return; }
  H.players.forEach(p=>{ p.antwort=null; p.getroffen=false; });
  H.phase="answer"; setDeadline("answer");
  broadcast();
}

function rundeEnde(){
  const andere=mit().filter(p=>p.pid!==H.kingId);
  const ueberlebt=andere.filter(p=>!p.raus);
  const king=hp(H.kingId);
  if(!ueberlebt.length){
    if(king) king.score+=2;                  // alle ausgeschieden: der King raeumt ab
    H.ergebnis={kingGewinnt:true, ueberlebt:[]};
  }else{
    andere.forEach(p=>{ p.score+=1; });      // einer hat durchgehalten: Punkt fuer alle anderen
    H.ergebnis={kingGewinnt:false, ueberlebt:ueberlebt.map(p=>p.pid)};
  }
  H.phase="roundend"; H.deadline=0;
  if(H.maxRounds&&H.round>=H.maxRounds) H.phase="podium";
  broadcast();
}

/* ---------------------------------------------------------------- Chat */

function hostChat(pid,text,replyTo){
  const p=hp(pid); if(!p) return;
  text=String(text||"").trim().slice(0,300); if(!text) return;
  const bezug=replyTo&&H.chat.find(x=>x.id===replyTo);
  H.chat.push({id:uid(),pid,name:p.name,text,ts:Date.now(),
    re:bezug?{id:bezug.id,name:bezug.name,text:bezug.text.slice(0,90)}:null});
  if(H.chat.length>120) H.chat=H.chat.slice(-120);
  broadcast();
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
  if(H.deadline&&Date.now()>H.deadline){                  // Zeit ist um
    if(H.phase==="king"){ kingAntwort(H.kingAntworten[H.qi]||"—"); return; }
    if(H.phase==="answer"){ aufdecken(); return; }
    H.deadline=0;
  }
  const before=H.phase;
  pruefeAntworten();
  if(changed||H.phase!==before){ broadcast(); return; }
  if(++beatCount%3===0) Object.values(conns).forEach(c=>{ if(c.open){ try{c.send({t:"hb"});}catch(_){} } });
}

/* ---------------------------------------------------------------- Zustand teilen */

function publicState(){
  const zeigen=H.phase==="reveal"||H.phase==="roundend"||H.phase==="podium";
  return {
    phase:H.phase, round:H.round, code:roomCode, hostId:myPid,
    kingId:H.kingId, qi:H.qi, anzahlFragen:H.fragen.length,
    frage:(H.phase==="lobby"||H.phase==="podium")?null:(H.fragen[H.qi]||null),
    /* Die Antwort des Kings wird erst beim Aufdecken mitgeschickt. */
    kingAntwort:zeigen?(H.kingAntworten[H.qi]||null):null,
    kingFertig:H.kingAntworten.length,
    verlauf:H.verlauf,
    ergebnis:H.ergebnis,
    maxRounds:H.maxRounds||0, proRunde:H.proRunde, startLeben:H.startLeben,
    tKing:H.tKing||0, tAnswer:H.tAnswer||0, deadline:H.deadline||0,
    kat:H.kat||[], vorrat:vorrat().length,
    chat:H.chat,
    players:H.players.map(p=>({
      pid:p.pid, name:p.name, emoji:p.emoji||"",
      color:(p.color===0||p.color)?p.color:null, score:p.score,
      online:p.online, waiting:!!p.waiting,
      leben:p.leben, raus:!!p.raus,
      geantwortet:p.antwort!=null,
      antwort:zeigen?p.antwort:null,
      getroffen:zeigen?!!p.getroffen:false
    }))
  };
}
function broadcast(){
  const s=publicState();
  H.players.forEach(p=>{
    if(p.pid===myPid){ S=s; return; }
    sendTo(p,{t:"state",s});
  });
  saveHost(); render();
}

/* ---------------------------------------------------------------- Nachrichten */

function hostHandle(connId,pid,msg){
  if(!H||!msg) return;
  if(msg.t==="join"){ hostJoin(connId,msg.pid,msg.name,msg.emoji,msg.color); return; }
  const p=hp(pid); if(!p) return;
  p.lastSeen=Date.now();
  if(msg.t==="ping"){
    if(!p.online){ p.online=true; p.quick=false; p.offSince=0; if(connId) p.connId=connId; broadcast(); }
    return;
  }
  switch(msg.t){
    case "king":                                  // Antwort des Kings
      if(pid===H.kingId) kingAntwort(msg.text);
      return;
    case "answer":
      if(H.phase!=="answer"||p.waiting||p.raus||pid===H.kingId) return;
      p.antwort=String(msg.text||"").trim().slice(0,120)||"—";
      pruefeAntworten(); broadcast(); return;
    case "weiter":  if(pid===myPid) weiter(); return;
    case "force":   if(pid===myPid){ pruefeAntworten(true); broadcast(); } return;
    case "chat":    hostChat(pid,msg.text,msg.replyTo); return;
    case "bye":
      p.online=false; p.quick=true; p.offSince=Date.now();
      armGrace(QUICK+400); broadcast(); return;
    case "skin":
      if(msg.emoji!==undefined) p.emoji=String(msg.emoji||"").slice(0,8);
      if(msg.color===null||typeof msg.color==="number"||
         (typeof msg.color==="string"&&/^#[0-9a-fA-F]{6}$/.test(msg.color))) p.color=msg.color;
      broadcast(); return;
    case "start":   if(pid===myPid&&(H.phase==="lobby"||H.phase==="roundend")) hostStartRound(); return;
    case "lobby":   if(pid===myPid){ H.phase="lobby"; H.deadline=0; broadcast(); } return;
    case "kick":    if(pid===myPid) hostKick(msg.pid); return;
    case "leave":
      H.players=H.players.filter(x=>x.pid!==pid);
      if(H.kingId===pid&&H.phase!=="lobby"){ H.phase="lobby"; H.deadline=0; }
      pruefeAntworten(); broadcast(); return;
    case "kat":
      if(pid===myPid&&H.phase==="lobby"&&Array.isArray(msg.ids)){
        const gueltig=KATEGORIEN.map(k=>k.id);
        H.kat=msg.ids.filter(x=>gueltig.indexOf(x)>=0);
        broadcast();
      } return;
    case "rounds":
      if(pid===myPid&&H.phase==="lobby"&&typeof msg.n==="number"&&msg.n>=0&&msg.n<=99){
        H.maxRounds=Math.round(msg.n); broadcast();
      } return;
    case "prorunde":
      if(pid===myPid&&H.phase==="lobby"&&typeof msg.n==="number"&&msg.n>=1&&msg.n<=20){
        H.proRunde=Math.round(msg.n); broadcast();
      } return;
    case "leben":
      if(pid===myPid&&H.phase==="lobby"&&typeof msg.n==="number"&&msg.n>=1&&msg.n<=5){
        H.startLeben=Math.round(msg.n); broadcast();
      } return;
    case "timer":
      if(pid===myPid&&H.phase==="lobby"&&typeof msg.sec==="number"&&msg.sec>=0&&msg.sec<=3600){
        if(msg.which==="king") H.tKing=msg.sec;
        else if(msg.which==="answer") H.tAnswer=msg.sec;
        broadcast();
      } return;
    case "reset":
      if(pid===myPid){
        H.players.forEach(p=>{ p.score=0; });
        H.round=0; H.kingZaehler=0; H.phase="lobby"; H.deadline=0; broadcast();
      } return;
    case "react": {
      if(!msg.id||!msg.emoji) return;
      const n=H.chat.find(x=>x.id===msg.id);
      if(!n) return;
      n.r=n.r||{};
      const wer=n.r[msg.emoji]||[];
      const idx=wer.indexOf(pid);
      if(idx>=0) wer.splice(idx,1); else wer.push(pid);
      if(wer.length) n.r[msg.emoji]=wer; else delete n.r[msg.emoji];
      broadcast(); return;
    }
  }
}
function act(msg){
  if(isHost) hostHandle(null,myPid,msg);
  else if(hostConn&&hostConn.open){ try{hostConn.send(msg);}catch(_){} }
}
