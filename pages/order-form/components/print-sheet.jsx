// Print sheet — mirrors the paper form layout using current form state
function PrintSheet({ info, rows, ship, orderNotes, files }) {
  const decoSet = new Set(rows.map(r => r.deco));
  const rowsWithTotal = rows.map(r => {
    let t = 0;
    SIZES.forEach(s => { t += Number(r.sizes[s] || 0); });
    t += Number(r.otherSize || 0);
    return { ...r, total: t };
  });
  // Pad to 14 rows like original
  const padded = [...rowsWithTotal];
  while (padded.length < 14) padded.push({ id: 'blank-' + padded.length, style: '', color: '', desc: '', sizes: {}, otherSize: '', total: 0, _blank: true });

  const designNo = files.map(f => f.designNo).filter(Boolean).join(', ');
  const placements = [...new Set(files.flatMap(f => f.placements || []))].join(', ');

  return (
    <div className="print-sheet" id="print-sheet">
      {/* Header */}
      <div className="ps-header">
        <div className="ps-brand">
          <div className="ps-logo"><LogoMark size={52}/></div>
        </div>
        <div className="ps-title">
          <h1>Order Form</h1>
          <div className="ps-contact">
            Northwest Custom Apparel &nbsp;·&nbsp; 1-800-851-3671<br/>
            sales@nwcustomapparel.com
          </div>
        </div>
        <div className="ps-right-plate">
          <strong>Text us</strong><br/>
          253-922-5793<br/>
          <span style={{ fontSize: '8pt' }}>Est. 1977 · Tacoma, WA</span>
        </div>
      </div>

      {/* Info grid */}
      <div className="ps-info">
        <div className="cell"><div className="lbl">Company</div><div className="val">{info.company}</div></div>
        <div className="cell"><div className="lbl">Phone</div><div className="val">{info.phone}</div></div>
        <div className="cell"><div className="lbl">Date in</div><div className="val">{info.dateIn}</div></div>

        <div className="cell"><div className="lbl">Buyer</div><div className="val">{[info.buyerFirst, info.buyerLast].filter(Boolean).join(' ')}</div></div>
        <div className="cell"><div className="lbl">Email</div><div className="val">{info.email}</div></div>
        <div className="cell"><div className="lbl">Date due</div><div className="val">{info.dateDue}</div></div>

        <div className="cell"><div className="lbl">Address</div><div className="val">{info.address}</div></div>
        <div className="cell"><div className="lbl">PO #</div><div className="val">{info.po}</div></div>
        <div className="cell" style={{ padding: 0 }}>
          <div className="deco-flags">
            <div className="flag"><span className={"ps-chk" + (decoSet.has('embroidery') ? ' on' : '')}></span> Embroidery</div>
            <div className="flag"><span className={"ps-chk" + (decoSet.has('dtg') ? ' on' : '')}></span> DTG Printing</div>
            <div className="flag"><span className={"ps-chk" + (decoSet.has('screenprint') ? ' on' : '')}></span> Screen Printing</div>
          </div>
        </div>

        <div className="cell"><div className="lbl">City / State / Zip</div><div className="val">{[info.city, info.state, info.zip].filter(Boolean).join(', ')}</div></div>
        <div className="cell"></div>
        <div className="cell"></div>
      </div>

      {/* Payment notice */}
      <div className="ps-notice">
        <div>
          50% down on all new orders. Balance on delivery.<br/>
          Prepayment on all new artwork.
        </div>
        <div className="cards">
          <span className="c">VISA</span>
          <span className="c">MC</span>
          <span className="c">AMEX</span>
          <span className="c">ACH</span>
        </div>
      </div>

      {/* Garments table */}
      <table className="ps-table">
        <colgroup>
          <col className="c-style"/>
          <col className="c-color"/>
          <col className="c-desc"/>
          <col className="c-sz"/><col className="c-sz"/><col className="c-sz"/><col className="c-sz"/><col className="c-sz"/><col className="c-sz"/><col className="c-sz"/><col className="c-sz"/>
          <col className="c-other"/>
          <col className="c-price"/>
          <col className="c-total"/>
        </colgroup>
        <thead>
          <tr>
            <th className="left">Style #</th>
            <th className="left">Color</th>
            <th className="left">Description</th>
            <th className="num">XS</th>
            <th className="num">S</th>
            <th className="num">M</th>
            <th className="num">L</th>
            <th className="num">XL</th>
            <th className="num">2XL</th>
            <th className="num">3XL</th>
            <th className="num">4XL</th>
            <th className="num">Other</th>
            <th className="num">Price</th>
            <th className="ps-total-head">Total</th>
          </tr>
        </thead>
        <tbody>
          {padded.slice(0, 14).map((r, i) => (
            <tr key={r.id}>
              <td>{r.style}</td>
              <td>{r.color}</td>
              <td className="desc">{r.desc}</td>
              <td className="num">{r.sizes?.XS || ''}</td>
              <td className="num">{r.sizes?.S || ''}</td>
              <td className="num">{r.sizes?.M || ''}</td>
              <td className="num">{r.sizes?.L || ''}</td>
              <td className="num">{r.sizes?.XL || ''}</td>
              <td className="num">{r.sizes?.['2XL'] || ''}</td>
              <td className="num">{r.sizes?.['3XL'] || ''}</td>
              <td className="num">{r.sizes?.['4XL'] || ''}</td>
              <td className="num">{r.otherSize || ''}</td>
              <td className="num">{r.price ? '$' + r.price : ''}</td>
              <td className="total">{r.total || ''}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Footer: Notes / Shipping */}
      <div className="ps-footer">
        <div className="cell">
          <div className="lbl">Order notes</div>
          <div className="val">{orderNotes}</div>
        </div>
        <div className="cell">
          <div className="ps-ship-methods">
            <strong style={{ fontSize: '9pt' }}>Ship</strong>
            <div className="m"><span className={"ps-chk" + (ship.method === 'ups' ? ' on' : '')}></span> UPS</div>
            <div className="m"><span className={"ps-chk" + (ship.method === 'willcall' ? ' on' : '')}></span> Will Call</div>
            <div className="m"><span className={"ps-chk" + (ship.method === 'other' ? ' on' : '')}></span> Other</div>
          </div>
          <div className="lbl">Ship to address</div>
          <div className="val" style={{ marginBottom: 4 }}>{ship.address}</div>
          <div className="lbl">City / State / Zip</div>
          <div className="val">{[ship.city, ship.state, ship.zip].filter(Boolean).join(', ')}</div>
        </div>
      </div>

      {/* Design # row */}
      <div className="ps-design-row">
        <div className="cell"><div className="lbl">Design #</div><div className="val">{designNo}</div></div>
        <div className="cell"><div className="lbl">Logo placement(s)</div><div className="val">{placements}</div></div>
        <div className="cell"></div>
      </div>

      {/* Signature */}
      <div className="ps-sig-line"></div>
      <div className="ps-sig">Customer Signature</div>
    </div>
  );
}

Object.assign(window, { PrintSheet });
