import streamlit as st
import os
from ultralytics import YOLO
from src.calcular_area import calcular_area

# -------------------- DATOS PREVIOS ------------------------
# Configuramos las rutas apuntando al volumen de Docker
INPUT_DIR = "/app/datos/entrada"
OUTPUT_DIR = "/app/datos/salida"
RUTA_PESOS = "/app/datos/pesos/best-v2.pt"

os.makedirs(INPUT_DIR, exist_ok=True)
os.makedirs(OUTPUT_DIR, exist_ok=True)

@st.cache_resource
def cargar_modelo():
    return YOLO(RUTA_PESOS)

modelo = cargar_modelo()


# -------------------- Página ----------------------------

# Esto cambia el título de la pestaña del navegador y usa todo el ancho del monitor
st.set_page_config(
    page_title="Plant foliar area estimator",
    page_icon="🌿",
    layout="wide"
)

# --- BARRA LATERAL (SIDEBAR) ---
with st.sidebar:
    st.header("⚙️ Panel de Control")
    st.write("Proyecto del CDIA.")
    st.info("Este sistema utiliza inteligencia artificial (YOLO11) para la segmentación de hojas y cálculo dinámico del área foliar en centímetros cuadrados.")
    
    st.divider()
    
    # Botón de limpieza (Bota los archivos de entrada y salida)
    if st.button("🗑️ Limpiar Historial de Análisis"):
        for carpeta in [INPUT_DIR, OUTPUT_DIR]:
            for archivo in os.listdir(carpeta):
                ruta_archivo = os.path.join(carpeta, archivo)
                if os.path.isfile(ruta_archivo):
                    os.remove(ruta_archivo)
        st.success("Historial eliminado correctamente.")
        st.rerun() # Refresca la página automáticamente
    

# --- INTERFAZ PRINCIPAL ---
st.title("🌿 Plant foliar area estimator")
st.write("Sube la imagen de una muestra y el modelo calculará automáticamente la superficie. Como regla general, las imagenes deben ser en formato JPG, JPEG y PNG.")

# 1. Sección de Subida de Imágenes
archivo_subido = st.file_uploader("Selecciona una fotografía (JPG, PNG)", type=["jpg", "jpeg", "png"])

if archivo_subido is not None:
    ruta_entrada = os.path.join(INPUT_DIR, archivo_subido.name)
    ruta_salida = os.path.join(OUTPUT_DIR, f"mascara_{archivo_subido.name}")

    with open(ruta_entrada, "wb") as f:
        f.write(archivo_subido.getbuffer())

    with st.spinner("🧠 El modelo está procesando la imagen..."):
        hojas, area = calcular_area(modelo, ruta_entrada, ruta_salida)

    # --- RESULTADOS DESTACADOS ---
    st.subheader("Resultados del Análisis")
    
    # Tarjetas de métricas
    col_metrica1, col_metrica2 = st.columns(2)
    col_metrica1.metric(label="Hojas Detectadas", value=hojas)
    col_metrica2.metric(label="Área Foliar Total", value=f"{area:.2f} cm²")
    
    # Comparación Visual en 2 columnas
    st.subheader("Comparación Visual")
    img_col1, img_col2 = st.columns(2)
    
    with img_col1:
        st.image(ruta_entrada, caption="Fotografía Original", use_container_width=True)
    with img_col2:
        st.image(ruta_salida, caption="Máscara de Segmentación", use_container_width=True)

    # Botón para descargar el resultado
    with open(ruta_salida, "rb") as file:
        st.download_button(
            label="⬇️ Descargar Imagen Procesada",
            data=file,
            file_name=f"analisis_{archivo_subido.name}",
            mime="image/jpeg"
        )

st.divider()

# 2. Sección de Galería (Historial)
st.header("Historial de Muestras")

# Leemos y ordenamos por fecha de modificación (las más nuevas primero)
imagenes_salida = [f for f in os.listdir(OUTPUT_DIR) if f.endswith(('.jpg', '.jpeg', '.png'))]
imagenes_salida.sort(key=lambda x: os.path.getmtime(os.path.join(OUTPUT_DIR, x)), reverse=True)

if imagenes_salida:
    # Un expander mantiene la página limpia si el historial crece mucho
    with st.expander("Ver galería completa de análisis previos", expanded=True):
        columnas = st.columns(3)
        for idx, img_name in enumerate(imagenes_salida):
            ruta_img = os.path.join(OUTPUT_DIR, img_name)
            columnas[idx % 3].image(ruta_img, caption=img_name, use_container_width=True)
else:
    st.info("El historial está vacío. Sube una fotografía para registrar tu primer análisis.")