import asyncio
import json
import re
from pathlib import Path
from typing import Any
from urllib.parse import urljoin

import httpx
from bs4 import BeautifulSoup
from playwright.async_api import async_playwright

BASE_URL = "https://psi.nasa.gov"
REPO_URL = "https://psi.nasa.gov/physci/repo"
API_INVESTIGATION_URL = "https://psi.nasa.gov/geode-py/ws/repo/investigations/{psi_id}"
OUTPUT_FILE = Path(__file__).parent / "catalogo_crudo.json"


def clean_html(raw_html: str | None) -> str:
    """Elimina etiquetas HTML (<p>, <br>, etc.) que vienen en el JSON de la NASA."""
    if not raw_html:
        return ""
    text = BeautifulSoup(raw_html, "html.parser").get_text(" ", strip=True)
    return re.sub(r"\s+", " ", text).strip()


def format_size_label(size_bytes: int | None) -> str:
    if not size_bytes:
        return ""
    for unit in ["B", "KB", "MB", "GB", "TB"]:
        if size_bytes < 1024:
            return f"{size_bytes:.1f} {unit}" if unit != "B" else f"{size_bytes} B"
        size_bytes /= 1024
    return f"{size_bytes:.1f} PB"


def build_doi_citation(data: dict[str, Any]) -> str:
    """Construye la cita oficial completa con el DOI de NASA PSI."""
    doi = (data.get("doi") or "").strip()
    if not doi:
        return ""
    doi_url = doi if doi.startswith("http") else f"https://doi.org/{doi}"
    title = clean_html(data.get("title"))
    accession = data.get("accession", "")
    # Extraer investigador principal si existe
    contacts = data.get("contacts") or []
    pi_names = []
    for c in contacts:
        if isinstance(c, dict):
            name = f"{c.get('firstName', '')} {c.get('lastName', '')}".strip()
            if name:
                pi_names.append(name)
    authors = ", ".join(pi_names[:3]) if pi_names else "NASA Physical Sciences Informatics"
    return f"{authors}. {title} ({accession}). NASA Physical Sciences Informatics (PSI). {doi_url}"


def extract_files_from_api(data: dict[str, Any]) -> list[dict[str, Any]]:
    """Extrae todos los archivos reales del nodo 'added' del JSON de NASA PSI."""
    files: list[dict[str, Any]] = []
    seen_paths: set[str] = set()

    for item in data.get("added") or []:
        if not isinstance(item, dict):
            continue
        filename = (item.get("file_name") or "").strip()
        remote_url = (item.get("remote_url") or "").strip()
        if not filename or not remote_url or remote_url in seen_paths:
            continue

        seen_paths.add(remote_url)
        ext = Path(filename).suffix.lower()
        size_bytes = item.get("file_size")
        # En PSI, los ficheros del datamanager se sirven bajo /geode-py/ws/repo o raíz
        full_url = urljoin(BASE_URL, f"/geode-py/ws/repo{remote_url}" if remote_url.startswith("/datamanager") else remote_url)

        files.append(
            {
                "filename": filename,
                "url": full_url,
                "remote_path": item.get("remote_path", ""),
                "extension": ext,
                "size_label": format_size_label(size_bytes),
                "size_bytes": size_bytes,
            }
        )
    return files


async def get_all_psi_ids() -> list[str]:
    """Recorre las páginas del índice PSI para obtener todos los códigos PSI-XXX."""
    psi_ids: dict[str, None] = {}

    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        page = await browser.new_page()
        print("[INFO] Obteniendo índice de experimentos desde NASA PSI...")
        await page.goto(REPO_URL, wait_until="networkidle", timeout=60000)
        await page.wait_for_timeout(2000)

        page_num = 1
        while True:
            html = await page.content()
            for match in re.findall(r"/investigations/(PSI-\d+)", html, re.IGNORECASE):
                psi_ids[match.upper()] = None

            next_btn = page.locator(
                "button.mat-mdc-paginator-navigation-next, button.mat-paginator-navigation-next"
            ).first
            if await next_btn.count() > 0 and not await next_btn.is_disabled():
                await next_btn.click()
                await page.wait_for_load_state("networkidle")
                await page.wait_for_timeout(1200)
                page_num += 1
            else:
                break

        await browser.close()

    sorted_ids = sorted(psi_ids.keys(), key=lambda x: int(re.sub(r"\D", "", x) or 0))
    print(f"[OK] Total de fichas indexadas en PSI: {len(sorted_ids)}")
    return sorted_ids


async def fetch_investigation_api(
    client: httpx.AsyncClient, semaphore: asyncio.Semaphore, psi_id: str
) -> dict[str, Any] | None:
    """Consulta el endpoint JSON oficial de un PSI y filtra por Combustion Science."""
    url = API_INVESTIGATION_URL.format(psi_id=psi_id)
    async with semaphore:
        try:
            resp = await client.get(url, timeout=30.0)
            if resp.status_code != 200:
                return None
            data = resp.json()
        except Exception as exc:
            print(f"[WARN] Error consultando API de {psi_id}: {exc}")
            return None

    research_area = (data.get("researchArea") or "").strip()
    if "combustion" not in research_area.lower():
        return None

    files = extract_files_from_api(data)
    return {
        "psi_id": psi_id,
        "title": clean_html(data.get("title")) or psi_id,
        "psi_url": f"https://psi.nasa.gov/physci/repo/data/investigations/{psi_id}",
        "research_area": research_area,
        "sub_research_area": (data.get("subResearchArea") or "").strip(),
        "project_type": (data.get("projectType") or "Microgravity Investigation").strip(),
        "objectives": clean_html(data.get("objective")),
        "approach": clean_html(data.get("approach")),
        "doi": (data.get("doi") or "").strip(),
        "doi_citation": build_doi_citation(data),
        "files_count": len(files),
        "files": files,
    }


async def main() -> None:
    all_ids = await get_all_psi_ids()
    semaphore = asyncio.Semaphore(10)

    print("[INFO] Descargando metadatos JSON oficiales y filtrando por 'Combustion Science'...")
    async with httpx.AsyncClient(
        headers={"User-Agent": "IGNIS-SI-DataPipeline/1.0"}
    ) as client:
        tasks = [fetch_investigation_api(client, semaphore, pid) for pid in all_ids]
        results = await asyncio.gather(*tasks)

    combustion_records = [r for r in results if r is not None]
    combustion_records.sort(key=lambda x: int(re.sub(r"\D", "", x["psi_id"]) or 0))

    OUTPUT_FILE.write_text(
        json.dumps(combustion_records, indent=2, ensure_ascii=False),
        encoding="utf-8",
    )

    total_files = sum(r["files_count"] for r in combustion_records)
    with_doi = sum(1 for r in combustion_records if r["doi_citation"])
    print(f"\n[DONE] Guardados {len(combustion_records)} experimentos de Combustion Science en {OUTPUT_FILE}")
    print(f"       -> Con DOI oficial: {with_doi}/{len(combustion_records)}")
    print(f"       -> Archivos totales indexados: {total_files}")


if __name__ == "__main__":
    asyncio.run(main())