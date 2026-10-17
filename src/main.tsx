import React, { useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  Music2,
  ChevronLeft,
  ChevronRight,
  Grid2X2,
  Check,
  ArrowUpRight,
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
  Eye,
  LogOut,
  Volume1,
  Volume2,
  VolumeX,
  Maximize,
  Minimize,
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
    [answer, setAnswer] = useState(false),
    [volume, setVolume] = useState(() => {
      try {
        const v = Number(localStorage.getItem(volumeKey));
        return localStorage.getItem(volumeKey) !== null && Number.isFinite(v)
          ? Math.min(1, Math.max(0, v))
          : 1;
      } catch {
        return 1;
      }
    }),
    [muted, setMuted] = useState(false),
    [fullscreen, setFullscreen] = useState(false),
    [fraction, setFraction] = useState(0),
    [swReady, setSwReady] = useState(false),
    [online, setOnline] = useState(navigator.onLine);
  const [stage, setStage] = useState<"welcome" | "instructions" | "library">(
    () => {
      try {
        return sessionStorage.getItem("music-game-entered") === "1"
          ? "library"
          : "welcome";
      } catch {
        return "welcome";
      }
    },
  );
  const finishTimer = useRef<number | null>(null);
  const player = useRef<SegmentPlayer | null>(null),
    currentRef = useRef<number | null>(null),
    doneRef = useRef(done),
    blobs = useRef(new Map<number, Blob>()),
    endingSeen = useRef(done.length === 15),
    busy = useRef(false),
    selection = useRef(0),
    volumeRef = useRef(muted ? 0 : volume);
  useEffect(() => {
    volumeRef.current = muted ? 0 : volume;
    player.current?.setVolume(volumeRef.current);
    try {
      localStorage.setItem(volumeKey, String(volume));
    } catch {}
  }, [volume, muted]);
  useEffect(() => {
    document.getElementById("boot-fail")?.setAttribute("hidden", "");
    const sync = () => setFullscreen(document.fullscreenElement !== null);
    document.addEventListener("fullscreenchange", sync);
    return () => document.removeEventListener("fullscreenchange", sync);
  }, []);
  function toggleFullscreen() {
    if (document.fullscreenElement) void document.exitFullscreen();
    else
      void document.documentElement
        .requestFullscreen?.()
        .catch(() =>
          setNotice(
            "이 브라우저에서는 전체화면을 쓸 수 없어요. F11을 눌러주세요.",
          ),
        );
  }
  const getPlayer = () => {
    if (!player.current) {
      player.current = new SegmentPlayer();
      player.current.onState = setAudioState;
      player.current.setVolume(volumeRef.current);
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
      setAnswer(false);
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
    setAnswer(false);
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
      if ((e.target as HTMLElement).getAttribute?.("type") === "range") return;
      if (e.key === "ArrowUp" || e.key === "ArrowDown") {
        e.preventDefault();
        setMuted(false);
        setVolume(
          (v) =>
            Math.round(
              Math.min(1, Math.max(0, v + (e.key === "ArrowUp" ? 0.1 : -0.1))) *
                10,
            ) / 10,
        );
        return;
      }
      if (e.key.toLowerCase() === "m") {
        setMuted((m) => !m);
        return;
      }
      if (currentRef.current === null) return;
      const k = e.key.toLowerCase();
      if (["1", "3", "5", "r", "f", "a", " ", "escape"].includes(k))
        e.preventDefault();
      if (["1", "3", "5"].includes(k)) void play(k);
      else if (k === "r") void play("대표");
      else if (k === "f") void play("전곡");
      else if (k === "a") setAnswer(true);
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
  const fileInput = (
    <label className={`upload ${loading ? "disabled" : ""}`}>
      <Download size={16} />
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
  );
  return (
    <div className="desktop">
      <main className={`window ${stage}`}>
        <header className="toolbar">
          <div className="traffic" aria-hidden="true">
            <i />
            <i />
            <i />
          </div>
          <button
            className="back"
            onClick={() => {
              if (current !== null) leave();
              else if (stage === "instructions") setStage("welcome");
              else if (stage === "library") setStage("instructions");
            }}
            disabled={current === null && stage === "welcome"}
            aria-label="Finder로 돌아가기"
          >
            <ChevronLeft size={21} />
          </button>
          <div className="breadcrumb">
            <span>음악 맞추기 게임</span>
            {track && (
              <>
                <ChevronRight size={15} />
                <strong>{track.displayNumber}</strong>
                {answer && (
                  <>
                    <ChevronRight size={15} />
                    <strong>정답</strong>
                  </>
                )}
              </>
            )}
          </div>
          <div className="toolbar-end">
            {stage === "library" && (
              <>
                <Grid2X2 size={17} />
                <span>15개</span>
              </>
            )}
            <button
              className="fullscreen"
              aria-label={fullscreen ? "전체화면 끝내기" : "전체화면"}
              title={fullscreen ? "전체화면 끝내기" : "전체화면"}
              onClick={toggleFullscreen}
            >
              {fullscreen ? <Minimize size={17} /> : <Maximize size={17} />}
            </button>
          </div>
        </header>
        <section className="content">
          {current === null && stage === "welcome" ? (
            <div className="welcome-screen">
              <div className="app-icon">
                <Music2 size={66} strokeWidth={1.7} />
              </div>
              <h1>음악 맞추기 게임</h1>
              <div className="ready-status" aria-live="polite">
                {loading
                  ? "음악 준비 중"
                  : allReady
                    ? "준비 완료"
                    : "음원 연결 필요"}
                <span>{ready.length} / 15</span>
              </div>
              <div className="progress">
                <i style={{ width: `${(ready.length / 15) * 100}%` }} />
              </div>
              <button
                className="primary start"
                onClick={() => setStage("instructions")}
              >
                시작 <ChevronRight size={18} />
              </button>
              {!allReady && <div className="welcome-import">{fileInput}</div>}
            </div>
          ) : current === null && stage === "instructions" ? (
            <div className="instructions-screen">
              <div className="instruction-icon">
                <Headphones size={38} />
              </div>
              <h1>게임 방법</h1>
              <ol>
                <li>
                  <span>1</span>
                  <div>
                    <strong>번호를 골라주세요.</strong>
                    <p>15개 파일 중 원하는 문제를 선택합니다.</p>
                  </div>
                </li>
                <li>
                  <span>2</span>
                  <div>
                    <strong>듣고, 노래를 맞혀주세요.</strong>
                    <p>1초 · 3초 · 5초 · 대표 구간 · 전곡</p>
                  </div>
                </li>
                <li>
                  <span>3</span>
                  <div>
                    <strong>다음 문제로 넘어갑니다.</strong>
                    <p>목록으로 돌아오면 자동으로 완료됩니다.</p>
                  </div>
                </li>
              </ol>
              <button
                className="primary"
                onClick={() => {
                  setStage("library");
                  try {
                    sessionStorage.setItem("music-game-entered", "1");
                  } catch {}
                }}
              >
                문제 선택 <ChevronRight size={18} />
              </button>
            </div>
          ) : track && answer ? (
            <div className="question answer-screen">
              <div className="question-heading">
                <h1>{track.displayNumber}</h1>
                <span>번 정답</span>
              </div>
              <div className={`music-stage ${audioState}`}>
                <div className="disc">
                  <div className="disc-center">
                    <Music2 size={52} />
                  </div>
                </div>
              </div>
              <div className="answer-card" aria-live="polite">
                <strong className="answer-title">{track.title}</strong>
                <span className="answer-artist">{track.artist}</span>
              </div>
              <div className="answer-actions">
                <button className="secondary" onClick={() => setAnswer(false)}>
                  <ChevronLeft size={17} /> 문제로
                </button>
                <button className="primary" onClick={leave} aria-label="나가기">
                  나가기 <LogOut size={16} />
                </button>
              </div>
              <div className="player-tools">
                <button
                  aria-label={
                    audioState === "paused" ? "이어서 듣기" : "일시정지"
                  }
                  onClick={() => void player.current?.toggle()}
                  disabled={audioState === "idle"}
                >
                  {audioState === "paused" ? (
                    <Play size={19} />
                  ) : (
                    <Pause size={19} />
                  )}
                </button>
                <button
                  aria-label="전곡 재생"
                  onClick={() => void play("전곡")}
                >
                  <Music2 size={17} />
                </button>
                <button
                  aria-label="정지"
                  onClick={() => {
                    selection.current++;
                    player.current?.stop();
                  }}
                  disabled={audioState === "idle"}
                >
                  <Square size={16} />
                </button>
              </div>
            </div>
          ) : track ? (
            <div className="question">
              <div className="question-heading">
                <h1>{track.displayNumber}</h1>
                <span>번 문제</span>
              </div>
              <div className={`music-stage ${audioState}`}>
                <div className="disc">
                  <div className="disc-center">
                    <Music2 size={52} />
                  </div>
                </div>
                <div className="sound-bars">
                  {Array.from({ length: 21 }, (_, i) => (
                    <i key={i} style={{ "--i": i } as React.CSSProperties} />
                  ))}
                </div>
              </div>
              <div className="play-state" aria-live="polite">
                {audioState === "preparing"
                  ? "준비 중"
                  : audioState === "playing"
                    ? "재생 중"
                    : audioState === "paused"
                      ? "일시정지"
                      : "재생 대기"}
              </div>
              <div className="segment-progress">
                <i style={{ width: `${fraction * 100}%` }} />
              </div>
              <div className="play-files">
                {["1", "3", "5", "대표", "전곡"].map((label) => (
                  <button
                    key={label}
                    className={`play-file ${mode === label && audioState !== "idle" ? "selected" : ""}`}
                    disabled={
                      label === "대표" && seconds(track.highlightStart) === null
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
                    <FileIcon small />
                    <strong>{label}</strong>
                  </button>
                ))}
              </div>
              <div className="player-tools">
                <button
                  aria-label={
                    audioState === "paused" ? "이어서 듣기" : "일시정지"
                  }
                  onClick={() => void player.current?.toggle()}
                  disabled={audioState === "idle"}
                >
                  {audioState === "paused" ? (
                    <Play size={19} />
                  ) : (
                    <Pause size={19} />
                  )}
                </button>
                <button
                  aria-label="정지"
                  onClick={() => {
                    selection.current++;
                    player.current?.stop();
                  }}
                  disabled={audioState === "idle"}
                >
                  <Square size={16} />
                </button>
                <button
                  className="reveal"
                  onClick={() => setAnswer(true)}
                  aria-label="정답 확인"
                >
                  <Eye size={16} /> 정답 확인
                </button>
              </div>
            </div>
          ) : (
            <div className="library-screen">
              <div className="library-heading">
                <h1>문제 선택</h1>
                <span>{done.length} / 15 완료</span>
              </div>
              <div className="file-grid">
                {tracks.map((t) => (
                  <button
                    className={`track-file ${done.includes(t.id) ? "completed" : ""}`}
                    key={t.id}
                    disabled={!allReady}
                    title={!allReady ? "음원을 먼저 연결해주세요" : undefined}
                    onClick={() => open(t.id)}
                    aria-label={`${t.displayNumber}번 문제${done.includes(t.id) ? " 완료" : ""}`}
                  >
                    <div className="file-wrap">
                      <FileIcon />
                      {done.includes(t.id) && (
                        <span className="check-badge">
                          <Check size={13} />
                        </span>
                      )}
                    </div>
                    <strong>{t.displayNumber}</strong>
                  </button>
                ))}
              </div>
              {!allReady && (
                <button
                  className="missing-audio"
                  onClick={() => setSetup(true)}
                >
                  음원 연결 필요 · {ready.length} / 15{" "}
                  <ChevronRight size={14} />
                </button>
              )}
            </div>
          )}
          {error && (
            <div role="alert" className="alert">
              {error}
              <button aria-label="오류 닫기" onClick={() => setError("")}>
                <X size={15} />
              </button>
            </div>
          )}
          {notice && (
            <div role="status" className="notice">
              {notice}
              <button aria-label="알림 닫기" onClick={() => setNotice("")}>
                <X size={15} />
              </button>
            </div>
          )}
        </section>
        <footer className="statusbar">
          <span>
            {current === null
              ? `${done.length}개 완료`
              : `${track?.displayNumber}번 문제`}
          </span>
          <span className="storage-pill">
            {allReady && swReady ? (
              <HardDrive size={13} />
            ) : (
              <Download size={13} />
            )}{" "}
            {allReady && swReady
              ? "오프라인 준비 완료"
              : `음원 ${ready.length} / 15`}
          </span>
          <div className="footer-tools">
            {!online && <WifiOff size={14} />}
            <div className="volume">
              <button
                aria-label={muted ? "음소거 해제" : "음소거"}
                onClick={() => setMuted((m) => !m)}
              >
                {muted || volume === 0 ? (
                  <VolumeX size={16} />
                ) : volume < 0.5 ? (
                  <Volume1 size={16} />
                ) : (
                  <Volume2 size={16} />
                )}
              </button>
              <input
                type="range"
                aria-label="음량"
                min={0}
                max={100}
                step={1}
                value={muted ? 0 : Math.round(volume * 100)}
                style={
                  {
                    "--fill": `${muted ? 0 : Math.round(volume * 100)}%`,
                  } as React.CSSProperties
                }
                onChange={(e) => {
                  setMuted(false);
                  setVolume(Number(e.target.value) / 100);
                }}
              />
              <span className="volume-value">
                {muted ? 0 : Math.round(volume * 100)}
              </span>
            </div>
            <button
              aria-label="음원 관리"
              onClick={() => setSetup(true)}
              disabled={current !== null}
            >
              <Settings2 size={16} />
            </button>
            <button
              aria-label="진행도 초기화"
              onClick={() => setReset(true)}
              disabled={current !== null}
            >
              <RotateCcw size={16} />
            </button>
          </div>
        </footer>
      </main>
      {setup && (
        <div className="overlay">
          <div
            className="dialog audio-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="audio-title"
          >
            <button
              className="close"
              aria-label="음원 관리 닫기"
              onClick={() => setSetup(false)}
            >
              <X size={20} />
            </button>
            <h2 id="audio-title">음원 관리</h2>
            <p>{ready.length} / 15 준비 완료</p>
            <div className="ready-grid">
              {tracks.map((t) => (
                <span
                  className={ready.includes(t.id) ? "ready" : ""}
                  key={t.id}
                >
                  {t.displayNumber}
                  {ready.includes(t.id) && <Check size={12} />}
                </span>
              ))}
            </div>
            {fileInput}
            <p className="file-hint">파일명: 01 - 제목.mp3</p>
            <button
              className="text-button"
              disabled={loading}
              onClick={() => void prepare(tracks)}
            >
              다시 확인
            </button>
          </div>
        </div>
      )}
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
            <div className="ending-icon">✧</div>
            <h2>{ending === "over" ? "GAME OVER" : "과연 승자는?"}</h2>

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
const volumeKey = "music-game-volume";
class Boundary extends React.Component<
  { children: React.ReactNode },
  { failed: string }
> {
  state = { failed: "" };
  static getDerivedStateFromError(e: unknown) {
    return { failed: e instanceof Error ? e.message : String(e) };
  }
  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <div className="crash">
        <h2>화면에 문제가 생겼어요</h2>
        <p>진행도와 음원은 그대로 있어요. 다시 불러오면 이어서 할 수 있어요.</p>
        <small>{this.state.failed}</small>
        <button className="primary" onClick={() => location.reload()}>
          다시 불러오기
        </button>
      </div>
    );
  }
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
createRoot(document.getElementById("root")!).render(
  <Boundary>
    <App />
  </Boundary>,
);
