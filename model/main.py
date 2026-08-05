from fastapi import FastAPI
from pydantic import BaseModel
from ultralytics import YOLO
import os

app = FastAPI()

RUTA_PESOS = "/app/volumen/pesos/best-v1.pt"
print("Cargando modelo...")
modelo = YOLO(RUTA_PESOS) if os.path.exists(RUTA_PESOS) else None

@app.post("/ejecutar-yolo/{nombre_imagen}")
def procesar_imagen(nombre_imagen: str):
    if not modelo:
        return {"error": "Modelo no cargado"}

    ruta_entrada = f"/app/volumen/entradas/{nombre_imagen}"
    ruta_salida = f"/app/volumen/salidas/{nombre_imagen}"

    # 1. Ejecutar YOLO
    resultados = modelo.predict(
        source=ruta_entrada,
        save=True,
        project="/app/volumen",
        name="salidas",
        exist_ok=True
    )

    # 2. (Opcional) Aquí puedes extraer el área con las máscaras (resultados[0].masks)
    area_calculada = 4500 # Valor simulado por ahora
    
    # 3. Retornar el aviso de que ya terminó
    return {
        "estado": "completado",
        "area": area_calculada,
        "ruta_mascara": ruta_salida
    }