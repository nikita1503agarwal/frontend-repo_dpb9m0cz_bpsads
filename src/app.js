const API_BASE = (import.meta?.env?.VITE_BACKEND_URL || '').replace(/\/$/, '');

// Elements
const productsEl = document.getElementById('products');
const cartBtn = document.getElementById('cartButton');
const cartPanel = document.getElementById('cartPanel');
const overlay = document.getElementById('overlay');
const closeCartBtn = document.getElementById('closeCart');
const cartItemsEl = document.getElementById('cartItems');
const cartCountEl = document.getElementById('cartCount');
const subtotalEl = document.getElementById('subtotal');
const shippingEl = document.getElementById('shipping');
const taxEl = document.getElementById('tax');
const totalEl = document.getElementById('total');
const checkoutToggle = document.getElementById('checkoutToggle');
const checkoutForm = document.getElementById('checkoutForm');
const orderStatus = document.getElementById('orderStatus');
const searchInput = document.getElementById('search');

// Cart state
let cart = JSON.parse(localStorage.getItem('blueshop_cart') || '[]');

function saveCart() {
  localStorage.setItem('blueshop_cart', JSON.stringify(cart));
}

function money(n) { return `$${Number(n).toFixed(2)}`; }

function toggleCart(open) {
  const shouldOpen = open ?? !cartPanel.classList.contains('open');
  cartPanel.classList.toggle('open', shouldOpen);
  overlay.classList.toggle('visible', shouldOpen);
  cartPanel.setAttribute('aria-hidden', String(!shouldOpen));
}

cartBtn.addEventListener('click', () => toggleCart(true));
closeCartBtn.addEventListener('click', () => toggleCart(false));
overlay.addEventListener('click', () => toggleCart(false));

function renderCart() {
  cartItemsEl.innerHTML = '';
  let subtotal = 0;
  for (const item of cart) {
    const itemEl = document.createElement('div');
    itemEl.className = 'cart-item';
    const line = item.price * item.quantity;
    subtotal += line;
    itemEl.innerHTML = `
      <img src="${item.image || ''}" alt="${item.title}" />
      <div>
        <div class="title">${item.title}</div>
        <div class="sub">${money(item.price)} × 
          <input type="number" min="1" value="${item.quantity}" data-id="${item.id}" class="qty-input" style="width:56px;margin-left:6px;">
        </div>
      </div>
      <div class="price">${money(line)}</div>
    `;
    cartItemsEl.appendChild(itemEl);
  }
  const shipping = cart.length ? 6 : 0;
  const tax = subtotal * 0.10;
  const total = subtotal + shipping + tax;
  subtotalEl.textContent = money(subtotal);
  shippingEl.textContent = money(shipping);
  taxEl.textContent = money(tax);
  totalEl.textContent = money(total);
  cartCountEl.textContent = String(cart.reduce((a, b) => a + b.quantity, 0));
  saveCart();
}

cartItemsEl.addEventListener('input', (e) => {
  const target = e.target;
  if (target.classList.contains('qty-input')) {
    const id = target.getAttribute('data-id');
    const qty = Math.max(1, parseInt(target.value || '1', 10));
    const idx = cart.findIndex(i => i.id === id);
    if (idx !== -1) { cart[idx].quantity = qty; renderCart(); }
  }
});

function addToCart(product, quantity = 1) {
  const existing = cart.find(i => i.id === product.id);
  if (existing) existing.quantity += quantity; else cart.push({ ...product, quantity });
  renderCart();
  toggleCart(true);
}

async function fetchProducts() {
  try {
    const url = API_BASE ? `${API_BASE}/api/products` : '/api/products';
    const res = await fetch(url);
    const data = await res.json();
    return Array.isArray(data) ? data : [];
  } catch (e) {
    console.error('Failed to load products', e);
    return [];
  }
}

function productCard(p) {
  const el = document.createElement('div');
  el.className = 'card';
  el.innerHTML = `
    <img src="${p.image || ''}" alt="${p.title}">
    <div class="content">
      <div class="category">${p.category}</div>
      <div class="title">${p.title}</div>
      <div class="price">${money(p.price)}</div>
      <div class="qty">
        <input type="number" min="1" value="1" aria-label="Quantity" />
        <button class="btn primary add">Add to cart</button>
      </div>
    </div>
  `;
  const qtyInput = el.querySelector('input');
  el.querySelector('.add').addEventListener('click', () => addToCart(p, Math.max(1, parseInt(qtyInput.value || '1', 10))));
  return el;
}

function renderProducts(list) {
  const term = (searchInput.value || '').toLowerCase();
  productsEl.innerHTML = '';
  list.filter(p => p.title.toLowerCase().includes(term) || p.category.toLowerCase().includes(term))
      .forEach(p => productsEl.appendChild(productCard(p)));
}

searchInput.addEventListener('input', () => renderProducts(window.__products || []));

async function init() {
  const products = await fetchProducts();
  window.__products = products;
  renderProducts(products);
  renderCart();
}

checkoutToggle.addEventListener('click', () => {
  checkoutForm.classList.toggle('hidden');
});

checkoutForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  if (!cart.length) { orderStatus.textContent = 'Your cart is empty.'; return; }
  orderStatus.textContent = 'Placing order...';

  const subtotal = cart.reduce((sum, i) => sum + i.price * i.quantity, 0);
  const shipping = cart.length ? 6 : 0;
  const tax = subtotal * 0.10;
  const total = subtotal + shipping + tax;

  const formData = new FormData(checkoutForm);
  const payload = {
    items: cart.map(i => ({ product_id: i.id, title: i.title, price: i.price, quantity: i.quantity, image: i.image })),
    subtotal, shipping, tax, total,
    customer_name: formData.get('customer_name'),
    customer_email: formData.get('customer_email'),
    address_line1: formData.get('address_line1'),
    address_line2: formData.get('address_line2') || null,
    city: formData.get('city'),
    state: formData.get('state'),
    postal_code: formData.get('postal_code'),
    country: formData.get('country'),
  };

  try {
    const url = API_BASE ? `${API_BASE}/api/orders` : '/api/orders';
    const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    const data = await res.json();
    if (res.ok) {
      orderStatus.textContent = `Order placed! Confirmation id: ${data.id}`;
      cart = [];
      renderCart();
      checkoutForm.reset();
      checkoutForm.classList.add('hidden');
    } else {
      orderStatus.textContent = data.detail || 'Failed to place order';
    }
  } catch (e) {
    console.error(e);
    orderStatus.textContent = 'Network error. Try again.';
  }
});

init();
