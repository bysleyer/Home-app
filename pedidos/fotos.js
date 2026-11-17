/*
 * pedidos/fotos.js — Fotos de las facturas (captura del carrito o del pago, con impuestos).
 * - Preparar: comprime cada imagen en el navegador (lado mayor 2000 px, JPEG).
 * - Selector del formulario "Pedir" (añadir, miniaturas, quitar).
 * - Ver: fila de miniaturas y visor a pantalla completa. Las URLs firmadas se piden
 *   al abrir/ver y se guardan SOLO en memoria con su caducidad.
 * El bucket "facturas" es privado: nunca se guarda una URL en la base, solo la ruta.
 */
const Fotos = {
  MAX: 4,
  LADO: 2000,
  CALIDAD: 0.85,
  CALIDAD_BAJA: 0.7,
  LIMITE_BYTES: 5 * 1024 * 1024,
  VIGENCIA: 3600,          // segundos que pedimos al firmar
  RENOVAR_ANTES: 300000,   // ms: si faltan menos de 5 min, se pide otra
  _urls: {},               // ruta -> { url, caduca (ms) }
  _pendientes: {},         // ruta -> promesa en curso
  procesando: false,
  aviso: "",               // mensaje junto al selector

  /* ---------- compresión ---------- */
  async _leer(file) {
    if (typeof createImageBitmap === "function") {
      try { const bm = await createImageBitmap(file, { imageOrientation: "from-image" }); return { img: bm, w: bm.width, h: bm.height, cerrar: () => { try { bm.close(); } catch (e) { /* nada */ } } }; }
      catch (e) { /* probamos con <img> */ }
    }
    const url = URL.createObjectURL(file);
    try {
      const img = await new Promise((ok, mal) => {
        const i = new Image();
        i.onload = () => ok(i);
        i.onerror = () => mal(new Error("no se pudo leer"));
        i.src = url;
      });
      return { img, w: img.naturalWidth, h: img.naturalHeight, cerrar: () => {} };
    } finally { URL.revokeObjectURL(url); }
  },

  _jpeg(canvas, calidad) {
    return new Promise((ok, mal) => canvas.toBlob((b) => (b ? ok(b) : mal(new Error("sin blob"))), "image/jpeg", calidad));
  },

  /* File -> Blob JPEG (lado mayor <= 2000 px; si pasa de 5 MB baja la calidad). */
  async comprimir(file) {
    const f = await this._leer(file);
    try {
      if (!f.w || !f.h) throw new Error("imagen vacía");
      let escala = Math.min(1, this.LADO / Math.max(f.w, f.h));
      let blob = null;
      for (let intento = 0; intento < 4; intento++) {
        const c = document.createElement("canvas");
        c.width = Math.max(1, Math.round(f.w * escala));
        c.height = Math.max(1, Math.round(f.h * escala));
        const ctx = c.getContext("2d");
        ctx.fillStyle = "#fff"; // los PNG con transparencia no se vuelven negros
        ctx.fillRect(0, 0, c.width, c.height);
        ctx.drawImage(f.img, 0, 0, c.width, c.height);
        blob = await this._jpeg(c, this.CALIDAD);
        if (blob.size > this.LIMITE_BYTES) blob = await this._jpeg(c, this.CALIDAD_BAJA);
        if (blob.size <= this.LIMITE_BYTES) break;
        escala *= 0.75; // caso raro: aún pesa más de 5 MB
      }
      if (blob.size > this.LIMITE_BYTES) throw new Error("pesa demasiado");
      return blob;
    } finally { f.cerrar(); }
  },

  /* ---------- selector del formulario ---------- */
  lista() { if (!borradores["p-fotos"]) borradores["p-fotos"] = []; return borradores["p-fotos"]; },

  async añadir(archivos) {
    const fotos = this.lista();
    const libres = this.MAX - fotos.length;
    const todos = Array.from(archivos || []);
    this.aviso = "";
    if (!todos.length) return;
    if (libres <= 0) { this.aviso = "Ya tienes " + this.MAX + " fotos, que es el máximo."; return App.pintar(); }
    const aceptar = todos.slice(0, libres);
    if (todos.length > libres) this.aviso = "Solo caben " + this.MAX + " fotos. Se añadieron las primeras " + libres + ".";
    this.procesando = true;
    App.pintar();
    let fallo = false;
    for (const f of aceptar) {
      try {
        const blob = await this.comprimir(f);
        fotos.push({ blob, vista: URL.createObjectURL(blob), ruta: null });
      } catch (e) { fallo = true; }
    }
    this.procesando = false;
    if (fallo) this.aviso = "No se pudo leer esa foto. Prueba con una captura de pantalla.";
    Pedidos._errorFotos = "";
    App.pintar();
  },

  quitar(i) {
    const fotos = this.lista();
    const x = fotos.splice(i, 1)[0];
    if (x) URL.revokeObjectURL(x.vista);
    this.aviso = "";
    App.pintar();
    const b = document.getElementById("p-fotos-input");
    const prox = document.getElementById("p-foto-quitar-" + Math.min(i, fotos.length - 1));
    (prox || b || document.getElementById("p-fotos-label")).focus();
  },

  soltarTodas() {
    this.lista().forEach((x) => URL.revokeObjectURL(x.vista));
    delete borradores["p-fotos"];
    this.aviso = "";
  },

  campo(error) {
    const fotos = this.lista();
    const lleno = fotos.length >= this.MAX;
    const msg = error || this.aviso;
    return h("fieldset", { class: "grupo campo-fotos" },
      h("legend", {}, "Captura del carrito o del pago"),
      h("p", { class: "meta", id: "p-fotos-ayuda" }, "Toma una captura donde se vean los artículos, sus precios y el total con impuestos."),
      fotos.length ? h("ul", { class: "fotos-elegidas" }, fotos.map((x, i) =>
        h("li", { class: "foto-elegida" },
          h("img", { src: x.vista, alt: "Foto " + (i + 1) }),
          h("button", {
            type: "button", class: "btn btn-sec", id: "p-foto-quitar-" + i,
            "aria-label": "Quitar foto " + (i + 1), onclick: () => this.quitar(i)
          }, "Quitar")))) : null,
      h("label", { class: "btn btn-grande btn-sec foto-añadir" + (lleno || this.procesando ? " desactivado" : ""), id: "p-fotos-label", for: "p-fotos-input" },
        this.procesando ? "Preparando foto…" : "Añadir foto",
        h("input", {
          type: "file", accept: "image/*", multiple: true, id: "p-fotos-input", class: "solo-lector",
          disabled: lleno || this.procesando, "aria-describedby": "p-fotos-ayuda",
          onchange: (e) => { const l = Array.from(e.target.files); e.target.value = ""; this.añadir(l); }
        })),
      h("p", { class: "meta" }, fotos.length + " de " + this.MAX + " fotos"),
      msg ? h("p", { class: "error", role: "alert" }, msg) : null);
  },

  /* ---------- URLs firmadas (en memoria) ---------- */
  async url(ruta) {
    const c = this._urls[ruta];
    if (c && c.caduca - Date.now() > this.RENOVAR_ANTES) return c.url;
    if (this._pendientes[ruta]) return this._pendientes[ruta];
    const p = (async () => {
      try {
        const { data, error } = await db.storage.from("facturas").createSignedUrl(ruta, this.VIGENCIA);
        if (error || !data || !data.signedUrl) return null;
        this._urls[ruta] = { url: data.signedUrl, caduca: Date.now() + this.VIGENCIA * 1000 };
        return data.signedUrl;
      } catch (e) { return null; }
      finally { delete this._pendientes[ruta]; }
    })();
    this._pendientes[ruta] = p;
    return p;
  },
  _vigente(ruta) { const c = this._urls[ruta]; return c && c.caduca - Date.now() > this.RENOVAR_ANTES ? c.url : null; },

  /* ---------- miniaturas ---------- */
  fila(p) {
    const rutas = Array.isArray(p.fotos) ? p.fotos : [];
    if (!rutas.length) return null;
    return h("div", { class: "fotos-fila" }, rutas.map((ruta, i) => {
      const img = h("img", { alt: "", loading: "lazy", draggable: "false" });
      const boton = h("button", {
        type: "button", class: "foto-mini", "data-foto": p.id + ":" + i,
        "aria-label": "Ver factura" + (rutas.length > 1 ? ", foto " + (i + 1) + " de " + rutas.length : ""),
        onclick: () => this.abrir(rutas, i, p.id + ":" + i)
      }, img);
      const ponerla = (u) => { if (u) img.src = u; else boton.classList.add("sin-imagen"); };
      const ya = this._vigente(ruta);
      if (ya) img.src = ya;
      else if ("IntersectionObserver" in window) {
        const io = new IntersectionObserver((es) => {
          if (es.some((x) => x.isIntersecting)) { io.disconnect(); this.url(ruta).then(ponerla); }
        });
        io.observe(boton);
      } else this.url(ruta).then(ponerla);
      return boton;
    }));
  },

  /* ---------- visor ---------- */
  _visor: null,

  abrir(rutas, indice, clave) {
    this.cerrar(true);
    let actual = indice;
    const raiz = document.getElementById("app");
    const img = h("img", { class: "visor-img", alt: "" });
    const estado = h("p", { class: "visor-estado", role: "status" });
    const cuenta = h("span", { class: "visor-cuenta" });
    const enlace = h("a", { class: "btn visor-btn", target: "_blank", rel: "noopener noreferrer" }, "Abrir en grande");
    const cuerpo = h("div", { class: "visor-cuerpo", tabindex: "-1" }, img, estado);
    const cerrarBtn = h("button", { type: "button", class: "btn visor-btn", onclick: () => this.cerrar() }, "Cerrar");
    const multi = rutas.length > 1;
    const ir = (d) => { actual = (actual + d + rutas.length) % rutas.length; mostrar(); };
    const barra = h("div", { class: "visor-barra" },
      cerrarBtn,
      multi ? h("button", { type: "button", class: "btn visor-btn", onclick: () => ir(-1) }, "Anterior") : null,
      multi ? h("button", { type: "button", class: "btn visor-btn", onclick: () => ir(1) }, "Siguiente") : null,
      enlace, cuenta);
    const dlg = h("div", { class: "visor", role: "dialog", "aria-modal": "true", "aria-label": "Factura del pedido" }, barra, cuerpo);

    let ticket = 0;
    const mostrar = async () => {
      const mio = ++ticket;
      cuenta.textContent = multi ? "Foto " + (actual + 1) + " de " + rutas.length : "";
      img.removeAttribute("src"); img.alt = ""; img.hidden = true;
      enlace.removeAttribute("href"); enlace.setAttribute("aria-disabled", "true");
      estado.textContent = "Cargando…";
      cuerpo.scrollTop = 0;
      const u = await this.url(rutas[actual]);
      if (mio !== ticket || this._visor !== estadoVisor) return;
      if (!u) { estado.textContent = "No se pudo cargar la foto. Revisa tu conexión."; return; }
      estado.textContent = "";
      img.alt = "Factura" + (multi ? ", foto " + (actual + 1) + " de " + rutas.length : "");
      img.src = u; img.hidden = false;
      enlace.href = u; enlace.removeAttribute("aria-disabled");
    };

    const teclas = (e) => {
      if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); this.cerrar(); return; }
      if (e.key === "Tab") {
        const f = Array.from(dlg.querySelectorAll("button:not([disabled]), a[href], [tabindex='-1']")).filter((x) => !x.hidden);
        const foco = f.filter((x) => x.getAttribute("tabindex") !== "-1");
        if (!foco.length) { e.preventDefault(); return; }
        const primero = foco[0], ultimo = foco[foco.length - 1];
        if (!dlg.contains(document.activeElement)) { e.preventDefault(); primero.focus(); }
        else if (e.shiftKey && document.activeElement === primero) { e.preventDefault(); ultimo.focus(); }
        else if (!e.shiftKey && document.activeElement === ultimo) { e.preventDefault(); primero.focus(); }
      } else if (multi && e.key === "ArrowLeft") ir(-1);
      else if (multi && e.key === "ArrowRight") ir(1);
    };
    const fuera = (e) => { if (!dlg.contains(e.target)) { e.stopPropagation(); cerrarBtn.focus(); } };
    document.addEventListener("keydown", teclas, true);
    document.addEventListener("focusin", fuera, true);

    const estadoVisor = { dlg, clave, teclas, fuera, inert: raiz ? raiz.hasAttribute("inert") : false, overflow: document.body.style.overflow };
    this._visor = estadoVisor;
    if (raiz) { raiz.setAttribute("inert", ""); raiz.setAttribute("aria-hidden", "true"); }
    document.body.style.overflow = "hidden";
    document.body.append(dlg);
    cerrarBtn.focus();
    mostrar();
  },

  cerrar(sinFoco) {
    const v = this._visor;
    if (!v) return;
    this._visor = null;
    document.removeEventListener("keydown", v.teclas, true);
    document.removeEventListener("focusin", v.fuera, true);
    v.dlg.remove();
    const raiz = document.getElementById("app");
    if (raiz) { raiz.removeAttribute("inert"); raiz.removeAttribute("aria-hidden"); }
    document.body.style.overflow = v.overflow;
    if (sinFoco) return;
    const b = document.querySelector('[data-foto="' + v.clave + '"]');
    if (b) b.focus();
  }
};
