/**
 * Elapsed Time Utilities — Shared across all art/mockup dashboards
 * Provides urgency badges showing how long since last action
 *
 * Color tiers:
 *   Fresh (green):   < 24 hours
 *   Waiting (amber): 24-48 hours
 *   Overdue (red):   > 48 hours
 */
(function (global) {
    'use strict';

    /**
     * Get elapsed time text and CSS class from a date
     * @param {Date|string} date - The date to calculate from
     * @returns {{ text: string, cssClass: string }} | null if invalid date
     */
    function getElapsedText(date) {
        if (!date) return null;
        var d = (date instanceof Date) ? date : new Date(date);
        if (isNaN(d.getTime())) return null;

        var now = new Date();
        var diffMs = now - d;
        if (diffMs < 0) return { text: 'just now', cssClass: 'elapsed--fresh' };

        var diffMins = Math.floor(diffMs / 60000);
        var diffHours = Math.floor(diffMs / 3600000);
        var diffDays = Math.floor(diffMs / 86400000);

        var text, cssClass;
        if (diffMins < 60) {
            text = diffMins <= 1 ? 'just now' : diffMins + ' min ago';
            cssClass = 'elapsed--fresh';
        } else if (diffHours < 24) {
            text = diffHours === 1 ? '1 hr ago' : diffHours + ' hrs ago';
            cssClass = 'elapsed--fresh';
        } else if (diffDays < 3) {
            text = diffDays === 1 ? '1 day ago' : diffDays + ' days ago';
            cssClass = 'elapsed--waiting';
        } else {
            text = diffDays + ' days ago';
            cssClass = 'elapsed--overdue';
        }
        return { text: text, cssClass: cssClass };
    }

    /**
     * Get compact elapsed text for Kanban cards (e.g., "2h", "1d", "5d")
     * @param {Date|string} date - The date to calculate from
     * @returns {{ text: string, cssClass: string }} | null if invalid date
     */
    function getCompactElapsed(date) {
        if (!date) return null;
        var d = (date instanceof Date) ? date : new Date(date);
        if (isNaN(d.getTime())) return null;

        var now = new Date();
        var diffMs = now - d;
        if (diffMs < 0) return { text: 'now', cssClass: 'elapsed--fresh' };

        var diffMins = Math.floor(diffMs / 60000);
        var diffHours = Math.floor(diffMs / 3600000);
        var diffDays = Math.floor(diffMs / 86400000);

        var text, cssClass;
        if (diffMins < 60) {
            text = diffMins + 'm';
            cssClass = 'elapsed--fresh';
        } else if (diffHours < 24) {
            text = diffHours + 'h';
            cssClass = 'elapsed--fresh';
        } else if (diffDays < 3) {
            text = diffDays + 'd';
            cssClass = 'elapsed--waiting';
        } else {
            text = diffDays + 'd';
            cssClass = 'elapsed--overdue';
        }
        return { text: text, cssClass: cssClass };
    }

    /**
     * Get status-specific elapsed badge HTML for grid cards
     * @param {string} status - Current status of the item
     * @param {object} item - The data object with date fields
     * @param {string} type - 'mockup' or 'art'
     * @returns {string} HTML string for the badge, or empty string
     */
    function getStatusElapsedBadge(status, item, type) {
        var normalizedStatus = (status || '').toLowerCase().trim();
        var elapsed = null;
        var label = '';

        if (type === 'mockup') {
            if (normalizedStatus === 'submitted' || normalizedStatus === 'new') {
                elapsed = getElapsedText(item.Submitted_Date);
                label = 'Submitted ';
            } else if (normalizedStatus === 'in progress') {
                elapsed = getElapsedText(item.Submitted_Date);
                label = 'In progress ';
            } else if (normalizedStatus === 'awaiting approval') {
                elapsed = getElapsedText(item.Approval_Sent_Date || item.Submitted_Date);
                label = 'Sent to AE ';
            } else if (normalizedStatus === 'revision requested') {
                elapsed = getElapsedText(item.Approval_Sent_Date || item.Submitted_Date);
                label = 'Revision pending ';
            } else if (normalizedStatus === 'approved' || normalizedStatus === 'completed') {
                elapsed = getElapsedText(item.Completion_Date || item.Approval_Sent_Date);
                if (elapsed) elapsed.cssClass = 'elapsed--fresh'; // Always green for completed
                label = 'Completed ';
            }
        } else if (type === 'art') {
            if (normalizedStatus === 'submitted' || normalizedStatus === 'new') {
                elapsed = getElapsedText(item.Date_Created);
                label = 'Submitted ';
            } else if (normalizedStatus === 'in progress') {
                elapsed = getElapsedText(item.Date_Created);
                label = 'In progress ';
            } else if (normalizedStatus === 'awaiting approval') {
                elapsed = getElapsedText(item.Approval_Sent_Date || item.Date_Created);
                label = 'Waiting for AE ';
            } else if (normalizedStatus === 'revision requested') {
                elapsed = getElapsedText(item.Approval_Sent_Date || item.Date_Created);
                label = 'Revision pending ';
            } else if (normalizedStatus === 'approved' || normalizedStatus === 'completed') {
                elapsed = getElapsedText(item.Completion_Date || item.Date_Created);
                if (elapsed) elapsed.cssClass = 'elapsed--fresh';
                label = 'Completed ';
            }
        }

        if (!elapsed) return '';
        return '<span class="elapsed-badge ' + elapsed.cssClass + '">' + label + elapsed.text + '</span>';
    }

    /**
     * Get compact elapsed badge HTML for Kanban cards
     * @param {string} status - Current status
     * @param {object} item - Data object with date fields
     * @param {string} type - 'mockup' or 'art'
     * @returns {string} HTML string for compact badge
     */
    function getKanbanElapsedBadge(status, item, type) {
        var normalizedStatus = (status || '').toLowerCase().trim();
        var date = null;

        if (type === 'mockup') {
            if (normalizedStatus === 'awaiting approval') {
                date = item.Approval_Sent_Date;
            } else if (normalizedStatus === 'revision requested') {
                date = item.Approval_Sent_Date;
            }
            date = date || item.Submitted_Date;
        } else {
            if (normalizedStatus === 'awaiting approval') {
                date = item.Approval_Sent_Date;
            }
            date = date || item.Date_Created;
        }

        var elapsed = getCompactElapsed(date);
        if (!elapsed) return '';
        return '<span class="kanban-elapsed ' + elapsed.cssClass + '" title="Time in this status">' + elapsed.text + '</span>';
    }

    // Inject CSS if not already present
    function injectElapsedCSS() {
        if (document.getElementById('elapsed-time-styles')) return;
        var style = document.createElement('style');
        style.id = 'elapsed-time-styles';
        style.textContent = [
            /* Grid badge styles */
            '.elapsed-badge { display: inline-block; font-size: 12px; padding: 2px 8px; border-radius: 10px; margin-top: 4px; }',
            '.elapsed--fresh { color: #16a34a; background: #f0fdf4; }',
            '.elapsed--waiting { color: #d97706; background: #fffbeb; }',
            '.elapsed--overdue { color: #dc2626; background: #fef2f2; font-weight: 600; }',
            /* Kanban compact badge */
            '.kanban-elapsed { display: inline-block; font-size: 10px; padding: 1px 5px; border-radius: 8px; margin-left: 6px; font-weight: 600; }',
        ].join('\n');
        document.head.appendChild(style);
    }

    // Auto-inject CSS on load
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', injectElapsedCSS);
    } else {
        injectElapsedCSS();
    }

    // Export
    global.ElapsedTimeUtils = {
        getElapsedText: getElapsedText,
        getCompactElapsed: getCompactElapsed,
        getStatusElapsedBadge: getStatusElapsedBadge,
        getKanbanElapsedBadge: getKanbanElapsedBadge
    };

})(window);
