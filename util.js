/*
 * util.js — Ayudas pequeñas: crear elementos sin innerHTML (todo texto va como
 * texto, nunca como HTML), fechas en español corto, dinero, borradores y avisos.
 */
const MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

/* h("div", {class:"x", onclick:fn}, "texto", hijo…) */
function h(tag, attrs, ...hijos) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v === null || v === undefined || v === false) continue;
    if (k === "class") el.className = v;
    else if (k.startsWith("on") && typeof v === "function") el.addEventListener(k.slice(2), v);
    else if (k === "value" || k === "checked" || k === "disabled") el[k] = v;
    else el.setAttribute(k, v === true ? "" : v);
  }
  const poner = (x) => {
    if (x === null || x === undefined || x === false) return;
    if (Array.isArray(x)) x.forEach(poner);
    else el.append(x instanceof Node ? x : document.createTextNode(String(x)));
  };
  hijos.forEach(poner);
  return el;
}

/* Iconos fijos (constantes del código, no vienen de datos). */
const ICONOS = {
  casa: '<path d="M3 11l9-8 9 8"></path><path d="M5 10v10h5v-6h4v6h5V10"></path>',
  dinero: '<rect x="3" y="6" width="18" height="13" rx="2"></rect><path d="M3 10h18M16 14.5h2"></path>',
  mas: '<path d="M12 5v14M5 12h14"></path>'
};
function icono(nombre, color) {
  const s = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  s.setAttribute("viewBox", "0 0 24 24");
  s.setAttribute("width", "30");
  s.setAttribute("height", "30");
  s.setAttribute("fill", "none");
  s.setAttribute("stroke", color || "currentColor");
  s.setAttribute("stroke-width", "2");
  s.setAttribute("stroke-linecap", "round");
  s.setAttribute("stroke-linejoin", "round");
  s.setAttribute("aria-hidden", "true");
  s.innerHTML = ICONOS[nombre] || "";
  return s;
}

/* Fechas: "2026-11-21" -> "21 nov". Se separa a mano para evitar saltos de zona horaria. */
function fechaCorta(f) {
  if (!f) return "";
  const [, m, d] = String(f).slice(0, 10).split("-").map(Number);
  return d && m ? d + " " + MESES[m - 1] : "";
}
function hoyISO() {
  const d = new Date();
  return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
}
function mesActual() { return hoyISO().slice(0, 7); }

/* Dinero: $45 o $45.50 */
function dinero(n) {
  const x = Number(n);
  if (!isFinite(x)) return "$0";
  return "$" + (Number.isInteger(x)
    ? x.toLocaleString("en-US")
    : x.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
}

/* Borradores: lo que la persona va escribiendo sobrevive a un refresco en vivo. */
const borradores = {};

function campoTexto(id, etiqueta, opts) {
  opts = opts || {};
  const val = borradores[id] !== undefined ? borradores[id] : (opts.valor !== undefined ? opts.valor : "");
  const input = h("input", {
    id, type: opts.tipo || "text", value: String(val), placeholder: opts.placeholder,
    inputmode: opts.inputmode, min: opts.min, step: opts.step, autocomplete: opts.autocomplete || "off",
    autocapitalize: opts.autocapitalize, spellcheck: opts.spellcheck, enterkeyhint: opts.enterkeyhint,
    maxlength: opts.maxlength, "aria-describedby": opts.describe,
    oninput: (e) => { borradores[id] = e.target.value; },
    onchange: (e) => { borradores[id] = e.target.value; }
  });
  return h("label", { class: "campo" + (opts.clase ? " " + opts.clase : ""), for: id },
    h("span", { class: opts.oculta ? "solo-lector" : "" }, etiqueta), input);
}

/* Pastillas para elegir una opción (radios reales con aspecto de pastilla). */
function pastillas(nombre, etiqueta, opciones, porDefecto) {
  const actual = borradores[nombre] !== undefined ? borradores[nombre] : porDefecto;
  return h("fieldset", { class: "grupo" },
    h("legend", {}, etiqueta),
    h("div", { class: "pastillas" }, opciones.map(([valor, texto]) =>
      h("label", { class: "pastilla" },
        h("input", {
          type: "radio", name: nombre, value: valor, checked: valor === actual,
          onchange: () => { borradores[nombre] = valor; }
        }),
        h("span", {}, texto)))));
}

function limpiarBorradores(prefijo) {
  Object.keys(borradores).forEach((k) => { if (k.startsWith(prefijo)) delete borradores[k]; });
}

/* Avisos: región con aria-live que se borra sola. */
let _tAviso = null;
function aviso(texto, tipo) {
  const r = document.getElementById("avisos");
  if (!r) return;
  r.textContent = texto;
  r.className = "avisos " + (tipo || "") + (texto ? " visible" : "");
  clearTimeout(_tAviso);
  if (texto) _tAviso = setTimeout(() => { r.className = "avisos"; r.textContent = ""; }, 4500);
}

function leerLocal(clave, defecto) {
  try { const v = localStorage.getItem(clave); return v ? JSON.parse(v) : defecto; } catch (e) { return defecto; }
}
function guardarLocal(clave, valor) {
  try { localStorage.setItem(clave, JSON.stringify(valor)); } catch (e) { /* sin almacenamiento: seguimos */ }
}
