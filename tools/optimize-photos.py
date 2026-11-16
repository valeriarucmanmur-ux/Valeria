# Re-encode app/photos/*.jpg as progressive JPEG q80 (max 1600 px wide) to keep the app light.
import os, sys
from PIL import Image
d = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "app", "photos")
before = after = 0
for f in sorted(os.listdir(d)):
    if not f.endswith(".jpg"): continue
    p = os.path.join(d, f); before += os.path.getsize(p)
    im = Image.open(p).convert("RGB")
    if im.width > 1600: im = im.resize((1600, round(im.height * 1600 / im.width)), Image.LANCZOS)
    im.save(p, quality=80, optimize=True, progressive=True); after += os.path.getsize(p)
print(f"photos: {before/1048576:.1f} MB -> {after/1048576:.1f} MB")
