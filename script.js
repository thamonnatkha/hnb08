/* ==========================================================
   honey bee — script.js (ใช้ร่วมกันทุกหน้า)
   ตรวจจากการมี element ของแต่ละหน้า แล้วทำงานเฉพาะหน้านั้น
   ========================================================== */

const ORDER_API_URL =
  'https://script.google.com/macros/s/AKfycbzxyiAMYpi8RU0lv7rBrmrNpGeJS_G8iMHUxgD_5c9XG4Tj6VTWfgJLBnudZMlA4s3S/exec';

const ORDERS_CSV_URL =
  'https://docs.google.com/spreadsheets/d/e/2PACX-1vQjJCS4fYV3-i7uLycba9xBbRFbGK8FA3FkRHO1tQvMWTs9ikesdvFbHYqmoOHU-JegguEimSsOzXQk/pub?gid=0&single=true&output=csv';

document.addEventListener('DOMContentLoaded', () => {
  if (document.getElementById('product-list')) initProductPage();
  if (document.getElementById('orderForm')) initOrderPage();
  if (document.querySelector('#ordersTable tbody')) initAdminPage();
});

/* ---------- ตัวช่วย ---------- */

// ดึงชื่อภาษาอังกฤษจากชื่อสินค้า เช่น "น้ำผึ้งสด Raw Honey" -> "Raw Honey"
function getEnglishName(name) {
  const match = String(name).match(/[A-Za-z].*$/);
  return match ? match[0].trim() : String(name).trim();
}

// ทำให้เทียบข้อความง่ายขึ้น: "Raw Honey" / "raw-honey" / "rawhoney" -> "rawhoney"
function normalize(text) {
  return String(text).toLowerCase().replace(/[^a-z0-9ก-๙]/g, '');
}

function formatPrice(value) {
  const number = Number(value);
  return Number.isNaN(number) ? String(value) : number.toLocaleString('th-TH');
}

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

/* ==========================================================
   1) product.html — การ์ดสินค้า + ปุ่มกรอง
   ========================================================== */

function initProductPage() {
  const list = document.getElementById('product-list');
  const filterBar = document.getElementById('filter-bar');

  fetch('products.json')
    .then((response) => {
      if (!response.ok) throw new Error('HTTP ' + response.status);
      return response.json();
    })
    .then((products) => {
      const items = products.map((product) => ({
        ...product,
        category: getEnglishName(product.name),
      }));

      const categories = [...new Set(items.map((item) => item.category))];

      // กรองอัตโนมัติจาก ?mood=xxx (ไม่ตรงกับสินค้าใดเลย = แสดงทั้งหมด)
      const mood = normalize(new URLSearchParams(window.location.search).get('mood') || '');
      let active = 'all';
      if (mood && mood !== 'all') {
        const found = categories.find((category) => normalize(category).includes(mood));
        if (found) active = found;
      }

      renderFilters(filterBar, categories, active, (selected) => {
        renderProducts(list, items, selected);
      });
      renderProducts(list, items, active);
    })
    .catch((error) => {
      console.error(error);
      list.textContent = 'ไม่สามารถโหลดรายการสินค้าได้ กรุณาลองใหม่อีกครั้ง';
    });
}

function renderFilters(bar, categories, active, onChange) {
  if (!bar) return;
  bar.innerHTML = '';

  const options = [{ value: 'all', label: 'ทั้งหมด' }].concat(
    categories.map((category) => ({ value: category, label: category }))
  );

  const buttons = options.map((option) => {
    const button = el('button', 'btn filter-btn', option.label);
    button.type = 'button';
    button.dataset.filter = option.value;
    bar.appendChild(button);
    return button;
  });

  function setActive(value) {
    buttons.forEach((button) => {
      const isActive = button.dataset.filter === value;
      button.classList.toggle('btn--solid', isActive);
      button.classList.toggle('is-active', isActive);
      button.setAttribute('aria-pressed', String(isActive));
    });
  }

  buttons.forEach((button) => {
    button.addEventListener('click', () => {
      setActive(button.dataset.filter);
      onChange(button.dataset.filter);
    });
  });

  setActive(active);
}

function renderProducts(list, items, selected) {
  list.innerHTML = '';

  const visible = selected === 'all' ? items : items.filter((item) => item.category === selected);

  if (visible.length === 0) {
    list.textContent = 'ยังไม่มีสินค้าในหมวดนี้';
    return;
  }

  visible.forEach((item) => {
    const card = el('article', 'product-card');

    const imageWrap = el('div', 'product-card__image');
    const img = document.createElement('img');
    img.src = item.image;
    img.alt = item.name;
    img.loading = 'lazy';
    imageWrap.appendChild(img);

    const name = el('h3', 'product-card__name', item.name);
    const price = el('p', 'product-card__price', formatPrice(item.price) + ' บาท');

    const order = el('a', 'btn btn--gold', 'สั่งซื้อ');
    order.href =
      'order.html?item=' + encodeURIComponent(item.category) +
      '&price=' + encodeURIComponent(item.price);

    card.append(imageWrap, name, price, order);
    list.appendChild(card);
  });
}

/* ==========================================================
   2) order.html — เติมฟอร์มอัตโนมัติ + ส่งคำสั่งซื้อ
   ========================================================== */

function initOrderPage() {
  const form = document.getElementById('orderForm');

  // เติมชื่อสินค้า (#items) และราคา (#total) จาก URL parameter
  const params = new URLSearchParams(window.location.search);
  const item = params.get('item');
  const price = params.get('price');

  const itemsField = document.getElementById('items');
  const totalField = document.getElementById('total');
  if (item !== null && itemsField) itemsField.value = item;
  if (price !== null && totalField) totalField.value = price;

  form.addEventListener('submit', (event) => {
    event.preventDefault();

    const payload = {};
    ['customerName', 'contact', 'items', 'total', 'note'].forEach((id) => {
      const field = document.getElementById(id);
      payload[id] = field ? field.value.trim() : '';
    });

    const submitButton = form.querySelector('[type="submit"]');
    if (submitButton) submitButton.disabled = true;

    fetch(ORDER_API_URL, {
      method: 'POST',
      body: JSON.stringify(payload)
    })
    .then(() => { window.location.href = 'thankyou.html'; })
    .catch(error => {
      console.error(error);
      alert('เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง');
      if (submitButton) submitButton.disabled = false;
    });
  });
}

/* ==========================================================
   3) admin.html — ตารางคำสั่งซื้อจาก Google Sheet (CSV)
   ========================================================== */

function initAdminPage() {
  const tbody = document.querySelector('#ordersTable tbody');
  showMessageRow(tbody, 'กำลังโหลดข้อมูล...');

  fetch(ORDERS_CSV_URL)
    .then((response) => {
      if (!response.ok) throw new Error('HTTP ' + response.status);
      return response.text();
    })
    .then((text) => {
      const rows = parseCSV(text)
        .slice(1) // ข้ามแถวหัวตาราง
        .filter((row) => row.some((cell) => cell.trim() !== ''))
        .reverse(); // ชีตเพิ่มแถวต่อท้าย → กลับลำดับให้ล่าสุดขึ้นก่อน

      renderOrders(tbody, rows);
    })
    .catch((error) => {
      console.error(error);
      showMessageRow(tbody, 'ไม่สามารถโหลดข้อมูลได้ กรุณารีเฟรชหน้าอีกครั้ง');
    });
}

function renderOrders(tbody, rows) {
  tbody.innerHTML = '';

  if (rows.length === 0) {
    showMessageRow(tbody, 'ยังไม่มีคำสั่งซื้อ');
    return;
  }

  rows.forEach((row) => {
    const tr = document.createElement('tr');
    // คอลัมน์: วันเวลา, ชื่อลูกค้า, เบอร์โทร/Line, รายการสินค้า, จำนวนเงินรวม, หมายเหตุ
    for (let i = 0; i < 6; i++) {
      const value = row[i] !== undefined ? row[i] : '';
      const text = i === 4 && value !== '' && !Number.isNaN(Number(value))
        ? formatPrice(value)
        : value;
      tr.appendChild(el('td', '', text));
    }
    tbody.appendChild(tr);
  });
}

function showMessageRow(tbody, message) {
  tbody.innerHTML = '';
  const tr = document.createElement('tr');
  const td = el('td', '', message);
  td.colSpan = 6;
  tr.appendChild(td);
  tbody.appendChild(tr);
}

// parse CSV เอง: รองรับเครื่องหมายคำพูด, comma/ขึ้นบรรทัดใหม่ในช่อง, "" แทน "
function parseCSV(text) {
  const rows = [];
  let row = [];
  let field = '';
  let inQuotes = false;

  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1); // ตัด BOM

  for (let i = 0; i < text.length; i++) {
    const char = text[i];

    if (inQuotes) {
      if (char === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += char;
      }
    } else if (char === '"') {
      inQuotes = true;
    } else if (char === ',') {
      row.push(field);
      field = '';
    } else if (char === '\n' || char === '\r') {
      if (char === '\r' && text[i + 1] === '\n') i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else {
      field += char;
    }
  }

  // แถวสุดท้ายที่ไม่มี newline ปิดท้าย
  if (field !== '' || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  return rows;
}
