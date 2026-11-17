/*
 * pedidos/app-pedidos.js — La app Pedidos: pestañas según el rol y qué pantalla se ve en cada una.
 * Ella: Inicio · Pedir.   Dueño: solo la Bandeja (sin barra de pestañas).
 */
const AppPedidos = {
  tab: "inicio",
  TITULOS: { inicio: "Pedidos", pedir: "Pedir algo", bandeja: "Pedidos" },

  tabs() {
    return App.perfil.rol === "ella"
      ? [["inicio", "Inicio"], ["pedir", "Pedir"]]
      : [["bandeja", "Bandeja"]];
  },

  async entrar() {
    this.tab = this.tabs()[0][0];
    App.vista = "pedidos";
    App.pintar();
    await Datos.cargar(Datos.claves(App.perfil.rol));
    this.marcarVistos();
    App.pintar();
  },

  /* Ella: al estar en Pedidos, las respuestas nuevas quedan vistas. */
  marcarVistos() {
    if (App.perfil.rol !== "ella") return;
    const vistos = new Set(leerLocal("home:vistos", []));
    Inicio.novedadesElla(vistos, true).forEach((p) => vistos.add(p.id));
    guardarLocal("home:vistos", Array.from(vistos));
  },

  irA(tab) { this.tab = tab; App.pintar(); window.scrollTo(0, 0); },

  titulo() { return this.TITULOS[this.tab] || "Pedidos"; },

  /* ¿Hay que repintar si cambió esta tabla? */
  relevante(tabla) {
    if (this.tab === "pedir") return false;
    return ["pedidos", "resumen", "evaluaciones", "mi_dinero_estado"].includes(tabla);
  },

  contenido() {
    switch (this.tab) {
      case "pedir": return Pedidos.vistaPedir();
      case "bandeja": return Bandeja.vista();
      default: return Pedidos.vistaInicio();
    }
  },

  /* Con una sola pestaña no hay barra. */
  nav() {
    if (this.tabs().length < 2) return null;
    return h("nav", { class: "tabs", "aria-label": "Menú de Pedidos", style: "grid-template-columns:repeat(" + this.tabs().length + ",minmax(0,1fr))" },
      this.tabs().map(([k, l]) => h("button", {
        type: "button", class: "tab" + (k === this.tab ? " activa" : ""),
        "aria-current": k === this.tab ? "page" : null, onclick: () => this.irA(k)
      }, l)));
  }
};
