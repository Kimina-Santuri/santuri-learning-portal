import {readFile,readdir,access} from 'node:fs/promises';
import {resolve,dirname} from 'node:path';
import {execFileSync} from 'node:child_process';
const pages=(await readdir('.')).filter(f=>f.endsWith('.html'));
let checked=0;
for(const file of pages){
 const html=await readFile(file,'utf8');
 for(const match of html.matchAll(/(?:src|href)="([^"#?]+)(?:[?#][^"]*)?"/g)){
  const link=match[1];if(/^(?:[a-z]+:|\/\/)/i.test(link))continue;
  await access(resolve(dirname(file),link));checked++;
 }
 const ids=[...html.matchAll(/\sid="([^"]+)"/g)].map(m=>m[1]);if(new Set(ids).size!==ids.length)throw Error(`Duplicate IDs in ${file}`);
}
for(const file of await readdir('assets/js'))if(file.endsWith('.js'))execFileSync(process.execPath,['--check',`assets/js/${file}`]);
const config=await readFile('assets/js/config.js','utf8');if(/sb_secret_|service_role.*eyJ/.test(config))throw Error('Private key in public configuration');
console.log(`Checked ${pages.length} pages, ${checked} local references and all JavaScript.`);
