import 'reflect-metadata';
import {NestFactory} from '@nestjs/core';
import {IdentityModule} from './app.js';
import {IdentityService} from './identity.service.js';
const command=process.argv[2],args=process.argv.slice(3);
if(command!=='bootstrap'||args.length!==4||args[0]!=='--email'||args[2]!=='--name'){
  console.error('Use: npm run identity:bootstrap -- --email owner@safeer.local --name "Safeer Owner"');process.exitCode=1;
}else{
  let app;
  try{app=await NestFactory.createApplicationContext(IdentityModule,{logger:false,abortOnError:false});const result=await app.get(IdentityService).bootstrap(args[1],args[3]);console.log(JSON.stringify(result,null,2));}
  catch{console.error('Bootstrap failed. An account may already exist; review local identity setup.');process.exitCode=1;}
  finally{await app?.close();}
}
