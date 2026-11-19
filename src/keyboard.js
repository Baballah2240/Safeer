// D123: typing on phones, for every page. Keeps the focused field above the on-screen keyboard,
// adds Next/Go keys that walk through a form, and hides floating bottom bars while typing.
const touch=matchMedia('(pointer:coarse)');
const typable='input:not([type=hidden]):not([type=checkbox]):not([type=radio]):not([type=button]):not([type=submit]):not([type=reset]):not([type=file]):not([type=range]):not([type=color]),textarea,select';
const textLike=el=>el instanceof HTMLElement&&el.matches(typable)&&!el.matches('select');
const vv=window.visualViewport;
const fields=form=>[...form.querySelectorAll(typable)].filter(el=>!el.disabled&&!el.readOnly&&el.getClientRects().length);

// Next on every field but the last of a form; Go (or Search) on the last one.
function hint(el){
 if(!textLike(el)||el.hasAttribute('enterkeyhint')||el.matches('textarea'))return;
 const list=el.form?fields(el.form):[],last=list.indexOf(el)===list.length-1;
 el.setAttribute('enterkeyhint',el.type==='search'?'search':last||!el.form?'go':'next');
 if(!last&&el.form)el.dataset.keyboardNext='';
}

// When the keyboard covers the field, bring it to the middle of what is still visible.
function reveal(el){
 if(!el?.isConnected)return;
 const r=el.getBoundingClientRect(),bottom=vv?vv.height+vv.offsetTop:innerHeight;
 if(r.bottom>bottom-24||r.top<64)el.scrollIntoView({block:'center',behavior:'smooth'});
}

function opened(){
 if(!vv)return false;
 return innerHeight-vv.height>120;
}
function update(){
 const on=touch.matches&&opened()&&textLike(document.activeElement);
 document.documentElement.classList.toggle('keyboard-open',on);
 document.documentElement.style.setProperty('--keyboard-inset',on?Math.max(0,innerHeight-vv.height-vv.offsetTop)+'px':'0px');
 if(on)reveal(document.activeElement);
}

document.addEventListener('focusin',event=>{
 const el=event.target;if(!textLike(el))return;hint(el);
 if(touch.matches)setTimeout(()=>{reveal(el);update();},320);
});
document.addEventListener('focusout',()=>setTimeout(update,80));
document.addEventListener('keydown',event=>{
 const el=event.target;
 if(event.key!=='Enter'||event.isComposing||!touch.matches||!textLike(el)||el.matches('textarea')||!('keyboardNext' in el.dataset)||!el.form)return;
 const list=fields(el.form),next=list[list.indexOf(el)+1];
 if(!next)return;
 event.preventDefault();next.focus();
});
vv?.addEventListener('resize',update);
vv?.addEventListener('scroll',update);
