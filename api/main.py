from fastapi import FastAPI, File, UploadFile
import shutil
import requests # <--- Necesitas instalar esto (pip install requests)

app = FastAPI()

@app.post("/predecir")
async def predecir_hojas(imagen: UploadFile = File(...)):
    # 1. Guardamos la imagen en el volumen (como ya sabíamos)
    nombre = imagen.filename
    ruta_guardado = f"/app/volumen/entradas/{nombre}"
    
    with open(ruta_guardado, "wb") as buffer:
        shutil.copyfileobj(imagen.file, buffer)
        
    # 2. ¡LE AVISAMOS A YOLO!
    # Hacemos una petición interna al contenedor llamado "modelo"
    url_yolo = f"http://modelo:8001/ejecutar-yolo/{nombre}"
    
    try:
        # Esperamos a que YOLO responda
        respuesta_yolo = requests.post(url_yolo)
        datos_yolo = respuesta_yolo.json()
        
        # 3. Le devolvemos todo al Frontend
        return {
            "mensaje": "Análisis exitoso",
            "area_pixeles": datos_yolo.get("area"),
            # El frontend buscará la imagen en esta ruta:
            "imagen_resultado": f"/volumen/salidas/{nombre}"
        }
        
    except requests.exceptions.ConnectionError:
        return {"error": "No se pudo comunicar con el contenedor de YOLO"}