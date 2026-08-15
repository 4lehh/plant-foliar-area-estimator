# Plant Foliar Area Estimator

Problema de calculo de aŕea foliar de plantas de tomate y lechuga enfrentadas a distintas pruebas utilizando un modelo YOLO11 con segmentacion de instancias y una transformacion matemática.

|Nombre|Github|Contacto|
|-|-|-|
|Javier Alejandro Campos Contreras|[@4lehh](https://github.com/4lehh)|jacampos2023@udec.cl|


## Herramientas de Desarrollo

<div align="center">

<a href="https://skillicons.dev">
  <img src="https://skillicons.dev/icons?i=python,css,git,github,vscode,docker,markdown&perline=7" />
</a>

</div>

## Descripción

Tenemos un problema donde, para evaluar los estados de las plantas de tomate y lechuga frente a distintas pruebas como puede ser en estado de sequia, con riego, con hongos como SM4.3 con sequia y SM4.3 con riego.  

¿Por qué es importante el cálculo de área foliar? El área foliar es el principal indicador de la capacidad fotosintética, transpiratoria y de intercambio gaseoso de una planta. Medirla permite cuantificar el impacto fisiológico y el nivel de tolerancia o protección.

Este proceso es tardído, por eso mismo se ha desarrollado Plant Foliar Area Estimator, un modelo Yolo11 con segmentacion de instancias especializado para el calculo de area de hojas. 


## Ejecución

> [!IMPORTANT]
> Se debe tener Docker 29.6 o superior.

Para la ejecución, debes descargar el repositorio. Luego, debes abrir una terminal dentro del repositorio.

```sh
# Levantar el proyecto
docker compose up --build
```

Luego, solo debes entrar a tu navegador y abrir

```sh
# Interfaz del proyecto
localhost:8501
```

## Arquitectura

Primero que nada, el dataset utilizado sigue una regla especifica. Todas las imagenes deben seguir las dimensiones correspondientes.

* El alto de la imagen debe ser de 30cm (La resolución debe ser de 1280 o mayor, recomendado 1920).
* El ancho de la imagen debe ser de 21.6cm (La resolucion debe ser 720, recomendado 1080).

> [!IMPORTANT]
> La importancia de que las imagenes sigan estas reglas es para mantener la relacion espacial.

