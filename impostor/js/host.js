/* Host-Logik: Der Host ist der Spielserver und haelt den Zustand. */

function freshState(){
  return {phase:"lobby",round:0,players:[],mainQuestion:"",
          impIds:[],                 // die Luegner dieser Runde
          maxRounds:0,               // 0 = unbegrenzt
          impCount:1,                // gewuenschte Anzahl Luegner
          impRandom:false,           // true = jede Runde neu auslosen
          tally:{},topIds:[],caught:false,chat:[],kicked:[],
          tAnswer:0,tTalk:0,tVote:0,deadline:0,used:[],
          kat:KATEGORIEN.map(function(k){return k.id;})};
}
const GRACE=18000;   // Reserve fuer stille Faelle
const QUICK=4000;    // abgemeldet oder Herzschlag ausgeblieben: nur kurz auf Rueckkehr warten
const BEAT=2500;     // so oft meldet sich jeder Spieler beim Host
const DEAD=6500;     // so lange Stille, dann gilt jemand als weg
const HOSTDEAD=14000;// so lange Stille vom Host, dann versucht der Client neu zu verbinden
const hp=pid=>H.players.find(p=>p.pid===pid);
const active=()=>H.players.filter(p=>p.online&&!p.waiting);
const inRound=()=>H.players.filter(p=>!p.waiting);
/* Wer die Runde blockiert: alle Mitspieler, die online sind oder gerade erst
   weggefallen sind (z.B. weil sie neu laden). Wer laenger weg ist, wird uebergangen. */
const blockers=()=>inRound().filter(p=>p.online||Date.now()-(p.offSince||0)<(p.quick?QUICK:GRACE));
let graceTimer=null;
function armGrace(ms){
  clearTimeout(graceTimer);
  graceTimer=setTimeout(()=>{ if(!H) return; checkAnswers(); checkVotes(); broadcast(); },ms);
}

function saveHost(){
  if(!H||!roomCode) return;
  LS.set("fi_host",{code:roomCode,ts:Date.now(),owner:myPid,
    state:{...H,players:H.players.map(p=>({...p,online:false}))}});
}
function sendTo(p,msg,beilaeufig){ sendeAn(p.pid,msg,beilaeufig); }

/* Doppelte Nachrichten abfangen. Weil jede Handlung jetzt bestaetigt
   zugestellt wird, kann sie im Zweifel zweimal ankommen – ein Chatbeitrag
   soll deswegen nicht doppelt im Fenster stehen. */
const gesehen={};
function schonGesehen(pid,mid){
  if(!mid) return false;
  const liste=gesehen[pid]||(gesehen[pid]=[]);
  if(liste.indexOf(mid)>=0) return true;
  liste.push(mid); if(liste.length>80) liste.shift();
  return false;
}

function hostJoin(connId,pid,name,emoji,color){
  if(H.kicked.includes(pid)){
    sendeAn(pid,{t:"denied"});
    return;
  }
  let p=hp(pid);
  if(p){                                   // Wiederkehrer: alles bleibt erhalten
    p.connId=pid; p.online=true; p.offSince=0; p.quick=false; p.lastSeen=Date.now();
    p.gesendeteFrage=null;                    // nach einem Neuladen neu schicken
    if(name) p.name=uniqueName(name,pid);
    if(emoji) p.emoji=emoji;
    if(color===0||color) p.color=color;   // Zahl (alt) oder Farbwert wie "#22c55e"
  }else{
    p={pid,name:uniqueName(name||"Spieler",pid),emoji:emoji||"",color:(color===0||color)?color:null,score:0,answer:null,vote:null,question:"",
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
/* Ein Abgang faellt jetzt nur noch durch ausbleibende Lebenszeichen auf
   (siehe hostSweep) oder weil sich jemand ausdruecklich abmeldet. */
function hostKick(pid){
  const p=hp(pid); if(!p||pid===myPid) return;
  H.kicked.push(pid);
  sendTo(p,{t:"kick"});

  H.players=H.players.filter(x=>x.pid!==pid);
  checkAnswers(); checkVotes(); broadcast();
}
/* Alle Paare, die zu den gewaehlten Kategorien gehoeren.
   Die Auswahl ist immer ausdruecklich – ist sie leer, gibt es keinen Vorrat
   und der Host kann die Runde nicht starten. */
function vorrat(){
  const aktiv=H.kat||[];
  const liste=[];
  for(let i=0;i<PAIRS.length;i++) if(aktiv.indexOf(PAIRS[i][2])>=0) liste.push(i);
  return liste;
}
/* Zieht ein Fragenpaar ohne Zuruecklegen. Erst wenn der gewaehlte Vorrat
   erschoepft ist, wird nur dieser Teil wieder freigegeben – die Historie
   der anderen Kategorien bleibt bestehen. */
function ziehePaar(){
  if(!H.used) H.used=[];
  const pool=vorrat();
  let frei=pool.filter(function(i){ return H.used.indexOf(i)<0; });
  if(!frei.length){
    H.used=H.used.filter(function(i){ return pool.indexOf(i)<0; });
    frei=pool;
  }
  const i=frei[(Math.random()*frei.length)|0];
  H.used.push(i);
  return PAIRS[i];
}
/* Verteilt eine frische Frage in der laufenden Runde – auch fuer den Skip-Knopf. */
/* Wie viele Luegner sind bei dieser Spielerzahl moeglich?
   Mindestens ein ehrlicher Spieler muss uebrig bleiben. */
function maxLuegner(n){ return Math.max(1,n-1); }
function neueFrage(){
  const act=H.players.filter(p=>p.online);
  if(!act.length) return;
  const pair=ziehePaar(), flip=Math.random()<.5;
  const main=flip?pair[1]:pair[0], other=flip?pair[0]:pair[1];
  const grenze=maxLuegner(act.length);
  const wieViele=H.impRandom
    ? 1+((Math.random()*grenze)|0)          // jede Runde neu ausgelost
    : Math.min(H.impCount||1,grenze);
  const topf=act.slice();
  H.impIds=[];
  for(let i=0;i<wieViele&&topf.length;i++){
    H.impIds.push(topf.splice((Math.random()*topf.length)|0,1)[0].pid);
  }
  H.mainQuestion=main;
  H.tally={}; H.topIds=[]; H.caught=false;
  clearTimeout(graceTimer);
  H.players.forEach(p=>{ p.answer=null; p.vote=null;
    p.waiting=!p.online;                       // wer gerade weg ist, sitzt die Runde aus
    p.question=(H.impIds.indexOf(p.pid)>=0)?other:main; });
  setDeadline("answer");
}
function hostStartRound(){
  if(H.players.filter(p=>p.online).length<3) return;
  if(!vorrat().length) return;                 // ohne Kategorie gibt es keine Fragen
  H.round++; H.phase="answer"; neueFrage(); broadcast();
}
/* Setzt die Uhr fuer die neue Phase – 0 heisst: ohne Zeitlimit. */
function setDeadline(phase){
  const sec=phase==="answer"?H.tAnswer:phase==="reveal"?H.tTalk:phase==="vote"?H.tVote:0;
  H.deadline=sec?Date.now()+sec*1000:0;
}
function checkAnswers(force){
  if(H.phase!=="answer") return;
  const b=force?active():blockers();
  if(b.length>=2&&b.every(p=>p.answer!=null)){ H.phase="reveal"; setDeadline("reveal"); }
}
function checkVotes(force){
  if(H.phase!=="vote") return;
  const b=force?active():blockers();
  if(!(b.length>=2&&b.every(p=>p.vote!=null))) return;
  finishVotes();
}
/* Teamwertung: Entweder gewinnt die Gruppe gemeinsam oder der Luegner allein.
   Der einzelne richtige Tipp bringt nichts, wenn die Mehrheit danebenliegt. */
function finishVotes(){
  const voters=inRound().filter(p=>p.vote!=null);
  const t={}; voters.forEach(p=>{ t[p.vote]=(t[p.vote]||0)+1; });
  const werte=Object.values(t);
  const max=werte.length?Math.max(...werte):0;
  const tops=Object.keys(t).filter(k=>t[k]===max);
  H.tally=t; H.topIds=tops;
  const istLuegner=pid=>H.impIds.indexOf(pid)>=0;
  H.caught=tops.length===1&&istLuegner(tops[0]);
  if(H.caught) inRound().forEach(p=>{ if(!istLuegner(p.pid)) p.score+=1; });
  else inRound().forEach(p=>{ if(istLuegner(p.pid)) p.score+=1; });
  H.phase="result"; H.deadline=0;
  /* Nach der letzten Runde folgt statt einer weiteren das Podium. */
  if(H.maxRounds&&H.round>=H.maxRounds) H.phase="podium";
}
function hostChat(pid,text,replyTo){
  const p=hp(pid); if(!p) return;
  text=String(text||"").trim().slice(0,300); if(!text) return;
  const bezug=replyTo&&H.chat.find(x=>x.id===replyTo);
  H.chat.push({id:uid(),pid,name:p.name,text,ts:Date.now(),
    re:bezug?{id:bezug.id,name:bezug.name,text:bezug.text.slice(0,90)}:null});
  if(H.chat.length>120) H.chat=H.chat.slice(-120);
  broadcast();
}
/* Der Host prueft regelmaessig, wer sich nicht mehr meldet – auf das close-Ereignis
   von WebRTC ist kein Verlass, wenn jemand einfach den Tab zumacht. */
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
  if(H.deadline&&Date.now()>H.deadline){                      // Zeit ist um
    if(H.phase==="answer"){ H.phase="reveal"; setDeadline("reveal"); broadcast(); return; }
    if(H.phase==="reveal"){ H.phase="vote";   setDeadline("vote");   broadcast(); return; }
    if(H.phase==="vote"){   finishVotes();                            broadcast(); return; }
    H.deadline=0;
  }
  const before=H.phase;
  checkAnswers(); checkVotes();
  if(changed||H.phase!==before){ broadcast(); return; }
  if(++beatCount%3===0&&roomCode) sende(tAlle(roomCode),{t:"hb"},true);
  /* Alle zehn Sekunden den vollen Zustand nachreichen. Sollte doch einmal
     etwas verlorengehen, holt sich jeder damit von selbst wieder ein. */
  if(beatCount%5===0) verteile(publicState());
}
function publicState(){
  const show=H.phase==="reveal"||H.phase==="vote"||H.phase==="result";
  return {
    phase:H.phase,round:H.round,code:roomCode,hostId:myPid,
    mainQuestion:H.phase==="answer"?"":H.mainQuestion,
    impIds:(H.phase==="result"||H.phase==="podium")?(H.impIds||[]):[],
    impostorQuestion:(H.phase==="result"||H.phase==="podium")
      ?((hp((H.impIds||[])[0])||{}).question||""):"",
    maxRounds:H.maxRounds||0, impCount:H.impCount||1, impRandom:!!H.impRandom,
    maxImp:maxLuegner(H.players.filter(p=>p.online).length),
    tally:H.tally,topIds:H.topIds,caught:H.caught,chat:(H.chat||[]).slice(-50),
    tAnswer:H.tAnswer||0, tTalk:H.tTalk||0, tVote:H.tVote||0, deadline:H.deadline||0,
    kat:H.kat||[], vorrat:vorrat().length,
    players:H.players.map(p=>({
      pid:p.pid,name:p.name,emoji:p.emoji||"",color:(p.color===0||p.color)?p.color:null,score:p.score,online:p.online,waiting:!!p.waiting,
      answered:p.answer!=null,voted:p.vote!=null,
      answer:show?p.answer:null,
      question:(H.phase==="result"||H.phase==="podium")?p.question:"",vote:H.phase==="result"?p.vote:null
    }))
  };
}
/* Der eigene Bildschirm wird sofort aktualisiert, das Verschicken aber kurz
   gebuendelt: 25 Chatbeitraege kurz hintereinander loesten sonst 25 volle
   Zustandspakete aus. */
let netzTimer=null, nochMal=false;
/* Der Zustand ist fuer alle derselbe – der geht einmal an alle. Nur die
   persoenliche Frage ist je Spieler verschieden, und die wird auch nur dann
   verschickt, wenn sie sich wirklich geaendert hat. */
function verteile(s){
  H.players.forEach(p=>{
    if(p.pid===myPid){ myQuestion=p.question; return; }
    if(p.gesendeteFrage!==p.question){
      p.gesendeteFrage=p.question;
      sendTo(p,{t:"q",q:p.question});          // zuerst die Frage …
    }
  });
  if(roomCode) sende(tAlle(roomCode),{t:"state",s});   // … dann der Zustand
}
function broadcast(){
  const s=publicState();
  S=s;
  const ich=hp(myPid); if(ich) myQuestion=ich.question;
  saveHost(); render();
  if(netzTimer){ nochMal=true; return; }
  verteile(s);
  netzTimer=setTimeout(()=>{ netzTimer=null; if(nochMal){ nochMal=false; broadcast(); } },140);
}
function hostHandle(connId,pid,msg){
  if(!H||!msg) return;
  if(msg.t==="join"){ hostJoin(msg.pid,msg.pid,msg.name,msg.emoji,msg.color); return; }
  const p=hp(pid); if(!p) return;
  p.lastSeen=Date.now();
  if(schonGesehen(pid,msg.mid)) return;
  if(msg.t==="ping"){                       // Herzschlag: zurueck aus kurzer Stille
    if(!p.online){ p.online=true; p.quick=false; p.offSince=0; broadcast(); }
    return;
  }
  switch(msg.t){
    case "answer":
      if(H.phase!=="answer"||p.waiting) return;
      p.answer=String(msg.text||"").trim().slice(0,250)||"—";
      checkAnswers(); broadcast(); return;
    case "vote":
      if(H.phase!=="vote"||p.waiting||msg.target===pid||!hp(msg.target)) return;
      p.vote=msg.target; checkVotes(); broadcast(); return;
    case "chat": hostChat(pid,msg.text,msg.replyTo); return;
    case "bye":                                   // Spieler verlaesst die Seite
      p.online=false; p.quick=true; p.offSince=Date.now();
      armGrace(QUICK+400); broadcast(); return;
    case "force":                                 // Host: ohne die Abwesenden weiter
      if(pid===myPid){ checkAnswers(true); checkVotes(true); broadcast(); } return;
    case "start":  if(pid===myPid&&H.phase==="lobby") hostStartRound(); return;
    case "kat":                                   // Kategorien waehlen (nur Host, nur im Warteraum)
      if(pid===myPid&&H.phase==="lobby"&&Array.isArray(msg.ids)){
        const gueltig=KATEGORIEN.map(function(k){return k.id;});
        H.kat=msg.ids.filter(function(x){ return gueltig.indexOf(x)>=0; });
        broadcast();
      }
      return;
    case "skip":                                  // Host ueberspringt die aktuelle Frage
      if(pid===myPid&&H.phase==="answer"){ neueFrage(); broadcast(); } return;
    case "skin":                                  // Emoji/Farbe im Warteraum aendern
      if(msg.emoji!==undefined) p.emoji=String(msg.emoji||"").slice(0,8);
      if(msg.color===null||typeof msg.color==="number"||
         (typeof msg.color==="string"&&/^#[0-9a-fA-F]{6}$/.test(msg.color))) p.color=msg.color;
      broadcast(); return;
    case "tovote": if(pid===myPid&&H.phase==="reveal"){H.phase="vote";setDeadline("vote");broadcast();} return;
    case "next":   if(pid===myPid&&H.phase==="result") hostStartRound(); return;
    case "lobby":  if(pid===myPid){H.phase="lobby";H.deadline=0;broadcast();} return;
    case "kick":   if(pid===myPid) hostKick(msg.pid); return;   // auch mitten in der Runde
    case "rounds":
      if(pid===myPid&&H.phase==="lobby"&&typeof msg.n==="number"&&msg.n>=0&&msg.n<=99){
        H.maxRounds=Math.round(msg.n); broadcast();
      } return;
    case "imps":
      if(pid===myPid&&H.phase==="lobby"&&typeof msg.n==="number"){
        if(msg.n===0){ H.impRandom=true; }      // 0 steht fuer "jede Runde auslosen"
        else {
          H.impRandom=false;
          H.impCount=Math.max(1,Math.min(Math.round(msg.n),maxLuegner(H.players.filter(p=>p.online).length)));
        }
        broadcast();
      } return;
    case "reset":                                 // Punkte auf null fuer einen fairen Neustart
      if(pid===myPid){
        H.players.forEach(p=>{ p.score=0; });
        H.round=0; H.phase="lobby"; H.deadline=0; broadcast();
      } return;
    case "react": {                               // Reaktion auf eine Chatnachricht
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
    case "timer":                                 // Zeiten einstellen (nur Host, nur im Warteraum)
      if(pid===myPid&&H.phase==="lobby"&&typeof msg.sec==="number"&&msg.sec>=0&&msg.sec<=3600){
        if(msg.which==="answer") H.tAnswer=msg.sec;
        else if(msg.which==="talk") H.tTalk=msg.sec;
        else if(msg.which==="vote") H.tVote=msg.sec;
        broadcast();
      }
      return;
    case "leave":                                 // Spieler verlaesst den Raum freiwillig
      H.players=H.players.filter(x=>x.pid!==pid);
      checkAnswers(); checkVotes(); broadcast(); return;
  }
}
/* Eine Handlung ausloesen. Der Host rechnet selbst, alle anderen schicken
   sie ueber das Relais an ihn – mit Absender, damit er weiss, wer gemeint ist. */
let actNr=0;
function act(msg){
  if(isHost) hostHandle(myPid,myPid,msg);
  else if(roomCode)
    sende(tHost(roomCode),Object.assign({from:myPid,mid:myPid+"-"+(++actNr)},msg));
}
