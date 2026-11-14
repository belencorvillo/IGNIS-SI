import json
import re
import sqlite3
from pathlib import Path
from typing import Dict, List, Literal, Optional, Set, Tuple
from pydantic import BaseModel, Field
import ollama

# Configuración del modelo local en Ollama y rutas
OLLAMA_MODEL = "qwen2.5:latest"  # También puedes usar "qwen2.5:7b"
DB_PATH = "psi_index.db"
DEFAULT_CATALOG_PATHS = ["catalogo_limpio_2.json", "catalogo_limpio.json"]

# =====================================================================
# 1. TAXONOMÍA CERRADA DE ETIQUETAS PERMITIDAS (INCLUYE IDs PSI)
# =====================================================================
AllowedTag = Literal[
    # Identificadores de Experimento (PSI IDs)
    "psi:PSI-10", "psi:PSI-20", "psi:PSI-21", "psi:PSI-22", "psi:PSI-23",
    "psi:PSI-25", "psi:PSI-26", "psi:PSI-39", "psi:PSI-47", "psi:PSI-60",
    "psi:PSI-62", "psi:PSI-68", "psi:PSI-69", "psi:PSI-98", "psi:PSI-99",
    "psi:PSI-100", "psi:PSI-101", "psi:PSI-102", "psi:PSI-106", "psi:PSI-107",
    "psi:PSI-115", "psi:PSI-117", "psi:PSI-142", "psi:PSI-159",
    # Tipo de proyecto y pilares
    "type:microgravity_investigation", "type:ground_investigation",
    "pillar:prevention", "pillar:detection", "pillar:suppression",
    # Hardware / Racks
    "rack:cir_acme", "rack:msg_spice", "rack:cir_mdca", "rack:saffire", "rack:ground_cfd", "rack:other",
    # Fase del combustible
    "phase:gaseous", "phase:solid", "phase:liquid_droplet", "phase:multi_phase",
    # Combustibles específicos
    "fuel:hydrocarbon_spacecraft_materials", "fuel:methane_ch4", "fuel:ethylene_c2h4",
    "fuel:propane_c3h8", "fuel:n_butane_c4h10", "fuel:n_pentane_c5h12",
    "fuel:n_heptane", "fuel:n_dodecane", "fuel:cotton_fiberglass_blend",
    "fuel:nomex", "fuel:pmma_acrylic",
    # Sensores
    "sensor:high_speed_optical_cameras", "sensor:optical_imaging", "sensor:radiometers",
    "sensor:thermocouples", "sensor:temperature_radiative_sensors",
    "sensor:photomultiplier_tubes_pmt", "sensor:laser_diagnostics",
    "sensor:aerosol_smoke_particle_counters", "sensor:3d_cfd_simulation_solver",
    # Condiciones ambientales (Envelope) y Gravedad
    "gravity:0g_microgravity", "gravity:1g_ground_reference", "gravity:partial_g_proxy",
    "env:hypoxic_low_o2", "env:normoxic_earth_o2", "env:hyperoxic_enriched_o2", "env:extreme_o2",
    "env:reduced_cabin_pressure", "env:standard_1atm_pressure",
    "env:quiescent_low_flow", "env:forced_convective_flow",
    "relevance:lunar_habitat",
    # Fenómenos físicos y visuales (Inferidos por el VLM/LLM)
    "phenom:spherical_diffusion_flame", "phenom:coflow_laminar_flame",
    "phenom:counterflow_flame", "phenom:cool_flame", "phenom:concurrent_flame_spread",
    "phenom:flame_liftoff_extinction", "phenom:large_scale_fire_growth",
    "phys:soot_formation_inception", "phys:smoke_aerosol_particulates",
    "phys:electric_field_chemi_ion", "phys:droplet_bicomponent_combustion",
    "phys:inert_gas_dilution_suppression", "phys:chemiluminescence_kinetics"
]

# Mapa de acrónimos oficiales de NASA PSI -> (frase expandida, PSI-IDs asociados)
PSI_ACRONYM_MAP: Dict[str, Tuple[str, List[str]]] = {
    "flex": ("flame extinguishment experiment", ["PSI-68", "PSI-69", "PSI-117", "PSI-142"]),
    "flex-2": ("flame extinguishment experiment 2", ["PSI-68"]),
    "flex2": ("flame extinguishment experiment 2", ["PSI-68"]),
    "bre": ("burning rate emulator", ["PSI-20"]),
    "bass": ("burning and suppression of solids", ["PSI-25", "PSI-26", "PSI-62"]),
    "bass-ii": ("burning and suppression of solids ii", ["PSI-25"]),
    "cfi": ("cool flames investigation", ["PSI-39", "PSI-159"]),
    "daft": ("dust and aerosol measurement feasibility test", ["PSI-47"]),
    "same": ("smoke aerosol measurement experiment", ["PSI-101", "PSI-102", "PSI-115"]),
    "same-r": ("smoke aerosol measurement experiment reflight", ["PSI-101"]),
    "slice": ("structure and liftoff in combustion experiment", ["PSI-106"]),
    "spice": ("smoke point in co-flow experiment", ["PSI-60", "PSI-107"]),
    "saffire": ("spacecraft fire safety experiment", ["PSI-98", "PSI-99", "PSI-100"]),
    "acme": ("advanced combustion via microgravity experiments", ["PSI-10", "PSI-20", "PSI-21", "PSI-22", "PSI-23", "PSI-159"]),
}

# Palabras vacías y términos genéricos del dominio (para evitar que "flame" sature todos los resultados)
STOPWORDS = {
    "the", "and", "for", "with", "from", "into", "using", "via", "that", "this",
    "are", "was", "were", "what", "how", "de", "la", "el", "los", "las", "en",
    "por", "para", "con", "del", "una", "uno", "datos", "busco", "buscar",
    "experimento", "experimentos", "experiment", "experiments", "psi"
}

GENERIC_DOMAIN_TERMS = {
    "flame", "flames", "microgravity", "combustion", "investigation",
    "study", "studies", "data", "test", "effect", "effects", "analysis"
}

# Esquema Pydantic para el LLM Indexador de archivos raw (Etapa 1)
class DocumentTaggingOutput(BaseModel):
    title: str = Field(description="Título corto o identificador del archivo/experimento")
    assigned_tags: List[AllowedTag] = Field(
        description="Lista de etiquetas únicas aplicables de la taxonomía (máximo 10)",
        max_length=10
    )
    technical_summary: str = Field(description="Resumen técnico de 1 frase en español del archivo")

# Esquema Pydantic para el LLM Buscador (Etapa 2)
class SearchQueryInference(BaseModel):
    required_tags: List[AllowedTag] = Field(
        description="Etiquetas críticas e indispensables que el usuario busca (peso alto, máx 5)",
        max_length=5
    )
    optional_tags: List[AllowedTag] = Field(
        description="Etiquetas relacionadas o complementarias que enriquecen la búsqueda (peso medio, máx 5)",
        max_length=5
    )
    reasoning: str = Field(description="Explicación breve en español de por qué se eligieron estas etiquetas")


# =====================================================================
# UTILIDADES PARA DETECTAR IDs PSI Y TOKENIZAR CONSULTAS
# =====================================================================
def extract_psi_ids_from_text(text: str) -> List[str]:
    """Detecta menciones como 'psi10', 'PSI-10', 'psi_10' o 'psi 10' y las normaliza a 'PSI-10'."""
    matches = re.findall(r"\bpsi[\s_-]*(\d+)\b", text, flags=re.IGNORECASE)
    seen = []
    for num in matches:
        norm_id = f"PSI-{num}"
        if norm_id not in seen:
            seen.append(norm_id)
    return seen


def extract_query_terms(user_query: str) -> Tuple[str, List[str], Dict[str, float]]:
    """
    Extrae:
      - normalized_phrase: consulta limpia en minúsculas
      - terms: lista de tokens relevantes (incluyendo expansiones de acrónimos)
      - acronym_psi_boosts: dict { 'PSI-68': 14.0, ... } si se detectan acrónimos oficiales
    """
    cleaned = re.sub(r"[^\w\s-]", " ", user_query.lower()).strip()
    cleaned = re.sub(r"\s+", " ", cleaned)
    raw_tokens = [t for t in cleaned.split() if len(t) >= 2 and t not in STOPWORDS]

    terms: List[str] = []
    acronym_psi_boosts: Dict[str, float] = {}

    for tok in raw_tokens:
        if tok not in terms:
            terms.append(tok)

        # Si el token tiene guion (ej. "co-flow" o "flex-2"), añadir también partes/versión unida
        if "-" in tok:
            joined = tok.replace("-", "")
            if len(joined) >= 2 and joined not in terms:
                terms.append(joined)
            for part in tok.split("-"):
                if len(part) >= 2 and part not in STOPWORDS and part not in terms:
                    terms.append(part)

        # Comprobar si es un acrónimo oficial de NASA PSI (ej. "flex", "bre", "bass", "slice", etc.)
        if tok in PSI_ACRONYM_MAP:
            expanded_phrase, psi_ids = PSI_ACRONYM_MAP[tok]
            for pid in psi_ids:
                acronym_psi_boosts[pid] = max(acronym_psi_boosts.get(pid, 0.0), 14.0)
            for exp_tok in expanded_phrase.split():
                if len(exp_tok) >= 2 and exp_tok not in STOPWORDS and exp_tok not in terms:
                    terms.append(exp_tok)

    return cleaned, terms, acronym_psi_boosts


# =====================================================================
# 2. BASE DE DATOS INDEXADA (SQLite con Separación de Archivos y Catálogo)
# =====================================================================
def init_db():
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS documents (
            doc_id TEXT PRIMARY KEY,
            doc_type TEXT DEFAULT 'raw_file', -- 'raw_file' o 'catalog_experiment'
            title TEXT,
            raw_content TEXT,
            summary TEXT,
            metadata_json TEXT
        )
    """)
    existing_cols = [row[1] for row in cursor.execute("PRAGMA table_info(documents)").fetchall()]
    if "doc_type" not in existing_cols:
        cursor.execute("ALTER TABLE documents ADD COLUMN doc_type TEXT DEFAULT 'raw_file'")
    if "metadata_json" not in existing_cols:
        cursor.execute("ALTER TABLE documents ADD COLUMN metadata_json TEXT")

    cursor.execute("""
        CREATE TABLE IF NOT EXISTS document_tags (
            doc_id TEXT,
            tag TEXT,
            PRIMARY KEY (doc_id, tag),
            FOREIGN KEY (doc_id) REFERENCES documents(doc_id)
        )
    """)
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_tag ON document_tags(tag)")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_doc_type ON documents(doc_type)")
    conn.commit()
    conn.close()


def save_to_db(
    doc_id: str,
    title: str,
    raw_content: str,
    summary: str,
    tags: List[str],
    doc_type: str = "raw_file",
    metadata: Optional[dict] = None
):
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    meta_str = json.dumps(metadata, ensure_ascii=False) if metadata else None
    cursor.execute("""
        INSERT OR REPLACE INTO documents (doc_id, doc_type, title, raw_content, summary, metadata_json)
        VALUES (?, ?, ?, ?, ?, ?)
    """, (doc_id, doc_type, title, raw_content, summary, meta_str))

    cursor.execute("DELETE FROM document_tags WHERE doc_id = ?", (doc_id,))
    for tag in set(tags):
        cursor.execute("INSERT INTO document_tags (doc_id, tag) VALUES (?, ?)", (doc_id, tag))

    conn.commit()
    conn.close()


# =====================================================================
# 3. ETAPA 1A: INDEXAR CATÁLOGO JSON OFICIAL (100% EXACTO Y DETERMINISTA)
# =====================================================================
def extract_tags_from_catalog_entry(entry: dict) -> List[str]:
    """Extrae todas las etiquetas exactas de un registro de catalogo_limpio.json."""
    tags = set()

    psi_id = entry.get("psi_id")
    if psi_id:
        tags.add(f"psi:{psi_id}")

    if entry.get("project_type") == "Microgravity Investigation":
        tags.add("type:microgravity_investigation")
    else:
        tags.add("type:ground_investigation")

    for p in entry.get("safety_pillars", []):
        tags.add(f"pillar:{p.lower()}")

    rack_map = {
        "CIR-ACME": "rack:cir_acme", "MSG-SPICE": "rack:msg_spice",
        "CIR-MDCA": "rack:cir_mdca", "Saffire": "rack:saffire",
        "Ground-CFD": "rack:ground_cfd", "Other": "rack:other"
    }
    if entry.get("hardware_rack") in rack_map:
        tags.add(rack_map[entry["hardware_rack"]])

    phase_map = {
        "Gaseous": "phase:gaseous", "Solid": "phase:solid",
        "Liquid_Droplet": "phase:liquid_droplet", "Multi-phase": "phase:multi_phase"
    }
    if entry.get("fuel_phase") in phase_map:
        tags.add(phase_map[entry["fuel_phase"]])

    fuel_map = {
        "Hydrocarbon / Spacecraft Materials": "fuel:hydrocarbon_spacecraft_materials",
        "Methane (CH4)": "fuel:methane_ch4", "Ethylene (C2H4)": "fuel:ethylene_c2h4",
        "Propane (C3H8)": "fuel:propane_c3h8", "n-Butane (C4H10)": "fuel:n_butane_c4h10",
        "n-Pentane (C5H12)": "fuel:n_pentane_c5h12", "n-Heptane": "fuel:n_heptane",
        "n-Dodecane": "fuel:n_dodecane", "Cotton-Fiberglass Blend": "fuel:cotton_fiberglass_blend",
        "Nomex": "fuel:nomex", "PMMA (Acrylic)": "fuel:pmma_acrylic"
    }
    for f in entry.get("fuels_tested", []):
        if f in fuel_map:
            tags.add(fuel_map[f])

    sensor_map = {
        "High-Speed Optical Cameras": "sensor:high_speed_optical_cameras",
        "Optical Imaging": "sensor:optical_imaging",
        "Radiometers": "sensor:radiometers",
        "Thermocouples": "sensor:thermocouples",
        "Temperature & Radiative Sensors": "sensor:temperature_radiative_sensors",
        "Photomultiplier Tubes (PMT)": "sensor:photomultiplier_tubes_pmt",
        "Laser Diagnostics": "sensor:laser_diagnostics",
        "Aerosol & Smoke Particle Counters": "sensor:aerosol_smoke_particle_counters",
        "3D CFD Simulation Solver": "sensor:3d_cfd_simulation_solver"
    }
    for s in entry.get("sensors_used", []):
        if s in sensor_map:
            tags.add(sensor_map[s])

    env = entry.get("envelope", {})
    tags.add(f"gravity:{env.get('gravity_regime', '0g_microgravity')}")
    if env.get("o2_min_pct", 21.0) < 21.0:
        tags.add("env:hypoxic_low_o2")
    if env.get("o2_min_pct", 21.0) <= 21.0 <= env.get("o2_max_pct", 21.0):
        tags.add("env:normoxic_earth_o2")
    if env.get("o2_max_pct", 21.0) >= 30.0:
        tags.add("env:hyperoxic_enriched_o2")
    if env.get("o2_max_pct", 21.0) > 40.0:
        tags.add("env:extreme_o2")
    if env.get("pressure_min_psi", 14.7) < 14.7:
        tags.add("env:reduced_cabin_pressure")
    if env.get("pressure_max_psi", 14.7) == 14.7:
        tags.add("env:standard_1atm_pressure")
    if env.get("airflow_max_cms", 0.0) <= 5.0:
        tags.add("env:quiescent_low_flow")
    else:
        tags.add("env:forced_convective_flow")

    if entry.get("lunar_habitat_relevant"):
        tags.add("relevance:lunar_habitat")

    text_blob = f"{entry.get('title', '')} {entry.get('key_findings_summary', '')}".lower()
    if "spherical" in text_blob:
        tags.add("phenom:spherical_diffusion_flame")
    if "coflow" in text_blob or "co-flow" in text_blob:
        tags.add("phenom:coflow_laminar_flame")
    if "counterflow" in text_blob:
        tags.add("phenom:counterflow_flame")
    if "cool flame" in text_blob or "cool diffusion" in text_blob:
        tags.add("phenom:cool_flame")
    if "flame spread" in text_blob or "flame growth" in text_blob:
        tags.add("phenom:concurrent_flame_spread")
    if any(w in text_blob for w in ("liftoff", "lifted", "extinction", "extinguish")):
        tags.add("phenom:flame_liftoff_extinction")
    if "large scale fire" in text_blob or "saffire" in text_blob:
        tags.add("phenom:large_scale_fire_growth")
    if "soot" in text_blob or "smoke-point" in text_blob:
        tags.add("phys:soot_formation_inception")
    if "smoke" in text_blob or "aerosol" in text_blob or "particulate" in text_blob:
        tags.add("phys:smoke_aerosol_particulates")
    if "electric field" in text_blob or "chemi-ion" in text_blob:
        tags.add("phys:electric_field_chemi_ion")
    if "droplet" in text_blob:
        tags.add("phys:droplet_bicomponent_combustion")
    if "inert" in text_blob or "helium" in text_blob or "co2" in text_blob or "suppressant" in text_blob:
        tags.add("phys:inert_gas_dilution_suppression")
    if "chemiluminescence" in text_blob or "kinetics" in text_blob:
        tags.add("phys:chemiluminescence_kinetics")

    return sorted(list(tags))


def index_catalogo_json(json_path: Optional[str] = None):
    """Indexa todos los experimentos del catálogo JSON oficial en la BD como 'catalog_experiment'."""
    target_path = None
    if json_path and Path(json_path).exists():
        target_path = Path(json_path)
    else:
        for candidate in DEFAULT_CATALOG_PATHS:
            if Path(candidate).exists():
                target_path = Path(candidate)
                break

    if not target_path:
        print("[!] No se encontró ningún archivo de catálogo JSON (catalogo_limpio_2.json / catalogo_limpio.json).")
        return

    data = json.loads(target_path.read_text(encoding="utf-8"))
    for entry in data:
        psi_id = entry["psi_id"]
        tags = extract_tags_from_catalog_entry(entry)
        summary = entry.get("key_findings_summary", "")
        raw_json = json.dumps(entry, indent=2, ensure_ascii=False)

        metadata = {
            "psi_url": entry.get("psi_url", ""),
            "hardware_rack": entry.get("hardware_rack", ""),
            "fuel_phase": entry.get("fuel_phase", ""),
            "fuels_tested": ", ".join(entry.get("fuels_tested", [])),
            "variables_compared": entry.get("variables_compared", ""),
            "sensors_used": ", ".join(entry.get("sensors_used", []))
        }

        save_to_db(
            doc_id=psi_id,
            title=entry["title"],
            raw_content=raw_json,
            summary=summary,
            tags=tags,
            doc_type="catalog_experiment",
            metadata=metadata
        )


def sync_psi_tags_on_existing_files():
    """
    Sincroniza instantáneamente los archivos locales ya guardados en SQLite:
    Si un archivo se llama 'PSI-10_Raw Data...', le asigna automáticamente 'psi:PSI-10'
    y el rack/fase reales de PSI-10 en el catálogo JSON, sin necesidad de re-ejecutar Ollama.
    """
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()

    catalog_rows = cursor.execute(
        "SELECT doc_id FROM documents WHERE doc_type = 'catalog_experiment'"
    ).fetchall()
    catalog_tags_map = {}
    for (psi_id,) in catalog_rows:
        t_rows = cursor.execute(
            "SELECT tag FROM document_tags WHERE doc_id = ?", (psi_id,)
        ).fetchall()
        inherited = [
            t for (t,) in t_rows
            if t.startswith(("psi:", "rack:", "phase:", "gravity:"))
        ]
        catalog_tags_map[psi_id.upper()] = inherited

    raw_rows = cursor.execute(
        "SELECT doc_id, title, metadata_json FROM documents WHERE doc_type = 'raw_file'"
    ).fetchall()

    for doc_id, title, meta_str in raw_rows:
        detected_ids = extract_psi_ids_from_text(f"{doc_id} {title or ''} {meta_str or ''}")
        for pid in detected_ids:
            cursor.execute(
                "INSERT OR IGNORE INTO document_tags (doc_id, tag) VALUES (?, ?)",
                (doc_id, f"psi:{pid}")
            )
            if pid in catalog_tags_map:
                for cat_tag in catalog_tags_map[pid]:
                    cursor.execute(
                        "INSERT OR IGNORE INTO document_tags (doc_id, tag) VALUES (?, ?)",
                        (doc_id, cat_tag)
                    )
    conn.commit()
    conn.close()


# =====================================================================
# 3. ETAPA 1B: INDEXAR ARCHIVOS RAW (.TXT, .CSV, .LOG) CON OLLAMA
# =====================================================================
def extract_tags_with_ollama(text_content: str, filename: Optional[str] = None) -> DocumentTaggingOutput:
    """Llama al LLM en Ollama forzando la salida al esquema DocumentTaggingOutput."""
    system_prompt = (
        "Eres un indexador científico experto en combustión e instrumentación espacial de la NASA (PSI). "
        "Analiza la configuración técnica, datos y nombre de archivo para asignar un título descriptivo "
        "y una lista de etiquetas exactas y únicas correspondientes a la taxonomía permitida. "
        "Si el nombre de archivo incluye un identificador PSI (ej. PSI-10, PSI-142), incluye SIEMPRE su etiqueta "
        "'psi:PSI-XX' correspondiente. Presta atención al hardware (Acme -> rack:cir_acme, SPICE -> rack:msg_spice, "
        "MDCA -> rack:cir_mdca) y a los sensores, fase del combustible y fenómenos físicos."
    )

    if filename:
        user_content = f"Nombre de archivo / Metadatos: {filename}\n\nContenido técnico / Datos raw:\n{text_content}"
    else:
        user_content = f"Texto del experimento a indexar:\n\n{text_content}"

    response = ollama.chat(
        model=OLLAMA_MODEL,
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_content}
        ],
        format=DocumentTaggingOutput.model_json_schema(),
        options={
            "temperature": 0.1,
            "repeat_penalty": 1.2,
            "num_predict": 350
        }
    )

    result = DocumentTaggingOutput.model_validate_json(response["message"]["content"])
    tags = list(dict.fromkeys(result.assigned_tags))

    if filename:
        for pid in extract_psi_ids_from_text(filename):
            psi_tag = f"psi:{pid}"
            if psi_tag not in tags:
                tags.insert(0, psi_tag)

    result.assigned_tags = tags
    return result


def index_txt_file(txt_path: str, custom_id: str = None):
    """Lee un archivo de datos raw, infiere sus etiquetas con Ollama y lo guarda como 'raw_file'."""
    path = Path(txt_path)
    if not path.exists():
        raise FileNotFoundError(f"No se encontró el archivo: {txt_path}")

    raw_text = path.read_text(encoding="utf-8", errors="ignore")
    doc_id = custom_id or path.stem

    print(f"[*] Analizando archivo '{path.name}' con Ollama ({OLLAMA_MODEL})...")
    result = extract_tags_with_ollama(raw_text, filename=path.name)

    save_to_db(
        doc_id=doc_id,
        title=result.title,
        raw_content=raw_text,
        summary=result.technical_summary,
        tags=result.assigned_tags,
        doc_type="raw_file",
        metadata={"filename": path.name, "filepath": str(path)}
    )
    sync_psi_tags_on_existing_files()
    print(f"[+] Archivo guardado en BD -> ID: {doc_id}")
    print(f"    Título   : {result.title}")
    print(f"    Resumen  : {result.technical_summary}")
    print(f"    Etiquetas ({len(result.assigned_tags)}): {result.assigned_tags}\n")
    return result


def index_raw_data_folder(folder_path: str = "datos_raw", recursive: bool = True):
    """Escanea la carpeta de datos raw, clasifica cada archivo con Ollama y lo indexa en SQLite."""
    folder = Path(folder_path)
    if not folder.exists() or not folder.is_dir():
        print(f"[!] La carpeta '{folder_path}' no existe.")
        return []

    supported_extensions = {".txt", ".json", ".csv", ".log", ".dat", ".tsv"}
    pattern = "**/*" if recursive else "*"
    files = [f for f in folder.glob(pattern) if f.is_file() and f.suffix.lower() in supported_extensions]

    if not files:
        print(f"[!] No se encontraron archivos de datos raw en '{folder_path}'.")
        return []

    print("\n" + "=" * 70)
    print(f"[*] Clasificando datos raw en '{folder_path}' ({len(files)} archivo(s) encontrado(s))...")
    print("=" * 70 + "\n")

    results = []
    for idx, file_path in enumerate(files, 1):
        print(f"[{idx}/{len(files)}] Archivo: {file_path.name}")
        try:
            doc_id = file_path.stem
            res = index_txt_file(str(file_path), custom_id=doc_id)
            results.append((doc_id, file_path.name, res))
        except Exception as e:
            print(f"[ERROR] Error al procesar '{file_path.name}': {e}\n")

    sync_psi_tags_on_existing_files()
    print(f"[✔] Proceso finalizado: {len(results)} de {len(files)} archivo(s) clasificados e indexados.\n")
    return results


# =====================================================================
# 4. ETAPA 2: BÚSQUEDA HÍBRIDA (ETIQUETAS LLM + TÍTULO / RESUMEN / ACRÓNIMOS)
# =====================================================================
def _term_matches_text(term: str, text_lower: str) -> bool:
    """
    Comprueba si `term` aparece en `text_lower`:
    - Para términos cortos (<= 4 chars, como 'flex', 'bre', 'soot', 'pmt'): exige inicio de palabra
      para evitar falsos positivos (ej. 'bre' dentro de 'sobre').
    - Para términos largos (>= 5 chars, como 'extinguish'): permite coincidencia por prefijo/subcadena
      (ej. 'extinguish' coincide con 'Extinguishment' o 'Extinguished').
    """
    if len(term) <= 4:
        return bool(re.search(rf"\b{re.escape(term)}", text_lower))
    return term in text_lower


def _hybrid_query_by_doc_type(
    cursor: sqlite3.Cursor,
    doc_type: str,
    required_tags: List[str],
    optional_tags: List[str],
    normalized_phrase: str,
    query_terms: List[str],
    psi_boost_map: Dict[str, float],
    top_k: int
):
    """
    Combina puntuación semántica por etiquetas (Ollama) + coincidencia léxica directa sobre
    título, resumen, metadatos y contenido (para capturar búsquedas como 'flame extinguish' o 'flex').
    """
    req_set = set(required_tags)
    opt_set = set(optional_tags) - req_set

    # Cargar documentos y sus etiquetas del doc_type solicitado
    docs = cursor.execute(
        "SELECT doc_id, title, summary, metadata_json, raw_content FROM documents WHERE doc_type = ?",
        (doc_type,)
    ).fetchall()

    tag_rows = cursor.execute(
        """
        SELECT dt.doc_id, dt.tag
        FROM document_tags dt
        JOIN documents d ON d.doc_id = dt.doc_id
        WHERE d.doc_type = ?
        """,
        (doc_type,)
    ).fetchall()

    doc_tags_map: Dict[str, List[str]] = {}
    for d_id, t in tag_rows:
        doc_tags_map.setdefault(d_id, []).append(t)

    # Separar términos específicos frente a términos genéricos del dominio
    specific_terms = [t for t in query_terms if t not in GENERIC_DOMAIN_TERMS]
    effective_terms = specific_terms if specific_terms else query_terms

    scored_results = []

    for doc_id, title, summary, meta_str, raw_content in docs:
        tags = doc_tags_map.get(doc_id, [])
        tag_score = 0.0
        matched_reasons: List[str] = []

        # 1. Puntuación por etiquetas semánticas (Ollama + psi:PSI-XX)
        for t in tags:
            if t in req_set:
                tag_score += 15.0 if t.startswith("psi:") else 3.0
                matched_reasons.append(t)
            elif t in opt_set:
                tag_score += 10.0 if t.startswith("psi:") else 1.0
                matched_reasons.append(t)

        # 2. Boost por acrónimo o experimento PSI relacionado (ej. FLEX -> PSI-68 / PSI-69 y sus raw_files)
        boost_score = 0.0
        if doc_type == "catalog_experiment" and doc_id in psi_boost_map:
            boost_score += psi_boost_map[doc_id]
            matched_reasons.append(f"id:{doc_id}")
        elif doc_type == "raw_file":
            for t in tags:
                if t.startswith("psi:"):
                    pid = t.split(":", 1)[1]
                    if pid in psi_boost_map:
                        boost_score = max(boost_score, psi_boost_map[pid] * 0.7)
                        if t not in matched_reasons:
                            matched_reasons.append(t)

        # 3. Puntuación léxica directa sobre Título, Resumen, Metadatos y Contenido
        title_lower = (title or "").lower()
        summary_lower = (summary or "").lower()
        meta_lower = (meta_str or "").lower()
        content_lower = (raw_content or "").lower()

        lexical_score = 0.0
        title_hits: List[str] = []
        matched_terms_count = 0

        # Coincidencia de frase completa en el título (ej. "flame extinguish" en "Flame Extinguishment Experiment")
        if len(normalized_phrase) >= 4 and normalized_phrase in title_lower:
            lexical_score += 10.0

        for term in query_terms:
            is_generic = term in GENERIC_DOMAIN_TERMS
            in_title = _term_matches_text(term, title_lower)
            in_summary_or_meta = _term_matches_text(term, summary_lower) or _term_matches_text(term, meta_lower)
            in_content = _term_matches_text(term, content_lower)

            if in_title:
                lexical_score += 2.0 if is_generic else 6.5
                title_hits.append(term)
                if not is_generic:
                    matched_terms_count += 1
            elif in_summary_or_meta:
                lexical_score += 0.5 if is_generic else 3.0
                if not is_generic:
                    matched_terms_count += 1
            elif in_content and not is_generic:
                lexical_score += 1.0
                matched_terms_count += 1

        # Bonus si coincide con TODOS los términos específicos buscados (ej. "flame" + "extinguish")
        if len(effective_terms) >= 2 and matched_terms_count >= len(effective_terms):
            lexical_score += 5.0

        if title_hits:
            matched_reasons.append(f"title:{'+'.join(title_hits)}")
        elif lexical_score >= 3.0:
            matched_reasons.append("keyword:match")

        # Si el usuario buscó términos específicos (ej. "extinguish" o "flex") y el documento
        # no tiene NINGUNA coincidencia léxica ni boost de ID/acrónimo, filtrar ruido de tags genéricos
        if specific_terms and lexical_score == 0.0 and boost_score == 0.0:
            # Solo permitir si coincidió explícitamente una etiqueta requerida de alta especificidad
            has_specific_req_tag = any(
                t in req_set and (t.startswith("psi:") or t.startswith("phenom:") or t.startswith("fuel:"))
                for t in tags
            )
            if not has_specific_req_tag:
                continue

        total_score = round(tag_score + boost_score + lexical_score, 1)
        if total_score > 0:
            scored_results.append((
                doc_id,
                title,
                summary,
                meta_str,
                total_score,
                ", ".join(dict.fromkeys(matched_reasons))
            ))

    scored_results.sort(key=lambda x: x[4], reverse=True)
    return scored_results[:top_k]


def search_experiments(user_query: str, top_k_files: int = 5, top_k_experiments: int = 8):
    """
    Búsqueda híbrida:
    1. Asegura que el catálogo JSON esté indexado y sincronizado con los archivos locales.
    2. Extrae términos del título, acrónimos (FLEX, BRE, BASS, SLICE, etc.) e IDs PSI explícitos.
    3. Consulta a Ollama para inferir etiquetas semánticas complementarias.
    4. Combina puntuación de etiquetas + título/resumen/acrónimo y propaga el boost a los raw_files.
    """
    index_catalogo_json()
    sync_psi_tags_on_existing_files()

    explicit_psi_ids = extract_psi_ids_from_text(user_query)
    normalized_phrase, query_terms, acronym_psi_boosts = extract_query_terms(user_query)

    # Añadir IDs explícitos (ej. "psi10") al mapa de boost
    psi_boost_map: Dict[str, float] = dict(acronym_psi_boosts)
    for pid in explicit_psi_ids:
        psi_boost_map[pid] = max(psi_boost_map.get(pid, 0.0), 18.0)

    catalog_cheat_sheet = (
        "Guía rápida de IDs y acrónimos del catálogo NASA PSI:\n"
        "- PSI-10: Flame Design (CIR-ACME -> rack:cir_acme, phase:gaseous, phenom:spherical_diffusion_flame, phys:soot_formation_inception)\n"
        "- PSI-20: Burning Rate Emulator / BRE (CIR-ACME -> rack:cir_acme, phase:solid)\n"
        "- PSI-21: Coflow Laminar Diffusion Flame (CIR-ACME -> rack:cir_acme, phase:gaseous, phenom:coflow_laminar_flame)\n"
        "- PSI-22: Electric-Field Effects on Laminar Diffusion Flames (CIR-ACME -> rack:cir_acme, phase:gaseous, phys:electric_field_chemi_ion)\n"
        "- PSI-23: Structure & Response of Spherical Diffusion Flames (CIR-ACME -> rack:cir_acme, phase:gaseous, phenom:spherical_diffusion_flame)\n"
        "- PSI-25 / PSI-26: Burning and Suppression of Solids / BASS / BASS-II (MSG-SPICE -> rack:msg_spice, phase:solid)\n"
        "- PSI-39: Cool Flames Investigation / CFI (CIR-MDCA -> rack:cir_mdca, phase:liquid_droplet, phenom:cool_flame)\n"
        "- PSI-47 / PSI-101 / PSI-102 / PSI-115: DAFT / SAME Smoke Aerosol (phys:smoke_aerosol_particulates, sensor:aerosol_smoke_particle_counters)\n"
        "- PSI-60 / PSI-106 / PSI-107: SPICE / SLICE (MSG-SPICE -> rack:msg_spice, phenom:coflow_laminar_flame, phenom:flame_liftoff_extinction)\n"
        "- PSI-68 / PSI-69 / PSI-117 / PSI-142: Flame Extinguishment Experiment / FLEX / FLEX-2 (CIR-MDCA / Ground-CFD, phenom:flame_liftoff_extinction)\n"
        "- PSI-98 / PSI-99 / PSI-100: Spacecraft Fire Safety Experiment / Saffire I, II, III (Saffire -> rack:saffire, phase:solid, phenom:large_scale_fire_growth)\n"
        "- PSI-159: ACME Cool Flames Investigation with Gases (CIR-ACME -> rack:cir_acme, phase:gaseous, phenom:cool_flame)"
    )

    system_prompt = (
        "Eres el motor de búsqueda semántico del catálogo de combustión espacial de la NASA (PSI). "
        "Convierte la consulta del usuario en etiquetas exactas de búsqueda de la taxonomía permitida.\n"
        "REGLAS CRÍTICAS:\n"
        "1. Si el usuario menciona un experimento o acrónimo (ej. 'psi10', 'FLEX', 'Flame Extinguishment', 'BRE', 'BASS', 'SLICE', 'Saffire'), "
        "incluye su etiqueta 'psi:PSI-XX' en 'required_tags' y consulta la Guía rápida inferior.\n"
        "2. Hardware/Racks: ACME -> rack:cir_acme, SPICE -> rack:msg_spice, MDCA -> rack:cir_mdca, Saffire -> rack:saffire.\n"
        "3. Extinción / Flame Extinguishment: phenom:flame_liftoff_extinction y pillar:suppression.\n\n"
        f"{catalog_cheat_sheet}"
    )

    req_tags: List[str] = []
    opt_tags: List[str] = []
    reasoning = "Búsqueda híbrida por título, acrónimos y etiquetas."

    try:
        response = ollama.chat(
            model=OLLAMA_MODEL,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": f"Búsqueda del usuario: {user_query}"}
            ],
            format=SearchQueryInference.model_json_schema(),
            options={
                "temperature": 0.0,
                "repeat_penalty": 1.2,
                "num_predict": 250
            }
        )
        inferred = SearchQueryInference.model_validate_json(response["message"]["content"])
        req_tags = list(dict.fromkeys(inferred.required_tags))
        opt_tags = list(dict.fromkeys(inferred.optional_tags))
        reasoning = inferred.reasoning
    except Exception as e:
        print(f"[!] Aviso: Ollama no respondió ({e}), usando búsqueda directa por títulos y acrónimos.")

    # Garantizar determinísticamente los PSI-IDs detectados por mención directa o acrónimo
    detected_all_ids = list(dict.fromkeys(explicit_psi_ids + list(acronym_psi_boosts.keys())))
    for pid in detected_all_ids:
        psi_tag = f"psi:{pid}"
        if pid in explicit_psi_ids:
            if psi_tag not in req_tags:
                req_tags.insert(0, psi_tag)
            if psi_tag in opt_tags:
                opt_tags.remove(psi_tag)
        else:
            if psi_tag not in req_tags and psi_tag not in opt_tags:
                opt_tags.insert(0, psi_tag)

    print("\n" + "=" * 75)
    print(f"CONSULTA: '{user_query}'")
    print(f"TÉRMINOS LÉXICOS / TÍTULO: {query_terms} | BOOSTS: {psi_boost_map}")
    print(f"ETIQUETAS OBLIGATORIAS   : {req_tags}")
    print(f"ETIQUETAS OPCIONALES     : {opt_tags}")
    print(f"RAZONAMIENTO LLM         : {reasoning}")
    print("=" * 75)

    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()

    # 1. Buscar experimentos más adecuados del catálogo JSON (híbrido: tags + título + resumen + acrónimos)
    exp_results = _hybrid_query_by_doc_type(
        cursor,
        "catalog_experiment",
        req_tags,
        opt_tags,
        normalized_phrase,
        query_terms,
        psi_boost_map,
        top_k_experiments
    )

    # Propagar el éxito de los experimentos encontrados por título (ej. 'flame extinguish' -> PSI-68/69)
    # hacia los raw_files asociados a esos PSI-IDs para que también se iluminen en el grafo
    propagated_psi_boosts = dict(psi_boost_map)
    for psi_id, _, _, _, exp_score, _ in exp_results[:3]:
        if exp_score >= 8.0:
            propagated_psi_boosts[psi_id] = max(propagated_psi_boosts.get(psi_id, 0.0), exp_score * 0.6)

    # 2. Buscar archivos locales relevantes (datos_raw)
    file_results = _hybrid_query_by_doc_type(
        cursor,
        "raw_file",
        req_tags,
        opt_tags,
        normalized_phrase,
        query_terms,
        propagated_psi_boosts,
        top_k_files
    )
    conn.close()

    # Mostrar Bloque 1: Archivos Relevantes
    print(f"\n[1] ARCHIVOS LOCALES RELEVANTES (Top {len(file_results)}):")
    print("-" * 75)
    if not file_results:
        print("   (No hay archivos raw indexados que coincidan con esta búsqueda)")
    else:
        for rank, (doc_id, title, summary, meta_str, score, matched_tags) in enumerate(file_results, 1):
            meta = json.loads(meta_str) if meta_str else {}
            fname = meta.get("filename", doc_id)
            print(f" {rank}. Archivo: {fname} | {title} (Score: {score} pts)")
            print(f"    Resumen : {summary}")
            print(f"    Matches : {matched_tags}\n")

    # Mostrar Bloque 2: Experimentos Más Adecuados del Catálogo JSON
    print(f"\n[2] EXPERIMENTOS DEL CATÁLOGO JSON MÁS ADECUADOS (Top {len(exp_results)}):")
    print("-" * 75)
    if not exp_results:
        print("   (Ningún experimento del catálogo JSON coincide con esta búsqueda)")
    else:
        for rank, (psi_id, title, summary, meta_str, score, matched_tags) in enumerate(exp_results, 1):
            meta = json.loads(meta_str) if meta_str else {}
            print(f" {rank}. [{psi_id}] {title} (Score: {score} pts)")
            print(f"    Hardware : {meta.get('hardware_rack', 'N/A')} | Fase: {meta.get('fuel_phase', 'N/A')} | Combustibles: {meta.get('fuels_tested', 'N/A')}")
            print(f"    Variables: {meta.get('variables_compared', 'N/A')}")
            print(f"    Sensores : {meta.get('sensors_used', 'N/A')}")
            print(f"    URL PSI  : {meta.get('psi_url', 'N/A')}")
            print(f"    Matches  : {matched_tags}\n")

    return {"files": file_results, "experiments": exp_results}


# =====================================================================
# CLI Y EJECUCIÓN PRINCIPAL
# =====================================================================
if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser(description="Motor de clasificación e indexación semántica PSI con Ollama")
    parser.add_argument("--folder", type=str, default="datos_raw", help="Carpeta de datos raw a clasificar (por defecto: datos_raw)")
    parser.add_argument("--catalog", type=str, default=None, help="Ruta al archivo JSON del catálogo (ej. catalogo_limpio.json)")
    parser.add_argument("--file", type=str, help="Clasificar e indexar un archivo individual específico")
    parser.add_argument("--search", type=str, help="Ejecutar una búsqueda semántica mostrando archivos y experimentos del JSON")
    parser.add_argument("--no-search", action="store_true", help="Omitir la búsqueda de prueba tras indexar")
    args = parser.parse_args()

    init_db()

    if args.catalog:
        index_catalogo_json(args.catalog)

    if args.file:
        index_txt_file(args.file)
    elif args.search:
        search_experiments(args.search)
    else:
        index_catalogo_json(args.catalog)

        if Path(args.folder).exists():
            index_raw_data_folder(args.folder)
        else:
            print(f"[!] La carpeta '{args.folder}' no existe (solo se indexó el catálogo JSON).")

        if not args.no_search:
            search_experiments("flame extinguish")
