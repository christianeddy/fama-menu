/**
 * web.js: customer web. Reads the menu from FamaMenu, keeps the cart with
 * FamaPedido and redraws when Fama's screen saves a change (storage event).
 */
(function () {
  const { loadMenu } = window.FamaMenu;
  const P = window.FamaPedido;

  const CART_KEY = 'fama-cart-v1';
  const CHECK_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12l5 5 9-10" /></svg>';
  const CUSTOMER_KEY = 'fama-cliente-v1';

  const $ = (selector) => document.querySelector(selector);
  const els = {
    today: $('#today'),
    empty: $('#menu-empty'),
    entradas: $('#entradas'),
    fondos: $('#fondos'),
    pickEntrada: $('#pick-entrada'),
    pickFondo: $('#pick-fondo'),
    dealPrice: $('#deal-price'),
    ticker: $('#ticker'),
    slides: [...document.querySelectorAll('#hero-slides .slide')],
    dots: [...document.querySelectorAll('#hero-dots i')],
    heroName: $('#hero-name'),
    add: $('#add-menu'),
    addPrice: $('#add-price'),
    cartOpen: $('#cart-open'),
    barCount: $('#bar-count'),
    barTotal: $('#bar-total'),
    cart: $('#cart'),
    cartClose: $('#cart-close'),
    cartEmpty: $('#cart-empty'),
    lines: $('#cart-lines'),
    totalRow: $('#cart-total-row'),
    total: $('#cart-total'),
    form: $('#checkout'),
    nombre: $('#nombre'),
    direccion: $('#direccion'),
    referencia: $('#referencia'),
    pay: $('#pay'),
    error: $('#form-error'),
    overlay: $('#overlay'),
    toast: $('#toast'),
  };

  let menu = loadMenu(localStorage);
  let cart = loadJson(CART_KEY, []);
  const pick = { entrada: null, fondo: null };

  function loadJson(key, fallback) {
    try {
      const value = JSON.parse(localStorage.getItem(key));
      return value ?? fallback;
    } catch {
      return fallback;
    }
  }

  function saveJson(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {
      // Storage full or blocked: the order can still be sent.
    }
  }

  function escapeHtml(text) {
    return String(text).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  function todayInLima() {
    const text = new Intl.DateTimeFormat('es-PE', { timeZone: 'America/Lima', weekday: 'long', day: 'numeric', month: 'long' }).format(new Date());
    return text.charAt(0).toUpperCase() + text.slice(1);
  }

  // ---------------------------------------------------------------------------
  // Menu of the day
  // ---------------------------------------------------------------------------

  function optionHtml(tipo, item) {
    const selected = pick[tipo] === item.id;
    const disabled = item.agotado ? 'disabled' : '';
    return `<label class="option ${selected ? 'is-selected' : ''} ${item.agotado ? 'is-out' : ''}">
      <input type="radio" name="${tipo}" value="${item.id}" ${selected ? 'checked' : ''} ${disabled} />
      <span class="option-name">${escapeHtml(item.nombre)}</span>
      ${item.agotado ? '<span class="option-tag">Agotado</span>' : `<span class="option-check" aria-hidden="true">${CHECK_SVG}</span>`}
    </label>`;
  }

  function dropUnavailablePick() {
    const stillThere = (items, id) => items.some((item) => item.id === id && !item.agotado);
    if (pick.entrada && !stillThere(menu.entradas, pick.entrada)) pick.entrada = null;
    if (pick.fondo && !stillThere(menu.fondos, pick.fondo)) pick.fondo = null;
  }

  function renderMenu() {
    els.today.textContent = todayInLima();
    els.entradas.innerHTML = menu.entradas.map((item) => optionHtml('entrada', item)).join('');
    els.fondos.innerHTML = menu.fondos.map((item) => optionHtml('fondo', item)).join('');
    els.empty.hidden = menu.entradas.length > 0 && menu.fondos.length > 0;
    els.dealPrice.textContent = `S/ ${menu.precio}`;
    renderTicker();
  }

  // Running strip with today's available dishes; the list is doubled so the loop has no gap.
  function renderTicker() {
    const names = [...menu.fondos, ...menu.entradas].filter((item) => !item.agotado).map((item) => item.nombre);
    els.ticker.innerHTML = [...names, ...names].map((name) => `<span>${escapeHtml(name)}</span>`).join('');
    els.ticker.parentElement.hidden = names.length === 0;
  }

  function nameOf(items, id) {
    const item = items.find((i) => i.id === id);
    return item ? item.nombre : '';
  }

  function renderBuilder() {
    const entrada = nameOf(menu.entradas, pick.entrada);
    const fondo = nameOf(menu.fondos, pick.fondo);
    setPickLine(els.pickEntrada, entrada);
    setPickLine(els.pickFondo, fondo);
    const ready = Boolean(entrada && fondo);
    if (ready && els.add.disabled) replayAnimation(els.add, 'is-ready');
    els.add.disabled = !ready;
    els.addPrice.textContent = P.money(menu.precio);
  }

  function setPickLine(el, name) {
    const changed = el.dataset.name !== name;
    el.dataset.name = name;
    el.textContent = name || 'por elegir';
    el.classList.toggle('is-empty', !name);
    if (name && changed) replayAnimation(el, 'is-new');
  }

  /** Restart a one-shot CSS animation by removing and re-adding its class. */
  function replayAnimation(el, className) {
    el.classList.remove(className);
    void el.offsetWidth;
    el.classList.add(className);
  }

  // ---------------------------------------------------------------------------
  // Cart
  // ---------------------------------------------------------------------------

  function lineHtml(line) {
    const { entrada, fondo } = P.lineDishes(line, menu);
    const available = P.isLineAvailable(line, menu);
    const key = P.lineKey(line);
    const names = `${escapeHtml(entrada ? entrada.nombre : 'Plato retirado')} + ${escapeHtml(fondo ? fondo.nombre : 'Plato retirado')}`;
    return `<li class="cart-line ${available ? '' : 'is-out'}">
      <div class="cart-line-text">
        <p class="cart-line-name">${names}</p>
        <p class="cart-line-sub">${available ? P.money(line.qty * menu.precio) : 'Ya no está disponible. Quítalo para enviar tu pedido.'}</p>
      </div>
      <div class="qty">
        <button type="button" data-key="${key}" data-delta="-1" aria-label="Quitar un menú">&#8722;</button>
        <span>${line.qty}</span>
        <button type="button" data-key="${key}" data-delta="1" aria-label="Agregar un menú igual" ${available ? '' : 'disabled'}>+</button>
      </div>
    </li>`;
  }

  function renderCart() {
    const units = P.cartUnits(cart);
    const total = P.money(P.cartTotal(cart, menu.precio));
    els.lines.innerHTML = cart.map(lineHtml).join('');
    els.cartEmpty.hidden = cart.length > 0;
    els.totalRow.hidden = cart.length === 0;
    els.total.textContent = `${total}`;
    els.totalRow.firstChild.textContent = `Total (${P.menusLabel(units)}) `;
    els.cartOpen.hidden = units === 0;
    els.barCount.textContent = units;
    els.barTotal.textContent = total;
    document.body.classList.toggle('has-cart', units > 0);
  }

  function renderAll() {
    dropUnavailablePick();
    renderMenu();
    renderBuilder();
    renderCart();
  }

  function setCart(next) {
    const grew = P.cartUnits(next) > P.cartUnits(cart);
    cart = next;
    saveJson(CART_KEY, cart);
    renderCart();
    if (grew) {
      replayAnimation(els.total, 'is-bump');
      replayAnimation(els.barCount, 'is-bump');
      const lines = els.lines.querySelectorAll('.cart-line');
      if (lines.length) replayAnimation(lines[lines.length - 1], 'is-printed');
    }
  }

  function addPickedMenu() {
    if (!pick.entrada || !pick.fondo) return;
    setCart(P.addMenu(cart, pick.entrada, pick.fondo));
    const label = `${nameOf(menu.entradas, pick.entrada)} + ${nameOf(menu.fondos, pick.fondo)}`;
    pick.entrada = null;
    pick.fondo = null;
    renderMenu();
    renderBuilder();
    showToast(`Agregado: ${label}`);
  }

  // ---------------------------------------------------------------------------
  // Drawer (phone) and messages
  // ---------------------------------------------------------------------------

  function openCart() {
    els.cart.classList.add('open');
    els.overlay.hidden = false;
    document.body.classList.add('cart-is-open');
    const { nombre, direccion, referencia } = loadJson(CUSTOMER_KEY, {});
    if (!els.nombre.value && nombre) els.nombre.value = nombre;
    if (!els.direccion.value && direccion) els.direccion.value = direccion;
    if (!els.referencia.value && referencia) els.referencia.value = referencia;
  }

  function closeCart() {
    els.cart.classList.remove('open');
    els.overlay.hidden = true;
    document.body.classList.remove('cart-is-open');
  }

  function showToast(text) {
    els.toast.textContent = text;
    els.toast.classList.add('show');
    window.clearTimeout(showToast.timer);
    showToast.timer = window.setTimeout(() => els.toast.classList.remove('show'), 2200);
  }

  const ERROR_TEXT = {
    vacio: 'Agrega al menos un menú.',
    agotado: 'Uno de tus menús ya no está disponible. Quítalo para continuar.',
    nombre: 'Escribe tu nombre.',
    direccion: 'Escribe la dirección de entrega.',
    pago: 'Elige si pagas con Yape o con Plin.',
  };

  const ERROR_FIELD = { nombre: () => els.nombre, direccion: () => els.direccion, pago: () => els.pay };

  function selectedPago() {
    const checked = els.form.querySelector('input[name="pago"]:checked');
    return checked ? checked.value : '';
  }

  function sendOrder(event) {
    event.preventDefault();
    const datos = {
      cart,
      menu,
      nombre: els.nombre.value,
      direccion: els.direccion.value,
      referencia: els.referencia.value,
      pago: selectedPago(),
    };
    const errors = P.validateCheckout(datos);
    Object.values(ERROR_FIELD).forEach((field) => field().classList.remove('has-error'));
    if (errors.length) {
      errors.forEach((code) => ERROR_FIELD[code] && ERROR_FIELD[code]().classList.add('has-error'));
      els.error.textContent = ERROR_TEXT[errors[0]];
      els.error.hidden = false;
      const target = errors[0] === 'pago' ? els.pay.querySelector('input') : ERROR_FIELD[errors[0]] && ERROR_FIELD[errors[0]]();
      if (target) target.focus();
      return;
    }
    els.error.hidden = true;
    saveJson(CUSTOMER_KEY, { nombre: datos.nombre.trim(), direccion: datos.direccion.trim(), referencia: datos.referencia.trim() });
    const url = P.whatsappUrl(menu.whatsapp, P.buildMessage(datos));
    window.FamaUltimoPedido = url; // read by the verification script; never sent automatically
    window.open(url, '_blank', 'noopener,noreferrer');
  }

  // ---------------------------------------------------------------------------
  // Events
  // ---------------------------------------------------------------------------

  function onPick(event) {
    const input = event.target.closest('input[type="radio"]');
    if (!input) return;
    pick[input.name] = input.value;
    renderMenu();
    renderBuilder();
  }

  els.entradas.addEventListener('change', onPick);
  els.fondos.addEventListener('change', onPick);
  els.add.addEventListener('click', addPickedMenu);
  els.cartOpen.addEventListener('click', openCart);
  els.cartClose.addEventListener('click', closeCart);
  els.overlay.addEventListener('click', closeCart);
  document.addEventListener('keydown', (event) => { if (event.key === 'Escape') closeCart(); });
  els.lines.addEventListener('click', (event) => {
    const button = event.target.closest('button[data-key]');
    if (button) setCart(P.changeQty(cart, button.dataset.key, Number(button.dataset.delta)));
  });
  els.form.addEventListener('submit', sendOrder);
  els.form.addEventListener('input', (event) => {
    const field = event.target.closest('.has-error') || event.target.closest('label');
    if (field) field.classList.remove('has-error');
  });
  els.pay.addEventListener('change', () => els.pay.classList.remove('has-error'));

  // Fama saved a change on its screen (another tab of this device): redraw now.
  window.addEventListener('storage', (event) => {
    if (event.key !== window.FamaMenu.STORAGE_KEY) return;
    menu = loadMenu(localStorage);
    renderAll();
    showToast('El menú se acaba de actualizar.');
  });

  // ---------------------------------------------------------------------------
  // Banner: photos only set the mood; choosing never depends on them.
  // Slides after the first load just before they are shown.
  // ---------------------------------------------------------------------------

  function loadSlide(slide) {
    if (!slide.dataset.src) return;
    const img = document.createElement('img');
    img.alt = '';
    img.sizes = '100vw';
    img.srcset = slide.dataset.srcset;
    img.src = slide.dataset.src;
    slide.append(img);
    delete slide.dataset.src;
  }

  function startBanner() {
    if (els.slides.length < 2 || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    let current = 0;
    loadSlide(els.slides[1]);
    setInterval(() => {
      els.slides[current].classList.remove('is-on');
      els.dots[current].classList.remove('is-on');
      current = (current + 1) % els.slides.length;
      els.slides[current].classList.add('is-on');
      els.dots[current].classList.add('is-on');
      els.heroName.textContent = els.slides[current].dataset.name;
      loadSlide(els.slides[(current + 1) % els.slides.length]);
    }, 5500);
  }

  renderAll();
  startBanner();
  setInterval(() => { els.today.textContent = todayInLima(); }, 60000);
})();
