import {createServer} from 'node:http';
import {createHash,generateKeyPairSync,randomUUID,sign} from 'node:crypto';

// D68/D70 tests: a loopback stand-in for Google's OpenID endpoints with its own RSA key. Point the API at it
// with SAFEER_GOOGLE_TEST_BASE (ignored on hosted origins), client ID test-client.apps and secret test-secret-value.
const b64=v=>Buffer.from(typeof v==='string'?v:JSON.stringify(v)).toString('base64url');
export async function fakeGoogle(){
 const {privateKey,publicKey}=generateKeyPairSync('rsa',{modulusLength:2048}),kid='test-key';
 const codes=new Map(),state={claims:{}};
 const server=createServer(async(req,res)=>{
  const url=new URL(req.url,'http://x');
  if(url.pathname==='/certs'){res.setHeader('Content-Type','application/json');return res.end(JSON.stringify({keys:[{...publicKey.export({format:'jwk'}),kid,alg:'RS256',use:'sig'}]}));}
  if(url.pathname==='/token'){
   let raw='';for await(const c of req)raw+=c;const form=new URLSearchParams(raw),entry=codes.get(form.get('code'));codes.delete(form.get('code'));
   if(!entry||createHash('sha256').update(form.get('code_verifier')||'').digest('base64url')!==entry.challenge||form.get('client_secret')!=='test-secret-value'){res.statusCode=400;return res.end('{}');}
   const now=Math.floor(Date.now()/1000),claims={iss:base,aud:'test-client.apps',sub:'g-123',email:'Amna@Example.com',email_verified:true,name:'Fictional Amna',iat:now,exp:now+600,nonce:entry.nonce,...entry.claims};
   const head=b64({alg:'RS256',kid,typ:'JWT'})+'.'+b64(claims);
   res.setHeader('Content-Type','application/json');return res.end(JSON.stringify({id_token:head+'.'+sign('RSA-SHA256',Buffer.from(head),privateKey).toString('base64url')}));
  }
  res.statusCode=404;res.end();
 });
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const base=`http://127.0.0.1:${server.address().port}`;
 // Plays the user's consent: turns the auth URL into a code bound to its PKCE challenge, nonce and the claims set now.
 const consent=auth=>{const u=new URL(auth),code=randomUUID();codes.set(code,{challenge:u.searchParams.get('code_challenge'),nonce:u.searchParams.get('nonce'),claims:{...state.claims}});return {code,state:u.searchParams.get('state')};};
 return {base,consent,state,close:()=>new Promise(r=>server.close(r))};
}
// Signs a passenger in straight against the API (not through a browser) and returns the session cookie value.
export async function googleSession(apiOrigin,g,back='/marketplace?view=profile'){
 const go=(path,headers={})=>fetch(apiOrigin+'/api/v1/passenger/'+path,{redirect:'manual',headers});
 const start=await go('google/start?return='+encodeURIComponent(back));if(start.status!==302)throw Error('Google start failed: '+start.status);
 const {code,state}=g.consent(start.headers.get('location')),stateCookie=start.headers.getSetCookie().find(c=>c.startsWith('safeer_google='))?.split(';')[0]||'';
 const done=await go(`google/callback?code=${code}&state=${state}`,{Cookie:stateCookie,'Sec-Fetch-Site':'cross-site'});
 const session=done.headers.getSetCookie().find(c=>c.startsWith('safeer_passenger='))?.split(';')[0].slice('safeer_passenger='.length);
 if(!session)throw Error('Google sign-in did not open a session: '+done.headers.get('location'));
 return session;
}
