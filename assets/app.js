/* =========================================================================
   Estimador de área foliar — lógica de interfaz
   ========================================================================= */

const API = {
  analyze: "/api/analyze",
  gallery: "/api/gallery",
  clear: "/api/clear",
};

/* Marco de captura usado por el modelo: 21,8 cm de ancho x 30 cm de alto
   (constantes ANCHO_FISICO_CM y ALTO_FISICO_CM en src/calcular_area.py). */
const MARCO_CM2 = 654;

const TIPOS_ACEPTADOS = ["image/jpeg", "image/jpg", "image/png"];
const MAX_BYTES = 50 * 1024 * 1024;
const CLAVE_TUTORIAL = "foliar.tutorial.v1";

let archivoActual = null;
let urlPrevia = null;
let analizando = false;
let control = null;

// ============================== UTILIDADES ==============================

const $ = (sel, ctx = document) => ctx.querySelector(sel);
const $$ = (sel, ctx = document) => [...ctx.querySelectorAll(sel)];

/* El manifiesto de fuentes se autohospeda, así que el navegador no puede
   knowing de antemano que hacen falta; se avisa al empezar a cargar y se
   retira en cuanto el texto está listo. Sin esto la primera pintura sale con
   la tipografía de reserva. */
const fuentes = document.fonts;
let avisoFuentes = null;

if (fuentes) {
  if (fuentes.status === "loaded") {
    document.documentElement.classList.add("fuentes-listas");
  } else {
    avisoFuentes = fuentes.ready.then(() => {
      document.documentElement.classList.add("fuentes-listas");
    });
  }
}

const sinMovimiento = () =>
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/* Un fallo aquí no debe romper el resto de la interfaz */
window.addEventListener("error", (e) => console.error("Interfaz:", e.message));

const num = (valor, decimales = 2) =>
  Number(valor).toLocaleString("es-CL", {
    minimumFractionDigits: decimales,
    maximumFractionDigits: decimales,
  });

const entero = (valor) => Number(valor).toLocaleString("es-CL");

const mostrar = (el, visible) => {
  if (!el) return;
  el.hidden = !visible;
};

const FOCUABLES =
  'a[href], button:not([disabled]), input:not([disabled]), select, textarea, [tabindex]:not([tabindex="-1"])';

// ============================== ELEMENTOS ==============================

const ventanaCarga = $("#uploadZone");
const inputArchivo = $("#fileInput");
const zonaPrompt = $("#uploadPrompt");
const zonaCargada = $("#uploadPreview");
const nombrePrevia = $("#previewName");
const escenario = $("#stage");
const btnQuitar = $("#removeFile");
const acciones = $("#actions");
const btnAnalizar = $("#analyzeBtn");
const etiquetaAnalizar = btnAnalizar.querySelector(".btn__label");
const btnCancelar = $("#clearSelectionBtn");
const velo = $("#loaderOverlay");
const btnCancelarAnalisis = $("#cancelAnalyze");
const cajaError = $("#errorBox");
const textoError = $("#errorText");

const pasos = $$(".rail__step");
const lineaEstado = $("#statusLine");
const textoEstado = $("#statusText");

const seccionResultado = $("#resultsSection");
const campoHojas = $("#leavesCount");
const campoArea = $("#totalArea");
const campoCobertura = $("#coverage");
const barraCobertura = $("#gaugeFill");
const campoArchivo = $("#resultFile");
const campoCuando = $("#resultWhen");
const bloqueHojas = $("#leafDetail");
const listaHojas = $("#leafList");
const bloqueComparacion = $("#comparison");
const placaOriginal = $("#plateOriginal");
const placaMascara = $("#plateMask");
const bloqueDescarga = $("#downloadWrap");
const btnDescarga = $("#downloadBtn");

const notaGaleria = $("#galleryNote");
const galeriaVacia = $("#galleryEmpty");
const galeriaGrid = $("#galleryGrid");
const btnLimpiar = $("#clearHistoryBtn");

const modalTutorial = $("#tutorialModal");
const casillaNoMostrar = $("#dontShowAgain");
const modalConfirmar = $("#confirmModal");

// ============================== RIEL DE ESTADO ==============================

function marcarPaso(n) {
  pasos.forEach((paso) => {
    const i = Number(paso.dataset.step);
    paso.classList.toggle("is-current", i === n);
    paso.classList.toggle("is-done", i < n);
  });
}

function estado(texto, modo = "") {
  textoEstado.textContent = texto;
  lineaEstado.classList.toggle("is-busy", modo === "busy");
  lineaEstado.classList.toggle("is-done", modo === "listo");
}

// ============================== DIÁLOGOS ==============================

const sincronizarBloqueo = () => {
  const alguno = $$(".modal").some((m) => !m.hidden);
  document.documentElement.classList.toggle("is-locked", alguno);
};

function crearDialogo(el, resultadoPorDefecto = false) {
  const dlg = { el, ultimoFoco: null, respuesta: resultadoPorDefecto };

  dlg.abrir = () => {
    if (!el.hidden) return;
    dlg.ultimoFoco = document.activeElement;
    dlg.respuesta = resultadoPorDefecto;
    el.hidden = false;
    sincronizarBloqueo();
    el.addEventListener("keydown", alTeclear);
    requestAnimationFrame(() => el.classList.add("is-open"));
    const inicio = el.querySelector(".modal__close") || el.querySelector(FOCUABLES);
    if (inicio) inicio.focus();
  };

  dlg.cerrar = (respuesta) => {
    if (el.hidden) return;
    dlg.respuesta = respuesta;
    el.classList.remove("is-open");
    el.removeEventListener("keydown", alTeclear);
    window.setTimeout(() => {
      el.hidden = true;
      sincronizarBloqueo();
      if (dlg.ultimoFoco && document.contains(dlg.ultimoFoco)) dlg.ultimoFoco.focus();
    }, 200);
  };

  function alTeclear(e) {
    if (e.key === "Escape") {
      e.preventDefault();
      dlg.cerrar(resultadoPorDefecto);
      return;
    }
    if (e.key !== "Tab") return;
    const focuables = $$(FOCUABLES, el).filter((n) => n.offsetParent !== null);
    if (!focuables.length) return;
    const primero = focuables[0];
    const ultimo = focuables[focuables.length - 1];
    if (e.shiftKey && document.activeElement === primero) {
      e.preventDefault();
      ultimo.focus();
    } else if (!e.shiftKey && document.activeElement === ultimo) {
      e.preventDefault();
      primero.focus();
    }
  }

  el.addEventListener("click", (e) => {
    const disparador = e.target.closest("[data-close]");
    if (disparador) dlg.cerrar(disparador.dataset.result === "true");
  });

  return dlg;
}

const tutorial = crearDialogo(modalTutorial, true);
const confirmar = crearDialogo(modalConfirmar, false);

function preguntar(mensaje, textoOk) {
  $("#confirmText").textContent = mensaje;
  $("#confirmOk").textContent = textoOk;
  $("#confirmTitle").textContent = "¿Borrar todo el historial?";
  return new Promise((resolve) => {
    const listener = () => {
      modalConfirmar.removeEventListener("cerrado", listener);
      resolve(confirmar.respuesta);
    };
    modalConfirmar.addEventListener("cerrado", listener);
    confirmar.abrir();
  });
}

// El diálogo de confirmación avisa cuando termina de cerrarse, para no
// resolver la promesa antes de que la animación termine.
new MutationObserver((_, obs) => {
  if (!modalConfirmar.hidden) return;
  obs.disconnect();
  modalConfirmar.dispatchEvent(new Event("cerrado"));
}).observe(modalConfirmar, { attributes: true, attributeFilter: ["hidden"] });

$("#helpBtn").addEventListener("click", () => tutorial.abrir());
$("#tutorialOk").addEventListener("click", () => {
  localStorage.setItem(CLAVE_TUTORIAL, casillaNoMostrar.checked ? "off" : "done");
});

// ============================== SELECCIÓN DE ARCHIVO ==============================

function mostrarError(mensaje, recuperacion) {
  textoError.textContent = "";
  textoError.append(mensaje);
  if (recuperacion) {
    const sep = document.createElement("br");
    textoError.append(sep, recuperacion);
  }
  mostrar(cajaError, true);
  estado("Revisa el mensaje para continuar");
}

function limpiarError() {
  mostrar(cajaError, false);
}

function reiniciarFoto() {
  archivoActual = null;
  if (urlPrevia) {
    URL.revokeObjectURL(urlPrevia);
    urlPrevia = null;
  }
  $("#previewImg")?.remove();
  mostrar(zonaPrompt, true);
  mostrar(zonaCargada, false);
  mostrar(acciones, false);
  escenario.classList.remove("is-scanning");
  limpiarError();
}

function reiniciarTodo() {
  reiniciarFoto();
  seccionResultado.hidden = true;
  mostrar(bloqueHojas, false);
  mostrar(bloqueComparacion, false);
  mostrar(bloqueDescarga, false);
}

function reiniciarAnimacionRegistro() {
  $$(".stage__corner", escenario).forEach((esquina) => {
    esquina.style.animation = "none";
    void esquina.offsetWidth;
    esquina.style.animation = "";
  });
}

function prepararPrevia(archivo) {
  if (urlPrevia) URL.revokeObjectURL(urlPrevia);
  archivoActual = archivo;
  urlPrevia = URL.createObjectURL(archivo);

  // La miniatura se inserta al elegir el archivo: en el marcado inicial no
  // hay <img> sin src, que el navegador mostraría roto.
  $("#previewImg")?.remove();
  const imagen = document.createElement("img");
  imagen.className = "stage__img";
  imagen.id = "previewImg";
  imagen.alt = `Vista previa de ${archivo.name}`;
  imagen.decoding = "async";
  imagen.src = urlPrevia;
  escenario.prepend(imagen);

  nombrePrevia.textContent = archivo.name;
  mostrar(zonaPrompt, false);
  mostrar(zonaCargada, true);
  mostrar(acciones, true);
  btnAnalizar.disabled = false;
  reiniciarAnimacionRegistro();
  limpiarError();
  marcarPaso(2);
  estado("Fotografía lista para analizar");
}

function recibirArchivo(archivo) {
  if (!archivo) return;
  if (!TIPOS_ACEPTADOS.includes(archivo.type)) {
    mostrarError(
      "Ese archivo no es una imagen.",
      "Usa una fotografía en formato JPG o PNG."
    );
    return;
  }
  if (archivo.size > MAX_BYTES) {
    mostrarError(
      "La fotografía pesa demasiado.",
      "El límite es 50 MB. Baja la resolución a 1920 × 1080 o más e inténtalo de nuevo."
    );
    return;
  }
  prepararPrevia(archivo);
}

// Drag & drop
["dragenter", "dragover"].forEach((evt) => {
  ventanaCarga.addEventListener(evt, (e) => {
    e.preventDefault();
    ventanaCarga.classList.add("is-over");
  });
});

["dragleave", "drop"].forEach((evt) => {
  ventanaCarga.addEventListener(evt, (e) => {
    e.preventDefault();
    ventanaCarga.classList.remove("is-over");
  });
});

ventanaCarga.addEventListener("drop", (e) => {
  if (analizando) return;
  recibirArchivo(e.dataTransfer?.files?.[0]);
});

inputArchivo.addEventListener("change", (e) => {
  const archivo = e.target.files?.[0];
  e.target.value = "";
  if (archivo) recibirArchivo(archivo);
});

btnQuitar.addEventListener("click", () => {
  reiniciarFoto();
  marcarPaso(1);
  estado("Sin fotografía");
  inputArchivo.focus();
});

btnCancelar.addEventListener("click", () => {
  reiniciarFoto();
  marcarPaso(1);
  estado("Sin fotografía");
});

// ============================== ANÁLISIS ==============================

btnAnalizar.addEventListener("click", async () => {
  if (!archivoActual || analizando) return;

  analizando = true;
  control = new AbortController();
  limpiarError();
  btnAnalizar.disabled = true;
  etiquetaAnalizar.textContent = "Analizando…";
  mostrar(velo, true);
  escenario.classList.add("is-scanning");
  ventanaCarga.setAttribute("aria-busy", "true");
  marcarPaso(2);
  estado("Analizando la fotografía…", "busy");

  const datos = new FormData();
  datos.append("file", archivoActual);

  try {
    const res = await fetch(API.analyze, {
      method: "POST",
      body: datos,
      signal: control.signal,
    });
    const cuerpo = await res.json().catch(() => ({}));

    if (!res.ok) throw new Error(cuerpo.detail || "No fue posible procesar la imagen.");

    mostrarResultado(cuerpo);
    await cargarGaleria();
    marcarPaso(3);
    estado("Análisis completo", "listo");
    seccionResultado.scrollIntoView({
      behavior: sinMovimiento() ? "auto" : "smooth",
      block: "start",
    });
  } catch (err) {
    if (err.name === "AbortError") {
      marcarPaso(2);
      estado("Análisis cancelado");
      return;
    }
    // La fotografía sigue cargada: el operador reintenta desde el paso 2.
    marcarPaso(2);
    const detalle = err.message || "";
    if (/modelo/i.test(detalle)) {
      mostrarError(
        "El sistema no está listo para analizar.",
        "El modelo no se pudo cargar en el servidor. Avisa a quien administra la aplicación."
      );
    } else if (/conexi|network|fetch/i.test(detalle)) {
      mostrarError(
        "No se pudo conectar con el servidor.",
        "Comprueba que la aplicación siga encendida e inténtalo otra vez."
      );
    } else {
      mostrarError(detalle || "No fue posible procesar la fotografía.", "Inténtalo con otra imagen.");
    }
  } finally {
    analizando = false;
    control = null;
    btnAnalizar.disabled = false;
    etiquetaAnalizar.textContent = "Analizar";
    mostrar(velo, false);
    escenario.classList.remove("is-scanning");
    ventanaCarga.removeAttribute("aria-busy");
  }
});

btnCancelarAnalisis.addEventListener("click", () => {
  if (analizando) control?.abort();
});

function mostrarResultado(datos) {
  const area = Number(datos.total_area_cm2) || 0;
  const hojas = Number(datos.leaves) || 0;

  campoHojas.textContent = entero(hojas);
  campoArea.textContent = num(area);

  const cobertura = Math.min(100, Math.max(0, (area / MARCO_CM2) * 100));
  campoCobertura.textContent = `${num(cobertura, 1)} %`;
  barraCobertura.style.transform = `scaleX(${cobertura / 100})`;

  campoArchivo.textContent = datos.original_filename || "—";
  campoCuando.textContent = new Date().toLocaleTimeString("es-CL", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });

  // Detalle por hoja: el orden del modelo se conserva porque la máscara
  // rotula cada contorno con su número.
  listaHojas.innerHTML = "";
  const detalle = Array.isArray(datos.per_leaf) ? datos.per_leaf : [];
  const mayor = detalle.reduce((max, h) => Math.max(max, Number(h.area_cm2) || 0), 0);

  if (detalle.length) {
    detalle.forEach((hoja) => {
      const valor = Number(hoja.area_cm2) || 0;
      const li = document.createElement("li");
      li.className = "leaf";

      const nombre = document.createElement("span");
      nombre.className = "leaf__name";
      nombre.textContent = `Hoja ${hoja.numero}`;

      const barra = document.createElement("span");
      barra.className = "leaf__bar";
      const relleno = document.createElement("span");
      relleno.className = "leaf__fill";
      relleno.style.width = mayor > 0 ? `${(valor / mayor) * 100}%` : "0%";
      barra.append(relleno);

      const areaHoja = document.createElement("span");
      areaHoja.className = "leaf__area";
      areaHoja.textContent = `${num(valor)} cm²`;

      li.append(nombre, barra, areaHoja);
      listaHojas.appendChild(li);
    });
    mostrar(bloqueHojas, true);
  } else {
    mostrar(bloqueHojas, false);
  }

  // Las imágenes se insertan al llegar el resultado: en el marcado inicial no
  // hay <img> sin src, que el navegador mostraría roto.
  montarPlaca(placaOriginal, datos.original_url, `Fotografía original de ${datos.original_filename}`);
  montarPlaca(placaMascara, datos.mask_url, "Máscara de segmentación con el contorno de cada hoja detectada");

  btnDescarga.href = datos.download_url;
  btnDescarga.download = `analisis_${datos.original_filename}`;

  mostrar(bloqueComparacion, true);
  mostrar(bloqueDescarga, true);
  seccionResultado.hidden = false;
}

function montarPlaca(placa, url, alt) {
  const imagen = document.createElement("img");
  imagen.src = url;
  imagen.alt = alt;
  imagen.decoding = "async";
  placa.prepend(imagen);
}

// ============================== HISTORIAL ==============================

async function cargarGaleria() {
  try {
    const res = await fetch(API.gallery);
    if (!res.ok) throw new Error("No se pudo cargar el historial");
    const datos = await res.json();
    pintarGaleria(datos.items || []);
  } catch (err) {
    console.error("Galería:", err);
    notaGaleria.textContent = "No se pudo leer el historial.";
    mostrar(galeriaGrid, false);
    mostrar(galeriaVacia, true);
  }
}

function pintarGaleria(items) {
  galeriaGrid.innerHTML = "";

  if (!items.length) {
    notaGaleria.textContent = "Sin análisis todavía";
    mostrar(galeriaVacia, true);
    mostrar(galeriaGrid, false);
    return;
  }

  const plural = items.length === 1 ? "1 análisis guardado" : `${entero(items.length)} análisis guardados`;
  notaGaleria.textContent = `${plural}. Haz clic en uno para abrirlo en otra pestaña.`;
  mostrar(galeriaVacia, false);
  mostrar(galeriaGrid, true);

  items.forEach((item) => {
    const li = document.createElement("li");
    const enlace = document.createElement("a");
    enlace.className = "shot";
    enlace.href = item.url;
    enlace.target = "_blank";
    enlace.rel = "noopener";
    enlace.setAttribute(
      "aria-label",
      `Abrir la imagen procesada de ${item.original_name} en una pestaña nueva`
    );

    const imagen = document.createElement("img");
    imagen.src = item.url;
    imagen.alt = `Máscara de segmentación de ${item.original_name}`;
    imagen.loading = "lazy";

    const pie = document.createElement("figcaption");
    pie.textContent = item.original_name;

    enlace.append(imagen, pie);
    li.append(enlace);
    galeriaGrid.appendChild(li);
  });
}

btnLimpiar.addEventListener("click", async () => {
  const aceptado = await preguntar(
    "Se eliminarán las fotografías originales y las imágenes procesadas guardadas. Esta acción no se puede deshacer.",
    "Sí, borrar todo"
  );
  if (!aceptado) return;

  try {
    const res = await fetch(API.clear, { method: "POST" });
    const cuerpo = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(cuerpo.detail || "No se pudo limpiar el historial");
    reiniciarTodo();
    await cargarGaleria();
    marcarPaso(1);
    estado("Historial borrado", "listo");
  } catch (err) {
    mostrarError(err.message || "No se pudo borrar el historial.", "Inténtalo de nuevo en un momento.");
  }
});

// ============================== INICIO ==============================

document.addEventListener("DOMContentLoaded", () => {
  cargarGaleria();
  if (!localStorage.getItem(CLAVE_TUTORIAL)) {
    window.setTimeout(() => tutorial.abrir(), 350);
  }
});

window.addEventListener("beforeunload", () => {
  if (urlPrevia) URL.revokeObjectURL(urlPrevia);
});
