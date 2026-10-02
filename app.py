"""
Plant Foliar Area Estimator
----------------------------
FastAPI interface for a YOLO11-based leaf segmentation and foliar
area calculation pipeline. Developed for CDIA.

Run with: uvicorn app:app --host 0.0.0.0 --port 8000
"""

import os
from contextlib import asynccontextmanager
from pathlib import Path
from typing import List

from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from ultralytics import YOLO

from src.calcular_area import calcular_area

# ============================== CONFIGURACIÓN ==============================

INPUT_DIR = "/app/datos/entrada"
OUTPUT_DIR = "/app/datos/salida"
RUTA_PESOS = "/app/datos/pesos/best-v2.pt"
BASE_DIR = Path(__file__).parent
STATIC_DIR = BASE_DIR / "static"
ASSETS_DIR = BASE_DIR / "assets"

TIPOS_PERMITIDOS = ["jpg", "jpeg", "png"]

os.makedirs(INPUT_DIR, exist_ok=True)
os.makedirs(OUTPUT_DIR, exist_ok=True)
os.makedirs(STATIC_DIR, exist_ok=True)
os.makedirs(ASSETS_DIR, exist_ok=True)

# ================================ MODELO ================================

modelo_global: YOLO | None = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Carga el modelo YOLO al iniciar la aplicación."""
    global modelo_global
    try:
        modelo_global = YOLO(RUTA_PESOS)
    except Exception as exc:
        print(f"Error al cargar el modelo desde '{RUTA_PESOS}': {exc}")
        modelo_global = None
    yield


# ================================ APP ================================

app = FastAPI(
    title="Plant Foliar Area Estimator",
    description="Segmentación de hojas y cálculo de área foliar mediante YOLO11",
    version="1.0.0",
    lifespan=lifespan,
)

# Archivos estáticos
app.mount("/static", StaticFiles(directory=STATIC_DIR), name="static")
app.mount("/assets", StaticFiles(directory=ASSETS_DIR), name="assets")


# ================================ UTILIDADES ================================

def _get_model() -> YOLO:
    if modelo_global is None:
        raise HTTPException(
            status_code=500,
            detail="El modelo no ha podido cargarse. Verifica la ruta de los pesos.",
        )
    return modelo_global


def _listar_archivos_recientes(carpeta: str) -> List[str]:
    """Devuelve nombres de imágenes ordenados más recientes primero."""
    try:
        archivos = [
            f
            for f in os.listdir(carpeta)
            if f.lower().endswith(tuple(f".{t}" for t in TIPOS_PERMITIDOS))
        ]
        archivos.sort(
            key=lambda x: os.path.getmtime(os.path.join(carpeta, x)),
            reverse=True,
        )
        return archivos
    except FileNotFoundError:
        return []


# ================================ ENDPOINTS ================================

@app.get("/")
async def root():
    """Sirve la página principal."""
    index_path = STATIC_DIR / "index.html"
    if not index_path.exists():
        raise HTTPException(status_code=404, detail="index.html no encontrado")
    return FileResponse(index_path)


@app.post("/api/analyze")
async def analyze_image(file: UploadFile = File(...)):
    """Procesa una imagen y devuelve resultados de segmentación."""
    if not file.filename:
        raise HTTPException(status_code=400, detail="Nombre de archivo inválido")

    extension = file.filename.lower().split(".")[-1]
    if extension not in TIPOS_PERMITIDOS:
        raise HTTPException(
            status_code=400,
            detail=f"Formato no permitido. Usar: {', '.join(TIPOS_PERMITIDOS)}",
        )

    modelo = _get_model()

    # Guardar imagen de entrada
    ruta_entrada = os.path.join(INPUT_DIR, file.filename)
    try:
        contenido = await file.read()
        with open(ruta_entrada, "wb") as f:
            f.write(contenido)
    except Exception as exc:
        raise HTTPException(
            status_code=500, detail=f"Error al guardar la imagen: {exc}"
        )

    # Procesar imagen
    nombre_salida = f"mascara_{file.filename}"
    ruta_salida = os.path.join(OUTPUT_DIR, nombre_salida)

    try:
        hojas, area_total, detalle_hojas = calcular_area(
            modelo, ruta_entrada, ruta_salida
        )
    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail=f"No fue posible procesar la imagen: {exc}",
        )

    # Preparar respuesta
    per_leaf = [
        {"numero": h["numero"], "area_cm2": round(float(h["area_cm2"]), 4)}
        for h in detalle_hojas
    ]

    return JSONResponse(
        {
            "success": True,
            "leaves": int(hojas),
            "total_area_cm2": round(float(area_total), 4),
            "per_leaf": per_leaf,
            "original_url": f"/api/input/{file.filename}",
            "original_filename": file.filename,
            "mask_filename": nombre_salida,
            "mask_url": f"/api/output/{nombre_salida}",
            "download_url": f"/api/output/{nombre_salida}",
        }
    )


@app.get("/api/gallery")
async def get_gallery():
    """Obtiene el listado de imágenes procesadas (más recientes primero)."""
    imagenes = _listar_archivos_recientes(OUTPUT_DIR)
    items = [
        {
            "filename": img,
            "url": f"/api/output/{img}",
            "original_name": img.replace("mascara_", "", 1)
            if img.startswith("mascara_")
            else img,
        }
        for img in imagenes
    ]
    return {"count": len(items), "items": items}


@app.post("/api/clear")
@app.delete("/api/clear")
async def clear_history():
    """Elimina todos los archivos de entrada y salida."""
    eliminados = 0
    try:
        for carpeta in (INPUT_DIR, OUTPUT_DIR):
            if os.path.exists(carpeta):
                for archivo in os.listdir(carpeta):
                    ruta_archivo = os.path.join(carpeta, archivo)
                    if os.path.isfile(ruta_archivo):
                        os.remove(ruta_archivo)
                        eliminados += 1
    except Exception as exc:
        raise HTTPException(
            status_code=500, detail=f"Error al limpiar historial: {exc}"
        )

    return {"success": True, "deleted": eliminados}


@app.get("/api/input/{filename}")
async def get_input_image(filename: str):
    """Sirve una imagen original subida."""
    ruta = os.path.join(INPUT_DIR, filename)
    if not os.path.exists(ruta) or not os.path.isfile(ruta):
        raise HTTPException(status_code=404, detail="Imagen no encontrada")
    return FileResponse(ruta)


@app.get("/api/output/{filename}")
async def get_output_image(filename: str):
    """Sirve una imagen procesada (máscara)."""
    ruta = os.path.join(OUTPUT_DIR, filename)
    if not os.path.exists(ruta) or not os.path.isfile(ruta):
        raise HTTPException(status_code=404, detail="Imagen no encontrada")
    return FileResponse(ruta)