from ultralytics import YOLO
import cv2

# ==========================================
# FASE 1: ENTRENAMIENTO DEL MODELO
# ==========================================
print("--- INICIANDO ENTRENAMIENTO ---")

# 1. Cargar el modelo base preentrenado
model = YOLO("yolov8n-seg.pt")

# 2. Iniciar el entrenamiento
model.train(
    data="./YOLODataset_Hojas/dataset.yaml",  
    epochs=100,                         
    imgsz=640,                          
    batch=8,          
    project=".",                  
    name="modelo_hojas_v2",             # Nombre de la subcarpeta
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

print("--- ENTRENAMIENTO FINALIZADO ---")

# ==========================================
# FASE 2: PRUEBA VISUAL (INFERENCIA)
# ==========================================

print("--- INICIANDO PRUEBA ---")

# 3. Seleccionar una imagen de prueba
ruta_imagen_prueba = "./dataset_output/val_30/NT_121.jpg"

# 4. Ejecutar la predicción
# ¡ATENCIÓN AQUÍ! Usamos directamente la variable 'model'. 
# Ya tiene los mejores pesos cargados en memoria tras el entrenamiento.
resultados = model(ruta_imagen_prueba)

# 5. Mostrar el resultado usando OpenCV
for resultado in resultados:
    imagen_anotada = resultado.plot()
    
    cv2.namedWindow("Prueba de Modelo", cv2.WINDOW_NORMAL)
    cv2.resizeWindow("Prueba de Modelo", 1024, 768)
    cv2.imshow("Prueba de Modelo", imagen_anotada)
    
    print("Presiona cualquier tecla en la ventana de la imagen para cerrar el programa...")
    cv2.waitKey(0)
    cv2.destroyAllWindows()