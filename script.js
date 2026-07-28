/* ==========================================================================
   FORMA — Warenkorb, Bestellprozess & WhatsApp-Übergabe
   Reine Frontend-Logik, kein eigenes Backend.
   ========================================================================== */

(function () {
  "use strict";

  /* WhatsApp-Konfiguration -------------------------------------------------
     Telefonnummer der Boutique im internationalen Format, nur Ziffern
     (kein "+", keine Leerzeichen, keine führende "00").
     TODO: durch die echte Geschäftsnummer ersetzen. */
  const WHATSAPP_NUMBER = "436764639210";

  /* 20 Platzhalterfarben ------------------------------------------------- */
  const COLORS = [
    { name: "Rot",          hex: "#990000" },
    { name: "Terrakotta",   hex: "#C77B52" },
    { name: "Olivgrün",     hex: "#7C8363" },
    { name: "Anthrazit",    hex: "#3B3A36" },
    { name: "Creme",        hex: "#EFE6D8" },
    { name: "Rostrot",      hex: "#A6542E" },
    { name: "Salbeigrün",   hex: "#A3B18A" },
    { name: "Karamell",     hex: "#B98C5A" },
    { name: "Taupe",        hex: "#9C8D7C" },
    { name: "Schiefergrau", hex: "#5C6670" },
    { name: "Senfgelb",     hex: "#C9A227" },
    { name: "Rauchblau",    hex: "#6E7F8D" },
    { name: "Bordeaux",     hex: "#6E2C33" },
    { name: "Moosgrün",     hex: "#556B4F" },
    { name: "Champagner",   hex: "#E9DCC3" },
    { name: "Kupfer",       hex: "#B5652D" },
    { name: "Graphit",      hex: "#262523" },
    { name: "Elfenbein",    hex: "#F0E9DC" },
    { name: "Pflaume",      hex: "#5B3A52" },
    { name: "Ozeanblau",    hex: "#33556B" }
  ];

  /* Warenkorb-Zustand: [{ id, name, price, ph, colorName, colorHex, qty }] */
  let cart = [];

  /* Merkt sich, für welches Produkt gerade eine Farbe gewählt wird */
  let pendingProduct = null;

  /* Referenzen -------------------------------------------------------- */
  const cartToggle   = document.getElementById("cartToggle");
  const cartClose    = document.getElementById("cartClose");
  const cartOverlay  = document.getElementById("cartOverlay");
  const cartDrawer   = document.getElementById("cartDrawer");
  const cartItemsEl  = document.getElementById("cartItems");
  const cartEmptyEl  = document.getElementById("cartEmpty");
  const cartTotalEl  = document.getElementById("cartTotal");
  const cartCountEl  = document.getElementById("cartCount");

  const colorOverlay  = document.getElementById("colorOverlay");
  const colorModal    = document.getElementById("colorModal");
  const colorClose    = document.getElementById("colorClose");
  const colorGrid     = document.getElementById("colorGrid");
  const colorProductEl = document.getElementById("colorModalProduct");

  const toastEl = document.getElementById("toast");

  const checkoutForm   = document.getElementById("checkoutForm");
  const submitOrderBtn = document.getElementById("submitOrderBtn");
  const nameInput       = document.getElementById("customerName");
  const noteInput       = document.getElementById("customerNote");

  const confirmOverlay = document.getElementById("confirmOverlay");
  const confirmModal   = document.getElementById("confirmModal");
  const confirmNameEl  = document.getElementById("confirmName");
  const confirmNoteRow = document.getElementById("confirmNoteRow");
  const confirmNoteEl  = document.getElementById("confirmNote");
  const confirmSummaryEl = document.getElementById("confirmSummary");
  const confirmTotalEl = document.getElementById("confirmTotal");
  const confirmBackBtn = document.getElementById("confirmBack");
  const confirmSubmitBtn = document.getElementById("confirmSubmit");

  const successOverlay = document.getElementById("successOverlay");
  const successModal   = document.getElementById("successModal");
  const successTextEl  = document.getElementById("successText");
  const successCloseBtn = document.getElementById("successClose");

  /* Hilfsfunktionen ----------------------------------------------------- */

  function formatPrice(value) {
    return value.toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + "\u00A0€";
  }

  function lockScroll(lock) {
    document.body.classList.toggle("no-scroll", lock);
  }

  function refreshScrollLock() {
    const anyOpen =
      cartDrawer.classList.contains("open") ||
      colorModal.classList.contains("show") ||
      confirmModal.classList.contains("show") ||
      successModal.classList.contains("show");
    lockScroll(anyOpen);
  }

  /* Warenkorb-Drawer ------------------------------------------------------ */

  function openCart() {
    cartDrawer.classList.add("open");
    cartOverlay.classList.add("show");
    cartDrawer.setAttribute("aria-hidden", "false");
    cartToggle.setAttribute("aria-expanded", "true");
    refreshScrollLock();
  }

  function closeCart() {
    cartDrawer.classList.remove("open");
    cartOverlay.classList.remove("show");
    cartDrawer.setAttribute("aria-hidden", "true");
    cartToggle.setAttribute("aria-expanded", "false");
    refreshScrollLock();
  }

  /* Farbauswahl-Dialog ----------------------------------------------------- */

  function openColorModal(product) {
    pendingProduct = product;
    colorProductEl.textContent = product.name;

    colorGrid.innerHTML = "";
    COLORS.forEach((color) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "color-swatch";
      btn.setAttribute("aria-label", color.name);

      const dot = document.createElement("span");
      dot.className = "color-swatch-dot";
      dot.style.background = color.hex;

      const label = document.createElement("span");
      label.className = "color-swatch-label";
      label.textContent = color.name;

      btn.appendChild(dot);
      btn.appendChild(label);

      btn.addEventListener("click", () => selectColor(color, btn));
      colorGrid.appendChild(btn);
    });

    colorModal.classList.add("show");
    colorOverlay.classList.add("show");
    colorModal.setAttribute("aria-hidden", "false");
    refreshScrollLock();
  }

  function closeColorModal() {
    colorModal.classList.remove("show");
    colorOverlay.classList.remove("show");
    colorModal.setAttribute("aria-hidden", "true");
    pendingProduct = null;
    refreshScrollLock();
  }

  function selectColor(color, swatchEl) {
    if (!pendingProduct) return;

    // Kurzes visuelles Feedback, bevor der Dialog schließt
    colorGrid.querySelectorAll(".color-swatch.selected").forEach((el) => el.classList.remove("selected"));
    swatchEl.classList.add("selected");

    const product = pendingProduct;

    window.setTimeout(() => {
      addToCart(product, color);
      closeColorModal();
      showToast("Artikel wurde zum Warenkorb hinzugefügt");
    }, 220);
  }

  /* Warenkorb-Logik ----------------------------------------------------- */

  function addToCart(product, color) {
    const existing = cart.find(
      (line) => line.id === product.id && line.colorName === color.name
    );

    if (existing) {
      existing.qty += 1;
    } else {
      cart.push({
        id: product.id,
        name: product.name,
        price: product.price,
        ph: product.ph,
        colorName: color.name,
        colorHex: color.hex,
        qty: 1
      });
    }

    renderCart();
  }

  function changeQty(id, colorName, delta) {
    const line = cart.find((l) => l.id === id && l.colorName === colorName);
    if (!line) return;

    line.qty += delta;

    if (line.qty <= 0) {
      removeLine(id, colorName);
      return;
    }

    renderCart();
  }

  function removeLine(id, colorName) {
    cart = cart.filter((l) => !(l.id === id && l.colorName === colorName));
    renderCart();
  }

  function groupCart(cartArr) {
    const groups = [];
    const groupIndex = {};

    cartArr.forEach((line) => {
      if (!(line.id in groupIndex)) {
        groupIndex[line.id] = groups.length;
        groups.push({ id: line.id, name: line.name, ph: line.ph, lines: [] });
      }
      groups[groupIndex[line.id]].lines.push(line);
    });

    return groups;
  }

  function cartTotal() {
    return cart.reduce((sum, l) => sum + l.price * l.qty, 0);
  }

  function renderCart() {
    // Gesamt-Stückzahl fürs Badge
    const totalCount = cart.reduce((sum, l) => sum + l.qty, 0);
    cartCountEl.textContent = String(totalCount);

    // Leerer Zustand: kein Bestellformular, kein Button
    if (cart.length === 0) {
      cartEmptyEl.classList.remove("hidden");
      cartItemsEl.innerHTML = "";
      cartTotalEl.textContent = formatPrice(0);
      checkoutForm.classList.add("hidden");
      submitOrderBtn.classList.add("hidden");
      return;
    }
    cartEmptyEl.classList.add("hidden");
    checkoutForm.classList.remove("hidden");
    submitOrderBtn.classList.remove("hidden");

    const groups = groupCart(cart);

    cartItemsEl.innerHTML = "";
    let grandTotal = 0;

    groups.forEach((group) => {
      const groupEl = document.createElement("div");
      groupEl.className = "cart-group";

      const titleEl = document.createElement("div");
      titleEl.className = "cart-group-title";
      titleEl.innerHTML =
        '<span class="cart-thumb ' + group.ph + '"></span>' +
        '<span class="cart-group-name"></span>';
      titleEl.querySelector(".cart-group-name").textContent = group.name;
      groupEl.appendChild(titleEl);

      const linesEl = document.createElement("div");
      linesEl.className = "cart-lines";

      group.lines.forEach((line) => {
        const lineTotal = line.price * line.qty;
        grandTotal += lineTotal;

        const lineEl = document.createElement("div");
        lineEl.className = "cart-line";

        lineEl.innerHTML =
          '<span class="color-dot" style="background:' + line.colorHex + '"></span>' +
          '<span class="cart-line-name"></span>' +
          '<span class="qty-stepper">' +
            '<button type="button" class="qty-minus" aria-label="Menge verringern">−</button>' +
            '<span class="qty-value"></span>' +
            '<button type="button" class="qty-plus" aria-label="Menge erhöhen">+</button>' +
          '</span>' +
          '<span class="line-price"></span>' +
          '<button type="button" class="line-remove" aria-label="Artikel entfernen">' +
            '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>' +
          '</button>';

        lineEl.querySelector(".cart-line-name").textContent = line.colorName;
        lineEl.querySelector(".qty-value").textContent = line.qty;
        lineEl.querySelector(".line-price").textContent = formatPrice(lineTotal);

        lineEl.querySelector(".qty-minus").disabled = line.qty <= 1;
        lineEl.querySelector(".qty-minus").addEventListener("click", () =>
          changeQty(line.id, line.colorName, -1)
        );
        lineEl.querySelector(".qty-plus").addEventListener("click", () =>
          changeQty(line.id, line.colorName, 1)
        );
        lineEl.querySelector(".line-remove").addEventListener("click", () =>
          removeLine(line.id, line.colorName)
        );

        linesEl.appendChild(lineEl);
      });

      groupEl.appendChild(linesEl);
      cartItemsEl.appendChild(groupEl);
    });

    cartTotalEl.textContent = formatPrice(grandTotal);
  }

  /* Bestellprozess ----------------------------------------------------- */

  function validateName() {
    const valid = nameInput.value.trim() !== "";
    nameInput.classList.toggle("invalid", !valid);
    return valid;
  }

  function generateOrderNumber() {
    const rand = Math.floor(1000 + Math.random() * 9000);
    return "FORMA-" + rand;
  }

  function buildWhatsAppMessage(name, note, cartArr, total, orderNumber) {
    const lines = [];

    lines.push("*Neue Bestellung – FORMA*");
    lines.push("Bestellnummer: " + orderNumber);
    lines.push("");
    lines.push("*Kunde:* " + name);
    lines.push("");
    lines.push("*Artikel:*");

    cartArr.forEach((line, index) => {
      const lineTotal = line.price * line.qty;
      lines.push(
        (index + 1) + ". " + line.name + " (" + line.colorName + ")\n" +
        "   " + line.qty + " × " + formatPrice(line.price) + " = " + formatPrice(lineTotal)
      );
    });

    lines.push("");
    lines.push("*Gesamtsumme: " + formatPrice(total) + "*");

    if (note !== "") {
      lines.push("");
      lines.push("*Notiz:*");
      lines.push(note);
    }

    return lines.join("\n");
  }

  function openWhatsAppOrder(name, note, cartArr, total, orderNumber) {
    const message = buildWhatsAppMessage(name, note, cartArr, total, orderNumber);
    const url = "https://wa.me/" + WHATSAPP_NUMBER + "?text=" + encodeURIComponent(message);
    window.open(url, "_blank", "noopener");
  }

  function buildConfirmSummary() {
    confirmSummaryEl.innerHTML = "";

    groupCart(cart).forEach((group) => {
      const groupEl = document.createElement("div");
      groupEl.className = "confirm-summary-group";

      const nameEl = document.createElement("div");
      nameEl.className = "confirm-group-name";
      nameEl.textContent = group.name;
      groupEl.appendChild(nameEl);

      group.lines.forEach((line) => {
        const lineEl = document.createElement("div");
        lineEl.className = "confirm-line";
        lineEl.innerHTML =
          '<span class="color-dot" style="background:' + line.colorHex + '"></span>' +
          '<span class="confirm-line-name"></span>' +
          '<span class="confirm-line-qty"></span>' +
          '<span class="confirm-line-price"></span>';

        lineEl.querySelector(".confirm-line-name").textContent = line.colorName;
        lineEl.querySelector(".confirm-line-qty").textContent = "× " + line.qty;
        lineEl.querySelector(".confirm-line-price").textContent = formatPrice(line.price * line.qty);

        groupEl.appendChild(lineEl);
      });

      confirmSummaryEl.appendChild(groupEl);
    });
  }

  function openConfirmModal() {
    const name = nameInput.value.trim();
    const note = noteInput.value.trim();

    confirmNameEl.textContent = name;

    if (note !== "") {
      confirmNoteEl.textContent = note;
      confirmNoteRow.classList.remove("hidden");
    } else {
      confirmNoteRow.classList.add("hidden");
    }

    buildConfirmSummary();
    confirmTotalEl.textContent = formatPrice(cartTotal());

    confirmModal.classList.add("show");
    confirmOverlay.classList.add("show");
    confirmModal.setAttribute("aria-hidden", "false");
    refreshScrollLock();
  }

  function closeConfirmModal() {
    confirmModal.classList.remove("show");
    confirmOverlay.classList.remove("show");
    confirmModal.setAttribute("aria-hidden", "true");
    refreshScrollLock();
  }

  function openSuccessModal(name, orderNumber) {
    successTextEl.textContent =
      "Vielen Dank, " + name + "! Deine Bestellung (" + orderNumber + ") wurde vorbereitet. " +
      "Wir haben WhatsApp mit allen Details in einem neuen Tab geöffnet — bitte sende die Nachricht dort ab, um deine Bestellung zu übermitteln.";

    successModal.classList.add("show");
    successOverlay.classList.add("show");
    successModal.setAttribute("aria-hidden", "false");
    refreshScrollLock();
  }

  function closeSuccessModal() {
    successModal.classList.remove("show");
    successOverlay.classList.remove("show");
    successModal.setAttribute("aria-hidden", "true");
    refreshScrollLock();
  }

  function resetOrder() {
    cart = [];
    renderCart();
    nameInput.value = "";
    noteInput.value = "";
    nameInput.classList.remove("invalid");
  }

  /* Toast ----------------------------------------------------------------- */

  let toastTimer = null;

  function showToast(message) {
    toastEl.textContent = message;
    toastEl.classList.add("show");

    if (toastTimer) window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(() => {
      toastEl.classList.remove("show");
    }, 2600);
  }

  /* Event-Bindung ----------------------------------------------------------- */

  document.querySelectorAll(".btn-cart").forEach((btn) => {
    btn.addEventListener("click", () => {
      const product = {
        id: Number(btn.dataset.id),
        name: btn.dataset.name,
        price: parseFloat(btn.dataset.price),
        ph: btn.dataset.ph
      };
      openColorModal(product);
    });
  });

  cartToggle.addEventListener("click", openCart);
  cartClose.addEventListener("click", closeCart);
  cartOverlay.addEventListener("click", closeCart);

  colorClose.addEventListener("click", closeColorModal);
  colorOverlay.addEventListener("click", closeColorModal);

  submitOrderBtn.addEventListener("click", () => {
    if (!validateName()) {
      nameInput.focus();
      return;
    }
    openConfirmModal();
  });

  nameInput.addEventListener("input", () => {
    if (nameInput.classList.contains("invalid") && nameInput.value.trim() !== "") {
      nameInput.classList.remove("invalid");
    }
  });

  confirmBackBtn.addEventListener("click", closeConfirmModal);
  confirmOverlay.addEventListener("click", closeConfirmModal);

  confirmSubmitBtn.addEventListener("click", () => {
    const name = nameInput.value.trim();
    const note = noteInput.value.trim();
    const orderNumber = generateOrderNumber();
    const total = cartTotal();

    // WhatsApp-Nachricht mit den aktuellen Warenkorbdaten vorbereiten,
    // bevor der Warenkorb zurückgesetzt wird.
    openWhatsAppOrder(name, note, cart, total, orderNumber);

    closeConfirmModal();
    resetOrder();
    closeCart();
    openSuccessModal(name, orderNumber);
  });

  successCloseBtn.addEventListener("click", closeSuccessModal);
  successOverlay.addEventListener("click", closeSuccessModal);

  document.addEventListener("keydown", (e) => {
    if (e.key !== "Escape") return;
    if (successModal.classList.contains("show")) closeSuccessModal();
    else if (confirmModal.classList.contains("show")) closeConfirmModal();
    else if (colorModal.classList.contains("show")) closeColorModal();
    else if (cartDrawer.classList.contains("open")) closeCart();
  });

  // Initialer Render (leerer Warenkorb)
  renderCart();
})();
