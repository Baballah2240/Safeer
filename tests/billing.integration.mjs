import {test} from 'node:test';
import assert from 'node:assert/strict';
import {randomBytes} from 'node:crypto';
import {identityFixture} from './support/identity-db.mjs';

// D82: the Super Administrator sets a plan, which issues a contract PDF to both parties' notifications; a company
// manager accepts it; each company sets its own colors and logo, which its public page shows once listed.
const ok=(r,status=201)=>{assert.equal(r.status,status,r.raw);return r.data;};
const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==','base64');
async function setup(f){
 const pw={currentPassword:f.password},cid=ok(await f.admin.request('companies','POST',{nameEn:'Fictional Billing Co',nameAr:'Fictional Billing Co',slug:'billing-co',contactEmail:'ops@billing.example',holdMinutes:30,timezone:'Africa/Khartoum',locale:'en',...pw})).id,base='companies/'+cid;
 let w=ok(await f.admin.request(base),200);const co=w.company;
 // Members can open a company only once it is approved (company_can).
 ok(await f.admin.request(base,'PATCH',{nameEn:co.nameEn,nameAr:co.nameAr,status:'approved',contactEmail:co.contactEmail,holdMinutes:co.holdMinutes,timezone:co.timezone,locale:co.locale,version:co.version,...pw}),200);
 const admin=w.roles.find(r=>r.code==='company_administrator'),agent=ok(await f.admin.request(base+'/roles','POST',{displayName:'Agent',scope:'company',permissions:['company.bookings.read'],...pw}));
 const person=async(login,roleId)=>{const made=ok(await f.admin.request(base+'/members','POST',{login,displayName:'Fictional '+login.split('@')[0],existing:false,assignments:[{roleId}],...pw}));const c=f.client(),password=randomBytes(24).toString('hex');ok(await c.signIn(login,made.temporaryPassword));ok(await c.request('auth/password','POST',{currentPassword:made.temporaryPassword,newPassword:password}));return {c,pw:{currentPassword:password}};};
 return {cid,base,pw,w,manager:await person('manager@safeer.local',admin.id),staff:await person('agent@safeer.local',agent.id)};
}

test('a plan issues a numbered contract to both notification centers, and a company manager accepts it once',async()=>identityFixture(async f=>{
 const s=await setup(f),plan={monthlyFeeMinor:'2500000',commissionBps:350,currency:'SDG',startsOn:'2026-12-01',notes:'First month free.'};
 assert.equal((await s.manager.c.request(s.base+'/billing','PUT',{...plan,...s.manager.pw})).status,403,'Only a Super Administrator sets a plan.');
 assert.equal((await f.admin.request(s.base+'/billing','PUT',{...plan,commissionBps:9000,...s.pw})).error?.code,'INVALID_COMMISSION');
 const first=ok(await f.admin.request(s.base+'/billing','PUT',{...plan,...s.pw}),200);assert.match(first.number,/^SAF-\d{4}-\d{5}$/);
 let b=ok(await s.manager.c.request(s.base+'/billing'),200);assert.equal(b.plan.monthlyFeeMinor,'2500000');assert.equal(b.contracts.length,1);assert.equal(b.canEdit,false);assert.equal(b.canAccept,true);assert.equal(ok(await f.admin.request(s.base+'/billing'),200).canAccept,false);
 assert.equal((await s.staff.c.request(s.base+'/billing')).status,403,'Staff without profile management do not see billing.');
 for(const [who,copy] of [[f.admin,'Safeer copy'],[s.manager.c,'Company copy']]){
  const inbox=ok(await who.request('notifications'),200),n=inbox.items.find(x=>x.code==='contract.issued');assert.ok(n,'Both parties receive the contract notification.');assert.equal(n.sourceId,first.id);
  const pdf=await who.request(`${s.base}/contracts/${first.id}/pdf`);assert.equal(pdf.status,200);assert.equal(pdf.headers.get('content-type'),'application/pdf');assert.match(pdf.headers.get('content-disposition'),/attachment; filename="Safeer-contract-SAF-/);
  assert.ok(pdf.raw.startsWith('%PDF-1.4'));assert.ok(pdf.raw.includes(copy));assert.ok(pdf.raw.includes('SDG 25,000.00'));assert.ok(pdf.raw.includes('3.5%'));
 }
 assert.ok(!ok(await s.staff.c.request('notifications'),200).items.some(x=>x.code.startsWith('contract.')),'Other staff do not receive contracts.');
 assert.equal((await s.staff.c.request(`${s.base}/contracts/${first.id}/pdf`)).status,404,'Other staff cannot download a contract.');
 assert.equal((await f.admin.request(`${s.base}/contracts/${first.id}/accept`,'POST',s.pw)).status,403,'The Safeer owner cannot accept for the company.');
 ok(await s.manager.c.request(`${s.base}/contracts/${first.id}/accept`,'POST',s.manager.pw));
 assert.equal((await s.manager.c.request(`${s.base}/contracts/${first.id}/accept`,'POST',s.manager.pw)).error?.code,'CONTRACT_ACCEPTED');
 assert.ok(ok(await f.admin.request('notifications'),200).items.some(x=>x.code==='contract.accepted'&&x.sourceId===first.id),'The Safeer owner is told the contract was accepted.');
 assert.ok((await f.admin.request(`${s.base}/contracts/${first.id}/pdf`)).raw.includes('Accepted in Safeer'));
 // A new plan replaces the contract; the old one stays on record and can no longer be accepted.
 b=ok(await f.admin.request(s.base+'/billing'),200);
 const second=ok(await f.admin.request(s.base+'/billing','PUT',{...plan,commissionBps:300,version:b.plan.version,...s.pw}),200);assert.notEqual(second.number,first.number);
 assert.equal((await f.admin.request(s.base+'/billing','PUT',{...plan,version:b.plan.version,...s.pw})).error?.code,'STALE_VERSION');
 b=ok(await s.manager.c.request(s.base+'/billing'),200);assert.equal(b.contracts.length,2);assert.ok(b.contracts.find(k=>k.id===first.id).supersededAt);assert.equal(b.contracts.find(k=>k.id===second.id).supersededAt,null);
}));

test('a company sets its own colors and logo; passengers see them once the company is listed',async()=>identityFixture(async f=>{
 const s=await setup(f),brand=body=>s.manager.c.request(s.base+'/branding','PUT',{...body,...s.manager.pw});
 assert.equal((await brand({primaryColor:'#f5f5a0',secondaryColor:'#123a2d'})).error?.code,'LOW_CONTRAST','White text must stay readable.');
 assert.equal((await brand({primaryColor:'#7a1f3d',logo:'data:image/png;base64,'+Buffer.from('not an image').toString('base64')})).error?.code,'INVALID_LOGO');
 assert.equal((await s.staff.c.request(s.base+'/branding','PUT',{primaryColor:'#7a1f3d',...s.staff.pw})).status,403);
 ok(await brand({primaryColor:'#7A1F3D',secondaryColor:'#22313f',logo:'data:image/png;base64,'+png.toString('base64')}),200);
 let w=ok(await s.staff.c.request(s.base),200);assert.equal(w.branding.primaryColor,'#7a1f3d');assert.ok(w.branding.logoVersion,'Every staff member sees the company brand.');
 const logo=await s.staff.c.request(s.base+'/branding/logo');assert.equal(logo.status,200);assert.equal(logo.headers.get('content-type'),'image/png');
 assert.equal((await f.client().request('public/companies/billing-co/brand')).data,null,'An unlisted company shows nothing publicly.');
 assert.equal((await f.client().request('public/companies/billing-co/logo')).status,404);
 const profile=ok(await s.manager.c.request(s.base+'/public-profile'),200);ok(await s.manager.c.request(s.base+'/public-profile','PUT',{listed:true,aboutEn:'',aboutAr:'',version:profile.version,...s.manager.pw}),200);
 const pub=ok(await f.client().request('public/companies/billing-co/brand'),200);assert.deepEqual(pub,{primaryColor:'#7a1f3d',secondaryColor:'#22313f',logoVersion:w.branding.logoVersion});
 const image=await f.client().request('public/companies/billing-co/logo');assert.equal(image.status,200);assert.equal(image.headers.get('content-type'),'image/png');
 // Keeping the logo while changing colors, then removing it.
 w=ok(await s.manager.c.request(s.base),200);ok(await brand({primaryColor:'#123a2d',secondaryColor:null,version:w.branding.version}),200);
 w=ok(await s.manager.c.request(s.base),200);assert.ok(w.branding.logoVersion,'The logo stays when only colors change.');assert.equal(w.branding.secondaryColor,null);
 ok(await brand({removeLogo:true,version:w.branding.version}),200);assert.equal(ok(await s.manager.c.request(s.base),200).branding.logoVersion,null);
}));
