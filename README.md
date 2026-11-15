# 🔥 IGNIS-SI: Microgravity Combustion Explorer

[![Python](https://img.shields.io/badge/Python-3.10.19-FFD43B)](https://www.python.org/downloads/)
[![Node.js](https://img.shields.io/badge/Node.js-18%2B-339933)](https://nodejs.org/)
[![React](https://img.shields.io/badge/Frontend-React%2019%20%2B%20Vite-646CFF)](https://vitejs.dev/)
[![FastAPI](https://img.shields.io/badge/Backend-FastAPI-009688)](https://fastapi.tiangolo.com/)
[![Ollama](https://img.shields.io/badge/LLM-Ollama%20(local)-000000)](https://ollama.com/)
[![YOLO](https://img.shields.io/badge/Vision-YOLO%20(Ultralytics)-00FFFF)](https://docs.ultralytics.com/)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)

**IGNIS-SI** is a web application built for the **NASA Space Apps Challenge**. It turns NASA's **Physical Sciences Informatics (PSI)** microgravity combustion experiments into something a mission planner can explore in minutes instead of weeks.

PSI data is hard to find, hard to compare and hard to interpret. IGNIS-SI addresses this with three connected tools:

1. **Interactive, animated simulator.** Change experiment variables (gravity level, atmosphere, oxygen concentration, pressure, among others) and see how flame behavior changes across environments.
2. **Plain-language search.** A locally run LLM (via **Ollama**) over a structured **SQLite** database of PSI investigations understands a question such as *"how does low oxygen affect flame spread?"* and returns the most relevant experiments.
3. **Research tab.** Links current microgravity combustion studies to future research on next-generation fire-safety controls and equipment for cabins and bases on the lunar and Martian surfaces. On Earth, possible applications are included to support fire-safety decisions.

## Demo

<!-- Replace with your video / screenshot:
[![Watch the demo](docs/img/demo.png)](https://youtu.be/XXXXXXXXXXX)
> Click the image to open the demo.
-->

A demo video will be linked here.

## Main Features

- **Animated 3D flame simulator** (React Three Fiber) with presets, a match score against real PSI experiments, hazard and advisory rules, and a partial-gravity chart.
- **Natural-language search** powered by a local LLM (`qwen2.5` through Ollama), with a closed tag taxonomy (PSI IDs, gravity regime, atmosphere, fuel phase, hardware rack, sensors, flame phenomena) and hybrid ranking over a SQLite index.
- **Investigation library** with filters, local search with domain synonyms, side-by-side comparison ("what changed / what stayed the same") and a 3D knowledge graph.
- **Applications tab** covering next-generation fire-safety equipment for lunar/Martian habitats and fire-safety decisions on Earth, with 3D objects and documented NASA sources.
- **Get data** page to filter the catalog and download **CSV / JSON** for your own models.
- **Computer-vision annotation pipeline** (YOLO) to automatically annotate combustion videos for the database: raw fuel, flame, burning fuel and fuel residue.
- **Data attribution built in:** every PSI investigation shows its `psi_id` and an official DOI citation ("Cite this Investigation").
- **Transparent use of SI:** SI-generated summaries and visuals are explicitly marked as *SI-Assisted Analysis*.

## Repository Structure

```text
IGNIS-SI/
├── package.json / vite.config.js / index.html
├── requirements.txt
├── CLAUDE.md                 # Team workflow and Space Apps compliance rules
├── backend/
│   ├── api.py                # FastAPI server (GET /buscar?q=...)
│   ├── motor_psi_ollama.py   # PSI indexing, LLM tagging and hybrid search (SQLite + Ollama)
│   ├── nube.py               # Knowledge-graph generation from the index (pyvis)
│   ├── catalogo_limpio.json  # Cleaned PSI catalog
│   ├── datos_raw/            # Raw PSI data files to classify and index
│   └── lib/                  # Graph visualization libraries
├── contracts/
│   ├── schema.py             # Python data contract
│   ├── types.ts              # TypeScript data contract
│   └── data/                 # catalogo_limpio.json and mock_catalogo.json
├── entrenamiento_yolo/
│   └── entrenamiento_yolo/
│       ├── frames/               # Video frames + LabelMe annotations (.json)
│       ├── jsons2dataset.py      # LabelMe JSON → YOLO dataset
│       ├── creador_d_copias.py   # Data augmentation (image copies)
│       ├── train.py              # YOLO training
│       ├── dataset_yolo/         # Generated dataset (images, labels, dataset.yaml)
│       └── renderizar_videos/
│           └── video.py          # Run the trained model over a video
├── src/
│   ├── App.jsx / main.jsx / index.css
│   ├── pages/
│   │   ├── simulator/        # Simulator tab
│   │   ├── library/          # Library tab
│   │   ├── earth/            # Applications tab (3D models + content)
│   │   ├── data/             # Get data (CSV / JSON export)
│   │   └── about/            # About us
│   └── shared/               # Catalog loader, citation modal, UI components
├── public/                   # Static assets and 3D models
└── inspo/                    # Design inspiration and references
```

## System Overview

```text
        ┌──────────────────────────────────────┐
        │  Frontend (React + Vite + Three.js)  │
        │  Simulator · Library · Applications  │
        │  Get data · Cite data · About us     │
        └──────────┬───────────────────┬───────┘
                   │ REST (FastAPI)    │ fallback
                   ▼                   ▼
        ┌────────────────────┐  ┌─────────────────────────┐
        │  backend/api.py    │  │ contracts/data/*.json   │
        │  /buscar?q=...     │  │ (clean catalog / mock)  │
        └─────────┬──────────┘  └─────────────────────────┘
                  ▼
        ┌────────────────────┐        ┌──────────────────────────┐
        │ motor_psi_ollama   │───────▶│ SQLite index             │
        │ Ollama (qwen2.5)   │        │ (psi_index.db)           │
        └────────────────────┘        └──────────────────────────┘

        ┌────────────────────────────────────────────┐
        │ entrenamiento_yolo (offline)               │
        │ frames → LabelMe → dataset → train → video │
        └────────────────────────────────────────────┘
```

## Components

### Frontend (`src/`, `public/`, `index.html`)

React 19 + Vite application styled with Tailwind CSS 4. 3D scenes use `three`, `@react-three/fiber` and `@react-three/drei`; charts use Recharts. Each tab has its own folder under `src/pages/` (see [`src/README.md`](src/README.md)).

The catalog loader tries, in order: the FastAPI backend (`VITE_API_URL`, default `http://localhost:8000`), then `contracts/data/catalogo_limpio.json`, then `contracts/data/mock_catalogo.json`. The frontend therefore keeps working even if the backend is not running.

### Backend (`backend/`)

- `motor_psi_ollama.py` classifies and indexes the PSI catalog and raw data files into a SQLite database using a closed taxonomy of tags (PSI IDs, project type, safety pillar, hardware rack, fuel phase, fuels, sensors, gravity and atmosphere regimes, flame phenomena). It runs a hybrid query over that index and returns the most relevant files and experiments.
- `api.py` exposes the search through FastAPI.
- `nube.py` builds an interactive knowledge graph of the indexed documents.

### Data contracts (`contracts/`)

`schema.py` and `types.ts` define the shared investigation format, so frontend and backend evolve in a coordinated way.

### Computer vision (`entrenamiento_yolo/`)

An offline pipeline to train a custom YOLO model that automatically annotates combustion videos. The processed results are used to enrich the database (for example, the YOLO-annotated PSI-69 video shown in the app). See [Training the YOLO Model](#training-the-yolo-model).

## Requirements

- **Git**
- **Node.js** 18+ and **npm**
- **Python 3.10.19** (use Miniconda / Conda or `pyenv` to pin the exact version)
- **[Ollama](https://ollama.com/)** running locally, for the LLM-based search
- An NVIDIA GPU is recommended for YOLO training (`requirements.txt` pins CUDA 12.1 builds of PyTorch)

## Installation

Clone the repository:

```bash
git clone https://github.com/belencorvillo/IGNIS-SI.git
cd IGNIS-SI
```

Install the frontend dependencies:

```bash
npm install
```

Install the backend dependencies, using Conda:

```bash
conda create -n ignis-si python=3.10.19
conda activate ignis-si
pip install -r requirements.txt
```

or `pyenv` + `venv`:

```bash
pyenv install 3.10.19
pyenv local 3.10.19
python -m venv .venv
source .venv/bin/activate        # On Windows: .venv\Scripts\activate
pip install -r requirements.txt
```

> `requirements.txt` is a full environment freeze that also covers the YOLO training tools (Ultralytics, Albumentations, LabelMe) and is large.

Download the local LLM used by the search engine:

```bash
ollama pull qwen2.5
```

## Running the System

### 1. Index the PSI data (first run only)

```bash
cd backend
python motor_psi_ollama.py --catalog catalogo_limpio.json
```

This creates the SQLite index (`psi_index.db`), indexes the catalog and then classifies the raw files in `datos_raw/`. Useful options:

| Option | Description |
|---|---|
| `--catalog <file>` | Path to the catalog JSON to index. |
| `--folder <dir>` | Raw data folder to classify (default `datos_raw`). |
| `--file <path>` | Classify and index a single file. |
| `--search "<query>"` | Run a semantic search from the command line. |
| `--no-search` | Skip the test search after indexing. |

### 2. Start the backend API

```bash
cd backend
uvicorn api:app --reload --port 8000
```

Example request: `http://localhost:8000/buscar?q=how does low oxygen affect flame spread`

### 3. Start the frontend

```bash
npm run dev
```

The app is available at `http://localhost:5173`. To point it at a different backend, set `VITE_API_URL`.

### Scripts

| Command | Description |
|---|---|
| `npm run dev` | Vite development server. |
| `npm run build` | Production build. |
| `npm run preview` | Preview the production build. |
| `npm run lint` | Static analysis with Oxlint. |

## Training the YOLO Model

The `entrenamiento_yolo` folder contains the pipeline used to train a new model for the **automatic annotation of videos**. Run the scripts from `entrenamiento_yolo/entrenamiento_yolo/`.

**Classes:** `raw_fuel`, `flame`, `burning_fuel`, `fuel_residue`.

> The LabelMe labels must use the exact names defined in `jsons2dataset.py` (`conbustible_raw`, `llama`, `combustible_quemando`, `residuo_combustible`). `video.py` then renames the classes to English for the rendered output.

1. **Extract and label the frames.** Place the frames of the videos you want to detect inside `frames/`, then label them with **LabelMe** (`labelme`). One `.json` file is created next to each image. Images without annotations are kept as negative (background) examples.
2. **Create the YOLO dataset.**
   ```bash
   python jsons2dataset.py
   ```
   Converts the LabelMe annotations into YOLO format and creates the 80% / 20% train/validation split in `dataset_yolo/`.
3. **Augment the dataset.**
   ```bash
   python creador_d_copias.py
   ```
   Creates several copies of each training image (brightness/contrast, noise and color-shift variations, with no geometric changes) to enlarge the dataset and make the model more robust.
4. **Train the model.**
   ```bash
   python train.py
   ```
   Fine-tunes a YOLO nano model (`yolo26n.pt`) on `dataset_yolo/dataset.yaml` for 60 epochs at 1024 px. The resulting weights are saved by Ultralytics under `runs/detect/.../weights/best.pt`.
5. **Process the videos.** Copy `best.pt` and the video next to `renderizar_videos/video.py`, then run:
   ```bash
   cd renderizar_videos
   python video.py
   ```
   Runs the trained model frame by frame and writes the annotated video (`resultado_ISS.avi`), which feeds the database. Video files (`*.mp4`, `*.avi`, ...) are excluded from Git.

## NASA Space Apps Compliance

- **Language:** all UI text, charts, summaries and documentation are in English.
- **Data attribution:** every PSI investigation includes its `psi_id` and official `doi_citation`.
- **SI transparency:** SI-generated summaries and visuals are clearly marked as *SI-Assisted Analysis*.
- **Branding:** no official NASA logos, flags or mission insignias are used. This project is **not affiliated with or endorsed by NASA**.
- **Scientific scope:** rocket engines and propellants are excluded, because high flow velocities make combustion gravity-independent.

## Notes

- **Exploration-atmosphere flag:** a cabin is flagged when O₂ ≥ 30% **or** pressure ≤ 10.2 psi, since either condition takes it out of the Earth-normal regime (21% O₂, 14.7 psi). NASA's recommended exploration atmosphere is 34% O₂ at 8.2 psi; the EVA suit uses 100% O₂ at 4.3 psi.
- **Hardware racks:** CIR (ACME gaseous flames, MDCA liquid droplets) and MSG (SPICE forced-flow duct).
- **Partial gravity:** bounded through 0g ISS data, 1g ground references and ACME E-FIELD electric-field proxies (awaiting LUCI and FM2).
- Large NASA PSI data files and videos are not stored in this repository.
- The simulator is a decision-support tool for exploration and comparison, not a replacement for certified fire-safety analysis.

## Authors

| Name | LinkedIn |
|---|---|
| **Belén Corvillo Guerra** | [belen-corvillo-guerra](https://www.linkedin.com/in/belen-corvillo-guerra/) |
| **Eduardo Ugarte Álvarez** | [eduardo-ugarte-álvarez](https://www.linkedin.com/in/eduardo-ugarte-%C3%A1lvarez-637906334/) |
| **Mario Rodríguez Barrera** | [mario-rod-barrera](https://www.linkedin.com/in/mario-rod-barrera/) |
| **Víctor Gil Ferrer** | [víctor-gil-ferrer](https://www.linkedin.com/in/v%C3%ADctor-gil-ferrer-43baa3394/) |

Project repository: [belencorvillo/IGNIS-SI](https://github.com/belencorvillo/IGNIS-SI)

## Acknowledgements

Experiment data comes from NASA's **Physical Sciences Informatics (PSI)** database. Please cite each investigation with its DOI, as shown in the app ("Cite data").

## License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for details. NASA PSI data remains subject to its own terms of use.
