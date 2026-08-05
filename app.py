import streamlit as st
import os
from ultralytics import YOLO
from src.calcular_area import calcular_area # Asegúrate de que esta función reciba y retorne lo correcto

# Configuramos las rutas apuntando al volumen de Docker
INPUT_DIR = "/app/datos/entrada"
OUTPUT_DIR = "/app/datos/salida"
RUTA_PESOS = "/app/datos/pesos/best-v2.pt"

# Aseguramos que las carpetas existan
os.makedirs(INPUT_DIR, exist_ok=True)
os.makedirs(OUTPUT_DIR, exist_ok=True)

# st.cache_resource evita que el modelo se cargue de nuevo cada vez que se hace clic en algo
@st.cache_resource
def cargar_modelo():
    return YOLO(RUTA_PESOS)

modelo = cargar_modelo()

# --- INTERFAZ WEB ---
st.title("🌱 Estimador de Área Foliar")

# 1. Sección de Subida de Imágenes
archivo_subido = st.file_uploader("Sube una imagen de una hoja", type=["jpg", "jpeg", "png"])

if archivo_subido is not None:
    # Guardamos la imagen subida en el volumen de entrada (Nuestro "MinIO" local)
    ruta_entrada = os.path.join(INPUT_DIR, archivo_subido.name)
    ruta_salida = os.path.join(OUTPUT_DIR, f"mascara_{archivo_subido.name}")

    with open(ruta_entrada, "wb") as f:
        f.write(archivo_subido.getbuffer())

    # Procesamos la imagen con tu función existente
    with st.spinner("El modelo está analizando la hoja..."):
        hojas, area = calcular_area(modelo, ruta_entrada, ruta_salida)

    st.success(f"¡Análisis completo! Hojas detectadas: {hojas} | Área foliar: {area:.2f} cm²")
    
    # Mostramos el resultado
    st.image(ruta_salida, caption="Imagen Procesada", use_container_width=True)

st.divider()

# 2. Sección de Galería (Historial)
st.header("🖼️ Historial de Imágenes Analizadas")

# Leemos la carpeta de salida para mostrar todo lo que se ha procesado
imagenes_salida = [f for f in os.listdir(OUTPUT_DIR) if f.endswith(('.jpg', '.jpeg', '.png'))]

if imagenes_salida:
    # Creamos una cuadrícula de 3 columnas
    columnas = st.columns(3)
    for idx, img_name in enumerate(imagenes_salida):
        ruta_img = os.path.join(OUTPUT_DIR, img_name)
        # Distribuimos las imágenes en las columnas
        columnas[idx % 3].image(ruta_img, caption=img_name, use_container_width=True)
else:
    st.info("Aún no hay imágenes en el historial. Sube una para comenzar.")