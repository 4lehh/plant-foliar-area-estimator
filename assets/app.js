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
const MARCO_ANCHO = 21.8;
const MARCO_ALTO = 30;
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

/* El manifiesto de fuentes se autohospeda, así que el navegador no puede saber
   de antemano que hacen falta; se avisa al empezar a cargar y se retira en
   cuanto el texto está listo. Sin esto la primera pintura sale con la
   tipografía de reserva. */
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

const MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

const dosCifras = (n) => String(n).padStart(2, "0");

const marcarHora = (fecha) => `${dosCifras(fecha.getHours())}:${dosCifras(fecha.getMinutes())}`;

const marcarFecha = (fecha) => `${fecha.getDate()} ${MESES[fecha.getMonth()]} ${fecha.getFullYear()}`;

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
const shell = $("#shell");
const enlaceSalto = $(".skip-link");
const nombrePrevia = $("#previewName");
const escenario = $("#stage");
const avisoEncuadre = $("#frameWarn");
const btnQuitar = $("#removeFile");
const acciones = $("#actions");
const btnAnalizar = $("#analyzeBtn");
const etiquetaAnalizar = btnAnalizar.querySelector(".btn__label");
const btnCancelar = $("#clearSelectionBtn");
const velo = $("#loaderOverlay");
const panelVelo = $("#veilPanel");
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
const campoLeyenda = $("#resultCaption");
const avisoSinHojas = $("#noLeaves");
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
    if (i === n) paso.setAttribute("aria-current", "step");
    else paso.removeAttribute("aria-current");
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

function crearDialogo(el, resultadoPorDefecto = false, focoInicial = "", respaldo = "") {
  const dlg = { el, ultimoFoco: null, respuesta: resultadoPorDefecto };

  dlg.abrir = () => {
    if (!el.hidden) return;
    dlg.ultimoFoco = document.activeElement;
    dlg.respuesta = resultadoPorDefecto;
    el.hidden = false;
    sincronizarBloqueo();
    el.addEventListener("keydown", alTeclear);
    requestAnimationFrame(() => el.classList.add("is-open"));
    // En un diálogo destructivo el foco no parte del control más cercano a la
    // X: desde ahí, Shift+Tab lleva al botón que borra.
    const inicio =
      (focoInicial && el.querySelector(focoInicial)) ||
      el.querySelector(".modal__close") ||
      el.querySelector(FOCUABLES);
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
      /* Cuando el diálogo se abrió solo, el foco previo era <body>: devolverlo
         allí deja al teclado sin punto de partida. Se cae al botón que lo abre,
         que es adonde volvería el operador de todas formas. */
      const destino =
        dlg.ultimoFoco && dlg.ultimoFoco !== document.body && document.contains(dlg.ultimoFoco)
          ? dlg.ultimoFoco
          : $(respaldo);
      if (destino) destino.focus();
      /* Avisa a quien espera el cierre (p. ej. la confirmación de borrar el
         historial) recién cuando la animación terminó y el diálogo ya no se ve.
         Se emite en cada cierre, no solo la primera vez. */
      el.dispatchEvent(new Event("cerrado"));
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

const tutorial = crearDialogo(modalTutorial, true, "", "#helpBtn");
const confirmar = crearDialogo(modalConfirmar, false, "#confirmCancel", "#clearHistoryBtn");

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

$("#helpBtn").addEventListener("click", () => {
  // La casilla refleja la última vez que se guardó la preferencia, no la de ahora.
  casillaNoMostrar.checked = leerPreferencia() === "off";
  tutorial.abrir();
});

$("#tutorialOk").addEventListener("click", () => {
  guardarPreferencia(casillaNoMostrar.checked ? "off" : "done");
});

/* En navegación privada, o con el almacenamiento bloqueado, localStorage lanza.
   Sin este abrigo, guardar la preferencia impediría cerrar el tutorial y leerla
   mataría el arranque. Perder la preferencia no es motivo para romper la app. */
function leerPreferencia() {
  try {
    return window.localStorage.getItem(CLAVE_TUTORIAL);
  } catch {
    return null;
  }
}

function guardarPreferencia(valor) {
  try {
    window.localStorage.setItem(CLAVE_TUTORIAL, valor);
    return true;
  } catch {
    return false;
  }
}

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
  ventanaCarga.classList.remove("is-loaded");
  escenario.classList.remove("is-misfit");
  mostrar(avisoEncuadre, false);
  limpiarError();
}

function reiniciarTodo() {
  reiniciarFoto();
  seccionResultado.hidden = true;
  mostrar(bloqueHojas, false);
  mostrar(bloqueComparacion, false);
  mostrar(bloqueDescarga, false);
  mostrar(avisoSinHojas, false);
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
  ventanaCarga.classList.add("is-loaded");
  btnAnalizar.disabled = false;
  comprobarEncuadre(imagen);
  reiniciarAnimacionRegistro();
  limpiarError();
  marcarPaso(2);
  estado("Fotografía lista para analizar");
}

/* El encuadre es el único error que arruina el resultado sin avisar. Con
   object-fit: contain el sobrante ya se ve, pero un aviso escrito es lo que de
   verdad detiene a quien no conoce la técnica. */
const TOLERANCIA_ENCUADRE = 0.06;

function comprobarEncuadre(imagen) {
  const revisar = () => {
    const ancho = imagen.naturalWidth;
    const alto = imagen.naturalHeight;
    escenario.classList.remove("is-misfit");
    avisoEncuadre.hidden = true;

    if (!ancho || !alto) return;

    const desvío = Math.abs(ancho / alto - MARCO_ANCHO / MARCO_ALTO) / (MARCO_ANCHO / MARCO_ALTO);
    if (desvío <= TOLERANCIA_ENCUADRE) return;

    escenario.classList.add("is-misfit");
    avisoEncuadre.hidden = false;
    avisoEncuadre.textContent =
      ancho > alto
        ? "Esta foto está horizontal y el marco es vertical. El área en cm² puede salir mal."
        : "Esta foto no tiene la proporción del marco (21,8 × 30). Si sobran bordes, vuelve a encuadrar.";
  };

  if (imagen.complete) revisar();
  else imagen.addEventListener("load", revisar, { once: true });
}

function recibirArchivo(archivo) {
  if (!archivo) return;
  // Con el análisis en marcha, cambiar de fotografía dejaría la foto nueva junto
  // al resultado de la anterior.
  if (analizando) {
    mostrarError(
      "Hay un análisis en marcha.",
      "Espera a que termine o cancálalo antes de cambiar la fotografía."
    );
    return;
  }
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
      "El límite es 50 MB. Baja la resolución o recorta la fotografía e inténtalo de nuevo."
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

// Soltar el archivo fuera de la ventana no debe hacer que el navegador navegue
// hasta él: se acepta la caída en cualquier parte de la página.
["dragover", "drop"].forEach((evt) => {
  window.addEventListener(evt, (e) => {
    if (e.target.closest("#uploadZone")) return;
    e.preventDefault();
  });
});

inputArchivo.addEventListener("change", (e) => {
  const archivo = e.target.files?.[0];
  e.target.value = "";
  if (archivo) recibirArchivo(archivo);
});

function soltarFoto() {
  reiniciarFoto();
  marcarPaso(1);
  // Si queda un resultado anterior a la vista, el riel no puede decir solo
  // "Sin fotografía": un número suelto sin contexto engaña a quien lo lea.
  estado(
    seccionResultado.hidden
      ? "Sin fotografía"
      : "Sin fotografía · el resultado de abajo es del análisis anterior"
  );
  inputArchivo.focus();
}

btnQuitar.addEventListener("click", soltarFoto);
btnCancelar.addEventListener("click", soltarFoto);

// ============================== ANÁLISIS ==============================

btnAnalizar.addEventListener("click", async () => {
  if (!archivoActual || analizando) return;

  analizando = true;
  control = new AbortController();
  limpiarError();
  mostrar(velo, true);
  // El velo tapa la página: sin esto el teclado sigue recorriendo controles que
  // parecen activos detrás de una superficie que no responde.
  shell.inert = true;
  enlaceSalto.inert = true;
  panelVelo.focus();
  btnAnalizar.disabled = true;
  etiquetaAnalizar.textContent = "Analizando…";
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
    mostrarError(...mensajeDeError(err, "No fue posible procesar la fotografía."));
  } finally {
    analizando = false;
    control = null;
    shell.inert = false;
    enlaceSalto.inert = false;
    ventanaCarga.removeAttribute("aria-busy");
    mostrar(velo, false);
    btnAnalizar.disabled = false;
    etiquetaAnalizar.textContent = "Analizar";
    // El velo se llevó el foco: se lo devuelve a quien puede reintentar.
    if (document.activeElement === document.body || !document.contains(document.activeElement)) {
      btnAnalizar.focus();
    }
  }
});

/* El detalle del backend puede traer rutas del servidor o excepciones de
   Python. Eso no se le muestra a quien mide plantas: se clasifica y se dice qué
   hacer. El texto crudo queda solo en la consola, para quien administra. */
function mensajeDeError(err, porDefecto) {
  const detalle = err?.message || "";
  console.error("Error de análisis:", detalle);

  if (/timeout|timed out|demora/i.test(detalle)) {
    return [
      "El análisis tardó demasiado.",
      "Cierra otras ventanas del equipo e inténtalo de nuevo."
    ];
  }
  if (/modelo|weights|checkpoint/i.test(detalle)) {
    return [
      "El sistema no está listo para analizar.",
      "El modelo no se pudo cargar en el servidor. Avisa a quien administra la aplicación."
    ];
  }
  if (/conexi|network|fetch|failed to fetch/i.test(detalle)) {
    return [
      "No se pudo conectar con el servidor.",
      "Comprueba que la aplicación siga encendida e inténtalo otra vez."
    ];
  }
  if (/permiso|permission denied|errno 13|no such file|espacio/i.test(detalle)) {
    return [
      "El servidor no pudo guardar la fotografía.",
      "Es un problema del equipo que administra la aplicación, no de tu foto."
    ];
  }
  return [porDefecto, "Inténtalo con otra fotografía."];
}

btnCancelarAnalisis.addEventListener("click", () => {
  if (analizando) control?.abort();
});

function mostrarResultado(datos) {
  const area = Number(datos.total_area_cm2) || 0;
  const hojas = Number(datos.leaves) || 0;

  campoHojas.textContent = entero(hojas);
  campoArea.textContent = num(area);

  /* Una cobertura sobre 100 % no es un dato: es la evidencia de que la muestra
     no cabe en el marco. Mostrarla como "100,0 %" escondería la prueba, así que
     el número se muestra tal cual y la barra cambia de color. */
  const coberturaReal = (area / MARCO_CM2) * 100;
  const excede = coberturaReal > 100;
  const cobertura = Math.min(100, Math.max(0, coberturaReal));
  campoCobertura.textContent = `${num(coberturaReal, 1)} %`;
  barraCobertura.style.transform = `scaleX(${cobertura / 100})`;
  barraCobertura.parentElement.classList.toggle("is-over", excede);

  // Cero hojas no es un resultado de 0 cm²: es un análisis que no encontró nada.
  const sinHojas = hojas === 0 || area === 0;
  campoLeyenda.textContent = sinHojas
    ? "No se detectó ninguna hoja en esta fotografía"
    : excede
      ? "Área foliar total, mayor que el marco: revisa el encuadre"
      : "Área foliar total detectada";

  campoArchivo.textContent = datos.original_filename || "—";
  // Hora y fecha: en una tanda de muchas muestras, la hora sola no dice de qué
  // día era el número. El formato se escribe a mano para no depender de cómo
  // el navegador localize los meses.
  campoCuando.textContent = `${marcarFecha(new Date())} · ${marcarHora(new Date())}`;

  // Detalle por hoja: el orden del modelo se conserva porque la imagen
  // procesada rotula cada contorno con su número.
  listaHojas.innerHTML = "";
  const detalle = Array.isArray(datos.per_leaf) ? datos.per_leaf : [];
  const mayor = detalle.reduce((max, h) => Math.max(max, Number(h.area_cm2) || 0), 0);

  if (detalle.length) {
    detalle.forEach((hoja, i) => {
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
      relleno.style.setProperty("--i", String(i));
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

  if (sinHojas) {
    avisoSinHojas.hidden = false;
  } else {
    avisoSinHojas.hidden = true;
  }

  // Las imágenes se insertan al llegar el resultado: en el marcado inicial no
  // hay <img> sin src, que el navegador mostraría roto.
  montarPlaca(placaOriginal, datos.original_url, `Fotografía original de ${datos.original_filename}`);
  montarPlaca(
    placaMascara,
    datos.mask_url,
    "Imagen procesada: contorno de cada hoja detectada sobre la fotografía"
  );

  btnDescarga.href = datos.download_url;
  btnDescarga.download = `analisis_${datos.original_filename}`;

  mostrar(bloqueComparacion, true);
  mostrar(bloqueDescarga, true);
  seccionResultado.hidden = false;
}

function montarPlaca(placa, url, alt) {
  // Reemplaza la imagen anterior: sin esto, cada análisis añade una <img> nueva
  // encima de la del análisis previo y las placas muestran dos imágenes.
  placa.querySelectorAll("img").forEach((vieja) => vieja.remove());
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
    // Falló la lectura: no se afirma que no haya análisis, que es otra cosa.
    notaGaleria.textContent = "No se pudo leer el historial. Recarga la página para intentarlo de nuevo.";
    mostrar(galeriaGrid, false);
    mostrar(galeriaVacia, false);
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
    imagen.alt = `Imagen procesada de ${item.original_name}: contornos de las hojas detectadas`;
    imagen.loading = "lazy";
    imagen.decoding = "async";

    const pie = document.createElement("figcaption");
    pie.textContent = item.original_name;

    // figcaption solo es válido como hijo de figure, y el enlace es interactivo:
    // la figura va dentro del enlace, no al revés.
    const figura = document.createElement("figure");
    figura.append(imagen, pie);
    enlace.append(figura);
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
  if (!leerPreferencia()) {
    window.setTimeout(() => tutorial.abrir(), 350);
  }
});

window.addEventListener("beforeunload", () => {
  if (urlPrevia) URL.revokeObjectURL(urlPrevia);
});
