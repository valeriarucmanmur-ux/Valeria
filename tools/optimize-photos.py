# Re-encode app/photos/*.jpg as progressive JPEG (default: max 1600 px wide, q80).
# CI uses `--max 1200 --q 76` before building the phone apps to keep APK/IPA under GitHub's 100 MB file limit.
import os, sys
from PIL import Image
args = sys.argv[1:]
MAX = int(args[args.index("--max") + 1]) if "--max" in args else 1600
Q = int(args[args.index("--q") + 1]) if "--q" in args else 80
d = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "app", "photos")
before = after = 0
for f in sorted(os.listdir(d)):
    if not f.endswith(".jpg"): continue
    p = os.path.join(d, f); before += os.path.getsize(p)
    im = Image.open(p).convert("RGB")
    if im.width > MAX: im = im.resize((MAX, round(im.height * MAX / im.width)), Image.LANCZOS)
    im.save(p, quality=Q, optimize=True, progressive=True); after += os.path.getsize(p)
print(f"photos: {before/1048576:.1f} MB -> {after/1048576:.1f} MB")
