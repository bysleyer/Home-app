/*
 * casa/casa.js — La app Casa: pestañas según el rol y qué pantalla se ve en cada una.
 * Ella: Inicio · Pedir · Apuntes · Lista.   Dueño: Bandeja · Apuntes · Lista.
 */
const Casa = {
  tab: "inicio",
  TITULOS: { inicio: "Inicio", pedir: "Pedir algo", bandeja: "Bandeja", apuntes: "Apuntes", lista: "Lista de compras" },

  tabs() {
    return App.perfil.rol === "ella"
      ? [["inicio", "Inicio"], ["pedir", "Pedir"], ["apuntes", "Apuntes"], ["lista", "Lista"]]
      : [["bandeja", "Bandeja"], ["apuntes", "Apuntes"], ["lista", "Lista"]];
  },

  async entrar() {
    this.tab = this.tabs()[0][0];
    App.vista = "casa";
    App.pintar();
    await Datos.cargar(["pedidos", "resumen", "apuntes", "lista", "nombres"]);
    this.marcarVistos();
    App.pintar();
  },

  /* Ella: al estar en Casa, las respuestas nuevas quedan vistas. */
  marcarVistos() {
    if (App.perfil.rol !== "ella") return;
    const vistos = new Set(leerLocal("home:vistos", []));
    Inicio.novedadesElla(vistos, true).forEach((p) => vistos.add(p.id));
    guardarLocal("home:vistos", Array.from(vistos));
  },

  irA(tab) { this.tab = tab; App.pintar(); window.scrollTo(0, 0); },

  titulo() { return this.TITULOS[this.tab] || "Casa"; },

  /* ¿Hay que repintar si cambió esta tabla? */
  relevante(tabla) {
    if (this.tab === "pedir") return false;
    if (this.tab === "apuntes") return tabla === "apuntes";
    if (this.tab === "lista") return tabla === "lista_compras";
    return tabla === "pedidos";
  },

  contenido() {
    switch (this.tab) {
      case "pedir": return Pedidos.vistaPedir();
      case "bandeja": return Bandeja.vista();
      case "apuntes": return Apuntes.vista();
      case "lista": return Lista.vista();
      default: return Pedidos.vistaInicio();
    }
  },

  nav() {
    return h("nav", { class: "tabs", "aria-label": "Menú de Casa", style: "grid-template-columns:repeat(" + this.tabs().length + ",minmax(0,1fr))" },
      this.tabs().map(([k, l]) => h("button", {
        type: "button", class: "tab" + (k === this.tab ? " activa" : ""),
        "aria-current": k === this.tab ? "page" : null, onclick: () => this.irA(k)
      }, l)));
  }
};
