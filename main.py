from src.convertidor_yolo import *
from src.calcular_area import *

from ultralytics import YOLO
import cv2
import os

CARPETA_DATASET = "dataset"

def train():
    model = YOLO("yolo11n-seg.pt")

    model.train(
        data="./dataset/dataset.yaml",  
        epochs=100,                         
        imgsz=640,                          
        batch=8,          
        project=".",                  
        name="fokin_modelo",             # Nombre de la subcarpeta
        exist_ok=True,                      # <- NUEVO: Evita que cree carpetas v1-2, v1-3, etc.
        
        # Mejora del modelo
        optimizer= "AdamW",                 # Optimizador
        lr0=0.001,

        # Parámetros de Data Augmentation
        degrees=15.0,
        fliplr=0.5,
        flipud=0.5,
        hsv_h=0.015,
        hsv_s=0.7,
        hsv_v=0.4,
        mosaic=1.0
    )

def test():
    ruta_modelo = "./volumen/pesos/best-v2.pt" 
    model = YOLO(ruta_modelo)

    # Imagen de prueba
    ruta_imagen_prueba = "./volumen/dataset/val/NT_121.jpg"
    resultados = model(ruta_imagen_prueba)

    for resultado in resultados:
        imagen_anotada = resultado.plot()
        
        cv2.namedWindow("Prueba de Modelo", cv2.WINDOW_NORMAL)
        cv2.resizeWindow("Prueba de Modelo", 1024, 768)
        cv2.imshow("Prueba de Modelo", imagen_anotada)
        
        print("Presiona cualquier tecla en la ventana de la imagen para cerrar el programa...")
        cv2.waitKey(0)
        cv2.destroyAllWindows()

if __name__ == "__main__":
    
    # if not os.path.isdir(CARPETA_DATASET):
    #     convertir_yolo()

    operacion = 3

    if operacion == 1:
        train()
    elif operacion == 2:
        test()
    elif operacion == 3:
        contador_hoja, area = calcular_area()
        
        print(f"\n\n\n Cantidad hojas: {contador_hoja} \n Área total: {area}")