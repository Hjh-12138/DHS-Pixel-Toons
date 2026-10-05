import {build} from 'esbuild'
import {mkdir,writeFile} from 'node:fs/promises'
await mkdir('lib',{recursive:true})
const worker=await build({entryPoints:['src/worker.ts'],bundle:true,write:false,format:'iife',platform:'browser',target:'es2022',minify:true})
const workerText=worker.outputFiles[0].text
await build({entryPoints:['src/index.ts'],bundle:true,outfile:'lib/index.js',format:'esm',platform:'node',target:'node22',packages:'external',sourcemap:true})
await build({entryPoints:['src/client/index.tsx'],bundle:true,outfile:'lib/client.js',format:'cjs',platform:'browser',target:'es2022',external:['react','react/jsx-runtime'],loader:{'.png':'dataurl','.zip':'dataurl'},plugins:[{name:'toons-worker',setup(b){b.onResolve({filter:/^toons:worker-source$/},()=>({path:'worker',namespace:'toons'}));b.onLoad({filter:/.*/,namespace:'toons'},()=>({contents:`export default ${JSON.stringify(workerText)}`,loader:'js'}))}}],banner:{js:'window.__ModuleLoader__.load({id:"dsh-toons",factory:(require)=>{var module={exports:{}};var exports=module.exports;'},footer:{js:'return module.exports;}});'},minify:true})
await writeFile('lib/index.d.ts','import type { Context } from "@deepseek-ai/cordis";\nimport type z from "@deepseek-ai/schemastery";\nexport declare const name: "dsh-toons";\nexport declare const inject: string[];\nexport interface ToonsConfig { enabled:boolean; source:"ready-made only"|"mix"; fps:number; intervalMs:number; timeoutMs:number; maxTokens:number; provider:string; model:string; stateDirectory:string; }\nexport declare const Config: z<ToonsConfig>;\nexport declare function apply(ctx: Context, config: ToonsConfig): void;\n')
console.log('Built Host, Harness Client module, and dedicated animation worker.')
