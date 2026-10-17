import { readdirSync, statSync, readFileSync } from "node:fs";
import { join } from "node:path";
let total = 0;
function walk(p) {
  for (const e of readdirSync(p, { withFileTypes: true })) {
    const f = join(p, e.name);
    if (e.isDirectory()) walk(f);
    else {
      const n = statSync(f).size;
      total += n;
      if (n >= 100 * 1024 ** 2) throw Error(`${f}: GitHub 파일 제한 초과`);
      if (
        f.includes("/audio/") &&
        readFileSync(f)
          .subarray(0, 100)
          .toString()
          .includes("version https://git-lfs")
      )
        throw Error("LFS pointer 음원은 배포할 수 없습니다.");
    }
  }
}
walk("dist");
if (total >= 950 * 1024 ** 2) throw Error("Pages 크기 한도에 근접했습니다.");
console.log(`배포 크기: ${(total / 1024 ** 2).toFixed(2)} MiB`);
