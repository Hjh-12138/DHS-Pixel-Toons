import {test} from 'node:test'
import assert from 'node:assert/strict'
import {mkdtemp,mkdir,readFile,writeFile} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import {createRequire} from 'node:module'
import {pathToFileURL} from 'node:url'
import {installDesktopPackage} from '../scripts/install-desktop-package.mjs'

const require=createRequire(import.meta.url)
const dshRequire=createRequire(require.resolve('@deepseek-ai/dsh/package.json'))
const {withFileLock}=await import(pathToFileURL(dshRequire.resolve('@deepseek-ai/dsh-atomic-write')).href)
const put=async(path:string,value:unknown)=>writeFile(path,JSON.stringify(value),'utf8')

async function fixture(){
 const root=await mkdtemp(join(tmpdir(),'toons-installer-')),profileDirectory=join(root,'profile')
 const manifest=join(profileDirectory,'node_modules','dsh-toons','package.json'),selection=join(profileDirectory,'package.json')
 await mkdir(join(profileDirectory,'node_modules','dsh-toons'),{recursive:true})
 await put(manifest,{name:'dsh-toons',version:'0.1.16'})
 await put(selection,{dependencies:{'dsh-toons':'file:old.tgz'}})
 return {root,manifest,selection,request:{profileDirectory,packagePath:join(root,'new.tgz'),candidateVersion:'0.1.17',backupDirectory:join(root,'backup'),installAnchor:'fixture'}}
}

for(const change of ['upgrade','uninstall'] as const)test(`profile lock rechecks ${change} completed by a competing installer`,async()=>{
 const f=await fixture()
 let entered!:()=>void,release!:()=>void,calls=0
 const acquired=new Promise<void>(resolve=>{entered=resolve}),resume=new Promise<void>(resolve=>{release=resolve})
 const manual=withFileLock(f.selection,async()=>{entered();await resume
  if(change==='upgrade')await put(f.manifest,{name:'dsh-toons',version:'0.1.18'})
  else await put(f.selection,{dependencies:{}})
 },{waitMs:5000})
 await acquired
 const update=installDesktopPackage(f.request,{withFileLock,runProfilePnpm:async()=>{calls++;throw new Error('must not install')},options:{}})
 release();await manual
 const result=await update
 assert.equal(result.status,change==='upgrade'?'skipped-newer-version':'plugin-removed')
 assert.equal(calls,0)
 if(change==='upgrade')assert.equal(JSON.parse(await readFile(f.manifest,'utf8')).version,'0.1.18')
 else assert.deepEqual(JSON.parse(await readFile(f.selection,'utf8')).dependencies,{})
})

test('locked desktop installation backs up selection and verifies the installed package',async()=>{
 const f=await fixture()
 const result=await installDesktopPackage(f.request,{withFileLock,options:{},runProfilePnpm:async(context:Record<string,string>,args:string[])=>{
  assert.equal(context.dir,f.request.profileDirectory);assert.deepEqual(args,['add',f.request.packagePath])
  const backup=JSON.parse(await readFile(join(f.request.backupDirectory,'package.json'),'utf8'))
  assert.equal(backup.dependencies['dsh-toons'],'file:old.tgz')
  await put(f.manifest,{name:'dsh-toons',version:'0.1.17'})
  await put(f.selection,{dependencies:{'dsh-toons':'file:'+f.request.packagePath.replaceAll('\\','/')}})
  return {exitCode:0}
 }})
 assert.equal(result.status,'installed')
})

test('an installer failure releases the profile lock and leaves the existing package selected',async()=>{
 const f=await fixture()
 await assert.rejects(installDesktopPackage(f.request,{withFileLock,options:{},runProfilePnpm:async()=>({exitCode:7,logPath:'fixture.log'})}),/exit code 7/)
 assert.equal(JSON.parse(await readFile(f.manifest,'utf8')).version,'0.1.16')
 assert.equal(JSON.parse(await readFile(f.selection,'utf8')).dependencies['dsh-toons'],'file:old.tgz')
 await withFileLock(f.selection,async()=>{}, {waitMs:1000})
})

test('a successful command returning the wrong installed version is rejected',async()=>{
 const f=await fixture()
 await assert.rejects(installDesktopPackage(f.request,{withFileLock,options:{},runProfilePnpm:async()=>({exitCode:0})}),/expected plugin version/)
})
