/* Zeichnet die Oberflaeche.

   Wichtig: Der Bildschirm wird NICHT bei jeder Aenderung neu aufgebaut.
   Stattdessen wird der neue Stand mit dem bestehenden verglichen und nur das
   angefasst, was sich wirklich unterscheidet. Dadurch bleiben Scrollposition,
   Texteingaben, Tastaturfokus und laufende Animationen erhalten – nichts blitzt
   oder springt, wenn ein Mitspieler etwas tut. */

function attributeAngleichen(alt,neu){
  const neueA=Array.prototype.slice.call(neu.attributes);
  for(let i=0;i<neueA.length;i++){
    const at=neueA[i];
    if(alt.getAttribute(at.name)!==at.value) alt.setAttribute(at.name,at.value);
  }
  const alteA=Array.prototype.slice.call(alt.attributes);
  for(let i=0;i<alteA.length;i++){
    if(!neu.hasAttribute(alteA[i].name)) alt.removeAttribute(alteA[i].name);
  }
}
function patch(alt,neu){
  const a=Array.prototype.slice.call(alt.childNodes);
  const b=Array.prototype.slice.call(neu.childNodes);
  const max=Math.max(a.length,b.length);
  for(let i=0;i<max;i++){
    const x=a[i], y=b[i];
    if(!y){ if(x&&x.parentNode===alt) alt.removeChild(x); continue; }
    if(!x){ alt.appendChild(y.cloneNode(true)); continue; }
    if(x.nodeType!==y.nodeType||x.nodeName!==y.nodeName){ alt.replaceChild(y.cloneNode(true),x); continue; }
    if(x.nodeType===3){ if(x.nodeValue!==y.nodeValue) x.nodeValue=y.nodeValue; continue; }
    if(x.nodeType!==1) continue;
    if(x.isEqualNode(y)) continue;              // unveraendert – nicht anfassen
    attributeAngleichen(x,y);
    patch(x,y);
  }
}
function paint(html){
  const voll=(banner?`<div class="warn">${esc(banner)}</div>`:"")+html;

  // Chat nur mitscrollen, wenn der Leser ohnehin unten steht
  const logAlt=el("clog");
  const amEnde=logAlt?(logAlt.scrollHeight-logAlt.scrollTop-logAlt.clientHeight<40):true;

  if(!app.firstChild){ app.innerHTML=voll; }
  else { const puffer=document.createElement("div"); puffer.innerHTML=voll; patch(app,puffer); }

  // Entwuerfe zuruecksetzen, aber niemals in ein Feld schreiben, in dem gerade getippt wird
  const ai=el("ai");
  if(ai){ if(document.activeElement!==ai) ai.value=draftAnswer; ai.oninput=()=>draftAnswer=ai.value; }
  const ci=el("ci");
  if(ci){ if(document.activeElement!==ci) ci.value=draftChat; ci.oninput=()=>draftChat=ci.value; }
  const log=el("clog");
  if(log&&amEnde) log.scrollTop=log.scrollHeight;
}
function render(){
  if(screen==="start")      return viewStart();
  if(screen==="invite")     return viewInvite();
  if(screen==="connecting") return viewWait();
  if(screen==="error")      return viewError();
  if(screen==="kicked")     return viewKicked();
  if(!S) return viewWait();
  announce();
  if(chatOpen) chatSeen=(S.chat||[]).length;
  const me=S.players.find(p=>p.pid===myPid);
  if(me&&me.waiting&&S.phase!=="lobby"&&S.phase!=="podium") return viewWaiting();   // Nachzuegler: nur warten
  if(S.phase==="lobby")  return viewLobby();
  if(S.phase==="answer") return viewAnswer(me);
  if(S.phase==="reveal") return viewReveal(me);
  if(S.phase==="vote")   return viewVote(me);
  if(S.phase==="result") return viewResult(me);
  if(S.phase==="podium") return viewPodium();
}
