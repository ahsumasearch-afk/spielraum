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
const TITLE="Mind-Match";
let lastPhase=null,lastRound=0,lastChat=0,notifyOn=LS.get("fi_notify",false);
const canNotify=()=>typeof Notification!=="undefined";

/* Was gerade zu tun ist – steht immer im Tab-Titel. */
function stateTitle(){
  if(!S) return TITLE;
  const me=S.players.find(p=>p.pid===myPid);
  if(me&&me.waiting) return "Warten auf die nächste Runde";
  if(S.phase==="king")   return S.kingId===myPid?"👑 Du bist der King – antworte!":"Der King legt vor";
  if(S.phase==="answer"){
    if(S.kingId===myPid) return "Die anderen raten";
    if(me&&me.raus)      return "Du bist raus – schau zu";
    return me&&me.geantwortet?"Warten auf die anderen":"⏳ Jetzt antworten!";
  }
  if(S.phase==="reveal")   return "💥 Auflösung";
  if(S.phase==="roundend") return "🏆 Rundenergebnis";
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
      if(S.phase==="king")        notify("Neue Runde","Runde "+S.round+" läuft – der King legt vor.",S.kingId===myPid?"alert":"soft");
      else if(S.phase==="answer") notify("Du bist dran","Antworte anders als der King.","alert");
      else if(S.phase==="reveal") notify("Auflösung","Wer hat den King getroffen?","soft");
      else if(S.phase==="roundend") notify("Runde vorbei","","soft");
      else if(S.phase==="lobby")  notify("Zurück im Warteraum","","soft");
    }
    lastPhase=S.phase; lastRound=S.round;
  }
  updateTitle();
}

const HEAD=`<div class="brand"><a class="zurueck" href="../" title="Zur Spielauswahl">←</a><span class="mark">🧠</span><h1>Mind-<em>Match</em></h1></div>`;
