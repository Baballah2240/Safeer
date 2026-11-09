import 'reflect-metadata';
import {Controller,Get,Post,Patch,Put,Delete,Body,Param,Query,Req,Res,Module,Catch,ExceptionFilter,ArgumentsHost,HttpException} from '@nestjs/common';
import {NestFactory} from '@nestjs/core';
import {json} from 'express';
import type {Request,Response} from 'express';
import {readFileSync} from 'node:fs';
import {IdentityService} from './identity.service.js';
import {Database} from './database.js';
import {CompanyService} from './company.service.js';
import {RouteService} from './route.service.js';
import {FleetService} from './fleet.service.js';
import {TripService} from './trip.service.js';
import {PublicService} from './public.service.js';
import {ReservationService} from './reservation.service.js';
import {TicketingService} from './ticketing.service.js';
import {LuggageService} from './luggage.service.js';
import {ShipmentService} from './shipment.service.js';
import {BoardingService} from './boarding.service.js';
import {FinanceService} from './finance.service.js';
import {PlatformService} from './platform.service.js';
import {IdentityError,sessionToken,validCsrf,fail} from './security.js';

const bodyLimits=JSON.parse(readFileSync(new URL('../../config/http-limits.json',import.meta.url),'utf8')) as {defaultBodyBytes:number;bookingBodyBytes:number};
const version=JSON.parse(readFileSync(new URL('../../package.json',import.meta.url),'utf8')).version;
// Hosted HTTPS deployments add Secure; loopback development cannot use it over http.
let secure='';
const cookie=(token:string)=>`safeer_session=${token}; Path=/api/v1; HttpOnly; SameSite=Strict; Max-Age=43200${secure}`;
const clearCookie=()=>`safeer_session=; Path=/api/v1; HttpOnly; SameSite=Strict; Max-Age=0${secure}`;
// The web proxy is the only caller (loopback host check) and sets this from the hosting edge.
const client=(request:Request)=>{const value=request.headers['x-safeer-client'];return typeof value==='string'&&/^[0-9a-fA-F:.]{2,45}$/.test(value)?value:request.socket.remoteAddress||'local';};
const token=(request:Request)=>sessionToken(request.headers.cookie);
const reply=(data:unknown)=>({data});
@Catch()
class Errors implements ExceptionFilter {
  catch(error:unknown,host:ArgumentsHost){
    const res=host.switchToHttp().getResponse<Response>();
    if(error instanceof IdentityError){if(error.getStatus()===429)res.setHeader('Retry-After','60');res.status(error.getStatus()).json(error.getResponse());return;}
    const code=(error as {code?:string})?.code;
    const type=(error as {type?:string})?.type;
    if(type==='entity.parse.failed'||type==='entity.too.large'){res.status(type==='entity.too.large'?413:400).json({error:{code:'INVALID_REQUEST',message:'Send valid JSON within the limit for this endpoint.'}});return;}
    if(code==='23505'){const constraint=(error as {constraint?:string}).constraint||'';const loginConflict=constraint==='users_normalized_login_key';res.status(409).json({error:{code:loginConflict?'DUPLICATE_LOGIN':'DUPLICATE_RECORD',message:loginConflict?'That login is already in use.':'This code, slug or membership is already in use.'}});return;}
    if(code==='P0001'&&['INVALID_REPORT','CONTENTS_NOT_DECLARED','INVALID_DESTINATION','INVALID_ITEMS','PRICE_MISSING','SHIPMENT_STATE','SHIPMENT_NOT_DEPARTED','SHIPMENT_EXCEPTION_OPEN','SHIPMENT_EXCEPTION_CLOSED','RECEIVER_NOT_VERIFIED','TAG_REQUIRED','EXPORT_LIMIT','TICKET_INVALID','BOARDING_CLOSED','JOURNEY_STATE','LAST_COMPANY_ADMIN','COMPANY_LIMIT','CATALOG_LIMIT','RESOURCE_IN_USE','STATION_CITY_IN_USE','INVALID_ROUTE_STOPS','INACTIVE_ROUTE_RESOURCE','LAYOUT_IN_USE','INACTIVE_LAYOUT','INVALID_SEAT_LAYOUT','IMMUTABLE_REVISION','TRIP_NOT_DRAFT','TRIP_FINISHED','LUGGAGE_HELD','LUGGAGE_STATE','LUGGAGE_NOT_DEPARTED','LUGGAGE_EXCEPTION_OPEN','TICKET_REQUIRED','TAG_UNKNOWN','TAG_REPLACED','TAG_REASON_REQUIRED','REASON_REQUIRED','COLLECTION_NOT_VERIFIED','TRIP_NOT_READY','INVALID_TRIP_STOPS','ASSIGNMENT_CONFLICT','INACTIVE_ASSIGNMENT','TRIP_RESOURCE_IN_USE','TRIP_NOT_BOOKABLE','INVALID_SEATS','SEATS_UNAVAILABLE','SEATS_HELD','IDEMPOTENCY_CONFLICT','HOLD_CLOSED','INVALID_PASSENGERS','STALE_VERSION','NO_OPEN_SESSION','SESSION_OPEN','SESSION_CLOSED','COUNTER_INACTIVE','COUNTER_BUSY','NOTE_REQUIRED','ALREADY_PAID','HOLD_ENDED','LATE_REASON_REQUIRED','METHOD_DISABLED','CURRENCY_MISMATCH','ALREADY_REFUNDED','NOT_PAID','REFUND_CLOSED','REFERENCE_REQUIRED'].includes((error as Error).message)){res.status(409).json({error:{code:(error as Error).message,message:'The change conflicts with a protected resource, route rule or local capacity.'}});return;}
    if(code==='23P01'){res.status(409).json({error:{code:'SEATS_UNAVAILABLE',message:'Those seats have just been taken.'}});return;}
    if(['55P03','57014'].includes(code||'')){res.setHeader('Retry-After','5');res.status(503).json({error:{code:'BUSY',message:'Please try again in a moment.'}});return;}
    if(['23503','23514','42501'].includes(code||'')){res.status(code==='42501'?403:400).json({error:{code:code==='42501'?'FORBIDDEN':'INVALID_RESOURCE_SCOPE',message:'The resource does not belong to an allowed company or scope.'}});return;}
    if(error instanceof HttpException){res.status(error.getStatus()).json({error:{code:'INVALID_REQUEST',message:'The request is not valid.'}});return;}
    res.status(500).json({error:{code:'INTERNAL_ERROR',message:'The request could not be completed.'}});
  }
}
@Controller('api/v1')
class IdentityController {
  constructor(private readonly identity:IdentityService,private readonly db:Database,private readonly reservations:ReservationService){}
  @Get('health') async health(){try{await this.db.pool.query('SELECT 1');}catch{fail('DATABASE_UNAVAILABLE',503,'The local database is unavailable.');}return reply({service:'safeer',version,mode:'local-identity',database:'connected',maintenance:this.reservations.maintenance()});}
  @Post('auth/login') async login(@Body() data:unknown,@Req() req:Request,@Res({passthrough:true}) res:Response){
    const {token:session,...result}=await this.identity.login(data,client(req));res.setHeader('Set-Cookie',cookie(session));return reply(result);
  }
  @Get('auth/me') async me(@Req() req:Request){return reply(await this.identity.session(token(req)));}
  @Post('auth/logout') async logout(@Req() req:Request,@Res({passthrough:true}) res:Response){const data=await this.identity.logout(token(req));res.setHeader('Set-Cookie',clearCookie());return reply(data);}
  @Post('auth/password') async password(@Body() data:unknown,@Req() req:Request,@Res({passthrough:true}) res:Response){const {token:session,...result}=await this.identity.changePassword(token(req),data);res.setHeader('Set-Cookie',cookie(session));return reply(result);}
  @Get('auth/sessions') async sessions(@Req() req:Request){return reply(await this.identity.sessions(token(req)));}
  @Delete('auth/sessions/:id') async revoke(@Param('id') id:string,@Req() req:Request,@Res({passthrough:true}) res:Response){const data=await this.identity.revokeSession(token(req),id);if(data.current)res.setHeader('Set-Cookie',clearCookie());return reply(data);}
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
@Controller('api/v1/companies')
class CompanyController {
 constructor(private readonly companies:CompanyService){}
 @Get() list(@Req() req:Request){return this.companies.companies(token(req)).then(reply);}
 @Post() create(@Req() req:Request,@Body() data:unknown){return this.companies.create(token(req),data).then(reply);}
 @Get(':id') workspace(@Req() req:Request,@Param('id') id:string){return this.companies.workspace(token(req),id).then(reply);}
 @Patch(':id') update(@Req() req:Request,@Param('id') id:string,@Body() data:unknown){return this.companies.update(token(req),id,data).then(reply);}
 @Post(':id/branches') branch(@Req() req:Request,@Param('id') id:string,@Body() data:unknown){return this.companies.resource(token(req),id,'branches',undefined,data).then(reply);}
 @Patch(':id/branches/:rid') updateBranch(@Req() req:Request,@Param('id') id:string,@Param('rid') rid:string,@Body() data:unknown){return this.companies.resource(token(req),id,'branches',rid,data).then(reply);}
 @Post(':id/stations') station(@Req() req:Request,@Param('id') id:string,@Body() data:unknown){return this.companies.resource(token(req),id,'stations',undefined,data).then(reply);}
 @Patch(':id/stations/:rid') updateStation(@Req() req:Request,@Param('id') id:string,@Param('rid') rid:string,@Body() data:unknown){return this.companies.resource(token(req),id,'stations',rid,data).then(reply);}
 @Post(':id/members') member(@Req() req:Request,@Param('id') id:string,@Body() data:unknown){return this.companies.member(token(req),id,undefined,data).then(reply);}
 @Patch(':id/members/:rid') updateMember(@Req() req:Request,@Param('id') id:string,@Param('rid') rid:string,@Body() data:unknown){return this.companies.member(token(req),id,rid,data).then(reply);}
 @Post(':id/roles') role(@Req() req:Request,@Param('id') id:string,@Body() data:unknown){return this.companies.role(token(req),id,undefined,data).then(reply);}
 @Patch(':id/roles/:rid') updateRole(@Req() req:Request,@Param('id') id:string,@Param('rid') rid:string,@Body() data:unknown){return this.companies.role(token(req),id,rid,data).then(reply);}
 @Post(':id/support') support(@Req() req:Request,@Param('id') id:string,@Body() data:unknown){return this.companies.support(token(req),id,undefined,data).then(reply);}
 @Delete(':id/support/:rid') revokeSupport(@Req() req:Request,@Param('id') id:string,@Param('rid') rid:string,@Body() data:unknown){return this.companies.support(token(req),id,rid,data).then(reply);}
}
@Controller('api/v1')
class RouteController {
 constructor(private readonly routes:RouteService){}
 @Get('cities') cities(@Req() req:Request){return this.routes.cities(token(req)).then(reply);}
 @Post('cities') city(@Req() req:Request,@Body() data:unknown){return this.routes.city(token(req),undefined,data).then(reply);}
 @Patch('cities/:id') updateCity(@Req() req:Request,@Param('id') id:string,@Body() data:unknown){return this.routes.city(token(req),id,data).then(reply);}
 @Get('companies/:id/routes') list(@Req() req:Request,@Param('id') id:string){return this.routes.routes(token(req),id).then(reply);}
 @Get('companies/:id/routes/:rid') detail(@Req() req:Request,@Param('id') id:string,@Param('rid') rid:string){return this.routes.detail(token(req),id,rid).then(reply);}
 @Post('companies/:id/routes') create(@Req() req:Request,@Param('id') id:string,@Body() data:unknown){return this.routes.save(token(req),id,undefined,data).then(reply);}
 @Patch('companies/:id/routes/:rid') update(@Req() req:Request,@Param('id') id:string,@Param('rid') rid:string,@Body() data:unknown){return this.routes.save(token(req),id,rid,data).then(reply);}
}
@Controller('api/v1/companies/:id')
class FleetController {
 constructor(private readonly fleet:FleetService){}
 @Get('fleet') list(@Req() req:Request,@Param('id') id:string){return this.fleet.fleet(token(req),id).then(reply);}
 @Post('fleet/layouts') createLayout(@Req() req:Request,@Param('id') id:string,@Body() data:unknown){return this.fleet.createLayout(token(req),id,data).then(reply);}
 @Patch('fleet/layouts/:rid') updateLayout(@Req() req:Request,@Param('id') id:string,@Param('rid') rid:string,@Body() data:unknown){return this.fleet.updateLayout(token(req),id,rid,data).then(reply);}
 @Post('fleet/layouts/:rid/revisions') revise(@Req() req:Request,@Param('id') id:string,@Param('rid') rid:string,@Body() data:unknown){return this.fleet.revise(token(req),id,rid,data).then(reply);}
 @Get('fleet/layouts/:rid/revisions/:revision') revision(@Req() req:Request,@Param('id') id:string,@Param('rid') rid:string,@Param('revision') revision:string){return this.fleet.revision(token(req),id,rid,revision).then(reply);}
 @Post('fleet/buses') createBus(@Req() req:Request,@Param('id') id:string,@Body() data:unknown){return this.fleet.saveBus(token(req),id,undefined,data).then(reply);}
 @Patch('fleet/buses/:rid') updateBus(@Req() req:Request,@Param('id') id:string,@Param('rid') rid:string,@Body() data:unknown){return this.fleet.saveBus(token(req),id,rid,data).then(reply);}
 @Get('drivers') drivers(@Req() req:Request,@Param('id') id:string){return this.fleet.drivers(token(req),id).then(reply);}
 @Post('drivers') createDriver(@Req() req:Request,@Param('id') id:string,@Body() data:unknown){return this.fleet.saveDriver(token(req),id,undefined,data).then(reply);}
 @Patch('drivers/:rid') updateDriver(@Req() req:Request,@Param('id') id:string,@Param('rid') rid:string,@Body() data:unknown){return this.fleet.saveDriver(token(req),id,rid,data).then(reply);}
}
@Controller('api/v1/companies/:id/trips')
class TripController {
 constructor(private readonly trips:TripService){}
 @Get() list(@Req() req:Request,@Param('id') id:string,@Query('from') from:string|undefined){return this.trips.trips(token(req),id,from).then(reply);}
 @Post() create(@Req() req:Request,@Param('id') id:string,@Body() data:unknown){return this.trips.create(token(req),id,data).then(reply);}
 @Get(':rid') detail(@Req() req:Request,@Param('id') id:string,@Param('rid') rid:string){return this.trips.detail(token(req),id,rid).then(reply);}
 @Patch(':rid') update(@Req() req:Request,@Param('id') id:string,@Param('rid') rid:string,@Body() data:unknown){return this.trips.update(token(req),id,rid,data).then(reply);}
 @Post(':rid/assignment') assign(@Req() req:Request,@Param('id') id:string,@Param('rid') rid:string,@Body() data:unknown){return this.trips.assign(token(req),id,rid,data).then(reply);}
 @Post(':rid/publish') publish(@Req() req:Request,@Param('id') id:string,@Param('rid') rid:string,@Body() data:unknown){return this.trips.publish(token(req),id,rid,data).then(reply);}
 @Post(':rid/cancel') cancel(@Req() req:Request,@Param('id') id:string,@Param('rid') rid:string,@Body() data:unknown){return this.trips.cancel(token(req),id,rid,data).then(reply);}
}
@Controller('api/v1/public')
class PublicController {
 constructor(private readonly market:PublicService){}
 @Get('cities') cities(){return this.market.cities().then(reply);}
 @Get('companies') companies(){return this.market.companies().then(reply);}
 @Get('companies/:slug') company(@Param('slug') slug:string){return this.market.company(slug).then(reply);}
 @Get('trips') trips(@Query() query:Record<string,unknown>){return this.market.trips(query).then(reply);}
}
@Controller('api/v1/public')
class ReservationController {
 constructor(private readonly reservations:ReservationService){}
 @Get('trips/:id') trip(@Param('id') id:string){return this.reservations.trip(id).then(reply);}
 @Post('holds') hold(@Req() req:Request,@Body() data:unknown){return this.reservations.hold(data,req.socket.remoteAddress||'local').then(reply);}
 @Get('holds/current') current(@Req() req:Request){return this.reservations.current(req.headers['x-booking-key']).then(reply);}
 @Post('holds/lookup') lookup(@Req() req:Request,@Body() data:unknown){return this.reservations.lookup(data,req.socket.remoteAddress||'local').then(reply);}
 @Get('holds/:reference') booking(@Req() req:Request,@Param('reference') reference:string){return this.reservations.booking(reference,req.headers['x-booking-key']).then(reply);}
 @Post('holds/:reference/release') release(@Req() req:Request,@Param('reference') reference:string,@Body() data:unknown){return this.reservations.release(reference,data,req.socket.remoteAddress||'local').then(reply);}
}
@Controller('api/v1/companies/:id/shipments')
class ShipmentController {
 constructor(private readonly shipments:ShipmentService){}
 @Get() find(@Req() req:Request,@Param('id') id:string,@Query('q') q:unknown,@Query('trip') trip:unknown){return this.shipments.find(token(req),id,q,trip).then(reply);}
 @Get('options') options(@Req() req:Request,@Param('id') id:string){return this.shipments.options(token(req),id).then(reply);}
 @Post() create(@Req() req:Request,@Param('id') id:string,@Body() data:unknown){return this.shipments.create(token(req),id,data).then(reply);}
 @Post('prices') price(@Req() req:Request,@Param('id') id:string,@Body() data:unknown){return this.shipments.savePrice(token(req),id,data).then(reply);}
 @Post('scan') scan(@Req() req:Request,@Param('id') id:string,@Body() data:unknown){return this.shipments.scan(token(req),id,data).then(reply);}
 @Post(':sid/tag') tag(@Req() req:Request,@Param('id') id:string,@Param('sid') sid:string,@Body() data:unknown){return this.shipments.tag(token(req),id,sid,data).then(reply);}
 @Post(':sid/move') move(@Req() req:Request,@Param('id') id:string,@Param('sid') sid:string,@Body() data:unknown){return this.shipments.move(token(req),id,sid,data).then(reply);}
 @Post(':sid/deliver') deliver(@Req() req:Request,@Param('id') id:string,@Param('sid') sid:string,@Body() data:unknown){return this.shipments.deliver(token(req),id,sid,data).then(reply);}
 @Post(':sid/return') giveBack(@Req() req:Request,@Param('id') id:string,@Param('sid') sid:string,@Body() data:unknown){return this.shipments.returnToSender(token(req),id,sid,data).then(reply);}
 @Post(':sid/exceptions') report(@Req() req:Request,@Param('id') id:string,@Param('sid') sid:string,@Body() data:unknown){return this.shipments.report(token(req),id,sid,data).then(reply);}
 @Post(':sid/exceptions/:eid/resolve') resolve(@Req() req:Request,@Param('id') id:string,@Param('sid') sid:string,@Param('eid') eid:string,@Body() data:unknown){return this.shipments.resolve(token(req),id,sid,eid,data).then(reply);}
}
@Controller('api/v1/public')
class ShipmentTrackingController {
 constructor(private readonly shipments:ShipmentService){}
 @Get('shipments/:code') track(@Req() req:Request,@Param('code') code:string){return this.shipments.track(code,client(req)).then(reply);}
}
@Controller('api/v1/companies/:id/luggage')
class LuggageController {
 constructor(private readonly luggage:LuggageService){}
 @Get() find(@Req() req:Request,@Param('id') id:string,@Query('q') q:unknown){return this.luggage.find(token(req),id,q).then(reply);}
 @Post() register(@Req() req:Request,@Param('id') id:string,@Body() data:unknown){return this.luggage.register(token(req),id,data).then(reply);}
 @Post('scan') scan(@Req() req:Request,@Param('id') id:string,@Body() data:unknown){return this.luggage.scan(token(req),id,data).then(reply);}
 @Patch(':lid') update(@Req() req:Request,@Param('id') id:string,@Param('lid') lid:string,@Body() data:unknown){return this.luggage.update(token(req),id,lid,data).then(reply);}
 @Post(':lid/tag') tag(@Req() req:Request,@Param('id') id:string,@Param('lid') lid:string,@Body() data:unknown){return this.luggage.tag(token(req),id,lid,data).then(reply);}
 @Post(':lid/move') move(@Req() req:Request,@Param('id') id:string,@Param('lid') lid:string,@Body() data:unknown){return this.luggage.move(token(req),id,lid,data).then(reply);}
 @Post(':lid/collect') collect(@Req() req:Request,@Param('id') id:string,@Param('lid') lid:string,@Body() data:unknown){return this.luggage.collect(token(req),id,lid,data).then(reply);}
 @Post(':lid/exceptions') report(@Req() req:Request,@Param('id') id:string,@Param('lid') lid:string,@Body() data:unknown){return this.luggage.report(token(req),id,lid,data).then(reply);}
 @Post(':lid/exceptions/:eid/resolve') resolve(@Req() req:Request,@Param('id') id:string,@Param('lid') lid:string,@Param('eid') eid:string,@Body() data:unknown){return this.luggage.resolve(token(req),id,lid,eid,data).then(reply);}
}
@Controller('api/v1/companies/:id')
class TicketingController {
 constructor(private readonly ticketing:TicketingService){}
 @Get('counter') overview(@Req() req:Request,@Param('id') id:string){return this.ticketing.overview(token(req),id).then(reply);}
 @Get('counter/trips/:tid') trip(@Req() req:Request,@Param('id') id:string,@Param('tid') tid:string){return this.ticketing.trip(token(req),id,tid).then(reply);}
 @Put('payment-settings') settings(@Req() req:Request,@Param('id') id:string,@Body() data:unknown){return this.ticketing.settings(token(req),id,data).then(reply);}
 @Post('counters') createCounter(@Req() req:Request,@Param('id') id:string,@Body() data:unknown){return this.ticketing.counter(token(req),id,undefined,data).then(reply);}
 @Patch('counters/:rid') updateCounter(@Req() req:Request,@Param('id') id:string,@Param('rid') rid:string,@Body() data:unknown){return this.ticketing.counter(token(req),id,rid,data).then(reply);}
 @Post('counter/sessions') open(@Req() req:Request,@Param('id') id:string,@Body() data:unknown){return this.ticketing.openSession(token(req),id,data).then(reply);}
 @Post('counter/sessions/:sid/close') close(@Req() req:Request,@Param('id') id:string,@Param('sid') sid:string,@Body() data:unknown){return this.ticketing.closeSession(token(req),id,sid,data).then(reply);}
 @Post('counter/sales') sale(@Req() req:Request,@Param('id') id:string,@Body() data:unknown){return this.ticketing.sale(token(req),id,data).then(reply);}
 @Post('bookings/:bid/pay') pay(@Req() req:Request,@Param('id') id:string,@Param('bid') bid:string,@Body() data:unknown){return this.ticketing.pay(token(req),id,bid,data).then(reply);}
 @Post('bookings/:bid/refund') refund(@Req() req:Request,@Param('id') id:string,@Param('bid') bid:string,@Body() data:unknown){return this.ticketing.refund(token(req),id,bid,data).then(reply);}
 @Post('bookings/:bid/print') print(@Req() req:Request,@Param('id') id:string,@Param('bid') bid:string,@Body() data:unknown){return this.ticketing.print(token(req),id,bid,data).then(reply);}
}
@Controller('api/v1/companies/:id/bookings')
class BookingController {
 constructor(private readonly reservations:ReservationService){}
 @Get() list(@Req() req:Request,@Param('id') id:string,@Query('q') q:unknown){return this.reservations.bookings(token(req),id,q).then(reply);}
 @Get(':bid') detail(@Req() req:Request,@Param('id') id:string,@Param('bid') bid:string){return this.reservations.bookingDetail(token(req),id,bid).then(reply);}
 @Patch(':bid') correct(@Req() req:Request,@Param('id') id:string,@Param('bid') bid:string,@Body() data:unknown){return this.reservations.correct(token(req),id,bid,data).then(reply);}
}
@Controller('api/v1/companies/:id/trips/:rid')
class TripSeatController {
 constructor(private readonly reservations:ReservationService){}
 @Get('seats') seats(@Req() req:Request,@Param('id') id:string,@Param('rid') rid:string){return this.reservations.seats(token(req),id,rid).then(reply);}
 @Post('holds/:hid/release') release(@Req() req:Request,@Param('id') id:string,@Param('rid') rid:string,@Param('hid') hid:string,@Body() data:unknown){return this.reservations.staffRelease(token(req),id,rid,hid,data).then(reply);}
}
@Controller('api/v1/companies/:id/public-profile')
class PublicProfileController {
 constructor(private readonly market:PublicService){}
 @Get() read(@Req() req:Request,@Param('id') id:string){return this.market.profile(token(req),id).then(reply);}
 @Put() save(@Req() req:Request,@Param('id') id:string,@Body() data:unknown){return this.market.saveProfile(token(req),id,data).then(reply);}
}
@Controller('api/v1/driver')
class BoardingController {
 constructor(private readonly boarding:BoardingService){}
 @Get('trips') trips(@Req() req:Request){return this.boarding.trips(token(req)).then(reply);}
 @Get('companies/:cid/trips/:tid') manifest(@Req() req:Request,@Param('cid') cid:string,@Param('tid') tid:string){return this.boarding.manifest(token(req),cid,tid).then(reply);}
 @Post('companies/:cid/trips/:tid/verify') verify(@Req() req:Request,@Param('cid') cid:string,@Param('tid') tid:string,@Body() data:unknown){return this.boarding.verify(token(req),cid,tid,data).then(reply);}
 @Post('companies/:cid/trips/:tid/board') board(@Req() req:Request,@Param('cid') cid:string,@Param('tid') tid:string,@Body() data:unknown){return this.boarding.verify(token(req),cid,tid,data,true).then(reply);}
 @Post('companies/:cid/trips/:tid/events') event(@Req() req:Request,@Param('cid') cid:string,@Param('tid') tid:string,@Body() data:unknown){return this.boarding.event(token(req),cid,tid,data).then(reply);}
 @Post('companies/:cid/trips/:tid/incidents') incident(@Req() req:Request,@Param('cid') cid:string,@Param('tid') tid:string,@Body() data:unknown){return this.boarding.incident(token(req),cid,tid,data).then(reply);}
}
@Controller('api/v1/companies/:id/finance')
class FinanceController {
 constructor(private readonly finance:FinanceService){}
 @Get('options') options(@Req() req:Request,@Param('id') id:string){return this.finance.options(token(req),id).then(reply);}
 @Get() report(@Req() req:Request,@Param('id') id:string,@Query() query:unknown){return this.finance.report(token(req),id,query).then(reply);}
 @Post('export') export(@Req() req:Request,@Param('id') id:string,@Body() data:unknown){return this.finance.report(token(req),id,data,true).then(reply);}
}
@Controller('api/v1')
class PlatformController {
 constructor(private readonly platform:PlatformService){}
 @Get('public/notice') notice(){return this.platform.notice().then(reply);}
 @Get('platform/dashboard') dashboard(@Req() req:Request,@Query() query:Record<string,unknown>){return this.platform.dashboard(token(req),query).then(reply);}
 @Get('platform/settings') settings(@Req() req:Request){return this.platform.settings(token(req)).then(reply);}
 @Put('platform/settings') save(@Req() req:Request,@Body() data:unknown){return this.platform.save(token(req),data).then(reply);}
 @Get('notifications') notifications(@Req() req:Request,@Query('before') before:string|undefined){return this.platform.notifications(token(req),before).then(reply);}
 @Post('notifications/:event/read') read(@Req() req:Request,@Param('event') id:string,@Body() data:unknown){return this.platform.read(token(req),id,data).then(reply);}
}
@Module({controllers:[PlatformController,FinanceController,IdentityController,CompanyController,LuggageController,ShipmentController,ShipmentTrackingController,TicketingController,BookingController,RouteController,FleetController,TripSeatController,TripController,ReservationController,PublicController,PublicProfileController,BoardingController],providers:[Database,ShipmentService,IdentityService,CompanyService,RouteService,FleetService,TripService,PublicService,ReservationService,TicketingService,LuggageService,BoardingService,FinanceService,PlatformService]})
export class IdentityModule {}

export async function createIdentityApi({port=4321,webOrigin='http://127.0.0.1:4320'}:{port?:number;webOrigin?:string}={}){
  const origin=new URL(webOrigin);
  const hosted=origin.protocol==='https:'&&!['127.0.0.1','localhost'].includes(origin.hostname);
  if(!(hosted||origin.protocol==='http:'&&origin.hostname==='127.0.0.1')||origin.username||origin.password||origin.pathname!=='/'||origin.search||origin.hash||!Number.isInteger(port)||port<0||port>65535)throw Error('Use a loopback or hosted https web origin and valid identity port.');
  secure=hosted?'; Secure':'';
  const app=await NestFactory.create(IdentityModule,{logger:false,bodyParser:false,abortOnError:false});
  app.getHttpAdapter().getInstance().disable('x-powered-by');
  const http=app.getHttpServer();http.headersTimeout=10000;http.requestTimeout=15000;http.keepAliveTimeout=5000;http.maxHeadersCount=40;http.maxRequestsPerSocket=100;http.setTimeout(15000,(socket:import('node:net').Socket)=>socket.destroy());
  app.useGlobalFilters(new Errors());
  app.use((req:Request,res:Response,next:()=>void)=>{
    res.setHeader('Cache-Control','no-store');res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Referrer-Policy','no-referrer');
    res.setHeader('Permissions-Policy','camera=(), microphone=(), geolocation=(), payment=(), usb=()');
    res.setHeader('Content-Security-Policy',"default-src 'none'; frame-ancestors 'none'");
    const address=app.getHttpServer().address();
    if(req.headers.host!==`127.0.0.1:${address?.port}`||req.headers.authorization||req.headers['sec-fetch-site']==='cross-site')return res.status(403).json({error:{code:'FORBIDDEN',message:'Request not permitted.'}});
    if(!['GET','POST','PATCH','PUT','DELETE'].includes(req.method))return res.status(405).json({error:{code:'METHOD_NOT_ALLOWED',message:'Method not permitted.'}});
    if(req.method!=='GET'){
      if(req.headers.origin!==origin.origin)return res.status(403).json({error:{code:'INVALID_ORIGIN',message:'Use the local Safeer staff page.'}});
      if(req.path!=='/api/v1/auth/login'&&!/^\/api\/v1\/public\/holds(\/lookup|\/[^/]+\/release)?$/.test(req.path)){
        let session:string;try{session=token(req);}catch{return res.status(401).json({error:{code:'UNAUTHENTICATED',message:'Sign in to continue.'}});}
        if(!validCsrf(session,req.headers['x-csrf-token']))return res.status(403).json({error:{code:'CSRF_REJECTED',message:'Refresh the staff page and try again.'}});
      }
      if(req.method!=='DELETE'&&!req.is('application/json'))return res.status(415).json({error:{code:'JSON_REQUIRED',message:'Send a JSON request.'}});
    }
    next();
  });
  const standardJson=json({limit:bodyLimits.defaultBodyBytes,strict:true}),bookingJson=json({limit:bodyLimits.bookingBodyBytes,strict:true});
  app.use((req:Request,res:Response,next:()=>void)=>(req.method==='POST'&&req.path==='/api/v1/public/holds'?bookingJson:standardJson)(req,res,next));
  try{await app.listen(port,'127.0.0.1');}catch(error){await app.close();throw error;}
  const address=app.getHttpServer().address();
  return {app,origin:`http://127.0.0.1:${address.port}`,identity:app.get(IdentityService),db:app.get(Database),close:()=>app.close()};
}
