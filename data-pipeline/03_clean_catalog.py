import json
import re
import sys
from pathlib import Path
from typing import Any

# Añadir la raíz del repositorio para importar el contrato oficial Pydantic
ROOT_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT_DIR))

from contracts.schema import PSIInvestigation, TestEnvelope

RAW_FILE = Path(__file__).parent / "catalogo_crudo.json"
CLEAN_FILE = Path(__file__).parent / "catalogo_limpio.json"


def infer_metadata(exp: dict[str, Any]) -> dict[str, Any]:
    """Mapea cada experimento PSI al esquema estricto de IGNIS-SI y NASA Space Apps."""
    psi_id = exp["psi_id"]
    title = exp["title"]
    text = f"{title} {exp.get('objectives', '')} {exp.get('approach', '')}".lower()
    project_type = exp.get("project_type", "Microgravity Investigation")
    if project_type not in {"Microgravity Investigation", "Reduced Gravity Investigation", "Ground Investigation"}:
        project_type = "Microgravity Investigation"

    # 1. Safety Pillars ("Prevention", "Detection", "Suppression")
    pillars: list[str] = []
    if any(k in text for k in ["bass", "saffire", "burning rate emulator", "flammability", "flame spread", "bre"]):
        pillars.append("Prevention")
    if any(k in text for k in ["smoke", "aerosol", "dust", "same", "daft", "soot"]):
        pillars.append("Detection")
    if any(k in text for k in ["extinguish", "flex", "cool flame", "cfi", "suppression", "dilution"]):
        pillars.append("Suppression")
    if not pillars:
        pillars = ["Prevention"]

    # 2. Hardware Rack
    if project_type == "Ground Investigation":
        hardware_rack = "Ground-CFD"
    elif "acme" in text or psi_id in {"PSI-10", "PSI-20", "PSI-21", "PSI-22", "PSI-23", "PSI-159"}:
        hardware_rack = "CIR-ACME"
    elif any(k in text for k in ["flex", "cool flames investigation", "mdca"]) or psi_id in {"PSI-39", "PSI-68", "PSI-69", "PSI-142"}:
        hardware_rack = "CIR-MDCA"
    elif any(k in text for k in ["bass", "spice", "slice"]) or psi_id in {"PSI-25", "PSI-26", "PSI-106", "PSI-107"}:
        hardware_rack = "MSG-SPICE"
    elif "saffire" in text or psi_id in {"PSI-98", "PSI-99", "PSI-100"}:
        hardware_rack = "Saffire"
    else:
        hardware_rack = "Other"

    # 3. Fuel Phase
    if any(k in text for k in ["droplet", "heptane", "dodecane", "methanol", "ethanol"]) and "gases" not in text:
        fuel_phase = "Liquid_Droplet"
    elif any(k in text for k in ["solid", "pmma", "fabric", "cotton", "nomex", "saffire", "bass"]):
        fuel_phase = "Solid"
    elif any(k in text for k in ["smoke", "aerosol", "dust", "particulate"]):
        fuel_phase = "Multi-phase"
    else:
        fuel_phase = "Gaseous"

    # 4. Fuels Tested
    fuel_map = {
        "methane": "Methane (CH4)",
        "ethylene": "Ethylene (C2H4)",
        "propane": "Propane (C3H8)",
        "butane": "n-Butane (C4H10)",
        "pentane": "n-Pentane (C5H12)",
        "heptane": "n-Heptane",
        "dodecane": "n-Dodecane",
        "methanol": "Methanol",
        "pmma": "PMMA (Acrylic)",
        "cotton": "Cotton-Fiberglass Blend",
        "nomex": "Nomex",
    }
    fuels_tested = [label for kw, label in fuel_map.items() if kw in text]
    if not fuels_tested:
        fuels_tested = ["Hydrocarbon / Spacecraft Materials"]

    # 5. Envelope (valores numéricos sin None para sliders 3D)
    o2_min, o2_max = 21.0, 30.0
    if psi_id == "PSI-159":  # ACME CFI-G hasta 85% O2
        o2_min, o2_max = 12.0, 85.0
    elif psi_id in {"PSI-25", "PSI-26"}:  # BASS / BASS-II
        o2_min, o2_max = 15.0, 35.0
    elif "oxygen" in text or "o2" in text:
        o2_min, o2_max = 18.0, 40.0

    pressure_min, pressure_max = 14.7, 14.7
    if any(k in text for k in ["reduced pressure", "sub-atmospheric", "lunar", "bar", "atm"]) or psi_id in {"PSI-25", "PSI-159"}:
        pressure_min, pressure_max = 10.2, 14.7

    airflow_min, airflow_max = 0.0, 5.0
    if hardware_rack in {"MSG-SPICE", "Saffire"} or "coflow" in text or "forced flow" in text:
        airflow_min, airflow_max = 0.0, 30.0

    if psi_id == "PSI-22" or "electric-field" in text or "e-field" in text:
        gravity_regime = "partial_g_proxy"
    elif project_type == "Ground Investigation":
        gravity_regime = "1g_ground_reference"
    else:
        gravity_regime = "0g_microgravity"

    envelope = TestEnvelope(
        o2_min_pct=o2_min,
        o2_max_pct=o2_max,
        pressure_min_psi=pressure_min,
        pressure_max_psi=pressure_max,
        airflow_min_cms=airflow_min,
        airflow_max_cms=airflow_max,
        gravity_regime=gravity_regime,
    )

    lunar_habitat_relevant = bool(
        o2_max >= 30.0 or pressure_min <= 10.2 or gravity_regime == "partial_g_proxy"
    )

    # 6. Sensors Used
    sensor_map = {
        "radiometer": "Radiometers",
        "thermocouple": "Thermocouples",
        "camera": "High-Speed Optical Cameras",
        "photomultiplier": "Photomultiplier Tubes (PMT)",
        "laser": "Laser Diagnostics",
        "spectrometer": "Spectrometers",
        "aerosol": "Aerosol & Smoke Particle Counters",
        "cfd": "3D CFD Simulation Solver",
    }
    sensors_used = [label for kw, label in sensor_map.items() if kw in text]
    if not sensors_used:
        sensors_used = ["Optical Imaging", "Temperature & Radiative Sensors"]

    # 7. Cross-links entre simulaciones en tierra y vuelos padre
    related_map = {
        "PSI-60": ["PSI-107"],
        "PSI-62": ["PSI-25", "PSI-26"],
        "PSI-115": ["PSI-101", "PSI-102"],
        "PSI-117": ["PSI-69", "PSI-142"],
    }
    related_psi_ids = related_map.get(psi_id, [])

    # 8. Resúmenes limpios en inglés y spin-offs terrestres
    obj_clean = re.sub(r"\s+", " ", exp.get("objectives", "")).strip()
    key_findings_summary = (obj_clean[:340] + "...") if len(obj_clean) > 340 else obj_clean

    spinoffs = ["Spacecraft & lunar habitat fire safety protocols"]
    if "Suppression" in pillars:
        spinoffs.append("Fine-water-mist fire extinguishers and clean suppression agents")
    if "Detection" in pillars:
        spinoffs.append("Next-generation photoelectric smoke and aerosol detectors")
    if "Prevention" in pillars:
        spinoffs.append("Fire-resistant protective clothing and low-emission combustor design")

    return {
        "psi_id": psi_id,
        "title": title,
        "doi_citation": exp.get("doi_citation") or f"NASA PSI Investigation {psi_id}",
        "psi_url": exp["psi_url"],
        "project_type": project_type,
        "safety_pillars": pillars,
        "hardware_rack": hardware_rack,
        "fuel_phase": fuel_phase,
        "fuels_tested": fuels_tested,
        "envelope": envelope,
        "lunar_habitat_relevant": lunar_habitat_relevant,
        "sensors_used": sensors_used,
        "variables_compared": f"O2 ({o2_min}-{o2_max}%), Pressure ({pressure_min}-{pressure_max} psi), Airflow ({airflow_min}-{airflow_max} cm/s), Gravity ({gravity_regime})",
        "key_findings_summary": key_findings_summary,
        "earth_spinoff_applications": spinoffs,
        "related_psi_ids": related_psi_ids,
        "video_filename": None,
    }


def main() -> None:
    if not RAW_FILE.exists():
        print(f"[ERROR] No se encuentra {RAW_FILE}")
        return

    raw_data = json.loads(RAW_FILE.read_text(encoding="utf-8"))
    cleaned_records: list[dict[str, Any]] = []

    for item in raw_data:
        structured = infer_metadata(item)
        # Validación estricta con el esquema oficial de contracts/schema.py
        validated = PSIInvestigation(**structured)
        cleaned_records.append(validated.model_dump())

    CLEAN_FILE.write_text(
        json.dumps(cleaned_records, indent=2, ensure_ascii=False),
        encoding="utf-8",
    )
    lunar_count = sum(1 for r in cleaned_records if r["lunar_habitat_relevant"])
    print(f"[OK] Generado {CLEAN_FILE} con {len(cleaned_records)} experimentos validados por Pydantic.")
    print(f"     -> Relevantes para hábitats lunares: {lunar_count}/{len(cleaned_records)}")


if __name__ == "__main__":
    main()