/*
 * cliente.js — Crea el cliente de Supabase (variable global `db`).
 * Las pruebas inyectan un cliente falso en window.HOME_CLIENTE antes de cargar la página.
 */
const db = window.HOME_CLIENTE || supabase.createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_KEY);
