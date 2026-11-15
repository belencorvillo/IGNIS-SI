"""Record a ~7 s pitch clip of the IGNIS-SI Simulator by driving the real UI.

Cabin -> raise oxygen until the cabin hazard goes critical -> Mars habitat ->
flame -> "See relevant experiments" (ranking with matched PSI investigations).
Frames come from Chrome's screencast and are re-timed to a constant 30 fps MP4.
"""
import asyncio, base64, io, sys, time
from pathlib import Path

import imageio.v2 as imageio
import numpy as np
from PIL import Image
from playwright.async_api import async_playwright

URL = "http://localhost:5173/"
W, H = 1920, 1080
FPS = 30
OUT = Path(sys.argv[1])
HEADLESS = "--headed" not in sys.argv

CURSOR_JS = """
(() => {
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


async def glide(page, x0, y0, x1, y1, secs):
    """Move the mouse along a smoothstep path in real time (independent of per-move latency)."""
    start = time.perf_counter()
    while True:
        t = min(1.0, (time.perf_counter() - start) / secs)
        e = t * t * (3 - 2 * t)
        await page.mouse.move(x0 + (x1 - x0) * e, y0 + (y1 - y0) * e)
        if t >= 1.0:
            return
        await asyncio.sleep(0.008)


async def until(t0, at):
    """Sleep until `at` seconds after t0 (keeps the cut points on schedule)."""
    while time.perf_counter() - t0 < at:
        await asyncio.sleep(0.005)
    print(f"  mark {at:.2f}s (real {time.perf_counter() - t0:.2f}s)")


async def center(loc):
    b = await loc.bounding_box()
    return b["x"] + b["width"] / 2, b["y"] + b["height"] / 2


async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch(channel="chrome", headless=HEADLESS,
                                          args=["--ignore-gpu-blocklist", "--enable-gpu-rasterization", f"--window-size={W},{H + 140}"])
        ctx = await browser.new_context(viewport={"width": W, "height": H}, device_scale_factor=1, color_scheme="dark")
        page = await ctx.new_page()
        await page.goto(URL, wait_until="networkidle")
        scene = page.get_by_role("radiogroup", name="Scene")
        # Warm-up: load every 3D model once so nothing pops in during the take.
        for name, wait in (("Habitat", 6), ("Flame", 3), ("Cabin", 5)):
            await scene.get_by_role("radio", name=name).click()
            await asyncio.sleep(wait)
        await page.evaluate("window.scrollTo(0,0)")
        await page.evaluate(CURSOR_JS)
        await page.mouse.move(W * 0.55, H * 0.62)
        await asyncio.sleep(1)

        # ── Recording ──────────────────────────────────────────────────────
        cdp = await ctx.new_cdp_session(page)
        frames = []
        recording = {"on": True}

        async def ack(sid):
            try:
                await cdp.send("Page.screencastFrameAck", {"sessionId": sid})
            except Exception:
                pass

        def on_frame(f):
            if recording["on"]:
                frames.append((time.perf_counter(), f["data"]))
                asyncio.ensure_future(ack(f["sessionId"]))

        cdp.on("Page.screencastFrame", on_frame)
        await cdp.send("Page.startScreencast", {"format": "jpeg", "quality": 92, "maxWidth": W, "maxHeight": H, "everyNthFrame": 1})
        t0 = time.perf_counter()

        # 0.0–0.6  Cabin, still
        await until(t0, 0.6)

        # 0.7–2.3  Drag oxygen from 21% to 45%: the cabin hazard turns critical
        o2 = page.get_by_label("Oxygen concentration").locator("visible=true").first
        b = await o2.bounding_box()
        lo, hi = float(await o2.get_attribute("min")), float(await o2.get_attribute("max"))
        cur = float(await o2.input_value())
        xs = lambda v: b["x"] + 8 + (b["width"] - 16) * (v - lo) / (hi - lo)
        y = b["y"] + b["height"] / 2
        mx, my = W * 0.55, H * 0.62
        await glide(page, mx, my, xs(cur), y, 0.4)
        await page.mouse.down()
        await glide(page, xs(cur), y, xs(45), y, 0.8)
        await page.mouse.up()
        await until(t0, 2.4)

        # 2.3–3.9  Mars habitat
        hx, hy = await center(scene.get_by_role("radio", name="Habitat"))
        await glide(page, xs(45), y, hx, hy, 0.35)
        await page.mouse.click(hx, hy)
        await until(t0, 3.9)

        # 3.9–5.3  Flame
        fx, fy = await center(scene.get_by_role("radio", name="Flame"))
        await glide(page, hx, hy, fx, fy, 0.25)
        await page.mouse.click(fx, fy)
        await until(t0, 5.2)

        # 5.3–7.0  See the PSI investigations that match
        see = page.get_by_role("link", name="See relevant experiments").locator("visible=true").first
        sx, sy = await center(see)
        await glide(page, fx, fy, sx, sy, 0.3)
        await page.mouse.click(sx, sy)
        await until(t0, 7.05)

        recording["on"] = False
        await cdp.send("Page.stopScreencast")
        await asyncio.sleep(0.3)
        await browser.close()

    # ── Re-time to constant FPS and encode ───────────────────────────────────
    frames = [(t - t0, d) for t, d in frames if t >= t0 - 0.5]
    print(f"captured {len(frames)} frames, ~{len(frames) / 7:.1f} fps")
    writer = imageio.get_writer(str(OUT), fps=FPS, codec="libx264", quality=9, pixelformat="yuv420p", macro_block_size=8)
    j, last = 0, None
    for k in range(int(7 * FPS)):
        t = k / FPS
        while j < len(frames) and frames[j][0] <= t:
            last = frames[j][1]
            j += 1
        if last is None:
            last = frames[0][1]
        img = Image.open(io.BytesIO(base64.b64decode(last))).convert("RGB")
        if img.size != (W, H):
            img = img.resize((W, H), Image.LANCZOS)
        writer.append_data(np.asarray(img))
    writer.close()
    print("wrote", OUT)


asyncio.run(main())
