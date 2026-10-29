/**
 * panel.js: Fama's screen to edit the menu of the day. Every change is saved
 * at once with FamaMenu.saveMenu; an open customer web tab on this device
 * hears it through the storage event and redraws.
 */
(function () {
  const M = window.FamaMenu;

  const COUNT_LABEL = {
    entradas: (n) => `${n} ${n === 1 ? 'entrada' : 'entradas'}`,
    fondos: (n) => `${n} ${n === 1 ? 'fondo' : 'fondos'}`,
  };

  const $ = (selector) => document.querySelector(selector);
  const toast = $('#toast');
  const whatsappForm = $('#whatsapp-form');
  const whatsappInput = $('#whatsapp');
  const whatsappMsg = $('#whatsapp-msg');

  let menu = M.loadMenu(localStorage);

  function blockOf(tipo) {
    return document.querySelector(`.panel-block[data-tipo="${tipo}"]`);
  }

  function showToast(text) {
    toast.textContent = text;
    toast.classList.add('show');
    window.clearTimeout(showToast.timer);
    showToast.timer = window.setTimeout(() => toast.classList.remove('show'), 2200);
  }

  function commit(next, message = 'Listo, la web ya muestra el cambio.') {
    if (next === menu) return;
    menu = next;
    M.saveMenu(localStorage, menu);
    render();
    showToast(message);
  }

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  function dishRow(tipo, item) {
    const li = document.createElement('li');
    li.className = `dish-row${item.agotado ? ' is-out' : ''}`;
    li.dataset.id = item.id;

    const input = document.createElement('input');
    input.className = 'dish-name-input';
    input.value = item.nombre;
    input.setAttribute('aria-label', `Nombre de ${item.nombre}`);
    input.dataset.action = 'rename';

    const toggle = document.createElement('button');
    toggle.type = 'button';
    toggle.className = `dish-toggle${item.agotado ? ' is-out' : ''}`;
    toggle.textContent = item.agotado ? 'Agotado' : 'Disponible';
    toggle.setAttribute('aria-pressed', String(item.agotado));
    toggle.setAttribute('aria-label', `${item.nombre}: ${item.agotado ? 'agotado, toca para marcar disponible' : 'disponible, toca para marcar agotado'}`);
    toggle.dataset.action = 'toggle';

    const remove = document.createElement('button');
    remove.type = 'button';
    remove.className = 'dish-remove';
    remove.textContent = 'Quitar';
    remove.setAttribute('aria-label', `Quitar ${item.nombre}`);
    remove.dataset.action = 'remove';

    li.append(input, toggle, remove);
    return li;
  }

  function renderBlock(tipo) {
    const block = blockOf(tipo);
    const list = block.querySelector('[data-list]');
    list.replaceChildren(...menu[tipo].map((item) => dishRow(tipo, item)));
    block.querySelector('[data-count]').textContent = COUNT_LABEL[tipo](menu[tipo].length);
  }

  function render() {
    M.TIPOS.forEach(renderBlock);
    if (document.activeElement !== whatsappInput) whatsappInput.value = M.formatWhatsapp(menu.whatsapp);
  }

  // ---------------------------------------------------------------------------
  // Events
  // ---------------------------------------------------------------------------

  function itemOf(tipo, id) {
    return menu[tipo].find((item) => item.id === id);
  }

  M.TIPOS.forEach((tipo) => {
    const block = blockOf(tipo);
    const list = block.querySelector('[data-list]');
    const addForm = block.querySelector('[data-add]');
    const addInput = addForm.querySelector('input');

    addForm.addEventListener('submit', (event) => {
      event.preventDefault();
      const nombre = addInput.value.trim();
      if (!nombre) return;
      commit(M.addItem(menu, tipo, nombre), `Agregado: ${nombre}`);
      addInput.value = '';
      addInput.focus();
    });

    list.addEventListener('click', (event) => {
      const button = event.target.closest('button[data-action]');
      if (!button) return;
      const id = button.closest('.dish-row').dataset.id;
      const item = itemOf(tipo, id);
      if (!item) return;
      if (button.dataset.action === 'toggle') {
        commit(M.toggleAgotado(menu, tipo, id), item.agotado ? `${item.nombre} vuelve a estar disponible.` : `${item.nombre} quedó como agotado.`);
      } else if (button.dataset.action === 'remove' && window.confirm(`¿Quitar "${item.nombre}" del menú de hoy?`)) {
        commit(M.removeItem(menu, tipo, id), `Quitado: ${item.nombre}`);
      }
    });

    // Rename on change (blur) and on Enter; an empty name brings back the old one.
    list.addEventListener('change', (event) => {
      const input = event.target.closest('input[data-action="rename"]');
      if (!input) return;
      const id = input.closest('.dish-row').dataset.id;
      const item = itemOf(tipo, id);
      if (!item) return;
      if (!input.value.trim()) {
        input.value = item.nombre;
        showToast('El nombre no puede quedar vacío.');
        return;
      }
      if (input.value.trim() !== item.nombre) commit(M.renameItem(menu, tipo, id, input.value));
    });

    list.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' && event.target.matches('input[data-action="rename"]')) {
        event.preventDefault();
        event.target.blur();
      }
    });
  });

  whatsappForm.addEventListener('submit', (event) => {
    event.preventDefault();
    const result = M.setWhatsapp(menu, whatsappInput.value);
    whatsappMsg.hidden = false;
    if (result.error) {
      whatsappMsg.textContent = 'Escribe un celular de 9 dígitos que empiece con 9.';
      whatsappMsg.classList.add('is-error');
      whatsappInput.classList.add('has-error');
      return;
    }
    whatsappMsg.textContent = 'Guardado.';
    whatsappMsg.classList.remove('is-error');
    whatsappInput.classList.remove('has-error');
    if (result.menu.whatsapp !== menu.whatsapp) commit(result.menu, 'Listo, los pedidos llegarán a este número.');
    whatsappInput.value = M.formatWhatsapp(menu.whatsapp);
  });

  whatsappInput.addEventListener('input', () => {
    whatsappMsg.hidden = true;
    whatsappInput.classList.remove('has-error');
  });

  $('#reset').addEventListener('click', () => {
    if (window.confirm('¿Volver al menú de ejemplo? Se pierden los cambios de hoy.')) {
      commit(M.defaultMenu(), 'Volvimos al menú de ejemplo.');
    }
  });

  // Another panel tab saved: stay in sync.
  window.addEventListener('storage', (event) => {
    if (event.key !== M.STORAGE_KEY) return;
    menu = M.loadMenu(localStorage);
    render();
  });

  render();
})();
