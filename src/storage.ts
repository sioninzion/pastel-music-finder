export interface Track {id:number;displayNumber:string;artist:string;title:string;youtubeUrl:string;audioFile:string;audioVersion:string;highlightStart:number|string|null;highlightDuration:3}
export const CACHE='music-finder-audio-v1';
export const progressKey='music-finder-progress-v1';
export function seconds(value:number|string|null):number|null{if(value===null)return null;if(typeof value==='number')return Number.isFinite(value)&&value>=0?value:null;const parts=value.split(':');if(parts.length===2&&/^\d+$/.test(parts[0])&&/^\d{1,2}(\.\d+)?$/.test(parts[1])&&+parts[1]<60)return +parts[0]*60 + +parts[1];if(/^\d+(\.\d+)?$/.test(value))return +value;return null;}
export function audioUrl(t:Track){return new URL(`${import.meta.env.BASE_URL}${t.audioFile}?v=${encodeURIComponent(t.audioVersion)}`,location.origin).href;}
export async function cached(t:Track){return (await caches.open(CACHE)).match(audioUrl(t));}
export async function saveAudio(t:Track,blob:Blob){await(await caches.open(CACHE)).put(audioUrl(t),new Response(blob,{headers:{'Content-Type':blob.type||'application/octet-stream'}}));}
export async function validate(blob:Blob,ctx:AudioContext){if(blob.size===0)throw Error('빈 음원 파일');const buffer=await ctx.decodeAudioData(await blob.arrayBuffer());if(buffer.duration<5)throw Error('5초 이상의 음원이 필요합니다.');}
export function readProgress():number[]{try{const a=JSON.parse(localStorage.getItem(progressKey)||'[]');return Array.isArray(a)?[...new Set(a.filter(v=>Number.isInteger(v)&&v>=1&&v<=15))]:[];}catch{return [];}}
