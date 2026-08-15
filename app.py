"""
Plant Foliar Area Estimator
----------------------------
Streamlit interface for a YOLO11-based leaf segmentation and foliar
area calculation pipeline. Developed for CDIA.

Run with: streamlit run app.py
"""

import os
from pathlib import Path
from textwrap import dedent

import streamlit as st
from streamlit_theme import st_theme
from ultralytics import YOLO

from src.calcular_area import calcular_area

# ============================== CONFIGURACIÓN ==============================

INPUT_DIR = "/app/datos/entrada"
OUTPUT_DIR = "/app/datos/salida"
RUTA_PESOS = "/app/datos/pesos/best-v2.pt"
RUTA_ESTILOS = Path(__file__).parent / "assets" / "styles.css"

TIPOS_PERMITIDOS = ["jpg", "jpeg", "png"]

os.makedirs(INPUT_DIR, exist_ok=True)
os.makedirs(OUTPUT_DIR, exist_ok=True)


# ================================ UTILIDADES ================================

def render_html(bloque_html: str) -> None:
    """
    Renderiza un bloque HTML multilínea.

    Streamlit pasa el texto de st.markdown por un parser de Markdown antes
    de insertar el HTML: si el bloque queda indentado (como ocurre de forma
    natural al escribir un f-string dentro de una función), Markdown lo
    interpreta como un bloque de código en vez de HTML crudo, rompiendo el
    render. dedent() + strip() eliminan esa indentación común antes de pasarlo.
    """
    st.markdown(dedent(bloque_html).strip(), unsafe_allow_html=True)


def inyectar_estilos(ruta_css: Path) -> None:
    """Carga el CSS personalizado e inyecta dinámicamente las variables de tema."""
    
    # Capturamos el tema actual (detecta tanto OS como el menú manual)
    tema_info = st_theme()
    es_oscuro = tema_info is not None and tema_info.get("base") == "dark"

    # Definimos la paleta base dependiendo del modo
    if es_oscuro:
        css_variables = """
        :root {
            --color-bg: #0E1117;          /* Fondo oscuro de Streamlit */
            --color-surface: #262730;     /* Superficie oscura */
            --color-text: #FAFAFA;        /* Texto claro */
        }
        """
    else:
        css_variables = """
        :root {
            --color-bg: #F4F7F1;          /* Tu fondo verde pálido original */
            --color-surface: #FFFFFF;     /* Tu superficie blanca */
            --color-text: #1B231C;        /* Tu texto oscuro */
        }
        """

    # Inyectamos primero las variables dinámicas y luego tu archivo CSS
    if ruta_css.exists():
        css_base = ruta_css.read_text()
        st.markdown(
            f"<style>\n{css_variables}\n{css_base}\n</style>", 
            unsafe_allow_html=True
        )


@st.cache_resource(show_spinner=False)
def cargar_modelo(ruta_pesos: str) -> YOLO:
    """Carga el modelo YOLO una sola vez y lo mantiene en caché."""
    return YOLO(ruta_pesos)


def listar_imagenes(carpeta: str) -> list[str]:
    """Devuelve los nombres de imagen de una carpeta, más recientes primero."""
    archivos = [f for f in os.listdir(carpeta) if f.lower().endswith(tuple(f".{t}" for t in TIPOS_PERMITIDOS))]
    archivos.sort(key=lambda x: os.path.getmtime(os.path.join(carpeta, x)), reverse=True)
    return archivos


def limpiar_historial() -> None:
    """Elimina todos los archivos de entrada y salida."""
    for carpeta in (INPUT_DIR, OUTPUT_DIR):
        for archivo in os.listdir(carpeta):
            ruta_archivo = os.path.join(carpeta, archivo)
            if os.path.isfile(ruta_archivo):
                os.remove(ruta_archivo)
    st.session_state.pop("ultimo_resultado", None)
    st.session_state.pop("ultimo_archivo", None)


# ================================ COMPONENTES ================================

def render_header() -> None:
    render_html(
        """
        <div class="app-header">
            <div class="app-header__icon">🌿</div>
            <div>
                <p class="app-header__eyebrow">CDIA · Visión computacional</p>
                <p class="app-header__title">Plant Foliar Area Estimator</p>
                <p class="app-header__subtitle">
                    Segmentación de hojas y cálculo de área foliar mediante YOLO11.
                </p>
            </div>
        </div>
        """
    )


def render_sidebar() -> None:
    with st.sidebar:
        st.header("⚙️ Panel de control")
        st.write("Proyecto del CDIA.")
        st.info(
            "Este sistema utiliza inteligencia artificial (YOLO11) para la "
            "segmentación de hojas y el cálculo dinámico del área foliar "
            "en centímetros cuadrados."
        )

        st.divider()

        if st.button("🗑️ Limpiar historial de análisis", width="stretch"):
            limpiar_historial()
            st.success("Historial eliminado correctamente.")
            st.rerun()


def render_metricas(hojas: int, area: float) -> None:
    render_html(
        f"""
        <div class="specimen-row">
            <div class="specimen-card">
                <p class="specimen-card__label">Hojas detectadas</p>
                <p class="specimen-card__value">{hojas}</p>
            </div>
            <div class="specimen-card">
                <p class="specimen-card__label">Área foliar total</p>
                <p class="specimen-card__value">{area:.2f} cm²</p>
            </div>
        </div>
        """
    )


def render_detalle_hojas(detalle_hojas: list[dict]) -> None:
    """Muestra el área individual de cada hoja detectada, en una tabla compacta."""
    if not detalle_hojas:
        return

    filas = "".join(
        f"<tr><td>Hoja {hoja['numero']}</td><td>{hoja['area_cm2']:.2f} cm²</td></tr>"
        for hoja in detalle_hojas
    )

    render_html('<p class="section-eyebrow">Detalle por hoja</p>')
    render_html(
        f"""
        <table class="leaf-table">
            <thead>
                <tr>
                    <th>Ejemplar</th>
                    <th>Área individual</th>
                </tr>
            </thead>
            <tbody>
                {filas}
            </tbody>
        </table>
        """
    )


def render_analisis(modelo: YOLO, archivo_subido) -> None:
    ruta_entrada = os.path.join(INPUT_DIR, archivo_subido.name)
    ruta_salida = os.path.join(OUTPUT_DIR, f"mascara_{archivo_subido.name}")

    with open(ruta_entrada, "wb") as f:
        f.write(archivo_subido.getbuffer())

    try:
        with st.spinner("🧠 El modelo está procesando la imagen..."):
            hojas, area, detalle_hojas = calcular_area(modelo, ruta_entrada, ruta_salida)
    except Exception as exc:
        st.error(
            "No fue posible procesar la imagen. Verifica que el archivo "
            f"corresponda a una fotografía válida. Detalle técnico: {exc}"
        )
        return

    render_html('<p class="section-eyebrow">Resultados del análisis</p>')
    render_metricas(hojas, area)
    render_detalle_hojas(detalle_hojas)

    render_html('<p class="section-eyebrow">Comparación visual</p>')
    img_col1, img_col2 = st.columns(2)
    with img_col1:
        st.image(ruta_entrada, caption="Fotografía original", width="stretch")
    with img_col2:
        st.image(ruta_salida, caption="Máscara de segmentación", width="stretch")

    with open(ruta_salida, "rb") as file:
        st.download_button(
            label="⬇️ Descargar imagen procesada",
            data=file,
            file_name=f"analisis_{archivo_subido.name}",
            mime="image/jpeg",
            width="content",
        )


def render_galeria() -> None:
    render_html('<p class="section-eyebrow">Historial de muestras</p>')

    imagenes_salida = listar_imagenes(OUTPUT_DIR)

    if not imagenes_salida:
        st.info("El historial está vacío. Sube una fotografía para registrar tu primer análisis.")
        return

    with st.expander(f"Ver galería completa ({len(imagenes_salida)} muestras)", expanded=True):
        columnas = st.columns(3)
        for idx, img_name in enumerate(imagenes_salida):
            ruta_img = os.path.join(OUTPUT_DIR, img_name)
            columnas[idx % 3].image(ruta_img, caption=img_name, width="stretch")


def render_footer() -> None:
    render_html('<p class="app-footer">Plant Foliar Area Estimator · CDIA · Impulsado por YOLO11</p>')


# ================================== MAIN ====================================

def main() -> None:
    st.set_page_config(
        page_title="Plant foliar area estimator",
        page_icon="🌿",
        layout="wide",
    )
    inyectar_estilos(RUTA_ESTILOS)

    try:
        modelo = cargar_modelo(RUTA_PESOS)
    except Exception as exc:
        st.error(f"No fue posible cargar el modelo desde '{RUTA_PESOS}'. Detalle: {exc}")
        st.stop()

    render_header()
    render_sidebar()

    render_html('<p class="section-eyebrow">Nueva muestra</p>')
    st.write(
        "Sube la imagen de una muestra y el modelo calculará automáticamente la "
        "superficie. Formatos admitidos: JPG, JPEG y PNG."
    )
    archivo_subido = st.file_uploader(
        "Selecciona una fotografía (JPG, PNG)",
        type=TIPOS_PERMITIDOS,
        label_visibility="collapsed",
    )

    if archivo_subido is not None:
        render_analisis(modelo, archivo_subido)

    st.divider()
    render_galeria()
    render_footer()


if __name__ == "__main__":
    main()