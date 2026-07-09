/* ==========================================================================
   caspio-api-reference.js — controller for the Caspio REST API v4 reference
   viewer (Erik-only page). Renders the full v4 endpoint catalog from a static
   data snapshot and wires a live filter + smooth-scroll jump nav.

   Static reference — makes NO API calls. Data captured 2026-07-09 from the live
   Caspio v4 Swagger (/integrations/rest/v4/swagger/documentation, OpenAPI 3.0.4).
   ========================================================================== */
(function () {
    'use strict';

    // [method, path, summary] per section. 107 operations across 12 sections.
    var CAT = {
        'Schemas': [
            ['GET', '/v4/schemas/directories', 'Lists all accessible directories with their field definitions'],
            ['GET', '/v4/schemas/tables', 'Lists all accessible tables with their field definitions'],
            ['GET', '/v4/schemas/views', 'Lists all accessible views with their field definitions'],
            ['GET', '/v4/schemas/outgoingWebhooks', 'Lists all accessible outgoing webhooks with their event definitions']
        ],
        'Table Design': [
            ['GET', '/v4/tables', 'Lists tables'],
            ['POST', '/v4/tables', 'Creates a table'],
            ['GET', '/v4/tables/{tableId}', 'Gets a table'],
            ['GET', '/v4/tables/{tableId}/fields', 'Lists table fields'],
            ['POST', '/v4/tables/{tableId}/fields', 'Creates a table field'],
            ['GET', '/v4/tables/{tableId}/fields/{fieldName}', 'Gets a table field'],
            ['PATCH', '/v4/tables/{tableId}/fields/{fieldName}', 'Updates a table field'],
            ['DELETE', '/v4/tables/{tableId}/fields/{fieldName}', 'Deletes a table field']
        ],
        'Table Records': [
            ['GET', '/v4/tables/{tableId}/records', 'Lists table records'],
            ['POST', '/v4/tables/{tableId}/records', 'Creates a table record'],
            ['POST', '/v4/tables/{tableId}/records/bulk', 'Creates multiple table records'],
            ['PATCH', '/v4/tables/{tableId}/records/bulk', 'Updates table records that match a condition'],
            ['DELETE', '/v4/tables/{tableId}/records/bulk', 'Deletes table records that match a condition'],
            ['GET', '/v4/tables/{tableId}/records/{recordPkId}', 'Gets a table record by PK_ID'],
            ['PUT', '/v4/tables/{tableId}/records/{recordPkId}', 'Updates a table record by PK_ID'],
            ['PATCH', '/v4/tables/{tableId}/records/{recordPkId}', 'Updates a table record by PK_ID'],
            ['DELETE', '/v4/tables/{tableId}/records/{recordPkId}', 'Deletes a table record by PK_ID'],
            ['DELETE', '/v4/tables/{tableId}/records/bulk/attachments/{fieldName}', 'Deletes table attachment files that match a condition'],
            ['GET', '/v4/tables/{tableId}/records/bulk/attachments/{fieldName}/fileInfo', 'Gets attachment metadata for multiple table records'],
            ['PATCH', '/v4/tables/{tableId}/records/bulk/attachments/{fieldName}/fileInfo', 'Renames table attachment files that match a condition'],
            ['POST', '/v4/tables/{tableId}/records/bulk/attachments', 'Uploads files to multiple table records or attachment fields'],
            ['PATCH', '/v4/tables/{tableId}/records/bulk/passwordFields/{fieldName}', 'Updates a table password-field value'],
            ['DELETE', '/v4/tables/{tableId}/records/bulk/passwordFields/{fieldName}', 'Resets a table password-field value'],
            ['GET', '/v4/tables/{tableId}/records/{recordPkId}/attachments/{fieldName}', 'Downloads a table attachment file'],
            ['PUT', '/v4/tables/{tableId}/records/{recordPkId}/attachments/{fieldName}', 'Uploads or replaces a table attachment file'],
            ['DELETE', '/v4/tables/{tableId}/records/{recordPkId}/attachments/{fieldName}', 'Deletes a table attachment file']
        ],
        'View Design': [
            ['GET', '/v4/views', 'Lists views'],
            ['GET', '/v4/views/{viewId}', 'Gets a view'],
            ['GET', '/v4/views/{viewId}/fields', 'Lists view fields'],
            ['GET', '/v4/views/{viewId}/fields/{fieldName}', 'Gets a view field']
        ],
        'View Records': [
            ['GET', '/v4/views/{viewId}/records', 'Lists view records'],
            ['POST', '/v4/views/{viewId}/records', 'Creates a view record'],
            ['POST', '/v4/views/{viewId}/records/bulk', 'Creates multiple view records'],
            ['PATCH', '/v4/views/{viewId}/records/bulk', 'Updates view records that match a condition'],
            ['DELETE', '/v4/views/{viewId}/records/bulk', 'Deletes view records that match a condition'],
            ['GET', '/v4/views/{viewId}/records/{recordPkId}', 'Gets a view record by PK_ID'],
            ['PUT', '/v4/views/{viewId}/records/{recordPkId}', 'Updates a view record by PK_ID'],
            ['PATCH', '/v4/views/{viewId}/records/{recordPkId}', 'Updates a view record by PK_ID'],
            ['DELETE', '/v4/views/{viewId}/records/{recordPkId}', 'Deletes a view record by PK_ID'],
            ['DELETE', '/v4/views/{viewId}/records/bulk/attachments/{fieldName}', 'Deletes view attachment files that match a condition'],
            ['GET', '/v4/views/{viewId}/records/bulk/attachments/{fieldName}/fileInfo', 'Gets attachment metadata for multiple view records'],
            ['PATCH', '/v4/views/{viewId}/records/bulk/attachments/{fieldName}/fileInfo', 'Renames view attachment files that match a condition'],
            ['POST', '/v4/views/{viewId}/records/bulk/attachments', 'Uploads files to multiple view records or attachment fields'],
            ['GET', '/v4/views/{viewId}/records/{recordPkId}/attachments/{fieldName}', 'Downloads a view attachment file'],
            ['PUT', '/v4/views/{viewId}/records/{recordPkId}/attachments/{fieldName}', 'Uploads or replaces a view attachment file'],
            ['DELETE', '/v4/views/{viewId}/records/{recordPkId}/attachments/{fieldName}', 'Deletes a view attachment file']
        ],
        'Directory Design': [
            ['GET', '/v4/directories', 'Lists directories'],
            ['GET', '/v4/directories/{directoryId}', 'Gets a directory'],
            ['GET', '/v4/directories/{directoryId}/fields', 'Lists directory fields'],
            ['POST', '/v4/directories/{directoryId}/fields', 'Creates a directory field'],
            ['GET', '/v4/directories/{directoryId}/fields/{fieldName}', 'Gets a directory field'],
            ['PATCH', '/v4/directories/{directoryId}/fields/{fieldName}', 'Updates a directory field'],
            ['DELETE', '/v4/directories/{directoryId}/fields/{fieldName}', 'Deletes a directory field']
        ],
        'Directory Users': [
            ['GET', '/v4/directories/{directoryId}/users', 'Lists directory users'],
            ['POST', '/v4/directories/{directoryId}/users', 'Creates a directory user'],
            ['POST', '/v4/directories/{directoryId}/users/bulk', 'Creates multiple directory users'],
            ['PATCH', '/v4/directories/{directoryId}/users/bulk', 'Updates directory users that match a condition'],
            ['DELETE', '/v4/directories/{directoryId}/users/bulk', 'Deletes directory users that match a condition'],
            ['PATCH', '/v4/directories/{directoryId}/users/{userId}', 'Updates a directory user by UserGUID'],
            ['DELETE', '/v4/directories/{directoryId}/users/{userId}', 'Deletes a directory user by UserGUID'],
            ['POST', '/v4/directories/{directoryId}/users/{userId}/activate', 'Activates a directory user'],
            ['GET', '/v4/directories/{directoryId}/users/{userId}/attachments/{fieldName}', 'Downloads a directory-user attachment file'],
            ['PUT', '/v4/directories/{directoryId}/users/{userId}/attachments/{fieldName}', 'Uploads or replaces a directory-user attachment file'],
            ['DELETE', '/v4/directories/{directoryId}/users/{userId}/attachments/{fieldName}', 'Deletes a directory-user attachment file'],
            ['GET', '/v4/directories/{directoryId}/users/bulk/attachments/{fieldName}/fileInfo', 'Gets attachment metadata for multiple directory users'],
            ['PATCH', '/v4/directories/{directoryId}/users/bulk/attachments/{fieldName}/fileInfo', 'Renames directory-user attachment files that match a condition']
        ],
        'File Assets': [
            ['GET', '/v4/fileAssets/files', 'Lists files in a folder'],
            ['PUT', '/v4/fileAssets/files', 'Uploads or replaces a file'],
            ['GET', '/v4/fileAssets/files/search', 'Searches files by name'],
            ['POST', '/v4/fileAssets/files/bulk', 'Uploads one or more files'],
            ['GET', '/v4/fileAssets/files/{fileId}/fileInfo', 'Gets file metadata by file ID'],
            ['GET', '/v4/fileAssets/files/{fileId}', 'Downloads a file by file ID'],
            ['DELETE', '/v4/fileAssets/files/{fileId}', 'Deletes a file by file ID'],
            ['GET', '/v4/fileAssets/files/path/fileInfo', 'Gets file metadata by file path'],
            ['GET', '/v4/fileAssets/files/path', 'Downloads a file by file path'],
            ['DELETE', '/v4/fileAssets/files/path', 'Deletes a file by file path'],
            ['GET', '/v4/fileAssets/folders', 'Lists folders in a folder'],
            ['POST', '/v4/fileAssets/folders', 'Creates a folder'],
            ['GET', '/v4/fileAssets/folders/search', 'Searches folders by name'],
            ['GET', '/v4/fileAssets/folders/{folderId}', 'Gets folder metadata']
        ],
        'Outgoing Webhooks': [
            ['GET', '/v4/outgoingWebhooks', 'Lists outgoing webhooks'],
            ['POST', '/v4/outgoingWebhooks', 'Creates an outgoing webhook'],
            ['GET', '/v4/outgoingWebhooks/{webhookId}', 'Gets an outgoing webhook'],
            ['PATCH', '/v4/outgoingWebhooks/{webhookId}', 'Updates an outgoing webhook'],
            ['DELETE', '/v4/outgoingWebhooks/{webhookId}', 'Deletes an outgoing webhook and its events'],
            ['PATCH', '/v4/outgoingWebhooks/{webhookId}/regenerateSecret', 'Regenerates a webhook secret'],
            ['GET', '/v4/outgoingWebhooks/{webhookId}/events', 'Lists events for an outgoing webhook'],
            ['POST', '/v4/outgoingWebhooks/{webhookId}/events', 'Creates an event for an outgoing webhook'],
            ['GET', '/v4/outgoingWebhooks/{webhookId}/events/{eventId}', 'Gets a webhook event'],
            ['PATCH', '/v4/outgoingWebhooks/{webhookId}/events/{eventId}', 'Updates a webhook event'],
            ['DELETE', '/v4/outgoingWebhooks/{webhookId}/events/{eventId}', 'Deletes a webhook event']
        ],
        'Data Import/Export Tasks': [
            ['GET', '/v4/dataImportExportTasks', 'Lists data import/export tasks'],
            ['GET', '/v4/dataImportExportTasks/{taskId}', 'Gets a data import/export task'],
            ['POST', '/v4/dataImportExportTasks/{taskId}/run', 'Runs a data import/export task']
        ],
        'Flex Applications': [
            ['GET', '/v4/flexApplications', 'Lists Flex applications'],
            ['GET', '/v4/flexApplications/{appId}', 'Gets a Flex application']
        ],
        'Bridge Applications': [
            ['GET', '/v4/bridgeApplications', 'Lists Bridge applications'],
            ['GET', '/v4/bridgeApplications/{appId}', 'Gets a Bridge application'],
            ['GET', '/v4/bridgeApplications/{appId}/dataPages', 'Lists DataPages in a Bridge application'],
            ['GET', '/v4/bridgeApplications/{appId}/dataPages/{appKey}', 'Gets a DataPage'],
            ['GET', '/v4/bridgeApplications/{appId}/dataPages/{appKey}/deployment', 'Gets the deployment code for a DataPage'],
            ['PUT', '/v4/bridgeApplications/{appId}/dataPages/{appKey}/deployment', 'Deploys or undeploys a DataPage'],
            ['PUT', '/v4/bridgeApplications/{appId}/dataPages/bulk/deployment', 'Deploys or undeploys all DataPages in a Bridge application']
        ]
    };

    function escapeHtml(s) {
        return String(s)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    function escapeRegExp(s) {
        return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }

    // Escape first, then wrap query hits in <mark> (query is escaped for both HTML + regex).
    function highlight(text, q) {
        var safe = escapeHtml(text);
        if (!q) return safe;
        try {
            var re = new RegExp('(' + escapeRegExp(escapeHtml(q)) + ')', 'ig');
            return safe.replace(re, '<mark class="capi-hit">$1</mark>');
        } catch (e) {
            return safe;
        }
    }

    var catalogEl = document.getElementById('capiCatalog');
    var filterEl = document.getElementById('capiFilter');
    var countEl = document.getElementById('capiFilterCount');

    var TOTAL = Object.keys(CAT).reduce(function (n, k) { return n + CAT[k].length; }, 0);

    function render(query) {
        var q = (query || '').trim().toLowerCase();
        var html = '';
        var shown = 0;

        Object.keys(CAT).forEach(function (group) {
            var rows = CAT[group].filter(function (r) {
                if (!q) return true;
                return (r[0] + ' ' + r[1] + ' ' + r[2]).toLowerCase().indexOf(q) !== -1;
            });
            if (!rows.length) return;
            shown += rows.length;

            html += '<div class="capi-grpbar"><h3>' + escapeHtml(group) +
                '</h3><span class="capi-count">' + rows.length + '</span></div>';
            html += '<div class="capi-eplist">';
            rows.forEach(function (r) {
                html += '<div class="capi-ep">' +
                    '<span class="capi-m ' + escapeHtml(r[0]) + '">' + escapeHtml(r[0]) + '</span>' +
                    '<span class="capi-path">' + highlight(r[1], q) + '</span>' +
                    '<span class="capi-desc">' + highlight(r[2], q) + '</span>' +
                    '</div>';
            });
            html += '</div>';
        });

        if (!shown) {
            html = '<div class="capi-empty">No endpoints match &ldquo;' + escapeHtml(query) + '&rdquo;.</div>';
        }
        catalogEl.innerHTML = html;

        if (countEl) {
            countEl.textContent = q
                ? shown + ' of ' + TOTAL + ' operations match'
                : TOTAL + ' operations across ' + Object.keys(CAT).length + ' sections';
        }
    }

    if (catalogEl) {
        render('');
        if (filterEl) {
            filterEl.addEventListener('input', function () { render(filterEl.value); });
        }
    }

    // Smooth-scroll the jump nav (respects reduced-motion via CSS scroll-behavior).
    document.querySelectorAll('.capi-toc a[href^="#"]').forEach(function (a) {
        a.addEventListener('click', function (e) {
            var target = document.getElementById(this.getAttribute('href').slice(1));
            if (target) {
                e.preventDefault();
                target.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
        });
    });
})();
