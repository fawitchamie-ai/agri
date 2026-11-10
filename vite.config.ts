import vinext from "vinext";
import {defineConfig} from "vite";
import {cloudflare} from "@cloudflare/vite-plugin";
import {execFileSync} from "node:child_process";
import {existsSync} from "node:fs";
const candidate=process.env.GITHUB_SHA??execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim();
const build={commit:/^[a-f0-9]{40}$/.test(candidate)?candidate:null,builtAt:new Date().toISOString()};
export default defineConfig({define:{__AGRI_BUILD__:JSON.stringify(build)},server:{allowedHosts:["terminal.local"]},plugins:[vinext(),cloudflare({configPath:existsSync(".cloudflare/wrangler.json")?".cloudflare/wrangler.json":"wrangler.jsonc",viteEnvironment:{name:"rsc",childEnvironments:["ssr"]},inspectorPort:false})]});
