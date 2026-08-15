import cv2
import numpy as np

# Dimensiones físicas de la superficie fotografiada
ANCHO_FISICO_CM = 30.0
ALTO_FISICO_CM = 21.8
AREA_TOTAL_CM2 = ANCHO_FISICO_CM * ALTO_FISICO_CM

# Estilo de las anotaciones (BGR, como espera OpenCV)
COLOR_RELLENO = (130, 20, 20)
COLOR_BORDE = (255, 50, 50)
COLOR_ETIQUETA_FONDO = (40, 40, 40)
COLOR_ETIQUETA_TEXTO = (255, 255, 255)
OPACIDAD_RELLENO = 0.5
FUENTE = cv2.FONT_HERSHEY_SIMPLEX

# --- Escalado proporcional a la resolución ---
# Diagonal (en píxeles) de una imagen "de referencia" ~1920x1080, sobre la que
# se calibraron los valores base de escala/grosor/margen que usábamos antes.
DIAGONAL_REFERENCIA_PX = (1920**2 + 1080**2) ** 0.5

ESCALA_TEXTO_BASE = 0.55
GROSOR_TEXTO_BASE = 1
MARGEN_ETIQUETA_BASE = 4
GROSOR_CONTORNO_BASE = 2
GROSOR_CAJA_BASE = 1

# Límites para que el texto nunca desaparezca (imágenes muy chicas) ni se
# vuelva desproporcionado (imágenes muy grandes, ej. 6800x9500).
ESCALA_TEXTO_MIN = 0.5
ESCALA_TEXTO_MAX = 4.0


def _calcular_factor_escala(ancho_px: int, alto_px: int) -> float:
    """Factor de escalado de anotaciones, proporcional al tamaño de la imagen."""
    diagonal_px = (ancho_px**2 + alto_px**2) ** 0.5
    return diagonal_px / DIAGONAL_REFERENCIA_PX


def _dibujar_etiqueta(img: np.ndarray, texto: str, punto: tuple, factor_escala: float) -> None:
    """Dibuja una etiqueta tipo 'chip' (fondo sólido + texto), escalada a la imagen."""
    x, y = punto

    escala = max(ESCALA_TEXTO_MIN, min(ESCALA_TEXTO_BASE * factor_escala, ESCALA_TEXTO_MAX))
    grosor = max(1, round(GROSOR_TEXTO_BASE * factor_escala))
    margen = max(4, round(MARGEN_ETIQUETA_BASE * factor_escala))

    (ancho_texto, alto_texto), _ = cv2.getTextSize(texto, FUENTE, escala, grosor)

    esquina_sup = (x - margen, y - alto_texto - margen)
    esquina_inf = (x + ancho_texto + margen, y + margen)

    cv2.rectangle(img, esquina_sup, esquina_inf, COLOR_ETIQUETA_FONDO, -1)
    cv2.putText(img, texto, (x, y), FUENTE, escala, COLOR_ETIQUETA_TEXTO, grosor, cv2.LINE_AA)


def calcular_area(modelo, ruta_imagen, ruta_salida) -> tuple:
    """
    Ejecuta la segmentación sobre una imagen y anota cada hoja detectada.

    Devuelve:
        contador_hojas (int): número total de hojas detectadas.
        area_total_hojas_cm2 (float): suma del área de todas las hojas, en cm².
        detalle_hojas (list[dict]): una entrada por hoja, con su número y su
            área individual en cm², por ejemplo:
            [{"numero": 1, "area_cm2": 12.34}, {"numero": 2, "area_cm2": 9.81}]
    """

    img = cv2.imread(ruta_imagen)

    if img is None:
        print(f"Error: No se pudo cargar la imagen en {ruta_imagen}")
        return 0, 0.0, []

    # Calcular la resolución en píxeles de ESTA imagen específica
    alto_px, ancho_px = img.shape[:2]
    area_total_px = alto_px * ancho_px

    # Calcular el factor de conversión dinámico (cm² por píxel)
    factor_conversion = AREA_TOTAL_CM2 / area_total_px

    # Factor de escalado de las anotaciones (texto/bordes), proporcional a la
    # resolución de esta imagen concreta: una foto de 6800x9500 tendrá etiquetas
    # varias veces más grandes que una de 1920x1080, para que se vean igual de
    # legibles en ambos casos.
    factor_escala = _calcular_factor_escala(ancho_px, alto_px)
    grosor_contorno = max(1, round(GROSOR_CONTORNO_BASE * factor_escala))
    grosor_caja = max(1, round(GROSOR_CAJA_BASE * factor_escala))

    # Ejecutar el modelo
    resultados = modelo(img, verbose=False)

    area_total_hojas_cm2 = 0.0
    contador_hojas = 0
    detalle_hojas = []

    # Iterar sobre los resultados
    for resultado in resultados:
        if resultado.masks is not None:
            for poligono in resultado.masks.xy:
                if len(poligono) >= 3:
                    # Convertir las coordenadas flotantes a enteros para OpenCV
                    contorno = np.array(poligono, dtype=np.int32)

                    # Calcular el área geométrica en píxeles y centímetros
                    area_px = cv2.contourArea(contorno)
                    area_cm2 = area_px * factor_conversion

                    contador_hojas += 1
                    area_total_hojas_cm2 += area_cm2
                    detalle_hojas.append({"numero": contador_hojas, "area_cm2": area_cm2})

                    # 1. Creamos una capa transparente (overlay)
                    capa_pintada = img.copy()

                    # 2. Pintamos el relleno sólido azul oscuro
                    cv2.drawContours(capa_pintada, [contorno], -1, COLOR_RELLENO, -1)

                    # 3. Fusionamos la capa pintada con la imagen original
                    cv2.addWeighted(capa_pintada, OPACIDAD_RELLENO, img, 1 - OPACIDAD_RELLENO, 0, img)

                    # 4. Dibujamos un borde azul más brillante para que el contorno resalte
                    cv2.drawContours(img, [contorno], -1, COLOR_BORDE, grosor_contorno)

                    # 5. Recuadro (bounding box) alrededor de la hoja detectada
                    x, y, w, h = cv2.boundingRect(contorno)
                    cv2.rectangle(img, (x, y), (x + w, y + h), COLOR_BORDE, grosor_caja)

                    # 6. Etiqueta numerada ("Hoja N") anclada a la esquina del recuadro,
                    #    con tamaño proporcional a la resolución de la imagen.
                    margen_vertical = max(8, round(8 * factor_escala))
                    punto_etiqueta = (x, max(y - margen_vertical, round(15 * factor_escala)))
                    _dibujar_etiqueta(img, f"Hoja {contador_hojas}", punto_etiqueta, factor_escala)

    # En Docker guardamos la imagen procesada en vez de usar cv2.imshow
    cv2.imwrite(ruta_salida, img)

    return contador_hojas, area_total_hojas_cm2, detalle_hojas