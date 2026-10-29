/**
 * pedido.js: order logic for the customer web. Pure functions, no DOM.
 *
 * A cart line is one menu combination: { entradaId, fondoId, qty }.
 * Lines keep only ids; names are read from the current menu, so a dish that
 * Fama renames shows its new name and a dish Fama deletes or marks sold out
 * blocks the order until the customer removes that line.
 *
 * Loaded as a classic script in the browser (window.FamaPedido) and through
 * require() in the node tests.
 */
(function (root) {
  const PAGOS = ['Yape', 'Plin'];

  function money(value) {
    return `S/ ${value.toFixed(2)}`;
  }

  function lineKey(line) {
    return `${line.entradaId}|${line.fondoId}`;
  }

  function addMenu(cart, entradaId, fondoId) {
    if (!entradaId || !fondoId) return cart;
    const key = `${entradaId}|${fondoId}`;
    if (cart.some((line) => lineKey(line) === key)) {
      return cart.map((line) => (lineKey(line) === key ? { ...line, qty: line.qty + 1 } : line));
    }
    return [...cart, { entradaId, fondoId, qty: 1 }];
  }

  function changeQty(cart, key, delta) {
    return cart
      .map((line) => (lineKey(line) === key ? { ...line, qty: line.qty + delta } : line))
      .filter((line) => line.qty > 0);
  }

  function cartUnits(cart) {
    return cart.reduce((sum, line) => sum + line.qty, 0);
  }

  function cartTotal(cart, precio) {
    return cartUnits(cart) * precio;
  }

  function findItem(items, id) {
    return items.find((item) => item.id === id) || null;
  }

  /** Names of a line's dishes, or null for a dish that no longer exists. */
  function lineDishes(line, menu) {
    return {
      entrada: findItem(menu.entradas, line.entradaId),
      fondo: findItem(menu.fondos, line.fondoId),
    };
  }

  function isLineAvailable(line, menu) {
    const { entrada, fondo } = lineDishes(line, menu);
    return Boolean(entrada && fondo && !entrada.agotado && !fondo.agotado);
  }

  function unavailableLines(cart, menu) {
    return cart.filter((line) => !isLineAvailable(line, menu));
  }

  /** Error codes, in display order: vacio, agotado, nombre, direccion, pago. */
  function validateCheckout({ cart, menu, nombre, direccion, pago }) {
    const errors = [];
    if (!cart.length) errors.push('vacio');
    else if (unavailableLines(cart, menu).length) errors.push('agotado');
    if (!String(nombre || '').trim()) errors.push('nombre');
    if (!String(direccion || '').trim()) errors.push('direccion');
    if (!PAGOS.includes(pago)) errors.push('pago');
    return errors;
  }

  function menusLabel(qty) {
    return `${qty} ${qty === 1 ? 'menú' : 'menús'}`;
  }

  function buildMessage({ cart, menu, nombre, direccion, referencia, pago }) {
    const lineas = cart.map((line) => {
      const { entrada, fondo } = lineDishes(line, menu);
      return `• ${menusLabel(line.qty)}: ${entrada.nombre} + ${fondo.nombre}`;
    });
    const units = cartUnits(cart);
    const ref = String(referencia || '').trim();
    return [
      'Hola Fama, quiero hacer un pedido para delivery:',
      '',
      ...lineas,
      '',
      `*Total: ${money(cartTotal(cart, menu.precio))}* (${menusLabel(units)}, refresco incluido)`,
      '',
      `Nombre: ${String(nombre).trim()}`,
      `Dirección: ${String(direccion).trim()}`,
      ...(ref ? [`Referencia: ${ref}`] : []),
      `Pago: ${pago}`,
      '',
      '¿Me confirmas el pedido y el costo del delivery, por favor?',
    ].join('\n');
  }

  function whatsappUrl(number, message) {
    return `https://wa.me/${number}?text=${encodeURIComponent(message)}`;
  }

  const api = {
    PAGOS,
    money,
    lineKey,
    addMenu,
    changeQty,
    cartUnits,
    cartTotal,
    lineDishes,
    isLineAvailable,
    unavailableLines,
    validateCheckout,
    menusLabel,
    buildMessage,
    whatsappUrl,
  };

  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.FamaPedido = api;
})(this);
