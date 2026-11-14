import asyncio
import json
import re
from pathlib import Path
from typing import Any

import httpx

CATALOG_FILE = Path(__file__).parent / "catalogo_crudo.json"
DOWNLOAD_DIR = Path(__file__).parent / "raw_downloads"

ALLOWED_EXTENSIONS = {".csv", ".xlsx", ".txt", ".pdf"}
MAX_SIZE_BYTES = 50 * 1024 * 1024  # 50 MB
MAX_CONCURRENT_DOWNLOADS = 5


def sanitize_filename(name: str) -> str:
    cleaned = re.sub(r'[<>:"/\\|?*]', "_", name).strip()
    return cleaned or "unnamed_file"


async def download_file(
    client: httpx.AsyncClient,
    semaphore: asyncio.Semaphore,
    psi_id: str,
    file_info: dict[str, Any],
) -> tuple[str, str]:
    url = file_info["url"]
    ext = file_info["extension"].lower()
    raw_name = file_info["filename"]
    if not raw_name.lower().endswith(ext):
        raw_name = f"{raw_name}{ext}"

    target_folder = DOWNLOAD_DIR / psi_id
    target_folder.mkdir(parents=True, exist_ok=True)
    target_path = target_folder / sanitize_filename(raw_name)

    if target_path.exists() and target_path.stat().st_size > 0:
        return ("SKIPPED", f"{psi_id}/{target_path.name} (ya existe)")

    async with semaphore:
        try:
            async with client.stream("GET", url, follow_redirects=True, timeout=60.0) as resp:
                resp.raise_for_status()

                content_length = resp.headers.get("Content-Length")
                if content_length and int(content_length) >= MAX_SIZE_BYTES:
                    return (
                        "IGNORED_SIZE",
                        f"{psi_id}/{target_path.name} ({int(content_length) / (1024**2):.1f} MB > 50 MB)",
                    )

                downloaded_bytes = 0
                with target_path.open("wb") as f:
                    async for chunk in resp.aiter_bytes(chunk_size=65536):
                        downloaded_bytes += len(chunk)
                        if downloaded_bytes >= MAX_SIZE_BYTES:
                            f.close()
                            target_path.unlink(missing_ok=True)
                            return (
                                "IGNORED_SIZE",
                                f"{psi_id}/{target_path.name} (abortado al superar 50 MB)",
                            )
                        f.write(chunk)

            return (
                "DOWNLOADED",
                f"{psi_id}/{target_path.name} ({downloaded_bytes / 1024:.1f} KB)",
            )
        except Exception as exc:
            target_path.unlink(missing_ok=True)
            return ("ERROR", f"{psi_id}/{target_path.name} -> {exc}")


async def main() -> None:
    if not CATALOG_FILE.exists():
        print(f"[ERROR] No existe {CATALOG_FILE}. Ejecuta primero 01_scrape_psi.py.")
        return

    catalog = json.loads(CATALOG_FILE.read_text(encoding="utf-8"))
    tasks = []
    semaphore = asyncio.Semaphore(MAX_CONCURRENT_DOWNLOADS)

    async with httpx.AsyncClient(
        headers={"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) IGNIS-SI-Downloader/1.0"}
    ) as client:
        for exp in catalog:
            psi_id = exp["psi_id"]
            for f in exp.get("files", []):
                ext = f.get("extension", "").lower()
                size_bytes = f.get("size_bytes")

                if ext not in ALLOWED_EXTENSIONS:
                    continue
                if size_bytes is not None and size_bytes >= MAX_SIZE_BYTES:
                    continue

                tasks.append(download_file(client, semaphore, psi_id, f))

        print(f"[INFO] Archivos candidatos (< 50 MB, formatos tabulares/PDF): {len(tasks)}")
        results = await asyncio.gather(*tasks)

    summary = {"DOWNLOADED": 0, "SKIPPED": 0, "IGNORED_SIZE": 0, "ERROR": 0}
    for status, msg in results:
        summary[status] += 1
        if status in {"DOWNLOADED", "ERROR"}:
            print(f"[{status}] {msg}")

    print("\n--- RESUMEN DE DESCARGA ---")
    for k, v in summary.items():
        print(f"  {k}: {v}")


if __name__ == "__main__":
    asyncio.run(main())