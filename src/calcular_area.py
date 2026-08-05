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
                    
                    # 1. Creamos una capa transparente (overlay)
                    capa_pintada = img.copy()
                    
                    # 2. Pintamos el relleno sólido azul oscuro (BGR: Azul=130, Verde=20, Rojo=20)
                    cv2.drawContours(capa_pintada, [contorno], -1, (130, 20, 20), -1)
                    
                    # 3. Fusionamos la capa pintada con la imagen original (50% de opacidad)
                    opacidad = 0.5
                    cv2.addWeighted(capa_pintada, opacidad, img, 1 - opacidad, 0, img)
                    
                    # 4. Dibujamos un borde azul más brillante (255, 50, 50) para que el contorno resalte
                    cv2.drawContours(img, [contorno], -1, (255, 50, 50), 2)

    # En Docker guardamos la imagen procesada en vez de usar cv2.imshow
    cv2.imwrite(ruta_salida, img)

    return contador_hojas, area_total_hojas_cm2