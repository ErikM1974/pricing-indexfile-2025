/**
 * Box Labels - Shipping & Receiving Management
 * Drag/drop box management with PDF label generation
 */

(function () {
  'use strict';

  // ==========================================
  // Configuration
  // ==========================================
  const API_BASE = window.location.origin;
  const HEROKU_BASE = 'https://caspio-pricing-proxy-ab30a049961a.herokuapp.com';
  const SIZE_COLUMNS = ['XS', 'S', 'M', 'L', 'XL', '2XL', '3XL', '4XL', '5XL', 'Other'];
  const BOX_COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316', '#6366f1', '#84cc16'];

  // ==========================================
  // State
  // ==========================================
  let currentData = null;       // Full response from /api/box-label-data
  let savedShipmentId = null;   // Caspio ID_Shipment after save
  let allExpanded = false;
  let sortableInstances = [];

  // ==========================================
  // DOM References
  // ==========================================
  const els = {};
  function initDomRefs() {
    els.searchInput = document.getElementById('searchInput');
    els.lookupBtn = document.getElementById('lookupBtn');
    els.repackerName = document.getElementById('repackerName');
    els.printAllBtn = document.getElementById('printAllBtn');
    els.orderBanner = document.getElementById('orderBanner');
    els.totalsBar = document.getElementById('totalsBar');
    els.loadingState = document.getElementById('loadingState');
    els.errorState = document.getElementById('errorState');
    els.errorMessage = document.getElementById('errorMessage');
    els.mainContent = document.getElementById('mainContent');
    els.boxContainer = document.getElementById('boxContainer');
    els.unboxedItems = document.getElementById('unboxedItems');
    els.excludedItems = document.getElementById('excludedItems');
    els.expandAllBtn = document.getElementById('expandAllBtn');
    els.addBoxBtn = document.getElementById('addBoxBtn');
    els.splitModal = document.getElementById('splitModal');
  }

  // ==========================================
  // Initialization
  // ==========================================
  document.addEventListener('DOMContentLoaded', () => {
    initDomRefs();
    loadRepackerName();
    bindEvents();
  });

  function bindEvents() {
    els.lookupBtn.addEventListener('click', handleLookup);
    els.searchInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') handleLookup();
    });
    els.printAllBtn.addEventListener('click', () => printAllLabels());
    els.expandAllBtn.addEventListener('click', toggleExpandAll);
    els.addBoxBtn.addEventListener('click', addNewBox);
    els.repackerName.addEventListener('change', saveRepackerName);

    document.getElementById('splitCancelBtn').addEventListener('click', closeSplitModal);
    document.getElementById('splitConfirmBtn').addEventListener('click', confirmSplit);
  }

  // ==========================================
  // Repacker Name (localStorage)
  // ==========================================
  function loadRepackerName() {
    const name = localStorage.getItem('bl_repacker_name') || '';
    els.repackerName.value = name;
  }

  function saveRepackerName() {
    localStorage.setItem('bl_repacker_name', els.repackerName.value.trim());
  }

  function getRepackerName() {
    return els.repackerName.value.trim() || 'Unknown';
  }

  // ==========================================
  // Lookup & Data Fetching
  // ==========================================
  async function handleLookup() {
    const identifier = els.searchInput.value.trim();
    if (!identifier) {
      els.searchInput.focus();
      return;
    }

    const type = document.querySelector('input[name="searchType"]:checked').value;
    showLoading(true);
    hideError();

    try {
      const resp = await fetch(`${API_BASE}/api/box-label-data/${encodeURIComponent(identifier)}?type=${type}`);
      if (!resp.ok) {
        const err = await resp.json().catch(() => ({}));
        throw new Error(err.error || `Lookup failed (${resp.status})`);
      }

      currentData = await resp.json();
      if (!currentData.success) throw new Error(currentData.error || 'Unknown error');

      // Show message if no data found
      if (currentData.message && (!currentData.boxes?.length) && (!currentData.unboxedItems?.length)) {
        showError(currentData.message);
      }

      renderAll();
    } catch (error) {
      showError(error.message);
    } finally {
      showLoading(false);
    }
  }

  // ==========================================
  // Rendering
  // ==========================================
  function renderAll() {
    if (!currentData) return;

    renderBanner(currentData.order);
    renderTotals(currentData.summary);
    renderBoxes(currentData.boxes || []);
    renderUnboxedItems(currentData.unboxedItems || []);
    renderExcludedItems(currentData.excludedItems || []);
    initAllDragDrop();

    els.mainContent.style.display = 'flex';
    els.printAllBtn.disabled = false;
  }

  function renderBanner(order) {
    if (!order) return;
    document.getElementById('bannerWO').textContent = order.orderNumber || '—';
    document.getElementById('bannerCompany').textContent = order.company || '—';
    document.getElementById('bannerContact').textContent = order.contact || '—';
    document.getElementById('bannerShipDate').textContent = formatDate(order.requestedShipDate) || '—';
    document.getElementById('bannerDesign').textContent =
      order.designs?.length ? `${order.designs[0].number} ${order.designs[0].name}` : '—';
    document.getElementById('bannerType').textContent = order.orderType || '—';
    document.getElementById('bannerCustPO').textContent = order.customerPO || '—';
    document.getElementById('bannerRep').textContent = order.salesRep || '—';
    els.orderBanner.style.display = 'block';
  }

  function renderTotals(summary) {
    if (!summary) return;
    document.getElementById('totalBoxed').textContent = summary.totalBoxedQty || 0;
    document.getElementById('totalWO').textContent = summary.totalWOQty || 0;
    document.getElementById('totalUnboxed').textContent = summary.totalUnboxedQty || 0;
    document.getElementById('mismatchWarning').style.display = summary.mismatch ? 'inline-block' : 'none';
    els.totalsBar.style.display = 'flex';
  }

  function renderBoxes(boxes) {
    // Destroy existing sortable instances
    sortableInstances.forEach(s => s.destroy());
    sortableInstances = [];

    els.boxContainer.innerHTML = boxes.map((box, idx) => {
      const color = BOX_COLORS[idx % BOX_COLORS.length];
      const itemCount = box.items?.length || 0;
      const totalQty = box.items?.reduce((s, i) => s + (i.totalQty || 0), 0) || 0;
      const isVerified = box.isVerified || false;
      const source = box.source || 'Custom';

      return `
        <div class="bl-box-card ${isVerified ? 'bl-box-card--verified' : ''}" data-box="${box.boxNumber}" id="box-${box.boxNumber}">
          <div class="bl-box-card__header" onclick="window.BL.toggleBox(${box.boxNumber})">
            <div class="bl-box-card__title">
              <div class="bl-box-card__number" style="background:${color};">${box.boxNumber}</div>
              <div class="bl-box-card__info">
                <div class="bl-box-card__label">
                  Box ${box.boxNumber}
                  <span class="bl-box-card__tag bl-box-card__tag--${source.toLowerCase()}">${source}</span>
                </div>
                <div class="bl-box-card__meta">
                  ${box.trackingNumber ? `<span>${box.trackingNumber}</span>` : ''}
                  <span>${itemCount} item${itemCount !== 1 ? 's' : ''}</span>
                  <span>${totalQty} pcs</span>
                </div>
              </div>
            </div>
            <div class="bl-box-card__right">
              <button class="bl-box-card__verify ${isVerified ? 'bl-box-card__verify--checked' : ''}"
                onclick="event.stopPropagation(); window.BL.verifyBox(${box.boxNumber});"
                title="Mark as verified">
                ${isVerified ? '&#10003; Verified' : '&#9744; Verify'}
              </button>
              <span class="bl-box-card__chevron">&#9660;</span>
            </div>
          </div>
          <div class="bl-box-card__body">
            <div class="bl-item-list bl-droppable" data-box="${box.boxNumber}" id="itemlist-${box.boxNumber}">
              ${itemCount > 0 ? box.items.map((item, i) => renderItemCard(item, i, box.boxNumber)).join('') : `
                <div class="bl-box-empty">Drop items here</div>
              `}
            </div>
            <div class="bl-box-card__actions">
              <button class="bl-btn bl-btn--small bl-btn--outline" onclick="window.BL.printBoxLabel(${box.boxNumber})">
                &#128438; Print Box ${box.boxNumber}
              </button>
              <button class="bl-btn bl-btn--small bl-btn--danger" onclick="window.BL.deleteBox(${box.boxNumber})"
                ${itemCount > 0 ? 'disabled title="Remove all items first"' : ''}>
                Delete Box
              </button>
            </div>
          </div>
        </div>
      `;
    }).join('');
  }

  function renderItemCard(item, index, boxNumber) {
    const contentId = item.contentId || item.Box_ID || `${boxNumber}-${index}`;
    const sizeHtml = renderSizeGrid(item.sizes || item);
    const totalQty = item.totalQty || item.Total_Qty || 0;

    return `
      <div class="bl-item-card" data-content-id="${contentId}" data-box="${boxNumber}">
        <div class="bl-item-card__header">
          <div>
            <div class="bl-item-card__style">${escapeHtml(item.style || item.Style_Number || '')}</div>
            <div class="bl-item-card__color">${escapeHtml(item.color || item.Color || '')}</div>
          </div>
          <div class="bl-item-card__qty">${totalQty} pcs</div>
        </div>
        <div class="bl-item-card__desc">${escapeHtml(item.description || item.Description || '')}</div>
        ${sizeHtml}
      </div>
    `;
  }

  function renderSizeGrid(sizes) {
    // Handle both { S: 1, M: 2 } format and { Size_S: 1, Size_M: 2 } format
    const sizeMap = {};
    if (sizes.Size_S !== undefined) {
      // Caspio format
      SIZE_COLUMNS.forEach(s => {
        const key = s === '2XL' ? 'Size_2XL' : s === '3XL' ? 'Size_3XL' : s === '4XL' ? 'Size_4XL' : s === '5XL' ? 'Size_5XL' : `Size_${s}`;
        sizeMap[s] = sizes[key] || 0;
      });
    } else {
      SIZE_COLUMNS.forEach(s => { sizeMap[s] = sizes[s] || 0; });
    }

    const activeSizes = SIZE_COLUMNS.filter(s => sizeMap[s] > 0);
    if (activeSizes.length === 0) return '';

    return `<div class="bl-size-grid">${
      SIZE_COLUMNS.map(s => {
        const val = sizeMap[s] || 0;
        if (val === 0 && !activeSizes.includes(s)) return ''; // Hide completely empty sizes
        const hasValue = val > 0;
        return `
          <div class="bl-size-cell ${hasValue ? 'bl-size-cell--has-value' : 'bl-size-cell--empty'}">
            <div class="bl-size-cell__label">${s}</div>
            <div class="bl-size-cell__value">${hasValue ? val : '-'}</div>
          </div>
        `;
      }).join('')
    }</div>`;
  }

  function renderUnboxedItems(items) {
    if (!items.length) {
      els.unboxedItems.innerHTML = '<div class="bl-box-empty">No unboxed items</div>';
      return;
    }

    els.unboxedItems.innerHTML = items.map((item, i) => {
      const contentId = item.contentId || item.Box_ID || `unboxed-${i}`;
      const totalQty = item.totalQty || item.Total_Qty || 0;
      const vendor = item.vendor || 'Other';

      return `
        <div class="bl-item-card" data-content-id="${contentId}" data-box="0">
          <div class="bl-item-card__header">
            <div>
              <div class="bl-item-card__style">${escapeHtml(item.style || item.Style_Number || '')}</div>
              <div class="bl-item-card__color">${escapeHtml(item.color || item.Color || '')} <small>(${vendor})</small></div>
            </div>
            <div class="bl-item-card__qty">${totalQty} pcs</div>
          </div>
          <div class="bl-item-card__desc">${escapeHtml(item.description || item.Description || '')}</div>
          ${renderSizeGrid(item.sizes || item)}
        </div>
      `;
    }).join('');
  }

  function renderExcludedItems(items) {
    if (!items.length) {
      els.excludedItems.innerHTML = '<div class="bl-excluded-item"><span>No excluded items</span></div>';
      return;
    }

    els.excludedItems.innerHTML = items.map(item => `
      <div class="bl-excluded-item">
        <span class="bl-excluded-item__name">${escapeHtml(item.description || item.partNumber || '')}</span>
        <small>${item.reason || ''}</small>
      </div>
    `).join('');
  }

  // ==========================================
  // Drag & Drop (SortableJS)
  // ==========================================
  function initAllDragDrop() {
    sortableInstances.forEach(s => s.destroy());
    sortableInstances = [];

    // Make each box's item list sortable
    document.querySelectorAll('.bl-item-list.bl-droppable').forEach(list => {
      const s = new Sortable(list, {
        group: 'box-items',
        animation: 150,
        ghostClass: 'sortable-ghost',
        dragClass: 'sortable-drag',
        chosenClass: 'sortable-chosen',
        handle: '.bl-item-card',
        onEnd: handleDragEnd,
        onMove: function (evt) {
          // Allow dropping on empty boxes
          return true;
        }
      });
      sortableInstances.push(s);
    });
  }

  function handleDragEnd(evt) {
    const itemEl = evt.item;
    const contentId = itemEl.dataset.contentId;
    const fromBox = parseInt(evt.from.dataset.box) || 0;
    const toBox = parseInt(evt.to.dataset.box) || 0;

    if (fromBox === toBox) return; // No change

    // Update the data-box attribute
    itemEl.dataset.box = toBox;

    // Remove the empty placeholder if items were dropped
    const emptyPlaceholder = evt.to.querySelector('.bl-box-empty');
    if (emptyPlaceholder) emptyPlaceholder.remove();

    // Add empty placeholder if source is now empty
    if (evt.from.children.length === 0) {
      evt.from.innerHTML = '<div class="bl-box-empty">Drop items here</div>';
    }

    // Save the move to backend (debounced)
    saveMoveToBackend(contentId, fromBox, toBox);

    // Update totals
    recalcTotals();
  }

  let saveTimeout = null;
  function saveMoveToBackend(contentId, fromBox, toBox) {
    clearTimeout(saveTimeout);
    saveTimeout = setTimeout(async () => {
      try {
        if (savedShipmentId) {
          await fetch(`${API_BASE}/api/box-contents/move`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ contentId, fromBox, toBox })
          });
        }
      } catch (err) {
        console.error('[BoxLabels] Save move failed:', err);
      }
    }, 500);
  }

  // ==========================================
  // Box Actions
  // ==========================================
  function toggleBox(boxNumber) {
    const card = document.getElementById(`box-${boxNumber}`);
    if (card) card.classList.toggle('bl-box-card--expanded');
  }

  function toggleExpandAll() {
    allExpanded = !allExpanded;
    document.querySelectorAll('.bl-box-card').forEach(card => {
      if (allExpanded) {
        card.classList.add('bl-box-card--expanded');
      } else {
        card.classList.remove('bl-box-card--expanded');
      }
    });
    els.expandAllBtn.textContent = allExpanded ? 'Collapse All' : 'Expand All';
  }

  function addNewBox() {
    if (!currentData) return;

    const boxes = currentData.boxes || [];
    const newBoxNumber = boxes.length > 0 ? Math.max(...boxes.map(b => b.boxNumber)) + 1 : 1;

    boxes.push({
      boxNumber: newBoxNumber,
      source: 'Custom',
      trackingNumber: '',
      carrier: '',
      items: [],
      isVerified: false
    });

    currentData.boxes = boxes;
    renderBoxes(boxes);
    initAllDragDrop();

    // Expand the new box
    const newCard = document.getElementById(`box-${newBoxNumber}`);
    if (newCard) newCard.classList.add('bl-box-card--expanded');
  }

  function deleteBox(boxNumber) {
    if (!currentData) return;
    const box = currentData.boxes.find(b => b.boxNumber === boxNumber);
    if (box && box.items && box.items.length > 0) {
      alert('Remove all items from this box before deleting it.');
      return;
    }

    currentData.boxes = currentData.boxes.filter(b => b.boxNumber !== boxNumber);
    renderBoxes(currentData.boxes);
    initAllDragDrop();
    recalcTotals();
  }

  async function verifyBox(boxNumber) {
    if (!currentData) return;
    const box = currentData.boxes.find(b => b.boxNumber === boxNumber);
    if (!box) return;

    box.isVerified = !box.isVerified;
    box.verifiedBy = box.isVerified ? getRepackerName() : '';

    renderBoxes(currentData.boxes);
    initAllDragDrop();

    // Save to backend if we have a shipment ID
    if (savedShipmentId && box.isVerified) {
      try {
        await fetch(`${API_BASE}/api/box-shipments/${savedShipmentId}/verify-box`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ boxNumber, verifiedBy: getRepackerName() })
        });
      } catch (err) {
        console.error('[BoxLabels] Verify save failed:', err);
      }
    }
  }

  function recalcTotals() {
    if (!currentData) return;
    const boxes = currentData.boxes || [];
    const totalBoxedQty = boxes.reduce((s, b) =>
      s + (b.items || []).reduce((s2, i) => s2 + (i.totalQty || i.Total_Qty || 0), 0), 0
    );
    const totalWO = currentData.summary?.totalWOQty || 0;

    document.getElementById('totalBoxed').textContent = totalBoxedQty;
    document.getElementById('totalUnboxed').textContent = totalWO - totalBoxedQty;
    document.getElementById('mismatchWarning').style.display =
      totalBoxedQty !== totalWO ? 'inline-block' : 'none';
  }

  // ==========================================
  // Split Modal
  // ==========================================
  let splitState = {};

  function openSplitModal(contentId, item, fromBox, toBox) {
    splitState = { contentId, item, fromBox, toBox };

    document.getElementById('splitModalTitle').textContent =
      `Move items: Box ${fromBox} → Box ${toBox}`;
    document.getElementById('splitModalSubtitle').textContent =
      `${item.style || item.Style_Number} - ${item.color || item.Color}`;

    const sizes = item.sizes || item;
    const grid = document.getElementById('splitModalSizes');
    grid.innerHTML = SIZE_COLUMNS.map(s => {
      const key = sizes.Size_S !== undefined ?
        (s === '2XL' ? 'Size_2XL' : s === '3XL' ? 'Size_3XL' : `Size_${s}`) : s;
      const avail = sizes[key] || 0;
      if (avail === 0) return '';
      return `
        <div class="bl-split-cell">
          <label>${s}</label>
          <div class="bl-split-cell__avail">Avail: ${avail}</div>
          <input type="number" min="0" max="${avail}" value="0" data-size="${s}" data-max="${avail}">
        </div>
      `;
    }).join('');

    els.splitModal.style.display = 'flex';
  }

  function closeSplitModal() {
    els.splitModal.style.display = 'none';
    splitState = {};
  }

  async function confirmSplit() {
    const splitSizes = {};
    els.splitModal.querySelectorAll('input[data-size]').forEach(input => {
      const val = parseInt(input.value) || 0;
      const max = parseInt(input.dataset.max) || 0;
      if (val > 0) splitSizes[input.dataset.size] = Math.min(val, max);
    });

    if (Object.keys(splitSizes).length === 0) {
      closeSplitModal();
      return;
    }

    // Update local state and re-render
    closeSplitModal();

    if (savedShipmentId) {
      try {
        await fetch(`${API_BASE}/api/box-contents/move`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contentId: splitState.contentId,
            fromBox: splitState.fromBox,
            toBox: splitState.toBox,
            shipmentId: savedShipmentId,
            splitSizes
          })
        });
      } catch (err) {
        console.error('[BoxLabels] Split save failed:', err);
      }
    }
  }

  // ==========================================
  // PDF Generation
  // ==========================================
  function printAllLabels() {
    if (!currentData?.boxes?.length) return;
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'letter' });

    const boxes = currentData.boxes.filter(b => b.items && b.items.length > 0);
    const totalBoxes = boxes.length;

    boxes.forEach((box, idx) => {
      if (idx > 0) doc.addPage();
      drawBoxLabel(doc, box, currentData.order, idx + 1, totalBoxes);
    });

    doc.autoPrint();
    window.open(doc.output('bloburl'), '_blank');
  }

  function printBoxLabel(boxNumber) {
    if (!currentData) return;
    const box = currentData.boxes.find(b => b.boxNumber === boxNumber);
    if (!box) return;

    const totalBoxes = currentData.boxes.filter(b => b.items?.length > 0).length;
    const boxIdx = currentData.boxes.filter(b => b.items?.length > 0).indexOf(box) + 1;

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'letter' });
    drawBoxLabel(doc, box, currentData.order, boxIdx, totalBoxes);

    doc.autoPrint();
    window.open(doc.output('bloburl'), '_blank');
  }

  function drawBoxLabel(doc, box, order, boxIdx, totalBoxes) {
    const pageW = 215.9;
    const margin = 10;
    const contentW = pageW - margin * 2;
    let y = margin;

    // === BARCODE ===
    try {
      const canvas = document.createElement('canvas');
      JsBarcode(canvas, String(order.orderNumber || '0'), {
        format: 'CODE128',
        width: 2,
        height: 50,
        displayValue: false,
        margin: 0
      });
      doc.addImage(canvas.toDataURL(), 'PNG', margin, y, 80, 18);
    } catch (e) { /* barcode failed, skip */ }

    // === ORDER ID (right side, huge) ===
    doc.setFontSize(42);
    doc.setFont('helvetica', 'bold');
    doc.text(String(order.orderNumber || ''), pageW - margin, y + 16, { align: 'right' });

    // Small "Order ID" label
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text('Order ID', pageW - margin, y + 4, { align: 'right' });

    y += 24;

    // === TYPE & REQ SHIP DATE ===
    doc.setFontSize(12);
    doc.setFont('helvetica', 'normal');
    doc.text(`Type: ${order.orderType || ''}`, margin, y);

    doc.setFontSize(9);
    doc.text('Req. Ship Date', pageW - margin, y - 4, { align: 'right' });
    doc.setFontSize(24);
    doc.setFont('helvetica', 'bold');
    doc.text(formatDate(order.requestedShipDate) || '', pageW - margin, y + 5, { align: 'right' });
    y += 12;

    // === COMPANY ===
    doc.setFontSize(22);
    doc.setFont('helvetica', 'bold');
    const companyLines = doc.splitTextToSize(order.company || '', contentW * 0.6);
    companyLines.forEach(line => {
      doc.text(line, margin, y);
      y += 9;
    });

    // === CONTACT ===
    doc.setFontSize(12);
    doc.setFont('helvetica', 'normal');
    doc.text(`Contact: ${order.contact || ''}`, margin, y);

    // Drop Dead Date (right side)
    if (order.dropDeadDate) {
      doc.setFontSize(9);
      doc.text('Drop Dead Date', pageW - margin, y - 4, { align: 'right' });
      doc.setFontSize(16);
      doc.setFont('helvetica', 'bold');
      doc.text(formatDate(order.dropDeadDate), pageW - margin, y + 2, { align: 'right' });
    }
    y += 8;

    // === CUST PO ===
    doc.setFontSize(12);
    doc.setFont('helvetica', 'normal');
    doc.text(`Cust PO: ${order.customerPO || ''}`, margin, y);
    y += 8;

    // === SEPARATOR ===
    doc.setDrawColor(200);
    doc.line(margin, y, pageW - margin, y);
    y += 6;

    // === DESIGNS ===
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('Designs', margin, y);
    y += 7;

    if (order.designs?.length) {
      doc.setFontSize(14);
      doc.setFont('helvetica', 'normal');
      order.designs.forEach(d => {
        doc.text(`${d.number}  ${d.name}`, margin + 4, y);
        y += 7;
      });
    }
    y += 2;

    // === SEPARATOR ===
    doc.line(margin, y, pageW - margin, y);
    y += 6;

    // === CONTENTS ===
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('Contents', margin, y);
    y += 8;

    for (const item of (box.items || [])) {
      // Style line
      doc.setFontSize(13);
      doc.setFont('helvetica', 'bold');
      doc.text(`${item.style || item.Style_Number || ''} - ${item.description || item.Description || ''}`, margin + 2, y);
      y += 6;

      // Color line
      doc.setFontSize(11);
      doc.setFont('helvetica', 'normal');
      doc.text(`Color: ${item.color || item.Color || ''}`, margin + 2, y);
      y += 6;

      // Size grid table
      const sizes = item.sizes || item;
      const sizeData = SIZE_COLUMNS.map(s => {
        const key = sizes.Size_S !== undefined ?
          (s === '2XL' ? 'Size_2XL' : s === '3XL' ? 'Size_3XL' : s === '4XL' ? 'Size_4XL' : s === '5XL' ? 'Size_5XL' : `Size_${s}`) : s;
        return sizes[key] || 0;
      });

      // Only show sizes that have values
      const activeCols = [];
      const activeVals = [];
      SIZE_COLUMNS.forEach((s, i) => {
        if (sizeData[i] > 0) {
          activeCols.push(s);
          activeVals.push(String(sizeData[i]));
        }
      });

      if (activeCols.length > 0) {
        doc.autoTable({
          startY: y,
          margin: { left: margin + 2, right: margin + 2 },
          head: [activeCols],
          body: [activeVals],
          theme: 'grid',
          styles: {
            fontSize: 16,
            fontStyle: 'bold',
            halign: 'center',
            cellPadding: 3,
            lineWidth: 0.5,
            lineColor: [0, 0, 0]
          },
          headStyles: {
            fillColor: [240, 240, 240],
            textColor: [60, 60, 60],
            fontSize: 10,
            fontStyle: 'bold'
          },
          bodyStyles: {
            fillColor: [255, 255, 255],
            textColor: [0, 0, 0]
          },
          tableWidth: Math.min(activeCols.length * 22, contentW - 4)
        });
        y = doc.lastAutoTable.finalY + 8;
      } else {
        y += 4;
      }

      // Check if we need a new page
      if (y > 240) {
        y = 240; // Truncate — label should fit on one page
        break;
      }
    }

    // === SEPARATOR ===
    const bottomY = 250;
    doc.setDrawColor(200);
    doc.line(margin, bottomY - 8, pageW - margin, bottomY - 8);

    // === TRACKING ===
    if (box.trackingNumber) {
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.text(`Tracking: ${box.trackingNumber}`, margin, bottomY - 2);
    }

    // === QR CODE ===
    try {
      const qr = qrcode(0, 'M');
      const labelUrl = `${window.location.origin}/pages/box-labels.html?shipment=${savedShipmentId || ''}&box=${boxIdx}`;
      qr.addData(labelUrl);
      qr.make();
      const qrDataUrl = qr.createDataURL(4, 0);
      doc.addImage(qrDataUrl, 'PNG', margin, bottomY + 2, 22, 22);
      doc.setFontSize(7);
      doc.text('Scan to view', margin, bottomY + 27);
    } catch (e) { /* QR failed, skip */ }

    // === BOX X OF Y (big, centered) ===
    doc.setFontSize(32);
    doc.setFont('helvetica', 'bold');
    doc.text(`BOX  ${boxIdx}  OF  ${totalBoxes}`, pageW / 2, bottomY + 14, { align: 'center' });
  }

  // ==========================================
  // Utilities
  // ==========================================
  function formatDate(dateStr) {
    if (!dateStr) return '';
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return dateStr;
      return `${d.getMonth() + 1}/${d.getDate()}/${String(d.getFullYear()).slice(2)}`;
    } catch {
      return dateStr;
    }
  }

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str || '';
    return div.innerHTML;
  }

  function showLoading(show) {
    els.loadingState.style.display = show ? 'block' : 'none';
    if (show) {
      els.mainContent.style.display = 'none';
      els.orderBanner.style.display = 'none';
      els.totalsBar.style.display = 'none';
    }
  }

  function showError(msg) {
    els.errorMessage.textContent = msg;
    els.errorState.style.display = 'flex';
  }

  function hideError() {
    els.errorState.style.display = 'none';
  }

  // ==========================================
  // Public API (called from HTML onclick)
  // ==========================================
  window.BL = {
    toggleBox,
    verifyBox,
    printBoxLabel,
    deleteBox,
    openSplitModal
  };

})();
