import 'reflect-metadata';
import {Controller,Get,Post,Patch,Put,Delete,Body,Param,Query,Req,Res,Module,Catch,ExceptionFilter,ArgumentsHost,HttpException} from '@nestjs/common';
import {NestFactory} from '@nestjs/core';
import {json} from 'express';
import type {Request,Response} from 'express';
import {readFileSync} from 'node:fs';
import {IdentityService} from './identity.service.js';
import {Database} from './database.js';
import {IdentityError,sessionToken,validCsrf,fail} from './security.js';

const version=JSON.parse(readFileSync(new URL('../../package.json',import.meta.url),'utf8')).version;
const cookie=(token:string)=>`safeer_session=${token}; Path=/api/v1; HttpOnly; SameSite=Strict; Max-Age=43200`;
const clearCookie='safeer_session=; Path=/api/v1; HttpOnly; SameSite=Strict; Max-Age=0';
const token=(request:Request)=>sessionToken(request.headers.cookie);
const reply=(data:unknown)=>({data});
@Catch()
class Errors implements ExceptionFilter {
  catch(error:unknown,host:ArgumentsHost){
    const res=host.switchToHttp().getResponse<Response>();
    if(error instanceof IdentityError){if(error.getStatus()===429)res.setHeader('Retry-After','60');res.status(error.getStatus()).json(error.getResponse());return;}
    const code=(error as {code?:string})?.code;
    const type=(error as {type?:string})?.type;
    if(type==='entity.parse.failed'||type==='entity.too.large'){res.status(type==='entity.too.large'?413:400).json({error:{code:'INVALID_REQUEST',message:'Send a valid JSON request within 8 KiB.'}});return;}
    if(code==='23505'){res.status(409).json({error:{code:'DUPLICATE_LOGIN',message:'That login is already in use.'}});return;}
    if(error instanceof HttpException){res.status(error.getStatus()).json({error:{code:'INVALID_REQUEST',message:'The request is not valid.'}});return;}
    res.status(500).json({error:{code:'INTERNAL_ERROR',message:'The request could not be completed.'}});
  }
}
@Controller('api/v1')
class IdentityController {
  constructor(private readonly identity:IdentityService,private readonly db:Database){}
  @Get('health') async health(){await this.db.pool.query('SELECT 1');return reply({service:'safeer',version,mode:'local-identity',database:'connected'});}
  @Post('auth/login') async login(@Body() data:unknown,@Req() req:Request,@Res({passthrough:true}) res:Response){
    const {token:session,...result}=await this.identity.login(data,req.socket.remoteAddress||'local');res.setHeader('Set-Cookie',cookie(session));return reply(result);
  }
  @Get('auth/me') async me(@Req() req:Request){return reply(await this.identity.session(token(req)));}
  @Post('auth/logout') async logout(@Req() req:Request,@Res({passthrough:true}) res:Response){const data=await this.identity.logout(token(req));res.setHeader('Set-Cookie',clearCookie);return reply(data);}
  @Post('auth/password') async password(@Body() data:unknown,@Req() req:Request,@Res({passthrough:true}) res:Response){const {token:session,...result}=await this.identity.changePassword(token(req),data);res.setHeader('Set-Cookie',cookie(session));return reply(result);}
  @Get('auth/sessions') async sessions(@Req() req:Request){return reply(await this.identity.sessions(token(req)));}
  @Delete('auth/sessions/:id') async revoke(@Param('id') id:string,@Req() req:Request,@Res({passthrough:true}) res:Response){const data=await this.identity.revokeSession(token(req),id);if(data.current)res.setHeader('Set-Cookie',clearCookie);return reply(data);}
  @Get('identity/users') async users(@Query('after') after:string|undefined,@Req() req:Request){return reply(await this.identity.users(token(req),after));}
  @Post('identity/users') async createUser(@Body() data:unknown,@Req() req:Request){return reply(await this.identity.createUser(token(req),data));}
  @Patch('identity/users/:id') async updateUser(@Param('id') id:string,@Body() data:unknown,@Req() req:Request){return reply(await this.identity.updateUser(token(req),id,data));}
  @Post('identity/users/:id/password') async reset(@Param('id') id:string,@Body() data:unknown,@Req() req:Request){return reply(await this.identity.resetPassword(token(req),id,data));}
  @Put('identity/users/:id/roles') async assign(@Param('id') id:string,@Body() data:unknown,@Req() req:Request){return reply(await this.identity.assignRoles(token(req),id,data));}
  @Get('identity/roles') async roles(@Req() req:Request){return reply(await this.identity.roles(token(req)));}
  @Post('identity/roles') async createRole(@Body() data:unknown,@Req() req:Request){return reply(await this.identity.saveRole(token(req),undefined,data));}
  @Patch('identity/roles/:id') async updateRole(@Param('id') id:string,@Body() data:unknown,@Req() req:Request){return reply(await this.identity.saveRole(token(req),id,data));}
  @Get('identity/permissions') async permissions(@Req() req:Request){return reply(await this.identity.permissions(token(req)));}
  @Get('identity/audit') async audit(@Req() req:Request){return reply(await this.identity.auditLog(token(req)));}
}
@Module({controllers:[IdentityController],providers:[Database,IdentityService]})
export class IdentityModule {}

export async function createIdentityApi({port=4321,webOrigin='http://127.0.0.1:4320'}:{port?:number;webOrigin?:string}={}){
  const origin=new URL(webOrigin);
  if(origin.protocol!=='http:'||origin.hostname!=='127.0.0.1'||origin.username||origin.password||origin.pathname!=='/'||origin.search||origin.hash||!Number.isInteger(port)||port<0||port>65535)throw Error('Use a loopback web origin and valid identity port.');
  const app=await NestFactory.create(IdentityModule,{logger:false,bodyParser:false,abortOnError:false});
  app.useGlobalFilters(new Errors());
  app.use((req:Request,res:Response,next:()=>void)=>{
    res.setHeader('Cache-Control','no-store');res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Referrer-Policy','no-referrer');
    res.setHeader('Content-Security-Policy',"default-src 'none'; frame-ancestors 'none'");
    const address=app.getHttpServer().address();
    if(req.headers.host!==`127.0.0.1:${address?.port}`||req.headers.authorization||req.headers['sec-fetch-site']==='cross-site')return res.status(403).json({error:{code:'FORBIDDEN',message:'Request not permitted.'}});
    if(!['GET','POST','PATCH','PUT','DELETE'].includes(req.method))return res.status(405).json({error:{code:'METHOD_NOT_ALLOWED',message:'Method not permitted.'}});
    if(req.method!=='GET'){
      if(req.headers.origin!==origin.origin)return res.status(403).json({error:{code:'INVALID_ORIGIN',message:'Use the local Safeer staff page.'}});
      if(req.path!=='/api/v1/auth/login'){
        let session:string;try{session=token(req);}catch{return res.status(401).json({error:{code:'UNAUTHENTICATED',message:'Sign in to continue.'}});}
        if(!validCsrf(session,req.headers['x-csrf-token']))return res.status(403).json({error:{code:'CSRF_REJECTED',message:'Refresh the staff page and try again.'}});
      }
      if(req.method!=='DELETE'&&!req.is('application/json'))return res.status(415).json({error:{code:'JSON_REQUIRED',message:'Send a JSON request.'}});
    }
    next();
  });
  app.use(json({limit:'8kb',strict:true}));
  try{await app.listen(port,'127.0.0.1');}catch(error){await app.close();throw error;}
  const address=app.getHttpServer().address();
  return {app,origin:`http://127.0.0.1:${address.port}`,identity:app.get(IdentityService),db:app.get(Database),close:()=>app.close()};
}
