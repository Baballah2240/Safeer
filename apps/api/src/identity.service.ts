import {Injectable,OnModuleInit} from '@nestjs/common';
import {randomUUID} from 'node:crypto';
import type {PoolClient} from 'pg';
import {Database} from './database.js';
import {body,text,login,password,uuid,version,list,digest,secret,csrf,fail,hashPassword,verifyPassword} from './security.js';

const OWNER='platform_super_administrator';
type UserRow={id:string;normalized_login:string;display_name:string;password_hash:string;active:boolean;must_change_password:boolean;credential_version:number;version:number;created_at:Date};
type Principal={id:string;login:string;displayName:string;mustChangePassword:boolean;version:number;sessionId:string;roles:{id:string;code:string;displayName:string;scope:string}[];permissions:string[];superAdministrator:boolean};
const userView=(u:UserRow)=>({id:u.id,login:u.normalized_login,displayName:u.display_name,active:u.active,mustChangePassword:u.must_change_password,version:u.version,createdAt:u.created_at});

@Injectable()
export class IdentityService implements OnModuleInit {
  private dummyHash='';
  constructor(private readonly db:Database){}
  async onModuleInit(){await this.db.ready();this.dummyHash=await hashPassword(secret());}
  private async audit(c:PoolClient,actor:string|null,action:string,target:string|null){
    await c.query('INSERT INTO safeer.identity_audit(id,actor_id,action,target_id) VALUES($1,$2,$3,$4)',[randomUUID(),actor,action,target]);
  }
  private async principal(c:PoolClient,token:string,permission?:string,allowChange=false):Promise<Principal>{
    const result=await c.query<UserRow & {session_id:string}>(`SELECT u.*,s.id AS session_id FROM safeer.sessions s JOIN safeer.users u ON u.id=s.user_id
      WHERE s.token_hash=$1 AND s.revoked_at IS NULL AND s.expires_at>clock_timestamp()
      AND s.last_seen_at>clock_timestamp()-interval '30 minutes' AND s.credential_version=u.credential_version AND u.active`,[digest(token)]);
    const u=result.rows[0];if(!u)fail('UNAUTHENTICATED',401,'Sign in to continue.');
    if(u.must_change_password&&!allowChange)fail('PASSWORD_CHANGE_REQUIRED',403,'Change your temporary password first.');
    const roles=(await c.query(`SELECT r.id,r.code,r.display_name AS "displayName",r.scope FROM safeer.platform_user_roles a JOIN safeer.roles r ON r.id=a.role_id WHERE a.user_id=$1 AND r.active ORDER BY r.code`,[u.id])).rows;
    const superAdministrator=roles.some(r=>r.code===OWNER);
    const permissions=superAdministrator
      ?(await c.query('SELECT code FROM safeer.permissions ORDER BY code')).rows.map(r=>r.code as string)
      :(await c.query(`SELECT DISTINCT p.permission_code FROM safeer.platform_user_roles a JOIN safeer.roles r ON r.id=a.role_id JOIN safeer.role_permissions p ON p.role_id=r.id WHERE a.user_id=$1 AND r.active ORDER BY p.permission_code`,[u.id])).rows.map(r=>r.permission_code as string);
    if(permission&&!permissions.includes(permission))fail('FORBIDDEN',403,'Your account does not have this permission.');
    await c.query('UPDATE safeer.sessions SET last_seen_at=clock_timestamp() WHERE id=$1',[u.session_id]);
    return {id:u.id,login:u.normalized_login,displayName:u.display_name,mustChangePassword:u.must_change_password,version:u.version,sessionId:u.session_id,roles,permissions,superAdministrator};
  }
  async session(token:string){return this.db.transaction(async c=>({...(await this.principal(c,token,undefined,true)),csrfToken:csrf(token)}),false);}
  private async checkPassword(id:string,value:unknown,encoded:string){
    const pass=password(value),key=digest('reauth:'+id);
    await this.db.transaction(async c=>{
      await c.query('DELETE FROM safeer.auth_throttles WHERE key_hash=$1 AND resets_at<=clock_timestamp()',[key]);
      const workload=digest('password-work:'+id);
      await c.query('DELETE FROM safeer.auth_throttles WHERE key_hash=$1 AND resets_at<=clock_timestamp()',[workload]);
      const work=await c.query(`INSERT INTO safeer.auth_throttles(key_hash,attempts,resets_at) VALUES($1,1,clock_timestamp()+interval '15 minutes') ON CONFLICT(key_hash) DO UPDATE SET attempts=safeer.auth_throttles.attempts+1 RETURNING attempts`,[workload]);
      if(work.rows[0].attempts>120)fail('RATE_LIMITED',429,'Too many attempts. Try again later.');
      const result=await c.query(`INSERT INTO safeer.auth_throttles(key_hash,attempts,resets_at) VALUES($1,1,clock_timestamp()+interval '15 minutes') ON CONFLICT(key_hash) DO UPDATE SET attempts=safeer.auth_throttles.attempts+1 RETURNING attempts`,[key]);
      if(result.rows[0].attempts>8)fail('RATE_LIMITED',429,'Too many attempts. Try again later.');
    });
    if(!await verifyPassword(pass,encoded))fail('REAUTHENTICATION_FAILED',403,'Your current password was not accepted.');
    await this.db.transaction(async c=>{await c.query('DELETE FROM safeer.auth_throttles WHERE key_hash=$1',[key]);});
  }
  private async reauthenticate(token:string,value:unknown){
    const p=await this.session(token);if(p.mustChangePassword)fail('PASSWORD_CHANGE_REQUIRED',403);
    const {rows}=await this.db.pool.query<UserRow>('SELECT * FROM safeer.users WHERE id=$1',[p.id]);
    if(!rows[0])fail('UNAUTHENTICATED',401);await this.checkPassword(p.id,value,rows[0].password_hash);
  }
  private async issue(c:PoolClient,u:UserRow){
    const token=secret();
    await c.query(`INSERT INTO safeer.sessions(id,user_id,token_hash,credential_version,expires_at) VALUES($1,$2,$3,$4,clock_timestamp()+interval '12 hours')`,[randomUUID(),u.id,digest(token),u.credential_version]);
    return {token,user:userView(u),csrfToken:csrf(token)};
  }
  async login(input:unknown,ip:string){
    const data=body(input,['login','password']),email=login(data.login),pass=password(data.password);
    await this.db.transaction(async c=>{
      await c.query('DELETE FROM safeer.auth_throttles WHERE resets_at<=clock_timestamp()');
      for(const [key,max] of [[`login:${email}`,8],[`ip:${ip}`,120]] as const){
        const {rows}=await c.query(`INSERT INTO safeer.auth_throttles(key_hash,attempts,resets_at) VALUES($1,1,clock_timestamp()+interval '15 minutes') ON CONFLICT(key_hash) DO UPDATE SET attempts=safeer.auth_throttles.attempts+1 RETURNING attempts`,[digest(key)]);
        if(rows[0].attempts>max)fail('RATE_LIMITED',429,'Too many attempts. Try again later.');
      }
    });
    const candidate=(await this.db.pool.query<UserRow>('SELECT * FROM safeer.users WHERE normalized_login=$1',[email])).rows[0];
    const valid=await verifyPassword(pass,candidate?.password_hash||this.dummyHash);
    if(!candidate||!valid||!candidate.active){
      await this.db.transaction(c=>this.audit(c,null,'login.failed',null));
      fail('INVALID_CREDENTIALS',401,'The email or password was not accepted.');
    }
    return this.db.transaction(async c=>{
      const u=(await c.query<UserRow>('SELECT * FROM safeer.users WHERE id=$1',[candidate.id])).rows[0];
      if(!u.active||u.password_hash!==candidate.password_hash)fail('INVALID_CREDENTIALS',401,'The email or password was not accepted.');
      await c.query('DELETE FROM safeer.auth_throttles WHERE key_hash=$1',[digest(`login:${email}`)]);
      await c.query(`UPDATE safeer.sessions SET revoked_at=clock_timestamp() WHERE user_id=$1 AND revoked_at IS NULL AND (expires_at<=clock_timestamp() OR last_seen_at<=clock_timestamp()-interval '30 minutes')`,[u.id]);
      const count=(await c.query("SELECT count(*)::int AS n FROM safeer.sessions WHERE user_id=$1 AND revoked_at IS NULL",[u.id])).rows[0].n;
      if(count>=10)fail('SESSION_LIMIT',409,'Close an existing session before opening another.');
      const result=await this.issue(c,u);await this.audit(c,u.id,'login.succeeded',u.id);return result;
    });
  }
  async logout(token:string){
    await this.db.transaction(async c=>{
      const p=await this.principal(c,token,undefined,true);
      await c.query('UPDATE safeer.sessions SET revoked_at=clock_timestamp() WHERE id=$1',[p.sessionId]);
      await this.audit(c,p.id,'session.signed_out',p.sessionId);
    });return {signedOut:true};
  }
  async sessions(token:string){return this.db.transaction(async c=>{
    const p=await this.principal(c,token);
    return {items:(await c.query(`SELECT id,created_at AS "createdAt",last_seen_at AS "lastSeenAt",expires_at AS "expiresAt",id=$2 AS current FROM safeer.sessions WHERE user_id=$1 AND revoked_at IS NULL AND expires_at>clock_timestamp() AND last_seen_at>clock_timestamp()-interval '30 minutes' ORDER BY created_at DESC LIMIT 10`,[p.id,p.sessionId])).rows};
  },false);}
  async revokeSession(token:string,id:string){uuid(id);return this.db.transaction(async c=>{
    const p=await this.principal(c,token);
    const result=await c.query('UPDATE safeer.sessions SET revoked_at=clock_timestamp() WHERE id=$1 AND user_id=$2 AND revoked_at IS NULL RETURNING id',[id,p.id]);
    if(!result.rowCount)fail('NOT_FOUND',404);await this.audit(c,p.id,'session.revoked',id);return {revoked:true,current:id===p.sessionId};
  });}
  async changePassword(token:string,input:unknown){
    const data=body(input,['currentPassword','newPassword']);const old=password(data.currentPassword),next=password(data.newPassword,true);
    if(old===next)fail('PASSWORD_UNCHANGED',400,'Choose a different password.');
    const current=await this.session(token),u=(await this.db.pool.query<UserRow>('SELECT * FROM safeer.users WHERE id=$1',[current.id])).rows[0];
    await this.checkPassword(current.id,old,u.password_hash);
    const encoded=await hashPassword(next);
    return this.db.transaction(async c=>{
      const p=await this.principal(c,token,undefined,true);
      const result=await c.query<UserRow>(`UPDATE safeer.users SET password_hash=$1,must_change_password=false,credential_version=credential_version+1,version=version+1,updated_at=clock_timestamp() WHERE id=$2 AND password_hash=$3 RETURNING *`,[encoded,p.id,u.password_hash]);
      if(!result.rows[0])fail('STALE_VERSION',409,'This record changed. Refresh and try again.');
      await c.query('UPDATE safeer.sessions SET revoked_at=clock_timestamp() WHERE user_id=$1 AND revoked_at IS NULL',[p.id]);
      const resultSession=await this.issue(c,result.rows[0]);await this.audit(c,p.id,'password.changed',p.id);return resultSession;
    });
  }
  async users(token:string,after?:string){if(after)uuid(after);return this.db.transaction(async c=>{
    await this.principal(c,token,'identity.users.read');
    const rows=(await c.query<UserRow>('SELECT * FROM safeer.users WHERE ($1::uuid IS NULL OR id>$1) ORDER BY id LIMIT 51',[after||null])).rows;
    const items=[];
    for(const row of rows.slice(0,50))items.push({...userView(row),roleIds:(await c.query('SELECT role_id FROM safeer.platform_user_roles WHERE user_id=$1 ORDER BY role_id',[row.id])).rows.map(r=>r.role_id)});
    return {items,nextCursor:rows.length>50?rows[49].id:null};
  },false);}
  async createUser(token:string,input:unknown){
    const data=body(input,['login','displayName','currentPassword']),email=login(data.login),name=text(data.displayName);
    await this.reauthenticate(token,data.currentPassword);const temporaryPassword=secret().slice(0,24),encoded=await hashPassword(temporaryPassword);
    return this.db.transaction(async c=>{
      const p=await this.principal(c,token,'identity.users.manage'),id=randomUUID();
      const result=await c.query<UserRow>('INSERT INTO safeer.users(id,normalized_login,display_name,password_hash) VALUES($1,$2,$3,$4) RETURNING *',[id,email,name,encoded]);
      await this.audit(c,p.id,'user.created',id);return {user:userView(result.rows[0]),temporaryPassword};
    });
  }
  private async protectOwner(c:PoolClient,p:Principal,id:string){
    const owner=(await c.query(`SELECT 1 FROM safeer.platform_user_roles a JOIN safeer.roles r ON r.id=a.role_id WHERE a.user_id=$1 AND r.code=$2`,[id,OWNER])).rowCount;
    if(owner&&!p.superAdministrator)fail('PROTECTED_OWNER',403,'Only a super administrator can change this account.');
  }
  private async lastOwner(c:PoolClient){
    const result=await c.query(`SELECT count(DISTINCT u.id)::int AS n FROM safeer.users u JOIN safeer.platform_user_roles a ON a.user_id=u.id JOIN safeer.roles r ON r.id=a.role_id WHERE u.active AND r.active AND r.code=$1`,[OWNER]);
    if(result.rows[0].n<1)fail('LAST_OWNER',409,'Keep at least one active super administrator.');
  }
  async updateUser(token:string,id:string,input:unknown){
    uuid(id);const data=body(input,['displayName','active','version','currentPassword']),name=text(data.displayName),v=version(data.version);
    if(typeof data.active!=='boolean')fail('INVALID_INPUT');await this.reauthenticate(token,data.currentPassword);
    return this.db.transaction(async c=>{
      const p=await this.principal(c,token,'identity.users.manage');await this.protectOwner(c,p,id);
      const result=await c.query<UserRow>(`UPDATE safeer.users SET display_name=$1,active=$2,version=version+1,updated_at=clock_timestamp() WHERE id=$3 AND version=$4 RETURNING *`,[name,data.active,id,v]);
      if(!result.rows[0])fail('STALE_VERSION',409,'This record changed. Refresh and try again.');
      await this.lastOwner(c);
      if(!data.active)await c.query('UPDATE safeer.sessions SET revoked_at=clock_timestamp() WHERE user_id=$1 AND revoked_at IS NULL',[id]);
      await this.audit(c,p.id,data.active?'user.updated':'user.disabled',id);return {user:userView(result.rows[0])};
    });
  }
  async resetPassword(token:string,id:string,input:unknown){
    uuid(id);const data=body(input,['version','currentPassword']),v=version(data.version);await this.reauthenticate(token,data.currentPassword);
    const temporaryPassword=secret().slice(0,24),encoded=await hashPassword(temporaryPassword);
    return this.db.transaction(async c=>{
      const p=await this.principal(c,token,'identity.users.manage');if(p.id===id)fail('USE_PASSWORD_CHANGE',400,'Use your own password change form.');await this.protectOwner(c,p,id);
      const result=await c.query<UserRow>(`UPDATE safeer.users SET password_hash=$1,must_change_password=true,credential_version=credential_version+1,version=version+1,updated_at=clock_timestamp() WHERE id=$2 AND version=$3 RETURNING *`,[encoded,id,v]);
      if(!result.rows[0])fail('STALE_VERSION',409,'This record changed. Refresh and try again.');
      await c.query('UPDATE safeer.sessions SET revoked_at=clock_timestamp() WHERE user_id=$1 AND revoked_at IS NULL',[id]);await this.audit(c,p.id,'password.reset',id);
      return {user:userView(result.rows[0]),temporaryPassword};
    });
  }
  async assignRoles(token:string,id:string,input:unknown){
    uuid(id);const data=body(input,['roleIds','version','currentPassword']),ids=list(data.roleIds,uuid),v=version(data.version);await this.reauthenticate(token,data.currentPassword);
    return this.db.transaction(async c=>{
      const p=await this.principal(c,token,'identity.platform_roles.assign');await this.protectOwner(c,p,id);
      const roles=(await c.query('SELECT * FROM safeer.roles WHERE id=ANY($1::uuid[])',[ids])).rows;
      if(roles.length!==ids.length||roles.some(r=>r.scope!=='platform'||!r.active))fail('INVALID_ROLE_SCOPE',400,'Only active platform roles can be assigned in Section 02.');
      if(roles.some(r=>r.code===OWNER)&&!p.superAdministrator)fail('PROTECTED_OWNER',403);
      if(!p.superAdministrator){const codes=(await c.query('SELECT DISTINCT permission_code FROM safeer.role_permissions WHERE role_id=ANY($1::uuid[])',[ids])).rows.map(r=>r.permission_code);if(codes.some(code=>!p.permissions.includes(code)))fail('PRIVILEGE_ESCALATION',403);}
      const result=await c.query<UserRow>('UPDATE safeer.users SET version=version+1,updated_at=clock_timestamp() WHERE id=$1 AND version=$2 RETURNING *',[id,v]);
      if(!result.rows[0])fail('STALE_VERSION',409,'This record changed. Refresh and try again.');
      await c.query('DELETE FROM safeer.platform_user_roles WHERE user_id=$1',[id]);
      for(const role of roles)await c.query('INSERT INTO safeer.platform_user_roles(user_id,role_id,assigned_by) VALUES($1,$2,$3)',[id,role.id,p.id]);
      await this.lastOwner(c);await this.audit(c,p.id,'user.roles_changed',id);return {user:userView(result.rows[0])};
    });
  }
  async roles(token:string){return this.db.transaction(async c=>{
    await this.principal(c,token,'identity.roles.read');
    const items=(await c.query(`SELECT r.id,r.code,r.display_name AS "displayName",r.scope,r.builtin,r.active,r.version,COALESCE(array_agg(p.permission_code ORDER BY p.permission_code) FILTER(WHERE p.permission_code IS NOT NULL),'{}') AS permissions FROM safeer.roles r LEFT JOIN safeer.role_permissions p ON p.role_id=r.id GROUP BY r.id ORDER BY r.builtin DESC,r.code LIMIT 200`)).rows;
    return {items};
  },false);}
  async permissions(token:string){return this.db.transaction(async c=>{await this.principal(c,token,'identity.roles.read');return {items:(await c.query('SELECT code,module FROM safeer.permissions ORDER BY code')).rows};},false);}
  async saveRole(token:string,id:string|undefined,input:unknown){
    if(id)uuid(id);const data=body(input,id?['displayName','permissions','active','version','currentPassword']:['displayName','permissions','currentPassword']);
    const name=text(data.displayName),permissions=list(data.permissions,x=>text(x,1,80)),v=id?version(data.version):1;
    if(id&&typeof data.active!=='boolean')fail('INVALID_INPUT');await this.reauthenticate(token,data.currentPassword);
    return this.db.transaction(async c=>{
      const p=await this.principal(c,token,'identity.roles.manage');
      if(permissions.some(code=>!p.permissions.includes(code)))fail('PRIVILEGE_ESCALATION',403);
      const valid=(await c.query('SELECT code FROM safeer.permissions WHERE code=ANY($1::text[])',[permissions])).rows;
      if(valid.length!==permissions.length)fail('INVALID_PERMISSION');
      const roleId=id||randomUUID();
      if(id){
        const r=(await c.query('SELECT * FROM safeer.roles WHERE id=$1',[id])).rows[0];if(!r)fail('NOT_FOUND',404);
        if(!p.superAdministrator&&r.code===OWNER)fail('PROTECTED_OWNER',403,'Only a super administrator can edit this role.');
        if(!p.superAdministrator&&r.scope!=='platform')fail('FORBIDDEN',403,'Only a super administrator can edit company and resource templates.');
        const result=await c.query('UPDATE safeer.roles SET display_name=$1,active=$2,version=version+1 WHERE id=$3 AND version=$4 RETURNING id',[name,data.active,id,v]);
        if(!result.rowCount)fail('STALE_VERSION',409,'This record changed. Refresh and try again.');
      }else{
        if((await c.query('SELECT count(*)::int AS n FROM safeer.roles')).rows[0].n>=200)fail('ROLE_LIMIT',409);
        await c.query("INSERT INTO safeer.roles(id,code,display_name,scope) VALUES($1,$2,$3,'platform')",[roleId,'custom_'+roleId.replaceAll('-',''),name]);
      }
      await c.query('DELETE FROM safeer.role_permissions WHERE role_id=$1',[roleId]);
      for(const code of permissions)await c.query('INSERT INTO safeer.role_permissions(role_id,permission_code) VALUES($1,$2)',[roleId,code]);
      await this.lastOwner(c);
      await this.audit(c,p.id,id?'role.updated':'role.created',roleId);return {id:roleId};
    });
  }
  async auditLog(token:string){return this.db.transaction(async c=>{await this.principal(c,token,'identity.audit.read');return {items:(await c.query('SELECT id,actor_id AS "actorId",action,target_id AS "targetId",occurred_at AS "occurredAt" FROM safeer.identity_audit ORDER BY occurred_at DESC,id LIMIT 100')).rows};},false);}
  async bootstrap(email:string,name:string){
    const normalized=login(email),displayName=text(name),temporaryPassword=secret().slice(0,24),encoded=await hashPassword(temporaryPassword);
    return this.db.transaction(async c=>{
      if((await c.query('SELECT count(*)::int AS n FROM safeer.users')).rows[0].n)fail('ALREADY_INITIALIZED',409,'An account already exists. Use authorized account management or the local recovery command.');
      const id=randomUUID();await c.query('INSERT INTO safeer.users(id,normalized_login,display_name,password_hash) VALUES($1,$2,$3,$4)',[id,normalized,displayName,encoded]);
      await c.query(`INSERT INTO safeer.platform_user_roles(user_id,role_id,assigned_by) SELECT $1,id,$1 FROM safeer.roles WHERE code=$2`,[id,OWNER]);
      await this.audit(c,id,'identity.bootstrapped',id);return {login:normalized,temporaryPassword};
    });
  }
}
