// Accept the preview daemon's Vite-shaped flags and translate them for Next.js.
import {spawn} from 'node:child_process';
const input=process.argv.slice(2);
const args=['node_modules/next/dist/bin/next','dev'];
for(let i=0;i<input.length;i++){
  if(input[i]==='--strictPort')continue;
  args.push(input[i]==='--host'?'--hostname':input[i]);
}
if(!args.includes('--hostname'))args.push('--hostname','0.0.0.0');
const child=spawn(process.execPath,args,{stdio:'inherit',env:{...process.env,NEXT_TELEMETRY_DISABLED:'1'}});
for(const sig of ['SIGINT','SIGTERM'])process.on(sig,()=>child.kill(sig));
child.on('exit',code=>process.exit(code??1));
