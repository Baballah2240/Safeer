import {Injectable} from '@nestjs/common';
import {createHash,createHmac,createPublicKey,randomBytes,timingSafeEqual,verify} from 'node:crypto';
import {Database} from './database.js';
import {mobileNumber} from './reservation.service.js';
import {body,digest,fail,secret,text,uuid,version} from './security.js';

// D68 step 2: Google sign-in by the server-side authorization-code flow (PKCE + nonce).
// No Google script runs in Safeer pages, so the page Content-Security-Policy stays 'self'.
const SESSION_DAYS=30,STATE_SECONDS=600;
const b64=(value:Buffer|string)=>Buffer.from(value).toString('base64url');
const stateKey=randomBytes(32);
// Each signed state is accepted once, so a captured callback URL and cookie cannot be replayed.
const usedStates=new Map<string,number>();
const sign=(value:string)=>createHmac('sha256',stateKey).update('safeer-google-state-v1:'+value).digest('base64url');
const returnPath=(value:unknown)=>typeof value==='string'&&/^\/(booking|marketplace(\?view=profile)?|hold\/SF-[2-9A-HJ-NP-Z]{8}|trip\/[0-9a-f-]{36})$/.test(value)?value:'/booking';
export const passengerHash=(token:string)=>digest('safeer-passenger-v1:'+token);
export function cookieValue(header:unknown,name:string){
 if(typeof header!=='string')return null;
 const parts=header.split(';').map(x=>x.trim()).filter(x=>x.startsWith(name+'='));
 return parts.length===1?parts[0].slice(name.length+1):null;
}
export const passengerToken=(header:unknown)=>{const v=cookieValue(header,'safeer_passenger');return v&&/^[A-Za-z0-9_-]{43}$/.test(v)?v:null;};

type Google={clientId:string;clientSecret:string;auth:string;token:string;jwks:string;issuers:string[]};
// Tests may point the flow at a loopback stand-in; hosted deployments always use Google.
export function googleConfig(hosted:boolean):Google|null{
 const clientId=process.env.SAFEER_GOOGLE_CLIENT_ID||'',clientSecret=process.env.SAFEER_GOOGLE_CLIENT_SECRET||'';
 if(!/^[0-9A-Za-z._-]{10,200}$/.test(clientId)||clientSecret.length<10)return null;
 const test=!hosted&&process.env.SAFEER_GOOGLE_TEST_BASE;
 if(test){if(!/^http:\/\/127\.0\.0\.1:\d+$/.test(test))return null;return {clientId,clientSecret,auth:test+'/auth',token:test+'/token',jwks:test+'/certs',issuers:[test]};}
 return {clientId,clientSecret,auth:'https://accounts.google.com/o/oauth2/v2/auth',token:'https://oauth2.googleapis.com/token',jwks:'https://www.googleapis.com/oauth2/v3/certs',issuers:['https://accounts.google.com','accounts.google.com']};
}
let keyCache:{url:string;until:number;keys:Record<string,unknown>[]}|null=null;
async function googleKeys(url:string,refresh=false){
 if(!refresh&&keyCache?.url===url&&keyCache.until>Date.now())return keyCache.keys;
 const response=await fetch(url,{signal:AbortSignal.timeout(5000)});if(!response.ok)fail('GOOGLE_UNAVAILABLE',502,'Google sign-in is not available right now.');
 const age=Number(/max-age=(\d+)/.exec(response.headers.get('cache-control')||'')?.[1]||3600);
 const keys=((await response.json()) as {keys?:Record<string,unknown>[]}).keys;if(!Array.isArray(keys))fail('GOOGLE_UNAVAILABLE',502);
 keyCache={url,until:Date.now()+Math.min(age,86400)*1000,keys};return keys;
}
// Verifies signature (RS256 against Google's published keys), issuer, audience, expiry, nonce and verified email.
export async function verifyIdToken(idToken:string,g:Google,nonce:string){
 const parts=idToken.split('.');if(parts.length!==3)fail('GOOGLE_TOKEN_INVALID',401);
 let header:{alg?:string;kid?:string},claims:Record<string,unknown>;
 try{header=JSON.parse(Buffer.from(parts[0],'base64url').toString());claims=JSON.parse(Buffer.from(parts[1],'base64url').toString());}catch{fail('GOOGLE_TOKEN_INVALID',401);}
 if(header.alg!=='RS256'||typeof header.kid!=='string')fail('GOOGLE_TOKEN_INVALID',401);
 let jwk=(await googleKeys(g.jwks)).find(k=>k.kid===header.kid);if(!jwk)jwk=(await googleKeys(g.jwks,true)).find(k=>k.kid===header.kid);
 if(!jwk)fail('GOOGLE_TOKEN_INVALID',401);
 const good=verify('RSA-SHA256',Buffer.from(parts[0]+'.'+parts[1]),createPublicKey({key:jwk as import('node:crypto').JsonWebKey,format:'jwk'}),Buffer.from(parts[2],'base64url'));
 const now=Date.now()/1000;
 if(!good||!g.issuers.includes(String(claims.iss))||claims.aud!==g.clientId||typeof claims.exp!=='number'||claims.exp<now-60||typeof claims.iat!=='number'||claims.iat>now+300||claims.nonce!==nonce)fail('GOOGLE_TOKEN_INVALID',401);
 if(claims.email_verified!==true||typeof claims.email!=='string'||typeof claims.sub!=='string'||!/^[0-9A-Za-z_-]{1,255}$/.test(claims.sub))fail('GOOGLE_EMAIL_UNVERIFIED',401);
 // D75: the Google profile photo is never displayed (D70 shows initials), so its address is not kept.
 const name=typeof claims.name==='string'&&claims.name.trim()?claims.name.trim().slice(0,100):String(claims.email).split('@')[0].slice(0,100);
 return {sub:claims.sub,email:String(claims.email).slice(0,254),name};
}

@Injectable()
export class PassengerService {
 constructor(private readonly db:Database){}
 private async call(sql:string,args:unknown[]){try{return (await this.db.pool.query(sql,args)).rows[0]?.r;}catch(error){const code=(error as {code?:string}).code;if(code==='42501')fail('UNAUTHENTICATED',401,'Sign in to continue.');if(code==='40001')fail('STALE_VERSION',409,'Your profile changed elsewhere. Refresh and try again.');if(code==='22023')fail('INVALID_INPUT');throw error;}}
 private actor(token:string|null){if(!token)fail('UNAUTHENTICATED',401,'Sign in to continue.');return passengerHash(token);}
 // Builds the Google redirect and the short-lived signed state cookie.
 start(g:Google,origin:string,back:unknown){
  const state=b64(randomBytes(24)),nonce=b64(randomBytes(24)),verifier=b64(randomBytes(32)),path=returnPath(back);
  const payload=[state,nonce,verifier,b64(path),String(Math.floor(Date.now()/1000)+STATE_SECONDS)].join('.');
  const url=new URL(g.auth);
  for(const [k,v] of Object.entries({client_id:g.clientId,redirect_uri:origin+'/api/v1/passenger/google/callback',response_type:'code',scope:'openid email profile',state,nonce,code_challenge:b64(createHash('sha256').update(verifier).digest()),code_challenge_method:'S256',prompt:'select_account'}))url.searchParams.set(k,v);
  return {url:url.href,cookie:payload+'.'+sign(payload)};
 }
 async callback(g:Google,origin:string,cookie:string|null,query:Record<string,unknown>){
  const parts=(cookie||'').split('.');if(parts.length!==6)fail('GOOGLE_STATE',400);
  const payload=parts.slice(0,5).join('.'),mac=Buffer.from(parts[5]),expected=Buffer.from(sign(payload));
  if(mac.length!==expected.length||!timingSafeEqual(mac,expected))fail('GOOGLE_STATE',400);
  const [state,nonce,verifier,path,expires]=parts;
  if(Number(expires)<Date.now()/1000||typeof query.state!=='string'||query.state!==state)fail('GOOGLE_STATE',400);
  const now=Date.now();for(const [k,until] of usedStates)if(until<now)usedStates.delete(k);
  if(usedStates.has(state)||usedStates.size>=10000)fail('GOOGLE_STATE',400);usedStates.set(state,Number(expires)*1000);
  const back=returnPath(Buffer.from(path,'base64url').toString());
  if(typeof query.code!=='string'||query.code.length>2000)fail(query.error==='access_denied'?'GOOGLE_CANCELLED':'GOOGLE_STATE',400);
  const response=await fetch(g.token,{method:'POST',signal:AbortSignal.timeout(8000),headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({code:query.code,client_id:g.clientId,client_secret:g.clientSecret,redirect_uri:origin+'/api/v1/passenger/google/callback',grant_type:'authorization_code',code_verifier:verifier})}).catch(()=>fail('GOOGLE_UNAVAILABLE',502));
  const data=await response.json().catch(()=>({})) as {id_token?:unknown};
  if(!response.ok||typeof data.id_token!=='string')fail('GOOGLE_TOKEN_INVALID',401);
  const who=await verifyIdToken(data.id_token,g,nonce),token=secret();
  await this.call('SELECT safeer.passenger_sign_in($1,$2,$3,$4,gen_random_uuid(),$5,$6) AS r',[who.sub,who.email,who.name,null,passengerHash(token),SESSION_DAYS]);
  return {token,back,days:SESSION_DAYS};
 }
 async me(token:string|null){if(!token)return null;return await this.call('SELECT safeer.passenger_me($1) AS r',[passengerHash(token)])??null;}
 async signOut(token:string|null,input:unknown){const data=body(input??{},['everywhere']);if(!token)return {signedOut:true};await this.call('SELECT safeer.passenger_sign_out($1,$2) AS r',[passengerHash(token),data.everywhere===true]);return {signedOut:true};}
 async saveProfile(token:string|null,input:unknown){
  const actor=this.actor(token),data=body(input,['displayName','mobile','travelers','version']);
  const mobile=data.mobile===''||data.mobile===null||data.mobile===undefined?null:mobileNumber(data.mobile);
  if(!Array.isArray(data.travelers)||data.travelers.length>10)fail('INVALID_INPUT');
  const travelers=data.travelers.map(value=>{const t=body(value,['fullName','mobile']);return {fullName:text(t.fullName,2,100),mobile:t.mobile===''||t.mobile===null||t.mobile===undefined?null:mobileNumber(t.mobile)};});
  return this.call('SELECT safeer.passenger_save_profile($1,$2,$3,$4,$5) AS r',[actor,version(data.version),text(data.displayName,2,100),mobile,JSON.stringify(travelers)]);
 }
 async link(token:string|null,input:unknown){
  const actor=this.actor(token),data=body(input,['reference','key']),reference=String(data.reference||'');
  if(!/^SF-[2-9A-HJ-NP-Z]{8}$/.test(reference))fail('INVALID_INPUT');
  const result=await this.call('SELECT safeer.passenger_link_booking($1,$2,$3) AS r',[actor,reference,digest('safeer-hold-v1:'+uuid(data.key))]);
  if(result==='not_found')fail('NOT_FOUND',404);if(result==='other_account')fail('BOOKING_OTHER_ACCOUNT',409,'This booking is saved to another account.');
  return {linked:true};
 }
 async unlink(token:string|null,reference:string){const actor=this.actor(token);if(!/^SF-[2-9A-HJ-NP-Z]{8}$/.test(reference))fail('INVALID_INPUT');return {unlinked:await this.call('SELECT safeer.passenger_unlink_booking($1,$2) AS r',[actor,reference])};}
 async trips(token:string|null){return this.call('SELECT safeer.passenger_trips($1) AS r',[this.actor(token)]);}
 async deleteAccount(token:string|null){return {deleted:await this.call('SELECT safeer.passenger_delete_account($1) AS r',[this.actor(token)])};}
}
