# plant-foliar-area-estimator
Práctica laboral, estimador de área foliar de hojas de plantas como tomate y lechuga.


### Loss function YOLO

| Nombre | Descripción | Lo ideal |
|--------|-------------|----------|
| Box Loss | Aunque estamos segmentando hojas, YOLO primero debe encontrar la región general donde está el objeto usando una caja (bounding box). La Box Loss mide qué tan bien se alinea la caja predicha con la caja real que engloba tu polígono. | Si el valor es alto, detecta donde no debería detectar.|
| Seg Loss / Mask Loss | Una vez que YOLO encuentra la caja, genera una máscara de píxeles dentro de ella.Matemática: Se calcula generalmente usando BCE (Binary Cross Entropy) a nivel de píxel. Por cada píxel de la caja, el modelo predice una probabilidad $\hat{y}$ (entre 0 y 1) de que ese píxel sea "hoja" o "fondo".$$L_{BCE} = -[y \log(\hat{y}) + (1 - y) \log(1 - \hat{y})]$$ | Mide la precisión geométrica de tu contorno. Si baja, los bordes de la hoja predicha coinciden casi perfectamente con tus polígonos originales. |
| Class Loss | Mide si el modelo adivinó correctamente la clase del objeto. | En tu caso, como solo tienes una clase (nc=1, solo "hoja"), esta Loss suele bajar muy rápido y mantenerse cercana a cero, ya que la red no tiene que discernir entre hojas, perros o autos |
| DFL Loss | Ayuda al modelo a ser más preciso al definir los bordes de la caja delimitadora, tratando las coordenadas de los bordes como una distribución de probabilidad en lugar de un valor absoluto. Optimiza los detalles finos de la ubicación. | No tiene aparentemente. |
 