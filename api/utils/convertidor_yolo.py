import json
import os
import glob
import shutil
import random

# --- CONFIGURACIÓN ---
carpeta_origen = "./volumen/train/"  # Donde están tus .json y .jpg
carpeta_destino = "./YOLODataset_Hojas"        # La nueva carpeta que crearemos
clase_nombre = "Hoja"                          # El nombre exacto que pusiste en labelme
# ---------------------

# Crear estructura de carpetas YOLO
for split in ['train', 'val']:
    os.makedirs(os.path.join(carpeta_destino, 'images', split), exist_ok=True)
    os.makedirs(os.path.join(carpeta_destino, 'labels', split), exist_ok=True)

# Obtener y mezclar los JSONs aleatoriamente
archivos_json = glob.glob(os.path.join(carpeta_origen, "*.json"))
random.shuffle(archivos_json)

# Separar 80% para entrenamiento y 20% para validación
corte = int(len(archivos_json) * 0.8)
splits = {'train': archivos_json[:corte], 'val': archivos_json[corte:]}

print(f"Total de imágenes: {len(archivos_json)}")
print(f"-> Entrenando con {corte}")
print(f"-> Validando con {len(archivos_json)-corte}")

for split_nombre, lista_jsons in splits.items():
    for ruta_json in lista_jsons:
        with open(ruta_json, 'r') as f:
            data = json.load(f)
        
        ancho_img = data['imageWidth']
        alto_img = data['imageHeight']
        
        # Obtener el nombre del archivo sin extensión
        nombre_base = os.path.basename(ruta_json).replace('.json', '')
        
        # Buscar la imagen correspondiente (asumimos que la convertiste a .jpg)
        ruta_img = os.path.join(carpeta_origen, nombre_base + ".jpg")
        
        if not os.path.exists(ruta_img):
            print(f"⚠️ Imagen no encontrada para {nombre_base}.json. Asegúrate de que existan los .jpg")
            continue
            
        # Copiar imagen a la nueva carpeta
        shutil.copy(ruta_img, os.path.join(carpeta_destino, 'images', split_nombre, nombre_base + ".jpg"))
        
        # Crear y escribir el archivo .txt de etiquetas normalizadas para YOLO
        ruta_txt = os.path.join(carpeta_destino, 'labels', split_nombre, nombre_base + ".txt")
        with open(ruta_txt, 'w') as f_txt:
            for shape in data['shapes']:
                # Ignorar si etiquetaste algo con otro nombre por error
                if shape['label'].lower() != clase_nombre.lower():
                    continue
                    
                # YOLO usa el ID 0 para la primera clase
                linea = ["0"]
                
                # Normalizar puntos (dividir x por el ancho de la imagen, e y por el alto)
                for punto in shape['points']:
                    x_norm = max(0.0, min(1.0, punto[0] / ancho_img))
                    y_norm = max(0.0, min(1.0, punto[1] / alto_img))
                    linea.append(f"{x_norm:.6f}")
                    linea.append(f"{y_norm:.6f}")
                    
                f_txt.write(" ".join(linea) + "\n")

# Crear el archivo dataset.yaml requerido por YOLO (usando rutas absolutas para evitar errores)
yaml_path = os.path.join(carpeta_destino, "dataset.yaml")
with open(yaml_path, 'w') as f_yaml:
    f_yaml.write(f"path: {os.path.abspath(carpeta_destino)}\n")
    f_yaml.write("train: images/train\n")
    f_yaml.write("val: images/val\n")
    f_yaml.write("names:\n")
    f_yaml.write(f"  0: {clase_nombre}\n")

print(f"\n¡Dataset creado exitosamente en: {carpeta_destino}!")