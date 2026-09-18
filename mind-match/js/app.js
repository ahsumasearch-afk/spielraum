/* Startpunkt der Anwendung. */

/* Beim Verlassen der Seite aktiv abmelden – dann wartet die Runde nicht unnoetig. */
window.addEventListener("pagehide",()=>{
  try{ if(!isHost&&hostConn&&hostConn.open) hostConn.send({t:"bye"}); }catch(_){}
  /* Sauber abmelden, damit der Raum nicht als verwaist stehen bleibt. */
  try{ teardown(); }catch(_){}
});
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
