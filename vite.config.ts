import vinext from "vinext";
import {defineConfig} from "vite";
import {cloudflare} from "@cloudflare/vite-plugin";
import {existsSync} from "node:fs";
export default defineConfig({plugins:[vinext(),cloudflare({configPath:existsSync(".cloudflare/wrangler.json")?".cloudflare/wrangler.json":"wrangler.jsonc",viteEnvironment:{name:"rsc",childEnvironments:["ssr"]},inspectorPort:false})]});
