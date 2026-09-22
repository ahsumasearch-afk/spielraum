/* Uhr, Ton und Benachrichtigungen. */

/* ---------- Uhr ---------- */
const secLabel=v=>v<60?v+" Sek":(v/60)+" Min";
const fmtTime=sec=>Math.floor(sec/60)+":"+String(sec%60).padStart(2,"0");
const timeLeft=()=>(S&&S.deadline)?Math.max(0,Math.round((S.deadline-Date.now())/1000)):null;
setInterval(()=>{
  const t=timeLeft(); if(t===null) return;
  const hot=t<=15;
  document.querySelectorAll(".clockv").forEach(n=>{
    n.textContent=fmtTime(t); n.classList.toggle("hot",hot);
  });
},500);

/* ---------- Ton ---------- */
let soundOn=LS.get("fi_sound",true), ac=null;
function beep(kind){
  if(!soundOn) return;
  try{
    const AC=window.AudioContext||window.webkitAudioContext; if(!AC) return;
    ac=ac||new AC(); if(ac.state==="suspended") ac.resume();
    const t=ac.currentTime;
    const noten = kind==="chat"?[[880,0]]
               : kind==="soft"?[[523,0],[698,.12]]
               : [[659,0],[988,.14],[1319,.28]];      // Aufruf: dreitoenig, faellt auf
    noten.forEach(([f,d])=>{
      const o=ac.createOscillator(), g=ac.createGain();
      o.type="sine"; o.frequency.value=f;
      g.gain.setValueAtTime(.0001,t+d);
      g.gain.exponentialRampToValueAtTime(kind==="chat"?.12:.2,t+d+.02);
      g.gain.exponentialRampToValueAtTime(.0001,t+d+.32);
      o.connect(g); g.connect(ac.destination);
      o.start(t+d); o.stop(t+d+.34);
    });
  }catch(_){}
}

/* ---------- Benachrichtigungen ---------- */
const TITLE="Wavelength";
let lastPhase=null,lastRound=0,lastChat=0,notifyOn=LS.get("fi_notify",false);
const canNotify=()=>typeof Notification!=="undefined";

/* Was gerade zu tun ist – steht immer im Tab-Titel. */
function stateTitle(){
  if(!S) return TITLE;
  const me=S.players.find(p=>p.pid===myPid);
  if(me&&me.waiting) return "Warten auf die nächste Runde";
  const binMedium=S.mediumId===myPid;
  if(S.phase==="hinweis") return binMedium?"📡 Du bist das Medium – gib den Hinweis":"Das Medium überlegt";
  if(S.phase==="raten"){
    if(binMedium) return "Die anderen raten";
    return raetMit(me)?"⏳ Jetzt den Zeiger setzen!":"Das andere Team rät";
  }
  if(S.phase==="seite")      return tipptSeite(me)?"⬅ ➡ Links oder rechts?":"Die Gegenseite tippt";
  if(S.phase==="aufloesung") return "🎯 Auflösung";
  if(S.phase==="podium") return "🏆 Endstand";
  return "Warteraum";
}
function updateTitle(){
  if(!S||screen!=="game"){ document.title=TITLE; return; }
  const unread=document.hidden?Math.max(0,(S.chat||[]).length-chatSeen):0;
  document.title=(unread?"("+unread+") ":"")+stateTitle()+" · "+TITLE;
}
function notify(short,body,sound){
  beep(sound||"alert");
  if(document.hidden&&notifyOn&&canNotify()&&Notification.permission==="granted"){
    try{ new Notification(TITLE,{body:body||short,tag:"mind-match",renotify:true}); }catch(_){}
  }
}
document.addEventListener("visibilitychange",updateTitle);
function askNotify(){
  if(!canNotify()) return;
  Notification.requestPermission().then(r=>{
    notifyOn=(r==="granted"); LS.set("fi_notify",notifyOn); render();
  });
}
/* Vergleicht den neuen Zustand mit dem letzten und meldet, was passiert ist. */
function announce(){
  if(!S) return;
  const chat=(S.chat||[]).length;
  if(lastPhase!==null&&chat>lastChat){
    const m=S.chat[chat-1];
    if(m&&m.pid!==myPid){
      if(document.hidden||!chatOpen) notify("Neue Nachricht",m.name+": "+m.text,"chat");
    }
  }
  lastChat=chat;
  if(S.phase!==lastPhase||S.round!==lastRound){
    if(lastPhase!==null){
      if(S.phase==="hinweis")         notify("Neue Runde","Runde "+S.round+" läuft.",S.mediumId===myPid?"alert":"soft");
      else if(S.phase==="raten")      notify("Der Hinweis ist da","„"+S.hinweis+"“","alert");
      else if(S.phase==="seite")      notify("Links oder rechts?","Die Gegenseite ist dran.","alert");
      else if(S.phase==="aufloesung") notify("Auflösung","","soft");
      else if(S.phase==="lobby")  notify("Zurück im Warteraum","","soft");
    }
    lastPhase=S.phase; lastRound=S.round;
  }
  updateTitle();
}

const HEAD=`<a class="zurueck" href="../"><span class="pf">←</span>Zurück zum Spielraum</a>
<div class="brand"><span class="mark">📡</span><h1>Wave<em>length</em></h1></div>`;
