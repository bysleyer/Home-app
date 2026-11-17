/*
 * sw.js — Service worker de Home.
 * Guarda los archivos de la app para que abra sin internet. Con internet usa
 * la red primero (para ver siempre la última versión) y cae a la copia guardada.
 * NUNCA guarda ni toca peticiones a *.supabase.co (datos, auth y /storage/v1 con las fotos
 * de facturas: todo va siempre a la red).
 */
const CACHE = "home-v7";
const ARCHIVOS = [
  "./", "./index.html", "./estilos.css", "./manifest.json",
  "./config.js", "./cliente.js", "./util.js", "./datos.js", "./app.js", "./inicio.js",
  "./pedidos/app-pedidos.js", "./pedidos/semaforo.js", "./pedidos/fotos.js", "./pedidos/pedidos.js", "./pedidos/bandeja.js",
  "./vendor/supabase.js", "./iconos/icono-192.png", "./iconos/icono-512.png"
];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ARCHIVOS)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then((claves) => Promise.all(claves.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.hostname.endsWith(".supabase.co") || url.hostname.endsWith(".supabase.in")) return; // nunca
  if (url.origin !== self.location.origin) return; // solo archivos propios
  e.respondWith(
    fetch(req).then((resp) => {
      if (resp && resp.ok) { const copia = resp.clone(); caches.open(CACHE).then((c) => c.put(req, copia)); }
      return resp;
    }).catch(() => caches.match(req).then((r) => r || caches.match("./index.html")))
  );
});
