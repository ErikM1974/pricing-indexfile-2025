// NWCA Production Schedule — single source of truth
// Effective 8/3/2026. Built from TimeClick actual punch medians, 06/29/2026–07/28/2026.
// minutes are minutes-since-midnight to keep timeline math trivial
window.NWCA_SCHEDULE = [
  {
    id: "kanha",
    name: "Kanha Chhorn",
    first: "Kanha",
    role: "Embroidery Supervisor",
    dept: "Embroidery",
    paidHrs: 6.25,
    note: "Shift moved to 8:00 AM – 2:45 PM to match actual punches. Paid hours unchanged at 6.25.",
    events: [
      { type: "start", min: 480 },
      { type: "break", min: 540, durMin: 10 },
      { type: "lunch", min: 690, durMin: 30 },
      { type: "break", min: 750, durMin: 10 },
      { type: "end",   min: 885 }
    ]
  },
  {
    id: "sreynai",
    name: "Sreynai Meang",
    first: "Sreynai",
    role: "Embroidery Operator",
    dept: "Embroidery",
    paidHrs: 8,
    note: "No change — actual punches already match the posted shift.",
    events: [
      { type: "start", min: 480 },
      { type: "break", min: 585, durMin: 10 },
      { type: "lunch", min: 660, durMin: 30 },
      { type: "break", min: 840, durMin: 10 },
      { type: "end",   min: 990 }
    ]
  },
  {
    id: "savy",
    name: "Savy Som",
    first: "Savy",
    role: "Embroidery Operator",
    dept: "Embroidery",
    paidHrs: 8,
    note: "Times unchanged. Actual lunch averages 26 min — it must be the full 30.",
    events: [
      { type: "start", min: 480 },
      { type: "break", min: 600, durMin: 10 },
      { type: "lunch", min: 660, durMin: 30 },
      { type: "break", min: 855, durMin: 10 },
      { type: "end",   min: 990 }
    ]
  },
  {
    id: "sorphorn",
    name: "Sorphorn Sorm",
    first: "Sorphorn",
    role: "Embroidery Operator",
    dept: "Embroidery",
    paidHrs: 8,
    note: "Times unchanged. Actual lunch averages 27 min — it must be the full 30.",
    events: [
      { type: "start", min: 480 },
      { type: "break", min: 615, durMin: 10 },
      { type: "lunch", min: 690, durMin: 30 },
      { type: "break", min: 870, durMin: 10 },
      { type: "end",   min: 990 }
    ]
  },
  {
    id: "brian",
    name: "Brian Beardsley",
    first: "Brian",
    role: "DTG Supervisor",
    dept: "DTG",
    paidHrs: 7.75,
    note: "Lunch moved to 12:30 PM and clock-out to 4:15 PM to match actual punches. Actual lunch averages 21 min — it must be the full 30.",
    events: [
      { type: "start", min: 480 },
      { type: "break", min: 570, durMin: 10 },
      { type: "lunch", min: 750, durMin: 30 },
      { type: "break", min: 855, durMin: 10 },
      { type: "end",   min: 975 }
    ]
  },
  {
    id: "joseph",
    name: "Joseph Hallowell",
    first: "Joseph",
    role: "DTG Operator",
    dept: "DTG",
    paidHrs: 7.75,
    note: "Lunch moved to 11:15 AM and clock-out to 4:15 PM to match actual punches.",
    events: [
      { type: "start", min: 480 },
      { type: "break", min: 630, durMin: 10 },
      { type: "lunch", min: 675, durMin: 30 },
      { type: "break", min: 885, durMin: 10 },
      { type: "end",   min: 975 }
    ]
  },
  {
    id: "sothea",
    name: "Sothea Tann",
    first: "Sothea",
    role: "Embroidery Trimmer",
    dept: "Embroidery",
    paidHrs: 8,
    note: "Lunch moved to 11:30 AM to match actual punches; shift times unchanged. Actual lunch averages 28 min — it must be the full 30.",
    events: [
      { type: "start", min: 480 },
      { type: "break", min: 645, durMin: 10 },
      { type: "lunch", min: 690, durMin: 30 },
      { type: "break", min: 885, durMin: 10 },
      { type: "end",   min: 990 }
    ]
  },
  {
    id: "ruthie",
    name: "Ruthie Nhoung",
    first: "Ruthie",
    role: "Production Manager",
    dept: "Ruthie/Mikalah",
    paidHrs: 8,
    note: "Lunch moved to 2:00 PM and break 2 to 3:30 PM to match actual punches. Shift times unchanged.",
    events: [
      { type: "start", min: 480 },
      { type: "break", min: 630, durMin: 10 },
      { type: "lunch", min: 840, durMin: 30 },
      { type: "break", min: 930, durMin: 10 },
      { type: "end",   min: 990 }
    ]
  },
  {
    id: "mikalah",
    name: "Mikalah Hede",
    first: "Mikalah",
    role: "Shipping / Receiving",
    dept: "Ruthie/Mikalah",
    paidHrs: 8,
    note: "Lunch moved to 1:00 PM to match actual punches. Keeps her 60-min lunch, so 8:00 AM – 5:00 PM is 8.00 paid hrs.",
    events: [
      { type: "start", min: 480 },
      { type: "break", min: 615, durMin: 10 },
      { type: "lunch", min: 780, durMin: 60 },
      { type: "break", min: 930, durMin: 10 },
      { type: "end",   min: 1020 }
    ]
  },
  {
    id: "theavy",
    name: "Theavy Hoeu",
    first: "Theavy",
    role: "Embroidery Operator",
    dept: "Embroidery",
    paidHrs: 8,
    note: "Shift moved to 8:00 AM – 4:30 PM with lunch at 11:45 AM. Paid hours 7.50 → 8.00, matching what she already works.",
    events: [
      { type: "start", min: 480 },
      { type: "break", min: 600, durMin: 10 },
      { type: "lunch", min: 705, durMin: 30 },
      { type: "break", min: 900, durMin: 10 },
      { type: "end",   min: 990 }
    ]
  }
];

// ---- helpers ----
window.NWCA_HELPERS = {
  minToTime(m) {
    const h = Math.floor(m / 60);
    const mm = Math.round(m % 60);
    const ampm = h < 12 ? "AM" : "PM";
    const h12 = h === 0 ? 12 : (h <= 12 ? h : h - 12);
    return `${h12}:${mm.toString().padStart(2, "0")} ${ampm}`;
  },
  // Build solid segment list (working / break / lunch / off-shift) for an employee
  segments(emp) {
    const segs = [];
    const start = emp.events.find(e => e.type === "start").min;
    const end = emp.events.find(e => e.type === "end").min;
    let cursor = start;
    emp.events.forEach(e => {
      if (e.type === "start" || e.type === "end") return;
      if (cursor < e.min) segs.push({ type: "work", start: cursor, end: e.min });
      segs.push({ type: e.type, start: e.min, end: e.min + e.durMin });
      cursor = e.min + e.durMin;
    });
    if (cursor < end) segs.push({ type: "work", start: cursor, end });
    return { segs, shiftStart: start, shiftEnd: end };
  },
  // status at a given minute
  statusAt(emp, m) {
    const { segs, shiftStart, shiftEnd } = this.segments(emp);
    if (m < shiftStart) return { type: "pre", label: "Pre-shift" };
    if (m >= shiftEnd) return { type: "off", label: "Done for day" };
    const cur = segs.find(s => m >= s.start && m < s.end);
    if (!cur) return { type: "off", label: "Off shift" };
    return {
      type: cur.type,
      label: cur.type === "work" ? "Working" : cur.type === "break" ? "On break" : "At lunch",
      seg: cur
    };
  }
};
