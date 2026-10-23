// Переключатель темы и появление блоков при прокрутке.
(function () {
  var root = document.documentElement;
  var darkQuery = window.matchMedia('(prefers-color-scheme: dark)');

  // ---------- Тема: системная по умолчанию, выбор пользователя важнее и сохраняется ----------
  function currentTheme() {
    return root.dataset.theme || (darkQuery.matches ? 'dark' : 'light');
  }

  document.querySelectorAll('.theme-toggle').forEach(function (button) {
    button.setAttribute('aria-pressed', String(currentTheme() === 'dark'));
    button.addEventListener('click', function () {
      var next = currentTheme() === 'dark' ? 'light' : 'dark';
      root.dataset.theme = next;
      try { localStorage.setItem('theme', next); } catch (e) {}
      button.setAttribute('aria-pressed', String(next === 'dark'));
    });
  });

  // ---------- Видео: постер с кнопкой, плеер YouTube (без cookie) грузится только по клику ----------
  document.querySelectorAll('[data-video]').forEach(function (box) {
    var button = box.querySelector('.video__play');
    if (!button) return;
    button.addEventListener('click', function () {
      var frame = document.createElement('iframe');
      frame.src = 'https://www.youtube-nocookie.com/embed/' + box.dataset.video + '?autoplay=1&rel=0';
      frame.title = box.dataset.title || 'Видео';
      frame.allow = 'autoplay; encrypted-media; picture-in-picture; fullscreen';
      frame.allowFullscreen = true;
      box.replaceChildren(frame);
      frame.focus();
    });
  });

  // ---------- Схема на весь экран: [data-zoom] открывает видимую картинку в натуральную величину ----------
  var zoom = null;
  function openZoom(trigger) {
    var img = Array.prototype.find.call(trigger.querySelectorAll('img'), function (i) {
      return getComputedStyle(i).display !== 'none';
    });
    if (!img) return;
    if (!zoom) {
      zoom = document.createElement('dialog');
      zoom.className = 'zoom';
      zoom.innerHTML = '<div class="zoom__scroll"></div><button class="zoom__close btn label-m" type="button">Закрыть</button>';
      document.body.appendChild(zoom);
      zoom.querySelector('.zoom__close').addEventListener('click', function () { zoom.close(); });
      zoom.querySelector('.zoom__scroll').addEventListener('click', function () { zoom.close(); });
      zoom.addEventListener('close', function () { if (zoom.trigger) zoom.trigger.focus(); });
    }
    var copy = img.cloneNode();
    copy.removeAttribute('class');
    copy.loading = 'eager';
    zoom.querySelector('.zoom__scroll').replaceChildren(copy);
    zoom.classList.toggle('zoom--fit', trigger.dataset.zoom === 'fit');
    zoom.setAttribute('aria-label', trigger.getAttribute('aria-label') || 'Картинка');
    zoom.trigger = trigger;
    zoom.showModal();
  }
  document.querySelectorAll('[data-zoom]').forEach(function (trigger) {
    trigger.addEventListener('click', function () { openZoom(trigger); });
  });

  // ---------- Галерея: стрелки листают по одной картинке, счётчик следит за прокруткой (свайп работает и без JS) ----------
  document.querySelectorAll('[data-gallery]').forEach(function (gallery) {
    var track = gallery.querySelector('.gallery__track');
    var slides = track.children;
    var prev = gallery.querySelector('[data-gallery-prev]');
    var next = gallery.querySelector('[data-gallery-next]');
    var current = gallery.querySelector('[data-gallery-current]');
    var pad = function (n) { return String(n).padStart(2, '0'); };
    var offset = function (i) { return slides[i].offsetLeft - slides[0].offsetLeft; };
    var index = function () { return Math.round(track.scrollLeft / offset(1)); };
    var target = null;  // куда листаем стрелкой; null — свайп, цель не задана
    function go(i) { target = i; track.scrollTo({ left: offset(i) }); }
    function update() {
      var i = index();
      current.textContent = pad(i + 1);
      prev.disabled = i === 0;
      next.disabled = i === slides.length - 1;
    }
    // Стрелка на краю становится неактивной и теряет фокус — заранее переводим его на соседнюю
    function step(button, other, i, edge) {
      go(i);
      if (i === edge && document.activeElement === button) other.focus();
    }
    gallery.querySelector('[data-gallery-total]').textContent = pad(slides.length);
    prev.addEventListener('click', function () { step(prev, next, Math.max(index() - 1, 0), 0); });
    next.addEventListener('click', function () { step(next, prev, Math.min(index() + 1, slides.length - 1), slides.length - 1); });
    track.addEventListener('scroll', update, { passive: true });
    // перелистывание прервали на полпути (например, прокруткой страницы) — доводим до цели или до ближайшей картинки
    track.addEventListener('scrollend', function () {
      var i = target === null ? index() : target;
      if (Math.abs(track.scrollLeft - offset(i)) > 1) { go(i); return; }
      target = null;
    });
    track.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowLeft') { e.preventDefault(); prev.click(); }
      if (e.key === 'ArrowRight') { e.preventDefault(); next.click(); }
    });
    gallery.querySelector('.gallery__nav').hidden = false;
    update();
  });

  // ---------- Оглавление кейса: подсветка текущего раздела, прячется над картинками во всю ширину ----------
  var toc = document.querySelector('.toc');
  if (toc) {
    var tocList = toc.querySelector('.toc__list');
    var tocLinks = Array.prototype.slice.call(toc.querySelectorAll('.toc__link'));
    var tocSections = tocLinks.map(function (link) { return document.querySelector(link.getAttribute('href')); });
    var wides = document.querySelectorAll('.case-body .section__wide');
    var tocPending = false;
    function updateToc() {
      tocPending = false;
      if (getComputedStyle(toc).display === 'none') return;
      // текущий — последний раздел, чьё начало поднялось выше трети экрана
      var current = 0;
      tocSections.forEach(function (section, i) {
        if (section.getBoundingClientRect().top <= window.innerHeight / 3) current = i;
      });
      tocLinks.forEach(function (link, i) {
        if (i === current) link.setAttribute('aria-current', 'true');
        else link.removeAttribute('aria-current');
      });
      // над картинкой, видео или галереей во всю ширину список не виден
      var box = tocList.getBoundingClientRect();
      var covered = Array.prototype.some.call(wides, function (el) {
        var r = el.getBoundingClientRect();
        return r.top < box.bottom && r.bottom > box.top;
      });
      toc.classList.toggle('toc--hidden', covered);
    }
    function requestToc() {
      if (!tocPending) { tocPending = true; requestAnimationFrame(updateToc); }
    }
    window.addEventListener('scroll', requestToc, { passive: true });
    window.addEventListener('resize', requestToc);
    updateToc();
  }

  // ---------- Зацикленные видео без интерфейса: при «уменьшить движение» стоят на первом кадре ----------
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    document.querySelectorAll('.figure__video').forEach(function (video) {
      video.removeAttribute('autoplay');
      video.pause();
    });
  }

  // ---------- Появление: [data-reveal] получает .is-visible, когда попадает в экран ----------
  var items = document.querySelectorAll('[data-reveal]');
  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  if (reduceMotion || !('IntersectionObserver' in window)) {
    items.forEach(function (el) { el.classList.add('is-visible'); });
    return;
  }

  var observer = new IntersectionObserver(function (entries) {
    entries.forEach(function (entry) {
      if (!entry.isIntersecting) return;
      entry.target.classList.add('is-visible');
      observer.unobserve(entry.target);
    });
  }, { rootMargin: '0px 0px -10% 0px' });

  items.forEach(function (el) { observer.observe(el); });
})();
