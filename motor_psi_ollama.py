import json
import re
import sqlite3
from pathlib import Path
from typing import List, Literal, Optional
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
# UTILIDADES PARA DETECTAR IDs PSI (ej. "psi10", "PSI-10", "psi 10")
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
    """Extrae todas las etiquetas exactas de un registro de catalogo_limpio_2.json."""
    tags = set()
    
    # Etiqueta directa del propio ID del experimento (ej. psi:PSI-10)
    psi_id = entry.get("psi_id")
    if psi_id:
        tags.add(f"psi:{psi_id}")

    # Tipo de proyecto y pilares
    if entry.get("project_type") == "Microgravity Investigation":
        tags.add("type:microgravity_investigation")
    else:
        tags.add("type:ground_investigation")
        
    for p in entry.get("safety_pillars", []):
        tags.add(f"pillar:{p.lower()}")
        
    # Hardware / Rack
    rack_map = {
        "CIR-ACME": "rack:cir_acme", "MSG-SPICE": "rack:msg_spice",
        "CIR-MDCA": "rack:cir_mdca", "Saffire": "rack:saffire",
        "Ground-CFD": "rack:ground_cfd", "Other": "rack:other"
    }
    if entry.get("hardware_rack") in rack_map:
        tags.add(rack_map[entry["hardware_rack"]])
        
    # Fase del combustible
    phase_map = {
        "Gaseous": "phase:gaseous", "Solid": "phase:solid",
        "Liquid_Droplet": "phase:liquid_droplet", "Multi-phase": "phase:multi_phase"
    }
    if entry.get("fuel_phase") in phase_map:
        tags.add(phase_map[entry["fuel_phase"]])
        
    # Combustibles específicos
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
            
    # Sensores
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
            
    # Condiciones operativas (Envelope)
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

    # Fenómenos y física inferidos del título y key_findings_summary
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
    if "liftoff" in text_blob or "lifted" in text_blob or "extinction" in text_blob:
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

    # Obtener etiquetas clave de cada PSI-XX del catálogo oficial
    catalog_rows = cursor.execute(
        "SELECT doc_id FROM documents WHERE doc_type = 'catalog_experiment'"
    ).fetchall()
    catalog_tags_map = {}
    for (psi_id,) in catalog_rows:
        t_rows = cursor.execute(
            "SELECT tag FROM document_tags WHERE doc_id = ?", (psi_id,)
        ).fetchall()
        # Heredar etiqueta psi:PSI-XX, rack:*, phase:* y gravity:*
        inherited = [
            t for (t,) in t_rows
            if t.startswith(("psi:", "rack:", "phase:", "gravity:"))
        ]
        catalog_tags_map[psi_id.upper()] = inherited

    # Revisar archivos raw existentes
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
                # Si tenía un rack o fase erróneo alucinado antes, priorizar los del experimento oficial
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

    # Inyección determinista si el nombre del archivo menciona PSI-XX
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

    print("\n" + "="*70)
    print(f"[*] Clasificando datos raw en '{folder_path}' ({len(files)} archivo(s) encontrado(s))...")
    print("="*70 + "\n")

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
# 4. ETAPA 2: BÚSQUEDA DUAL (ARCHIVOS RELEVANTES + EXPERIMENTOS DEL JSON)
# =====================================================================
def _query_by_doc_type(
    cursor: sqlite3.Cursor,
    doc_type: str,
    required_tags: List[str],
    optional_tags: List[str],
    all_search_tags: List[str],
    explicit_psi_ids: List[str],
    top_k: int
):
    """
    Ejecuta la consulta ponderada en SQLite filtrando por tipo ('raw_file' o 'catalog_experiment').
    Otorga:
      - 15 puntos por coincidencia de etiqueta exacta de experimento (psi:PSI-XX)
      - 3 puntos por etiqueta obligatoria (required_tags)
      - 1 punto por etiqueta opcional (optional_tags)
    """
    score_cases = []
    params = []
    for tag in required_tags:
        weight = 15 if tag.startswith("psi:") else 3
        score_cases.append(f"WHEN dt.tag = ? THEN {weight}")
        params.append(tag)
    for tag in optional_tags:
        if tag not in required_tags:
            weight = 10 if tag.startswith("psi:") else 1
            score_cases.append(f"WHEN dt.tag = ? THEN {weight}")
            params.append(tag)
            
    case_sql = " ".join(score_cases)
    placeholders = ",".join(["?"] * len(all_search_tags))
    
    params.append(doc_type)
    params.extend(all_search_tags)
    params.append(top_k)

    sql_query = f"""
        SELECT 
            d.doc_id,
            d.title,
            d.summary,
            d.metadata_json,
            SUM(CASE {case_sql} ELSE 0 END) AS relevance_score,
            GROUP_CONCAT(dt.tag, ', ') AS matched_tags
        FROM documents d
        JOIN document_tags dt ON d.doc_id = dt.doc_id
        WHERE d.doc_type = ? AND dt.tag IN ({placeholders})
        GROUP BY d.doc_id
        ORDER BY relevance_score DESC
        LIMIT ?
    """
    cursor.execute(sql_query, params)
    return cursor.fetchall()

def search_experiments(user_query: str, top_k_files: int = 5, top_k_experiments: int = 5):
    """
    1. Asegura que el catálogo JSON esté indexado y sincronizado con los archivos locales.
    2. Detecta si el usuario menciona un PSI-ID explícito (ej. 'psi10' -> 'psi:PSI-10').
    3. El LLM en Ollama traduce la consulta a etiquetas (conociendo el mapa real de PSI-IDs).
    4. Devuelve Archivos Relevantes y Experimentos del Catálogo JSON ordenados por score.
    """
    # Garantizar que el catálogo JSON tenga las nuevas etiquetas psi:PSI-XX y sincronizar archivos
    index_catalogo_json()
    sync_psi_tags_on_existing_files()

    # Detectar menciones explícitas como "psi10", "psi-10", "psi 10"
    explicit_psi_ids = extract_psi_ids_from_text(user_query)

    # Guía compacta del catálogo real para que el LLM no alucine qué es cada PSI-XX
    catalog_cheat_sheet = (
        "Guía rápida de IDs del catálogo NASA PSI:\n"
        "- PSI-10: Flame Design (CIR-ACME -> rack:cir_acme, phase:gaseous, phenom:spherical_diffusion_flame, phys:soot_formation_inception)\n"
        "- PSI-20: Burning Rate Emulator (CIR-ACME -> rack:cir_acme, phase:solid)\n"
        "- PSI-21: Coflow Laminar Diffusion Flame (CIR-ACME -> rack:cir_acme, phase:gaseous, phenom:coflow_laminar_flame)\n"
        "- PSI-22: Electric-Field Effects (CIR-ACME -> rack:cir_acme, phase:gaseous, phys:electric_field_chemi_ion)\n"
        "- PSI-23: Structure & Response Spherical Flames (CIR-ACME -> rack:cir_acme, phase:gaseous, phenom:spherical_diffusion_flame)\n"
        "- PSI-25 / PSI-26: BASS / BASS-II (MSG-SPICE -> rack:msg_spice, phase:solid)\n"
        "- PSI-39: Cool Flames Investigation (CIR-MDCA -> rack:cir_mdca, phase:liquid_droplet, phenom:cool_flame)\n"
        "- PSI-47 / PSI-101 / PSI-102 / PSI-115: DAFT / SAME Smoke Aerosol (phys:smoke_aerosol_particulates, sensor:aerosol_smoke_particle_counters)\n"
        "- PSI-60 / PSI-106 / PSI-107: SPICE / SLICE (MSG-SPICE -> rack:msg_spice, phenom:coflow_laminar_flame)\n"
        "- PSI-68 / PSI-69 / PSI-117 / PSI-142: FLEX / Cool Flame Extinction (CIR-MDCA / Ground-CFD, phenom:flame_liftoff_extinction)\n"
        "- PSI-98 / PSI-99 / PSI-100: Saffire I, II, III (Saffire -> rack:saffire, phase:solid, phenom:large_scale_fire_growth)\n"
        "- PSI-159: ACME Cool Flames with Gases (CIR-ACME -> rack:cir_acme, phase:gaseous, phenom:cool_flame)"
    )

    system_prompt = (
        "Eres el motor de búsqueda semántico del catálogo de combustión espacial de la NASA (PSI). "
        "Convierte la consulta del usuario en etiquetas exactas de búsqueda de la taxonomía permitida.\n"
        "REGLAS CRÍTICAS:\n"
        "1. Si el usuario menciona un experimento concreto como 'psi10', 'PSI-10', 'psi 25', etc., "
        "DEBES incluir su etiqueta identificadora exacta (ej. 'psi:PSI-10') en 'required_tags' y consultar "
        "la Guía rápida inferior para añadir en 'optional_tags' su rack y fase reales (NO los inventes).\n"
        "2. Hardware/Racks: ACME -> rack:cir_acme, SPICE -> rack:msg_spice, MDCA -> rack:cir_mdca, Saffire -> rack:saffire.\n"
        "3. Cámaras o imagen: sensor:optical_imaging y sensor:high_speed_optical_cameras.\n\n"
        f"{catalog_cheat_sheet}"
    )
    
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

    # Garantizar determinísticamente que si el usuario escribió "psi10", "psi:PSI-10" esté en required_tags
    for pid in explicit_psi_ids:
        psi_tag = f"psi:{pid}"
        if psi_tag not in req_tags:
            req_tags.insert(0, psi_tag)
        if psi_tag in opt_tags:
            opt_tags.remove(psi_tag)

    inferred.required_tags = req_tags
    inferred.optional_tags = opt_tags
    
    print("\n" + "="*75)
    print(f"CONSULTA: '{user_query}'")
    print(f"ETIQUETAS OBLIGATORIAS (x3 pts | IDs x15 pts): {inferred.required_tags}")
    print(f"ETIQUETAS OPCIONALES   (x1 pt)              : {inferred.optional_tags}")
    print(f"RAZONAMIENTO LLM: {inferred.reasoning}")
    print("="*75)

    all_search_tags = list(set(inferred.required_tags + inferred.optional_tags))
    if not all_search_tags:
        print("No se infirieron etiquetas relevantes para la consulta.")
        return {"files": [], "experiments": []}

    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    # 1. Buscar archivos locales relevantes (datos_raw)
    file_results = _query_by_doc_type(
        cursor, "raw_file",
        inferred.required_tags, inferred.optional_tags, all_search_tags,
        explicit_psi_ids, top_k_files
    )
    
    # 2. Buscar experimentos más adecuados basados en el .json
    exp_results = _query_by_doc_type(
        cursor, "catalog_experiment",
        inferred.required_tags, inferred.optional_tags, all_search_tags,
        explicit_psi_ids, top_k_experiments
    )
    conn.close()

    # Mostrar Bloque 1: Archivos Relevantes
    print(f"\n[1] ARCHIVOS LOCALES RELEVANTES (Top {len(file_results)}):")
    print("-" * 75)
    if not file_results:
        print("   (No hay archivos raw indexados que coincidan con estas etiquetas)")
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
        print("   (Ningún experimento del catálogo JSON coincide con estas etiquetas)")
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
    parser.add_argument("--catalog", type=str, default=None, help="Ruta al archivo JSON del catálogo (ej. catalogo_limpio_2.json)")
    parser.add_argument("--file", type=str, help="Clasificar e indexar un archivo individual específico")
    parser.add_argument("--search", type=str, help="Ejecutar una búsqueda semántica mostrando archivos y experimentos del JSON")
    parser.add_argument("--no-search", action="store_true", help="Omitir la búsqueda de prueba tras indexar")
    args = parser.parse_args()

    # Paso 0: Inicializar base de datos SQLite
    init_db()

    # Paso 1: Asegurar que el catálogo JSON esté indexado si se pasa por CLI
    if args.catalog:
        index_catalogo_json(args.catalog)

    if args.file:
        index_txt_file(args.file)
    elif args.search:
        search_experiments(args.search)
    else:
        # Indexar catálogo JSON automáticamente
        index_catalogo_json(args.catalog)

        # Indexar y clasificar todos los archivos de la carpeta datos_raw
        if Path(args.folder).exists():
            index_raw_data_folder(args.folder)
        else:
            print(f"[!] La carpeta '{args.folder}' no existe (solo se indexó el catálogo JSON).")

        # Búsqueda de prueba si no se omite
        if not args.no_search:
            search_experiments(
                "Busco datos de psi10"
            )
