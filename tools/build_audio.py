"""Turn audio/tracks.json into MP3 files with Microsoft neural voices (edge-tts) + ffmpeg.

Runs in GitHub Actions (see .github/workflows/deploy.yml). A track's file name is a hash of its
text, so only new or changed tracks are synthesized; the rest come from the Actions cache.
"""
import asyncio, json, os, subprocess, sys, tempfile

import edge_tts

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA = json.load(open(os.path.join(ROOT, "audio", "tracks.json"), encoding="utf-8"))
VOICE = DATA["voice"]
SEM = asyncio.Semaphore(int(os.environ.get("TTS_CONCURRENCY", "6")))


def merge(segs):
    """Join neighbouring segments of the same voice so we make fewer TTS calls."""
    out = []
    for kind, val in segs:
        if out and kind != "pause" and out[-1][0] == kind:
            out[-1][1] += " " + val
        elif out and kind == "pause" and out[-1][0] == "pause":
            out[-1][1] += val
        else:
            out.append([kind, val])
    return out


async def tts(text, voice, path):
    for attempt in range(5):
        try:
            async with SEM:
                await edge_tts.Communicate(text, voice, rate="-5%").save(path)
            if os.path.getsize(path) > 0:
                return
        except Exception as e:  # network hiccup: retry with backoff
            print(f"  retry {attempt + 1}: {e}", file=sys.stderr)
        await asyncio.sleep(2 ** attempt)
    raise RuntimeError(f"TTS failed: {text[:60]}")


def silence(sec, path):
    subprocess.run(["ffmpeg", "-loglevel", "error", "-y", "-f", "lavfi", "-i", "anullsrc=r=24000:cl=mono",
                    "-t", str(sec), "-c:a", "libmp3lame", "-b:a", "48k", path], check=True)


async def build(track):
    out = os.path.join(ROOT, track["file"])
    if os.path.exists(out) and os.path.getsize(out) > 0:
        return False
    with tempfile.TemporaryDirectory() as tmp:
        parts = []
        jobs = []
        for i, (kind, val) in enumerate(merge(track["segs"])):
            p = os.path.join(tmp, f"{i:04d}.mp3")
            parts.append(p)
            if kind == "pause":
                silence(val, p)
            else:
                jobs.append(tts(val, VOICE[kind], p))
        await asyncio.gather(*jobs)
        lst = os.path.join(tmp, "list.txt")
        with open(lst, "w") as f:
            f.writelines(f"file '{p}'\n" for p in parts)
        os.makedirs(os.path.dirname(out), exist_ok=True)
        # Re-encode so all parts share one format; mono 48 kbps keeps the files small for the phone.
        subprocess.run(["ffmpeg", "-loglevel", "error", "-y", "-f", "concat", "-safe", "0", "-i", lst,
                        "-ar", "24000", "-ac", "1", "-c:a", "libmp3lame", "-b:a", "48k",
                        "-metadata", f"title={track['title']}", "-metadata", "album=CCAR-F practice",
                        out], check=True)
    return True


async def main():
    tracks = DATA["tracks"]
    keep = {t["file"] for t in tracks}
    mp3dir = os.path.join(ROOT, "audio", "mp3")
    if os.path.isdir(mp3dir):  # drop files of tracks that no longer exist
        for name in os.listdir(mp3dir):
            if f"audio/mp3/{name}" not in keep:
                os.remove(os.path.join(mp3dir, name))
    done = 0

    async def one(t):
        nonlocal done
        if await build(t):
            done += 1
            print(f"[{done}] {t['title']}", flush=True)
            return 1
        return 0

    made = 0
    for k in range(0, len(tracks), 12):  # several tracks at once; SEM caps the TTS calls in flight
        made += sum(await asyncio.gather(*(one(t) for t in tracks[k:k + 12])))
    # Durations for the app ("~12 phút") are read from the finished files.
    dur = {}
    for t in tracks:
        f = os.path.join(ROOT, t["file"])
        if os.path.exists(f):
            out = subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", f],
                                 capture_output=True, text=True).stdout.strip()
            if out:
                dur[t["id"]] = round(float(out))
    json.dump(dur, open(os.path.join(ROOT, "audio", "durations.json"), "w"))
    print(f"done: {made} new, {len(tracks) - made} cached, {sum(dur.values()) // 60} min total")


asyncio.run(main())
