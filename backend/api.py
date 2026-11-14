# backend/api.py
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from motor_psi_ollama import search_experiments

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # Permite que React (Vite) hable con Python
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/buscar")
def buscar(q: str):
    # Llama a tu función de búsqueda dual
    resultados = search_experiments(q)
    return resultados

# Para arrancar este servidor, usa: uvicorn api:app --reload --port 8000