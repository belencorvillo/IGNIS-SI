# IGNIS-SI — Global Repository & Space Apps Compliance Rules

## 1. Strict Workspace Boundaries (4-Person Parallel Workflow)
- **Person 1 (Data Extraction):** Only touch `data-pipeline/` and output raw files locally.
- **Person 2 (SI Search, Classification & API):** Owns `backend/` and generates `contracts/data/catalogo_limpio.json`.
- **Person 3 (Computer Vision):** Only touch `cv-engine/` and output lightweight JSON curves into `contracts/data/cv_telemetry/`.
- **Person 4 (Frontend & 3D Digital Twin):** Only touch `src/`, `public/`, `index.html`, and root config files.
- NEVER modify `contracts/schema.py` or `contracts/types.ts` without notifying the whole team first.

## 2. NASA Space Apps Mandatory Compliance
- **Language:** ALL UI text, labels, charts, summaries, and documentation MUST be in English.
- **Data Attribution:** Every PSI investigation displayed MUST include its `psi_id` and official `doi_citation` ("Cite this Investigation").
- **SI Transparency:** Mark SI-generated summaries/visuals clearly ("SI-Assisted Analysis" / visible watermark on SI-generated media).
- **Branding Restriction:** NEVER generate, alter, or embed official NASA logos, flags, or mission insignias.
- **Scientific Scope:** Explicitly note that rocket engines and propellants are excluded because high flow velocities render combustion gravity-independent.

## 3. Core Domain Constants
- **Exploration-Atmosphere Flag (Lunar Base / Pressurized Rover):** raised when O2 >= 30% **or** Pressure <= 10.2 psi — either condition takes a cabin out of the Earth-normal regime (21% O2, 14.7 psi). NASA's recommended exploration atmosphere is 34% O2 at 8.2 psi; EVA suit is 100% O2 at 4.3 psi. Implemented as `isLunarZone()` in `src/shared/catalog.js`.
- **Hardware Racks:** CIR (ACME gaseous flames, MDCA liquid droplets) and MSG (SPICE forced-flow duct).
- **Partial Gravity:** Bounded via 0g ISS data, 1g ground references, and ACME E-FIELD electric-field proxies (awaiting LUCI and FM2).
