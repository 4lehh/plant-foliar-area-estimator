// URL base de tu API en FastAPI
const API_URL = "http://localhost:8000";

// --- NAVEGACIÓN ENTRE VISTAS ---
function cambiarVista(idVista, elementoNav) {
    // 1. Ocultar todas las vistas
    document.querySelectorAll('.view').forEach(view => {
        view.classList.remove('active-view');
    });
    
    // 2. Mostrar la vista seleccionada
    document.getElementById(idVista).classList.add('active-view');

    // 3. Actualizar la clase "active" en el Navbar
    document.querySelectorAll('.nav-links a').forEach(link => {
        link.classList.remove('active');
    });
    elementoNav.classList.add('active');
}

// 1. Función para Analizar Imagen
async function analizarImagen() {
    const input = document.getElementById('imagenInferencia');
    if (input.files.length === 0) {
        alert("Por favor, selecciona una imagen primero.");
        return;
    }

    const formData = new FormData();
    formData.append("imagen", input.files[0]);

    const btn = document.getElementById('btnAnalizar');
    btn.innerText = "Analizando...";
    btn.disabled = true;

    try {
        const respuesta = await fetch(`${API_URL}/predecir`, {
            method: 'POST',
            body: formData
        });

        const datos = await respuesta.json();
        
        // Mostrar resultados
        document.getElementById('textoArea').innerText = datos.area_pixeles;
        // Asumiendo que FastAPI devuelve la URL de la nueva imagen
        // document.getElementById('imagenResultado').src = API_URL + datos.imagen_resultado; 
        
        document.getElementById('resultadoInferencia').classList.remove('hidden');
    } catch (error) {
        alert("Error al conectar con el servidor.");
        console.error(error);
    } finally {
        btn.innerText = "Analizar Hoja";
        btn.disabled = false;
    }
}

// 2. Función para Subir Datos
async function subirDatos() {
    const imgInput = document.getElementById('imagenEntrenamiento');
    const jsonInput = document.getElementById('jsonEntrenamiento');

    if (imgInput.files.length === 0 || jsonInput.files.length === 0) {
        alert("Debes seleccionar tanto la imagen como el archivo JSON.");
        return;
    }

    const formData = new FormData();
    formData.append("imagen", imgInput.files[0]);
    formData.append("etiqueta_json", jsonInput.files[0]);

    try {
        const respuesta = await fetch(`${API_URL}/subir-datos`, {
            method: 'POST',
            body: formData
        });
        const datos = await respuesta.json();
        document.getElementById('mensajeSubida').innerText = "✅ " + datos.mensaje;
        
        // Limpiar los inputs
        imgInput.value = "";
        jsonInput.value = "";
    } catch (error) {
        document.getElementById('mensajeSubida').innerText = "❌ Error al subir datos.";
    }
}

// 3. Función para Entrenar
async function iniciarEntrenamiento() {
    try {
        const respuesta = await fetch(`${API_URL}/entrenar`, {
            method: 'POST'
        });
        const datos = await respuesta.json();
        document.getElementById('mensajeEntrenamiento').innerText = "🚀 " + datos.mensaje;
    } catch (error) {
        document.getElementById('mensajeEntrenamiento').innerText = "❌ Error al conectar con el servidor.";
    }
}