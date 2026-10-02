/* Startpunkt der Anwendung. */

/* Beim Verlassen der Seite aktiv abmelden – dann wartet die Runde nicht unnoetig. */
window.addEventListener("pagehide",()=>{
  try{ if(!isHost&&hostConn&&hostConn.open) hostConn.send({t:"bye"}); }catch(_){}
  /* Sauber abmelden, damit der Raum nicht als verwaist stehen bleibt. */
  try{ teardown(); }catch(_){}
});
/* Welche Fassung laeuft hier gerade? Steht an den eigenen Dateien. */
const FASSUNG=(function(){
  const s=document.querySelector('script[src*="js/app.js"]');
  const m=s&&s.src.match(/[?&]v=([^&"']+)/);
  return m?m[1]:"";
})();

/* Ein laufender Raum laedt die Seite nicht neu – wer lange spielt, spielt
   sonst weiter mit einer alten Fassung und sieht laengst behobene Fehler.
   Darum wird gelegentlich nachgesehen, ob es etwas Neueres gibt. Neu geladen
   wird nichts von allein; es erscheint nur ein Hinweis zum Antippen. */
async function pruefeFassung(){
  if(!FASSUNG||neueFassung) return;
  try{
    const a=await fetch(location.pathname+"?frisch="+Date.now(),{cache:"no-store"});
    if(!a.ok) return;
    const t=await a.text();
    const m=t.match(/js\/app\.js\?v=([^"']+)/);
    if(m&&m[1]!==FASSUNG){ neueFassung=m[1]; render(); }
  }catch(_){}
}
setTimeout(pruefeFassung,45000);
setInterval(pruefeFassung,10*60*1000);

(function boot(){
  const savedHost=LS.get("mm_host",null), savedRoom=LS.get("mm_room",null);
  const fresh=o=>o&&Date.now()-o.ts<MAXAGE;
  const mine=o=>fresh(o)&&(!o.owner||o.owner===myPid);
  if(mine(savedHost)&&(!inviteCode||inviteCode===savedHost.code)){
    startHost(LS.get("fi_name","Host"),savedHost); return;      // Host lädt neu → Raum lebt weiter
  }
  if(inviteCode){
    if(mine(savedRoom)&&savedRoom.code===inviteCode){
      startClient(inviteCode,savedRoom.name); return;            // Link neu geladen → direkt zurück
    }
    const n=LS.get("fi_name","");
    if(n){ startClient(inviteCode,n); return; }
    screen="invite"; render(); return;
  }
  screen="start"; render();
})();
