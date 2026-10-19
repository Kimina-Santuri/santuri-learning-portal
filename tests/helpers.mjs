import assert from 'node:assert/strict';
import {readFile,readdir} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
import {randomUUID} from 'node:crypto';

// Fresh database with Supabase stand-ins, the bookings objects we depend on, all migrations and the seed.
export async function setup(names){
 const db=new PGlite();
 await db.exec(`create role anon; create role authenticated; create role service_role bypassrls;
 create schema auth; create table auth.users(id uuid primary key,email text,raw_user_meta_data jsonb default '{}');
 create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
 grant usage on schema auth to anon,authenticated,service_role;grant execute on function auth.uid() to anon,authenticated,service_role;
 create schema storage;create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
 create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text,name text);alter table storage.objects enable row level security;
 grant usage on schema storage to authenticated;grant insert,select,delete on storage.objects to authenticated;`);
 await db.exec(await readFile('tests/fixtures/bookings-base.sql','utf8'));
 for(const file of (await readdir('supabase/migrations')).sort())await db.exec(await readFile(`supabase/migrations/${file}`,'utf8'));
 await db.exec(await readFile('supabase/seed.sql','utf8'));
 const ids={};
 for(const name of names){ids[name]=randomUUID();await db.query(`insert into auth.users(id,email,raw_user_meta_data) values($1,$2,$3)`,[ids[name],`${name}@example.test`,{full_name:name[0].toUpperCase()+name.slice(1),role:'admin'}]);}
 const query=async(sql,params=[]) => (await db.query(sql,params)).rows;
 async function as(id,role='authenticated'){await db.exec('reset role');await db.query("select set_config('request.jwt.claim.sub',$1,false)",[id||'']);await db.exec(`set role ${role}`);}
 const rpc=async(name,args=[])=>{const rows=await query(`select public.${name}(${args.map((_,i)=>'$'+(i+1)).join(',')}) as value`,args);return rows[0].value;};
 const rejects=(fn,pattern)=>assert.rejects(fn,pattern);
 return {db,ids,query,as,rpc,rejects};
}
