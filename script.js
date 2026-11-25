/* ==========================================================================
   Body Scent — script.js
   One file shared by every page. Each section runs only if the page
   contains the elements it needs.

   product.html : #filter-bar, #product-list
   order.html   : #orderForm, #customerName, #contact, #items, #total, #note
   admin.html   : #ordersTable tbody
   ========================================================================== */

(function () {
  'use strict';

  /* ------------------------------------------------------------------------
     Config
     ------------------------------------------------------------------------ */
  var PRODUCTS_URL = 'products.json';

  var ORDER_ENDPOINT =
    'https://script.google.com/macros/s/AKfycbzc6F54hgjIo__nuSP1ZaMSF29KpcAec1L5_oFXpkQY1mSXtVWcKeQo_Vwlvg3QKhGg/exec';

  var ORDERS_CSV_URL =
    'https://docs.google.com/spreadsheets/d/e/2PACX-1vS9RaeplXq1nuYo96q_RzA_bYRZHqQAumZyBqAmLN0CZKFnrZhcJG_ACaRI2LQ9qgrN9Glnvc1HZoMf/pub?gid=0&single=true&output=csv';

  var MOODS = [
    { key: 'all',       label: 'ทั้งหมด' },
    { key: 'fresh',     label: 'Fresh' },
    { key: 'sweet',     label: 'Sweet' },
    { key: 'confident', label: 'Confident' },
    { key: 'romance',   label: 'Romance' }
  ];

  var TYPE_LABELS = { spray: 'น้ำหอมฉีดตัว', rollon: 'โรลออน' };

  /* ------------------------------------------------------------------------
     Helpers
     ------------------------------------------------------------------------ */
  function el(tag, className, text) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined && text !== null) node.textContent = text;
    return node;
  }

  function moodLabel(key) {
    for (var i = 0; i < MOODS.length; i++) {
      if (MOODS[i].key === key) return MOODS[i].label;
    }
    return key;
  }

  function isValidMood(key) {
    return MOODS.some(function (m) { return m.key === key; });
  }

  function formatPrice(value) {
    var n = Number(value);
    return isNaN(n) ? String(value) : n.toLocaleString('th-TH');
  }

  /* ------------------------------------------------------------------------
     1. product.html — product cards + mood filter
     ------------------------------------------------------------------------ */
  function initProducts() {
    var filterBar = document.getElementById('filter-bar');
    var list = document.getElementById('product-list');
    if (!filterBar || !list) return;

    var products = [];
    var currentMood = 'all';

    // mood from ?mood=xxx (falls back to "all" if missing or unknown)
    var params = new URLSearchParams(window.location.search);
    var moodParam = (params.get('mood') || '').toLowerCase();
    if (isValidMood(moodParam)) currentMood = moodParam;

    function buildOrderUrl(product) {
      var itemName = product.size ? product.name + ' ' + product.size : product.name;
      var query = new URLSearchParams({ item: itemName, price: String(product.price) });
      return 'order.html?' + query.toString();
    }

    function buildCard(product) {
      var card = el('article', 'product-card');
      card.setAttribute('data-mood', product.mood);

      var media = el('div', 'product-card__media');
      var img = el('img');
      img.src = product.image;
      img.alt = product.name;
      img.loading = 'lazy';
      media.appendChild(img);

      var body = el('div', 'product-card__body');

      var meta = el('div', 'product-card__meta');
      var dot = el('span', 'mood-dot');
      dot.setAttribute('aria-hidden', 'true');
      meta.appendChild(dot);
      meta.appendChild(el('span', null, moodLabel(product.mood)));

      var title = el('h3', 'product-card__title', product.name);

      body.appendChild(meta);
      body.appendChild(title);

      if (product.size) {
        body.appendChild(el('p', 'product-card__desc', product.size));
      }

      var foot = el('div', 'product-card__foot');
      var price = el('span', 'price', formatPrice(product.price));
      price.appendChild(el('small', null, 'บาท'));

      var order = el('a', 'btn btn--sm', 'สั่งซื้อ');
      order.href = buildOrderUrl(product);

      foot.appendChild(price);
      foot.appendChild(order);
      body.appendChild(foot);

      card.appendChild(media);
      card.appendChild(body);
      return card;
    }

    function renderList() {
      list.innerHTML = '';
      var shown = products.filter(function (p) {
        return currentMood === 'all' || p.mood === currentMood;
      });

      if (shown.length === 0) {
        list.appendChild(el('p', 'muted', 'ยังไม่มีสินค้าในหมวดนี้'));
        return;
      }
      shown.forEach(function (p) { list.appendChild(buildCard(p)); });
    }

    function syncFilterButtons() {
      var buttons = filterBar.querySelectorAll('.filter');
      Array.prototype.forEach.call(buttons, function (btn) {
        var active = btn.getAttribute('data-mood-filter') === currentMood;
        btn.setAttribute('aria-pressed', active ? 'true' : 'false');
      });
    }

    function setMood(key) {
      currentMood = key;
      syncFilterButtons();
      renderList();

      // keep the address in sync so the filtered view can be shared
      var url = new URL(window.location.href);
      if (key === 'all') url.searchParams.delete('mood');
      else url.searchParams.set('mood', key);
      window.history.replaceState(null, '', url.toString());
    }

    function buildFilterBar() {
      filterBar.innerHTML = '';
      MOODS.forEach(function (m) {
        var btn = el('button', 'filter');
        btn.type = 'button';
        btn.setAttribute('data-mood-filter', m.key);
        if (m.key !== 'all') {
          btn.setAttribute('data-mood', m.key);
          var dot = el('span', 'mood-dot');
          dot.setAttribute('aria-hidden', 'true');
          btn.appendChild(dot);
        }
        btn.appendChild(el('span', null, m.label));
        btn.addEventListener('click', function () { setMood(m.key); });
        filterBar.appendChild(btn);
      });
      syncFilterButtons();
    }

    buildFilterBar();
    list.appendChild(el('p', 'muted', 'กำลังโหลดสินค้า…'));

    fetch(PRODUCTS_URL)
      .then(function (res) {
        if (!res.ok) throw new Error('HTTP ' + res.status);
        return res.json();
      })
      .then(function (data) {
        products = Array.isArray(data) ? data : [];
        renderList();
      })
      .catch(function (error) {
        console.error(error);
        list.innerHTML = '';
        list.appendChild(el('p', 'muted', 'โหลดสินค้าไม่สำเร็จ กรุณารีเฟรชหน้าอีกครั้ง'));
      });
  }

  /* ------------------------------------------------------------------------
     2. order.html — prefill from URL + submit to Apps Script
     ------------------------------------------------------------------------ */
  function initOrder() {
    var form = document.getElementById('orderForm');
    if (!form) return;

    var itemsInput = document.getElementById('items');
    var totalInput = document.getElementById('total');

    // Prefill: item -> #items, price -> #total (both, as soon as the page loads)
    var params = new URLSearchParams(window.location.search);
    var item = params.get('item');
    var price = params.get('price');
    if (itemsInput && item !== null) itemsInput.value = item;
    if (totalInput && price !== null) totalInput.value = price;

    form.addEventListener('submit', function (event) {
      event.preventDefault();

      if (!form.checkValidity()) {
        form.reportValidity();
        return;
      }

      var submitBtn = form.querySelector('[type="submit"]');
      if (submitBtn) submitBtn.disabled = true;

      var payload = {
        customerName: document.getElementById('customerName').value,
        contact:      document.getElementById('contact').value,
        items:        document.getElementById('items').value,
        total:        document.getElementById('total').value,
        note:         document.getElementById('note').value
      };

      fetch(ORDER_ENDPOINT, {
        method: 'POST',
        body: JSON.stringify(payload)
      })
      .then(() => { window.location.href = 'thankyou.html'; })
      .catch(error => {
        console.error(error);
        if (submitBtn) submitBtn.disabled = false;
        alert('เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง');
      });
    });
  }

  /* ------------------------------------------------------------------------
     3. admin.html — orders table from published Google Sheet CSV
     ------------------------------------------------------------------------ */

  // Minimal CSV parser: quoted fields, "" escapes, commas and line breaks
  // inside quotes, CRLF or LF line endings, optional BOM.
  function parseCSV(text) {
    text = text.replace(/^\uFEFF/, '');
    var rows = [];
    var row = [];
    var field = '';
    var inQuotes = false;

    for (var i = 0; i < text.length; i++) {
      var c = text[i];

      if (inQuotes) {
        if (c === '"') {
          if (text[i + 1] === '"') { field += '"'; i++; }
          else inQuotes = false;
        } else {
          field += c;
        }
      } else if (c === '"') {
        inQuotes = true;
      } else if (c === ',') {
        row.push(field);
        field = '';
      } else if (c === '\n' || c === '\r') {
        if (c === '\r' && text[i + 1] === '\n') i++;
        row.push(field);
        rows.push(row);
        row = [];
        field = '';
      } else {
        field += c;
      }
    }

    if (field !== '' || row.length > 0) {
      row.push(field);
      rows.push(row);
    }
    return rows;
  }

  function initAdmin() {
    var tbody = document.querySelector('#ordersTable tbody');
    if (!tbody) return;

    var COLUMNS = 6;

    function messageRow(text) {
      tbody.innerHTML = '';
      var tr = el('tr');
      var td = el('td', 'muted', text);
      td.colSpan = COLUMNS;
      tr.appendChild(td);
      tbody.appendChild(tr);
    }

    function render(rows) {
      // first row is the header; drop empty rows; newest (last appended) first
      var data = rows
        .slice(1)
        .filter(function (r) {
          return r.some(function (cell) { return cell.trim() !== ''; });
        })
        .reverse();

      if (data.length === 0) {
        messageRow('ยังไม่มีรายการสั่งซื้อ');
        return;
      }

      tbody.innerHTML = '';
      data.forEach(function (r) {
        var tr = el('tr');
        for (var i = 0; i < COLUMNS; i++) {
          var value = r[i] !== undefined ? r[i] : '';
          if (i === 4 && value !== '' && !isNaN(Number(value))) {
            value = formatPrice(value);
          }
          tr.appendChild(el('td', null, value));
        }
        tbody.appendChild(tr);
      });
    }

    messageRow('กำลังโหลดข้อมูล…');

    // timestamp query keeps the browser from showing a stale copy
    var url = ORDERS_CSV_URL + '&t=' + Date.now();

    fetch(url)
      .then(function (res) {
        if (!res.ok) throw new Error('HTTP ' + res.status);
        return res.text();
      })
      .then(function (text) { render(parseCSV(text)); })
      .catch(function (error) {
        console.error(error);
        messageRow('โหลดข้อมูลไม่สำเร็จ กรุณารีเฟรชหน้าอีกครั้ง');
      });
  }

  /* ------------------------------------------------------------------------
     Boot
     ------------------------------------------------------------------------ */
  function boot() {
    initProducts();
    initOrder();
    initAdmin();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
