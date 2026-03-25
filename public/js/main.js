// ─── MOBILE NAV ───────────────────────────────────────────────────────────────
const toggle = document.querySelector('.nav-menu-toggle');
const navLinks = document.querySelector('.nav-links');
if (toggle && navLinks) {
  toggle.addEventListener('click', () => navLinks.classList.toggle('open'));
}

// ─── VIDEO MODAL ──────────────────────────────────────────────────────────────
const modal = document.getElementById('video-modal');
const modalFrame = document.getElementById('modal-frame');
const modalTitle = document.getElementById('modal-title');

document.querySelectorAll('[data-video]').forEach(el => {
  el.addEventListener('click', e => {
    e.preventDefault();
    const id = el.dataset.video;
    const title = el.dataset.title || '';
    modalFrame.src = `https://www.youtube.com/embed/${id}?autoplay=1&rel=0`;
    if (modalTitle) modalTitle.textContent = title;
    modal?.classList.add('open');
  });
});

if (modal) {
  modal.addEventListener('click', e => {
    if (e.target === modal) closeModal();
  });
  document.getElementById('modal-close')?.addEventListener('click', closeModal);
  document.addEventListener('keydown', e => { if (e.key === 'Escape') closeModal(); });
}

function closeModal() {
  modal?.classList.remove('open');
  if (modalFrame) modalFrame.src = '';
}

// ─── LIKE BUTTON ──────────────────────────────────────────────────────────────
const likeBtn = document.getElementById('like-btn');
if (likeBtn) {
  likeBtn.addEventListener('click', async () => {
    const slug = likeBtn.dataset.slug;
    try {
      const res = await fetch(`/articles/${slug}/like`, { method: 'POST', headers: { 'Content-Type': 'application/json' } });
      const data = await res.json();
      if (data.error) { showToast(data.error, 'error'); return; }
      likeBtn.classList.toggle('liked', data.liked);
      const counter = likeBtn.querySelector('.like-count');
      if (counter) counter.textContent = data.count;
    } catch {
      showToast('Failed to like. Try again.', 'error');
    }
  });
}

// ─── TOAST ────────────────────────────────────────────────────────────────────
function showToast(msg, type = 'info') {
  const toast = document.getElementById('toast');
  if (!toast) return;
  toast.textContent = msg;
  toast.className = `toast show ${type}`;
  setTimeout(() => toast.classList.remove('show'), 3000);
}

// ─── SEARCH FORM AUTO-SUBMIT ON CLEAR ─────────────────────────────────────────
const searchInput = document.querySelector('.search-form input[name="q"]');
if (searchInput) {
  searchInput.addEventListener('input', () => {
    if (!searchInput.value) {
      searchInput.closest('form').submit();
    }
  });
}

// ─── ARTICLE RICH TEXT TOOLBAR ────────────────────────────────────────────────
const bodyTA = document.getElementById('article-body');
if (bodyTA) {
  document.querySelectorAll('.editor-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const tag = btn.dataset.tag;
      if (!tag) return;
      const { selectionStart: start, selectionEnd: end } = bodyTA;
      const selected = bodyTA.value.slice(start, end);
      const wrapped = `<${tag}>${selected || `Enter text here`}</${tag}>`;
      bodyTA.value = bodyTA.value.slice(0, start) + wrapped + bodyTA.value.slice(end);
      bodyTA.focus();
    });
  });
}

// ─── SMOOTH SCROLL FOR ANCHOR LINKS ──────────────────────────────────────────
document.querySelectorAll('a[href^="#"]').forEach(a => {
  a.addEventListener('click', e => {
    const target = document.querySelector(a.getAttribute('href'));
    if (target) { e.preventDefault(); target.scrollIntoView({ behavior: 'smooth', block: 'start' }); }
  });
});

// ─── CONFIRM DELETES ──────────────────────────────────────────────────────────
document.querySelectorAll('[data-confirm]').forEach(el => {
  el.addEventListener('click', e => {
    if (!confirm(el.dataset.confirm)) e.preventDefault();
  });
});
