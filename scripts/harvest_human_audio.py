#!/usr/bin/env python
"""HUMAN-AUDIO-01: harvest real human Albanian audio (private study use only).

Sources
  A  Wikimedia Commons / Lingua Libre (sqi) and Sq-* pronunciation files
  B  Loecsen Albanian vocabulary (https://www.loecsen.com/en/vocabulary-albanian)
  C  50LANGUAGES / book2 Albanian phrasebook lessons
  D  LingoHut Albanian (best effort; skipped if the site exposes no audio)

Output
  audio/human/<word>.mp3            single words (also copied to audio/words/)
  audio/human/<slug>.mp3            Commons sentences
  audio/human/loecsen/*.mp3         Loecsen clips
  audio/human/50languages/*.mp3     50LANGUAGES clips
  human_corpus_index.json           one entry per clip
  human.js, sources.js              registrations (existing entries are kept)

Every clip is converted to mono 44.1 kHz mp3 and loudness-normalized to -16 LUFS.
Needs ffmpeg on PATH, or `pip install imageio-ffmpeg` inside .venv (not part of the app).
Run:  python scripts/harvest_human_audio.py   (re-runnable; downloads are cached in temp_harvest/)
"""
import html
import json
import os
import re
import shutil
import subprocess
import sys
import threading
import time
import unicodedata
import urllib.parse
import urllib.request
from concurrent.futures import ThreadPoolExecutor

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
HUMAN = os.path.join(ROOT, "audio", "human")
WORDS = os.path.join(ROOT, "audio", "words")
CACHE = os.path.join(ROOT, "temp_harvest")  # matches .gitignore temp_*/
UA_BROWSER = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36"
UA_COMMONS = "ShqipFeedHarvest/1.0 (private personal study; https://github.com/Wojcieszny/shqipfeed)"
AUDIO_EXT = (".wav", ".ogg", ".oga", ".mp3", ".flac", ".opus")

# Priority when several recordings exist for the same word/phrase (lower wins).
PRIORITY = {"commons": 0, "50languages": 1, "loecsen": 2, "lingohut": 3}


def find_ffmpeg():
    exe = shutil.which("ffmpeg")
    if exe:
        return exe
    try:
        import imageio_ffmpeg
        return imageio_ffmpeg.get_ffmpeg_exe()
    except Exception:
        return None


FFMPEG = find_ffmpeg()


_wm_lock = threading.Lock()
_wm_last = [0.0]


def wikimedia_throttle():
    """Wikimedia asks bots to go slow: one request at a time, >= 1.5 s apart."""
    with _wm_lock:
        wait = 1.5 - (time.time() - _wm_last[0])
        if wait > 0:
            time.sleep(wait)
        _wm_last[0] = time.time()


def http(url, ua=UA_BROWSER, tries=6, binary=False):
    last = None
    for i in range(tries):
        try:
            if "wikimedia.org" in url:
                wikimedia_throttle()
            req = urllib.request.Request(url, headers={"User-Agent": ua, "Accept-Language": "en"})
            data = urllib.request.urlopen(req, timeout=60).read()
            return data if binary else data.decode("utf-8", "replace")
        except Exception as err:  # retry with backoff (429 etc.)
            last = err
            time.sleep(30 * (i + 1) if '429' in str(err) else 1.5 * (i + 1))
    raise RuntimeError("%s: %s" % (url, last))


def nfc(text):
    return unicodedata.normalize("NFC", text)


def normalize_text(text):
    text = nfc(html.unescape(text)).lower()
    text = re.sub(r"[^\w\s\-']", " ", text, flags=re.UNICODE).replace("_", " ")
    text = text.replace("'", "").replace("â€™", "")
    return re.sub(r"\s+", " ", text).strip(" -")


def safe_name(text):
    text = nfc(text).lower().strip()
    text = re.sub(r'[<>:"/\\|?*\x00-\x1f]', "", text)
    text = re.sub(r"\s+", "-", text).strip(". -")
    return text[:90]


def kind_of(text):
    return "sentence" if len(normalize_text(text).split()) > 1 else "word"


def to_mp3(src_bytes, dest, tmp_name):
    """Convert any audio bytes to a normalized mp3. Returns True on success."""
    os.makedirs(os.path.dirname(dest), exist_ok=True)
    os.makedirs(CACHE, exist_ok=True)
    tmp = os.path.join(CACHE, "in_" + tmp_name)
    with open(tmp, "wb") as fh:
        fh.write(src_bytes)
    cmd = [FFMPEG, "-y", "-loglevel", "error", "-i", tmp,
           "-af", "loudnorm=I=-16:TP=-1.5:LRA=11", "-ar", "44100", "-ac", "1",
           "-codec:a", "libmp3lame", "-b:a", "48k", dest]
    res = subprocess.run(cmd, capture_output=True)
    try:
        os.remove(tmp)
    except OSError:
        pass
    return res.returncode == 0 and os.path.exists(dest) and os.path.getsize(dest) > 500


def cached(url, key, ua=UA_BROWSER):
    path = os.path.join(CACHE, "dl_" + key)
    if os.path.exists(path):
        with open(path, "rb") as fh:
            return fh.read()
    data = http(url, ua=ua, binary=True)
    os.makedirs(CACHE, exist_ok=True)
    with open(path, "wb") as fh:
        fh.write(data)
    return data


# ---------------------------------------------------------------- Source A
def commons_query(params):
    base = "https://commons.wikimedia.org/w/api.php"
    params = dict(params, action="query", format="json", prop="imageinfo",
                  iiprop="url|mime|user|extmetadata")
    out, cont = [], {}
    while True:
        q = dict(params, **cont)
        data = json.loads(http(base + "?" + urllib.parse.urlencode(q), ua=UA_COMMONS))
        out.extend(data.get("query", {}).get("pages", {}).values())
        if "continue" not in data:
            return out
        cont = data["continue"]
        time.sleep(0.2)


def commons_subcats(cat, depth=2):
    cats, frontier = [cat], [cat]
    for _ in range(depth):
        nxt = []
        for c in frontier:
            url = ("https://commons.wikimedia.org/w/api.php?action=query&list=categorymembers&format=json"
                   "&cmtype=subcat&cmlimit=500&cmtitle=" + urllib.parse.quote(c))
            for m in json.loads(http(url, ua=UA_COMMONS))["query"]["categorymembers"]:
                if m["title"] not in cats:
                    cats.append(m["title"])
                    nxt.append(m["title"])
        frontier = nxt
    return cats


def strip_tags(s):
    return re.sub(r"<[^>]+>", "", html.unescape(s or "")).strip()


def source_a():
    pages = {}
    cats = []
    for root in ("Category:Lingua_Libre_pronunciation-sqi", "Category:Albanian_pronunciation"):
        cats.extend(c for c in commons_subcats(root) if c not in cats)
    for cat in cats:
        for p in commons_query({"generator": "categorymembers", "gcmtitle": cat,
                                "gcmtype": "file", "gcmlimit": 50}):
            pages[p["title"]] = p
    for prefix in ("LL-Q8748 (sqi)-", "Sq-", "SQ-"):
        for p in commons_query({"generator": "allpages", "gapnamespace": 6,
                                "gapprefix": prefix, "gaplimit": 50}):
            pages[p["title"]] = p
    clips = []
    for title, p in pages.items():
        info = (p.get("imageinfo") or [None])[0]
        if not info or not title.lower().endswith(AUDIO_EXT):
            continue
        stem = re.sub(r"\.[A-Za-z0-9]+$", "", title[len("File:"):])
        meta = info.get("extmetadata", {})
        license_ = strip_tags(meta.get("LicenseShortName", {}).get("value")) or "see page"
        m = re.match(r"LL-Q\d+ \((\w+)\)-(.+?)-(.+)$", stem)
        if m:
            if m.group(1) != "sqi":
                continue
            speaker, text = m.group(2), m.group(3)
        elif re.match(r"(?i)sq-L\d+-", stem):
            # Sq-L<lexeme>-<word>-<Speaker>-<Speaker>.ogg
            parts = re.sub(r"(?i)^sq-L\d+-", "", stem).split("-")
            if len(parts) < 3:
                continue
            text, speaker = "-".join(parts[:-2]).replace("_", " "), parts[-2]
        elif re.match(r"(?i)sq-", stem):
            text = stem[3:].replace("_", " ")
            speaker = strip_tags(meta.get("Artist", {}).get("value")) or info.get("user") or "Wikimedia Commons"
            speaker = speaker[:40]
        else:
            continue
        text = nfc(text).strip()
        if not text:
            continue
        clips.append({"albanian": text, "english": "", "speaker": speaker, "source": "commons",
                      "license": license_, "url": info["url"],
                      "page": "https://commons.wikimedia.org/wiki/" + urllib.parse.quote(title.replace(" ", "_")),
                      "key": "c_" + safe_name(title)})
    return clips


# ---------------------------------------------------------------- Source B
def source_b():
    page = http("https://www.loecsen.com/en/vocabulary-albanian")
    clips, seen = [], set()
    row = re.compile(r'<td data-id="anglais[^"]*">(.*?)</td>\s*<td data-id="(albanais[^"]+\.mp3)"[^>]*>(.*?)</td>', re.S)
    for en, audio_id, sq in row.findall(page):
        if audio_id in seen:
            continue
        seen.add(audio_id)
        clean = lambda s: re.sub(r"\s+", " ", html.unescape(re.sub(r"<[^>]+>", "", s)).replace("\U0001f50a", "").replace("\xa0", " ")).strip()
        clips.append({"albanian": clean(sq), "english": clean(en), "speaker": "Loecsen native speaker",
                      "source": "loecsen", "license": "Loecsen, all rights reserved (private study only)",
                      "url": "https://www.loecsen.com/OrizonFlash_V2/ressources/son/" + audio_id,
                      "page": "https://www.loecsen.com/en/vocabulary-albanian",
                      "key": "l_" + audio_id})
    return clips


# ---------------------------------------------------------------- Source C
def source_c():
    index = http("https://50languages.com/en/learn/phrasebook/sq")
    lessons = sorted(set(re.findall(r"phrasebook-lessons/(\d+)/sq", index)), key=int)
    clips = []

    def one(lesson):
        url = "https://50languages.com/en/learn/phrasebook-lessons/%s/sq" % lesson
        page = http(url)
        topic = re.search(r'lesson-identity-title" dir="ltr">([^<]+)', page)
        out = []
        for tr in re.findall(r"<tr.*?</tr>", page, re.S):
            sq = re.search(r'id="visible_\d+"[^>]*>([^<]*)<', tr)
            en = re.search(r'class="nativee_txtt[^"]*"[^>]*>([^<]*)<', tr)
            off = re.search(r"offset=\\?'(\d+)'", tr)
            if not (sq and en and off):
                continue
            num = off.group(1)
            out.append({"albanian": html.unescape(sq.group(1)).strip(), "english": html.unescape(en.group(1)).strip(),
                        "speaker": "50LANGUAGES native speaker", "source": "50languages",
                        "license": "CC BY-NC-ND 4.0 (private study only)",
                        "url": "https://www.book2.nl/book2/SQ/SOUND/%s.mp3" % num, "page": url,
                        "topic": topic.group(1) if topic else "",
                        "key": "f_" + num})
        return out

    with ThreadPoolExecutor(4) as pool:
        for res in pool.map(one, lessons):
            clips.extend(res)
    return clips


# ---------------------------------------------------------------- Source D
def source_d():
    try:
        page = http("https://www.lingohut.com/en/l115/learn-albanian")
    except Exception as err:
        print("LingoHut unavailable:", err)
        return []
    links = sorted(set(re.findall(r'href="(/en/v\d+/[^"]+)"', page)))
    clips = []
    for link in links:
        try:
            lesson = http("https://www.lingohut.com" + link)
        except Exception:
            continue
        for mp3 in set(re.findall(r'(?:src|data-src|href)="([^"]+\.mp3)"', lesson)):
            clips.append({"albanian": "", "english": "", "speaker": "LingoHut native speaker", "source": "lingohut",
                          "license": "LingoHut (private study only)", "url": urllib.parse.urljoin("https://www.lingohut.com", mp3),
                          "page": "https://www.lingohut.com" + link, "key": "h_" + safe_name(mp3)})
    return clips


# ---------------------------------------------------------------- build
def main():
    if not FFMPEG:
        sys.exit("ffmpeg not found. Install ffmpeg or `pip install imageio-ffmpeg` in .venv.")
    print("ffmpeg:", FFMPEG)
    clips = []
    for name, fn in (("A commons", source_a), ("B loecsen", source_b), ("C 50languages", source_c), ("D lingohut", source_d)):
        try:
            got = fn()
        except Exception as err:
            print("source %s failed: %s" % (name, err))
            got = []
        print("source %s: %d clips found" % (name, len(got)))
        clips.extend(got)

    # Choose output paths. Best recording per normalized text wins the top-level word/phrase slot.
    clips = [c for c in clips if c["albanian"] and normalize_text(c["albanian"])]
    for c in clips:
        c["normalized_albanian"] = normalize_text(c["albanian"])
        c["kind"] = kind_of(c["albanian"])
    clips.sort(key=lambda c: (PRIORITY[c["source"]], 0 if "CC0" in c["license"] or "ublic" in c["license"] else 1, c["key"]))
    best, used = {}, set()
    for c in clips:
        n = c["normalized_albanian"]
        if n not in best:
            best[n] = c
            rel = "audio/human/%s.mp3" % safe_name(n)
        else:
            sub = {"commons": "", "loecsen": "loecsen/", "50languages": "50languages/", "lingohut": "lingohut/"}[c["source"]]
            rel = "audio/human/%s%s--%s.mp3" % (sub, safe_name(n), safe_name(c["speaker"] or c["source"]) if c["source"] == "commons" else c["key"][2:])
        while rel in used:
            rel = rel[:-4] + "-x.mp3"
        used.add(rel)
        c["file_path"] = rel
        c["is_best"] = best[n] is c

    def build(c):
        dest = os.path.join(ROOT, *c["file_path"].split("/"))
        try:
            data = cached(c["url"], c["key"], UA_COMMONS if c["source"] == "commons" else UA_BROWSER)
            return c if to_mp3(data, dest, c["key"]) else None
        except Exception as err:
            print("FAILED", c["url"], err)
            return None

    # Wikimedia is throttled (1 request / 1.5 s), so it runs in its own single worker
    # alongside the other sources instead of blocking them.
    wm = [c for c in clips if c["source"] == "commons"]
    rest = [c for c in clips if c["source"] != "commons"]
    with ThreadPoolExecutor(1) as wm_pool, ThreadPoolExecutor(6) as pool:
        f1 = wm_pool.map(build, wm)
        f2 = pool.map(build, rest)
        done = [c for c in list(f2) + list(f1) if c]
    print("converted: %d of %d" % (len(done), len(clips)))

    # human_corpus_index.json
    fields = ("albanian", "normalized_albanian", "english", "file_path", "speaker", "source", "license", "kind")
    index = [dict({f: c[f] for f in fields}, page=c["page"]) for c in done]
    index.sort(key=lambda e: (e["normalized_albanian"], e["file_path"]))
    with open(os.path.join(ROOT, "human_corpus_index.json"), "w", encoding="utf-8", newline="\n") as fh:
        json.dump(index, fh, ensure_ascii=False, indent=1)

    # audio/words: overwrite the synthetic file for every word that has a human recording
    existing = {nfc(f).lower(): f for f in os.listdir(WORDS)} if os.path.isdir(WORDS) else {}
    os.makedirs(WORDS, exist_ok=True)
    replaced = created = 0
    for c in done:
        if c["kind"] != "word" or not c["is_best"]:
            continue
        name = existing.get(nfc(safe_name(c["normalized_albanian"]) + ".mp3").lower())
        target = os.path.join(WORDS, name or (safe_name(c["normalized_albanian"]) + ".mp3"))
        shutil.copyfile(os.path.join(ROOT, *c["file_path"].split("/")), target)
        replaced, created = (replaced + 1, created) if name else (replaced, created + 1)
    print("audio/words: %d overwritten, %d new" % (replaced, created))

    # human.js / sources.js (existing entries kept, new ones added)
    hp = os.path.join(ROOT, "human.js")
    with open(hp, encoding="utf-8") as fh:
        human = json.loads(fh.read().split("=", 1)[1].strip().rstrip(";"))
    added = 0
    for c in done:
        if not c["is_best"]:
            continue
        key = c["normalized_albanian"]
        if key in human:
            continue
        human[key] = {"speaker": c["speaker"], "license": c["license"], "page": c["page"],
                      "word": c["albanian"], "source": c["source"], "file": c["file_path"]}
        added += 1
    with open(hp, "w", encoding="utf-8", newline="\n") as fh:
        fh.write("window.ShqipHuman = " + json.dumps(human, ensure_ascii=False) + ";\n")
    sp = os.path.join(ROOT, "sources.js")
    with open(sp, encoding="utf-8") as fh:
        src = json.loads(fh.read().split("=", 1)[1].strip().rstrip(";"))
    src["humanAudio"] = {c["normalized_albanian"]: {"file": c["file_path"], "speaker": c["speaker"], "source": c["source"],
                                                   "license": c["license"], "page": c["page"]}
                         for c in done if c["is_best"]}
    with open(sp, "w", encoding="utf-8", newline="\n") as fh:
        fh.write("window.ShqipSources = " + json.dumps(src, ensure_ascii=False) + ";\n")
    by = {}
    for c in done:
        by[c["source"]] = by.get(c["source"], 0) + 1
    print("human.js: %d new entries; clips by source: %s" % (added, by))
    print("words: %d, sentences: %d" % (sum(c["kind"] == "word" for c in done), sum(c["kind"] == "sentence" for c in done)))


if __name__ == "__main__":
    main()
