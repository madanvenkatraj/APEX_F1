(() => {
  'use strict';

  const menuToggle = document.getElementById('menuToggle');
  const primaryNav = document.getElementById('primaryNav');
  const cartTrigger = document.getElementById('cartTrigger');
  const cartDrawer = document.getElementById('cartDrawer');
  const cartOverlay = document.getElementById('cartOverlay');
  const closeCartButton = document.getElementById('closeCart');
  const continueShopping = document.getElementById('continueShopping');
  const cartItemsElement = document.getElementById('cartItems');
  const cartCountElement = document.getElementById('cartCount');
  const cartTitleCount = document.getElementById('cartTitleCount');
  const cartFooter = document.getElementById('cartFooter');
  const cartTotalElement = document.getElementById('cartTotal');
  const toastElement = document.getElementById('toast');
  const newsletterForm = document.getElementById('newsletterForm');
  const formMessage = document.getElementById('formMessage');

  const cart = new Map();
  let toastTimer;
  let lastFocusedElement = null;

  const formatINR = (amount) => new Intl.NumberFormat('en-IN', {
    style: 'currency', currency: 'INR', maximumFractionDigits: 0
  }).format(amount);

  function showToast(message) {
    toastElement.textContent = message;
    toastElement.classList.add('show');
    window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(() => toastElement.classList.remove('show'), 2600);
  }

  // Mobile navigation
  menuToggle.addEventListener('click', () => {
    const expanded = menuToggle.getAttribute('aria-expanded') === 'true';
    menuToggle.setAttribute('aria-expanded', String(!expanded));
    menuToggle.setAttribute('aria-label', expanded ? 'Open navigation' : 'Close navigation');
    primaryNav.classList.toggle('open', !expanded);
  });

  primaryNav.querySelectorAll('a').forEach((link) => {
    link.addEventListener('click', () => {
      primaryNav.classList.remove('open');
      menuToggle.setAttribute('aria-expanded', 'false');
      menuToggle.setAttribute('aria-label', 'Open navigation');
    });
  });

  // Mark the current section in the navigation as the page scrolls.
  const navLinks = [...primaryNav.querySelectorAll('a')];
  const watchedSections = navLinks
    .map((link) => document.querySelector(link.getAttribute('href')))
    .filter(Boolean);

  if ('IntersectionObserver' in window) {
    const sectionObserver = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        navLinks.forEach((link) => {
          const active = link.getAttribute('href') === `#${entry.target.id}`;
          link.classList.toggle('active', active);
        });
      });
    }, { rootMargin: '-25% 0px -60% 0px' });
    watchedSections.forEach((section) => sectionObserver.observe(section));
  }

  // Calendar filters
  const filterButtons = [...document.querySelectorAll('.filter-button')];
  const raceRows = [...document.querySelectorAll('.race-row')];
  filterButtons.forEach((button) => {
    button.addEventListener('click', () => {
      const filter = button.dataset.filter;
      filterButtons.forEach((item) => {
        const active = item === button;
        item.classList.toggle('active', active);
        item.setAttribute('aria-pressed', String(active));
      });
      raceRows.forEach((row) => {
        row.classList.toggle('is-hidden', filter !== 'all' && row.dataset.type !== filter);
      });
    });
  });

  // Demo standings tabs. The figures are intentionally sample data.
  const drivers = [
    ['01', 'Alex Mercer', 'APEX GP', 'red', '284'],
    ['02', 'Mika Sato', 'VOLT', 'lime', '261'],
    ['03', 'Noah Reid', 'NORTHSTAR', 'blue', '218'],
    ['04', 'Eva Laurent', 'ORBIT', 'violet', '197'],
    ['05', 'Leo Hart', 'APEX GP', 'red', '176'],
    ['06', 'Enzo Vale', 'VOLT', 'lime', '155']
  ];
  const teams = [
    ['01', 'APEX GP', 'Alex Mercer', 'red', '460'],
    ['02', 'VOLT RACING', 'Mika Sato', 'lime', '416'],
    ['03', 'NORTHSTAR', 'Noah Reid', 'blue', '349'],
    ['04', 'ORBIT MOTORSPORT', 'Eva Laurent', 'violet', '302']
  ];
  const table = document.getElementById('standingsTable');
  const tableTabs = [...document.querySelectorAll('.table-tab')];

  function renderStandings(kind) {
    const isDrivers = kind === 'drivers';
    const records = isDrivers ? drivers : teams;
    table.innerHTML = `
      <thead><tr><th>POS</th><th>${isDrivers ? 'DRIVER' : 'TEAM'}</th><th>${isDrivers ? 'TEAM' : 'LEAD DRIVER'}</th><th>PTS</th></tr></thead>
      <tbody>${records.map((row) => `
        <tr>
          <td><span class="position ${row[0] === '01' ? 'position-first' : ''}">${row[0]}</span></td>
          <td><strong>${row[1]}</strong></td>
          <td>${isDrivers ? `<span class="team-tag tag-${row[3]}"></span> ${row[2]}` : `<span class="team-tag tag-${row[3]}"></span> ${row[2]}`}</td>
          <td class="points">${row[4]}</td>
        </tr>`).join('')}
      </tbody>`;
  }

  tableTabs.forEach((button) => {
    button.addEventListener('click', () => {
      tableTabs.forEach((tab) => {
        const active = tab === button;
        tab.classList.toggle('active', active);
        tab.setAttribute('aria-selected', String(active));
      });
      renderStandings(button.dataset.table);
    });
  });

  // Cart drawer open / close
  function openCart() {
    lastFocusedElement = document.activeElement;
    cartDrawer.hidden = false;
    cartOverlay.hidden = false;
    document.body.classList.add('cart-open');
    closeCartButton.focus();
  }

  function closeCart() {
    cartDrawer.hidden = true;
    cartOverlay.hidden = true;
    document.body.classList.remove('cart-open');
    if (lastFocusedElement && typeof lastFocusedElement.focus === 'function') lastFocusedElement.focus();
  }

  cartTrigger.addEventListener('click', openCart);
  closeCartButton.addEventListener('click', closeCart);
  cartOverlay.addEventListener('click', closeCart);
  continueShopping.addEventListener('click', closeCart);
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && !cartDrawer.hidden) closeCart();
  });

  function cartUnitCount() {
    return [...cart.values()].reduce((sum, item) => sum + item.quantity, 0);
  }

  function addProduct(name, price) {
    const existing = cart.get(name);
    if (existing) existing.quantity += 1;
    else cart.set(name, { name, price, quantity: 1 });
    renderCart();
    showToast(`${name} added to your cart`);
  }

  function updateQuantity(name, change) {
    const item = cart.get(name);
    if (!item) return;
    item.quantity += change;
    if (item.quantity < 1) cart.delete(name);
    renderCart();
  }

  function removeProduct(name) {
    cart.delete(name);
    renderCart();
    showToast(`${name} removed from your cart`);
  }

  function renderCart() {
    const items = [...cart.values()];
    const count = cartUnitCount();
    cartCountElement.textContent = String(count);
    cartTitleCount.textContent = `(${count})`;
    cartFooter.hidden = items.length === 0;

    if (!items.length) {
      cartItemsElement.innerHTML = `
        <div class="empty-cart">
          <span class="empty-cart-icon">＋</span>
          <h3>Your garage is empty.</h3>
          <p>Add a little racing spirit to your cart.</p>
          <button class="button button-light" id="continueShopping">Keep browsing</button>
        </div>`;
      // Re-bind the empty state control after replacing the drawer contents.
      cartItemsElement.querySelector('#continueShopping').addEventListener('click', closeCart);
      return;
    }

    cartItemsElement.innerHTML = items.map((item) => `
      <article class="cart-item">
        <div class="cart-item-visual" aria-hidden="true">A.</div>
        <div class="cart-item-details">
          <strong>${escapeHTML(item.name)}</strong>
          <small>APEX Racing Club · Demo item</small>
          <div class="cart-item-actions">
            <button class="quantity-button" data-action="decrease" data-name="${escapeHTML(item.name)}" aria-label="Decrease quantity of ${escapeHTML(item.name)}">−</button>
            <span class="quantity-count">${item.quantity}</span>
            <button class="quantity-button" data-action="increase" data-name="${escapeHTML(item.name)}" aria-label="Increase quantity of ${escapeHTML(item.name)}">+</button>
            <button class="remove-item" data-action="remove" data-name="${escapeHTML(item.name)}">Remove</button>
          </div>
        </div>
        <strong class="cart-item-price">${formatINR(item.price * item.quantity)}</strong>
      </article>`).join('');

    const total = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
    cartTotalElement.textContent = formatINR(total);
  }

  function escapeHTML(value) {
    return String(value).replace(/[&<>"']/g, (character) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[character]));
  }

  document.querySelectorAll('.quick-add').forEach((button) => {
    button.addEventListener('click', () => {
      addProduct(button.dataset.product, Number(button.dataset.price));
    });
  });

  cartItemsElement.addEventListener('click', (event) => {
    const button = event.target.closest('button[data-action]');
    if (!button) return;
    const name = button.dataset.name;
    if (button.dataset.action === 'increase') updateQuantity(name, 1);
    else if (button.dataset.action === 'decrease') updateQuantity(name, -1);
    else if (button.dataset.action === 'remove') removeProduct(name);
  });

  document.getElementById('checkoutButton').addEventListener('click', () => {
    showToast('Demo checkout only — no payment has been taken.');
  });

  // Newsletter form provides client-side feedback only; no data is transmitted.
  newsletterForm.addEventListener('submit', (event) => {
    event.preventDefault();
    const input = document.getElementById('emailInput');
    const email = input.value.trim();
    const validEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    formMessage.classList.remove('is-success', 'is-error');
    if (!validEmail) {
      formMessage.textContent = 'Enter a valid email address to join the demo list.';
      formMessage.classList.add('is-error');
      input.focus();
      return;
    }
    formMessage.textContent = `You're on the demo list, ${email}. No email was sent or stored.`;
    formMessage.classList.add('is-success');
    newsletterForm.reset();
  });

  renderCart();
})();
