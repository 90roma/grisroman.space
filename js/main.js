// Переключатель темы и появление блоков при прокрутке.
(function () {
  var root = document.documentElement;
  var darkQuery = window.matchMedia('(prefers-color-scheme: dark)');

  // ---------- Тема: системная по умолчанию, выбор пользователя важнее и сохраняется ----------
  function currentTheme() {
    return root.dataset.theme || (darkQuery.matches ? 'dark' : 'light');
  }

  function themeHint() {
    return currentTheme() === 'dark' ? 'Включить светлую тему' : 'Включить тёмную тему';
  }

  document.querySelectorAll('.theme-toggle').forEach(function (button) {
    button.setAttribute('aria-pressed', String(currentTheme() === 'dark'));
    button.dataset.hint = themeHint();
    button.addEventListener('click', function () {
      var next = currentTheme() === 'dark' ? 'light' : 'dark';
      root.dataset.theme = next;
      try { localStorage.setItem('theme', next); } catch (e) {}
      button.setAttribute('aria-pressed', String(next === 'dark'));
      button.dataset.hint = themeHint();
    });
  });

  // ---------- Хинт у кнопок без подписи (атрибут data-hint), по Контур.Гайдам: при наведении мышью
  // через 400 мс, при фокусе с клавиатуры сразу; исчезает, когда курсор ушёл, при прокрутке и по Esc.
  // На сенсорных экранах наведения нет — хинт не показывается, название кнопки есть в aria-label ----------
  var hint = document.createElement('div');
  hint.className = 'hint text-s';
  hint.id = 'hint';
  hint.setAttribute('role', 'tooltip');
  hint.hidden = true;
  document.body.appendChild(hint);
  var hintTimer, hintTarget;

  function cssMs(name) { return parseFloat(getComputedStyle(root).getPropertyValue(name)) || 0; }

  function showHint(el) {
    hintTarget = el;
    hint.textContent = el.dataset.hint;
    hint.hidden = false;
    el.setAttribute('aria-describedby', 'hint');
    // Над кнопкой; если сверху нет места — под ней. По горизонтали по центру, не ближе 16 к краям экрана
    var gap = cssMs('--space-8'), edge = cssMs('--space-16');
    var r = el.getBoundingClientRect(), w = hint.offsetWidth, h = hint.offsetHeight;
    var top = r.top - gap - h;
    if (top < edge) top = r.bottom + gap;
    var left = Math.min(Math.max(r.left + r.width / 2 - w / 2, edge), window.innerWidth - edge - w);
    hint.style.top = top + 'px';
    hint.style.left = left + 'px';
  }

  function hideHint() {
    clearTimeout(hintTimer);
    if (hintTarget) hintTarget.removeAttribute('aria-describedby');
    hintTarget = null;
    hint.hidden = true;
  }

  document.querySelectorAll('[data-hint]').forEach(function (el) {
    el.addEventListener('pointerenter', function (e) {
      if (e.pointerType !== 'mouse') return;
      clearTimeout(hintTimer);
      hintTimer = setTimeout(function () { showHint(el); }, cssMs('--hint-delay'));
    });
    el.addEventListener('pointerleave', hideHint);
    el.addEventListener('focus', function () { if (el.matches(':focus-visible')) showHint(el); });
    el.addEventListener('blur', hideHint);
    el.addEventListener('click', function () { if (hintTarget === el) showHint(el); });
  });
  window.addEventListener('scroll', hideHint, { passive: true });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') hideHint(); });

  // ---------- «Открыть в Claude / ChatGPT»: чат открывается пустым, запрос копируется в буфер.
  // Сообщение не отправляется само — человек вставляет запрос и решает, отправлять ли ----------
  document.querySelectorAll('[data-ai-prompt]').forEach(function (box) {
    var status = box.querySelector('.ask-ai__status');
    box.querySelectorAll('a').forEach(function (link) {
      link.addEventListener('click', function () {
        var fail = function () { status.textContent = 'Скопируйте запрос и вставьте его в чат: ' + box.dataset.aiPrompt; };
        if (!navigator.clipboard) { fail(); return; }
        navigator.clipboard.writeText(box.dataset.aiPrompt).then(function () {
          status.textContent = 'Запрос скопирован, вставьте его в чат.';
        }, fail);
      });
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
      zoom.addEventListener('close', function () {
        root.classList.remove('is-zoomed');
        if (zoom.trigger) zoom.trigger.focus();
      });
    }
    var copy = img.cloneNode();
    copy.removeAttribute('class');
    copy.loading = 'eager';
    // крупная версия схемы (data-zoom-src) грузится только при открытии
    if (img.dataset.zoomSrc) {
      copy.src = img.dataset.zoomSrc;
      copy.removeAttribute('width');
      copy.removeAttribute('height');
    }
    zoom.querySelector('.zoom__scroll').replaceChildren(copy);
    zoom.classList.toggle('zoom--fit', trigger.dataset.zoom === 'fit');
    zoom.classList.toggle('zoom--natural', trigger.dataset.zoom === 'natural');
    // большая схема начинается слева: открываем её у левого края, по середине высоты
    if (trigger.dataset.zoom === 'natural') {
      copy.addEventListener('load', function () {
        var box = zoom.querySelector('.zoom__scroll');
        box.scrollTop = (box.scrollHeight - box.clientHeight) / 2;
      }, { once: true });
    }
    zoom.setAttribute('aria-label', trigger.getAttribute('aria-label') || 'Картинка');
    zoom.trigger = trigger;
    root.classList.add('is-zoomed');
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

  // ---------- Аккордеон [data-accordion]: на телефоне и планшете вопросы свёрнуты, на desktop — таблица, всё раскрыто ----------
  var wideTable = window.matchMedia('(min-width: 1024px)');
  document.querySelectorAll('[data-accordion]').forEach(function (box) {
    var rows = box.querySelectorAll('details');
    function sync() { rows.forEach(function (row) { row.open = wideTable.matches; }); }
    rows.forEach(function (row) {
      row.querySelector('summary').addEventListener('click', function (e) { if (wideTable.matches) e.preventDefault(); });
    });
    wideTable.addEventListener('change', sync);
    sync();
  });

  // ---------- Оглавление кейса: подсветка текущего раздела, видно только в зоне разделов ----------
  var toc = document.querySelector('.toc');
  if (toc) {
    var tocLinks = Array.prototype.slice.call(toc.querySelectorAll('.toc__link'));
    var tocSections = tocLinks.map(function (link) { return document.querySelector(link.getAttribute('href')); });
    var tocPending = false;
    function updateToc() {
      tocPending = false;
      // текущий — последний раздел, чьё начало поднялось выше трети экрана; над hero не подсвечен ни один
      var current = -1;
      tocSections.forEach(function (section, i) {
        if (section.getBoundingClientRect().top <= window.innerHeight / 3) current = i;
      });
      tocLinks.forEach(function (link, i) {
        if (i === current) link.setAttribute('aria-current', 'true');
        else link.removeAttribute('aria-current');
      });
      // видно, только когда разделы закрывают оглавление по высоте целиком: выше — обложка, ниже — футер, они шире контента
      var box = toc.getBoundingClientRect();
      var first = tocSections[0].getBoundingClientRect();
      var last = tocSections[tocSections.length - 1].getBoundingClientRect();
      toc.classList.toggle('toc--visible', first.top <= box.top && last.bottom >= box.bottom);
    }
    window.addEventListener('scroll', function () {
      if (!tocPending) { tocPending = true; requestAnimationFrame(updateToc); }
    }, { passive: true });
    updateToc();
  }

  // ---------- Зацикленные видео без интерфейса: при «уменьшить движение» стоят на первом кадре ----------
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    document.querySelectorAll('.figure__video').forEach(function (video) {
      video.removeAttribute('autoplay');
      video.pause();
    });
  }

  // ---------- Шаговые шкалы: число сегментов — по ширине (сегмент и промежуток из токенов) ----------
  var scaleNoMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  function fillScale(bar, paint) {
    var seg = cssMs('--scale-seg'), gap = cssMs('--scale-gap');
    var n = Math.max(1, Math.floor((bar.clientWidth + gap) / (seg + gap)));
    if (bar.children.length !== n) {
      bar.textContent = '';
      for (var i = 0; i < n; i++) bar.appendChild(document.createElement('i'));
    }
    for (var k = 0; k < n; k++) bar.children[k].className = paint(k, n);
  }

  // Шкала результата [data-scale]: синим — «стало» (заполнено от нуля), тёмной меткой в один сегмент — «было».
  // Синее заполняется по сегменту, когда шкала появляется на экране; при «уменьшить движение» — сразу
  document.querySelectorAll('[data-scale]').forEach(function (bar) {
    var max = +bar.dataset.max, before = +bar.dataset.before, after = +bar.dataset.after;
    var shown = 0, end = 0, done = false;
    function paint(i, n) {
      end = Math.round(after / max * n);
      if (i === Math.min(n - 1, Math.floor(before / max * n))) return 'is-base';
      return i < Math.min(shown, end) ? 'is-change' : '';
    }
    function run() {
      fillScale(bar, paint);
      if (scaleNoMotion) { shown = end; done = true; fillScale(bar, paint); return; }
      var t = setInterval(function () {
        shown++;
        fillScale(bar, paint);
        if (shown >= end) { clearInterval(t); done = true; }
      }, cssMs('--scale-step'));
    }
    fillScale(bar, paint);
    if (scaleNoMotion || !('IntersectionObserver' in window)) { run(); return; }
    new IntersectionObserver(function (entries, obs) {
      if (entries[0].isIntersecting) { run(); obs.disconnect(); }
    }, { threshold: 1 }).observe(bar);
    window.addEventListener('resize', function () { if (done) { shown = Infinity; fillScale(bar, paint); } });
  });

  // Прогресс чтения [data-read-progress] (страницы кейсов): штрихи пунктира шапки по одному становятся цветом текста (fg)
  // по доле прокрутки — ширина кратна шагу пунктира (штрих + пробел). Только на странице длиннее двух экранов
  document.querySelectorAll('[data-read-progress]').forEach(function (bar) {
    function update() {
      var doc = document.documentElement, max = doc.scrollHeight - window.innerHeight;
      bar.hidden = doc.scrollHeight < window.innerHeight * 2;
      if (bar.hidden) return;
      var part = max > 0 ? window.scrollY / max : 0;
      var step = cssMs('--dash') * 2;
      bar.style.width = Math.round(part * bar.parentElement.clientWidth / step) * step + 'px';
    }
    window.addEventListener('scroll', update, { passive: true });
    window.addEventListener('resize', update);
    window.addEventListener('load', update);
    update();
  });

  // ---------- Аналитика: событие «дочитал до раздела «Результат»» в кейсе, один раз за просмотр.
  // Клики по кнопкам считает сам GoatCounter по атрибуту data-goatcounter-click ----------
  var resultSection = document.getElementById('result');
  if (resultSection && 'IntersectionObserver' in window) {
    new IntersectionObserver(function (entries, obs) {
      if (!entries[0].isIntersecting) return;
      obs.disconnect();
      if (window.goatcounter && window.goatcounter.count) {
        window.goatcounter.count({ path: 'read-result' + location.pathname, title: 'Дочитал до «Результата»', event: true });
      }
    }).observe(resultSection);
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
