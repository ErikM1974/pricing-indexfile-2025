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
  // SanMar uses XXL/XXXL, we normalize to 2XL/3XL
  const SIZE_ALIASES = { 'XXL': '2XL', 'XXXL': '3XL', 'XXXXL': '4XL', 'XXXXXL': '5XL' };
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
    document.getElementById('linkWOBtn').addEventListener('click', handleLinkWO);
    document.getElementById('linkWOInput').addEventListener('keydown', (e) => {
      if (e.key === 'Enter') handleLinkWO();
    });

    // Auto-load from URL params (QR code scan support)
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('po')) {
      els.searchInput.value = urlParams.get('po');
      document.querySelector('input[name="searchType"][value="po"]').checked = true;
      setTimeout(handleLookup, 300);
    } else if (urlParams.get('wo')) {
      els.searchInput.value = urlParams.get('wo');
      document.querySelector('input[name="searchType"][value="wo"]').checked = true;
      setTimeout(handleLookup, 300);
    }
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
  // Work Order Linking
  // ==========================================
  async function handleLinkWO() {
    const woNum = document.getElementById('linkWOInput').value.trim();
    if (!woNum) return;

    try {
      // Fetch order data from Caspio by work order number
      const resp = await fetch(`${HEROKU_BASE}/api/box-labels/order/${woNum}`);
      if (!resp.ok) throw new Error('Work order not found');

      const data = await resp.json();
      if (!data.success || !data.order) throw new Error('Work order not found in system');

      // Merge order data into current state
      const o = data.order;
      currentData.order = {
        ...currentData.order,
        orderNumber: o.orderNumber || woNum,
        company: o.company || currentData.order.company || '',
        contact: o.contact || '',
        contactEmail: o.contactEmail || '',
        customerPO: o.customerPO || currentData.order.customerPO || '',
        salesRep: o.salesRep || '',
        designs: []
      };
      if (o.designName || o.designNumber) {
        currentData.order.designs.push({
          number: String(o.designNumber || ''),
          name: o.designName || ''
        });
      }

      // Re-render with the new order data
      renderBanner(currentData.order);
      document.getElementById('linkWOSection').style.display = 'none';

      // Show success briefly
      const linkBtn = document.getElementById('linkWOBtn');
      linkBtn.textContent = 'Linked!';
      linkBtn.style.background = '#16a34a';
      setTimeout(() => { linkBtn.textContent = 'Link WO'; linkBtn.style.background = ''; }, 2000);
    } catch (error) {
      alert(`Could not find work order: ${woNum}\n${error.message}`);
    }
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

      // Store PO for QR code
      if (currentData.sanmarPO) currentData.sanmarPO = currentData.sanmarPO;

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

    // Show "Link Work Order" section if no real order data
    const hasOrderData = order.orderNumber && order.company && !order.company.startsWith('SanMar PO:');
    document.getElementById('linkWOSection').style.display = hasOrderData ? 'none' : 'flex';
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

    // Count active sizes to decide whether to show split button
    const sizes = item.sizes || {};
    const activeSizeCount = Object.values(sizes).filter(v => v > 0).length;
    const showSplit = activeSizeCount > 1 || totalQty > 1;

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
        ${showSplit && boxNumber > 0 ? `<button class="bl-btn bl-btn--small bl-btn--outline bl-item-card__split" onclick="event.stopPropagation(); window.BL.startSplit('${contentId}', ${boxNumber})">Split to another box</button>` : ''}
      </div>
    `;
  }

  function renderSizeGrid(sizes) {
    // Handle multiple formats: { S: 1 }, { Size_S: 1 }, { XXL: 1 }
    const sizeMap = {};
    if (sizes.Size_S !== undefined) {
      // Caspio format
      SIZE_COLUMNS.forEach(s => {
        const key = s === '2XL' ? 'Size_2XL' : s === '3XL' ? 'Size_3XL' : s === '4XL' ? 'Size_4XL' : s === '5XL' ? 'Size_5XL' : `Size_${s}`;
        sizeMap[s] = sizes[key] || 0;
      });
    } else {
      // Standard or SanMar format — check for aliases (XXL→2XL, etc.)
      SIZE_COLUMNS.forEach(s => { sizeMap[s] = sizes[s] || 0; });
      // Also check SanMar aliases
      for (const [alias, standard] of Object.entries(SIZE_ALIASES)) {
        if (sizes[alias]) sizeMap[standard] = (sizeMap[standard] || 0) + sizes[alias];
      }
    }

    const activeSizes = SIZE_COLUMNS.filter(s => sizeMap[s] > 0);
    if (activeSizes.length === 0) return '';

    return `<div class="bl-size-grid">${
      SIZE_COLUMNS.map(s => {
        const val = sizeMap[s] || 0;
        if (val === 0 && !activeSizes.includes(s)) return '';
        const hasValue = val > 0;
        return `
          <div class="bl-size-cell ${hasValue ? 'bl-size-cell--has-value' : 'bl-size-cell--empty'}"
               onclick="window.BL.editSizeQty(this, '${s}')" title="Click to edit">
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

    // Update the data-box attribute on the DOM element
    itemEl.dataset.box = toBox;

    // Remove empty placeholders
    const emptyPlaceholder = evt.to.querySelector('.bl-box-empty');
    if (emptyPlaceholder) emptyPlaceholder.remove();
    if (evt.from.children.length === 0) {
      evt.from.innerHTML = '<div class="bl-box-empty">Drop items here</div>';
    }

    // Update in-memory state so printing reflects the move
    if (currentData) {
      const sourceBox = currentData.boxes.find(b => b.boxNumber === fromBox);
      const targetBox = currentData.boxes.find(b => b.boxNumber === toBox);

      if (sourceBox && targetBox) {
        // Find the item by contentId or index
        const itemIdx = sourceBox.items.findIndex((it, idx) =>
          (it.contentId || `${fromBox}-${idx}`) === contentId
        );
        if (itemIdx >= 0) {
          const [movedItem] = sourceBox.items.splice(itemIdx, 1);
          targetBox.items.push(movedItem);
        }
      }
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

  function startSplit(contentId, fromBox) {
    if (!currentData) return;
    const box = currentData.boxes.find(b => b.boxNumber === fromBox);
    if (!box) return;

    const item = box.items.find((it, idx) =>
      (it.contentId || `${fromBox}-${idx}`) === contentId
    );
    if (!item) return;

    // Ask which box to move to
    const otherBoxes = currentData.boxes
      .filter(b => b.boxNumber !== fromBox)
      .map(b => b.boxNumber);

    if (otherBoxes.length === 0) {
      alert('Create a new box first, then split items into it.');
      return;
    }

    // Default to the next box
    const toBox = otherBoxes[0];
    openSplitModal(contentId, item, fromBox, toBox);
  }

  function openSplitModal(contentId, item, fromBox, toBox) {
    splitState = { contentId, item, fromBox, toBox };

    // Build box selector
    const otherBoxes = currentData.boxes.filter(b => b.boxNumber !== fromBox);
    const boxOptions = otherBoxes.map(b =>
      `<option value="${b.boxNumber}" ${b.boxNumber === toBox ? 'selected' : ''}>Box ${b.boxNumber}</option>`
    ).join('');

    document.getElementById('splitModalTitle').textContent = `Split items from Box ${fromBox}`;
    document.getElementById('splitModalSubtitle').innerHTML =
      `<strong>${escapeHtml(item.style || '')} - ${escapeHtml(item.color || '')}</strong><br>` +
      `Move to: <select id="splitTargetBox" style="padding:4px 8px; font-size:14px; border-radius:4px; border:1px solid #ccc;">${boxOptions}</select>`;

    const sizes = item.sizes || {};
    const grid = document.getElementById('splitModalSizes');
    grid.innerHTML = SIZE_COLUMNS.map(s => {
      const avail = sizes[s] || 0;
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

  function confirmSplit() {
    const targetBoxSelect = document.getElementById('splitTargetBox');
    const toBox = targetBoxSelect ? parseInt(targetBoxSelect.value) : splitState.toBox;

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

    // Update in-memory state
    if (currentData) {
      const sourceBox = currentData.boxes.find(b => b.boxNumber === splitState.fromBox);
      const targetBox = currentData.boxes.find(b => b.boxNumber === toBox);
      const sourceItem = splitState.item;

      if (sourceBox && targetBox && sourceItem) {
        // Create new item in target box with split quantities
        const newItem = {
          style: sourceItem.style,
          color: sourceItem.color,
          description: sourceItem.description,
          brand: sourceItem.brand,
          sizes: { ...splitSizes },
          totalQty: Object.values(splitSizes).reduce((s, v) => s + v, 0)
        };
        targetBox.items.push(newItem);

        // Reduce source item quantities
        for (const [size, qty] of Object.entries(splitSizes)) {
          sourceItem.sizes[size] = (sourceItem.sizes[size] || 0) - qty;
          if (sourceItem.sizes[size] <= 0) delete sourceItem.sizes[size];
        }
        sourceItem.totalQty = Object.values(sourceItem.sizes).reduce((s, v) => s + (v || 0), 0);

        // Remove source item if empty
        if (sourceItem.totalQty <= 0) {
          const idx = sourceBox.items.indexOf(sourceItem);
          if (idx >= 0) sourceBox.items.splice(idx, 1);
        }
      }
    }

    closeSplitModal();

    // Re-render everything with updated state
    renderBoxes(currentData.boxes);
    initAllDragDrop();
    recalcTotals();
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
    const pageH = 279.4;
    const margin = 10;
    const contentW = pageW - margin * 2;
    const R = pageW - margin; // right edge
    let y = margin;

    // ── Data extraction ──
    const orderNum = String(order.orderNumber || '');
    const company = order.company || '';
    const hasCompany = company && !company.startsWith('SanMar PO:');
    const shipDate = formatDate(order.requestedShipDate);
    const custPO = order.customerPO || '';
    const orderType = order.orderType || '';
    const terms = order.terms || '';
    const salesRep = order.salesRep || '';
    const paidStatus = order.paidStatus || '';
    const totalPcs = (box.items || []).reduce((s, i) => s + (i.totalQty || 0), 0);

    // ════════════════════════════════════════════════════════
    // ZONE 1: HEADER — Company + QR + WO# (y = 10-30mm)
    // ════════════════════════════════════════════════════════

    // QR Code — top right corner (above WO#)
    const qrSize = 18;
    const qrX = R - qrSize;
    try {
      const qr = qrcode(0, 'M');
      const poNum = currentData?.sanmarPO || currentData?.order?.customerPO || '';
      const labelUrl = `${window.location.origin}/pages/box-labels.html?po=${poNum}`;
      qr.addData(labelUrl);
      qr.make();
      doc.addImage(qr.createDataURL(4, 0), 'PNG', qrX, margin, qrSize, qrSize);
    } catch (e) { /* QR failed */ }

    // WO# — right side, next to QR (no "WO#" label)
    if (orderNum) {
      doc.setFontSize(44);
      doc.setFont('helvetica', 'bold');
      doc.text(orderNum, qrX - 3, margin + 14, { align: 'right' });
    }

    // Company name — left side, 28pt
    if (hasCompany) {
      doc.setFontSize(28);
      doc.setFont('helvetica', 'bold');
      const maxCompanyW = contentW * 0.5;
      const companyLines = doc.splitTextToSize(company, maxCompanyW);
      companyLines.forEach(line => { doc.text(line, margin, y + 9); y += 10; });
    }

    y = Math.max(y, margin + 20);

    // ════════════════════════════════════════════════════════
    // ZONE 2: ORDER INFO (y ≈ 30-48mm)
    // ════════════════════════════════════════════════════════

    // Order Type | Terms | Paid Status (all inline, left-aligned)
    const infoParts = [orderType, terms, paidStatus].filter(Boolean);
    if (infoParts.length) {
      doc.setFontSize(13);
      doc.setFont('helvetica', 'normal');
      const mainInfo = [orderType, terms].filter(Boolean).join('  |  ');
      doc.text(mainInfo, margin, y);
      // Paid status — smaller, black, appended after terms
      if (paidStatus && mainInfo) {
        const mainWidth = doc.getTextWidth(mainInfo);
        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        doc.text(`  —  ${paidStatus}`, margin + mainWidth, y);
      } else if (paidStatus) {
        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        doc.text(paidStatus, margin, y);
      }
    }
    y += 6;

    // Design info
    if (order.designs?.length && order.designs[0]?.name) {
      doc.setFontSize(11);
      doc.setFont('helvetica', 'bold');
      doc.text('Design:', margin, y);
      doc.setFont('helvetica', 'normal');
      const d = order.designs[0];
      doc.text(`${d.number ? d.number + '  ' : ''}${d.name}`, margin + 18, y);
      y += 5;
    }

    // Cust PO + Rep
    const detailParts = [];
    if (custPO) detailParts.push(`Cust PO: ${custPO}`);
    if (salesRep) detailParts.push(`Rep: ${salesRep}`);
    if (detailParts.length) {
      doc.setFontSize(11);
      doc.setFont('helvetica', 'normal');
      doc.text(detailParts.join('   |   '), margin, y);
      y += 5;
    }

    // ════════════════════════════════════════════════════════
    // ZONE 3: KEY METRICS BAR (y ≈ 48-62mm)
    // ════════════════════════════════════════════════════════

    y += 1;
    doc.setDrawColor(80);
    doc.setLineWidth(0.5);
    doc.line(margin, y, R, y);
    doc.setLineWidth(0.2);
    y += 3;

    // Pcs total (left, 18pt)
    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.text(`${totalPcs} pcs total`, margin, y + 5);

    // Ship date (right, 28pt)
    if (shipDate) {
      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      doc.text('Req. Ship Date', R, y, { align: 'right' });
      doc.setFontSize(28);
      doc.setFont('helvetica', 'bold');
      doc.text(shipDate, R, y + 10, { align: 'right' });
    }
    y += 14;

    doc.setDrawColor(80);
    doc.setLineWidth(0.5);
    doc.line(margin, y, R, y);
    doc.setLineWidth(0.2);
    y += 3;

    // ════════════════════════════════════════════════════════
    // ZONE 4: BOX IDENTIFIER (y ≈ 65-80mm) — above fold line
    // ════════════════════════════════════════════════════════

    doc.setFontSize(36);
    doc.setFont('helvetica', 'bold');
    doc.text(`BOX  ${boxIdx}  OF  ${totalBoxes}`, pageW / 2, y + 10, { align: 'center' });
    y += 16;

    doc.setDrawColor(80);
    doc.setLineWidth(0.5);
    doc.line(margin, y, R, y);
    doc.setLineWidth(0.2);
    y += 4;

    // ════════════════════════════════════════════════════════
    // ZONE 5: CONTENTS (y ≈ 84mm → fills remaining space)
    // ════════════════════════════════════════════════════════

    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text('Contents', margin, y);
    y += 6;

    // Dynamic sizing based on item count
    const itemCount = (box.items || []).length;
    const compact = itemCount > 5;
    const styleFontSize = compact ? 10 : 11;
    const colorFontSize = compact ? 8 : 9;
    const gridFontSize = compact ? 11 : 13;
    const gridHeadSize = compact ? 7 : 8;
    const gridPadding = compact ? 1.5 : 2;
    const itemSpacing = compact ? 3 : 4;
    const maxY = pageH - margin - 15; // Leave 15mm for footer

    for (const item of (box.items || [])) {
      if (y + 15 > maxY) break;

      const style = item.style || item.Style_Number || '';
      const desc = item.description || item.Description || '';
      let displayDesc = desc;
      if (desc !== style && desc.endsWith(`. ${style}`)) displayDesc = desc.slice(0, -(style.length + 2));
      if (desc === style) displayDesc = '';

      doc.setFontSize(styleFontSize);
      doc.setFont('helvetica', 'bold');
      const styleLabel = displayDesc ? `${style} - ${displayDesc}` : style;
      doc.text(doc.splitTextToSize(styleLabel, contentW - 4)[0], margin + 1, y);
      y += styleFontSize * 0.4 + 1;

      doc.setFontSize(colorFontSize);
      doc.setFont('helvetica', 'normal');
      doc.text(`${item.color || ''} — ${item.totalQty || 0} pcs`, margin + 1, y);
      y += colorFontSize * 0.35 + 1.5;

      // Size grid
      const sizes = item.sizes || {};
      const activeCols = [];
      const activeVals = [];
      SIZE_COLUMNS.forEach(s => {
        let val = sizes[s] || 0;
        if (!val) {
          for (const [alias, std] of Object.entries(SIZE_ALIASES)) {
            if (std === s && sizes[alias]) { val = sizes[alias]; break; }
          }
        }
        if (val > 0) { activeCols.push(s); activeVals.push(String(val)); }
      });

      if (activeCols.length > 0) {
        doc.autoTable({
          startY: y,
          margin: { left: margin + 1 },
          head: [activeCols],
          body: [activeVals],
          theme: 'grid',
          styles: {
            fontSize: gridFontSize, fontStyle: 'bold', halign: 'center',
            cellPadding: gridPadding, lineWidth: 0.3, lineColor: [100, 100, 100]
          },
          headStyles: {
            fillColor: [235, 235, 235], textColor: [50, 50, 50],
            fontSize: gridHeadSize, fontStyle: 'bold', cellPadding: 1
          },
          bodyStyles: { fillColor: [255, 255, 255], textColor: [0, 0, 0] },
          tableWidth: Math.min(activeCols.length * 18, contentW * 0.55)
        });
        y = doc.lastAutoTable.finalY + itemSpacing;
      } else {
        y += 2;
      }
    }

    // ════════════════════════════════════════════════════════
    // ZONE 6: FOOTER — minimal (OK if cut off when folded)
    // ════════════════════════════════════════════════════════

    const footerY = pageH - margin - 10;
    doc.setDrawColor(150);
    doc.setLineWidth(0.3);
    doc.line(margin, footerY, R, footerY);

    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(120, 120, 120);
    const footerParts = [];
    if (custPO) footerParts.push(`Cust PO: ${custPO}`);
    if (orderNum) footerParts.push(`WO# ${orderNum}`);
    if (footerParts.length) {
      doc.text(footerParts.join('   |   '), pageW / 2, footerY + 5, { align: 'center' });
    }
    doc.setTextColor(0, 0, 0);
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
  // Inline Quantity Editing
  // ==========================================
  function editSizeQty(cellEl, sizeName) {
    // Don't re-edit if already editing
    if (cellEl.querySelector('input')) return;

    const valueEl = cellEl.querySelector('.bl-size-cell__value');
    const currentVal = parseInt(valueEl.textContent) || 0;

    // Replace value with input
    const input = document.createElement('input');
    input.type = 'number';
    input.min = '0';
    input.max = '999';
    input.value = currentVal;
    input.style.cssText = 'width:50px; text-align:center; font-size:16px; font-weight:700; padding:2px; border:2px solid #3b82f6; border-radius:4px;';
    valueEl.textContent = '';
    valueEl.appendChild(input);
    input.focus();
    input.select();

    // Find the parent item card to update data
    const itemCard = cellEl.closest('.bl-item-card');
    const boxNumber = parseInt(itemCard?.dataset?.box) || 0;

    function commitEdit() {
      const newVal = Math.max(0, parseInt(input.value) || 0);
      valueEl.textContent = newVal || '-';
      cellEl.classList.toggle('bl-size-cell--has-value', newVal > 0);
      cellEl.classList.toggle('bl-size-cell--empty', newVal === 0);

      // Update the underlying data
      if (currentData && boxNumber > 0) {
        const box = currentData.boxes.find(b => b.boxNumber === boxNumber);
        if (box) {
          const contentId = itemCard.dataset.contentId;
          const item = box.items.find((it, idx) => (it.contentId || `${boxNumber}-${idx}`) === contentId);
          if (item && item.sizes) {
            const oldVal = item.sizes[sizeName] || 0;
            item.sizes[sizeName] = newVal;
            item.totalQty = (item.totalQty || 0) - oldVal + newVal;
            // Update the qty display on the card
            const qtyEl = itemCard.querySelector('.bl-item-card__qty');
            if (qtyEl) qtyEl.textContent = `${item.totalQty} pcs`;
          }
        }
        recalcTotals();
      }
    }

    input.addEventListener('blur', commitEdit);
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { input.blur(); }
      if (e.key === 'Escape') { input.value = currentVal; input.blur(); }
      e.stopPropagation(); // Don't trigger drag
    });
  }

  // ==========================================
  // Public API (called from HTML onclick)
  // ==========================================
  window.BL = {
    toggleBox,
    verifyBox,
    printBoxLabel,
    deleteBox,
    openSplitModal,
    startSplit,
    editSizeQty
  };

})();
