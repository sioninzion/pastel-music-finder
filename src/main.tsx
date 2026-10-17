import React, { useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  Music2,
  Folder,
  ChevronLeft,
  ChevronRight,
  Grid2X2,
  Check,
  ArrowUpRight,
  Volume2,
  Pause,
  Play,
  RotateCcw,
  Settings2,
  Download,
  HardDrive,
  WifiOff,
  X,
  Square,
  Headphones,
} from "lucide-react";
import { SegmentPlayer, type AudioState } from "./audio";
import {
  audioUrl,
  cached,
  saveAudio,
  validate,
  seconds,
  readProgress,
  progressKey,
  type Track,
} from "./storage";
import "./style.css";
function App() {
  const [tracks, setTracks] = useState<Track[]>([]),
    [ready, setReady] = useState<number[]>([]),
    [loading, setLoading] = useState(true),
    [setup, setSetup] = useState(false),
    [current, setCurrent] = useState<number | null>(null),
    [done, setDone] = useState(readProgress),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [reset, setReset] = useState(false),
    [ending, setEnding] = useState<"none" | "over" | "winner">("none"),
    [audioState, setAudioState] = useState<AudioState>("idle"),
    [mode, setMode] = useState(""),
    [fraction, setFraction] = useState(0),
    [swReady, setSwReady] = useState(false),
    [online, setOnline] = useState(navigator.onLine);
  const finishTimer = useRef<number | null>(null);
  const player = useRef<SegmentPlayer | null>(null),
    currentRef = useRef<number | null>(null),
    doneRef = useRef(done),
    blobs = useRef(new Map<number, Blob>()),
    endingSeen = useRef(done.length === 15),
    busy = useRef(false),
    selection = useRef(0);
  const getPlayer = () => {
    if (!player.current) {
      player.current = new SegmentPlayer();
      player.current.onState = setAudioState;
    }
    return player.current;
  };
  useEffect(() => {
    history.replaceState(
      { finder: true },
      "",
      location.pathname + location.search,
    );
    const off = () => setOnline(navigator.onLine);
    window.addEventListener("online", off);
    window.addEventListener("offline", off);
    fetch(`${import.meta.env.BASE_URL}tracks.json`)
      .then((r) => {
        if (!r.ok) throw Error("곡 설정을 불러오지 못했습니다.");
        return r.json();
      })
      .then((d) => {
        if (d.tracks?.length !== 15) throw Error("15곡 설정이 필요합니다.");
        setTracks(d.tracks);
        return prepare(d.tracks);
      })
      .catch((e) => {
        setError(String(e));
        setLoading(false);
      });
    if ("serviceWorker" in navigator)
      navigator.serviceWorker
        .register(`${import.meta.env.BASE_URL}sw.js`, {
          scope: import.meta.env.BASE_URL,
        })
        .then(() => navigator.serviceWorker.ready)
        .then(() => setSwReady(true))
        .catch(() =>
          setNotice(
            "앱 오프라인 저장을 완료하지 못했습니다. 온라인에서 다시 열어주세요.",
          ),
        );
    return () => {
      window.removeEventListener("online", off);
      window.removeEventListener("offline", off);
      player.current?.stop();
    };
  }, []);
  async function prepare(list: Track[]) {
    if (busy.current) return;
    busy.current = true;
    setLoading(true);
    setError("");
    const found: number[] = [];
    const ctx = new AudioContext();
    try {
      for (const t of list) {
        try {
          let r = await cached(t);
          if (!r) {
            r = await fetch(audioUrl(t));
            if (!r.ok) continue;
            const b = await r.blob();
            await validate(b, ctx);
            await saveAudio(t, b);
            blobs.current.set(t.id, b);
          } else {
            const b = await r.blob();
            await validate(b, ctx);
            blobs.current.set(t.id, b);
          }
          found.push(t.id);
          setReady([...found]);
        } catch {
          /* Missing or invalid files stay visibly unprepared. */
        }
      }
    } finally {
      await ctx.close();
      setReady(found);
      setLoading(false);
      busy.current = false;
    }
  }
  function complete(id: number) {
    if (doneRef.current.includes(id)) return;
    const next = [...doneRef.current, id];
    doneRef.current = next;
    setDone(next);
    try {
      localStorage.setItem(progressKey, JSON.stringify(next));
    } catch {
      setNotice(
        "진행도를 저장할 수 없습니다. 이 브라우저의 저장 공간을 확인해주세요.",
      );
    }
    if (next.length === 15 && !endingSeen.current) {
      endingSeen.current = true;
      finishTimer.current = window.setTimeout(() => {
        finishTimer.current = null;
        setEnding("over");
      }, 900);
    }
  }
  function leave() {
    if (currentRef.current === null) return;
    history.back();
  }
  useEffect(() => {
    const pop = () => {
      selection.current++;
      player.current?.stop();
      const id = currentRef.current;
      if (id !== null) complete(id);
      currentRef.current = null;
      setCurrent(null);
      setMode("");
    };
    window.addEventListener("popstate", pop);
    return () => window.removeEventListener("popstate", pop);
  }, []);
  useEffect(() => {
    if (ending !== "over") return;
    const timer = setTimeout(() => setEnding("winner"), 3000);
    return () => clearTimeout(timer);
  }, [ending]);
  useEffect(() => {
    let frame: number;
    const loop = () => {
      setFraction(player.current?.tick() || 0);
      frame = requestAnimationFrame(loop);
    };
    frame = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(frame);
  }, []);
  function open(id: number) {
    if (ready.length !== 15 || finishTimer.current !== null) return;
    setError("");
    setMode("");
    currentRef.current = id;
    setCurrent(id);
    history.pushState({ question: id }, "", `#q${String(id).padStart(2, "0")}`);
  }
  async function play(label: string) {
    const t = tracks.find((t) => t.id === currentRef.current);
    if (!t) return;
    const start = label === "대표" ? seconds(t.highlightStart) : 0;
    if (start === null) return;
    const b = blobs.current.get(t.id);
    if (!b) {
      setError("음원이 준비되지 않았습니다.");
      return;
    }
    const token = ++selection.current;
    setMode(label);
    setError("");
    try {
      await getPlayer().play(
        b,
        start,
        label === "전곡" ? null : label === "대표" ? 3 : Number(label),
      );
    } catch (e) {
      if (token === selection.current)
        setError(`재생할 수 없습니다. ${e instanceof Error ? e.message : e}`);
    }
  }
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (
        e.ctrlKey ||
        e.metaKey ||
        e.altKey ||
        e.repeat ||
        ["INPUT", "TEXTAREA", "SELECT"].includes(
          (e.target as HTMLElement).tagName,
        )
      )
        return;
      if (currentRef.current === null) return;
      const k = e.key.toLowerCase();
      if (["1", "3", "5", "r", "f", " ", "escape"].includes(k))
        e.preventDefault();
      if (["1", "3", "5"].includes(k)) void play(k);
      else if (k === "r") void play("대표");
      else if (k === "f") void play("전곡");
      else if (k === " ") void player.current?.toggle();
      else if (k === "escape") leave();
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [tracks]);
  async function importFiles(files: FileList | null) {
    if (!files || busy.current) return;
    busy.current = true;
    setLoading(true);
    setError("");
    const ctx = new AudioContext();
    const found = new Set(ready);
    const problems: string[] = [];
    try {
      for (const file of Array.from(files)) {
        const match = file.name.match(/^(\d{1,2})(?:\s*[-_. ]|\.)/);
        const t = tracks.find((t) => t.id === Number(match?.[1]));
        if (!t) {
          problems.push(`${file.name}: 번호를 확인하세요`);
          continue;
        }
        try {
          await validate(file, ctx);
          await saveAudio(t, file);
          blobs.current.set(t.id, file);
          found.add(t.id);
          setReady([...found]);
        } catch {
          problems.push(`${t.displayNumber}: 재생 또는 저장 실패`);
        }
      }
      try {
        await navigator.storage?.persist?.();
      } catch {}
      setError(problems.join(" · "));
    } finally {
      await ctx.close();
      setLoading(false);
      busy.current = false;
    }
  }
  const track = tracks.find((t) => t.id === current),
    allReady = ready.length === 15;
  const showSetup = !allReady || setup;
  return (
    <div className="desktop">
      <div className="desktop-bar">
        <span>
          <Music2 size={15} />
          <strong>Music Finder</strong>
          <span className="bar-detail">함께 듣는 시간</span>
        </span>
        <span>
          {online ? "작은 멜로디, 큰 즐거움" : "오프라인 모드"}{" "}
          <Headphones size={15} />
        </span>
      </div>
      <main className="window">
        <header className="toolbar">
          <div className="traffic">
            <i />
            <i />
            <i />
          </div>
          <div className="nav">
            <button
              onClick={leave}
              disabled={current === null}
              aria-label="Finder로 돌아가기"
            >
              <ChevronLeft />
            </button>
            <ChevronRight className="muted" size={20} />
          </div>
          <div className="breadcrumb">
            <Folder size={18} />
            <span>음악을 찾아서</span>
            {track && (
              <>
                <span className="muted">/</span>
                <strong>{track.displayNumber}</strong>
              </>
            )}
          </div>
          <div className="toolbar-end">
            <Grid2X2 size={18} />
            <span>15개의 음악</span>
          </div>
        </header>
        <div className="window-body">
          <aside>
            <div className="sidebar-label">즐겨찾기</div>
            <button
              className="side-item active"
              onClick={() => {
                if (current !== null) leave();
                setSetup(false);
              }}
            >
              <Music2 size={18} />
              음악 보관함<span>15</span>
            </button>
            <div className="sidebar-label second">이번 플레이</div>
            <div className="side-item">
              <Check size={17} />
              완료한 문제<span>{done.length}</span>
            </div>
            <div className="side-item">
              <Folder size={17} />
              남은 문제<span>{15 - done.length}</span>
            </div>
            <div className="sidebar-bottom">
              <div className="tiny-disc">♫</div>
              <p>
                멜로디를 듣고,
                <br />
                기억을 찾아보세요.
              </p>
              <div className="storage-pill">
                {allReady && swReady ? (
                  <HardDrive size={12} />
                ) : (
                  <Download size={12} />
                )}{" "}
                {allReady && swReady
                  ? "오프라인 준비 완료"
                  : `음원 준비 ${ready.length} / 15`}
              </div>
            </div>
          </aside>
          <section className="content">
            {showSetup && current === null ? (
              <div className="setup">
                <div className="eyebrow">BEFORE WE PLAY</div>
                <h1>
                  음악을 준비해요<span className="pencil-dot">♪</span>
                </h1>
                <p className="subtitle">
                  사용 권한이 있는 15곡을 이 기기에 담아주세요.
                </p>
                <div className="prep-count">
                  {String(ready.length).padStart(2, "0")}
                  <span> / 15</span>
                </div>
                <div className="progress">
                  <i style={{ width: `${(ready.length / 15) * 100}%` }} />
                </div>
                <p className="setup-status">
                  {loading
                    ? "음악을 확인하고 있어요…"
                    : allReady
                      ? "모든 음악이 준비됐어요."
                      : "아직 준비되지 않은 음악이 있어요."}
                </p>
                <label
                  className={`primary upload ${loading ? "disabled" : ""}`}
                >
                  <Download size={17} />
                  음원 파일 선택
                  <input
                    aria-label="음원 파일 선택"
                    type="file"
                    accept="audio/*,.mp3,.wav,.m4a,.ogg,.flac"
                    multiple
                    disabled={loading}
                    onChange={(e) => {
                      void importFiles(e.target.files);
                      e.target.value = "";
                    }}
                  />
                </label>
                <p className="local-note">
                  파일은 서버에 업로드되지 않고 이 브라우저에 저장됩니다.
                  <br />
                  <b>01 - 제목.mp3</b>처럼 문제 번호로 시작하는 파일을
                  선택하세요.
                </p>
                <div className="setup-list">
                  {tracks.map((t) => (
                    <div
                      key={t.id}
                      className={ready.includes(t.id) ? "prepared" : ""}
                    >
                      <span>{t.displayNumber}</span>
                      <span>
                        {t.artist} · {t.title}
                      </span>
                      {ready.includes(t.id) ? (
                        <Check size={15} />
                      ) : (
                        <span className="missing">미준비</span>
                      )}
                    </div>
                  ))}
                </div>
                <div className="setup-actions">
                  <button
                    className="text-button"
                    disabled={loading}
                    onClick={() => void prepare(tracks)}
                  >
                    준비 상태 다시 확인
                  </button>
                  {allReady && (
                    <button className="primary" onClick={() => setSetup(false)}>
                      보관함 열기 <ArrowUpRight size={16} />
                    </button>
                  )}
                </div>
                <p className="small">
                  진행자 준비 화면입니다. 참가자에게 화면을 공유하기 전에 준비를
                  마쳐주세요.
                </p>
              </div>
            ) : track ? (
              <div className="question">
                <div className="question-heading">
                  <div>
                    <div className="eyebrow">LISTEN CLOSELY</div>
                    <h1>어떤 음악일까요?</h1>
                  </div>
                  <span className="number-badge">
                    QUESTION {track.displayNumber}
                  </span>
                </div>
                <div className={`music-stage ${audioState}`}>
                  <div className="orbit orbit-one" />
                  <div className="orbit orbit-two" />
                  <div className="disc">
                    <div className="disc-center">
                      <Music2 size={35} />
                    </div>
                  </div>
                  <span className="floating-note note-one">♪</span>
                  <span className="floating-note note-two">♫</span>
                  <div className="sound-bars">
                    {Array.from({ length: 17 }, (_, i) => (
                      <i key={i} style={{ "--i": i } as React.CSSProperties} />
                    ))}
                  </div>
                </div>
                <div className="play-state" aria-live="polite">
                  {audioState === "preparing"
                    ? "잠깐, 귀를 기울여 주세요…"
                    : audioState === "playing"
                      ? "지금 음악이 흐르고 있어요"
                      : audioState === "paused"
                        ? "잠시 멈췄어요"
                        : "아래 파일을 골라 음악을 들어보세요"}
                </div>
                <div className="segment-progress">
                  <i style={{ width: `${fraction * 100}%` }} />
                </div>
                <div className="play-files">
                  {["1", "3", "5", "대표", "전곡"].map((label, i) => (
                    <button
                      key={label}
                      className={`play-file ${mode === label && audioState !== "idle" ? "selected" : ""}`}
                      disabled={
                        label === "대표" &&
                        seconds(track.highlightStart) === null
                      }
                      onClick={() => void play(label)}
                      aria-label={
                        label === "대표"
                          ? "대표 구간 3초"
                          : label === "전곡"
                            ? "전곡 재생"
                            : `${label}초 재생`
                      }
                    >
                      <FileIcon small color={i} />
                      <strong>{label}</strong>
                      <span>
                        {i < 3
                          ? `${label}초 듣기`
                          : i === 3
                            ? seconds(track.highlightStart) === null
                              ? "아직 미설정"
                              : "3초 듣기"
                            : "처음부터 끝까지"}
                      </span>
                    </button>
                  ))}
                </div>
                <div className="player-tools">
                  <button
                    onClick={() => void player.current?.toggle()}
                    disabled={audioState === "idle"}
                  >
                    {audioState === "paused" ? (
                      <Play size={15} />
                    ) : (
                      <Pause size={15} />
                    )}{" "}
                    {audioState === "paused" ? "이어서 듣기" : "잠시 멈춤"}
                  </button>
                  <button
                    onClick={() => {
                      selection.current++;
                      player.current?.stop();
                    }}
                    disabled={audioState === "idle"}
                  >
                    <Square size={13} />
                    정지
                  </button>
                  <span>
                    1 · 3 · 5 · R · F / Space 재생·일시정지 / Esc 돌아가기
                  </span>
                </div>
              </div>
            ) : (
              <div className="library">
                <div className="library-heading">
                  <div className="eyebrow">A LITTLE MUSIC, A LOT OF JOY</div>
                  <h1>
                    음악을 찾아서<span className="pencil-dot">♫</span>
                  </h1>
                  <p className="subtitle">
                    익숙한 멜로디, 몇 초 만에 알아챌 수 있나요?
                  </p>
                  <div className="handline" />
                </div>
                <div className="section-line">
                  <span>
                    <Folder size={16} /> 오늘의 플레이리스트
                  </span>
                  <span>15개의 작은 음악 퀴즈</span>
                </div>
                <div className="file-grid">
                  {tracks.map((t, i) => (
                    <button
                      className={`track-file ${done.includes(t.id) ? "completed" : ""}`}
                      key={t.id}
                      onClick={() => open(t.id)}
                      aria-label={`${t.displayNumber}번 문제${done.includes(t.id) ? " 완료" : ""}`}
                    >
                      <div className="file-wrap">
                        <FileIcon color={i % 5} />
                        {done.includes(t.id) && (
                          <span className="check-badge">
                            <Check size={13} />
                          </span>
                        )}
                      </div>
                      <strong>{t.displayNumber}</strong>
                      <span>
                        {done.includes(t.id) ? "다시 들어보기" : "음악 파일"}
                      </span>
                    </button>
                  ))}
                </div>
                <div className="library-bottom">
                  <span>어떤 번호부터 시작해도 좋아요.</span>
                  <span className="small-progress">
                    <i style={{ width: `${(done.length / 15) * 100}%` }} />
                  </span>
                  <strong>
                    {done.length}
                    <span> / 15</span>
                  </strong>
                </div>
              </div>
            )}
            {error && (
              <div role="alert" className="alert">
                {error}
                <button aria-label="오류 닫기" onClick={() => setError("")}>
                  <X size={14} />
                </button>
              </div>
            )}
            {notice && (
              <div role="status" className="notice">
                {notice}
              </div>
            )}
          </section>
        </div>
        <footer className="statusbar">
          <span>
            {current === null
              ? `${done.length}개 완료 · ${15 - done.length}개 남음`
              : `${track?.displayNumber}번 문제 · 돌아가면 자동 완료`}
          </span>
          <span className="footer-tools">
            {!online && <WifiOff size={13} />}
            <Volume2 size={13} />
            <span>소리를 켜주세요</span>
            {current === null && (
              <>
                <button aria-label="음원 관리" onClick={() => setSetup(!setup)}>
                  <Settings2 size={14} />
                </button>
                <button
                  aria-label="진행도 초기화"
                  onClick={() => setReset(true)}
                >
                  <RotateCcw size={14} />
                </button>
              </>
            )}
          </span>
        </footer>
      </main>
      <div className="desktop-caption">오늘의 기억에, 음악 한 조각.</div>
      {reset && (
        <div className="overlay">
          <div
            className="dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="reset-title"
          >
            <RotateCcw size={28} />
            <h2 id="reset-title">처음부터 다시 해볼까요?</h2>
            <p>
              완료한 문제 표시만 지워집니다.
              <br />곡 번호, 음원, 대표 구간은 그대로 유지돼요.
            </p>
            <div>
              <button autoFocus onClick={() => setReset(false)}>
                취소
              </button>
              <button
                className="primary"
                onClick={() => {
                  if (finishTimer.current !== null) {
                    clearTimeout(finishTimer.current);
                    finishTimer.current = null;
                  }
                  doneRef.current = [];
                  setDone([]);
                  try {
                    localStorage.removeItem(progressKey);
                  } catch {}
                  endingSeen.current = false;
                  setEnding("none");
                  setReset(false);
                }}
              >
                진행도 초기화
              </button>
            </div>
          </div>
        </div>
      )}
      {ending !== "none" && (
        <div
          className={`overlay ending ${ending}`}
          role="dialog"
          aria-modal="true"
        >
          <div className="ending-confetti">
            {Array.from({ length: 18 }, (_, i) => (
              <i key={i} style={{ "--i": i } as React.CSSProperties} />
            ))}
          </div>
          <div className="ending-inner">
            <div className="eyebrow">15 MELODIES, ONE LOVELY MOMENT</div>
            <div className="ending-icon">✧</div>
            <h2>{ending === "over" ? "GAME OVER" : "과연 승자는?"}</h2>
            <p>
              {ending === "over"
                ? "열다섯 곡의 여행이 끝났어요."
                : "이제, 당신의 순간입니다."}
            </p>
            {ending === "winner" && (
              <button onClick={() => setEnding("none")}>
                음악 보관함으로 <ArrowUpRight size={16} />
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
function FileIcon({
  small = false,
  color = 0,
}: {
  small?: boolean;
  color?: number;
}) {
  return (
    <div className={`file-icon color-${color} ${small ? "small-file" : ""}`}>
      <span className="fold" />
      <Music2 className="file-note" strokeWidth={1.6} />
      <div className="file-lines">
        <i />
        <i />
      </div>
      <span className="file-type">AUDIO</span>
    </div>
  );
}
createRoot(document.getElementById("root")!).render(<App />);
