'use strict';

/* ── Navbar scroll effect ────────────────────────────────────────────────── */
(function () {
  const navbar = document.getElementById('navbar');
  if (!navbar) return;
  const onScroll = () => {
    navbar.classList.toggle('scrolled', window.scrollY > 20);
  };
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();
})();

/* ── Toast system ────────────────────────────────────────────────────────── */
window.showToast = function (message, type = 'success', duration = 3500) {
  const container = document.getElementById('toastContainer');
  if (!container) return;
  const icons = { success: '✅', error: '❌', warning: '⚠️', info: 'ℹ️' };
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerHTML = `<span>${icons[type] || '🔔'}</span><span style="flex:1;">${message}</span>
    <button onclick="this.parentElement.remove()" style="background:none;border:none;color:inherit;cursor:pointer;font-size:1.1rem;line-height:1;">×</button>`;
  container.appendChild(toast);
  setTimeout(() => {
    toast.style.animation = 'toastIn .35s ease reverse';
    setTimeout(() => toast.remove(), 350);
  }, duration);
};

/* ── GSAP global animations ──────────────────────────────────────────────── */
(function () {
  if (typeof gsap === 'undefined') return;

  gsap.registerPlugin(ScrollTrigger);

  // Fade-in on scroll for all .reveal elements
  gsap.utils.toArray('.reveal').forEach((el) => {
    gsap.fromTo(
      el,
      { opacity: 0, y: 40 },
      {
        opacity: 1, y: 0, duration: 0.7, ease: 'power3.out',
        scrollTrigger: { trigger: el, start: 'top 88%', toggleActions: 'play none none none' },
      }
    );
  });

  // Stagger for product grid children
  gsap.utils.toArray('.stagger-grid').forEach((grid) => {
    const cards = grid.querySelectorAll('.card, .product-card');
    if (!cards.length) return;
    gsap.fromTo(
      cards,
      { opacity: 0, y: 32, scale: 0.97 },
      {
        opacity: 1, y: 0, scale: 1, duration: 0.5, ease: 'power3.out', stagger: 0.07,
        scrollTrigger: { trigger: grid, start: 'top 85%', toggleActions: 'play none none none' },
      }
    );
  });

  // Section headings slide-in
  gsap.utils.toArray('.section-heading').forEach((el) => {
    gsap.fromTo(
      el,
      { opacity: 0, x: -24 },
      {
        opacity: 1, x: 0, duration: 0.6, ease: 'power2.out',
        scrollTrigger: { trigger: el, start: 'top 90%' },
      }
    );
  });
})();

/* ── Cart quantity controls ──────────────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', function () {
  document.querySelectorAll('.qty-control').forEach((ctrl) => {
    const productId = ctrl.dataset.productId;
    const display   = ctrl.querySelector('.qty-value');
    const btnMinus  = ctrl.querySelector('[data-action="minus"]');
    const btnPlus   = ctrl.querySelector('[data-action="plus"]');

    if (btnMinus) {
      btnMinus.addEventListener('click', async () => {
        const current = parseInt(display.textContent, 10);
        const newQty  = current - 1;
        await updateCartItem(productId, newQty, ctrl);
      });
    }

    if (btnPlus) {
      btnPlus.addEventListener('click', async () => {
        const current = parseInt(display.textContent, 10);
        await updateCartItem(productId, current + 1, ctrl);
      });
    }
  });
});

/**
 * Read the CSRF token once from a meta tag injected by the server.
 * All AJAX POST/PUT/DELETE calls include it via X-CSRF-Token header.
 */
function getCsrfToken() {
  const meta = document.querySelector('meta[name="csrf-token"]');
  return meta ? meta.getAttribute('content') : '';
}

async function updateCartItem(productId, quantity, ctrl) {
  try {
    const res = await fetch(`/cart/items/${productId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': getCsrfToken() },
      body: JSON.stringify({ quantity }),
    });
    const data = await res.json();
    if (data.success) {
      if (quantity === 0) {
        // Remove the row from DOM
        const row = ctrl.closest('tr, .cart-row');
        if (row) {
          gsap.to(row, { opacity: 0, height: 0, duration: 0.3, onComplete: () => { row.remove(); refreshCartTotal(); } });
        }
      } else {
        const display = ctrl.querySelector('.qty-value');
        if (display) {
          display.textContent = quantity;
          gsap.fromTo(display, { scale: 1.3 }, { scale: 1, duration: 0.2 });
        }
        refreshCartTotal();
      }
    } else {
      showToast(data.error?.message || 'Update failed', 'error');
    }
  } catch (err) {
    showToast('Connection error', 'error');
  }
}

async function removeCartItem(productId) {
  try {
    const res  = await fetch(`/cart/items/${productId}`, {
      method: 'DELETE',
      headers: { 'X-CSRF-Token': getCsrfToken() },
    });
    const data = await res.json();
    if (data.success) {
      const row = document.querySelector(`[data-remove-id="${productId}"]`)?.closest('tr, .cart-row');
      if (row) {
        gsap.to(row, { opacity: 0, height: 0, duration: 0.3, onComplete: () => { row.remove(); refreshCartTotal(); } });
      }
    }
  } catch (err) {
    showToast('Could not remove item', 'error');
  }
}

function refreshCartTotal() {
  // Recalculate subtotal from DOM rows
  let subtotal = 0;
  document.querySelectorAll('[data-line-total]').forEach((el) => {
    const productId = el.dataset.productId;
    const qty = parseInt(document.querySelector(`.qty-value[data-pid="${productId}"]`)?.textContent || el.dataset.qty || '0', 10);
    const price = parseFloat(el.dataset.price || '0');
    const line = qty * price;
    subtotal += line;
    const lineEl = document.querySelector(`[data-line-total="${productId}"]`);
    if (lineEl) lineEl.textContent = `₹${line.toFixed(2)}`;
  });
  const subtotalEl = document.getElementById('cartSubtotal');
  if (subtotalEl) subtotalEl.textContent = `₹${subtotal.toFixed(2)}`;
}

/* ── Add to cart (product pages) ────────────────────────────────────────── */
window.addToCart = async function (productId, name, image, price) {
  const btn = document.getElementById(`atc-${productId}`) || document.querySelector('.add-to-cart-btn');
  if (btn) { btn.disabled = true; btn.textContent = 'Adding…'; }

  try {
    const res  = await fetch('/cart/items', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': getCsrfToken() },
      body: JSON.stringify({ product_id: productId, name, image, price, quantity: 1 }),
    });
    const data = await res.json();

    if (data.success) {
      showToast('Added to cart! 🛒', 'success');
      // Animate cart icon
      const badge = document.querySelector('.cart-badge');
      if (badge) {
        const count = parseInt(badge.textContent || '0', 10) + 1;
        badge.textContent = count;
        if (typeof gsap !== 'undefined') {
          gsap.fromTo(badge, { scale: 1.6 }, { scale: 1, duration: 0.3, ease: 'back.out(2)' });
        }
      }
    } else {
      if (res.status === 401) {
        showToast('Please sign in to add items to cart', 'warning');
        setTimeout(() => { window.location.href = '/auth/login'; }, 1500);
      } else {
        showToast(data.message || 'Could not add to cart', 'error');
      }
    }
  } catch (err) {
    showToast('Connection error', 'error');
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = '🛒 Add to Cart'; }
  }
};

/* ── Payment method toggle ───────────────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', function () {
  const methodInputs = document.querySelectorAll('[name="payment_type"]');
  if (!methodInputs.length) return;

  const panels = document.querySelectorAll('.payment-panel');
  methodInputs.forEach((input) => {
    input.addEventListener('change', () => {
      panels.forEach((p) => p.classList.remove('active'));
      const panel = document.getElementById(`panel-${input.value}`);
      if (panel) {
        panel.classList.add('active');
        if (typeof gsap !== 'undefined') {
          gsap.fromTo(panel, { opacity: 0, y: 12 }, { opacity: 1, y: 0, duration: 0.3 });
        }
      }
    });
  });
});
