// D93: a bank transfer at the counter needs a photo of the transfer. Staff take a photo or upload an image;
// it is shrunk on the device (longest side 1600 px, JPEG) so it stays small enough to send with the payment.
const MAX_BYTES=380000;
export function proofField({t,e},proof,{id='proof',hidden=false}={}){
 return `<div class="payment-proof" data-proof="${e(id)}" ${hidden?'hidden':''}><p class="payment-proof-title"><strong>${t('Proof of transfer')}</strong> <small class="staff-muted">${t('Required for bank transfers. Take a photo of the transfer or upload a screenshot.')}</small></p>${proof?`<figure class="payment-proof-preview"><img src="${proof}" alt="${t('Proof of transfer')}"><figcaption><button type="button" data-proof-remove>${t('Remove')}</button></figcaption></figure>`:`<div class="payment-proof-actions"><label class="staff-link payment-proof-pick"><input type="file" accept="image/*" capture="environment" data-proof-input class="payment-proof-file">${t('Take photo')}</label><label class="staff-link payment-proof-pick"><input type="file" accept="image/jpeg,image/png,image/webp" data-proof-input class="payment-proof-file">${t('Upload image')}</label></div>`}<p class="staff-alert bad" data-proof-error aria-live="assertive" hidden></p></div>`;
}
const load=file=>new Promise((resolve,reject)=>{const url=URL.createObjectURL(file),img=new Image();img.onload=()=>{URL.revokeObjectURL(url);resolve(img);};img.onerror=()=>{URL.revokeObjectURL(url);reject(Error('INVALID_PROOF'));};img.src=url;});
async function readProof(file){
 if(!file||!/^image\//.test(file.type))throw Error('INVALID_PROOF');
 const img=await load(file);
 for(const [side,quality] of [[1600,.82],[1280,.75],[1024,.7],[800,.65]]){
  const scale=Math.min(1,side/Math.max(img.naturalWidth,img.naturalHeight)),canvas=document.createElement('canvas');
  canvas.width=Math.max(1,Math.round(img.naturalWidth*scale));canvas.height=Math.max(1,Math.round(img.naturalHeight*scale));
  const g=canvas.getContext('2d');g.fillStyle='#fff';g.fillRect(0,0,canvas.width,canvas.height);g.drawImage(img,0,0,canvas.width,canvas.height);
  const url=canvas.toDataURL('image/jpeg',quality);
  if((url.length-23)*3/4<=MAX_BYTES)return url;
 }
 throw Error('PROOF_TOO_LARGE');
}
// Calls onChange(dataUrl|null) after a photo is chosen or removed.
export function bindProof(scope,onChange,t){
 const box=scope.querySelector('[data-proof]');if(!box)return;
 box.querySelectorAll('[data-proof-input]').forEach(input=>input.onchange=async()=>{
  const error=box.querySelector('[data-proof-error]');error.hidden=true;
  try{onChange(await readProof(input.files?.[0]));}catch(problem){error.textContent=t(problem.message==='PROOF_TOO_LARGE'?'PROOF_TOO_LARGE':'INVALID_PROOF');error.hidden=false;input.value='';}
 });
 box.querySelector('[data-proof-remove]')?.addEventListener('click',()=>onChange(null));
}
