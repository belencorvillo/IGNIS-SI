"""Procedural intro for the pitch video: black → finger snap → a blue spherical microgravity flame.

Renders a photographic-looking (not cartoon) flame: emission integrated through a thin spherical shell
(so the rim glows brighter, like real 0g diffusion flames), a faint inner soot shell, bloom, sensor
grain, black level, vignette and slight handheld drift. Audio (snap + ignition whoomp + room tail) is
synthesised too and muxed in.

Usage: python pitch/make_intro.py pitch/clips/00_intro_flame.mp4
"""
import sys
import wave
from pathlib import Path

import imageio.v2 as imageio
import imageio_ffmpeg
import numpy as np
from PIL import Image, ImageFilter

OUT = Path(sys.argv[1] if len(sys.argv) > 1 else "pitch/clips/00_intro_flame.mp4")
W, H, FPS = 1920, 1080, 30
RW, RH = 960, 540          # render resolution; upscaling softens it like real optics
DUR = 7.0                  # seconds
T_SNAP = 3.0               # black until the snap
SR = 48000
rng = np.random.default_rng(7)

# ── Video ────────────────────────────────────────────────────────────────────
yy, xx = np.mgrid[0:RH, 0:RW].astype(np.float32)


def smooth_field(seed, cells=(9, 16)):
    """Low-frequency random field in [-1, 1] at render resolution."""
    r = np.random.default_rng(seed).uniform(-1, 1, cells).astype(np.float32)
    img = Image.fromarray(((r + 1) * 127.5).astype(np.uint8)).resize((RW, RH), Image.BICUBIC)
    return np.asarray(img, np.float32) / 127.5 - 1


FIELDS = [smooth_field(s) for s in range(12)]


def turbulence(t, speed=1.6):
    """Slowly evolving texture: cross-fade between random fields."""
    u = t * speed
    i = int(u) % (len(FIELDS) - 1)
    f = u - int(u)
    f = f * f * (3 - 2 * f)
    return FIELDS[i] * (1 - f) + FIELDS[i + 1] * f


def shell(r, R, w):
    """Path length through a spherical shell of outer radius R and thickness w at projected radius r."""
    outer = np.sqrt(np.clip(R * R - r * r, 0, None))
    inner = np.sqrt(np.clip((R - w) ** 2 - r * r, 0, None))
    return 2 * (outer - inner)


def bloom(img, radius):
    out = np.empty_like(img)
    for c in range(3):
        ch = np.clip(img[..., c] * 255 / 4, 0, 255).astype(np.uint8)  # headroom: values up to 4.0
        out[..., c] = np.asarray(Image.fromarray(ch).filter(ImageFilter.GaussianBlur(radius)), np.float32) * 4 / 255
    return out


vignette = 1 - 0.55 * (((xx - RW / 2) / (RW / 2)) ** 2 + ((yy - RH / 2) / (RH / 2)) ** 2) ** 1.2
vignette = np.clip(vignette, 0.25, 1)[..., None]
theta = None


def frame(t):
    img = np.zeros((RH, RW, 3), np.float32)
    age = t - T_SNAP
    if age >= 0:
        # Handheld drift
        cx = RW / 2 + 3 * np.sin(t * 0.9) + 1.5 * np.sin(t * 2.3 + 1)
        cy = RH / 2 + 2.5 * np.sin(t * 0.7 + 2) + 1.2 * np.sin(t * 1.9)
        dx, dy = xx - cx, yy - cy
        r = np.sqrt(dx * dx + dy * dy)
        th = np.arctan2(dy, dx)

        # Growth: fast ignition, gentle overshoot, then slow breathing
        g = 1 - np.exp(-age / 0.13)
        grow = g * (1 + 0.06 * np.exp(-age / 0.5) * np.sin(age * 9))
        R0 = 132 * grow * (1 + 0.012 * np.sin(2 * np.pi * 0.6 * t))
        # Organic, non-perfect edge
        wob = sum(a * np.sin(k * th + p + t * s) for k, a, p, s in ((2, .010, 0, .7), (3, .006, 1, -1.1)))
        tex = turbulence(t)
        r_eff = r / (1 + wob + 0.008 * tex)
        R = max(R0, 1e-3)

        blue = shell(r_eff, R, 0.10 * R) / (0.6 * R)                  # main blue reaction shell
        violet = shell(r_eff, R * 1.03, 0.05 * R) / (0.5 * R)         # thin outer CH*/violet fringe
        soot = shell(r_eff, R * 0.55, 0.10 * R) / (0.6 * R)           # faint inner yellow soot shell
        core = np.exp(-(r / (0.07 * R + 1e-3)) ** 2)                  # burner / droplet glow

        flick = 1 + 0.10 * tex + 0.04 * np.sin(t * 13 + r * 0.05)
        lum = (0.55 + 0.45 * g) * flick
        img += blue[..., None] * np.array([0.08, 0.26, 1.00]) * 0.42 * lum[..., None]
        img += violet[..., None] * np.array([0.30, 0.20, 1.00]) * 0.12
        soot_amt = 0.10 * (0.6 + 0.4 * np.clip(turbulence(t + 5, 2.4), -1, 1)) * np.exp(-max(age - 0.4, 0) / 6)
        img += soot[..., None] * np.array([1.00, 0.55, 0.18]) * soot_amt[..., None]
        img += core[..., None] * np.array([0.6, 0.75, 1.0]) * 0.18 * g

        # Ignition spark: brief white-orange flash and embers
        if age < 0.35:
            k = np.exp(-age / 0.06)
            img += np.exp(-(r / 10) ** 2)[..., None] * np.array([1.0, 0.85, 0.6]) * 3.0 * k
            img += np.exp(-(r / 120) ** 2)[..., None] * np.array([1.0, 0.6, 0.3]) * 0.25 * k
            for i in range(14):
                ang = rng_sparks[i, 0]
                d = rng_sparks[i, 1] * age * 900
                sx, sy = cx + d * np.cos(ang), cy + d * np.sin(ang)
                img += np.exp(-((xx - sx) ** 2 + (yy - sy) ** 2) / 6)[..., None] * np.array([1.0, 0.7, 0.35]) * 2.0 * np.exp(-age / 0.08)

        img = bloom(img, 3) * 0.85 + img * 0.15          # slight defocus: no crisp vector edges
        img += 0.30 * bloom(img, 16) + 0.25 * bloom(img, 55)

    # Sensor: black level, grain, vignette, filmic tone map
    img = img * vignette
    img = 1 - np.exp(-img * 1.4)
    img += 0.012
    grain = rng.normal(0, 1, (RH, RW, 1)).astype(np.float32)
    img += grain * (0.010 + 0.025 * img)
    img = np.clip(img, 0, 1) ** (1 / 1.1)
    out = Image.fromarray((img * 255).astype(np.uint8)).resize((W, H), Image.LANCZOS)
    return np.asarray(out)


rng_sparks = np.column_stack([rng.uniform(0, 2 * np.pi, 14), rng.uniform(0.3, 1.0, 14)])

tmp_video = OUT.with_suffix(".noaudio.mp4")
writer = imageio.get_writer(str(tmp_video), fps=FPS, codec="libx264", quality=9, pixelformat="yuv420p", macro_block_size=8)
for k in range(int(DUR * FPS)):
    writer.append_data(frame(k / FPS))
writer.close()

# ── Audio ────────────────────────────────────────────────────────────────────
n = int(DUR * SR)
t = np.arange(n) / SR
audio = np.zeros(n)


def band(sig, lo, hi):
    f = np.fft.rfftfreq(len(sig), 1 / SR)
    S = np.fft.rfft(sig)
    S[(f < lo) | (f > hi)] = 0
    return np.fft.irfft(S, len(sig))


i0 = int(T_SNAP * SR)
# Snap: sharp skin click (2–6 kHz) + tiny low body
L = int(0.12 * SR)
tt = np.arange(L) / SR
click = band(rng.normal(0, 1, L), 1800, 7000) * np.exp(-tt / 0.012)
click += band(rng.normal(0, 1, L), 200, 900) * np.exp(-tt / 0.02) * 0.5
audio[i0:i0 + L] += click / np.abs(click).max() * 0.9

# Ignition whoomp: low air rush swelling in right after the snap
L = int(1.6 * SR)
tt = np.arange(L) / SR
env = (1 - np.exp(-tt / 0.04)) * np.exp(-tt / 0.45)
whoomp = band(rng.normal(0, 1, L), 40, 420) * env
j = i0 + int(0.03 * SR)
audio[j:j + L] += whoomp / np.abs(whoomp).max() * 0.55

# Quiet steady flame hiss
hiss = band(rng.normal(0, 1, n), 150, 2500)
hiss = hiss / np.abs(hiss).max() * 0.035 * np.clip((t - T_SNAP) / 0.3, 0, 1)
audio += hiss * (1 + 0.15 * np.sin(2 * np.pi * 0.6 * t))

# Small room / cabin tail
ir_len = int(0.5 * SR)
ir = rng.normal(0, 1, ir_len) * np.exp(-np.arange(ir_len) / SR / 0.12)
ir[0] = 25
wet = np.convolve(audio, ir)[:n]
audio = audio + 0.12 * wet / np.abs(wet).max() * np.abs(audio).max()
audio = audio / np.abs(audio).max() * 0.89
pcm = (audio * 32767).astype(np.int16)
stereo = np.column_stack([pcm, pcm]).ravel()

wav = OUT.with_suffix(".wav")
with wave.open(str(wav), "wb") as w:
    w.setnchannels(2)
    w.setsampwidth(2)
    w.setframerate(SR)
    w.writeframes(stereo.tobytes())

# ── Mux ──────────────────────────────────────────────────────────────────────
import subprocess

subprocess.run([imageio_ffmpeg.get_ffmpeg_exe(), "-loglevel", "error", "-y", "-i", str(tmp_video), "-i", str(wav),
                "-c:v", "copy", "-c:a", "aac", "-b:a", "192k", "-shortest", str(OUT)], check=True)
tmp_video.unlink()
print("wrote", OUT, "and", wav)
