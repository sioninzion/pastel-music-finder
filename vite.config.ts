import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { createHash } from "node:crypto";
export default defineConfig({
  base: process.env.BASE_PATH || "/pastel-music-finder/",
  build: { target: ["es2020", "chrome87", "edge88", "safari14", "firefox78"] },
  plugins: [
    react(),
    {
      name: "offline-shell",
      closeBundle() {
        const walk = (dir: string): string[] =>
          readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
            e.isDirectory() ? walk(join(dir, e.name)) : [join(dir, e.name)],
          );
        const files = walk("dist").filter(
          (f) => !f.includes("/audio/") && !f.endsWith("/sw.js"),
        );
        const version = createHash("sha256")
          .update(files.map((f) => readFileSync(f)).join(""))
          .digest("hex")
          .slice(0, 12);
        const prefix =
          "music-finder-shell-" +
          (process.env.BASE_PATH || "/pastel-music-finder/").replace(
            /[^a-zA-Z0-9]/g,
            "",
          ) +
          "-";
        const urls = files.map((f) => "./" + f.slice(5));
        writeFileSync(
          "dist/sw.js",
          `const PREFIX=${JSON.stringify(prefix)};const CACHE=PREFIX+'${version}';
self.addEventListener('install',e=>e.waitUntil(caches.open(CACHE).then(c=>c.addAll(${JSON.stringify(urls)}))));
self.addEventListener('activate',e=>e.waitUntil((async()=>{await Promise.all((await caches.keys()).filter(k=>k.startsWith(PREFIX)&&k!==CACHE).map(k=>caches.delete(k)));await self.clients.claim()})()));
self.addEventListener('fetch',e=>{const u=new URL(e.request.url);if(e.request.method!=='GET'||u.origin!==location.origin||!u.href.startsWith(self.registration.scope))return;
if(u.pathname.includes('/audio/'))return;
e.respondWith((async()=>{const c=await caches.open(CACHE);if(e.request.mode==='navigate'){try{const r=await fetch(e.request,{cache:'no-store'});if(r.ok)return r}catch{}return (await c.match(new URL('index.html',self.registration.scope)))||fetch(e.request)}const hit=await c.match(e.request,{ignoreVary:true});if(hit)return hit;return fetch(e.request)})())});
self.addEventListener('message',e=>{if(e.data==='skipWaiting')self.skipWaiting()});`,
        );
      },
    },
  ],
});
