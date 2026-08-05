import cv2
import numpy as np

# Dimensiones físicas de la superficie fotografiada
ANCHO_FISICO_CM = 30.0
ALTO_FISICO_CM = 21.8
AREA_TOTAL_CM2 = ANCHO_FISICO_CM * ALTO_FISICO_CM

# Fíjate que ahora la función RECIBE el modelo, la ruta de la imagen y dónde guardarla
def calcular_area(modelo, ruta_imagen, ruta_salida) -> tuple:
    
    img = cv2.imread(ruta_imagen)

    if img is None:
        print(f"Error: No se pudo cargar la imagen en {ruta_imagen}")
        return 0, 0.0

    # ==========================================
    # PROCESAMIENTO Y CÁLCULO
    # ==========================================
    # Calcular la resolución en píxeles de ESTA imagen específica
    alto_px, ancho_px = img.shape[:2]
    area_total_px = alto_px * ancho_px

    # Calcular el factor de conversión dinámico
    factor_conversion = AREA_TOTAL_CM2 / area_total_px

    # Ejecutar el modelo
    resultados = modelo(img, verbose=False)

    area_total_hojas_cm2 = 0.0
    contador_hojas = 0

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
                    
                    area_total_hojas_cm2 += area_cm2
                    contador_hojas += 1
                    
                    # Dibujar el contorno en verde sobre la imagen
                    cv2.drawContours(img, [contorno], -1, (0, 255, 0), 2)

    # ==========================================
    # GUARDAR RESULTADO (En vez de mostrarlo)
    # ==========================================
    # En Docker guardamos la imagen procesada en vez de usar cv2.imshow
    cv2.imwrite(ruta_salida, img)

    return contador_hojas, area_total_hojas_cm2