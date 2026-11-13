import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import archiver from 'archiver';

const root=process.cwd();
const output=path.resolve(process.argv[2]||'../output/source/hire-workbench-v0.1.0.zip');
if(path.extname(output)!=='.zip')throw new Error('Output must be a ZIP file');
const excluded=new Set(['node_modules','dist','data','.git','.verification','test-results','playwright-report','SOURCE-MANIFEST.json','source-history.bundle']);
function list(folder,prefix='') {
  const result=[];
  for(const entry of fs.readdirSync(folder,{withFileTypes:true})){
    if(excluded.has(entry.name)||entry.name==='.env'||(entry.name.startsWith('.env.')&&entry.name!=='.env.example')||entry.name.endsWith('.zip')||entry.name.endsWith('.log')&&prefix!=='evidence/release')continue;
    const relative=prefix?`${prefix}/${entry.name}`:entry.name;
    if(relative==='evidence/latest')continue;
    const absolute=path.join(folder,entry.name);
    if(entry.isSymbolicLink())throw new Error(`Refusing to package symlink: ${relative}`);
    if(entry.isDirectory())result.push(...list(absolute,relative));else if(entry.isFile())result.push(relative);
  }
  return result.sort();
}
let head=null;
try {
  head=execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim();
  execFileSync('git',['bundle','create','source-history.bundle','--all']);
}catch(error){console.warn('No Git bundle created; source files will still be packaged.');}
const files=list(root);
const manifest={name:'hire-workbench',version:'0.1.0',packagedAt:new Date().toISOString(),head,node:process.version,files:files.map(file=>({path:file,sha256:createHash('sha256').update(fs.readFileSync(file)).digest('hex'),bytes:fs.statSync(file).size}))};
fs.writeFileSync('SOURCE-MANIFEST.json',JSON.stringify(manifest,null,2)+'\n');
fs.mkdirSync(path.dirname(output),{recursive:true});
const archive=archiver('zip',{zlib:{level:9}});const stream=fs.createWriteStream(output);
const complete=new Promise((resolve,reject)=>{stream.on('close',resolve);stream.on('error',reject);archive.on('error',reject);});
archive.pipe(stream);
for(const file of [...files,'SOURCE-MANIFEST.json',...(head&&fs.existsSync('source-history.bundle')?['source-history.bundle']:[])])archive.file(path.join(root,file),{name:`hire-workbench/${file}`});
await archive.finalize();await complete;
console.log(JSON.stringify({file:output,bytes:fs.statSync(output).size,files:files.length,sha256:createHash('sha256').update(fs.readFileSync(output)).digest('hex'),head},null,2));
