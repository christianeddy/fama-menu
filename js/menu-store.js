/**
 * menu-store.js: the menu of the day and where it is kept.
 *
 * Sample version: the menu lives in this device's localStorage, with no
 * password. Fama's screen writes it and the customer web reads it; an open
 * web tab hears the change through the `storage` event and redraws at once.
 * The real version will swap loadMenu/saveMenu for a shared store.
 *
 * Loaded as a classic script in the browser (window.FamaMenu) and through
 * require() in the node tests.
 */
(function (root) {
  const STORAGE_KEY = 'fama-menu-v1';
  const TIPOS = ['entradas', 'fondos'];

  // Menu read from the board photo (Google Maps, date unknown). The last dish
  // on the board is cut off in the photo, so it is left out.
  const BOARD_ENTRADAS = ['Menestrón', 'Crema de rocoto', 'Ensalada primavera', 'Tamal', 'Ensalada de palta'];
  const BOARD_FONDOS = [
    'Estofado de pollo con lentejas',
    'Ají de gallina',
    'Macarrones en salsa de carne',
    'Mostrito con pollo broster',
    'Fetuchini con lomo a la huancaína',
    'Pechuga a la parrilla con papas',
    'Hígado con fetuchini',
    'Lomo saltado',
    'Churrasco con fetuchini',
  ];

  function defaultMenu() {
    return {
      whatsapp: '51922684456',
      precio: 12,
      entradas: BOARD_ENTRADAS.map((nombre, i) => ({ id: `e${i + 1}`, nombre, agotado: false })),
      fondos: BOARD_FONDOS.map((nombre, i) => ({ id: `f${i + 1}`, nombre, agotado: false })),
    };
  }

  function isValidItem(item) {
    return item && typeof item.id === 'string' && typeof item.nombre === 'string' && typeof item.agotado === 'boolean';
  }

  function isValidMenu(menu) {
    return Boolean(
      menu
      && typeof menu.whatsapp === 'string'
      && typeof menu.precio === 'number'
      && TIPOS.every((tipo) => Array.isArray(menu[tipo]) && menu[tipo].every(isValidItem)),
    );
  }

  function loadMenu(storage) {
    try {
      const menu = JSON.parse(storage.getItem(STORAGE_KEY));
      return isValidMenu(menu) ? menu : defaultMenu();
    } catch {
      return defaultMenu();
    }
  }

  function saveMenu(storage, menu) {
    storage.setItem(STORAGE_KEY, JSON.stringify(menu));
  }

  function newId(menu, tipo) {
    const prefix = tipo === 'entradas' ? 'e' : 'f';
    const used = new Set(menu[tipo].map((item) => item.id));
    let n = menu[tipo].length + 1;
    while (used.has(`${prefix}${n}`)) n += 1;
    return `${prefix}${n}`;
  }

  function addItem(menu, tipo, nombre) {
    const clean = String(nombre || '').trim();
    if (!clean) return menu;
    return { ...menu, [tipo]: [...menu[tipo], { id: newId(menu, tipo), nombre: clean, agotado: false }] };
  }

  function updateItem(menu, tipo, id, change) {
    return { ...menu, [tipo]: menu[tipo].map((item) => (item.id === id ? { ...item, ...change } : item)) };
  }

  function renameItem(menu, tipo, id, nombre) {
    const clean = String(nombre || '').trim();
    if (!clean) return menu;
    return updateItem(menu, tipo, id, { nombre: clean });
  }

  function toggleAgotado(menu, tipo, id) {
    const item = menu[tipo].find((i) => i.id === id);
    if (!item) return menu;
    return updateItem(menu, tipo, id, { agotado: !item.agotado });
  }

  function removeItem(menu, tipo, id) {
    return { ...menu, [tipo]: menu[tipo].filter((item) => item.id !== id) };
  }

  /** Peruvian mobile (9 digits starting with 9), with or without +51. */
  function normalizeWhatsapp(value) {
    let digits = String(value || '').replace(/\D/g, '');
    if (digits.length === 11 && digits.startsWith('51')) digits = digits.slice(2);
    return /^9\d{8}$/.test(digits) ? `51${digits}` : null;
  }

  function setWhatsapp(menu, value) {
    const number = normalizeWhatsapp(value);
    if (!number) return { menu, error: 'numero' };
    return { menu: { ...menu, whatsapp: number }, error: null };
  }

  function formatWhatsapp(number) {
    const local = number.slice(2);
    return `+51 ${local.slice(0, 3)} ${local.slice(3, 6)} ${local.slice(6)}`;
  }

  const api = {
    STORAGE_KEY,
    TIPOS,
    defaultMenu,
    loadMenu,
    saveMenu,
    addItem,
    renameItem,
    toggleAgotado,
    removeItem,
    normalizeWhatsapp,
    setWhatsapp,
    formatWhatsapp,
  };

  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.FamaMenu = api;
})(this);
