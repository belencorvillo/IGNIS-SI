"""Record short 1080p clips of the IGNIS-SI UI, one per scene of the 30 s pitch video.

Usage (dev server running on :5173):
    python pitch/record_clips.py pitch/clips            # all clips
    python pitch/record_clips.py pitch/clips flame      # only clips whose name contains "flame"
    add --headed to watch the browser while it records.

Frames come from Chrome's screencast and are re-timed to a constant 30 fps MP4,
same approach as record_pitch.py.
"""
import asyncio, base64, io, sys, time
from pathlib import Path

import imageio.v2 as imageio
import numpy as np
from PIL import Image
from playwright.async_api import async_playwright

URL = "http://localhost:5173/"
W, H, FPS = 1920, 1080, 30
ARGS = [a for a in sys.argv[1:] if not a.startswith("--")]
OUT_DIR = Path(ARGS[0] if ARGS else "pitch/clips")
ONLY = ARGS[1] if len(ARGS) > 1 else ""
HEADLESS = "--headed" not in sys.argv

CURSOR_JS = """
(() => {
  if (document.getElementById('__cursor')) return;
  const c = document.createElement('div');
  c.id = '__cursor';
  Object.assign(c.style, {position:'fixed', left:'0px', top:'0px', width:'22px', height:'22px', marginLeft:'-11px', marginTop:'-11px',
    borderRadius:'50%', background:'rgba(242,239,233,0.9)', boxShadow:'0 0 0 2px rgba(8,9,12,0.6), 0 4px 14px rgba(0,0,0,0.5)',
    zIndex: 2147483647, pointerEvents:'none', transition:'transform 120ms ease', transform:'translate(-100px,-100px)'});
  document.body.appendChild(c);
  let x=-100, y=-100;
  addEventListener('mousemove', e => { x=e.clientX; y=e.clientY; c.style.transform = `translate(${x}px,${y}px)`; }, true);
  addEventListener('mousedown', () => { c.style.transform = `translate(${x}px,${y}px) scale(0.75)`; }, true);
  addEventListener('mouseup', () => { c.style.transform = `translate(${x}px,${y}px)`; }, true);
})();
"""


class Take:
    """Mouse helper that remembers where the cursor is."""

    def __init__(self, page, t0):
        self.page, self.t0 = page, t0
        self.x, self.y = W * 0.55, H * 0.62

    async def glide(self, x, y, secs=0.4, down=False):
        x0, y0, start = self.x, self.y, time.perf_counter()
        if down:
            await self.page.mouse.down()
        while True:
            t = min(1.0, (time.perf_counter() - start) / secs)
            e = t * t * (3 - 2 * t)
            await self.page.mouse.move(x0 + (x - x0) * e, y0 + (y - y0) * e)
            if t >= 1.0:
                break
            await asyncio.sleep(0.008)
        if down:
            await self.page.mouse.up()
        self.x, self.y = x, y

    async def click(self, loc, secs=0.35):
        b = await loc.bounding_box()
        await self.glide(b["x"] + b["width"] / 2, b["y"] + b["height"] / 2, secs)
        await self.page.mouse.click(self.x, self.y)

    async def slide(self, loc, value, secs=0.8):
        """Drag a range input from its current value to `value`."""
        b = await loc.bounding_box()
        lo, hi = float(await loc.get_attribute("min")), float(await loc.get_attribute("max"))
        xs = lambda v: b["x"] + 8 + (b["width"] - 16) * (v - lo) / (hi - lo)
        y = b["y"] + b["height"] / 2
        await self.glide(xs(float(await loc.input_value())), y, 0.35)
        await self.page.mouse.down()
        await self.glide(xs(value), y, secs)
        await self.page.mouse.up()

    async def until(self, at):
        while time.perf_counter() - self.t0 < at:
            await asyncio.sleep(0.005)


async def record(ctx, page, name, secs, action):
    """Screencast `page` while `action(take)` runs, then write OUT_DIR/name.mp4 lasting `secs`."""
    await page.evaluate(CURSOR_JS)
    await page.add_style_tag(content="*{user-select:none!important}")  # drags must not highlight text
    cdp = await ctx.new_cdp_session(page)
    frames, on = [], {"v": True}

    async def ack(sid):
        try:
            await cdp.send("Page.screencastFrameAck", {"sessionId": sid})
        except Exception:
            pass

    def on_frame(f):
        if on["v"]:
            frames.append((time.perf_counter(), f["data"]))
            asyncio.ensure_future(ack(f["sessionId"]))

    cdp.on("Page.screencastFrame", on_frame)
    await cdp.send("Page.startScreencast", {"format": "jpeg", "quality": 92, "maxWidth": W, "maxHeight": H, "everyNthFrame": 1})
    t0 = time.perf_counter()
    take = Take(page, t0)
    await page.mouse.move(take.x, take.y)
    await action(take)
    await take.until(secs)
    on["v"] = False
    await cdp.send("Page.stopScreencast")
    await cdp.detach()

    frames = [(t - t0, d) for t, d in frames]
    if not frames:
        raise RuntimeError(f"{name}: no frames captured")
    out = OUT_DIR / f"{name}.mp4"
    writer = imageio.get_writer(str(out), fps=FPS, codec="libx264", quality=9, pixelformat="yuv420p", macro_block_size=8)
    j, last = 0, frames[0][1]
    for k in range(int(secs * FPS)):
        while j < len(frames) and frames[j][0] <= k / FPS:
            last = frames[j][1]
            j += 1
        img = Image.open(io.BytesIO(base64.b64decode(last))).convert("RGB")
        if img.size != (W, H):
            img = img.resize((W, H), Image.LANCZOS)
        writer.append_data(np.asarray(img))
    writer.close()
    print(f"wrote {out}  ({len(frames)} frames, ~{len(frames) / secs:.0f} fps captured)")


# ── Scene helpers ────────────────────────────────────────────────────────────

def scene(page):
    return page.get_by_role("radiogroup", name="Scene")


def gravity(page):
    return page.get_by_role("radiogroup", name="Gravity level")


def slider(page, label):
    return page.get_by_label(label).locator("visible=true").first


async def tab(page, name):
    await page.get_by_role("button", name=name, exact=True).first.click()
    await page.evaluate("window.scrollTo(0,0)")


async def warm_simulator(page):
    """Load every 3D model once so nothing pops in during a take."""
    await tab(page, "Simulator")
    for name, wait in (("Habitat", 6), ("Flame", 3), ("Cabin", 5)):
        await scene(page).get_by_role("radio", name=name).click()
        await asyncio.sleep(wait)


# ── Clips ────────────────────────────────────────────────────────────────────

async def clip_cabin_fire(ctx, page):
    """Cabin at ISS air → crank oxygen and drop pressure: the cabin goes critical (red glow)."""
    await warm_simulator(page)
    await page.evaluate("window.scrollTo(0,0)")
    await asyncio.sleep(1)

    async def act(t):
        await t.until(0.6)
        await t.slide(slider(page, "Oxygen concentration"), 50, 1.1)
        await t.slide(slider(page, "Cabin pressure"), 8.2, 0.7)
        await t.glide(W * 0.33, H * 0.58, 0.5)
        await page.mouse.click(t.x, t.y)  # "click scene to zoom": push in on the burning cabin

    await record(ctx, page, "01_sim_cabin_fire", 6.0, act)


async def clip_mars(ctx, page):
    """Mars habitat, already loaded (no black frame), with a slow camera orbit."""
    await scene(page).get_by_role("radio", name="Habitat").click()
    await asyncio.sleep(1)
    mars = page.get_by_role("radiogroup", name="Surface").get_by_role("radio", name="Mars")
    if await mars.count():
        await mars.click()
    await asyncio.sleep(4)

    async def act(t):
        await t.glide(W * 0.30, H * 0.70, 0.3)
        await t.glide(W * 0.40, H * 0.68, 2.6, down=True)

    await record(ctx, page, "02_sim_mars", 3.5, act)


async def clip_flame_1g_to_0g(ctx, page):
    """Flame at 1g with airflow (teardrop that leans in the wind) → drop to 0g: blue sphere."""
    await scene(page).get_by_role("radio", name="Flame").click()
    await asyncio.sleep(1)
    await slider(page, "Oxygen concentration").fill("21")
    await slider(page, "Cabin pressure").fill("14.7")
    await gravity(page).get_by_role("radio", name="1.0g", exact=True).click()
    await asyncio.sleep(2)

    async def act(t):
        await t.until(0.3)
        await t.slide(slider(page, "Forced airflow"), 22, 1.0)
        await t.until(2.4)
        await t.click(gravity(page).get_by_role("radio", name="0g", exact=True), 0.4)
        await asyncio.sleep(0.6)
        await t.slide(slider(page, "Forced airflow"), 0, 0.9)  # still air: the flame becomes a sphere
        await t.glide(W * 0.33, H * 0.62, 0.6)

    await record(ctx, page, "03_sim_flame_1g_to_0g", 7.0, act)


async def clip_library(ctx, page):
    """Library knowledge graph → open FLEX (PSI-69), where the YOLO video lives."""
    await tab(page, "Library")
    await asyncio.sleep(5)

    async def act(t):
        await t.until(0.3)
        # Orbit the knowledge graph a little.
        await t.glide(W * 0.40, H * 0.62, 0.4)
        await t.glide(W * 0.52, H * 0.56, 1.2, down=True)
        await t.until(1.9)
        await t.click(page.get_by_role("link", name="See all investigations").first, 0.5)
        await asyncio.sleep(0.9)
        lst = page.locator('[aria-controls="investigation-list"][aria-expanded="false"]')
        if await lst.count():
            await t.click(lst.first, 0.4)
            await asyncio.sleep(0.5)
        flex = page.get_by_role("button", name="Flame Extinguishment Experiment", exact=True).first
        await flex.scroll_into_view_if_needed()
        await asyncio.sleep(0.4)
        await t.click(flex, 0.45)

    await record(ctx, page, "04_library_flex", 7.0, act)


async def clip_applications(ctx, page):
    """Applications: spin the Earth, open a next-gen application, then flip to 'On Earth'."""
    await page.keyboard.press("Escape")
    await tab(page, "Applications")
    await asyncio.sleep(5)

    async def act(t):
        await t.until(0.3)
        await t.glide(W * 0.40, H * 0.66, 0.4)
        await t.glide(W * 0.50, H * 0.62, 1.0, down=True)  # spin the globe
        await t.click(page.get_by_role("radiogroup", name="Application block").get_by_role("radio", name="On Earth"), 0.5)
        await t.until(3.0)
        btns = page.locator("button[data-app]")
        if await btns.count():
            await t.click(btns.first, 0.5)

    await record(ctx, page, "05_applications", 6.5, act)


CLIPS = [clip_cabin_fire, clip_mars, clip_flame_1g_to_0g, clip_library, clip_applications]


async def main():
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    async with async_playwright() as p:
        browser = await p.chromium.launch(channel="chrome", headless=HEADLESS,
                                          args=["--ignore-gpu-blocklist", "--enable-gpu-rasterization", f"--window-size={W},{H + 140}"])
        ctx = await browser.new_context(viewport={"width": W, "height": H}, device_scale_factor=1, color_scheme="dark")
        page = await ctx.new_page()
        await page.goto(URL, wait_until="networkidle")
        for clip in CLIPS:
            if ONLY in clip.__name__:
                print("recording", clip.__name__)
                await clip(ctx, page)
        await browser.close()


asyncio.run(main())
