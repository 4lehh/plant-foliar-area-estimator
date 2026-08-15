# Plant Foliar Area Estimator

[![GitHub](https://img.shields.io/badge/GitHub-4lehh-blue?logo=github)](https://github.com/4lehh)
[![Universidad de Concepción](https://img.shields.io/badge/Universidad_de_Concepción-UdeC-yellow)](#)

Un sistema basado en Visión por Computadora y Deep Learning (YOLO11) diseñado para la estimación automática y no destructiva del área foliar en plantas de tomate y lechuga.

## Descripción del Problema

El área foliar es el principal indicador de la capacidad de una planta para realizar fotosíntesis y transpiración. Medirla con precisión permite cuantificar el impacto fisiológico y el nivel de tolerancia vegetal frente a distintos tratamientos.

Este proyecto permite evaluar el estado de cultivos enfrentados a diversas condiciones de estrés, tales como:
* Estrés hídrico (Sequía) vs. Condiciones óptimas (Riego).
* Inoculación con hongos (cepa SM4.3) en condiciones de sequía y riego.

Históricamente, la medición del área foliar dependía de procesos destructivos o modelos manuales que tomaban mucho tiempo. Plant Foliar Area Estimator automatiza este proceso utilizando segmentación de instancias, permitiendo un monitoreo rápido, preciso y sin dañar la planta.

## Herramientas de Desarrollo

<div align="center">
  <a href="https://skillicons.dev">
    <img src="https://skillicons.dev/icons?i=python,css,git,github,vscode,docker,markdown&perline=7" />
  </a>
</div>

* **Modelo Principal**: YOLO11 (Segmentación de Instancias).
* **Anotación y Dataset**: Segmentación asistida con SAM 2 (Hiera-Large) mediante herramientas locales como AnyLabeling o CVAT.
* **Interfaz y Despliegue**: Streamlit y Docker.

## Arquitectura y Captura de Datos

Para que el modelo logre estimar el área física de las hojas sin marcadores externos, las imágenes deben seguir una regla de proporción estricta.

Todas las imágenes deben respetar las siguientes medidas en su encuadre:
* **Alto de la imagen**: 30 cm.
* **Ancho de la imagen**: 21.6 cm.
* **Resolución recomendada**: 1920x1080 o superior (Resolución mínima: 1280x720).

> [!IMPORTANT]  
> Mantener este estándar de captura permite que el sistema realice una transformación matemática directa entre los píxeles identificados por YOLO11 y el área real en centímetros cuadrados, asegurando resultados consistentes.

## Ejecución y Despliegue

El proyecto está contenerizado para evitar problemas de dependencias e instalación.

> [!NOTE]  
> Se requiere tener instalado Docker 29.6 o superior.

Para iniciar el proyecto, clona el repositorio, abre una terminal en la carpeta principal y ejecuta los siguientes comandos:

```sh
# Construir y levantar el contenedor del proyecto
docker compose up --build
```

3. Abre tu navegador web de preferencia e ingresa a la interfaz gráfica:
```sh
# Interfaz del proyecto (Streamlit)
http://localhost:8501
```

## Estado del Arte y Referencias

El desarrollo de este sistema toma inspiración de estudios recientes en fenotipado digital:
* La segmentación precisa de imágenes proporciona una base sólida para la estimación automática del área foliar, siendo un parámetro clave para evaluar el crecimiento (MDPI, 2023).
* El uso de arquitecturas YOLO para la segmentación demuestra ser un enfoque rápido y exacto, reemplazando a los métodos clásicos de cálculo por regresión de los años 2000s.

---

## Contacto y Autor

| Nombre | GitHub | Contacto Institucional |
|---|---|---|
| Javier Alejandro Campos Contreras | [@4lehh](https://github.com/4lehh) | jacampos2023@udec.cl |