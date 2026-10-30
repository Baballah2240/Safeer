import {HttpException} from '@nestjs/common';
import {createHash,createHmac,randomBytes,scrypt as derive,timingSafeEqual} from 'node:crypto';

export class IdentityError extends HttpException {
  constructor(public code: string, status: number, message: string) { super({error:{code,message}},status); }
}
export function fail(code: string,status=400,message='Check the entered information.'): never { throw new IdentityError(code,status,message); }
export function body(value: unknown,keys: string[]): Record<string,unknown> {
  if(!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).some(k=>!keys.includes(k)))fail('INVALID_INPUT');
  return value as Record<string,unknown>;
}
export function text(value: unknown,min=1,max=100): string {
  if(typeof value!=='string'||value.trim().length<min||value.trim().length>max||/[\u0000-\u001f\u007f]/.test(value))fail('INVALID_INPUT');
  return value.trim();
}
export function login(value: unknown): string {
  const result=text(value,3,254).toLowerCase();
  if(!/^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?$/.test(result))fail('INVALID_INPUT');
  return result;
}
export function password(value: unknown,newPassword=false): string {
  if(typeof value!=='string'||value.length<(newPassword?14:1)||value.length>128||Buffer.byteLength(value)>512||value.includes('\0'))fail('INVALID_PASSWORD',400,'Use a password of 14 to 128 characters.');
  return value;
}
export function uuid(value: unknown): string {
  if(typeof value!=='string'||!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value))fail('INVALID_INPUT');
  return value;
}
export function version(value: unknown): number {
  if(!Number.isSafeInteger(value)||Number(value)<1)fail('INVALID_INPUT');return Number(value);
}
export function list(value: unknown,validate: (value:unknown)=>string): string[] {
  if(!Array.isArray(value)||value.length>30)fail('INVALID_INPUT');
  const result=value.map(validate);if(new Set(result).size!==result.length)fail('INVALID_INPUT');return result;
}
export const digest=(value:string)=>createHash('sha256').update(value).digest('hex');
export const secret=()=>randomBytes(32).toString('base64url');
export const csrf=(token:string)=>createHmac('sha256',token).update('safeer-csrf-v1').digest('hex');
export function validCsrf(token:string,value:unknown): boolean {
  return typeof value==='string'&&/^[0-9a-f]{64}$/.test(value)&&timingSafeEqual(Buffer.from(csrf(token),'hex'),Buffer.from(value,'hex'));
}
export function sessionToken(cookie: unknown): string {
  if(typeof cookie!=='string')fail('UNAUTHENTICATED',401,'Sign in to continue.');
  const parts=cookie.split(';').map(part=>part.trim()).filter(part=>part.startsWith('safeer_session='));
  const token=parts[0]?.slice('safeer_session='.length);
  if(parts.length!==1||!token||!/^[A-Za-z0-9_-]{43}$/.test(token))fail('UNAUTHENTICATED',401,'Sign in to continue.');return token;
}
let activeHashes=0;
async function scrypt(value:string,salt:Buffer): Promise<Buffer> {
  if(activeHashes>=2)fail('BUSY',429,'Please wait and try again.');
  activeHashes++;
  try{return await new Promise((resolve,reject)=>derive(value,salt,64,{N:32768,r:8,p:3,maxmem:64*1024*1024},(error,key)=>error?reject(error):resolve(key)));}
  finally{activeHashes--;}
}
export async function hashPassword(value:string):Promise<string>{
  password(value,true);const salt=randomBytes(16);return `scrypt$32768$8$3$${salt.toString('hex')}$${(await scrypt(value,salt)).toString('hex')}`;
}
export async function verifyPassword(value:string,encoded:string):Promise<boolean>{
  password(value);const match=/^scrypt\$32768\$8\$3\$([0-9a-f]{32})\$([0-9a-f]{128})$/.exec(encoded);
  if(!match)return false;return timingSafeEqual(await scrypt(value,Buffer.from(match[1],'hex')),Buffer.from(match[2],'hex'));
}
