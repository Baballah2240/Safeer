// Cities and company route planning share the existing staff dialog/session UI.
const select=(name,label,options,value,{t,e},required=true)=>`<label>${t(label)}<select name="${name}" ${required?'required':''}>${options.map(([id,title])=>`<option value="${e(id)}" ${id===value?'selected':''}>${e(title)}</option>`).join('')}</select></label>`;
const names=(row,{input,e})=>input('nameEn','English name','text',`maxlength="100" value="${e(row?.nameEn||'')}"`)+input('nameAr','Arabic name','text',`dir="rtl" maxlength="100" value="${e(row?.nameAr||'')}"`);
const enabled=(row,{t})=>`<label class="staff-check"><input name="active" type="checkbox" ${row?.active!==false?'checked':''}>${t('Active')}</label>`;
// D121: a city photo is shown to passengers on popular route cards to that city.
export const cityPhotoUrl=c=>c?.photoVersion?`/api/v1/public/cities/${encodeURIComponent(c.code)}/photo?v=${encodeURIComponent(c.photoVersion)}`:'';
// Shrink a chosen picture on this device (at most 1280 px wide, WebP) so it fits the 128 KB limit.
async function shrinkPhoto(file){
 if(!['image/png','image/jpeg','image/webp'].includes(file.type))throw Error('INVALID_PHOTO');
 let bitmap;try{bitmap=await createImageBitmap(file);}catch{throw Error('INVALID_PHOTO');}
 const scale=Math.min(1,1280/bitmap.width),canvas=document.createElement('canvas');canvas.width=Math.round(bitmap.width*scale);canvas.height=Math.round(bitmap.height*scale);
 canvas.getContext('2d').drawImage(bitmap,0,0,canvas.width,canvas.height);bitmap.close?.();
 for(const [width,quality] of [[1280,.82],[1280,.7],[1280,.58],[960,.6],[800,.5]]){
  let source=canvas;if(canvas.width>width){source=document.createElement('canvas');source.width=width;source.height=Math.round(canvas.height*width/canvas.width);source.getContext('2d').drawImage(canvas,0,0,source.width,source.height);}
  // Browsers that cannot write WebP fall back to JPEG.
  let blob=await new Promise(resolve=>source.toBlob(resolve,'image/webp',quality));if(!blob||blob.type!=='image/webp')blob=await new Promise(resolve=>source.toBlob(resolve,'image/jpeg',quality));
  if(blob&&['image/webp','image/jpeg'].includes(blob.type)&&blob.size<=131072)return await new Promise((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(r.result);r.onerror=()=>reject(Error('INVALID_PHOTO'));r.readAsDataURL(blob);});
 }
 throw Error('PHOTO_TOO_LARGE');
}
export function citiesView(data,{t,e,language}){
 const name=row=>e(language==='ar'?row.nameAr:row.nameEn);
 return `<section class="staff-panel"><header class="staff-section-head"><div><h1>${t('Cities & destinations')}</h1><p>${t('Shared city catalog. Only the Super Administrator can change it.')}</p></div>${data.canManage?`<button type="button" data-city-create class="staff-primary">${t('Add city')}</button>`:''}</header><label>${t('Search')}<input id="staff-search" type="search" placeholder="${e(t('Search cities'))}"></label><div class="staff-grid route-catalog">${data.items.map(c=>`<article class="staff-record city-record" data-search="${e(c.nameEn+' '+c.nameAr+' '+c.code)}">${cityPhotoUrl(c)?`<img class="city-photo" src="${cityPhotoUrl(c)}" alt="" width="320" height="180" loading="lazy">`:`<span class="city-photo city-photo-empty">${t('No photo yet')}</span>`}<strong>${name(c)}</strong><p><bdi>${e(c.code)} · ${e(c.countryCode)}</bdi></p><span class="staff-badge">${t(c.active?'Active':'Inactive')}</span>${data.canManage?`<div class="staff-actions"><button type="button" data-city-edit="${c.id}">${t('Edit city')}</button><button type="button" data-city-photo="${c.id}">${t('City photo')}</button></div>`:''}</article>`).join('')||`<p>${t('No cities yet. Ask the Super Administrator to add them.')}</p>`}</div></section>`;
}
export function bindCities(root,data,ctx){
 const {api,openForm,input,currentPassword,e}=ctx;
 const form=row=>openForm(row?'Edit city':'Add city',names(row,ctx)+input('code','Code','text',`pattern="[A-Za-z0-9_-]+" maxlength="40" value="${e(row?.code||'')}"`)+input('countryCode','Country code','text',`pattern="[A-Za-z]{2}" minlength="2" maxlength="2" value="${e(row?.countryCode||'SD')}"`)+enabled(row,ctx)+currentPassword(),f=>api('cities'+(row?'/'+row.id:''),row?'PATCH':'POST',{...Object.fromEntries(f),active:f.has('active'),...(row?{version:row.version}:{})}));
 root.querySelector('[data-city-create]')?.addEventListener('click',()=>form());
 root.querySelectorAll('[data-city-edit]').forEach(b=>b.onclick=()=>form(data.items.find(c=>c.id===b.dataset.cityEdit)));
 const {t}=ctx;
 root.querySelectorAll('[data-city-photo]').forEach(b=>b.onclick=()=>{const c=data.items.find(x=>x.id===b.dataset.cityPhoto);
  openForm('City photo',`<p>${t('Passengers see this photo on popular routes to this city. Use a landscape picture of the place, not a bus.')}</p>${cityPhotoUrl(c)?`<img class="city-photo" src="${cityPhotoUrl(c)}" alt="" width="320" height="180">`:''}<label>${t('Photo (PNG, JPEG or WebP)')}<input name="photo" type="file" accept="image/png,image/jpeg,image/webp"></label>${c.photoVersion?`<label class="staff-check"><input name="removePhoto" type="checkbox">${t('Remove photo')}</label>`:''}`+currentPassword(),
   async f=>{const file=f.get('photo'),remove=f.has('removePhoto');if(!(file&&file.size)&&!remove)throw Error('INVALID_PHOTO');
    return api('cities/'+c.id+'/photo','PUT',remove&&!(file&&file.size)?{removePhoto:true,currentPassword:f.get('currentPassword')}:{photo:await shrinkPhoto(file),currentPassword:f.get('currentPassword')});});});
}
export function routesView(data,ctx){
 const {t,e,language}=ctx,items=data.routeCatalog?.items||[],name=id=>{const c=data.cities.find(c=>c.id===id);return c?e(language==='ar'?c.nameAr:c.nameEn):e(id);};
 return `<section class="staff-panel"><header class="staff-section-head"><div><h2>${t('Routes & stops')}</h2><p>${t('Plan your company routes before adding buses and trips.')}</p></div>${data.routeCatalog?.canManage?`<button type="button" data-route-create class="staff-primary">${t('Create route')}</button>`:''}</header><label>${t('Search')}<input type="search" id="staff-search" placeholder="${e(t('Search routes'))}"></label><div class="staff-grid route-catalog">${items.map(r=>`<article class="staff-record" data-search="${e(r.code+' '+r.nameEn+' '+r.nameAr)}"><span class="staff-badge">${t(r.active?'Active':'Inactive')}</span><h3>${e(language==='ar'?r.nameAr:r.nameEn)}</h3><p><bdi>${e(r.code)}</bdi></p><p class="route-endpoints">${name(r.originCityId)} <span aria-hidden="true"> / </span> ${name(r.destinationCityId)}</p><p>${t('Stops')}: ${r.stopCount} · ${t('Version')}: ${r.version}</p><div class="staff-actions"><button type="button" data-route-view="${r.id}">${t('View stops')}</button>${r.stopCount>2?`<button type="button" data-route-fares="${r.id}">${t('Prices between stops')}</button>`:''}${data.routeCatalog?.canManage?`<button type="button" data-route-edit="${r.id}">${t('Edit route')}</button>`:''}</div></article>`).join('')||`<p>${t('No routes yet. Add cities and station locations, then create a route.')}</p>`}</div><p class="staff-muted">${t('Active routes use active cities and stations. Retire a route before deactivating its resources.')}</p></section>`;
}
export function bindRoutes(root,data,ctx){
 const {api,openForm,input,currentPassword,dialog,t,e,language}=ctx,cid=data.company.id,path='companies/'+cid+'/routes';
 const display=row=>language==='ar'?row.nameAr:row.nameEn;
 const routeForm=(detail)=>{
  const row=detail?.route;
  const cityOptions=selected=>[['',t('Choose city')],...data.cities.filter(c=>c.active||c.id===selected).map(c=>[c.id,display(c)])];
  const stopRow=(stop={})=>`<fieldset class="route-stop" data-route-stop><legend>${t('Stop')} <span data-stop-number></span></legend>${select('cityId','City',cityOptions(stop.cityId),stop.cityId||'',ctx)}${select('stationId','Station (optional)',[['',t('City only')],...data.stations.map(s=>[s.id,display(s)])],stop.stationId||'',ctx,false)}<div class="staff-actions"><button type="button" data-stop-up aria-label="${e(t('Move stop up'))}">${t('Move up')}</button><button type="button" data-stop-down aria-label="${e(t('Move stop down'))}">${t('Move down')}</button><button type="button" data-stop-remove>${t('Remove stop')}</button></div></fieldset>`;
  openForm(row?'Edit route':'Create route',names(row,ctx)+input('code','Code','text',`pattern="[A-Za-z0-9_-]+" maxlength="40" value="${e(row?.code||'')}"`)+enabled(row,ctx)+`<p>${t('Add 2 to 30 stops in travel order. The first and last cities must differ.')}</p><div data-route-stops>${(detail?.stops||[{},{}]).map(stopRow).join('')}</div><button type="button" data-stop-add>${t('Add stop')}</button>`+currentPassword(),f=>api(path+(row?'/'+row.id:''),row?'PATCH':'POST',{code:f.get('code'),nameEn:f.get('nameEn'),nameAr:f.get('nameAr'),active:f.has('active'),stops:[...dialog.querySelectorAll('[data-route-stop]')].map(el=>({cityId:el.querySelector('[name=cityId]').value,stationId:el.querySelector('[name=stationId]').value||null})),currentPassword:f.get('currentPassword'),...(row?{version:row.version}:{})}));
  const list=dialog.querySelector('[data-route-stops]');
  const renumber=()=>{const rows=[...list.children];rows.forEach((el,i)=>{el.querySelector('[data-stop-number]').textContent=String(i+1);el.querySelector('[data-stop-up]').disabled=i===0;el.querySelector('[data-stop-down]').disabled=i===rows.length-1;el.querySelector('[data-stop-remove]').disabled=rows.length<=2;});dialog.querySelector('[data-stop-add]').disabled=rows.length>=30;};
  const bind=el=>{
   const city=el.querySelector('[name=cityId]'),station=el.querySelector('[name=stationId]');
   const filter=()=>{const keep=station.value,usable=data.stations.filter(s=>{const branch=data.branches.find(b=>b.id===s.branchId);return s.cityId&&s.cityId===city.value&&((s.active&&branch?.active!==false)||s.id===keep);});station.replaceChildren(new Option(t('City only'),''),...usable.map(s=>new Option(display(s),s.id)));station.value=usable.some(s=>s.id===keep)?keep:'';let hint=el.querySelector('[data-stop-station-hint]');if(!hint){hint=document.createElement('small');hint.dataset.stopStationHint='';hint.className='staff-muted';station.closest('label')?.after(hint);}hint.textContent=city.value&&!usable.length?t('No stations in this city yet. Add one in Branches & stations and set its city.'):'';};
   city.onchange=()=>{station.value='';filter();};filter();
   el.querySelector('[data-stop-remove]').onclick=()=>{if(list.children.length>2){el.remove();renumber();}};
   el.querySelector('[data-stop-up]').onclick=()=>{if(el.previousElementSibling){list.insertBefore(el,el.previousElementSibling);renumber();el.querySelector('[data-stop-down]').focus();}};
   el.querySelector('[data-stop-down]').onclick=()=>{if(el.nextElementSibling){list.insertBefore(el.nextElementSibling,el);renumber();el.querySelector('[data-stop-up]').focus();}};
  };
  [...list.children].forEach(bind);renumber();
  dialog.querySelector('[data-stop-add]').onclick=()=>{if(list.children.length>=30)return;list.insertAdjacentHTML('beforeend',stopRow());bind(list.lastElementChild);renumber();list.lastElementChild.querySelector('select').focus();};
 };
 root.querySelector('[data-route-create]')?.addEventListener('click',()=>routeForm());
 const open=async(button,edit)=>{
  button.disabled=true;
  try{
   const detail=await api(path+'/'+(button.dataset.routeEdit||button.dataset.routeView));if(!button.isConnected)return;
   if(edit){routeForm(detail);return;}
   const title=display(detail.route);
   dialog.innerHTML=`<header class="staff-section-head"><h2>${e(title)}</h2><button type="button" data-route-close>${t('Close')}</button></header><ol class="route-stop-list">${detail.stops.map(s=>{const city=data.cities.find(c=>c.id===s.cityId),station=data.stations.find(st=>st.id===s.stationId);return `<li><strong>${e(city?display(city):s.cityId)}</strong><span>${station?e(display(station)):t(s.stationId?'Assigned station':'City only')}</span></li>`;}).join('')}</ol>`;
   dialog.querySelector('[data-route-close]').onclick=()=>dialog.close();dialog.showModal();
  }catch(error){if(button.isConnected){dialog.innerHTML=`<p role="alert">${e(t(error.message))}</p><button type="button" data-route-close>${t('Close')}</button>`;dialog.querySelector('[data-route-close]').onclick=()=>dialog.close();dialog.showModal();}}
  finally{if(button.isConnected)button.disabled=false;}
 };
 // D89: the price list for journeys between stops. The whole route uses each trip's own fare; an empty price is not sold.
 const amount=minor=>{const v=BigInt(minor);return `${v/100n}.${String(v%100n).padStart(2,'0')}`;};
 const toMinor=value=>{const s=String(value||'').replace(/[,\s]/g,'');if(!s)return null;if(!/^\d{1,6}(\.\d{1,2})?$/.test(s))throw Error('INVALID_FARES');const [w,c='']=s.split('.');return Number(w)*100+Number((c+'00').slice(0,2));};
 const fares=async button=>{
  button.disabled=true;
  try{
   const id=button.dataset.routeFares,list=await api(path+'/'+id+'/fares');if(!button.isConnected)return;
   const stop=s=>e(language==='ar'?s.cityNameAr:s.cityNameEn)+(s.stationNameEn?' · '+e(language==='ar'?s.stationNameAr:s.stationNameEn):''),last=list.stops.length-1;
   const price=(i,j)=>list.fares.find(x=>x.from===i&&x.to===j);
   const pairs=[];for(let i=0;i<last;i++)for(let j=i+1;j<=last;j++)if(!(i===0&&j===last))pairs.push([i,j]);
   const rows=pairs.map(([i,j])=>{const p=price(i,j);return `<tr><th scope="row">${stop(list.stops[i])}</th><td>${stop(list.stops[j])}</td><td>${list.canManage?`<input name="fare-${i}-${j}" inputmode="decimal" dir="ltr" maxlength="10" pattern="[0-9][0-9,]*(\\.[0-9]{1,2})?" value="${p?e(amount(p.fareMinor)):''}" aria-label="${e(t('Price'))}">`:`<bdi>${p?e(amount(p.fareMinor)):t('Not sold')}</bdi>`}</td></tr>`;}).join('');
   const html=`<p>${t('Set a price for each journey passengers can book between two stops, in the trip currency. Leave a price empty to not sell that journey. The whole route always uses the fare set on each trip.')}</p><div class="staff-table-wrap route-fares"><table class="staff-table"><thead><tr><th scope="col">${t('From')}</th><th scope="col">${t('To')}</th><th scope="col">${t('Price')}</th></tr></thead><tbody>${rows}</tbody></table></div>`;
   if(!list.canManage){dialog.innerHTML=`<header class="staff-section-head"><h2>${t('Prices between stops')}</h2><button type="button" data-route-close>${t('Close')}</button></header>${html}`;dialog.querySelector('[data-route-close]').onclick=()=>dialog.close();dialog.showModal();return;}
   openForm('Prices between stops',html+currentPassword(),f=>{const out=[];for(const [i,j] of pairs){const v=toMinor(f.get(`fare-${i}-${j}`));if(v!==null)out.push({from:i,to:j,fareMinor:v});}return api(path+'/'+id+'/fares','PUT',{fares:out,currentPassword:f.get('currentPassword')});},{submit:'Save prices'});
  }catch(error){if(button.isConnected){dialog.innerHTML=`<p role="alert">${e(t(error.message))}</p><button type="button" data-route-close>${t('Close')}</button>`;dialog.querySelector('[data-route-close]').onclick=()=>dialog.close();dialog.showModal();}}
  finally{if(button.isConnected)button.disabled=false;}
 };
 root.querySelectorAll('[data-route-fares]').forEach(b=>b.onclick=()=>void fares(b));
 root.querySelectorAll('[data-route-view]').forEach(b=>b.onclick=()=>void open(b,false));
 root.querySelectorAll('[data-route-edit]').forEach(b=>b.onclick=()=>void open(b,true));
}
