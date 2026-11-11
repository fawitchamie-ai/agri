import {createRequire} from 'node:module';import {execFileSync} from 'node:child_process';
const require=createRequire(import.meta.url),wr=createRequire(require.resolve('wrangler')),{build}=wr('esbuild');
const commit=process.env.GITHUB_SHA||execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim();
await build({entryPoints:['scripts/togo-stage-lab.ts'],bundle:true,platform:'browser',format:'esm',minify:true,outfile:'public/scientific/togo-stage-replay.js',define:{__AGRI_BENCH_COMMIT__:JSON.stringify(commit)}});
console.log('Rejeu scientifique compilé avec les équations du moteur : '+commit);
