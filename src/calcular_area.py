import cv2
import numpy as np
from ultralytics import YOLO

def calcular_area() -> tuple:
    # ==========================================
    # CONFIGURACIÓN INICIAL
    # ==========================================
    # 1. Ruta de tu modelo entrenado (Asegúrate de apuntar a la carpeta correcta, ej: v1-3 si fue la última)
    ruta_modelo = "./volumen/pesos/best-v2.pt" 
    modelo = YOLO(ruta_modelo)

    # 2. Dimensiones físicas de la superficie fotografiada
    ANCHO_FISICO_CM = 30.0
    ALTO_FISICO_CM = 21.8
    AREA_TOTAL_CM2 = ANCHO_FISICO_CM * ALTO_FISICO_CM

    # 3. Imagen a analizar
    ruta_imagen = "./volumen/dataset/val/V8 sequia654.jpg"
    img = cv2.imread(ruta_imagen)

    if img is None:
        print(f"Error: No se pudo cargar la imagen en {ruta_imagen}")
        exit()

    # ==========================================
    # PROCESAMIENTO Y CÁLCULO
    # ==========================================
    # Calcular la resolución en píxeles de ESTA imagen específica
    alto_px, ancho_px = img.shape[:2]
    area_total_px = alto_px * ancho_px

    # Calcular el factor de conversión dinámico: ¿Cuántos cm^2 vale 1 píxel?
    factor_conversion = AREA_TOTAL_CM2 / area_total_px

    print(f"Resolución de la imagen: {ancho_px}x{alto_px} px")
    print(f"Factor de conversión: 1 píxel = {factor_conversion:.7f} cm²\n")

    # Ejecutar el modelo
    print("Detectando hojas...")
    resultados = modelo(img, verbose=False) # verbose=False para limpiar la consola

    area_total_hojas_cm2 = 0.0
    contador_hojas = 0

    # Iterar sobre los resultados (YOLO devuelve una lista, usualmente de 1 elemento por imagen)
    for resultado in resultados:
        # Verificar si el modelo detectó máscaras
        if resultado.masks is not None:
            # resultado.masks.xy contiene una lista de polígonos (arreglos de coordenadas x,y)
            for poligono in resultado.masks.xy:
                # Un polígono válido necesita al menos 3 puntos
                if len(poligono) >= 3:
                    # Convertir las coordenadas flotantes a enteros para OpenCV
                    contorno = np.array(poligono, dtype=np.int32)
                    
                    # Calcular el área geométrica en píxeles
                    area_px = cv2.contourArea(contorno)
                    
                    # Convertir el área a centímetros cuadrados
                    area_cm2 = area_px * factor_conversion
                    
                    area_total_hojas_cm2 += area_cm2
                    contador_hojas += 1
                    
                    print(f"Hoja {contador_hojas}: {area_cm2:.2f} cm²")
                    
                    # (Opcional) Dibujar el contorno en verde sobre la imagen para validación visual
                    cv2.drawContours(img, [contorno], -1, (0, 255, 0), 2)
        else:
            print("No se detectaron hojas en esta imagen.")

    # ==========================================
    # RESULTADO FINAL
    # ==========================================
    print("-" * 30)
    print(f"TOTAL HOJAS DETECTADAS: {contador_hojas}")
    print(f"ÁREA FOLIAR TOTAL: {area_total_hojas_cm2:.2f} cm²")
    print("-" * 30)

    # Mostrar la imagen con los contornos dibujados por OpenCV
    cv2.namedWindow("Analisis de Area", cv2.WINDOW_NORMAL)
    cv2.resizeWindow("Analisis de Area", 1024, 768)
    cv2.imshow("Analisis de Area", img)
    cv2.waitKey(0)
    cv2.destroyAllWindows()

    return contador_hojas, area_total_hojas_cm2