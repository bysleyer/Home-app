/*
 * inicio.js — Pantalla de inicio (hub): mosaicos de apps según el rol.
 * Para añadir una app nueva: agrega UNA entrada a APPS (y nada más).
 *   { id, nombre, descripcion, roles, abrir(), aviso(), estilo }
 */
const APPS = [
  {
    id: "mi-dinero", nombre: "Mi dinero", descripcion: "Solo tú", roles: ["dueno"], estilo: "oscuro", icono: "dinero",
    abrir: () => { window.location.href = CONFIG.MI_DINERO_URL; },
    aviso: () => null
  },
  {
    id: "casa", nombre: "Casa", roles: ["dueno", "ella"], estilo: "casa", icono: "casa",
    descripcion: (rol) => (rol === "ella" ? "Pedir, apuntes y lista" : "Pedidos, apuntes y lista"),
    abrir: () => Casa.entrar(),
    aviso: (rol) => {
      if (rol === "dueno") {
        const n = Datos.pedidos.filter((p) => p.estado === "enviado").length;
        return n ? n + " por responder" : null;
      }
      const n = Inicio.novedadesElla().length;
      return n ? (n === 1 ? "1 respuesta nueva" : n + " respuestas nuevas") : null;
    }
  }
];

const Inicio = {
  /* Respuestas a pedidos de ella que todavía no ha visto. */
  novedadesElla(vistosSet, todos) {
    const vistos = vistosSet || new Set(leerLocal("home:vistos", []));
    return Datos.pedidos.filter((p) => ["aprobado", "ahora_no", "hablemos"].includes(p.estado) && !vistos.has(p.id));
  },

  vista() {
    const rol = App.perfil.rol;
    const mosaicos = APPS.filter((a) => a.roles.includes(rol)).map((a) => {
      const av = a.aviso(rol);
      const desc = typeof a.descripcion === "function" ? a.descripcion(rol) : a.descripcion;
      return h("button", { type: "button", class: "mosaico " + (a.estilo || ""), onclick: a.abrir },
        icono(a.icono, a.estilo === "casa" ? "#2457C5" : undefined),
        h("span", { class: "mosaico-nombre" }, a.nombre),
        h("span", { class: "mosaico-desc" }, desc),
        av ? h("span", { class: "insignia" }, av) : null);
    });
    mosaicos.push(h("div", { class: "mosaico pronto", role: "group", "aria-label": "Pronto habrá más apps" },
      icono("mas"), h("span", { class: "mosaico-nombre pequeno" }, "Pronto"), h("span", { class: "mosaico-desc" }, "Más apps")));

    return h("div", { class: "pila" },
      rol === "ella" ? Semaforo.tarjetaElla() : null,
      h("h2", {}, "Tus apps"),
      h("div", { class: "mosaicos" }, mosaicos));
  }
};
