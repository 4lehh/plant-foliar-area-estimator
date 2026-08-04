# Leaf Area Segmentation & Morphometry (Plant Foliar Area Estimator)

Repositorio destinado al estudio del estado del arte, preprocesamiento de datasets foliares (tomate, lechuga, etc.), segmentación de imágenes y entrenamiento de modelos de Aprendizaje Profundo (*Deep Learning*) para la estimación automática del área foliar y clasificación según el tratamiento de la planta.

---

## Hitos del Proyecto & TO-DO List

### Fase 1: Estado del Arte & Presentación Inicial
- [x] **Investigación bibliográfica:**
  - [x] Revisar métodos tradicionales de visión por computadora para morfometría foliar (ImageJ, umbralización, detección de bordes).
  - [x] Investigar arquitecturas modernas de *Instance Segmentation* (YOLOv8-seg, YOLOv9-seg, Mask R-CNN, Segment Anything Model - SAM).
  - [x] Analizar técnicas para la conversión de píxeles a unidades físicas de superficie ($cm^2$ o $mm^2$) mediante objetos de referencia o escalas graduadas.
- [x] **Elaboración de Presentación (PPT):**
  - [x] Sintetizar ventajas y limitaciones de herramientas tradicionales vs. Deep Learning.
  - [x] Definir la arquitectura propuesta y el flujo de trabajo previsto.
  - [x] Presentar avance inicial a la profesora responsable.

---

### Fase 2: Exploración de Herramientas Baseline
- [x] **Pruebas en ImageJ:**
  - [x] Calibrar escala espacial (píxel a $cm/mm$) utilizando la regla de referencia presente en las imágenes.
  - [x] Realizar pruebas de segmentación manual/semiautomática (Color Threshold, Thresholding Binarizado, Analyze Particles).
  - [x] Exportar métricas de área foliar como *ground truth* inicial para validación.
- [x] **Exploración de Roboflow:**
  - [x] Crear proyecto de *Instance Segmentation* en Roboflow.
  - [x] Familiarizarse con las herramientas de etiquetado poligonal (*Smart Polygon*, *Auto-Label*).
  - [x] Definir taxonomía de clases y metadatos/etiquetas por tratamiento (ej. `sin_tratamiento`, `tratamiento_riego`, `tratamiento_SM4.3`, etc.).

---

### Fase 3: Curaduría, Segmentación del Dataset y Etiquetado
- [x] **Organización e inspección del dataset crudo:**
  - [x] Mapear carpetas recibidas (ej. *MicroTom*, *Lechuga + SM4.3*, etc.).
  - [x] Filtrar y clasificar imágenes grupales que contienen múltiples hojas o folíolos en una misma captura.
- [ ] **Segmentación de hojas individuales & Etiquetado:**
  - [ ] Cargar imágenes a Roboflow.
  - [ ] Trazar máscaras poligonales individuales para cada hoja (aislar de tallos o raíces si estuviesen presentes).
  - [ ] Asignar las etiquetas/clases correspondientes a la condición experimental de la planta (ej.: `con_tratamiento`, `sin_tratamiento`, `estres_hidrico`, etc.).
- [ ] **Preprocesamiento y Augmentations:**
  - [ ] Aplicar técnicas de aumento de datos (*data augmentation*) en Roboflow (rotaciones, cambios de brillo, volteo horizontal).
  - [ ] Exportar el dataset en formato compatible con PyTorch / YOLOv8 (*YOLOv8 PyTorch Segmentation*).

---

### Fase 4: Entrenamiento y Estimación de Área Foliar
- [ ] **Preparación del entorno remoto (Servidor vía SSH):**
  - [ ] Conectarse al equipo por SSH.
  - [ ] Configurar entorno virtual (`conda` o `venv`) e instalar PyTorch, Ultralytics (YOLO) y dependencias de procesamiento de imágenes (`opencv-python`, `pandas`).
  - [ ] Configurar sesiones persistentes con `tmux` o `screen` para ejecuciones prolongadas.
- [ ] **Entrenamiento del Modelo de Segmentación:**
  - [ ] Entrenar modelo de segmentación de instancias (ej. YOLOv8-seg) con el dataset preparado.
  - [ ] Monitorear métricas de entrenamiento ($mAP_{50-95}$, *Loss* de máscara y caja).
- [ ] **Desarrollo del módulo de cálculo de área:**
  - [ ] Crear script en Python para extraer la cantidad total de píxeles dentro del área de la máscara predicha por el modelo.
  - [ ] Desarrollar lógica para detectar la regla de calibración (o usar factor de escala constante) y convertir `píxeles^2` a `cm^2`.
  - [ ] Generar reporte automático en CSV/Excel indicando: ID de Imagen, Condición/Tratamiento, Número de Hojas y Área Total/Promedio ($cm^2$).

---

### Fase 5: Evaluación, Documentación y Cierre
- [ ] Comparar las áreas calculadas por el modelo entrenado vs. las mediciones de referencia de ImageJ.
- [ ] Calcular métricas de error (MAE, RMSE) para la estimación de superficie.
- [ ] Redactar el informe de práctica final y formularios administrativos (CDIA).
- [ ] Preparar presentación (PPT) de cierre con demostración del modelo y tabla comparativa de resultados.