// Order submission stage. Behavior covered by order-form-submit-contract.test.js.
// --- Designs: one per decoration method present in rows, artwork URLs attached ---
// DesignType IDs per Erik's "design type translation.csv" (2026-05-02).
// PRIOR VALUES WERE WRONG — only DTG was correct. All other methods
// were sending design type 3 ("standard"), which doesn't exist in
// ShopWorks's design taxonomy. Authoritative IDs from CSV:
//   1 = Screenprint, 2 = Embroidery, 4 = Advertising Specialty (Stickers),
//   5 = Emblem, 8 = Transfer (DTF), 45 = DTG
const DESIGN_TYPE_ID = { embroidery: 2, screenprint: 1, dtg: 45, dtf: 8, sticker: 4, emblem: 5 };
const DESIGN_LABEL = {
    embroidery: 'Embroidery',
    screenprint: 'Screen Print',
    dtg: 'DTG',
    dtf: 'DTF Transfer',
    sticker: 'Stickers',
    emblem: 'Embroidered Emblems',
};
function buildArtwork({ designNumbers, files, methodsUsed, addOns, info, rows, extOrderId }) {
    // Design # → id_Design resolution.
    //
    // CASPIO TABLE INSIGHT (Erik confirmed 2026-05-02): the
    // `Design_Lookup_2026` table's `Design_Number` column IS ShopWorks's
    // `id_Design` value — they're the same integer under different column
    // names (the table's `ID_Unique` column is empty). So the autocomplete's
    // pick of design 9449 means we pass `id_Design: 9449` to ShopWorks
    // directly, no second lookup needed.
    //
    // The rep can also type a free-form design# from memory; we accept any
    // integer between 1 and 999999. Non-numeric input falls through to
    // Designs:[] (Phase A behavior — no orphan creation).
    const linkedIdDesigns = (Array.isArray(designNumbers) ? designNumbers : [])
        .map((n) => Number(String(n || '').trim()))
        .filter((n) => Number.isInteger(n) && n > 0 && n < 1000000);

    // Designs[]: emit when EITHER (a) at least one design# resolved to a real
    // ShopWorks id_Design (existing-design path) OR (b) the rep uploaded at
    // least one artwork file (new-design path — ShopWorks creates a new
    // design record from the metadata + ImageURL). Otherwise return [] so
    // ShopWorks doesn't create an orphan design from DesignName alone.
    //
    // Erik's evolved preference (2026-05-02 → 2026-05-20):
    //   2026-05-02: "if there isn't a design we shouldn't create a new one,
    //                just leave it blank and the sales rep can select the
    //                design inside shopworks"
    //   2026-05-20: "if rep uploads new artwork, create the design with full
    //                metadata + image so the art team doesn't have to chase
    //                emailed attachments separately"
    //
    // The frontend gates the new-design path so it only fires when (a) at
    // least one file IS uploaded AND (b) the rep typed a Design Name AND
    // (c) NO existing Design # was picked (conflict prevention). See
    // memory/MO_NEW_DESIGN_FLOW.md (to be added).
    const hostedAnyFiles = (files || []).some(
        (f) => f && (f.hostedUrl || (f.preview && /^https?:/i.test(f.preview)))
    );
    const designs =
        linkedIdDesigns.length === 0 && !hostedAnyFiles
            ? []
            : methodsUsed.map((method) => {
                  const hostedFiles = files.filter(
                      (f) => f && (f.hostedUrl || (f.preview && /^https?:/i.test(f.preview)))
                  );
                  // Primary location entries (from uploaded artwork files OR placeholder).
                  const primaryLocations = (
                      hostedFiles.length ? hostedFiles : [{ name: 'placeholder' }]
                  ).map((f, i) => ({
                      location: (f.placements && f.placements[0]) || 'Left Chest',
                      colors: f.colors || '',
                      code: f.designNo || `${method.slice(0, 3).toUpperCase()}-${i + 1}`,
                      imageUrl: f.hostedUrl || f.preview || '',
                      customField01: f.hostedUrl || f.preview || '',
                      notes: f.colors ? `Colors: ${f.colors}` : '',
                  }));

                  // Phase 7 — append additional-logo locations from add-ons.
                  // For each AL/AL-CAP/DECG-FB/CTR-* addon with a position param, push
                  // a Locations[] entry so ShopWorks's production view shows all logo
                  // positions on this design (not just the primary). Sequential codes
                  // (EMB-2, EMB-3, …) follow the primary's EMB-1 numbering.
                  const positionCodes = new Set([
                      'AL',
                      'AL-CAP',
                      'DECG-FB',
                      'CTR-Garmt',
                      'CTR-Cap',
                  ]);
                  const addonLocations = [];
                  let nextLocCode = primaryLocations.length + 1;
                  const methodPrefix = method.slice(0, 3).toUpperCase();
                  (Array.isArray(addOns) ? addOns : []).forEach((a) => {
                      if (!a || !positionCodes.has(a.code)) return;
                      const pos =
                          a?.params?.position ||
                          (a.code === 'DECG-FB' ? 'Full Back' : 'Additional');
                      const stitches = Number(a?.params?.stitchCount) || 0;
                      addonLocations.push({
                          location: pos,
                          colors: '',
                          code: `${methodPrefix}-${nextLocCode++}`,
                          imageUrl: '',
                          customField01: '',
                          notes:
                              stitches > 0
                                  ? `${stitches.toLocaleString()} stitches · ${a.code}`
                                  : a.code,
                      });
                  });

                  const base = {
                      name: `${info.company || 'Order'} — ${DESIGN_LABEL[method] || method}`,
                      externalId: `${extOrderId}-${method.toUpperCase()}`,
                      // ForProductColor (proxy maps `productColor` → `ForProductColor`):
                      // Use CATALOG_COLOR codes (matches the LinesOE.Color rule from proxy v606)
                      // and include rows whose deco isn't explicitly set — those default to
                      // the form's primary method (embroidery) and were silently dropped from
                      // this aggregation before, which left ShopWorks with a Design that only
                      // referenced 3 of 11 colors on multi-row orders. See OF-0025.
                      productColor: [
                          ...new Set(
                              rows
                                  .filter((r) => !r.deco || r.deco === method)
                                  .map((r) => r.catalogColor || r.colorName || r.color)
                                  .filter(Boolean)
                          ),
                      ].join(', '),
                      // C2 (2026-05-22): no `|| 3` fallback — methodsUsed has been validated
                      // against DESIGN_TYPE_ID at the guard above, so this lookup always
                      // resolves to a real ShopWorks design type ID.
                      designTypeId: DESIGN_TYPE_ID[method],
                      locations: [...primaryLocations, ...addonLocations],
                  };
                  // Attach known id_Design references per CLAUDE.md MANAGEORDERS pattern.
                  // For methods that primarily use this lookup (embroidery), pass the array
                  // so the proxy can link rather than create a new generic design.
                  // ALSO: when exactly one design# resolves, set base.idDesign (singular)
                  // so the proxy's transformDesigns() actually reads it. The proxy only
                  // looks at `idDesign`/`id_Design` on the design object — `linkedDesigns`
                  // is currently a no-op until multi-design# support lands. Without this
                  // singular alias, even a successful design# lookup silently dropped to
                  // id_Design:0 in the ShopWorks payload (orphan).
                  // DTG added 2026-05-20 — the new DTG Quote Builder has a customer-aware
                  // Design # picker that hands back the existing ShopWorks id_Design.
                  // Without DTG in this whitelist, the picked design was silently dropped
                  // and ShopWorks created an orphan placeholder design on every DTG push.
                  if (
                      linkedIdDesigns.length &&
                      (method === 'embroidery' ||
                          method === 'screenprint' ||
                          method === 'dtf' ||
                          method === 'dtg')
                  ) {
                      base.linkedDesigns = linkedIdDesigns.map((id) => ({ id_Design: id }));
                      if (linkedIdDesigns.length === 1) base.idDesign = linkedIdDesigns[0];
                  }
                  // NEW-DESIGN PATH (Erik 2026-05-20): when no existing design# was picked
                  // but rep uploaded artwork + typed a Design Name, override the auto-
                  // generated "${company} — ${method}" name with the rep's chosen name.
                  // This makes the new design searchable in ShopWorks's art library by
                  // a meaningful identifier (e.g. "Star Sportswear front logo 2026")
                  // rather than a generic auto-name.
                  if (
                      !linkedIdDesigns.length &&
                      info.newDesignName &&
                      String(info.newDesignName).trim()
                  ) {
                      base.name = String(info.newDesignName).trim();
                  }
                  return base;
              });

    // --- Attachments: only hosted URLs (not base64 previews) ---
    const attachments = files
        .filter((f) => f && (f.hostedUrl || (f.preview && /^https?:/i.test(f.preview))))
        .map((f) => ({
            mediaUrl: f.hostedUrl || f.preview,
            mediaName: f.name || 'artwork',
            linkNote: (f.placements || []).join(', '),
        }));
    return { designs, attachments };
}
function linkGarmentDesigns(lineItems, designs) {
    // --- Link line items to their design via ExtDesignIDBlock --------
    // Without this, ShopWorks imports each line with the "Apply Designs"
    // toggle OFF — the rep then has to manually flip it on every line
    // before production can see the artwork. By setting ExtDesignIDBlock
    // = the design's ExtDesignID, the OnSite import auto-links the line
    // to the design and toggles Apply Designs ON. (Erik confirmed 2026-05-21
    // by inspecting WO 141899 line item PC90H_3XL.)
    //
    // designsByMethod maps "DTG"/"EMB"/etc. → "OF-0048-DTG" (the externalId
    // we sent in the Designs[] array). Lines whose row method has no design
    // (e.g., manual-only fee rows) leave extDesignIdBlock empty — same as
    // pre-fix behavior, no regression.
    const designsByMethod = new Map();
    (designs || []).forEach((d) => {
        const m = (d?.externalId || '').match(/-([A-Z0-9]+)$/);
        if (m && m[1]) designsByMethod.set(m[1], d.externalId);
    });
    lineItems.forEach((line) => {
        const lineMethod = (line._method || '').toUpperCase();
        if (lineMethod && designsByMethod.has(lineMethod)) {
            line.extDesignIdBlock = designsByMethod.get(lineMethod);
        }
        delete line._method;
    });
}
module.exports = { DESIGN_TYPE_ID, buildArtwork, linkGarmentDesigns };
