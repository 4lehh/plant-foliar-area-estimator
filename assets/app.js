const API = {
  analyze: "/api/analyze",
  gallery: "/api/gallery",
  clear: "/api/clear",
};

// ESTADO
let currentFile = null;
let currentMaskFilename = null;

// UTILIDADES

const $ = (sel, ctx = document) => ctx.querySelector(sel);
const $$ = (sel, ctx = document) => [...ctx.querySelectorAll(sel)];

const formatArea = (value) => {
  const num = Number(value);
  if (!isFinite(num)) return "—";
  return num.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " cm²";
};

const show = (el, show = true) => {
  if (!el) return;
  el.hidden = !show;
  el.classList.toggle("hidden", !show);
};

const setLoading = (btn, loading) => {
  if (!btn) return;
  const text = btn.querySelector(".btn__text");
  const loader = btn.querySelector(".btn__loader");
  btn.disabled = loading;
  show(text, !loading);
  show(loader, loading);
  btn.classList.toggle("loading", loading);
};

// ELEMENTOS DOM
const uploadZone = $("#uploadZone");
const fileInput = $("#fileInput");
const uploadPreview = $("#uploadPreview");
const previewImg = $("#previewImg");
const removeFileBtn = $("#removeFile");
const clearSelectionBtn = $("#clearSelectionBtn");
const actions = $("#actions");
const analyzeBtn = $("#analyzeBtn");
const loaderOverlay = $("#loaderOverlay");
const errorBox = $("#errorBox");

const resultsSection = $("#resultsSection");
const leavesCount = $("#leavesCount");
const totalArea = $("#totalArea");
const leafDetail = $("#leafDetail");
const leafTableBody = $("#leafTableBody");
const comparison = $("#comparison");
const originalImg = $("#originalImg");
const maskImg = $("#maskImg");
const downloadBtn = $("#downloadBtn");

const galleryEmpty = $("#galleryEmpty");
const galleryGrid = $("#galleryGrid");
const clearHistoryBtn = $("#clearHistoryBtn");

// ============================== FUNCIONES DE UI ==============================

function resetUploadUI() {
  currentFile = null;
  currentMaskFilename = null;
  show(uploadZone.querySelector(".upload-zone__content"), true);
  show(uploadPreview, false);
  show(actions, false);
  show(errorBox, false);
  analyzeBtn.disabled = true;
  resultsSection.hidden = true;
  resultsSection.classList.add("hidden");
  show(leafDetail, false);
  show(comparison, false);
}

function setUploadPreview(file) {
  const url = URL.createObjectURL(file);
  previewImg.src = url;
  previewImg.alt = `Vista previa: ${file.name}`;
  show(uploadZone.querySelector(".upload-zone__content"), false);
  show(uploadPreview, true);
  show(actions, true);
  analyzeBtn.disabled = false;
}

function showError(message) {
  errorBox.textContent = message;
  show(errorBox, true);
  setLoading(analyzeBtn, false);
}

function clearError() {
  show(errorBox, false);
}

function renderResults(data) {
  // Métricas
  leavesCount.textContent = data.leaves;
  totalArea.textContent = formatArea(data.total_area_cm2);

  // Detalle por hoja
  leafTableBody.innerHTML = "";
  if (data.per_leaf && data.per_leaf.length > 0) {
    data.per_leaf.forEach((hoja) => {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>Hoja ${hoja.numero}</td>
        <td>${formatArea(hoja.area_cm2)}</td>
      `;
      leafTableBody.appendChild(tr);
    });
    show(leafDetail, true);
  } else {
    show(leafDetail, false);
  }

  // Comparación visual
  originalImg.src = data.original_url;
  originalImg.alt = `Fotografía original: ${data.original_filename}`;
  maskImg.src = data.mask_url;
  maskImg.alt = `Máscara de segmentación: ${data.mask_filename}`;
  downloadBtn.href = data.download_url;
  downloadBtn.download = `analisis_${data.original_filename}`;

  show(comparison, true);
  show(resultsSection, true);
  resultsSection.classList.remove("hidden");

  // Guardar para referencia
  currentMaskFilename = data.mask_filename;
}

function renderGallery(items) {
  galleryGrid.innerHTML = "";
  if (!items || items.length === 0) {
    show(galleryEmpty, true);
    show(galleryGrid, false);
    return;
  }
  show(galleryEmpty, false);
  show(galleryGrid, true);

  items.forEach((item) => {
    const li = document.createElement("li");
    li.className = "gallery-item";
    li.role = "listitem";
    li.innerHTML = `
      <figure class="image-frame">
        <img src="${item.url}" alt="${item.original_name}" loading="lazy" />
        <figcaption>${item.original_name}</figcaption>
      </figure>
    `;
    // Click abre la imagen original en nueva pestaña
    li.querySelector("img").addEventListener("click", () => {
      window.open(item.url, "_blank", "noopener");
    });
    galleryGrid.appendChild(li);
  });
}

async function loadGallery() {
  try {
    const res = await fetch(API.gallery);
    if (!res.ok) throw new Error("Error al cargar galería");
    const data = await res.json();
    renderGallery(data.items);
  } catch (err) {
    console.error("Galería:", err);
    show(galleryEmpty, true);
    show(galleryGrid, false);
    galleryEmpty.querySelector("p").textContent = "No se pudo cargar el historial.";
  }
}

// ============================== EVENTOS ==============================

// Drag & drop en zona de subida
["dragenter", "dragover"].forEach((evt) => {
  uploadZone.addEventListener(evt, (e) => {
    e.preventDefault();
    e.stopPropagation();
    uploadZone.classList.add("dragover");
  });
});

["dragleave", "drop"].forEach((evt) => {
  uploadZone.addEventListener(evt, (e) => {
    e.preventDefault();
    e.stopPropagation();
    uploadZone.classList.remove("dragover");
  });
});

uploadZone.addEventListener("drop", (e) => {
  const file = e.dataTransfer.files[0];
  if (file) handleFileSelect(file);
});

uploadZone.addEventListener("click", (e) => {
  if (e.target.closest(".upload-zone__remove")) return;
  if (e.target.closest("#uploadPreview")) return;
  fileInput.click();
});

uploadZone.addEventListener("keydown", (e) => {
  if (e.key === "Enter" || e.key === " ") {
    e.preventDefault();
    fileInput.click();
  }
});

fileInput.addEventListener("change", (e) => {
  if (e.target.files[0]) handleFileSelect(e.target.files[0]);
});

removeFileBtn.addEventListener("click", (e) => {
  e.stopPropagation();
  resetUploadUI();
});

clearSelectionBtn.addEventListener("click", resetUploadUI);

function handleFileSelect(file) {
  const allowed = ["image/jpeg", "image/png", "image/jpg"];
  if (!allowed.includes(file.type)) {
    showError("Formato no permitido. Usa JPG, JPEG o PNG.");
    fileInput.value = "";
    return;
  }
  if (file.size > 50 * 1024 * 1024) {
    showError("El archivo supera el límite de 50 MB.");
    fileInput.value = "";
    return;
  }
  currentFile = file;
  clearError();
  setUploadPreview(file);
}

// Analizar
analyzeBtn.addEventListener("click", async () => {
  if (!currentFile) return;
  clearError();
  setLoading(analyzeBtn, true);
  show(loaderOverlay, true);

  const formData = new FormData();
  formData.append("file", currentFile);

  try {
    const res = await fetch(API.analyze, {
      method: "POST",
      body: formData,
    });
    const data = await res.json();

    if (!res.ok) {
      throw new Error(data.detail || "Error en el servidor");
    }

    renderResults(data);
    await loadGallery();
  } catch (err) {
    showError(err.message || "No fue posible procesar la imagen.");
  } finally {
    setLoading(analyzeBtn, false);
    show(loaderOverlay, false);
  }
});

// Limpiar historial
clearHistoryBtn.addEventListener("click", async () => {
  if (!confirm("¿Eliminar todo el historial de análisis? Esta acción no se puede deshacer.")) return;

  try {
    const res = await fetch(API.clear, { method: "POST" });
    const data = await res.json();
    if (!res.ok) throw new Error(data.detail || "Error al limpiar");
    resetUploadUI();
    await loadGallery();
  } catch (err) {
    alert("Error al limpiar historial: " + err.message);
  }
});

// ============================== INICIO ==============================
document.addEventListener("DOMContentLoaded", () => {
  loadGallery();
});

// Limpieza de URLs de objeto al salir
window.addEventListener("beforeunload", () => {
  if (previewImg.src.startsWith("blob:")) URL.revokeObjectURL(previewImg.src);
});