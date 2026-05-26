/* global React, ReactDOM */
const { useState, useMemo } = React;
const { minToTime, segments } = window.NWCA_HELPERS;

const TL_START = 7 * 60;    // 7:00 AM
const TL_END   = 17 * 60;   // 5:00 PM
const TL_RANGE = TL_END - TL_START;
const pct = (m) => Math.max(0, Math.min(100, ((m - TL_START) / TL_RANGE) * 100));

const DEPTS = ["All", "Embroidery", "DTG", "Ruthie/Mikalah"];

// Update this date whenever you change schedule data in data.js
const SCHEDULE_EFFECTIVE_DATE = "5/26/2026";

// stable hue from name → avatar tint
function hue(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) & 0xffff;
  return h % 360;
}

function Avatar({ name, size = 32 }) {
  const initials = name.split(" ").map(p => p[0]).slice(0, 2).join("").toUpperCase();
  const h = hue(name);
  return (
    <div
      className="avatar"
      style={{
        width: size, height: size, fontSize: size * 0.4,
        background: `oklch(0.93 0.03 ${h})`,
        color: `oklch(0.35 0.09 ${h})`,
      }}
    >{initials}</div>
  );
}

// ---------------- Breadcrumb ----------------
function Breadcrumb() {
  return (
    <nav className="ps-breadcrumb" aria-label="Breadcrumb">
      <a href="/staff-dashboard.html">
        <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M19 12H5M12 19l-7-7 7-7"/>
        </svg>
        Staff Dashboard
      </a>
      <span className="ps-breadcrumb-sep" aria-hidden="true">›</span>
      <span className="ps-breadcrumb-current">Production Shifts</span>
    </nav>
  );
}

// ---------------- Header ----------------
function Header() {
  return (
    <header className="topbar">
      <div className="topbar-left">
        <div className="brand-mark" aria-hidden="true">
          <svg viewBox="0 0 24 24" width="18" height="18">
            <rect x="3" y="5" width="18" height="16" rx="3" fill="none" stroke="currentColor" strokeWidth="1.6"/>
            <path d="M3 10h18" stroke="currentColor" strokeWidth="1.6"/>
            <path d="M8 3v4M16 3v4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
          </svg>
        </div>
        <div>
          <div className="brand-line">NW Custom Apparel</div>
          <h1 className="page-title">Production Shifts</h1>
          <div className="effective-date">Schedule effective {SCHEDULE_EFFECTIVE_DATE}</div>
        </div>
      </div>
      <div className="topbar-right">
        <a href="#workrules" className="btn-ghost">
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
            <path d="M14 2v6h6M9 13h6M9 17h6"/>
          </svg>
          Work rules
        </a>
        <a href="#rules" className="btn-ghost">
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="9"/>
            <path d="M12 8v4M12 16h.01"/>
          </svg>
          WA labor rules
        </a>
      </div>
    </header>
  );
}

// ---------------- Day Summary Bar ----------------
function DaySummary({ employees }) {
  const dayStats = useMemo(() => {
    const startMins = employees.map(e => e.events.find(ev => ev.type === "start").min);
    const endMins = employees.map(e => e.events.find(ev => ev.type === "end").min);
    const earliest = Math.min(...startMins);
    const latest = Math.max(...endMins);
    const earliestNames = employees
      .filter(e => e.events.find(ev => ev.type === "start").min === earliest)
      .map(e => e.first);
    const latestNames = employees
      .filter(e => e.events.find(ev => ev.type === "end").min === latest)
      .map(e => e.first);
    return { headcount: employees.length, earliest, latest, earliestNames, latestNames };
  }, [employees]);

  const items = [
    { num: dayStats.headcount, label: "Production team", sub: "active employees" },
    { num: minToTime(dayStats.earliest), label: "Earliest start", sub: dayStats.earliestNames.join(" & ") },
    { num: minToTime(dayStats.latest),   label: "Latest finish",  sub: dayStats.latestNames.join(" & ") },
  ];

  return (
    <div className="stat-row">
      {items.map((c, i) => (
        <div key={i} className="stat-card">
          <div className="stat-num">{c.num}</div>
          <div className="stat-body">
            <div className="stat-label">{c.label}</div>
            <div className="stat-sub">{c.sub}</div>
          </div>
        </div>
      ))}
    </div>
  );
}

// ---------------- Master Table ----------------
function MasterTable({ employees, onSelect, selectedId }) {
  return (
    <div className="master-card">
      <div className="master-head">
        <div>
          <h2>Master schedule</h2>
          <p>Every shift, break, and lunch at a glance. Click a row for details.</p>
        </div>
        <div className="master-head-right">
          <div className="legend">
            <span className="legend-item"><span className="legend-sw legend-clock" />Clock in / out</span>
            <span className="legend-item"><span className="legend-sw legend-break" />Rest break (paid, no punch)</span>
            <span className="legend-item"><span className="legend-sw legend-lunch" />Lunch (unpaid, punch out &amp; in)</span>
          </div>
          <button className="btn-primary master-print" onClick={() => window.print()}>
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
              <path d="M6 9V3h12v6M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/>
              <rect x="6" y="14" width="12" height="8" rx="1"/>
            </svg>
            Print Shift Schedule
          </button>
        </div>
      </div>
      <div className="master-scroll">
        <table className="master-table">
          <thead>
            <tr>
              <th className="th-name">Employee</th>
              <th className="th-role">Role</th>
              <th>Clock in</th>
              <th>10 min Break 1</th>
              <th>Lunch</th>
              <th>10 min Break 2</th>
              <th>Clock out</th>
              <th>Paid</th>
            </tr>
          </thead>
          <tbody>
            {employees.map(emp => {
              const start = emp.events.find(e => e.type === "start");
              const end = emp.events.find(e => e.type === "end");
              const breaks = emp.events.filter(e => e.type === "break");
              const lunch = emp.events.find(e => e.type === "lunch");
              const isSel = emp.id === selectedId;
              return (
                <tr
                  key={emp.id}
                  className={isSel ? "selected" : ""}
                  onClick={() => onSelect(emp.id)}
                >
                  <td className="td-name">
                    <div className="td-name-wrap">
                      <Avatar name={emp.name} size={30} />
                      <span>{emp.name}</span>
                    </div>
                  </td>
                  <td className="td-role">{emp.role}</td>
                  <td className="cell cell-clock mono">{minToTime(start.min)}</td>
                  <td className="cell cell-break mono">{minToTime(breaks[0].min)}</td>
                  <td className="cell cell-lunch">
                    <div className="mono">{minToTime(lunch.min)} – {minToTime(lunch.min + lunch.durMin)}</div>
                    <div className="cell-sub">{lunch.durMin} min</div>
                  </td>
                  <td className="cell cell-break mono">{minToTime(breaks[1].min)}</td>
                  <td className="cell cell-clock mono">{minToTime(end.min)}</td>
                  <td className="td-paid">{emp.paidHrs}<span> hrs</span></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ---------------- Timeline ----------------
function Timeline({ employees, onSelect, selectedId }) {
  return (
    <div className="timeline-card" id="timeline">
      <div className="timeline-head">
        <div className="timeline-head-left">
          <h2>Daily timeline</h2>
          <p>Color-coded view of every shift, break, and lunch. Click a row for details.</p>
        </div>
        <div className="timeline-head-right">
          <div className="legend">
            <span className="legend-item"><span className="legend-sw legend-work" />Working</span>
            <span className="legend-item"><span className="legend-sw legend-break" />Rest break (paid)</span>
            <span className="legend-item"><span className="legend-sw legend-lunch" />Lunch (unpaid)</span>
          </div>
        </div>
      </div>

      <div className="timeline-scroll">
        <div className="timeline-grid">
          {/* hour axis */}
          <div className="tl-axis-label" />
          <div className="tl-axis">
            {Array.from({ length: 11 }).map((_, i) => {
              const h = 7 + i;
              const p = pct(h * 60);
              const label = h === 12 ? "12p" : h < 12 ? `${h}a` : `${h - 12}p`;
              return (
                <div key={h} className="tl-tick" style={{ left: `${p}%` }}>
                  <span className="tl-tick-label">{label}</span>
                </div>
              );
            })}
          </div>

          {employees.map(emp => {
            const { segs, shiftStart, shiftEnd } = segments(emp);
            const isSelected = emp.id === selectedId;
            return (
              <React.Fragment key={emp.id}>
                <button
                  className={`tl-row-label ${isSelected ? "selected" : ""}`}
                  onClick={() => onSelect(emp.id)}
                >
                  <Avatar name={emp.name} size={28} />
                  <div className="tl-row-meta">
                    <div className="tl-row-name">{emp.first}</div>
                    <div className="tl-row-role">{emp.role}</div>
                  </div>
                </button>
                <div className={`tl-row ${isSelected ? "selected" : ""}`}>
                  {Array.from({ length: 10 }).map((_, i) => (
                    <div key={i} className="tl-gridline" style={{ left: `${pct((8 + i) * 60)}%` }} />
                  ))}
                  <div
                    className="tl-envelope"
                    style={{ left: `${pct(shiftStart)}%`, width: `${pct(shiftEnd) - pct(shiftStart)}%` }}
                  />
                  {segs.map((s, i) => {
                    const w = pct(s.end) - pct(s.start);
                    const tip = `${minToTime(s.start)} – ${minToTime(s.end)}`;
                    const label = s.type === "lunch" ? "Lunch" : s.type === "break" ? "Break" : "";
                    return (
                      <div
                        key={i}
                        className={`tl-seg tl-seg-${s.type}`}
                        style={{ left: `${pct(s.start)}%`, width: `${w}%` }}
                        title={`${label || "Working"} · ${tip}`}
                        onClick={() => onSelect(emp.id)}
                      >
                        {w > 4 && label && <span className="tl-seg-label">{label}</span>}
                      </div>
                    );
                  })}
                  <div className="tl-cap tl-cap-start" style={{ left: `${pct(shiftStart)}%` }}>
                    <span className="cap-time">{minToTime(shiftStart)}</span>
                  </div>
                  <div className="tl-cap tl-cap-end" style={{ left: `${pct(shiftEnd)}%` }}>
                    <span className="cap-time">{minToTime(shiftEnd)}</span>
                  </div>
                </div>
              </React.Fragment>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ---------------- Roster ----------------
function Roster({ employees, onSelect, selectedId }) {
  return (
    <section className="roster" id="roster">
      <div className="roster-head">
        <h2>Roster &amp; shifts</h2>
        <span className="roster-count">{employees.length} people</span>
      </div>
      <div className="roster-grid">
        {employees.map(emp => {
          const { shiftStart, shiftEnd } = segments(emp);
          const lunch = emp.events.find(e => e.type === "lunch");
          return (
            <button
              key={emp.id}
              className={`roster-card ${selectedId === emp.id ? "selected" : ""}`}
              onClick={() => onSelect(emp.id)}
            >
              <div className="roster-card-top">
                <Avatar name={emp.name} size={40} />
                <div className="roster-card-meta">
                  <div className="roster-name">{emp.name}</div>
                  <div className="roster-role">{emp.role}</div>
                </div>
                <div className="roster-hrs">{emp.paidHrs}<span>hrs</span></div>
              </div>
              <div className="roster-card-bottom">
                <div className="roster-cell">
                  <div className="roster-cell-label">Shift</div>
                  <div className="roster-cell-val mono">{minToTime(shiftStart)} → {minToTime(shiftEnd)}</div>
                </div>
                <div className="roster-cell">
                  <div className="roster-cell-label">Lunch</div>
                  <div className="roster-cell-val mono">{minToTime(lunch.min)} · {lunch.durMin}m</div>
                </div>
                <div className="roster-cell">
                  <div className="roster-cell-label">Dept</div>
                  <div className="roster-cell-val">{emp.dept}</div>
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </section>
  );
}

// ---------------- Department filter ----------------
function DeptChips({ dept, setDept, employees }) {
  const counts = useMemo(() => {
    const map = { All: employees.length };
    employees.forEach(e => { map[e.dept] = (map[e.dept] || 0) + 1; });
    return map;
  }, [employees]);
  return (
    <div className="chip-row">
      <span className="chip-label">Filter</span>
      {DEPTS.map(d => (
        <button
          key={d}
          className={`chip ${dept === d ? "chip-active" : ""}`}
          onClick={() => setDept(d)}
        >
          <span>{d}</span>
          <span className="chip-count">{counts[d] || 0}</span>
        </button>
      ))}
    </div>
  );
}

// ---------------- Detail Panel ----------------
function DetailPanel({ emp, onClose }) {
  if (!emp) return null;
  const { shiftStart, shiftEnd } = segments(emp);

  return (
    <aside className="detail-panel">
      <button className="detail-close" onClick={onClose} aria-label="Close">
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
          <path d="M6 6l12 12M18 6L6 18"/>
        </svg>
      </button>
      <div className="detail-head">
        <Avatar name={emp.name} size={56} />
        <div>
          <div className="detail-name">{emp.name}</div>
          <div className="detail-role">{emp.role} · {emp.dept}</div>
        </div>
      </div>
      <div className="detail-status">
        <span className="detail-paid">{emp.paidHrs} paid hrs / day</span>
        <span className="detail-paid">{minToTime(shiftStart)} → {minToTime(shiftEnd)}</span>
      </div>
      <div className="detail-note">{emp.note}</div>

      <ol className="detail-timeline">
        <li className="evt evt-start">
          <span className="evt-time mono">{minToTime(shiftStart)}</span>
          <span className="evt-dot" />
          <span className="evt-label">Clock in</span>
        </li>
        {emp.events.filter(e => e.type === "break" || e.type === "lunch").map((e, i) => (
          <li key={i} className={`evt evt-${e.type}`}>
            <span className="evt-time mono">{minToTime(e.min)} – {minToTime(e.min + e.durMin)}</span>
            <span className="evt-dot" />
            <span className="evt-label">
              {e.type === "lunch" ? `Lunch — ${e.durMin} min, unpaid` : `Rest break — ${e.durMin} min, paid`}
            </span>
          </li>
        ))}
        <li className="evt evt-end">
          <span className="evt-time mono">{minToTime(shiftEnd)}</span>
          <span className="evt-dot" />
          <span className="evt-label">Clock out</span>
        </li>
      </ol>
    </aside>
  );
}

// ---------------- Work Rules & Common Questions ----------------
function WorkRules() {
  const sections = [
    {
      key: "clock",
      icon: (
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>
        </svg>
      ),
      title: "Time clock & punches",
      items: [
        "Punch your own clock. Asking a coworker to punch you in or out (buddy punching) is grounds for termination.",
        "Punching in early doesn't mean your shift starts early. You're on the clock starting at your scheduled time — not before.",
        "Missed a punch? Tell your supervisor the same day. Don't let it pile up.",
      ],
    },
    {
      key: "lunch",
      featured: true,
      icon: (
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
          <path d="M5 11h14l-1 9H6L5 11z"/><path d="M9 11V7a3 3 0 0 1 6 0v4"/>
        </svg>
      ),
      title: "Lunch — the big one",
      eyebrow: "Highest legal risk",
      items: [
        "When you punch out for lunch, leave your workstation. No exceptions.",
        "You may not perform any work during an unpaid lunch. Even \"just finishing one thing\" creates a wage claim against the company. If something has to get done, don't punch out.",
        "Lunch is the full 30 minutes. Returning at 12:25 instead of 12:30 doesn't satisfy state law and undermines the policy for everyone.",
        "No verbal waivers. To skip a lunch, you must sign a written waiver and return it to Bradley Wright. A supervisor saying \"you can skip it\" is not legally valid in Washington.",
      ],
    },
    {
      key: "rest",
      icon: (
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
          <path d="M4 19a8 8 0 0 1 16 0"/><path d="M2 19h20"/><path d="M12 7V3"/><path d="M9 5h6"/>
        </svg>
      ),
      title: "Rest breaks — 10 min, paid",
      items: [
        "10 minutes means 10 minutes. Returning late counts the same as being late from anywhere else.",
        "Breaks can't be combined with lunch to leave early. WA law requires them near the midpoint of each 4-hour work period.",
        "Breaks can't be skipped to make up for a late arrival or to leave early.",
      ],
    },
    {
      key: "changes",
      icon: (
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 12a9 9 0 1 1-3-6.7"/><path d="M21 4v5h-5"/>
        </svg>
      ),
      title: "Schedule changes",
      items: [
        "Any change to your scheduled hours goes through Ruthie with at least 2 weeks' notice — start time, end time, lunch slot, or days off.",
        "Don't swap lunch slots with a coworker without Ruthie's approval. Lunch slots exist for production coverage, not preference.",
        "Last-minute changes will not be accommodated except for genuine emergencies. Standard requests need the full 2 weeks.",
      ],
    },
    {
      key: "attendance",
      icon: (
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/><path d="M9 16l2 2 4-4"/>
        </svg>
      ),
      title: "Attendance patterns",
      items: [
        "Habitual late arrivals or early departures will be addressed. Three or more occurrences in a month triggers a conversation with Ruthie.",
        "Calling out at the last minute should be the exception, not the rule — especially on Mondays and Fridays.",
      ],
    },
    {
      key: "fairness",
      icon: (
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 3v18"/><path d="M5 8l7-5 7 5"/><path d="M5 8l-3 7a4 4 0 0 0 6 0L5 8z"/><path d="M19 8l3 7a4 4 0 0 1-6 0L19 8z"/>
        </svg>
      ),
      title: "Fairness",
      items: [
        "The schedule is the schedule. Differences in lunch time or end time between employees reflect role, shift, and historical needs — they are not negotiable individually.",
        "Concerns about fairness or coverage go to Ruthie, not to coworkers. Don't try to work around the schedule informally.",
      ],
    },
  ];

  const loopholes = [
    {
      claim: "\"I'll just punch out and keep working to leave early.\"",
      reality: "Punching out means stop working AND leave your workstation. The minute you keep working off the clock, you create an off-the-clock wage claim against the company. There's no in-between."
    },
    {
      claim: "\"I'll take a 20-minute lunch so I can leave 10 minutes early.\"",
      reality: "WA law requires the full 30 minutes. A short lunch doesn't satisfy the rule, and the missing minutes can't be banked or traded against your end time."
    },
    {
      claim: "\"Brian or Ruthie said I could skip lunch today.\"",
      reality: "Supervisors cannot grant verbal waivers. The only valid way to skip a lunch is a signed, written waiver kept on file — submit it to Bradley Wright."
    },
  ];

  return (
    <section className="workrules" id="workrules">
      <div className="rules-head">
        <div className="rules-eyebrow">Internal policy</div>
        <h2>Work rules &amp; common questions</h2>
        <p className="rules-sub">
          Plain-language NWCA policy. These rules protect you, your coworkers, and the company — most of them mirror Washington labor law and a few exist for production coverage.
        </p>
      </div>

      <div className="wr-grid">
        {sections.map(s => (
          <div key={s.key} className={`wr-card ${s.featured ? "wr-card-featured" : ""}`}>
            <div className="wr-card-head">
              <span className="rule-icon">{s.icon}</span>
              <div>
                {s.eyebrow && <div className="wr-card-eyebrow">{s.eyebrow}</div>}
                <h3>{s.title}</h3>
              </div>
            </div>
            <ul>
              {s.items.map((t, i) => <li key={i}>{t}</li>)}
            </ul>
          </div>
        ))}
      </div>

      <div className="loopholes">
        <div className="loopholes-head">
          <span className="loopholes-icon">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
              <path d="M12 9v4M12 17h.01"/>
            </svg>
          </span>
          <div>
            <div className="loopholes-eyebrow">Three big "no"s</div>
            <h3>The shortcuts that create real legal risk</h3>
            <p>These are the three workarounds we hold the line on. Each one creates direct exposure for the company — and indirectly, for you.</p>
          </div>
        </div>
        <ol className="loopholes-list">
          {loopholes.map((l, i) => (
            <li key={i}>
              <div className="loophole-claim">
                <span className="loophole-num">{i + 1}</span>
                <span className="loophole-quote">{l.claim}</span>
              </div>
              <div className="loophole-reality">{l.reality}</div>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

// ---------------- WA Labor Rules ----------------
function LaborRules() {
  const wac = [
    "Employees shall be allowed a meal period of at least thirty minutes which commences no less than two hours nor more than five hours from the beginning of the shift. Meal periods shall be on the employer's time when the employee is required by the employer to remain on duty on the premises or at a prescribed work site in the interest of the employer.",
    "No employee shall be required to work more than five consecutive hours without a meal period.",
    "Employees working three or more hours longer than a normal work day shall be allowed at least one thirty-minute meal period prior to or during the overtime period.",
    "Employees shall be allowed a rest period of not less than ten minutes, on the employer's time, for each four hours of working time. Rest periods shall be scheduled as near as possible to the midpoint of the work period. No employee shall be required to work more than three hours without a rest period.",
  ];

  const guides = [
    {
      icon: (
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
          <path d="M5 11h14l-1 9H6L5 11z"/><path d="M9 11V7a3 3 0 0 1 6 0v4"/>
        </svg>
      ),
      title: "Meal periods",
      items: [
        "Required when an employee works more than 5 hours in a shift.",
        "Must be at least 30 minutes long.",
        "Must begin between the 2nd and 5th hour of the shift.",
      ],
    },
    {
      icon: (
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
          <rect x="2" y="6" width="20" height="12" rx="2"/><path d="M2 10h20"/>
        </svg>
      ),
      title: "Paid vs. unpaid",
      items: [
        "Meal breaks may be unpaid only if the employee is free from all duties for the entire break.",
        "Workers can be required to stay on the premises only if completely free from work duties.",
        "Unpaid meal breaks do not count as 'hours worked.'",
      ],
    },
    {
      icon: (
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6M9 13h6M9 17h6"/>
        </svg>
      ),
      title: "Waivers",
      items: [
        "Meal breaks may be waived if both employee and employer agree, in writing.",
        "Rest breaks CANNOT be waived.",
        "Employees may revoke a waiver at any time.",
      ],
    },
    {
      icon: (
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>
        </svg>
      ),
      title: "Rest breaks",
      items: [
        "At least 10 minutes, paid, for every 4 hours worked.",
        "Cannot work more than 3 hours without a rest break.",
        "Scheduled as close to the midpoint of the work period as possible.",
        "May be required to stay on the job site.",
        "Count as 'hours worked' for sick leave and overtime.",
      ],
    },
  ];

  return (
    <section className="rules" id="rules">
      <div className="rules-head">
        <div className="rules-eyebrow">Compliance reference</div>
        <h2>Washington State meal &amp; rest period rules</h2>
        <p className="rules-sub">
          Plain-language summary plus the verbatim regulation. Reference: WAC 296-126-092 / RCW 49.12.
        </p>
      </div>

      <div className="rules-grid">
        {guides.map((g, i) => (
          <div key={i} className="rule-card">
            <div className="rule-card-head">
              <span className="rule-icon">{g.icon}</span>
              <h3>{g.title}</h3>
            </div>
            <ul>
              {g.items.map((it, j) => <li key={j}>{it}</li>)}
            </ul>
          </div>
        ))}
      </div>

      <details className="rules-source">
        <summary>
          <span className="src-eyebrow">Verbatim statute</span>
          <span>WAC 296-126-092 — Meal Periods · Rest Periods</span>
          <svg className="chev" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M6 9l6 6 6-6"/>
          </svg>
        </summary>
        <ol className="wac-list">
          {wac.map((p, i) => (
            <li key={i}>
              <span className="wac-num">({i + 1})</span>
              <p>{p}</p>
            </li>
          ))}
        </ol>
      </details>

      <div className="rules-disclaimer">
        Plain-language summary based on the WA Department of Labor &amp; Industries workers-rights page.
        Not legal advice. Confirm with your employment attorney before changing policy.
      </div>
    </section>
  );
}

// ---------------- App ----------------
function App() {
  const all = window.NWCA_SCHEDULE;
  const [dept, setDept] = useState("All");
  const [selectedId, setSelectedId] = useState(null);

  const employees = useMemo(() => {
    const filtered = dept === "All" ? all : all.filter(e => e.dept === dept);
    return [...filtered].sort((a, b) => {
      const sa = a.events.find(e => e.type === "start").min;
      const sb = b.events.find(e => e.type === "start").min;
      return sa - sb;
    });
  }, [dept, all]);

  const selected = useMemo(
    () => all.find(e => e.id === selectedId) || null,
    [selectedId, all]
  );

  return (
    <div className="app">
      <Breadcrumb />
      <Header />

      {/* Print-only header — visible only when printing */}
      <div className="print-header" aria-hidden="true">
        <div className="print-brand">
          <div className="print-brand-mark">
            <svg viewBox="0 0 24 24" width="20" height="20">
              <rect x="3" y="5" width="18" height="16" rx="3" fill="none" stroke="currentColor" strokeWidth="1.6"/>
              <path d="M3 10h18" stroke="currentColor" strokeWidth="1.6"/>
              <path d="M8 3v4M16 3v4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
            </svg>
          </div>
          <div>
            <div className="print-eyebrow">NW Custom Apparel</div>
            <h1 className="print-title">Production Shifts</h1>
          </div>
        </div>
        <div className="print-meta">
          <div className="print-meta-row"><span>Printed</span><strong>{new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}</strong></div>
          <div className="print-meta-row"><span>Team size</span><strong>{all.length} employees</strong></div>
          <div className="print-meta-row"><span>Compliance</span><strong>WAC 296-126-092</strong></div>
        </div>
      </div>

      <main className="main">
        <div className="notices">
          <div className="notice notice-law">
            <span className="notice-icon">
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10"/>
                <path d="M12 8v4M12 16h.01"/>
              </svg>
            </span>
            <div className="notice-body">
              <div className="notice-label">Required by WA law</div>
              <div className="notice-text">
                Taking a lunch is required when an employee works more than 5 hours in a shift.
              </div>
            </div>
            <a href="#rules" className="notice-link">
              See rules
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M5 12h14M13 6l6 6-6 6"/>
              </svg>
            </a>
          </div>

          <div className="notice notice-schedule">
            <span className="notice-icon">
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="4" width="18" height="18" rx="2"/>
                <path d="M16 2v4M8 2v4M3 10h18"/>
              </svg>
            </span>
            <div className="notice-body">
              <div className="notice-label">Schedule changes</div>
              <div className="notice-text">
                Any change to your scheduled hours goes through Ruthie with at least 2 weeks' notice.
              </div>
            </div>
          </div>

          <div className="notice notice-policy">
            <span className="notice-icon">
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
                <path d="M12 9v4M12 17h.01"/>
              </svg>
            </span>
            <div className="notice-body">
              <div className="notice-label">Workstation policy</div>
              <div className="notice-text">
                All shifts, breaks, and lunches start and end at your workstation — not at the time clock.
              </div>
            </div>
          </div>
        </div>

        <a className="waiver-card" href="/forms/NWCA-Meal-Period-Waiver.pdf" download="NWCA Meal Period Waiver.pdf" target="_blank" rel="noopener">
          <span className="waiver-icon" aria-hidden="true">
            <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
              <path d="M14 2v6h6"/>
              <path d="M12 18v-6M9 15l3 3 3-3"/>
            </svg>
          </span>
          <div className="waiver-body">
            <div className="waiver-label">Need to skip a lunch?</div>
            <div className="waiver-title">Voluntary Meal Period Waiver</div>
            <div className="waiver-sub">Download, fill out, sign with a witness, and return the form to Bradley in his office.</div>
          </div>
          <span className="waiver-cta">
            Download PDF
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 12h14M13 6l6 6-6 6"/>
            </svg>
          </span>
        </a>

        <div className="waiver-note" role="note">
          <span className="waiver-note-icon" aria-hidden="true">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10"/>
              <path d="M12 8v4M12 16h.01"/>
            </svg>
          </span>
          <div>
            <strong>Please note:</strong> Working through lunch is a privilege we may extend on a case-by-case basis — it's not guaranteed. Any waiver must be reviewed and approved by management before it takes effect. Until then, every employee is required to take a full 30-minute lunch.
          </div>
        </div>

        <DaySummary employees={all} />
        <DeptChips dept={dept} setDept={setDept} employees={all} />

        <MasterTable
          employees={employees}
          onSelect={(id) => setSelectedId(prev => prev === id ? null : id)}
          selectedId={selectedId}
        />

        <Timeline
          employees={employees}
          onSelect={(id) => setSelectedId(prev => prev === id ? null : id)}
          selectedId={selectedId}
        />

        <WorkRules />

        <LaborRules />

        <footer className="page-foot">
          <span>NW Custom Apparel · Production team schedule</span>
          <span>Reference: WAC 296-126-092 / RCW 49.12</span>
        </footer>
      </main>

      {selected && (
        <DetailPanel emp={selected} onClose={() => setSelectedId(null)} />
      )}
      {selected && <div className="scrim" onClick={() => setSelectedId(null)} />}
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<App />);
