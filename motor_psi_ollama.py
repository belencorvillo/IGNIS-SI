import json
import sqlite3
from pathlib import Path
from typing import List, Literal, Optional
from pydantic import BaseModel, Field
import ollama

# Configuración del modelo local en Ollama
OLLAMA_MODEL = "qwen2.5:latest"  # También puedes usar "qwen2.5:7b"
DB_PATH = "psi_index.db"

# =====================================================================
# 1. TAXONOMÍA CERRADA DE ETIQUETAS PERMITIDAS
# =====================================================================
AllowedTag = Literal[
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

# Esquema Pydantic para el LLM Indexador (Etapa 1)
class DocumentTaggingOutput(BaseModel):
    title: str = Field(description="Título corto o identificador del experimento")
    assigned_tags: List[AllowedTag] = Field(
        description="Lista de etiquetas únicas aplicables de la taxonomía (máximo 8)",
        max_length=8
    )
    technical_summary: str = Field(description="Resumen técnico de 1 frase del experimento")

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
    reasoning: str = Field(description="Explicación breve de por qué se eligieron estas etiquetas")


# =====================================================================
# 2. BASE DE DATOS INDEXADA (SQLite con Índice Invertido)
# =====================================================================
def init_db():
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS documents (
            doc_id TEXT PRIMARY KEY,
            title TEXT,
            raw_content TEXT,
            summary TEXT
        )
    """)
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS document_tags (
            doc_id TEXT,
            tag TEXT,
            PRIMARY KEY (doc_id, tag),
            FOREIGN KEY (doc_id) REFERENCES documents(doc_id)
        )
    """)
    # Índice B-Tree sobre las etiquetas para búsquedas instantáneas
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_tag ON document_tags(tag)")
    conn.commit()
    conn.close()

def save_to_db(doc_id: str, title: str, raw_content: str, summary: str, tags: List[str]):
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute("""
        INSERT OR REPLACE INTO documents (doc_id, title, raw_content, summary)
        VALUES (?, ?, ?, ?)
    """, (doc_id, title, raw_content, summary))
    
    cursor.execute("DELETE FROM document_tags WHERE doc_id = ?", (doc_id,))
    for tag in set(tags):
        cursor.execute("INSERT INTO document_tags (doc_id, tag) VALUES (?, ?)", (doc_id, tag))
        
    conn.commit()
    conn.close()


# =====================================================================
# 3. ETAPA 1: INDEXAR UN ARCHIVO .TXT O EL CATÁLOGO JSON CON OLLAMA
# =====================================================================
def extract_tags_with_ollama(text_content: str, filename: Optional[str] = None) -> DocumentTaggingOutput:
    """Llama al LLM en Ollama forzando la salida al esquema DocumentTaggingOutput."""
    system_prompt = (
        "Eres un indexador científico experto en combustión e instrumentación espacial de la NASA (PSI). "
        "Analiza la configuración técnica, datos y nombre de archivo para asignar un título descriptivo "
        "y una lista de etiquetas exactas y únicas correspondientes a la taxonomía permitida. "
        "Presta especial atención al nombre de archivo para identificar hardware (ej. Acme -> rack:cir_acme, "
        "SPICE -> rack:msg_spice, MDCA -> rack:cir_mdca) y al contenido para identificar sensores "
        "(ej. cámaras ópticas -> sensor:high_speed_optical_cameras / sensor:optical_imaging), "
        "fase del combustible, condiciones de gravedad y fenómenos físicos si aplican."
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
    result.assigned_tags = list(dict.fromkeys(result.assigned_tags))
    return result

def index_txt_file(txt_path: str, custom_id: str = None):
    """Lee un archivo de datos, infiere sus etiquetas con Ollama y lo guarda en la BD indexada."""
    path = Path(txt_path)
    if not path.exists():
        raise FileNotFoundError(f"No se encontró el archivo: {txt_path}")
        
    raw_text = path.read_text(encoding="utf-8", errors="ignore")
    doc_id = custom_id or path.stem
    
    print(f"[*] Analizando '{path.name}' con Ollama ({OLLAMA_MODEL})...")
    result = extract_tags_with_ollama(raw_text, filename=path.name)
    
    save_to_db(
        doc_id=doc_id,
        title=result.title,
        raw_content=raw_text,
        summary=result.technical_summary,
        tags=result.assigned_tags
    )
    print(f"[+] Guardado en BD -> ID: {doc_id}")
    print(f"    Título   : {result.title}")
    print(f"    Resumen  : {result.technical_summary}")
    print(f"    Etiquetas ({len(result.assigned_tags)}): {result.assigned_tags}\n")
    return result

def index_raw_data_folder(folder_path: str = "datos_raw", recursive: bool = True):
    """
    Escanea la carpeta de datos raw (archivos .txt, .json, .csv, .log, etc.),
    clasifica cada archivo con Ollama y lo indexa en la base de datos SQLite.
    """
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

    print(f"[✔] Proceso finalizado: {len(results)} de {len(files)} archivo(s) clasificados e indexados con éxito.\n")
    return results

def index_catalogo_json(json_path: str):
    """Indexa todos los experimentos de catalogo_limpio.json en la BD."""
    data = json.loads(Path(json_path).read_text(encoding="utf-8"))
    for entry in data:
        psi_id = entry["psi_id"]
        # Convertimos el registro JSON en un bloque de texto descriptivo para el LLM
        text_representation = json.dumps(entry, indent=2, ensure_ascii=False)
        print(f"[*] Indexando {psi_id}: {entry['title']}...")
        result = extract_tags_with_ollama(text_representation, filename=f"{psi_id}.json")
        save_to_db(
            doc_id=psi_id,
            title=entry["title"],
            raw_content=text_representation,
            summary=result.technical_summary,
            tags=result.assigned_tags
        )
        print(f"    -> {len(result.assigned_tags)} etiquetas asignadas.")


# =====================================================================
# 4. ETAPA 2: BARRA DE BÚSQUEDA (LLM INFIERE ETIQUETAS + RANKING SQL)
# =====================================================================
def search_experiments(user_query: str, top_k: int = 5):
    """
    1. El segundo LLM traduce la búsqueda del usuario a etiquetas (required y optional).
    2. SQLite cruza las etiquetas en el índice invertido y calcula el score de adecuación.
    """
    system_prompt = (
        "Eres el motor de búsqueda semántico del catálogo de combustión espacial de la NASA (PSI). "
        "Convierte la consulta del usuario en etiquetas exactas de búsqueda de la taxonomía permitida. "
        "Reglas de mapeo clave:\n"
        "- Hardware/Racks: ACME -> rack:cir_acme, SPICE -> rack:msg_spice, MDCA -> rack:cir_mdca, Saffire -> rack:saffire.\n"
        "- Cámaras o imagen: sensor:optical_imaging y sensor:high_speed_optical_cameras.\n"
        "- Fases/Combustibles: gas -> phase:gaseous, gotas/líquido -> phase:liquid_droplet, etc.\n"
        "Coloca en 'required_tags' las condiciones críticas solicitadas y en 'optional_tags' sinónimos o sensores complementarios."
    )
    
    response = ollama.chat(
        model=OLLAMA_MODEL,
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": f"Búsqueda del usuario: {user_query}"}
        ],
        format=SearchQueryInference.model_json_schema(),
        options={
            "temperature": 0.1,
            "repeat_penalty": 1.2,
            "num_predict": 250
        }
    )
    
    inferred = SearchQueryInference.model_validate_json(response["message"]["content"])
    inferred.required_tags = list(dict.fromkeys(inferred.required_tags))
    inferred.optional_tags = list(dict.fromkeys(inferred.optional_tags))
    
    print("\n" + "="*70)
    print(f"CONSULTA: '{user_query}'")
    print(f"ETIQUETAS OBLIGATORIAS (x3 pts): {inferred.required_tags}")
    print(f"ETIQUETAS OPCIONALES   (x1 pt) : {inferred.optional_tags}")
    print(f"RAZONAMIENTO LLM: {inferred.reasoning}")
    print("="*70)

    all_search_tags = list(set(inferred.required_tags + inferred.optional_tags))
    if not all_search_tags:
        print("No se infirieron etiquetas relevantes para la consulta.")
        return []

    # Consulta SQL con puntuación ponderada (3 puntos por required_tag, 1 punto por optional_tag)
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    # Construimos dinámicamente el cálculo de score en SQL
    score_cases = []
    params = []
    for tag in inferred.required_tags:
        score_cases.append("WHEN dt.tag = ? THEN 3")
        params.append(tag)
    for tag in inferred.optional_tags:
        if tag not in inferred.required_tags:
            score_cases.append("WHEN dt.tag = ? THEN 1")
            params.append(tag)
            
    case_sql = " ".join(score_cases)
    placeholders = ",".join(["?"] * len(all_search_tags))
    params.extend(all_search_tags)
    params.append(top_k)

    sql_query = f"""
        SELECT 
            d.doc_id,
            d.title,
            d.summary,
            SUM(CASE {case_sql} ELSE 0 END) AS relevance_score,
            GROUP_CONCAT(dt.tag, ', ') AS matched_tags
        FROM documents d
        JOIN document_tags dt ON d.doc_id = dt.doc_id
        WHERE dt.tag IN ({placeholders})
        GROUP BY d.doc_id
        ORDER BY relevance_score DESC
        LIMIT ?
    """
    
    cursor.execute(sql_query, params)
    results = cursor.fetchall()
    conn.close()

    print(f"\nTOP {len(results)} EXPERIMENTOS MÁS ADECUADOS:")
    for rank, (doc_id, title, summary, score, matched_tags) in enumerate(results, 1):
        print(f"\n{rank}. [{doc_id}] {title} (Score: {score} pts)")
        print(f"   Resumen : {summary}")
        print(f"   Matches : {matched_tags}")
        
    return results


# =====================================================================
# EJEMPLO DE USO Y CLI
# =====================================================================
if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser(description="Motor de clasificación e indexación semántica PSI con Ollama")
    parser.add_argument("--folder", type=str, default="datos_raw", help="Carpeta de datos raw a clasificar (por defecto: datos_raw)")
    parser.add_argument("--file", type=str, help="Clasificar e indexar un archivo individual específico")
    parser.add_argument("--search", type=str, help="Ejecutar una búsqueda semántica en la base de datos")
    parser.add_argument("--no-search", action="store_true", help="Omitir la búsqueda de prueba tras indexar")
    args = parser.parse_args()

    # Paso 0: Inicializar base de datos SQLite
    init_db()

    if args.file:
        index_txt_file(args.file)
    elif args.search:
        search_experiments(args.search)
    else:
        # Paso 1: Indexar y clasificar todos los archivos de la carpeta datos_raw
        if Path(args.folder).exists():
            index_raw_data_folder(args.folder)
        else:
            print(f"[!] La carpeta '{args.folder}' no existe.")

        # Paso 2 (Opcional): Indexar catálogo consolidado si existe
        if Path("catalogo_limpio.json").exists():
            index_catalogo_json("catalogo_limpio.json")

        # Paso 3: Búsqueda de prueba si no se omite
        if not args.no_search:
            search_experiments(
                "Busco datos o configuraciones del rack ACME con cámaras ópticas"
            )