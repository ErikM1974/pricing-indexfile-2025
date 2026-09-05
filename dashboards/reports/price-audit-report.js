/* price-audit-report.js — page script (extracted from inline <script>, 2026.09.05.7) */

// ── moved from inline <script> in dashboards/reports/price-audit-report.html (Rule 3, 2026.09.05.7) ──
// Simple table filter by rep name
        document.querySelectorAll('.data-table').forEach(table => {
            const headers = table.querySelectorAll('th');
            headers.forEach((th, idx) => {
                th.style.cursor = 'pointer';
                th.addEventListener('click', () => {
                    const tbody = table.querySelector('tbody');
                    const rows = Array.from(tbody.querySelectorAll('tr'));
                    const isNum = th.classList.contains('num');
                    const dir = th.dataset.sortDir === 'asc' ? 'desc' : 'asc';
                    th.dataset.sortDir = dir;
                    rows.sort((a, b) => {
                        let aVal = a.children[idx]?.textContent?.trim() || '';
                        let bVal = b.children[idx]?.textContent?.trim() || '';
                        if (isNum) {
                            aVal = parseFloat(aVal.replace(/[^\d.\-]/g, '')) || 0;
                            bVal = parseFloat(bVal.replace(/[^\d.\-]/g, '')) || 0;
                            return dir === 'asc' ? aVal - bVal : bVal - aVal;
                        }
                        return dir === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
                    });
                    rows.forEach(r => tbody.appendChild(r));
                });
            });
        });
