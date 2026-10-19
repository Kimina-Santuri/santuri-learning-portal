import {build} from 'esbuild';
import {mkdir,cp,readdir,copyFile,rm} from 'node:fs/promises';
await mkdir('assets/vendor',{recursive:true});
await build({stdin:{contents:"export { createClient } from '@supabase/supabase-js';",resolveDir:process.cwd()},bundle:true,format:'esm',platform:'browser',target:['es2022'],minify:true,outfile:'assets/vendor/supabase.js',legalComments:'eof'});
await rm('dist',{recursive:true,force:true});await mkdir('dist',{recursive:true});
for(const file of await readdir('.'))if(file.endsWith('.html')||['robots.txt','CNAME'].includes(file))await copyFile(file,`dist/${file}`);
await cp('assets','dist/assets',{recursive:true,filter:src=>!src.endsWith('preview-client.js')});
console.log('Built static site in dist/; database files, tests and secrets are excluded.');
