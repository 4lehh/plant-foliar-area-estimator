"""
ejemplo_uso.py

Ejemplos de cómo se invoca dataset_manager.py. No es parte del pipeline en sí,
es solo referencia de integración (por ejemplo, esto es básicamente lo que
harían tus endpoints de FastAPI).
"""

from dataset_manager import (
    procesar_una_subida,
    procesar_staging,
    build_dataset_yaml,
    obtener_estadisticas,
)

# El class_map centraliza el mapeo nombre_de_clase -> id. Si en el futuro
# agregas más clases (ej. "Fruto", "Tallo"), solo se edita este diccionario.
CLASS_MAP = {"Hoja": 0}

DATASET_ROOT = "./volumen/dataset"


# --- Caso 1: endpoint POST /dataset/upload -----------------------------
# El usuario sube UNA imagen + UN json. Guardas ambos archivos en
# `staging/` con el mismo nombre base y luego llamas:

def endpoint_upload_individual(ruta_json_subido: str):
    resultado = procesar_una_subida(
        ruta_json=ruta_json_subido,
        dataset_root=DATASET_ROOT,
        class_map=CLASS_MAP,
        val_ratio=0.2,
    )

    if not resultado.ok:
        # esto es lo que le devolverías al frontend como error 400
        return {"ok": False, "error": resultado.error, "warnings": resultado.warnings}

    return {
        "ok": True,
        "archivo": resultado.nombre_base,
        "split_asignado": resultado.split,
        "poligonos_encontrados": resultado.n_poligonos,
        "warnings": resultado.warnings,
    }


# --- Caso 2: endpoint POST /dataset/process-staging ---------------------
# Botón "Procesar pendientes" en el frontend: convierte todo lo que se
# acumuló en staging/ de una sola vez.

def endpoint_procesar_staging():
    resultado = procesar_staging(
        dataset_root=DATASET_ROOT,
        class_map=CLASS_MAP,
        val_ratio=0.2,
    )
    return {
        "convertidas": resultado.convertidas,
        "fallidas": resultado.fallidas,
        "detalles": [r.__dict__ for r in resultado.detalles],
    }


# --- Caso 3: justo antes de lanzar un entrenamiento (endpoint POST /train/start)

def preparar_dataset_para_entrenar():
    yaml_path = build_dataset_yaml(DATASET_ROOT, CLASS_MAP)
    # a partir de acá, yaml_path es lo que le pasas a model.train(data=yaml_path, ...)
    return yaml_path


# --- Caso 4: endpoint GET /dataset/stats --------------------------------

def endpoint_stats():
    return obtener_estadisticas(DATASET_ROOT)


if __name__ == "__main__":
    # ejemplo manual, equivalente a lo que hacía tu script original
    print("Procesando staging...")
    r = endpoint_procesar_staging()
    print(r)

    print("\nRegenerando dataset.yaml...")
    print(preparar_dataset_para_entrenar())

    print("\nEstadísticas actuales:")
    print(endpoint_stats())