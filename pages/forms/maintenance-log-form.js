/**
 * maintenance-log-form.js — pages/forms/maintenance-log-form.html
 *
 * ONE fillable page for all six equipment maintenance logs (?type=embroidery|
 * kornit|heat-press|laser|roland|compressor). Task lists, identity fields and
 * readings mirror each official fillable PDF exactly (extracted from their
 * AcroForm field names, 2026-07-11). Save to NWCA → Forms Inbox (MNT prefix);
 * "Next Service Due" saves as the submission due date, so upcoming machine
 * service shows in the Inbox "Due in 7 days" stat automatically.
 */
(function () {
    'use strict';

    var TYPES = {
        'embroidery': {
            title: 'Embroidery Machine Maintenance Log',
            subtitle: 'Cleaning, lubrication, inspection, adjustments and repairs for embroidery machines',
            pdf: '/forms/embroidery-maintenance-log.pdf',
            identity: ['Machine ID', 'Brand / Model', 'Serial', 'Heads / Location'],
            readings: ['Stitch / Run Counter', 'Air Pressure', 'Needle Size / Type', 'Test Design / Result'],
            tasks: [
                'Remove lint and thread from hook / bobbin area',
                'Oil rotary hooks and specified lubrication points',
                'Inspect / replace needles and verify orientation',
                'Inspect bobbin cases and check bobbin tension',
                'Check upper thread path and thread tensions',
                'Test trimmers, knives and thread break sensors',
                'Inspect hoops, clamps and cap driver components',
                'Check safety guards and emergency functions',
                'Inspect belts, drive parts and unusual noise',
                'Check air pressure and inspect for leaks',
                'Verify hook timing / needle depth if scheduled',
                'Run test sew and inspect stitch quality',
                'Clean machine exterior and surrounding area',
                'Reset / update maintenance counter if applicable',
            ],
        },
        'kornit': {
            title: 'Kornit DTG Maintenance Log',
            subtitle: 'Required maintenance, cleaning, testing and repairs for the Kornit DTG printer',
            pdf: '/forms/kornit-dtg-maintenance-log.pdf',
            identity: ['Machine ID', 'Model', 'Serial', 'Location'],
            readings: ['Room Temp', 'Humidity', 'Nozzle Test Result', 'Dryer / Conveyor Temp'],
            tasks: [
                'Record room temperature and humidity',
                'Check ink / pretreatment levels and expiration',
                'Run nozzle test and record result',
                'Clean printheads per approved Kornit procedure',
                'Clean capping stations, wipers and maintenance area',
                'Inspect ink / pretreatment lines for leaks or air',
                'Inspect / empty waste tank as required',
                'Clean platen, sensors and print area',
                'Inspect pretreatment nozzles and spray pattern',
                'Verify dryer / conveyor temperature and airflow',
                'Perform calibration and approved test print',
                'Inspect filters and replace when due',
                'Review alarms, counters and software notices',
                'Clean machine exterior and ventilation area',
            ],
        },
        'heat-press': {
            title: 'Heat Press Maintenance & Calibration Log',
            subtitle: 'Temperature, pressure and timer verification for heat presses',
            pdf: '/forms/heat-press-maintenance-log.pdf',
            identity: ['Press ID', 'Brand / Model', 'Serial', 'Location'],
            readings: ['Set Temperature', 'Verified Temperature', 'Pressure Setting', 'Timer / Test Result'],
            tasks: [
                'Clean upper platen and lower pad',
                'Inspect protective sheet / platen cover',
                'Verify temperature with calibrated thermometer',
                'Verify pressure is even across platen',
                'Verify timer, alarm and control display',
                'Inspect power cord, plug and electrical connection',
                'Inspect handle, hinges, latches and fasteners',
                'Check emergency stop / safety devices if equipped',
                'Inspect lower pad for compression or damage',
                'Check pneumatic lines / regulator if equipped',
                'Perform heat distribution or test press check',
                'Inspect for unusual noise, smell or overheating',
                'Clean work area and remove transfer residue',
                'Record calibration or parts replacement due',
            ],
        },
        'laser': {
            title: 'Laser Equipment Maintenance & Safety Log',
            subtitle: 'Cleaning, inspection, safety checks and repairs for laser engraving / cutting equipment',
            pdf: '/forms/laser-maintenance-log.pdf',
            identity: ['Laser ID', 'Brand / Model', 'Serial', 'Location'],
            readings: ['Chiller Temp', 'Air Assist Pressure', 'Focus / Calibration', 'Test Material / Result'],
            tasks: [
                'Clean lens and mirrors per manufacturer procedure',
                'Inspect focus lens / nozzle and alignment',
                'Clean bed, honeycomb, rails and debris trays',
                'Inspect exhaust filters, ducting and airflow',
                'Verify air assist operation and pressure',
                'Check chiller / coolant level, flow and temperature',
                'Verify lid, interlocks and emergency stop',
                'Inspect belts, rails, motion and lubrication points',
                'Verify fire extinguisher and clear work area',
                'Calibrate focus, origin and alignment as needed',
                'Perform approved test engrave / cut',
                'Review software, firmware and error messages',
                'Remove smoke residue from interior surfaces',
                'Record filter, lens or service replacement due',
            ],
        },
        'roland': {
            title: 'Roland Printer Maintenance Log',
            subtitle: 'Cleaning, calibration, testing and repairs for the Roland printer',
            pdf: '/forms/roland-maintenance-log.pdf',
            identity: ['Printer ID', 'Model', 'Serial', 'Location'],
            readings: ['Nozzle Test Result', 'Feed Calibration', 'Bi-Directional Calibration', 'Heater / Dryer Temp'],
            tasks: [
                'Run nozzle test and record result',
                'Clean printheads using approved procedure',
                'Clean capping station, wipers and maintenance area',
                'Check ink levels, cartridges and expiration',
                'Inspect / empty waste bottle as required',
                'Clean encoder strip, platen and media path',
                'Inspect pinch rollers and grit rollers',
                'Check media feed / take-up operation',
                'Perform feed and bidirectional calibration',
                'Inspect cutting strip, blade and blade holder',
                'Verify heater / dryer temperature and operation',
                'Inspect ink lines / dampers for leaks or air',
                'Run approved print / cut test',
                'Clean exterior and surrounding work area',
            ],
        },
        'compressor': {
            title: 'Compressors & Support Equipment Maintenance Log',
            subtitle: 'Air compressors and production support equipment',
            pdf: '/forms/compressor-support-maintenance-log.pdf',
            identity: ['Equipment ID', 'Equipment Type', 'Brand / Model', 'Location'],
            readings: ['Run Hours', 'Cut-In Pressure', 'Cut-Out Pressure', 'Downstream Pressure'],
            tasks: [
                'Drain moisture from tank, traps and air lines',
                'Check oil level / condition if oil-lubricated',
                'Inspect / clean intake filters',
                'Inspect belts, pulleys, guards and fasteners',
                'Check for unusual noise, heat or vibration',
                'Inspect hoses, fittings and air leaks',
                'Verify regulator and pressure switch operation',
                'Test safety relief valve per approved procedure',
                'Inspect dryer, separator and downstream filters',
                'Clean cooling fins, vents and surrounding area',
                'Inspect power cord, disconnect and electrical area',
                'Record cut-in / cut-out pressure',
                'Inspect tank for corrosion, damage or moisture',
                'Verify connected support equipment operates properly',
            ],
        },
    };

    var currentType = 'embroidery';

    document.addEventListener('DOMContentLoaded', function () {
        var param = new URLSearchParams(window.location.search).get('type');
        if (param && TYPES[param]) currentType = param;

        buildTypeSwitch();
        applyType(currentType);

        NWCAForm.init({});
        NWCAFormSave.init({ formId: 'maintenance-log', build: buildSubmission });
    });

    function buildTypeSwitch() {
        var wrap = document.getElementById('typeSwitch');
        Object.keys(TYPES).forEach(function (key) {
            var btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'type-chip';
            btn.dataset.type = key;
            btn.textContent = TYPES[key].title.replace(' Maintenance & Calibration Log', '').replace(' Maintenance & Safety Log', '').replace(' Maintenance Log', '');
            btn.addEventListener('click', function () {
                if (key === currentType) return;
                if (!window.confirm('Switch equipment type? Typed values in the sections below stay, but the task list changes.')) return;
                currentType = key;
                applyType(key);
                var url = new URL(window.location.href);
                url.searchParams.set('type', key);
                window.history.replaceState(null, '', url.toString());
            });
            wrap.appendChild(btn);
        });
    }

    function applyType(key) {
        var cfg = TYPES[key];
        document.title = cfg.title + ' - Northwest Custom Apparel';
        document.getElementById('formTitle').textContent = cfg.title;
        document.getElementById('formSubtitle').textContent = cfg.subtitle;
        document.getElementById('blankPdfLink').href = cfg.pdf;
        document.querySelectorAll('.type-chip').forEach(function (chip) {
            chip.classList.toggle('is-active', chip.dataset.type === key);
        });

        // identity fields (4 per type) + shared record fields
        var identity = document.getElementById('identityGrid');
        identity.innerHTML = '';
        cfg.identity.concat(['Maintenance Date / Time', 'Performed By']).forEach(function (label, i) {
            var div = document.createElement('div');
            div.className = 'info-field';
            var id = 'ident' + i;
            div.innerHTML = '<label for="' + id + '">' + label + '</label><input type="text" id="' + id + '" data-label="' + label.replace(/"/g, '&quot;') + '">';
            identity.appendChild(div);
        });

        // task checklist
        var tbody = document.getElementById('taskRows');
        tbody.innerHTML = '';
        cfg.tasks.forEach(function (task, i) {
            var tr = document.createElement('tr');
            tr.innerHTML = '<td class="cell-task">' + task + '</td>' +
                '<td class="cell-check"><input type="checkbox" class="task-done" data-task="' + task.replace(/"/g, '&quot;') + '" aria-label="Done"></td>' +
                '<td class="cell-check"><input type="checkbox" class="task-na" data-task="' + task.replace(/"/g, '&quot;') + '" aria-label="Not applicable"></td>';
            tbody.appendChild(tr);
        });
        // Done and N/A are mutually exclusive per row
        tbody.addEventListener('change', function (e) {
            if (!e.target.matches('.task-done, .task-na')) return;
            var tr = e.target.closest('tr');
            if (e.target.checked) {
                var other = e.target.classList.contains('task-done') ? tr.querySelector('.task-na') : tr.querySelector('.task-done');
                other.checked = false;
            }
        });

        // readings (4 per type)
        var readings = document.getElementById('readingsGrid');
        readings.innerHTML = '';
        cfg.readings.forEach(function (label, i) {
            var div = document.createElement('div');
            div.className = 'info-field';
            var id = 'reading' + i;
            div.innerHTML = '<label for="' + id + '">' + label + '</label><input type="text" id="' + id + '" data-label="' + label.replace(/"/g, '&quot;') + '">';
            readings.appendChild(div);
        });
    }

    function buildSubmission() {
        var cfg = TYPES[currentType];
        var V = NWCAFormSave.val;

        var identPairs = [];
        document.querySelectorAll('#identityGrid input').forEach(function (el) {
            identPairs.push([el.dataset.label, el.value.trim()]);
        });
        var readingPairs = [];
        document.querySelectorAll('#readingsGrid input').forEach(function (el) {
            readingPairs.push([el.dataset.label, el.value.trim()]);
        });

        var mtChecks = [];
        [['mtDaily', 'Daily'], ['mtWeekly', 'Weekly'], ['mtMonthly', 'Monthly'], ['mtQuarterly', 'Quarterly'],
         ['mtPreventive', 'Preventive'], ['mtCorrective', 'Corrective'], ['mtEmergency', 'Emergency / Breakdown']]
            .forEach(function (p) { if (NWCAFormSave.checked(p[0])) mtChecks.push(p[1]); });

        var statusChecks = [];
        [['stReady', 'Ready for Use'], ['stLimited', 'Limited Use'], ['stOut', 'OUT OF SERVICE'], ['stFollowUp', 'Follow-Up Required']]
            .forEach(function (p) { if (NWCAFormSave.checked(p[0])) statusChecks.push(p[1]); });

        var taskRows = [];
        var doneCount = 0;
        document.querySelectorAll('#taskRows tr').forEach(function (tr) {
            var done = tr.querySelector('.task-done').checked;
            var na = tr.querySelector('.task-na').checked;
            if (done) doneCount++;
            taskRows.push([tr.querySelector('.cell-task').textContent, done ? '✓ Done' : (na ? 'N/A' : '—')]);
        });

        var machineId = (identPairs[0] && identPairs[0][1]) || '';
        var machineStatus = statusChecks[0] || '';

        return {
            // "Company" carries the equipment identity — that's the who of a
            // maintenance record and what staff scan for in the Inbox list.
            company: (machineId ? machineId + ' — ' : '') + cfg.title.replace(' Maintenance & Calibration Log', '').replace(' Maintenance & Safety Log', '').replace(' Maintenance Log', ''),
            contactName: V('ident' + (cfg.identity.length + 1)) || '', // Performed By
            phone: '',
            email: '',
            customerNumber: '',
            salesRep: V('fldSupervisor'),
            dueDateText: V('fldNextService'),
            summary: (mtChecks[0] || 'Maintenance') + ' · ' + doneCount + '/' + cfg.tasks.length + ' tasks' +
                     (machineStatus ? ' · ' + machineStatus : '') +
                     (NWCAFormSave.checked('stFollowUp') ? ' · ⚠ follow-up' : ''),
            payload: {
                fields: identPairs.concat(readingPairs).concat([
                    ['Equipment Type', cfg.title],
                    ['Next Service Due', V('fldNextService')],
                    ['Downtime', V('fldDowntime')],
                    ['Supervisor Initials', V('fldSupervisor')],
                ]),
                checks: mtChecks.concat(statusChecks),
                tables: [{ title: 'Maintenance Tasks', columns: ['Task', 'Result'], rows: taskRows }],
                notes: [['Issues Found', V('fldIssues')], ['Action Taken & Parts Used', V('fldAction')]],
            },
        };
    }
})();
