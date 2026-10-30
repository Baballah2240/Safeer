import pg from 'pg';
import {databaseConfig} from './migrate.mjs';
import {grantIdentityRuntime} from './runtime-grants.mjs';
const args=process.argv.slice(2);
if(args.length!==2||args[0]!=='--role')throw Error('Use: npm run identity:grant -- --role safeer_app');
const client=new pg.Client(databaseConfig(process.env.SAFEER_DATABASE_URL));
try{await client.connect();await client.query('BEGIN');await grantIdentityRuntime(client,args[1]);await client.query('COMMIT');console.log('Local identity runtime grants applied.');}
catch{await client.query('ROLLBACK').catch(()=>{});console.error('Could not apply runtime grants. Review the local migration owner and target role.');process.exitCode=1;}
finally{await client.end();}
