import { readFileSync, writeFileSync } from "node:fs";
const path = "public/tracks.json";
const data = JSON.parse(readFileSync(path));
for (const t of data.tracks) {
  try {
    const r = await fetch(
      `https://www.youtube.com/oembed?url=${encodeURIComponent(t.youtubeUrl)}&format=json`,
    );
    if (!r.ok) throw Error(`HTTP ${r.status}`);
    const m = await r.json();
    t.youtubeMetadata = {
      title: m.title,
      author: m.author_name,
      checkedAt: new Date().toISOString(),
    };
    console.log(`${t.displayNumber} ${m.title}`);
  } catch (e) {
    t.youtubeMetadata = { error: String(e) };
    console.log(`${t.displayNumber} 확인 실패: ${e}`);
  }
}
writeFileSync(path, JSON.stringify(data, null, 2) + "\n");
