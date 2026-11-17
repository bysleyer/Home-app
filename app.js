/*
 * app.js — Sesión, perfil y router entre pantallas (login, inicio, Pedidos, contraseña).
 * Toda la pantalla se vuelve a dibujar con App.pintar(); lo que la persona escribe
 * se guarda en `borradores` (util.js) para no perderlo cuando llega un cambio en vivo.
 */
const App = {
  sesion: null,
  perfil: null,
  vista: "cargando",     // cargando | login | sinperfil | inicio | pedidos | clave | errorperfil
  menuAbierto: false,
  loginError: "",
  loginAyuda: false,
  claveError: "",
  canales: [],
  _tRefresco: null,

  /* ---------- arranque y sesión ---------- */
  async arrancar() {
    this.pintar();
    window.addEventListener("online", () => { this.pintarConexion(); this.refrescar(); });
    window.addEventListener("offline", () => this.pintarConexion());
    document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") this.refrescar(); });
    document.addEventListener("click", (e) => {
      if (this.menuAbierto && !e.target.closest(".menu-zona")) { this.menuAbierto = false; this.pintar(); }
    });
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && this.menuAbierto) { this.menuAbierto = false; this.pintar(); const b = document.getElementById("menu-btn"); if (b) b.focus(); }
    });
    try {
      db.auth.onAuthStateChange((evento, ses) => {
        if (!ses && this.sesion) this.cerrarLocal();
      });
    } catch (e) { /* sin eventos de sesión: seguimos */ }
    try {
      const { data, error } = await db.auth.getSession();
      if (error || !data || !data.session) { this.vista = "login"; return this.pintar(); }
      await this.iniciar(data.session);
    } catch (e) {
      this.vista = "login";
      this.pintar();
    }
  },

  async iniciar(sesion) {
    this.sesion = sesion;
    this.vista = "cargando";
    this.pintar();
    const uid = sesion.user.id;
    let perfil = null, fallo = false;
    try {
      const { data, error } = await db.from("perfiles").select("id,nombre,rol").eq("id", uid).maybeSingle();
      if (error) fallo = true; else perfil = data;
    } catch (e) { fallo = true; }
    if (fallo) { this.vista = "errorperfil"; return this.pintar(); }
    if (!perfil) { this.vista = "sinperfil"; return this.pintar(); }
    this.perfil = perfil;
    this.vista = "inicio";
    this.pintar();
    this.suscribir();
    await Datos.cargar(Datos.claves(perfil.rol));
    this.pintar();
  },

  async entrar(e) {
    e.preventDefault();
    let u = (borradores["l-usuario"] || "").trim();
    const clave = borradores["l-clave"] || "";
    if (!u || !clave) { this.loginError = "Escribe tu usuario y tu contraseña."; this.loginAyuda = false; return this.pintar(); }
    if (!u.includes("@")) u = u + "@" + CONFIG.DOMINIO_USUARIOS;
    const btn = document.getElementById("l-entrar");
    if (btn) { btn.disabled = true; btn.textContent = "Entrando…"; }
    let res;
    try { res = await db.auth.signInWithPassword({ email: u, password: clave }); }
    catch (err) { res = { error: err }; }
    const { data, error } = res;
    if (error || !data || !data.session) {
      const txt = ((error && (error.name || "")) + " " + (error && (error.message || ""))).toLowerCase();
      const red = !navigator.onLine || /fetch|network|retryable|failed to|timeout/.test(txt);
      this.loginError = red ? "Sin conexión. Revisa tu internet e inténtalo otra vez." : "Usuario o contraseña incorrectos";
      this.loginAyuda = !red;
      delete borradores["l-clave"];
      return this.pintar();
    }
    this.loginError = ""; this.loginAyuda = false;
    delete borradores["l-clave"];
    await this.iniciar(data.session);
  },

  async salir() {
    this.menuAbierto = false;
    try { await db.auth.signOut(); } catch (e) { /* aunque falle la red, cerramos aquí */ }
    this.cerrarLocal();
  },

  cerrarLocal() {
    this.desuscribir();
    this.sesion = null; this.perfil = null;
    Datos.pedidos = []; Datos.resumen = null; Datos.ajustes = null; Datos.evaluaciones = {}; Datos.miDinero = null; Datos.nombres = {};
    Semaforo.abierto = false; Semaforo.error = ""; Semaforo.guardando = false;
    // Fotos: cerrar el visor, olvidar los enlaces firmados de esta cuenta y liberar las fotos elegidas.
    if (typeof Fotos !== "undefined") {
      try { if (Fotos._visor) Fotos.cerrar(true); } catch (e) { /* nada que cerrar */ }
      Fotos._urls = {};
      (borradores["p-fotos"] || []).forEach((f) => { try { if (f && f.vista) URL.revokeObjectURL(f.vista); } catch (e) { /* ya liberada */ } });
    }
    Object.keys(borradores).forEach((k) => delete borradores[k]);
    this.vista = "login"; this.menuAbierto = false;
    this.pintar();
  },

  /* ---------- tiempo real ---------- */
  suscribir() {
    this.desuscribir();
    try {
      // Ella: pedidos y resumen (semáforo). Dueño: además lo que escribe el puente de Mi dinero.
      const tablas = ["pedidos", "resumen"];
      if (this.perfil && this.perfil.rol === "dueno") tablas.push("evaluaciones", "mi_dinero_estado");
      let canal = db.channel("home-pedidos");
      tablas.forEach((t) => { canal = canal.on("postgres_changes", { event: "*", schema: "public", table: t }, () => this.cambio(t)); });
      canal = canal.subscribe();
      this.canales.push(canal);
    } catch (e) { /* si falla el tiempo real, la app sigue: se refresca al volver a la pestaña */ }
  },
  desuscribir() {
    this.canales.forEach((c) => { try { db.removeChannel(c); } catch (e) { /* nada */ } });
    this.canales = [];
  },

  /* Varios cambios seguidos (pedido, resumen, evaluación…) se juntan en una sola recarga. */
  _pendientes: new Set(),
  cambio(tabla) {
    this._pendientes.add(tabla);
    clearTimeout(this._tRefresco);
    this._tRefresco = setTimeout(async () => {
      const tablas = Array.from(this._pendientes);
      this._pendientes.clear();
      if (!this.perfil) return;
      const claves = new Set();
      tablas.forEach((t) => {
        if (t === "pedidos") { claves.add("pedidos"); claves.add("resumen"); }   // un cambio en pedidos recalcula el semáforo en la base
        else if (t === "resumen") claves.add("resumen");
        else if (t === "evaluaciones") claves.add("evaluaciones");
        else if (t === "mi_dinero_estado") { claves.add("miDinero"); claves.add("resumen"); }
      });
      if (this.perfil.rol !== "dueno") { claves.delete("evaluaciones"); claves.delete("miDinero"); }
      await Datos.cargar(Array.from(claves));
      if (this.vista === "inicio" || (this.vista === "pedidos" && tablas.some((t) => AppPedidos.relevante(t)))) {
        if (this.vista === "pedidos") AppPedidos.marcarVistos();
        this.pintar();
      } else if (this.vista === "pedidos") {
        AppPedidos.marcarVistos();
      }
    }, 250);
  },

  /* Recarga lo de la pantalla actual (al volver a la pestaña, al volver internet, botón Reintentar). */
  async refrescar() {
    if (!this.perfil) return;
    if (this.vista === "inicio") await Datos.cargar(Datos.claves(this.perfil.rol));
    else if (this.vista === "pedidos") { await Datos.cargar(Datos.claves(this.perfil.rol)); AppPedidos.marcarVistos(); }
    else return;
    this.pintar();
  },

  falloRed(texto) {
    aviso(navigator.onLine ? texto + " Revisa tu conexión." : "Sin conexión. Inténtalo cuando vuelva internet.", "error");
  },

  /* ---------- dibujo ---------- */
  pintarConexion() {
    const b = document.getElementById("sinconexion");
    if (b) b.hidden = navigator.onLine;
    document.documentElement.style.setProperty("--alto-sinconexion", navigator.onLine ? "0px" : "32px"); // la cabecera pegajosa baja bajo el aviso
  },

  pintar() {
    const raiz = document.getElementById("app");
    if (!raiz) return;
    const act = document.activeElement;
    const foco = act && act.id ? { id: act.id, a: act.selectionStart, b: act.selectionEnd } : null;
    const y = window.scrollY;
    let nodo;
    try { nodo = this.construir(); } catch (e) { nodo = h("p", { class: "error", role: "alert" }, "Algo salió mal. Recarga la página."); }
    raiz.replaceChildren(nodo);
    this.pintarConexion();
    if (foco) {
      const el = document.getElementById(foco.id);
      if (el) { el.focus({ preventScroll: true }); try { if (foco.a !== null && foco.a !== undefined) el.setSelectionRange(foco.a, foco.b); } catch (e) { /* tipos sin selección */ } }
    }
    window.scrollTo(0, y);
  },

  construir() {
    switch (this.vista) {
      case "login": return this.pantallaLogin();
      case "sinperfil": return this.pantallaSimple("Tu cuenta no tiene acceso todavía", "Pídele a Sleyer que te dé acceso.", true);
      case "errorperfil": return this.pantallaSimple("No se pudo cargar tu cuenta", "Revisa tu conexión e inténtalo otra vez.", true, true);
      case "cargando": return this.pantallaSimple("Home", "Cargando…", false);
      case "clave": return this.marco("Cambiar contraseña", this.pantallaClave(), null, "inicio");
      case "pedidos": return this.marco(AppPedidos.titulo(), this.conAviso(AppPedidos.contenido()), AppPedidos.nav(), "inicio");
      default: return this.marco("Hola, " + this.perfil.nombre, this.conAviso(Inicio.vista()), null, null);
    }
  },

  /* Si no se pudo leer de la base, lo decimos con palabras simples. */
  conAviso(contenido) {
    if (!Datos.error) return contenido;
    return h("div", { class: "pila" },
      h("div", { class: "tarjeta aviso-error", role: "alert" },
        h("span", {}, navigator.onLine ? "No se pudo cargar todo." : "Sin conexión."),
        h("button", { type: "button", class: "btn btn-sec", onclick: () => this.refrescar() }, "Reintentar")),
      contenido);
  },

  pantallaSimple(titulo, texto, conSalir, conReintentar) {
    return h("div", { class: "centrado" },
      h("div", { class: "logo" }, icono("casa", "#2457C5")),
      h("h1", {}, titulo),
      h("p", { class: "texto-suave" }, texto),
      conReintentar ? h("button", { type: "button", class: "btn btn-primario", onclick: () => this.iniciar(this.sesion) }, "Reintentar") : null,
      conSalir ? h("button", { type: "button", class: "btn btn-sec", onclick: () => this.salir() }, "Salir") : null);
  },

  pantallaLogin() {
    return h("div", { class: "centrado" },
      h("div", { class: "logo" }, icono("casa", "#2457C5")),
      h("h1", {}, "Home"),
      h("p", { class: "texto-suave" }, "Entra para ver tus apps."),
      h("form", { class: "pila formulario", onsubmit: (e) => this.entrar(e), novalidate: true },
        campoTexto("l-usuario", "Usuario o correo", { autocomplete: "username", autocapitalize: "none", spellcheck: "false" }),
        campoTexto("l-clave", "Contraseña", { tipo: "password", autocomplete: "current-password" }),
        this.loginError ? h("p", { class: "error", role: "alert" }, this.loginError) : null,
        h("button", { type: "submit", class: "btn btn-grande btn-primario", id: "l-entrar" }, "Entrar"),
        this.loginAyuda ? h("p", { class: "meta centro" }, "¿Olvidaste tu contraseña? Pídesela a Sleyer.") : null));
  },

  pantallaClave() {
    return h("form", { class: "pila", onsubmit: (e) => this.cambiarClave(e), novalidate: true },
      campoTexto("c-nueva", "Contraseña nueva", { tipo: "password", autocomplete: "new-password" }),
      campoTexto("c-repite", "Escríbela otra vez", { tipo: "password", autocomplete: "new-password" }),
      h("p", { class: "meta" }, "Usa al menos 8 letras o números."),
      this.claveError ? h("p", { class: "error", role: "alert" }, this.claveError) : null,
      h("div", { class: "botones" },
        h("button", { type: "submit", class: "btn btn-primario", id: "c-guardar" }, "Guardar"),
        h("button", { type: "button", class: "btn btn-sec", onclick: () => this.irA("inicio") }, "Cancelar")));
  },

  async cambiarClave(e) {
    e.preventDefault();
    const n = borradores["c-nueva"] || "", r = borradores["c-repite"] || "";
    if (n.length < 8) { this.claveError = "La contraseña debe tener al menos 8 caracteres."; return this.pintar(); }
    if (n !== r) { this.claveError = "Las dos contraseñas no son iguales."; return this.pintar(); }
    const btn = document.getElementById("c-guardar"); if (btn) btn.disabled = true;
    let res;
    try { res = await db.auth.updateUser({ password: n }); } catch (err) { res = { error: err }; }
    if (res.error) {
      this.claveError = navigator.onLine ? "No se pudo cambiar. Prueba con otra contraseña." : "Sin conexión. Inténtalo cuando vuelva internet.";
      return this.pintar();
    }
    limpiarBorradores("c-"); this.claveError = "";
    aviso("Contraseña cambiada");
    this.irA("inicio");
  },

  irA(vista) {
    this.vista = vista; this.menuAbierto = false; this.claveError = "";
    this.pintar(); window.scrollTo(0, 0);
    if (vista === "inicio") this.refrescar();
  },

  /* Marco común: cabecera (volver + título + menú), contenido y barra de pestañas. */
  marco(titulo, contenido, nav, volverA) {
    const nombre = this.perfil.nombre;
    const cab = h("header", { class: "cab" },
      h("div", { class: "cab-izq" },
        volverA
          ? h("button", { type: "button", class: "volver", onclick: () => this.irA("inicio") }, "‹ Home")
          : h("span", { class: "meta" }, "Home"),
        h("h1", { class: "titulo" }, titulo)),
      h("div", { class: "menu-zona" },
        h("button", {
          type: "button", class: "menu-btn", id: "menu-btn", "aria-haspopup": "true", "aria-expanded": this.menuAbierto ? "true" : "false",
          onclick: () => { this.menuAbierto = !this.menuAbierto; this.pintar(); }
        }, h("span", { class: "menu-nombre" }, nombre), h("span", { "aria-hidden": "true" }, " ▾")),
        this.menuAbierto ? h("div", { class: "menu" },
          h("button", { type: "button", onclick: () => this.irA("clave") }, "Cambiar contraseña"),
          h("button", { type: "button", onclick: () => this.salir() }, "Salir")) : null));
    return h("div", { class: "marco" }, cab, h("main", { id: "principal", class: "principal" }, contenido), nav);
  }
};

App.arrancar();
