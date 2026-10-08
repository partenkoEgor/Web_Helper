// ==UserScript==
// @name         Web Helper
// @namespace    web-helper
// @version      1.0.0
// @description  Помощник для работы с платёжными тикетами в TH Management: превью вложений (картинки и PDF) с полноэкранным просмотром, подсказка на статусе (предыдущий статус и кто в работе), автоподстановка Reddy ID и диапазона дат, компактные кнопки вместо ссылок на файлы, копирование ячейки по клику, обмен сохранёнными фильтрами и автозакрытие штатных попапов «OK». Каждую функцию можно выключить в панели настроек.
// @author       partenkoEgor
// @homepageURL  https://github.com/partenkoEgor/Web_Helper
// @supportURL   https://github.com/partenkoEgor/Web_Helper/issues
// @match        https://th-managment.com/en/admin/backoffice/*
// @match        https://my-managment.com/en/admin/backoffice/*
// @match        https://managment.io/en/admin/backoffice/*
// @run-at       document-start
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_registerMenuCommand
// @grant        unsafeWindow
// @require      https://raw.githubusercontent.com/partenkoEgor/Web_Helper/main/vendor/pdfjs-3.11.174/pdf.min.js#sha256=W1eZ5vjGgGYyB6xbQu4U7tKkBvp69I9QwVTwwLFWaUY=
// @require      https://raw.githubusercontent.com/partenkoEgor/Web_Helper/main/vendor/pdfjs-3.11.174/pdf.worker.min.js#sha256=/qvfMJdw7SS7oxpUZ4Ns3Iz2OccFryfVK1hbBBu4Uns=
// @updateURL    https://raw.githubusercontent.com/partenkoEgor/Web_Helper/main/web-helper.user.js
// @downloadURL  https://raw.githubusercontent.com/partenkoEgor/Web_Helper/main/web-helper.user.js
// ==/UserScript==

(function () {
  'use strict';

  // ------------------------------------------------------------------
  // НАСТРОЙКИ
  // ------------------------------------------------------------------
  const CONFIG = {
    // Какие функции включены по умолчанию. Чтобы отключить любую —
    // поставить false или выключить её в панели настроек (кнопка ⚙).
    features: {
      // Превью вложений при наведении на ссылку в таблице + полноэкранный просмотр
      filePreview: true,
      // Тултип на статусе: предыдущий статус для закрытых тикетов
      // и Admin username для тикетов в работе
      prevStatus: true,
      // Подстановка своего Reddy ID
      messengerId: true,
      // Автоподстановка диапазона дат после применения фильтра
      autoDateRange: true,
      // Компактные кнопки вместо длинных ссылок на файлы в таблице
      fileButtons: true,
      // Копирование значения одной ячейки по клику
      cellCopy: true,
      // Кнопка рядом с «Saved filters»: поделиться сохранёнными фильтрами
      // кодом и добавить фильтры коллеги по его коду
      filterShare: true,
      // Автозакрытие штатных попапов SweetAlert2 «OK!» — работает на всех
      // страницах бэкофиса, а не только на страницах тикетов
      autoClose: true,
    },

    // Страницы тикетов, на которых работают все функции, кроме
    // автозакрытия попапов. Автозакрытие нужно во всём бэкофисе, поэтому
    // @match в шапке широкий, а остальные функции включаются только здесь.
    ticketPages: /^\/en\/admin\/backoffice\/(paymentsupport|ExtendedPaymentRequestList)/,

    // ── Превью вложений ──────────────────────────────────────────────
    filePreview: {
      // Максимальная ширина картинки в попапе (px)
      maxWidth: 400,
      // Задержка перед скрытием попапа, чтобы успеть довести до него мышь (мс)
      hideDelay: 200,
      // Какие расширения считать картинками (для них доступен полноэкранный режим)
      imageExts: ['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp'],
      // Какие расширения считать видео (показывается иконка + имя файла)
      videoExts: ['mp4', 'webm', 'mov', 'avi'],
      // Масштабирование в полноэкранном режиме
      zoom: {
        // Во сколько раз меняется масштаб за одно деление колеса мыши
        step: 1.15,
        // Минимальный масштаб. 1 — картинка, вписанная в экран;
        // меньше единицы разрешает уменьшать её сильнее.
        min: 1,
        // Предел увеличения
        max: 8,
      },
      // PDF: первая страница — в попапе при наведении, все страницы —
      // в полноэкранном режиме с тем же поворотом и масштабом, что у картинок.
      // Страницы рисует pdf.js (подключён через @require в шапке).
      pdf: {
        // Сколько страниц максимум показывать в полноэкранном режиме
        maxPages: 10,
        // Файлы крупнее этого не скачиваются для превью (байт)
        maxBytes: 20 * 1024 * 1024,
        // Ширина, в которую рисуется страница (px). С запасом под увеличение
        // в полноэкранном режиме; в попапе картинка просто ужимается.
        renderWidth: 1800,
        // Пределы масштаба отрисовки и площади одной страницы (пикселей) —
        // чтобы огромный скан не упёрся в предел размера canvas
        maxScale: 4,
        maxPixels: 16000000,
        // Сколько последних PDF держать в памяти
        cacheSize: 6,
      },
    },

    // ── Предыдущий статус и кто в работе ─────────────────────────────
    prevStatus: {
      // Для каких значений External Status показывать предыдущий статус
      // (в нижнем регистре). Сейчас — только закрытые тикеты. Чтобы
      // расширить, дописать статусы сюда, например: 'credited',
      // 'credited (m)', 'duplicated ticket'.
      triggers: ['closed', 'closed (m)'],
      // Для каких значений External Status показывать, у кого тикет
      // в работе — Admin username из самой свежей записи истории
      inWorkTriggers: ['in progress', 'in progress (m)'],
      // Эндпоинт истории тикета
      historyUrl: '/admin/backoffice/paymentsupporthistory',
      // Сколько помнить ответ истории (мс). Закрытый тикет уже не меняется,
      // а тикет в работе может перехватить другой админ — поэтому кэш
      // не на всю сессию, а на минуту.
      cacheTtl: 60000,
      // Задержка перед скрытием тултипа (мс)
      hideDelay: 150,
    },

    // ── Подстановка Reddy ID ──────────────────────────────────────────
    messengerId: {
      // Ключ в хранилище Tampermonkey
      storageKey: 'reddyId',
      // Атрибут в серверной разметке страницы, откуда берётся ID
      // (технически это поле называется curr_medium, но в интерфейсе
      // и в кнопках сайт называет этот мессенджер Reddy)
      sourceAttr: 'curr_medium',
      // Плейсхолдер поля в модалке SweetAlert2, куда подставляется ID.
      // Именно по нему находим поле — оно не имеет id/name, а кнопка,
      // открывающая модалку, может называться по-разному в разных местах
      fieldPlaceholder: 'Reddy ID',
    },

    // ── Автоподстановка дат ──────────────────────────────────────────
    autoDateRange: {
      // Насколько назад отсчитывать начало диапазона
      yearsBack: 1,
      // Случайный сдвиг даты «от» вперёд от точки «год назад», в днях
      // [мин, макс] включительно. Минимум 1 — чтобы не выйти за годовое
      // окно и чтобы дата не была ровно «год назад» каждый раз.
      shiftDays: [1, 30],
      // Время начала и конца диапазона [часы, минуты]
      startTime: [0, 0],
      endTime: [23, 59],
      // Пауза после нажатия Apply, прежде чем искать поле даты (мс)
      applyDelay: 300,
      // Сколько ещё пытаться, если поле не появилось сразу
      retryInterval: 100,
      retryTimeout: 3000,
    },

    // ── Кнопки вместо ссылок на файлы ──────────────────────────────────
    fileButtons: {
      // В каких колонках ссылки заменяются кнопками. Сравнение точное,
      // после нормализации пробелов и апострофов, в нижнем регистре.
      // В окне «История тикета» тот же смысловой столбец, что в основной
      // таблице называется Support team's files, называется Internal files —
      // поэтому оба варианта в списке.
      columns: ['user files', "agent's files", "support team's files", 'internal files'],
      // Подпись и цветовая категория (kind) кнопки по расширению файла.
      // kind: 'image' | 'pdf' | 'video' | 'other' — своим цветом выделены
      // только pdf и video, всё остальное (включая незнакомые расширения,
      // см. fallbackKind) — 'other', чтобы такие файлы бросались в глаза.
      types: {
        'Скрин': { exts: ['jpg', 'jpeg', 'png', 'webp', 'bmp', 'heic', 'heif', 'tif', 'tiff', 'svg'], kind: 'image' },
        'GIF': { exts: ['gif'], kind: 'image' },
        'PDF': { exts: ['pdf'], kind: 'pdf' },
        'Видео': { exts: ['mp4', 'webm', 'mov', 'avi', 'mkv', 'mpeg', 'mpg', 'm4v', '3gp'], kind: 'video' },
        'Аудио': { exts: ['mp3', 'wav', 'm4a', 'ogg', 'aac'], kind: 'other' },
        'DOC': { exts: ['doc', 'docx', 'odt', 'rtf'], kind: 'other' },
        'XLS': { exts: ['xls', 'xlsx', 'csv', 'ods'], kind: 'other' },
        'Архив': { exts: ['zip', 'rar', '7z', 'tar', 'gz'], kind: 'other' },
        'TXT': { exts: ['txt'], kind: 'other' },
      },
      fallbackLabel: 'Файл',
      fallbackKind: 'other',
    },

    // ── Обмен сохранёнными фильтрами ───────────────────────────────────
    filterShare: {
      // Эндпоинты сайта: список сохранённых фильтров страницы и сохранение
      // одного фильтра. Те же запросы сайт делает сам при открытии
      // «Saved filters» и при нажатии «Save filter».
      getUrl: '/admin/filter/get',
      saveUrl: '/admin/filter/save',
      // Сохранённые фильтры привязаны к странице через reportId. Для
      // Extended номер взят из запроса /admin/filter/get; для paymentsupport —
      // из ссылок на файлы этой страницы (у Extended в них тот же номер,
      // что и в фильтрах). Ключ — часть адреса после /backoffice/, в нижнем
      // регистре. Если страницы здесь нет, номер берётся из ссылок на файлы
      // в основной таблице.
      reports: {
        paymentsupport: { id: '08e0508d5f806e2b71eb556c7108526c', label: 'List of payment queries' },
        extendedpaymentrequestlist: { id: 'd7b421f82c0cb8682ab375b35b131e71', label: 'List of payment queries (Extended)' },
      },
      // Начало кода, по которому его узнаёт окно «Добавить по коду»
      codePrefix: 'TH-FILTERS:',
      // Сколько фильтров максимум принимается из одного кода
      maxFilters: 200,
    },

    // Подробный лог в консоль (F12 → Console)
    debug: false,
  };

  // ------------------------------------------------------------------
  // ОБЩЕЕ
  // ------------------------------------------------------------------

  // Со включённым @grant скрипт работает в песочнице, и window здесь —
  // не окно страницы. Тему админка держит в своей переменной, поэтому
  // читаем её через unsafeWindow, когда он доступен.
  const pageWindow = typeof unsafeWindow !== 'undefined' ? unsafeWindow : window;

  // Палитра выбирается при запуске функций, а не при загрузке файла:
  // скрипт стартует на document-start, когда админка ещё не успела
  // выставить _THEME.
  let T = null;

  function initTheme() {
    const isDark = pageWindow._THEME === 'dark';
    T = isDark ? {
      bg: '#1C2128',
      border: '#30363D',
      text: '#C9D1D9',
      textStrong: '#E6EDF3',
      textDim: '#8B949E',
      imgBg: '#0D1117',
      panel: '#161B22',
      shadow: '0 8px 24px rgba(0,0,0,0.45)',
    } : {
      bg: '#fff',
      border: '#DFE1E6',
      text: '#42526E',
      textStrong: '#172B4D',
      textDim: '#8993A4',
      imgBg: '#F7F8FA',
      panel: '#F6F7F8',
      shadow: '0 8px 24px rgba(0,0,0,0.18)',
    };
  }

  const ACCENT = '#2ABFCF';
  const ACCENT_HOVER = '#1fa8b8';

  function log(...args) {
    if (CONFIG.debug) console.log('[WebHelper]', ...args);
  }

  function addStyle(id, css) {
    if (document.getElementById(id)) return false;
    const el = document.createElement('style');
    el.id = id;
    el.textContent = css;
    document.head.appendChild(el);
    return true;
  }

  // Держит элемент в пределах экрана: возвращает координаты левого верхнего угла
  function clampToViewport(left, top, width, height, margin) {
    const m = margin === undefined ? 12 : margin;
    if (left + width > window.innerWidth - m) left = window.innerWidth - width - m;
    if (left < m) left = m;
    if (top + height > window.innerHeight - m) top = window.innerHeight - height - m;
    if (top < m) top = m;
    return { left, top };
  }

  // Ставит тултип рядом с курсором, переворачивая его у краёв экрана
  function placeNearCursor(el, x, y, margin) {
    const m = margin === undefined ? 14 : margin;
    const w = el.offsetWidth || 200;
    const h = el.offsetHeight || 50;
    el.style.left = (x + m + w > window.innerWidth ? x - w - m : x + m) + 'px';
    el.style.top = (y + m + h > window.innerHeight ? y - h - m : y + m) + 'px';
  }

  // ==================================================================
  // 1. ПРЕВЬЮ ВЛОЖЕНИЙ ПРИ НАВЕДЕНИИ
  // ==================================================================

  function initFilePreview() {
    const CFG = CONFIG.filePreview;

    addStyle('th-helper-preview-style', `
      #th-preview-popup {
        position: fixed;
        z-index: 99999;
        background: ${T.bg};
        border: .5px solid ${T.border};
        border-radius: 10px;
        box-shadow: ${T.shadow};
        overflow: hidden;
        pointer-events: none;
        display: none;
        opacity: 0;
        transition: opacity .15s;
        max-width: ${CFG.maxWidth}px;
        width: max-content;
      }
      #th-preview-popup.visible {
        display: block;
        opacity: 1;
        pointer-events: auto;
      }
      #th-preview-popup img {
        display: block;
        max-width: ${CFG.maxWidth}px;
        max-height: calc(100vh - 120px);
        width: auto;
        height: auto;
        object-fit: contain;
        background: ${T.imgBg};
      }
      .th-preview-actions {
        display: flex;
        border-bottom: .5px solid rgba(255,255,255,0.2);
      }
      .th-preview-btn {
        flex: 1;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: 6px;
        padding: 8px 12px;
        border: none;
        border-right: .5px solid rgba(255,255,255,0.2);
        background: ${ACCENT};
        font-size: 12px;
        font-weight: 600;
        color: #fff;
        cursor: pointer;
        white-space: nowrap;
        transition: background .12s;
        text-decoration: none;
        letter-spacing: .02em;
      }
      .th-preview-btn:last-child { border-right: none; }
      .th-preview-btn:hover { background: ${ACCENT_HOVER}; }
      .th-preview-btn svg { flex-shrink: 0; pointer-events: none; }
      .th-preview-file-wrap {
        display: flex;
        align-items: center;
        gap: 10px;
        padding: 14px 16px;
      }
      .th-preview-file-name {
        font-size: 12px;
        color: ${T.text};
        font-weight: 500;
        word-break: break-all;
        max-width: 300px;
      }
      .th-preview-loading {
        padding: 20px 24px;
        font-size: 11px;
        color: ${T.textDim};
        text-align: center;
        min-width: 160px;
      }
      .th-preview-pdf-note {
        padding: 6px 12px;
        font-size: 11px;
        color: ${T.textDim};
        border-top: .5px solid ${T.border};
        background: ${T.bg};
      }
      .th-preview-btn:disabled { opacity: .7; cursor: default; }
      #th-lightbox {
        position: fixed;
        inset: 0;
        z-index: 999999;
        background: rgba(0,0,0,0.88);
        display: none;
        align-items: center;
        justify-content: center;
        flex-direction: column;
        gap: 12px;
      }
      #th-lightbox.open { display: flex; }
      #th-lightbox-img-wrap {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 16px;
        width: 100vw;
        box-sizing: border-box;
        padding: 0 16px;
      }
      /* Сцена обрезает картинку при увеличении. Картинка позиционируется
         абсолютно и центрируется через transform — так её размер можно
         задавать скриптом, не ломая раскладку соседних стрелок. */
      #th-lightbox-stage {
        flex: 1 1 auto;
        max-width: 88vw;
        height: 76vh;
        position: relative;
        overflow: hidden;
        touch-action: none;
      }
      #th-lightbox img {
        position: absolute;
        left: 50%;
        top: 50%;
        /* Размер задаёт скрипт — см. applyTransform */
        max-width: none;
        max-height: none;
        border-radius: 6px;
        box-shadow: 0 8px 40px rgba(0,0,0,0.5);
        display: block;
        transform-origin: center center;
        user-select: none;
        -webkit-user-drag: none;
      }
      #th-lightbox img.zoomed { cursor: grab; }
      #th-lightbox img.dragging { cursor: grabbing; }
      #th-lightbox-toolbar {
        display: flex;
        align-items: center;
        gap: 4px;
        padding: 5px 8px;
        border-radius: 999px;
        background: rgba(255,255,255,0.10);
        border: .5px solid rgba(255,255,255,0.22);
      }
      .th-lightbox-tool {
        width: 32px; height: 32px;
        border-radius: 50%;
        background: transparent;
        border: none;
        color: #fff;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: background .15s;
        padding: 0;
      }
      .th-lightbox-tool:hover:not(:disabled) { background: rgba(255,255,255,0.20); }
      .th-lightbox-tool:disabled { opacity: .3; cursor: default; }
      .th-lightbox-sep {
        width: 1px;
        height: 18px;
        background: rgba(255,255,255,0.22);
        margin: 0 3px;
      }
      #th-lightbox-zoom-label {
        min-width: 48px;
        padding: 5px 2px;
        border: none;
        border-radius: 6px;
        background: transparent;
        color: rgba(255,255,255,0.85);
        font-family: inherit;
        font-size: 11px;
        font-weight: 600;
        text-align: center;
        cursor: pointer;
        transition: background .15s;
      }
      #th-lightbox-zoom-label:hover { background: rgba(255,255,255,0.20); }
      .th-lightbox-arrow {
        width: 40px; height: 40px;
        border-radius: 50%;
        background: rgba(255,255,255,0.15);
        border: .5px solid rgba(255,255,255,0.3);
        color: #fff;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: background .15s;
        flex-shrink: 0;
      }
      .th-lightbox-arrow:hover { background: rgba(255,255,255,0.28); }
      .th-lightbox-arrow:disabled { opacity: 0.25; cursor: default; }
      #th-lightbox-counter {
        font-size: 12px;
        color: rgba(255,255,255,0.6);
        text-align: center;
        min-height: 16px;
      }
      #th-lightbox-close {
        position: absolute;
        top: 18px; right: 22px;
        width: 36px; height: 36px;
        border-radius: 50%;
        background: rgba(255,255,255,0.15);
        border: .5px solid rgba(255,255,255,0.3);
        color: #fff;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: background .15s;
        z-index: 1;
      }
      #th-lightbox-close:hover { background: rgba(255,255,255,0.28); }
    `);

    const ICON_FULLSCREEN = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 3 21 3 21 9"/><polyline points="9 21 3 21 3 15"/><line x1="21" y1="3" x2="14" y2="10"/><line x1="3" y1="21" x2="10" y2="14"/></svg>`;
    const ICON_NEW_TAB = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>`;
    const ICON_PDF = `<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#E24B4A" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="9" y1="13" x2="15" y2="13"/><line x1="9" y1="17" x2="15" y2="17"/></svg>`;
    const ICON_VIDEO = `<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#7C3AED" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><polygon points="5 3 19 12 5 21 5 3"/></svg>`;
    const ICON_ROTATE_LEFT = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/></svg>`;
    const ICON_ROTATE_RIGHT = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>`;
    const ICON_ZOOM_IN = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/><line x1="11" y1="8" x2="11" y2="14"/><line x1="8" y1="11" x2="14" y2="11"/></svg>`;
    const ICON_ZOOM_OUT = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/><line x1="8" y1="11" x2="14" y2="11"/></svg>`;

    const popup = document.createElement('div');
    popup.id = 'th-preview-popup';
    document.body.appendChild(popup);

    // ── Полноэкранный просмотр ───────────────────────────────────────

    const lightbox = document.createElement('div');
    lightbox.id = 'th-lightbox';

    const lbClose = document.createElement('button');
    lbClose.id = 'th-lightbox-close';
    lbClose.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`;

    const lbWrap = document.createElement('div');
    lbWrap.id = 'th-lightbox-img-wrap';

    const lbPrev = document.createElement('button');
    lbPrev.className = 'th-lightbox-arrow';
    lbPrev.innerHTML = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg>`;

    const lbImg = document.createElement('img');

    const lbNext = document.createElement('button');
    lbNext.className = 'th-lightbox-arrow';
    lbNext.innerHTML = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>`;

    const lbStage = document.createElement('div');
    lbStage.id = 'th-lightbox-stage';
    lbStage.appendChild(lbImg);

    const lbCounter = document.createElement('div');
    lbCounter.id = 'th-lightbox-counter';

    // ── Панель поворота и масштаба ───────────────────────────────────

    const toolbar = document.createElement('div');
    toolbar.id = 'th-lightbox-toolbar';

    function makeTool(title, icon) {
      const b = document.createElement('button');
      b.className = 'th-lightbox-tool';
      b.title = title;
      b.innerHTML = icon;
      return b;
    }

    const btnRotateL = makeTool('Повернуть влево на 90°', ICON_ROTATE_LEFT);
    const btnRotateR = makeTool('Повернуть вправо на 90°', ICON_ROTATE_RIGHT);
    const btnZoomOut = makeTool('Уменьшить', ICON_ZOOM_OUT);
    const btnZoomIn = makeTool('Увеличить', ICON_ZOOM_IN);

    const zoomLabel = document.createElement('button');
    zoomLabel.id = 'th-lightbox-zoom-label';
    zoomLabel.title = 'Сбросить поворот и масштаб';
    zoomLabel.textContent = '100%';

    const sep = document.createElement('div');
    sep.className = 'th-lightbox-sep';

    toolbar.appendChild(btnRotateL);
    toolbar.appendChild(btnRotateR);
    toolbar.appendChild(sep);
    toolbar.appendChild(btnZoomOut);
    toolbar.appendChild(zoomLabel);
    toolbar.appendChild(btnZoomIn);

    lbWrap.appendChild(lbPrev);
    lbWrap.appendChild(lbStage);
    lbWrap.appendChild(lbNext);
    lightbox.appendChild(lbClose);
    lightbox.appendChild(lbWrap);
    lightbox.appendChild(toolbar);
    lightbox.appendChild(lbCounter);
    document.body.appendChild(lightbox);

    let lbUrls = [];
    let lbIndex = 0;
    // Пояснение под картинкой — например, что у PDF показаны не все страницы
    let lbNote = '';

    // Состояние просмотра текущей картинки
    let rotation = 0;   // градусы, кратно 90
    let zoom = 1;       // масштаб, заданный пользователем
    let panX = 0;       // сдвиг перетаскиванием, в пикселях экрана
    let panY = 0;

    // Пересчитывает размер и положение картинки.
    //
    // Размер задаётся в вёрстке (width/height), а не через transform: scale.
    // Это принципиально для чёткости: браузер растрирует картинку один раз
    // в её вёрстанном размере, и scale потом растягивает уже готовый растр,
    // не обращаясь к оригиналу. Вписанный в экран скриншот 2400px шириной
    // растрируется, скажем, в 912px — и при увеличении мы видим растянутые
    // 912px вместо настоящих 2400px. Если же менять именно вёрстанный
    // размер, браузер каждый раз растрирует заново из полноразмерного
    // оригинала, и вся детализация файла доходит до экрана.
    //
    // Растр крупнее натурального разрешения смысла не имеет — новых деталей
    // там взяться неоткуда, а память он съедает быстро. Поэтому вёрстанный
    // размер ограничен оригиналом, а всё, что сверх него, догоняется
    // через scale.
    function applyTransform() {
      const natW = lbImg.naturalWidth;
      const natH = lbImg.naturalHeight;
      // Пока новая картинка не загрузилась, размеры относятся к предыдущей
      if (!natW || !natH || !lbImg.complete) return;

      const stageW = lbStage.clientWidth;
      const stageH = lbStage.clientHeight;
      const upright = rotation % 180 === 0;

      // Во сколько раз ужать картинку, чтобы она целиком влезла в сцену
      // с учётом поворота. Мелкие картинки не растягиваем.
      const fit = Math.min(
        1,
        stageW / (upright ? natW : natH),
        stageH / (upright ? natH : natW)
      );

      // Размер, который картинка должна занять на экране
      const dispW = natW * fit * zoom;
      const dispH = natH * fit * zoom;

      const layoutW = Math.min(dispW, natW);
      const layoutH = layoutW * natH / natW;
      const extra = layoutW > 0 ? dispW / layoutW : 1;

      lbImg.style.width = layoutW + 'px';
      lbImg.style.height = layoutH + 'px';

      // Габарит на экране с учётом поворота — по нему ограничиваем сдвиг,
      // чтобы картинку нельзя было утащить за её собственные края
      const screenW = upright ? dispW : dispH;
      const screenH = upright ? dispH : dispW;
      const maxX = Math.max(0, (screenW - stageW) / 2);
      const maxY = Math.max(0, (screenH - stageH) / 2);
      panX = Math.min(maxX, Math.max(-maxX, panX));
      panY = Math.min(maxY, Math.max(-maxY, panY));

      // Порядок важен: -50% центрирует картинку в сцене, затем сдвиг
      // считается в координатах экрана и не «переворачивается» вместе
      // с картинкой, и только потом идут поворот и остаточный масштаб.
      lbImg.style.transform =
        `translate(-50%, -50%) translate(${Math.round(panX)}px, ${Math.round(panY)}px)`
        + ` rotate(${rotation}deg) scale(${extra.toFixed(4)})`;

      lbImg.classList.toggle('zoomed', zoom > 1);
      zoomLabel.textContent = Math.round(zoom * 100) + '%';
      btnZoomOut.disabled = zoom <= CFG.zoom.min + 1e-6;
      btnZoomIn.disabled = zoom >= CFG.zoom.max - 1e-6;
      updateCounter();
    }

    function resetView() {
      rotation = 0;
      zoom = 1;
      panX = 0;
      panY = 0;
      applyTransform();
    }

    function rotateBy(delta) {
      rotation = (rotation + delta + 360) % 360;
      // После поворота картинка перекладывается заново — сдвиг от прошлой
      // ориентации оказался бы бессмысленным
      panX = 0;
      panY = 0;
      applyTransform();
    }

    // cx, cy — точка, которая должна остаться на месте, в координатах
    // относительно центра сцены. Без них масштабируем от центра.
    function setZoom(next, cx, cy) {
      const clamped = Math.min(CFG.zoom.max, Math.max(CFG.zoom.min, next));
      if (Math.abs(clamped - zoom) < 1e-6) return;
      if (cx !== undefined) {
        const k = clamped / zoom;
        panX = cx - k * (cx - panX);
        panY = cy - k * (cy - panY);
      }
      zoom = clamped;
      applyTransform();
    }

    function stageCenterOffset(e) {
      const rect = lbStage.getBoundingClientRect();
      return {
        x: e.clientX - (rect.left + rect.width / 2),
        y: e.clientY - (rect.top + rect.height / 2),
      };
    }

    // Показываем разрешение файла: сразу видно, мелкий ли это оригинал,
    // если картинка выглядит нечёткой при увеличении
    function updateCounter() {
      const parts = [];
      if (lbUrls.length > 1) parts.push(`${lbIndex + 1} / ${lbUrls.length}`);
      if (lbImg.complete && lbImg.naturalWidth) {
        parts.push(`${lbImg.naturalWidth}×${lbImg.naturalHeight}`);
      }
      if (lbNote) parts.push(lbNote);
      lbCounter.textContent = parts.join('  ·  ');
    }

    function updateLightbox() {
      lbImg.src = lbUrls[lbIndex];
      lbPrev.disabled = lbIndex === 0;
      lbNext.disabled = lbIndex === lbUrls.length - 1;
      lbPrev.style.visibility = lbUrls.length > 1 ? 'visible' : 'hidden';
      lbNext.style.visibility = lbUrls.length > 1 ? 'visible' : 'hidden';
      updateCounter();
      // Новая картинка — новый лист: поворот и масштаб сбрасываются
      resetView();
    }

    function openLightbox(urls, startIndex, note) {
      lbUrls = urls;
      lbIndex = startIndex || 0;
      lbNote = note || '';
      updateLightbox();
      lightbox.classList.add('open');
    }

    function closeLightbox() {
      lightbox.classList.remove('open');
      lbImg.src = '';
      resetView();
    }

    // Размер картинки известен только после загрузки — тогда и считаем вписывание
    lbImg.addEventListener('load', applyTransform);
    window.addEventListener('resize', () => {
      if (lightbox.classList.contains('open')) applyTransform();
    });

    lbPrev.addEventListener('click', e => {
      e.stopPropagation();
      if (lbIndex > 0) { lbIndex--; updateLightbox(); }
    });
    lbNext.addEventListener('click', e => {
      e.stopPropagation();
      if (lbIndex < lbUrls.length - 1) { lbIndex++; updateLightbox(); }
    });
    lbClose.addEventListener('click', e => { e.stopPropagation(); closeLightbox(); });

    btnRotateL.addEventListener('click', e => { e.stopPropagation(); rotateBy(-90); });
    btnRotateR.addEventListener('click', e => { e.stopPropagation(); rotateBy(90); });
    btnZoomIn.addEventListener('click', e => { e.stopPropagation(); setZoom(zoom * CFG.zoom.step); });
    btnZoomOut.addEventListener('click', e => { e.stopPropagation(); setZoom(zoom / CFG.zoom.step); });
    zoomLabel.addEventListener('click', e => { e.stopPropagation(); resetView(); });

    // ── Масштабирование колесом мыши ─────────────────────────────────

    lightbox.addEventListener('wheel', e => {
      if (!lightbox.classList.contains('open')) return;
      // Иначе прокрутится страница под лайтбоксом
      e.preventDefault();
      const { x, y } = stageCenterOffset(e);
      setZoom(e.deltaY < 0 ? zoom * CFG.zoom.step : zoom / CFG.zoom.step, x, y);
    }, { passive: false });

    // ── Перетаскивание увеличенной картинки ──────────────────────────

    let dragging = false;
    let dragMoved = false;
    let dragStart = { x: 0, y: 0, panX: 0, panY: 0 };

    lbImg.addEventListener('mousedown', e => {
      if (zoom <= 1) return;
      e.preventDefault();
      dragging = true;
      dragMoved = false;
      dragStart = { x: e.clientX, y: e.clientY, panX: panX, panY: panY };
      lbImg.classList.add('dragging');
    });

    window.addEventListener('mousemove', e => {
      if (!dragging) return;
      const dx = e.clientX - dragStart.x;
      const dy = e.clientY - dragStart.y;
      if (Math.abs(dx) > 2 || Math.abs(dy) > 2) dragMoved = true;
      panX = dragStart.panX + dx;
      panY = dragStart.panY + dy;
      applyTransform();
    });

    window.addEventListener('mouseup', () => {
      if (!dragging) return;
      dragging = false;
      lbImg.classList.remove('dragging');
    });

    lightbox.addEventListener('click', e => {
      // Если мышь отпустили за пределами картинки после перетаскивания,
      // клик всплывает до фона — закрывать лайтбокс в этом случае не нужно
      if (dragMoved) { dragMoved = false; return; }
      if (e.target === lightbox) closeLightbox();
    });

    lbImg.addEventListener('dblclick', e => { e.stopPropagation(); resetView(); });

    document.addEventListener('keydown', e => {
      if (!lightbox.classList.contains('open')) return;
      if (e.key === 'Escape') closeLightbox();
      if (e.key === 'ArrowLeft' && lbIndex > 0) { lbIndex--; updateLightbox(); }
      if (e.key === 'ArrowRight' && lbIndex < lbUrls.length - 1) { lbIndex++; updateLightbox(); }
    });

    // ── Разбор ссылок ────────────────────────────────────────────────

    function getExt(path) {
      return (path.split('?')[0].split('.').pop() || '').toLowerCase();
    }

    function getFileName(path) {
      try {
        return decodeURIComponent(path.split('?')[0].split('/').pop() || path);
      } catch (e) {
        return path.split('?')[0].split('/').pop() || path;
      }
    }

    function isImage(path) { return CFG.imageExts.includes(getExt(path)); }
    function isVideo(path) { return CFG.videoExts.includes(getExt(path)); }
    function isPdf(path) { return getExt(path) === 'pdf'; }
    function isPreviewable(path) { return isImage(path) || isPdf(path) || isVideo(path); }

    // Ссылка может вести на вьюер вида /viewer?url=<реальный путь>.
    // Тип файла определяем по реальному пути, а открываем — исходную ссылку.
    function resolveFileUrl(anchor) {
      const href = anchor.getAttribute('href') || '';
      try {
        const abs = new URL(href, window.location.origin);
        const urlParam = abs.searchParams.get('url');
        if (urlParam) return { previewUrl: href, filePath: decodeURIComponent(urlParam) };
      } catch (e) { /* относительный или битый href — используем как есть */ }
      return { previewUrl: href, filePath: href };
    }

    // ── PDF: скачать, открыть pdf.js, нарисовать страницы картинками ──

    // pdf.js подключён через @require и объявляет себя глобально. Если
    // библиотека не загрузилась, PDF показывается как раньше — иконка и имя.
    const pdfjs = (typeof pdfjsLib !== 'undefined' && pdfjsLib)
      || pageWindow.pdfjsLib || window.pdfjsLib || null;

    // url → { docPromise, pages: Map<номер, Promise<blob-URL>> }. Самый
    // старый PDF вытесняется, когда их больше CFG.pdf.cacheSize.
    const pdfCache = new Map();

    function pdfError(err) {
      const name = err && err.name;
      if (name === 'PasswordException') return 'PDF защищён паролем';
      if (name === 'InvalidPDFException') return 'файл повреждён';
      return (err && err.message) || 'не удалось открыть PDF';
    }

    async function fetchPdfBytes(url) {
      let r;
      try {
        r = await fetch(url, { credentials: 'same-origin' });
      } catch (err) {
        throw new Error('нет связи с сервером');
      }
      if (!r.ok) throw new Error(`сервер ответил ${r.status}`);
      const declared = Number(r.headers.get('content-length')) || 0;
      if (declared > CFG.pdf.maxBytes) throw new Error('файл слишком большой для превью');
      const bytes = new Uint8Array(await r.arrayBuffer());
      if (bytes.length > CFG.pdf.maxBytes) throw new Error('файл слишком большой для превью');
      // Сигнатура %PDF должна быть в начале файла. Если пришла страница
      // (например, вход в админку после истёкшей сессии) — это не PDF.
      const head = String.fromCharCode.apply(null, bytes.subarray(0, 1024));
      if (head.indexOf('%PDF') === -1) throw new Error('вместо PDF пришло что-то другое — возможно, истекла сессия');
      return bytes;
    }

    function getPdfEntry(url) {
      let entry = pdfCache.get(url);
      if (entry) {
        // Свежий доступ — в конец очереди на вытеснение
        pdfCache.delete(url);
        pdfCache.set(url, entry);
        return entry;
      }
      entry = { pages: new Map(), docPromise: null };
      entry.docPromise = fetchPdfBytes(url).then(data => pdfjs.getDocument({
        data,
        // Закрывает CVE-2024-4367: без этого специально собранный шрифт
        // в PDF может выполнить код. Файлы приходят от пользователей.
        isEvalSupported: false,
        verbosity: 0,
      }).promise);
      // Неудачную загрузку не запоминаем — при следующем наведении попробуем снова
      entry.docPromise.catch(() => { if (pdfCache.get(url) === entry) pdfCache.delete(url); });
      pdfCache.set(url, entry);

      while (pdfCache.size > CFG.pdf.cacheSize) {
        const [oldUrl, old] = pdfCache.entries().next().value;
        pdfCache.delete(oldUrl);
        old.docPromise.then(doc => doc.destroy()).catch(() => {});
        old.pages.forEach(p => p.then(u => URL.revokeObjectURL(u)).catch(() => {}));
      }
      return entry;
    }

    async function renderPdfPage(doc, n) {
      const page = await doc.getPage(n);
      const base = page.getViewport({ scale: 1 });
      let scale = Math.min(CFG.pdf.maxScale, Math.max(1, CFG.pdf.renderWidth / base.width));
      const area = base.width * base.height * scale * scale;
      if (area > CFG.pdf.maxPixels) scale *= Math.sqrt(CFG.pdf.maxPixels / area);
      const viewport = page.getViewport({ scale });

      const canvas = document.createElement('canvas');
      canvas.width = Math.ceil(viewport.width);
      canvas.height = Math.ceil(viewport.height);
      const ctx = canvas.getContext('2d');
      // Белый фон: у некоторых PDF страница прозрачная
      ctx.fillStyle = '#fff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      await page.render({ canvasContext: ctx, viewport }).promise;
      page.cleanup();

      const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
      canvas.width = 0;
      canvas.height = 0;
      if (!blob) throw new Error('не удалось нарисовать страницу');
      return URL.createObjectURL(blob);
    }

    function getPdfPage(entry, doc, n) {
      if (!entry.pages.has(n)) {
        const p = renderPdfPage(doc, n);
        p.catch(() => entry.pages.delete(n));
        entry.pages.set(n, p);
      }
      return entry.pages.get(n);
    }

    async function openPdfFullscreen(url) {
      const entry = getPdfEntry(url);
      const doc = await entry.docPromise;
      const count = Math.min(doc.numPages, CFG.pdf.maxPages);
      const urls = [];
      for (let n = 1; n <= count; n++) urls.push(await getPdfPage(entry, doc, n));
      const note = doc.numPages > count ? `показаны первые ${count} из ${doc.numPages} стр.` : '';
      openLightbox(urls, 0, note);
    }

    function pageWord(n) {
      const n10 = n % 10, n100 = n % 100;
      if (n10 === 1 && n100 !== 11) return 'страница';
      if (n10 >= 2 && n10 <= 4 && (n100 < 10 || n100 >= 20)) return 'страницы';
      return 'страниц';
    }

    // Все картинки из той же ячейки — чтобы листать их в полноэкранном режиме
    function getCellImageUrls(anchor) {
      const td = anchor.closest('td');
      if (!td) return [];
      return Array.from(td.querySelectorAll('a'))
        .map(a => resolveFileUrl(a))
        .filter(({ filePath }) => isImage(filePath))
        .map(({ previewUrl }) => previewUrl);
    }

    // ── Сборка попапа ────────────────────────────────────────────────

    // onFullscreen: true — листать картинки ячейки, функция — своё
    // действие (у PDF — его страницы), иначе кнопки Fullscreen нет
    function makeActions(anchor, previewUrl, onFullscreen) {
      const bar = document.createElement('div');
      bar.className = 'th-preview-actions';

      if (onFullscreen) {
        const btnFull = document.createElement('button');
        btnFull.className = 'th-preview-btn th-preview-btn-full';
        btnFull.innerHTML = `${ICON_FULLSCREEN} Fullscreen`;
        btnFull.addEventListener('click', e => {
          e.stopPropagation();
          if (typeof onFullscreen === 'function') {
            onFullscreen(btnFull);
            return;
          }
          const urls = getCellImageUrls(anchor);
          const startIdx = urls.indexOf(previewUrl);
          openLightbox(urls.length ? urls : [previewUrl], startIdx >= 0 ? startIdx : 0);
        });
        bar.appendChild(btnFull);
      }

      const btnTab = document.createElement('a');
      btnTab.className = 'th-preview-btn';
      btnTab.href = previewUrl;
      btnTab.target = '_blank';
      btnTab.rel = 'noopener noreferrer';
      btnTab.innerHTML = `${ICON_NEW_TAB} Open in new tab`;
      bar.appendChild(btnTab);

      return bar;
    }

    function makeFileRow(icon, fileName) {
      const wrap = document.createElement('div');
      wrap.className = 'th-preview-file-wrap';
      wrap.innerHTML = icon;
      const name = document.createElement('span');
      name.className = 'th-preview-file-name';
      name.textContent = fileName;
      wrap.appendChild(name);
      return wrap;
    }

    let currentHref = null;
    let currentAnchor = null;
    let hideTimer = null;
    // Счётчик поколений: если мышь ушла на другую ссылку, пока грузилась картинка,
    // её onload не должен подставить чужое изображение в попап.
    let loadGeneration = 0;

    function positionPopup() {
      if (!currentAnchor) return;
      const rect = currentAnchor.getBoundingClientRect();
      const popW = popup.offsetWidth || CFG.maxWidth;
      const popH = popup.offsetHeight || 300;

      // Пробуем справа от ссылки, если не влезает — слева
      let left = rect.right + 12;
      if (left + popW > window.innerWidth - 12) left = rect.left - popW - 12;

      const pos = clampToViewport(left, rect.top, popW, popH, 12);
      popup.style.left = pos.left + 'px';
      popup.style.top = pos.top + 'px';
    }

    function buildPopup(anchor) {
      popup.innerHTML = '';
      const { previewUrl, filePath } = resolveFileUrl(anchor);

      if (isImage(filePath)) {
        popup.appendChild(makeActions(anchor, previewUrl, true));

        const loading = document.createElement('div');
        loading.className = 'th-preview-loading';
        loading.textContent = 'Loading...';
        popup.appendChild(loading);

        const myGeneration = ++loadGeneration;
        const img = new Image();
        img.onload = () => {
          if (myGeneration !== loadGeneration) return;
          loading.remove();
          popup.appendChild(img);
          positionPopup();
        };
        img.onerror = () => {
          if (myGeneration !== loadGeneration) return;
          loading.textContent = 'Не удалось загрузить файл';
        };
        img.src = previewUrl;

      } else if (isPdf(filePath) && pdfjs) {
        const myGeneration = ++loadGeneration;

        const onFullscreen = (btn) => {
          if (btn.disabled) return;
          btn.disabled = true;
          const label = btn.innerHTML;
          btn.textContent = 'Loading...';
          openPdfFullscreen(previewUrl)
            .catch(err => {
              if (myGeneration !== loadGeneration) return;
              note.textContent = `Не удалось открыть PDF: ${pdfError(err)}`;
              if (!note.isConnected) popup.appendChild(note);
              positionPopup();
            })
            .finally(() => { btn.disabled = false; btn.innerHTML = label; });
        };
        const bar = makeActions(anchor, previewUrl, onFullscreen);
        popup.appendChild(bar);

        const loading = document.createElement('div');
        loading.className = 'th-preview-loading';
        loading.textContent = 'Loading PDF...';
        popup.appendChild(loading);
        const note = document.createElement('div');
        note.className = 'th-preview-pdf-note';

        const entry = getPdfEntry(previewUrl);
        entry.docPromise
          .then(doc => {
            // Мышь уже ушла на другую ссылку — страницу не рисуем, но
            // скачанный файл остаётся в кэше на следующее наведение
            if (myGeneration !== loadGeneration) return null;
            return getPdfPage(entry, doc, 1).then(url => ({ url, total: doc.numPages }));
          })
          .then(res => {
            if (!res || myGeneration !== loadGeneration) return;
            const img = new Image();
            img.onload = () => {
              if (myGeneration !== loadGeneration) return;
              loading.replaceWith(img);
              note.textContent = res.total > 1
                ? `PDF · ${res.total} ${pageWord(res.total)} — все в Fullscreen`
                : 'PDF · 1 страница';
              popup.appendChild(note);
              positionPopup();
            };
            img.onerror = () => {
              if (myGeneration !== loadGeneration) return;
              loading.textContent = 'Не удалось показать страницу';
            };
            img.src = res.url;
          })
          .catch(err => {
            if (myGeneration !== loadGeneration) return;
            // Превью не вышло — показываем как раньше: иконка и имя файла,
            // плюс причина. Fullscreen без страниц не нужен.
            const fallbackBar = makeActions(anchor, previewUrl, false);
            bar.replaceWith(fallbackBar);
            loading.replaceWith(makeFileRow(ICON_PDF, getFileName(filePath)));
            note.textContent = `Превью недоступно: ${pdfError(err)}`;
            popup.appendChild(note);
            positionPopup();
          });

      } else if (isPdf(filePath)) {
        popup.appendChild(makeActions(anchor, previewUrl, false));
        popup.appendChild(makeFileRow(ICON_PDF, getFileName(filePath)));

      } else if (isVideo(filePath)) {
        popup.appendChild(makeActions(anchor, previewUrl, false));
        popup.appendChild(makeFileRow(ICON_VIDEO, getFileName(filePath)));
      }
    }

    function showPopup(anchor) {
      const href = anchor.getAttribute('href') || '';
      if (!href) return;
      const { filePath } = resolveFileUrl(anchor);
      if (!isPreviewable(filePath)) return;

      clearTimeout(hideTimer);
      currentAnchor = anchor;

      if (href !== currentHref) {
        currentHref = href;
        buildPopup(anchor);
        positionPopup();
      }

      popup.classList.add('visible');
    }

    function hidePopup() {
      hideTimer = setTimeout(() => {
        popup.classList.remove('visible');
        loadGeneration++;
        currentHref = null;
        currentAnchor = null;
        setTimeout(() => {
          if (!popup.classList.contains('visible')) popup.innerHTML = '';
        }, 150);
      }, CFG.hideDelay);
    }

    // Пока мышь на самом попапе — не прячем, иначе до кнопок не дойти
    popup.addEventListener('mouseenter', () => clearTimeout(hideTimer));
    popup.addEventListener('mouseleave', hidePopup);

    document.addEventListener('mouseover', e => {
      const anchor = e.target instanceof Element ? e.target.closest('td a') : null;
      if (anchor) showPopup(anchor);
    });

    document.addEventListener('mouseout', e => {
      const anchor = e.target instanceof Element ? e.target.closest('td a') : null;
      if (anchor) hidePopup();
    });

    log('Превью вложений включено');
  }

  // ==================================================================
  // 2. ТУЛТИП «ПРЕДЫДУЩИЙ СТАТУС» И «В РАБОТЕ У»
  // ==================================================================

  function initPrevStatus() {
    const CFG = CONFIG.prevStatus;
    const TRIGGERS = new Set(CFG.triggers.map(s => s.trim().toLowerCase()));
    const IN_WORK = new Set((CFG.inWorkTriggers || []).map(s => s.trim().toLowerCase()));

    addStyle('th-helper-prevstatus-style', `
      #th-prevstatus-tt {
        position: fixed;
        z-index: 100000;
        max-width: 260px;
        background: ${T.bg};
        border: .5px solid ${T.border};
        border-radius: 8px;
        padding: 8px 11px;
        font-size: 11px;
        line-height: 1.5;
        color: ${T.text};
        box-shadow: ${T.shadow};
        opacity: 0;
        pointer-events: none;
        transition: opacity .12s;
      }
      #th-prevstatus-tt.show { opacity: 1; }
      #th-prevstatus-tt .th-pst-label {
        font-size: 9.5px;
        text-transform: uppercase;
        letter-spacing: .05em;
        color: ${T.textDim};
        margin-bottom: 3px;
      }
      #th-prevstatus-tt .th-pst-value {
        font-weight: 600;
        color: ${T.textStrong};
      }
    `);

    const tt = document.createElement('div');
    tt.id = 'th-prevstatus-tt';
    document.body.appendChild(tt);

    // ticketId -> { at, promise: Promise<записи истории | null> }.
    // Запись живёт CFG.cacheTtl — см. комментарий в CONFIG.
    const cache = new Map();

    const LABELS = { prev: 'Предыдущий статус', inWork: 'В работе у' };

    function render(mode, valueHtml) {
      tt.innerHTML =
        `<div class="th-pst-label">${LABELS[mode]}</div>` +
        `<div class="th-pst-value">${valueHtml}</div>`;
    }

    function escapeHtml(s) {
      return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    }

    // История идёт от новых к старым: находим запись о закрытии
    // и берём следующую за ней — это и есть статус до закрытия.
    function pickPrev(list) {
      const idx = list.findIndex(r => TRIGGERS.has((r.nameExternalStatus || '').trim().toLowerCase()));
      if (idx === -1 || idx + 1 >= list.length) return null;
      return list[idx + 1].nameExternalStatus || '—';
    }

    // Кто в работе — Admin username из самой свежей записи (верхняя
    // строка в окне «История тикета», колонка с ключом adminProcessedLogin).
    function pickInWork(list) {
      const latest = list[0];
      if (!latest) return null;
      return String(latest.adminProcessedLogin || '').trim() || 'Не указан';
    }

    function fetchHistory(ticketId) {
      const hit = cache.get(ticketId);
      if (hit && Date.now() - hit.at < CFG.cacheTtl) return hit.promise;

      const p = fetch(CFG.historyUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json, text/plain, */*',
          'X-Requested-With': 'XMLHttpRequest',
        },
        credentials: 'same-origin',
        body: JSON.stringify({ ticketId: Number(ticketId), is_iframe: 1 }),
      })
        .then(r => r.json())
        .then(json => (Array.isArray(json && json.data) ? json.data : []))
        .catch(err => {
          log('Не удалось получить историю тикета', ticketId, err);
          return null;
        });

      cache.set(ticketId, { at: Date.now(), promise: p });
      return p;
    }

    // Индексы колонок в конкретной таблице
    function getColumnIndexes(table) {
      const headers = Array.from(table.querySelectorAll('thead th'));
      return {
        status: headers.findIndex(h => h.innerText.trim().toLowerCase() === 'external status'),
        ticket: headers.findIndex(h => h.innerText.trim().toLowerCase().includes('ticket id')),
      };
    }

    let hideTimer = null;
    let currentTicket = null;

    document.addEventListener('mouseover', e => {
      const td = e.target instanceof Element ? e.target.closest('td') : null;
      if (!td) return;

      const table = td.closest('table');
      const row = td.closest('tr');
      if (!table || !row) return;

      const cols = getColumnIndexes(table);
      if (cols.status === -1 || cols.ticket === -1) return;
      if (td.cellIndex !== cols.status) return;

      const statusText = ((td.querySelector('span') || {}).innerText || td.innerText || '').trim().toLowerCase();
      const mode = TRIGGERS.has(statusText) ? 'prev' : IN_WORK.has(statusText) ? 'inWork' : null;
      if (!mode) return;

      const ticketCell = row.querySelectorAll('td')[cols.ticket];
      if (!ticketCell) return;
      const ticketId = ((ticketCell.querySelector('span') || {}).innerText || ticketCell.innerText || '').trim();
      if (!ticketId) return;

      clearTimeout(hideTimer);
      currentTicket = ticketId;

      render(mode, 'Загрузка…');
      tt.classList.add('show');
      placeNearCursor(tt, e.clientX, e.clientY);

      fetchHistory(ticketId).then(list => {
        // Пока грузилось, мышь могла уйти на другой тикет
        if (currentTicket !== ticketId) return;
        const result = list && (mode === 'prev' ? pickPrev(list) : pickInWork(list));
        if (result) {
          render(mode, escapeHtml(result));
        } else {
          render(mode, 'Не найдено');
        }
        placeNearCursor(tt, e.clientX, e.clientY);
      });
    });

    document.addEventListener('mousemove', e => {
      if (tt.classList.contains('show')) placeNearCursor(tt, e.clientX, e.clientY);
    });

    document.addEventListener('mouseout', e => {
      const td = e.target instanceof Element ? e.target.closest('td') : null;
      if (!td) return;
      hideTimer = setTimeout(() => {
        tt.classList.remove('show');
        currentTicket = null;
      }, CFG.hideDelay);
    });

    log('Тултип «Предыдущий статус» включён для статусов:', CFG.triggers.join(', '),
      '| «В работе у» —', (CFG.inWorkTriggers || []).join(', '));
  }

  // ==================================================================
  // 3. АВТОПОДСТАНОВКА ДИАПАЗОНА ДАТ
  // ==================================================================

  function initAutoDateRange() {
    const CFG = CONFIG.autoDateRange;

    function pad(n) { return String(n).padStart(2, '0'); }

    function fmt(d) {
      return `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
    }

    // «Примерно год назад → сегодня». Дата «от» — точка «год назад» плюс
    // случайный сдвиг вперёд из CFG.shiftDays; новый сдвиг на каждое
    // нажатие Apply. Минимальный сдвиг в 1 день заодно гарантирует, что
    // диапазон не выйдет за годовое окно.
    function getDateRange() {
      const now = new Date();

      const end = new Date(now);
      end.setHours(CFG.endTime[0], CFG.endTime[1], 0, 0);

      const [minShift, maxShift] = CFG.shiftDays;
      const shift = minShift + Math.floor(Math.random() * (maxShift - minShift + 1));

      const start = new Date(now);
      start.setFullYear(start.getFullYear() - CFG.yearsBack);
      start.setDate(start.getDate() + shift);
      start.setHours(CFG.startTime[0], CFG.startTime[1], 0, 0);

      return `${fmt(start)} ~ ${fmt(end)}`;
    }

    function findDateInput() {
      return document.querySelector('.mx-datepicker-range .mx-input')
        || document.querySelector('.mx-datepicker .mx-input')
        || document.querySelector('input.mx-input[name="date"]')
        || document.querySelector('input.mx-input');
    }

    // Значение ставим нативным сеттером — иначе Vue не заметит изменение
    function setDatepickerValue(input, value) {
      const nativeSetter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
      nativeSetter.call(input, value);
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.dispatchEvent(new Event('change', { bubbles: true }));
    }

    function trySetDate() {
      const input = findDateInput();
      if (!input) return false;
      const value = getDateRange();
      setDatepickerValue(input, value);
      log('Диапазон дат подставлен:', value);
      return true;
    }

    // Кнопка Apply в модалке сохранённых фильтров
    function isApplyButton(el) {
      if (!el) return false;
      const isSuccess = el.classList.contains('btn-success');
      const isSubmit = el.type === 'submit';
      const textMatch = el.textContent.trim() === 'Apply';
      const inModal = !!el.closest('.modal_content, .wrap-white');
      return isSuccess && (isSubmit || textMatch) && inModal;
    }

    document.addEventListener('click', e => {
      const btn = e.target instanceof Element ? e.target.closest('button') : null;
      if (!isApplyButton(btn)) return;

      log('Нажат Apply — ждём перерисовку фильтров');

      setTimeout(() => {
        if (trySetDate()) return;
        // Поле ещё не отрисовано — пробуем, пока не появится
        const interval = setInterval(() => {
          if (trySetDate()) clearInterval(interval);
        }, CFG.retryInterval);
        setTimeout(() => clearInterval(interval), CFG.retryTimeout);
      }, CFG.applyDelay);
    }, true);

    log('Автоподстановка дат включена');
  }

  // ==================================================================
  // 4. ПОДСТАНОВКА REDDY ID
  // ==================================================================

  // Хранилище Tampermonkey переживает обновления скрипта и общее для всех
  // трёх доменов. Откат на localStorage нужен только для отладки вне
  // расширения, где GM-функций нет.
  const store = {
    get(key, fallback) {
      if (typeof GM_getValue === 'function') return GM_getValue(key, fallback);
      const v = localStorage.getItem('web-helper:' + key);
      return v === null ? fallback : v;
    },
    set(key, value) {
      if (typeof GM_setValue === 'function') { GM_setValue(key, value); return; }
      localStorage.setItem('web-helper:' + key, value);
    },
  };

  // Буфер обмена — используется несколькими независимо переключаемыми
  // функциями (копирование данных тикета, копирование значения ячейки),
  // поэтому вынесено сюда, а не дублируется в каждой из них.
  function copyTextFallback(text) {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.cssText = 'position:fixed;top:-1000px;left:-1000px;opacity:0;';
    document.body.appendChild(ta);
    ta.select();
    try { document.execCommand('copy'); } catch (err) { /* браузер запретил — текст остаётся в поле */ }
    ta.remove();
  }

  function copyText(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      return navigator.clipboard.writeText(text).catch(() => copyTextFallback(text));
    }
    return Promise.resolve(copyTextFallback(text));
  }

  function initMessengerId() {
    const CFG = CONFIG.messengerId;

    // Reddy ID лежит в серверной разметке страницы на компоненте leftpanel.
    // К моменту запуска скрипта Vue уже заменил этот элемент собой,
    // поэтому из DOM атрибут не достать — забираем исходный HTML страницы.
    function fetchIdFromPage() {
      return fetch(location.href, { credentials: 'same-origin' })
        .then(r => r.text())
        .then(html => {
          const m = html.match(new RegExp(CFG.sourceAttr + '="([^"]*)"'));
          return m && m[1] ? m[1].trim() : null;
        })
        .catch(err => {
          log('Не удалось получить ID со страницы', err);
          return null;
        });
    }

    // Один раз найденный ID сохраняется, дальше берётся из хранилища
    // мгновенно и без запроса.
    let idPromise = null;
    function resolveId() {
      const saved = store.get(CFG.storageKey, '');
      if (saved) return Promise.resolve(saved);
      if (!idPromise) {
        idPromise = fetchIdFromPage().then(id => {
          if (id) {
            store.set(CFG.storageKey, id);
            log('Reddy ID определён со страницы:', id);
          } else {
            // Пустой профиль или другая разметка: пусть попробует снова,
            // а оператор при желании задаст ID через меню расширения
            idPromise = null;
            log('Reddy ID на странице не найден, задайте его через меню Tampermonkey');
          }
          return id;
        });
      }
      return idPromise;
    }

    // Пункт меню нужен на случай, когда в профиле Reddy не заполнен
    // или ID надо поменять руками (например, чтобы временно подставлять
    // чужой ID вместо своего).
    if (typeof GM_registerMenuCommand === 'function') {
      GM_registerMenuCommand('Web Helper: мой Reddy ID', () => {
        const current = store.get(CFG.storageKey, '');
        const next = prompt(
          'Reddy ID для подстановки.\n'
          + 'Оставьте поле пустым, чтобы скрипт определил его со страницы заново.',
          current
        );
        if (next === null) return;
        store.set(CFG.storageKey, next.trim());
        idPromise = null;
        alert(next.trim()
          ? 'Reddy ID сохранён: ' + next.trim()
          : 'Reddy ID очищен, он будет определён со страницы автоматически.');
      });
    }

    // Прогреваем значение заранее, чтобы подстановка была мгновенной
    resolveId();

    // ── Подстановка в модалку SweetAlert2 ─────────────────────────────
    //
    // Поле не имеет id/name, поэтому ищем его по классу и плейсхолдеру —
    // это устойчиво к тому, какая именно кнопка открыла модалку.
    // Заполняем только если поле пустое: если оператор уже что-то ввёл
    // (например, чтобы отправить файл коллеге), скрипт это не трогает.
    // Флаг на самом элементе защищает от повторной обработки одного и
    // того же поля при последующих срабатываниях наблюдателя, а новая
    // модалка каждый раз создаёт новый DOM-элемент, так что для неё
    // подстановка сработает снова.
    function trySubstituteField(input) {
      if (input.dataset.thFilled) return;
      if (input.value.trim()) { input.dataset.thFilled = '1'; return; }
      resolveId().then(id => {
        if (!id) return;
        if (input.dataset.thFilled) return;
        if (!document.body.contains(input)) return; // модалку уже закрыли
        if (input.value.trim()) { input.dataset.thFilled = '1'; return; }
        const nativeSetter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
        nativeSetter.call(input, id);
        input.dispatchEvent(new Event('input', { bubbles: true }));
        input.dispatchEvent(new Event('change', { bubbles: true }));
        input.dataset.thFilled = '1';
        log('Reddy ID подставлен в поле:', id);
      });
    }

    const fieldSelector = `input.swal2-input[placeholder="${CFG.fieldPlaceholder}"]`;
    new MutationObserver(() => {
      const input = document.querySelector(fieldSelector);
      if (input) trySubstituteField(input);
    }).observe(document.body, { childList: true, subtree: true });

    log('Подстановка Reddy ID включена');
  }

  // ==================================================================
  // 5. КНОПКИ ВМЕСТО ССЫЛОК НА ФАЙЛЫ
  // ==================================================================

  function initFileButtons() {
    const CFG = CONFIG.fileButtons;

    addStyle('th-helper-filebtn-style', `
      .th-file-cell { white-space: normal !important; }

      a.th-file-btn {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        box-sizing: border-box;
        width: 80px;
        min-height: 30px;
        margin: 2px 3px 2px 0;
        padding: 3px 5px;
        border-radius: 6px;
        background: ${ACCENT};
        color: #fff !important;
        font-size: 11px;
        font-weight: 600;
        line-height: 1.2;
        text-decoration: none !important;
        white-space: nowrap;
        cursor: pointer;
        transition: background .12s;
      }
      a.th-file-btn:hover { background: ${ACCENT_HOVER}; }
      a.th-file-btn.th-file-btn--pdf { background: #D97706; }
      a.th-file-btn.th-file-btn--pdf:hover { background: #B45309; }
      a.th-file-btn.th-file-btn--video { background: #8957E5; }
      a.th-file-btn.th-file-btn--video:hover { background: #7A46D6; }
      a.th-file-btn.th-file-btn--other { background: #DA3633; }
      a.th-file-btn.th-file-btn--other:hover { background: #B92E2A; }
    `);

    // Заголовки приходят с разным регистром, лишними пробелами и разными
    // апострофами (Agent's files / Agent’s files) — сравниваем по
    // нормализованному виду. Неразрывный пробел отдельно обрабатывать не
    // нужно: \s в JS его уже покрывает.
    function normHeader(text) {
      return (text || '')
        .replace(/[’‘`´]/g, "'")
        .replace(/\s+/g, ' ')
        .trim()
        .toLowerCase();
    }

    // Возвращает набор индексов колонок с файлами. В этой админке шапка
    // бывает и в <thead>, и в <tr class="table-head"> — учитываем оба.
    function getFileColIndexes(table) {
      const headers = Array.from(table.querySelectorAll('tr.table-head th, thead th'));
      const indexes = new Set();
      headers.forEach((h, i) => {
        if (CFG.columns.includes(normHeader(h.textContent))) indexes.add(i);
      });
      return indexes;
    }

    // Ссылка ведёт на вьюер вида /admin/amazon/?url=<реальный путь>.
    // Тип файла и имя определяем по реальному пути, а href не трогаем.
    function resolveFilePath(anchor) {
      const href = anchor.getAttribute('href') || '';
      try {
        const abs = new URL(href, window.location.origin);
        const urlParam = abs.searchParams.get('url');
        if (urlParam) return urlParam.split('?')[0];
        return decodeURIComponent(abs.pathname);
      } catch (e) {
        return href.split('?')[0];
      }
    }

    function getExt(path) {
      const name = path.split('/').pop() || '';
      const m = name.match(/\.([a-z0-9]+)$/i);
      return m ? m[1].toLowerCase() : '';
    }

    function typeForExt(ext) {
      for (const label of Object.keys(CFG.types)) {
        if (CFG.types[label].exts.includes(ext)) return { label, kind: CFG.types[label].kind };
      }
      return { label: CFG.fallbackLabel, kind: CFG.fallbackKind };
    }

    // Флаг на самой ссылке защищает от повторной обработки: без него
    // наблюдатель переписывал бы «1. Скрин» в «1. 1. Скрин» и вызывал
    // новые мутации по кругу.
    function decorate(anchor, number) {
      if (anchor.dataset.thFileBtn) return;

      const path = resolveFilePath(anchor);
      const fileName = path.split('/').pop() || path;
      const { label, kind } = typeForExt(getExt(path));

      anchor.textContent = `${number}. ${label}`;
      anchor.title = fileName ? `Открыть: ${fileName}` : 'Открыть файл';
      anchor.target = '_blank';
      anchor.rel = 'noopener noreferrer';
      anchor.classList.add('th-file-btn', `th-file-btn--${kind}`);
      anchor.dataset.thFileBtn = '1';
    }

    function fileAnchors(cell) {
      return Array.from(cell.querySelectorAll('a[href]')).filter(a => {
        const href = a.getAttribute('href') || '';
        return href && !href.toLowerCase().startsWith('javascript:');
      });
    }

    function processTable(table) {
      const cols = getFileColIndexes(table);
      if (!cols.size) return;

      table.querySelectorAll('tr').forEach(row => {
        Array.from(row.children).forEach(cell => {
          if (cell.tagName !== 'TD' || !cols.has(cell.cellIndex)) return;
          const anchors = fileAnchors(cell);
          if (!anchors.length) return;
          cell.classList.add('th-file-cell');
          // Нумерация идёт по порядку ссылок в ячейке, чтобы номера на
          // кнопках совпадали с тем, что оператор видит слева направо.
          anchors.forEach((a, i) => decorate(a, i + 1));
        });
      });
    }

    function processAll() {
      document.querySelectorAll('table').forEach(processTable);
    }

    processAll();
    new MutationObserver(processAll).observe(document.body, { childList: true, subtree: true });

    log('Кнопки вместо ссылок на файлы включены');
  }

  // ==================================================================
  // 6. КОПИРОВАНИЕ ЗНАЧЕНИЯ ЯЧЕЙКИ
  // ==================================================================

  function initCellCopy() {
    addStyle('th-helper-cellcopy-style', `
      .th-cc-cell {
        cursor: pointer;
        transition: background-color .15s;
      }
      .th-cc-cell.th-cc-copied {
        background-color: rgba(63, 185, 80, 0.18);
      }
    `);

    // Только ячейки с обычным текстом — ячейки со своими ссылками/кнопками
    // (Ticket history, файлы) пропускаем: копировать там нечего или
    // непонятно что
    function isPlainCell(cell) {
      if (cell.querySelector('a, button')) return false;
      return !!cell.textContent.trim();
    }

    function processCellsTable(table) {
      table.querySelectorAll('tbody tr').forEach(row => {
        Array.from(row.children).forEach(cell => {
          if (cell.tagName !== 'TD' || cell.dataset.thCellCopyInjected) return;
          cell.dataset.thCellCopyInjected = '1';
          if (!isPlainCell(cell)) return;
          cell.classList.add('th-cc-cell');
          let copiedTimer = null;
          let pendingClickTimer = null;

          function doCopy() {
            // Не мешаем ручному выделению части текста (drag-select или
            // слово двойным кликом) — если к моменту срабатывания есть
            // активное выделение, ничего не копируем
            if (window.getSelection().toString()) return;
            const value = cell.textContent.trim();
            if (!value) return;
            copyText(value).then(() => {
              cell.classList.add('th-cc-copied');
              if (copiedTimer) clearTimeout(copiedTimer);
              copiedTimer = setTimeout(() => cell.classList.remove('th-cc-copied'), 900);
            });
          }

          cell.addEventListener('click', (e) => {
            // Второй/третий клик серии — за отмену уже отвечает dblclick
            if (e.detail > 1) return;
            // Ждём: если это первый клик двойного клика (выделение
            // слова), dblclick отменит копирование раньше, чем сработает
            // таймер
            clearTimeout(pendingClickTimer);
            pendingClickTimer = setTimeout(doCopy, 300);
          });
          cell.addEventListener('dblclick', () => clearTimeout(pendingClickTimer));
        });
      });
    }

    function processAllCells() {
      document.querySelectorAll('table').forEach(processCellsTable);
    }

    processAllCells();
    new MutationObserver(processAllCells).observe(document.body, { childList: true, subtree: true });

    log('Копирование значения ячейки по клику включено');
  }

  // ==================================================================
  // 7. ОБМЕН СОХРАНЁННЫМИ ФИЛЬТРАМИ
  // ==================================================================

  // Сайт хранит сохранённые фильтры на сервере, по пользователю и странице.
  // Поделиться ими штатно нельзя — коллеге приходится заново выставлять
  // все поля. Здесь фильтр берётся из того же списка, что видит окно
  // «Saved filters», упаковывается в текстовый код, а у коллеги сохраняется
  // тем же запросом, которым сайт сохраняет фильтр по кнопке «Save filter».
  // В фильтре лежат внутренние номера (агентов, отделов, статусов) и набор
  // колонок, поэтому язык сайта у отправителя и получателя роли не играет.
  function initFilterShare() {
    const CFG = CONFIG.filterShare;

    addStyle('th-helper-filtershare-style', `
      .th-fs-open-btn svg { display: block; }

      #th-fs-overlay {
        position: fixed;
        inset: 0;
        z-index: 999999;
        background: rgba(0,0,0,0.5);
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 24px;
        box-sizing: border-box;
      }
      #th-fs-modal {
        width: 520px;
        max-width: 100%;
        max-height: 90vh;
        display: flex;
        flex-direction: column;
        overflow: hidden;
        background: ${T.bg};
        border: 1px solid ${T.border};
        border-radius: 10px;
        box-shadow: ${T.shadow};
        font-family: "Open Sans", Tahoma, Arial, sans-serif;
        font-size: 12px;
        color: ${T.text};
      }
      #th-fs-header {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 12px 16px;
        background: linear-gradient(135deg, ${ACCENT} 0%, ${ACCENT_HOVER} 100%);
        flex-shrink: 0;
      }
      #th-fs-header-icon {
        width: 26px; height: 26px;
        border-radius: 6px;
        background: rgba(255,255,255,0.2);
        display: flex; align-items: center; justify-content: center;
        flex-shrink: 0;
      }
      #th-fs-header-text { flex: 1; min-width: 0; }
      #th-fs-title { font-size: 13px; font-weight: 700; color: #fff; line-height: 1.3; }
      #th-fs-subtitle {
        font-size: 10.5px; color: rgba(255,255,255,0.8); margin-top: 2px;
        white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
      }
      #th-fs-close {
        border: none; background: transparent; color: rgba(255,255,255,0.85);
        font-size: 18px; line-height: 1; cursor: pointer; padding: 0 4px;
      }
      #th-fs-close:hover { color: #fff; }

      .th-fs-tabs { display: flex; border-bottom: 1px solid ${T.border}; flex-shrink: 0; }
      .th-fs-tab {
        flex: 1; padding: 9px 12px; border: none; border-bottom: 2px solid transparent;
        background: ${T.panel}; color: ${T.textDim};
        font-family: inherit; font-size: 12px; font-weight: 600; cursor: pointer;
      }
      .th-fs-tab.active { background: ${T.bg}; color: ${ACCENT}; border-bottom-color: ${ACCENT}; }

      .th-fs-pane {
        display: none; flex-direction: column; gap: 10px;
        padding: 14px 16px; overflow-y: auto; min-height: 0;
      }
      .th-fs-pane.active { display: flex; }
      .th-fs-hint { color: ${T.textDim}; font-size: 11px; line-height: 1.5; }
      .th-fs-state { color: ${T.textDim}; font-style: italic; }
      .th-fs-error, .th-fs-ok, .th-fs-warn {
        padding: 8px 11px; border-radius: 6px; font-size: 11px; line-height: 1.5;
      }
      .th-fs-error { background: rgba(226,75,74,0.08); border: 1px solid rgba(226,75,74,0.35); color: #E24B4A; }
      .th-fs-ok { background: rgba(63,185,80,0.10); border: 1px solid rgba(63,185,80,0.40); color: #3fb950; }
      .th-fs-warn { background: rgba(217,119,6,0.08); border: 1px solid rgba(217,119,6,0.35); color: #D97706; }

      .th-fs-selectall {
        display: flex; align-items: center; gap: 8px;
        color: ${T.textDim}; font-size: 11px; cursor: pointer;
      }
      .th-fs-list {
        display: flex; flex-direction: column;
        border: 1px solid ${T.border}; border-radius: 7px;
        max-height: 300px; overflow-y: auto;
      }
      .th-fs-item {
        display: flex; align-items: flex-start; gap: 8px;
        padding: 7px 10px; border-bottom: 1px solid ${T.border};
      }
      .th-fs-item:last-child { border-bottom: none; }
      label.th-fs-item { cursor: pointer; }
      .th-fs-item.disabled { opacity: .55; cursor: default; }
      .th-fs-item input[type=checkbox] { margin: 2px 0 0; flex-shrink: 0; cursor: pointer; }
      .th-fs-item-main { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 3px; }
      .th-fs-item-name { font-weight: 600; color: ${T.textStrong}; word-break: break-word; }
      .th-fs-item-meta { color: ${T.textDim}; font-size: 10.5px; }
      .th-fs-item-warn { color: #D97706; font-size: 10.5px; }
      .th-fs-name-inp {
        width: 100%; box-sizing: border-box; padding: 4px 8px;
        border: 1px solid ${T.border}; border-radius: 5px; outline: none;
        background: ${T.bg}; color: ${T.textStrong};
        font-family: inherit; font-size: 12px; font-weight: 600;
      }
      .th-fs-name-inp:focus { border-color: ${ACCENT}; }

      .th-fs-code {
        width: 100%; box-sizing: border-box; min-height: 90px; padding: 8px 10px;
        border: 1px solid ${T.border}; border-radius: 6px; outline: none; resize: vertical;
        background: ${T.panel}; color: ${T.text};
        font-family: Consolas, "Courier New", monospace; font-size: 11px; word-break: break-all;
      }
      .th-fs-code:focus { border-color: ${ACCENT}; }

      .th-fs-actions { display: flex; justify-content: flex-end; gap: 8px; }
      .th-fs-primary {
        padding: 6px 18px; border-radius: 6px; border: none;
        background: ${ACCENT}; color: #fff;
        font-family: inherit; font-size: 12px; font-weight: 600; cursor: pointer;
      }
      .th-fs-primary:hover:not(:disabled) { background: ${ACCENT_HOVER}; }
      .th-fs-primary:disabled { opacity: .45; cursor: default; }
      .th-fs-results { display: flex; flex-direction: column; gap: 3px; font-size: 11px; }
      .th-fs-res-ok { color: #3fb950; }
      .th-fs-res-err { color: #E24B4A; }
    `);

    function mk(tag, cls, text) {
      const e = document.createElement(tag);
      if (cls) e.className = cls;
      if (text !== undefined) e.textContent = text;
      return e;
    }

    function plural(n, forms) {
      const n10 = n % 10, n100 = n % 100;
      if (n10 === 1 && n100 !== 11) return forms[0];
      if (n10 >= 2 && n10 <= 4 && (n100 < 10 || n100 >= 20)) return forms[1];
      return forms[2];
    }
    const FILTER_FORMS = ['фильтр', 'фильтра', 'фильтров'];

    const REPORT_ID_RE = /^[0-9a-f]{32}$/;

    // ── Страница и её reportId ────────────────────────────────────────

    function currentReport() {
      const m = location.pathname.match(/\/backoffice\/([^/?#]+)/i);
      const known = m && CFG.reports[m[1].toLowerCase()];
      if (known) return { id: known.id, label: known.label };

      // Запасной путь: report_id в ссылках на файлы основной таблицы.
      // Окна сайта (например, «История тикета») пропускаем — у них свой номер.
      const counts = {};
      document.querySelectorAll('a[href*="report_id="]').forEach(a => {
        if (a.closest('.modal_wrap')) return;
        const mm = (a.getAttribute('href') || '').match(/report_id=([0-9a-f]{32})/i);
        if (mm) {
          const id = mm[1].toLowerCase();
          counts[id] = (counts[id] || 0) + 1;
        }
      });
      const best = Object.keys(counts).sort((a, b) => counts[b] - counts[a])[0];
      return best ? { id: best, label: document.title || 'эта страница' } : null;
    }

    function reportLabel(id) {
      const known = Object.values(CFG.reports).find(r => r.id === id);
      return known ? known.label : `страница ${id.slice(0, 8)}…`;
    }

    // ── Запросы к сайту ───────────────────────────────────────────────

    function requestHeaders() {
      const h = {
        'Content-Type': 'application/json',
        'Accept': 'application/json, text/plain, */*',
        'X-Requested-With': 'XMLHttpRequest',
      };
      // Сайт сам отправляет этот заголовок с запросами фильтров
      if (typeof pageWindow._TIMEZONE === 'string') h['X-Time-Zone'] = pageWindow._TIMEZONE;
      return h;
    }

    async function postJson(url, body) {
      let r;
      try {
        r = await fetch(url, {
          method: 'POST',
          credentials: 'same-origin',
          headers: requestHeaders(),
          body: JSON.stringify(body),
        });
      } catch (err) {
        throw new Error('нет связи с сервером');
      }
      if (!r.ok) throw new Error(`сервер ответил ${r.status}`);
      try {
        return await r.json();
      } catch (err) {
        // Вместо JSON обычно приходит страница входа — сессия закончилась
        throw new Error('сервер ответил не данными — возможно, истекла сессия, обновите страницу');
      }
    }

    // Только плоский объект: значения — строки, числа, true/false, null или
    // массивы из них. Ровно так выглядят все фильтры сайта; всё остальное
    // в чужом коде не пропускаем дальше, чем до сообщения об ошибке.
    function isPlainForm(form) {
      if (!form || typeof form !== 'object' || Array.isArray(form)) return false;
      const scalar = v => v === null || ['string', 'number', 'boolean'].includes(typeof v);
      return Object.keys(form).every(k => {
        const v = form[k];
        return scalar(v) || (Array.isArray(v) && v.every(scalar));
      });
    }

    async function loadFilters(reportId) {
      const json = await postJson(CFG.getUrl, { reportId });
      if (!json || json.success !== true || !Array.isArray(json.data)) {
        throw new Error('сервер не отдал список фильтров');
      }
      return json.data.map(row => {
        let form = null;
        try {
          form = typeof row.FilterParam === 'string' ? JSON.parse(row.FilterParam) : row.FilterParam;
        } catch (err) { /* не читается — ниже станет null */ }
        return { id: row.id, name: String(row.FilterName || ''), form: isPlainForm(form) ? form : null };
      });
    }

    async function saveFilter(reportId, name, form) {
      const json = await postJson(CFG.saveUrl, { reportId, filterName: name, form });
      if (!json || json.success !== true) {
        throw new Error((json && json.message) || 'сервер не подтвердил сохранение');
      }
    }

    // ── Код: JSON → gzip → base64 ─────────────────────────────────────

    function bytesToBase64(bytes) {
      let s = '';
      for (let i = 0; i < bytes.length; i += 0x8000) {
        s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
      }
      return btoa(s);
    }

    function base64ToBytes(b64) {
      const s = atob(b64);
      const out = new Uint8Array(s.length);
      for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
      return out;
    }

    async function pipeBytes(bytes, transform) {
      const stream = new Blob([bytes]).stream().pipeThrough(transform);
      return new Uint8Array(await new Response(stream).arrayBuffer());
    }

    // z: — сжатый код, b: — без сжатия. Сжатие делает код в несколько раз
    // короче (в фильтрах много одинаковых кусков, например список колонок),
    // а если браузер его не умеет — код просто длиннее.
    async function encodeCode(filters) {
      const bytes = new TextEncoder().encode(JSON.stringify({ v: 1, filters }));
      if (typeof CompressionStream === 'function') {
        try {
          return `${CFG.codePrefix}z:${bytesToBase64(await pipeBytes(bytes, new CompressionStream('gzip')))}`;
        } catch (err) {
          log('Не удалось сжать код фильтров, отдаём без сжатия', err);
        }
      }
      return `${CFG.codePrefix}b:${bytesToBase64(bytes)}`;
    }

    function validatePayload(payload) {
      if (!payload || payload.v !== 1 || !Array.isArray(payload.filters) || payload.filters.length === 0) {
        throw new Error('в коде нет фильтров');
      }
      if (payload.filters.length > CFG.maxFilters) {
        throw new Error(`в коде слишком много фильтров (${payload.filters.length})`);
      }
      return payload.filters.map((f, i) => {
        if (!f || typeof f.name !== 'string' || !REPORT_ID_RE.test(String(f.reportId)) || !isPlainForm(f.form)) {
          throw new Error(`фильтр №${i + 1} в коде повреждён`);
        }
        return { name: f.name.trim().slice(0, 200) || `Фильтр ${i + 1}`, reportId: f.reportId, form: f.form };
      });
    }

    async function decodeCode(text) {
      // Мессенджеры любят переносить длинные строки — пробелы и переносы
      // внутри кода просто выбрасываем
      const clean = String(text || '').replace(/\s+/g, '');
      const at = clean.indexOf(CFG.codePrefix);
      if (at === -1) throw new Error(`это не код фильтров — он начинается с ${CFG.codePrefix}`);
      const m = clean.slice(at + CFG.codePrefix.length).match(/^([zb]):([A-Za-z0-9+/]+=*)/);
      if (!m) throw new Error('код обрезан или повреждён — скопируйте его целиком');

      let bytes;
      try {
        bytes = base64ToBytes(m[2]);
      } catch (err) {
        throw new Error('код обрезан или повреждён — скопируйте его целиком');
      }
      if (m[1] === 'z') {
        if (typeof DecompressionStream !== 'function') {
          throw new Error('этот браузер не умеет распаковывать код — обновите браузер');
        }
        try {
          bytes = await pipeBytes(bytes, new DecompressionStream('gzip'));
        } catch (err) {
          throw new Error('код обрезан или повреждён — скопируйте его целиком');
        }
      }

      let payload;
      try {
        payload = JSON.parse(new TextDecoder().decode(bytes));
      } catch (err) {
        throw new Error('код обрезан или повреждён — скопируйте его целиком');
      }
      return validatePayload(payload);
    }

    // ── Описание фильтра одной строкой ────────────────────────────────

    const SUMMARY_FIELDS = [
      ['idStatusUser', 'Статусы'],
      ['externalStatus', 'Внешние статусы'],
      ['internalStatus', 'Внутр. статусы'],
      ['requestTypeIds', 'Типы тикета'],
      ['departments', 'Отделы'],
      ['agentId', 'Агенты'],
      ['subAgentId', 'Субагенты'],
      ['countryIds', 'Страны'],
      ['refIds', 'Рефералы'],
      ['topicId', 'Темы'],
      ['subTopicId', 'Подтемы'],
      ['adminSelect', 'Админы'],
      ['currency', 'Валюты'],
      ['epayTransactionStatus', 'Статусы депозитов'],
      ['withdrawalTransactionStatus', 'Статусы выводов'],
      ['savedColumns', 'Колонки'],
    ];

    function summarize(form) {
      const parts = [];
      SUMMARY_FIELDS.forEach(([key, label]) => {
        const v = form[key];
        if (Array.isArray(v) && v.length) parts.push(`${label} ${v.length}`);
      });
      if (form.isVip === true) parts.push('VIP');
      if (form.myTickets === true) parts.push('Мои тикеты');
      return parts.join(' · ') || 'без условий';
    }

    function uniqueName(name, taken) {
      if (!taken.has(name)) return name;
      for (let i = 2; ; i++) {
        const candidate = `${name} (${i})`;
        if (!taken.has(candidate)) return candidate;
      }
    }

    // ── Вкладка «Поделиться» ─────────────────────────────────────────

    function buildSharePane(pane, report) {
      if (!report) {
        pane.appendChild(mk('div', 'th-fs-error', 'Не удалось понять, к какой странице относятся фильтры. Откройте список тикетов и попробуйте ещё раз.'));
        return;
      }

      pane.appendChild(mk('div', 'th-fs-hint',
        'Отметьте фильтры, которыми хотите поделиться, и отправьте код коллеге в любом чате. ' +
        'У коллеги они появятся в «Saved filters» вместе с набором колонок.'));

      const state = mk('div', 'th-fs-state', 'Загрузка списка…');
      pane.appendChild(state);

      const selectAllLabel = mk('label', 'th-fs-selectall');
      const selectAll = mk('input'); selectAll.type = 'checkbox';
      selectAllLabel.appendChild(selectAll);
      selectAllLabel.appendChild(document.createTextNode('Выбрать все'));
      const list = mk('div', 'th-fs-list');
      const actions = mk('div', 'th-fs-actions');
      const copyBtn = mk('button', 'th-fs-primary', 'Скопировать код');
      copyBtn.type = 'button';
      copyBtn.disabled = true;
      actions.appendChild(copyBtn);
      const result = mk('div');
      result.style.cssText = 'display:flex;flex-direction:column;gap:8px;';

      let rows = [];

      function update() {
        const usable = rows.filter(r => r.filter.form);
        const n = usable.filter(r => r.box.checked).length;
        copyBtn.disabled = n === 0;
        copyBtn.textContent = n ? `Скопировать код (${n})` : 'Скопировать код';
        selectAll.checked = usable.length > 0 && n === usable.length;
        selectAll.indeterminate = n > 0 && n < usable.length;
      }

      selectAll.addEventListener('change', () => {
        rows.forEach(r => { if (r.filter.form) r.box.checked = selectAll.checked; });
        update();
      });

      copyBtn.addEventListener('click', async () => {
        const chosen = rows.filter(r => r.filter.form && r.box.checked).map(r => r.filter);
        if (!chosen.length) return;
        copyBtn.disabled = true;
        const code = await encodeCode(chosen.map(f => ({ name: f.name, reportId: report.id, form: f.form })));
        await copyText(code);
        result.innerHTML = '';
        result.appendChild(mk('div', 'th-fs-ok',
          `Код скопирован: ${chosen.length} ${plural(chosen.length, FILTER_FORMS)}, ${code.length} символов. ` +
          'Отправьте его коллеге целиком — у него кнопка «Обмен фильтрами» → «Добавить по коду».'));
        const box = mk('textarea', 'th-fs-code th-fs-share-code');
        box.readOnly = true;
        box.value = code;
        box.addEventListener('focus', () => box.select());
        result.appendChild(box);
        update();
      });

      loadFilters(report.id).then(filters => {
        if (!filters.length) {
          state.textContent = 'На этой странице у вас пока нет сохранённых фильтров.';
          return;
        }
        state.remove();
        rows = filters.map(filter => {
          const item = mk('label', 'th-fs-item' + (filter.form ? '' : ' disabled'));
          const box = mk('input'); box.type = 'checkbox';
          box.disabled = !filter.form;
          box.addEventListener('change', update);
          const main = mk('div', 'th-fs-item-main');
          main.appendChild(mk('div', 'th-fs-item-name', filter.name || '(без имени)'));
          main.appendChild(mk('div', 'th-fs-item-meta',
            filter.form ? summarize(filter.form) : 'Не удалось прочитать этот фильтр — пропускаем'));
          item.appendChild(box);
          item.appendChild(main);
          list.appendChild(item);
          return { filter, box };
        });
        pane.appendChild(selectAllLabel);
        pane.appendChild(list);
        pane.appendChild(actions);
        pane.appendChild(result);
        update();
      }).catch(err => {
        state.className = 'th-fs-error';
        state.textContent = `Не удалось загрузить сохранённые фильтры: ${err.message}`;
      });
    }

    // ── Вкладка «Добавить по коду» ────────────────────────────────────

    function buildImportPane(pane) {
      pane.appendChild(mk('div', 'th-fs-hint',
        'Вставьте код, который прислал коллега. Фильтры сохранятся в ваши «Saved filters» — ' +
        'заполнять поля вручную не нужно. Имя каждого фильтра можно поменять перед сохранением.'));

      const input = mk('textarea', 'th-fs-code th-fs-import-code');
      input.placeholder = `${CFG.codePrefix}…`;
      pane.appendChild(input);

      const status = mk('div');
      const list = mk('div', 'th-fs-list');
      const actions = mk('div', 'th-fs-actions');
      const addBtn = mk('button', 'th-fs-primary', 'Добавить');
      addBtn.type = 'button';
      addBtn.disabled = true;
      actions.appendChild(addBtn);
      const results = mk('div', 'th-fs-results');
      [status, list, actions, results].forEach(el => pane.appendChild(el));
      list.style.display = 'none';

      let rows = [];
      let takenByReport = {};
      let token = 0;
      let timer = null;

      function setStatus(cls, text) {
        status.className = cls || '';
        status.textContent = text || '';
      }

      function updateAddBtn() {
        const n = rows.filter(r => r.box.checked).length;
        addBtn.disabled = n === 0;
        addBtn.textContent = n ? `Добавить ${n} ${plural(n, FILTER_FORMS)}` : 'Добавить';
      }

      async function preview() {
        const my = ++token;
        rows = [];
        list.innerHTML = '';
        list.style.display = 'none';
        results.innerHTML = '';
        addBtn.disabled = true;
        addBtn.textContent = 'Добавить';

        const text = input.value.trim();
        if (!text) { setStatus('', ''); return; }

        let filters;
        try {
          filters = await decodeCode(text);
        } catch (err) {
          if (my === token) setStatus('th-fs-error', `Код не подошёл: ${err.message}.`);
          return;
        }
        if (my !== token) return;

        // Имена уже сохранённых фильтров — чтобы не затереть свой фильтр
        // с тем же именем, совпадающие имена получают номер « (2)».
        setStatus('th-fs-state', 'Проверяю, нет ли у вас фильтров с такими же именами…');
        const ids = [...new Set(filters.map(f => f.reportId))];
        const taken = {};
        let checkFailed = false;
        await Promise.all(ids.map(async id => {
          try {
            taken[id] = new Set((await loadFilters(id)).map(f => f.name));
          } catch (err) {
            taken[id] = new Set();
            checkFailed = true;
          }
        }));
        if (my !== token) return;
        takenByReport = taken;

        if (checkFailed) {
          setStatus('th-fs-warn', 'Не удалось проверить имена ваших фильтров — если у вас уже есть фильтр с таким же именем, проверьте его после сохранения.');
        } else {
          setStatus('th-fs-state', `В коде ${filters.length} ${plural(filters.length, FILTER_FORMS)}.`);
        }

        const proposedTaken = {};
        ids.forEach(id => { proposedTaken[id] = new Set(taken[id]); });

        rows = filters.map(filter => {
          const proposed = uniqueName(filter.name, proposedTaken[filter.reportId]);
          proposedTaken[filter.reportId].add(proposed);

          const item = mk('div', 'th-fs-item');
          const box = mk('input'); box.type = 'checkbox';
          box.checked = true;
          box.addEventListener('change', updateAddBtn);
          const main = mk('div', 'th-fs-item-main');
          const nameInp = mk('input', 'th-fs-name-inp');
          nameInp.type = 'text';
          nameInp.value = proposed;
          main.appendChild(nameInp);
          main.appendChild(mk('div', 'th-fs-item-meta', `${reportLabel(filter.reportId)} · ${summarize(filter.form)}`));
          if (proposed !== filter.name) {
            main.appendChild(mk('div', 'th-fs-item-warn', `У вас уже есть фильтр «${filter.name}» — этот сохранится под новым именем.`));
          }
          item.appendChild(box);
          item.appendChild(main);
          list.appendChild(item);
          return { filter, box, nameInp };
        });
        list.style.display = '';
        updateAddBtn();
      }

      input.addEventListener('input', () => {
        clearTimeout(timer);
        timer = setTimeout(preview, 250);
      });

      addBtn.addEventListener('click', async () => {
        const chosen = rows.filter(r => r.box.checked);
        if (!chosen.length) return;
        const myToken = token;
        addBtn.disabled = true;
        input.disabled = true;
        results.innerHTML = '';
        let ok = 0;

        for (const row of chosen) {
          const f = row.filter;
          const taken = takenByReport[f.reportId] || new Set();
          let name = row.nameInp.value.trim() || f.name;
          // Имя могли поправить руками на уже занятое — проверяем ещё раз
          if (taken.has(name)) name = uniqueName(name, taken);
          try {
            await saveFilter(f.reportId, name, f.form);
            taken.add(name);
            ok++;
            results.appendChild(mk('div', 'th-fs-res-ok', `✓ «${name}» — ${reportLabel(f.reportId)}`));
          } catch (err) {
            results.appendChild(mk('div', 'th-fs-res-err', `✗ «${name}»: ${err.message}`));
          }
        }

        input.disabled = false;
        if (myToken !== token) return;
        rows.forEach(r => { r.box.disabled = true; r.nameInp.disabled = true; });
        addBtn.textContent = 'Готово';
        const summary = mk('div', ok === chosen.length ? 'th-fs-ok' : 'th-fs-warn',
          `Добавлено ${ok} из ${chosen.length}. Новые фильтры уже в списке «Saved filters» — откройте его, чтобы применить.`);
        results.appendChild(summary);
      });
    }

    // ── Окно ──────────────────────────────────────────────────────────

    function closeModal() {
      const el = document.getElementById('th-fs-overlay');
      if (el) el.remove();
    }

    function openModal(tab) {
      closeModal();
      const report = currentReport();

      const overlay = mk('div'); overlay.id = 'th-fs-overlay';
      const modal = mk('div'); modal.id = 'th-fs-modal';
      overlay.appendChild(modal);
      overlay.addEventListener('click', (e) => { if (e.target === overlay) closeModal(); });

      const header = mk('div'); header.id = 'th-fs-header';
      const iconWrap = mk('div'); iconWrap.id = 'th-fs-header-icon';
      iconWrap.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.6" y1="13.5" x2="15.4" y2="17.5"/><line x1="15.4" y1="6.5" x2="8.6" y2="10.5"/></svg>`;
      const headerText = mk('div'); headerText.id = 'th-fs-header-text';
      const title = mk('div', '', 'Обмен фильтрами'); title.id = 'th-fs-title';
      const subtitle = mk('div', '', report ? report.label : ''); subtitle.id = 'th-fs-subtitle';
      headerText.appendChild(title);
      headerText.appendChild(subtitle);
      const closeBtn = mk('button', '', '×'); closeBtn.id = 'th-fs-close'; closeBtn.type = 'button';
      closeBtn.setAttribute('aria-label', 'Закрыть');
      closeBtn.addEventListener('click', closeModal);
      header.appendChild(iconWrap);
      header.appendChild(headerText);
      header.appendChild(closeBtn);
      modal.appendChild(header);

      const tabs = mk('div', 'th-fs-tabs');
      const shareTab = mk('button', 'th-fs-tab', 'Поделиться'); shareTab.type = 'button';
      const importTab = mk('button', 'th-fs-tab', 'Добавить по коду'); importTab.type = 'button';
      tabs.appendChild(shareTab);
      tabs.appendChild(importTab);
      modal.appendChild(tabs);

      const sharePane = mk('div', 'th-fs-pane th-fs-pane-share');
      const importPane = mk('div', 'th-fs-pane th-fs-pane-import');
      modal.appendChild(sharePane);
      modal.appendChild(importPane);

      function activate(which) {
        shareTab.classList.toggle('active', which === 'share');
        importTab.classList.toggle('active', which === 'import');
        sharePane.classList.toggle('active', which === 'share');
        importPane.classList.toggle('active', which === 'import');
      }
      shareTab.addEventListener('click', () => activate('share'));
      importTab.addEventListener('click', () => activate('import'));

      buildSharePane(sharePane, report);
      buildImportPane(importPane);
      activate(tab === 'import' ? 'import' : 'share');

      document.body.appendChild(overlay);
    }

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && document.getElementById('th-fs-overlay')) closeModal();
    });

    // ── Кнопка рядом с «Saved filters» ────────────────────────────────

    // Кнопку сайта ищем по иконке, а не по подписи — подпись зависит от
    // языка сайта. Окна сайта пропускаем: там такой кнопки быть не должно.
    function findSavedFiltersButton() {
      for (const icon of document.querySelectorAll('.fa-sliders-h')) {
        if (icon.closest('.modal_wrap, #th-fs-overlay')) continue;
        const btn = icon.closest('button');
        if (btn) return btn;
      }
      return null;
    }

    function ensureButton() {
      const savedBtn = findSavedFiltersButton();
      if (!savedBtn || !savedBtn.parentElement) return;
      if (savedBtn.parentElement.querySelector('.th-fs-open-btn')) return;

      const btn = mk('button', 'btn btn-success th-fs-open-btn');
      btn.type = 'button';
      btn.title = 'Обмен фильтрами: поделиться кодом или добавить фильтры коллеги';
      btn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.6" y1="13.5" x2="15.4" y2="17.5"/><line x1="15.4" y1="6.5" x2="8.6" y2="10.5"/></svg>`;
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        openModal();
      });
      savedBtn.after(document.createTextNode(' '), btn);
    }

    ensureButton();
    new MutationObserver(ensureButton).observe(document.body, { childList: true, subtree: true });

    log('Обмен сохранёнными фильтрами включён');
  }

  // ==================================================================
  // 8. АВТОЗАКРЫТИЕ ШТАТНЫХ ПОПАПОВ «OK»
  // ==================================================================

  // Закрывает только swal2-окна, которые строго совпадают со штатным
  // подтверждением сохранения: иконка успеха + текст «OK!» в содержимом +
  // кнопка «OK», без кнопки отмены. Если не совпало хотя бы одно условие,
  // попап не трогается — чтобы не закрыть окно с настоящей ошибкой.
  function initAutoClose() {
    // Визуально похожие кириллические О/о/К/к иногда попадают в текст
    // по ошибке раскладки или копипаста
    function normalize(text) {
      return text
        .replace(/О/g, 'O')
        .replace(/о/g, 'o')
        .replace(/К/g, 'K')
        .replace(/к/g, 'k');
    }

    const observer = new MutationObserver(() => {
      const popup = document.querySelector('.swal2-popup');
      if (!popup) return;

      const isSuccess = popup.classList.contains('swal2-icon-success');

      const cancelBtn = popup.querySelector('.swal2-cancel');
      const hasCancel = cancelBtn && cancelBtn.style.display !== 'none';

      const titleEl = popup.querySelector('.swal2-title');
      const titleText = titleEl ? titleEl.textContent.trim() : '';

      const contentEl = popup.querySelector('.swal2-html-container');
      const contentText = contentEl ? normalize(contentEl.textContent.trim()) : '';
      const hasOkContent = /^ok!?$/i.test(contentText);

      const confirmBtn = popup.querySelector('.swal2-confirm');
      const confirmText = confirmBtn ? normalize(confirmBtn.textContent.trim()) : '';
      const hasOkButton = /^ok$/i.test(confirmText);

      if (isSuccess && !hasCancel && hasOkContent && hasOkButton) {
        confirmBtn.click();
        // Пишется всегда, а не только при debug: если когда-нибудь окно
        // с реальным сообщением начнёт закрываться, это будет видно по title
        console.log(
          '[AutoClose] Закрыл попап: title "%s", содержимое "%s", кнопка "%s"',
          titleText,
          contentText,
          confirmText
        );
      }
    });

    // Наблюдаем за самим document: на document-start <html> может ещё
    // не существовать, а document есть всегда
    observer.observe(document, { childList: true, subtree: true });
  }

  // ==================================================================
  // ПАНЕЛЬ НАСТРОЕК: ВКЛЮЧЕНИЕ И ВЫКЛЮЧЕНИЕ ФУНКЦИЙ БЕЗ ПРАВКИ КОДА
  // ==================================================================

  // Порядок и подписи держим синхронно с CONFIG.features
  const FEATURE_LABELS = {
    filePreview: 'Превью вложений',
    prevStatus: 'Предыдущий статус и кто в работе',
    messengerId: 'Автоподстановка Reddy ID',
    autoDateRange: 'Автоподстановка дат',
    fileButtons: 'Кнопки вместо ссылок на файлы',
    cellCopy: 'Копирование значения ячейки по клику',
    filterShare: 'Обмен сохранёнными фильтрами',
    autoClose: 'Автозакрытие попапов «OK»',
  };

  // CONFIG.features задаёт дефолт при первом запуске; панель настроек
  // пишет поверх него через store — переживает обновления скрипта и общее
  // для всех трёх доменов.
  function isFeatureEnabled(name) {
    return store.get('feature:' + name, CONFIG.features[name] ? '1' : '0') === '1';
  }

  // Кнопка ⚙ показывается только на страницах тикетов, чтобы не висеть
  // во всём бэкофисе; пункт меню Tampermonkey доступен везде.
  function initSettingsPanel({ showButton }) {
    addStyle('th-helper-settings-style', `
      #th-settings-btn {
        position: fixed;
        left: 20px;
        bottom: 20px;
        z-index: 100000;
        width: 40px;
        height: 40px;
        border: 1px solid ${T.border};
        border-radius: 50%;
        background: ${T.panel};
        color: ${T.textDim};
        font-size: 18px;
        line-height: 1;
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        box-shadow: ${T.shadow};
        opacity: .55;
        transition: opacity .15s, color .15s, border-color .15s;
      }
      #th-settings-btn:hover {
        opacity: 1;
        color: ${ACCENT};
        border-color: ${ACCENT};
      }

      #th-settings-overlay {
        position: fixed;
        inset: 0;
        z-index: 999999;
        background: rgba(0,0,0,0.5);
        display: none;
        align-items: center;
        justify-content: center;
        padding: 24px;
        box-sizing: border-box;
      }
      #th-settings-overlay.show { display: flex; }

      #th-settings-panel {
        width: 360px;
        max-width: 100%;
        max-height: 90vh;
        overflow-y: auto;
        background: ${T.bg};
        border: 1px solid ${T.border};
        border-radius: 10px;
        box-shadow: ${T.shadow};
        font-family: "Open Sans", Tahoma, Arial, sans-serif;
        font-size: 12px;
        color: ${T.text};
      }
      #th-settings-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 14px 16px;
        border-bottom: 1px solid ${T.border};
      }
      #th-settings-title {
        font-size: 13px;
        font-weight: 700;
        color: ${T.textStrong};
      }
      #th-settings-close {
        border: none;
        background: transparent;
        color: ${T.textDim};
        font-size: 18px;
        line-height: 1;
        cursor: pointer;
        padding: 0 4px;
      }
      #th-settings-close:hover { color: ${T.textStrong}; }

      #th-settings-body { padding: 4px 16px; }

      .th-settings-row {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
        padding: 9px 0;
        border-bottom: 1px solid ${T.border};
        cursor: pointer;
      }
      .th-settings-row:last-child { border-bottom: none; }
      .th-settings-row-label { color: ${T.text}; }

      .th-toggle {
        position: relative;
        display: inline-block;
        flex: 0 0 auto;
        width: 36px;
        height: 20px;
      }
      .th-toggle-input {
        position: absolute;
        inset: 0;
        margin: 0;
        opacity: 0;
        cursor: pointer;
        z-index: 1;
      }
      .th-toggle-track {
        position: absolute;
        inset: 0;
        background: ${T.border};
        border-radius: 999px;
        transition: background .15s;
      }
      .th-toggle-thumb {
        position: absolute;
        top: 2px;
        left: 2px;
        width: 16px;
        height: 16px;
        border-radius: 50%;
        background: #fff;
        box-shadow: 0 1px 3px rgba(0,0,0,.3);
        transition: transform .15s;
      }
      .th-toggle-input:checked + .th-toggle-track { background: ${ACCENT}; }
      .th-toggle-input:checked + .th-toggle-track .th-toggle-thumb { transform: translateX(16px); }

      #th-settings-notice {
        display: none;
        align-items: center;
        justify-content: space-between;
        gap: 10px;
        margin: 12px 16px 14px;
        padding: 8px 10px;
        border-radius: 6px;
        background: ${T.panel};
        border: 1px solid ${T.border};
        color: ${T.textDim};
        font-size: 11px;
      }
      #th-settings-notice.show { display: flex; }
      #th-settings-reload {
        flex: 0 0 auto;
        border: none;
        border-radius: 6px;
        background: ${ACCENT};
        color: #fff;
        font-size: 11px;
        font-weight: 600;
        padding: 5px 12px;
        cursor: pointer;
        transition: background .15s;
      }
      #th-settings-reload:hover { background: ${ACCENT_HOVER}; }
    `);

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.id = 'th-settings-btn';
    btn.title = 'Настройки Web Helper';
    btn.textContent = '⚙';
    if (showButton) document.body.appendChild(btn);

    const rowsHtml = Object.keys(FEATURE_LABELS).map(name => `
      <label class="th-settings-row">
        <span class="th-settings-row-label">${FEATURE_LABELS[name]}</span>
        <span class="th-toggle">
          <input type="checkbox" class="th-toggle-input" data-feature="${name}">
          <span class="th-toggle-track"><span class="th-toggle-thumb"></span></span>
        </span>
      </label>
    `).join('');

    const overlay = document.createElement('div');
    overlay.id = 'th-settings-overlay';
    overlay.innerHTML = `
      <div id="th-settings-panel">
        <div id="th-settings-header">
          <div id="th-settings-title">Web Helper — настройки</div>
          <button type="button" id="th-settings-close" aria-label="Закрыть">×</button>
        </div>
        <div id="th-settings-body">${rowsHtml}</div>
        <div id="th-settings-notice">
          <span>Изменения вступят в силу после обновления страницы.</span>
          <button type="button" id="th-settings-reload">Обновить</button>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);

    const notice = overlay.querySelector('#th-settings-notice');
    const checkboxes = Array.from(overlay.querySelectorAll('.th-toggle-input'));

    function openPanel() {
      checkboxes.forEach(cb => { cb.checked = isFeatureEnabled(cb.dataset.feature); });
      notice.classList.remove('show');
      overlay.classList.add('show');
    }

    function closePanel() {
      overlay.classList.remove('show');
    }

    btn.addEventListener('click', () => {
      if (overlay.classList.contains('show')) closePanel(); else openPanel();
    });

    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) closePanel();
    });

    overlay.querySelector('#th-settings-close').addEventListener('click', closePanel);

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && overlay.classList.contains('show')) closePanel();
    });

    checkboxes.forEach(cb => {
      cb.addEventListener('change', () => {
        store.set('feature:' + cb.dataset.feature, cb.checked ? '1' : '0');
        notice.classList.add('show');
      });
    });

    overlay.querySelector('#th-settings-reload').addEventListener('click', () => {
      location.reload();
    });

    if (typeof GM_registerMenuCommand === 'function') {
      GM_registerMenuCommand('Web Helper: Настройки', openPanel);
    }

    log('Панель настроек готова');
  }

  // ==================================================================
  // ЗАПУСК
  // ==================================================================

  const isTicketPage = CONFIG.ticketPages.test(location.pathname);

  // Автозакрытие стартует сразу (@run-at document-start), чтобы не
  // пропустить попап, показанный во время загрузки страницы
  if (isFeatureEnabled('autoClose')) initAutoClose();

  function start() {
    initTheme();
    initSettingsPanel({ showButton: isTicketPage });
    if (!isTicketPage) {
      log('Не страница тикетов — работает только автозакрытие попапов');
      return;
    }
    if (isFeatureEnabled('filePreview')) initFilePreview();
    if (isFeatureEnabled('prevStatus')) initPrevStatus();
    if (isFeatureEnabled('messengerId')) initMessengerId();
    if (isFeatureEnabled('autoDateRange')) initAutoDateRange();
    if (isFeatureEnabled('fileButtons')) initFileButtons();
    if (isFeatureEnabled('cellCopy')) initCellCopy();
    if (isFeatureEnabled('filterShare')) initFilterShare();
    log('Скрипт запущен на', window.location.pathname);
  }

  // При document-start тела страницы ещё нет, а тема админки
  // (window._THEME) задаётся её же скриптом — ждём готовности DOM
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start, { once: true });
  } else {
    start();
  }

})();
