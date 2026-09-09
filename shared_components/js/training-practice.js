/* Shared keyboard selection, mode state and feedback for training exercises. */
(function () {
    'use strict';
    function announce(message) {
        let status = document.getElementById('training-status');
        if (!status) {
            status = document.createElement('p');
            status.id = 'training-status';
            status.className = 'training-status';
            status.setAttribute('role', 'status');
            const main = document.querySelector('main');
            const controls = main.querySelector('.game-info, .info-bar, .game-controls, .game-mode-selector');
            if (controls) controls.after(status);
            else main.prepend(status);
        }
        status.textContent = message;
    }
    function modes(mode) {
        document.querySelectorAll('.mode-btn').forEach(button => {
            const selected = JSON.parse(button.dataset.args || '[]')[0] === mode;
            button.classList.toggle('active', selected);
            button.setAttribute('aria-pressed', String(selected));
        });
    }
    function selectCard(card, selector) {
        document.querySelectorAll(selector).forEach(button => {
            button.classList.toggle('training-selected', button === card);
            button.setAttribute('aria-pressed', String(button === card));
        });
        announce(card.textContent.trim() + ' selected. Choose a matching destination.');
    }
    function args(values) {
        return JSON.stringify(values).replace(/&/g, '&amp;').replace(/"/g, '&quot;')
            .replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/'/g, '&#39;');
    }
    Object.defineProperty(window, 'NWTraining', { value: { announce, modes, selectCard, args } });
})();
