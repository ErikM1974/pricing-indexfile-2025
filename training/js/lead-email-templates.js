/* Local email-template editor. This page never sends email. */
let activeTemplateCategory = 'all';
let templateSearch = '';
const templateStorageKey = 'nwca_email_templates';
const templateModal = document.getElementById('templateModal');
const templateForm = document.getElementById('templateForm');
const templateError = document.createElement('p');
templateError.className = 'training-status';
templateError.setAttribute('role', 'status');
templateForm.prepend(templateError);

function templateMessage(message, error = false) {
    const banner = document.getElementById('successMessage');
    banner.textContent = message;
    banner.classList.add('active');
    banner.classList.toggle('error', error);
}

async function copyTemplate(button) {
    const content = button.closest('.template-card').querySelector('.template-content').textContent;
    try {
        await navigator.clipboard.writeText(content);
        templateMessage('Template copied to clipboard!');
    } catch {
        templateMessage('Could not copy. Select the template text and copy it manually, or try again.', true);
    }
}

function editTemplate(button) {
    const card = button.closest('.template-card');
    templateForm.reset();
    document.getElementById('templateName').value = card.querySelector('.template-title').textContent;
    document.getElementById('templateCategory').value = card.dataset.category;
    document.getElementById('templateSubject').value = card.querySelector('.template-subject').textContent.replace(/^Subject:\s*/, '');
    document.getElementById('templateBody').value = card.querySelector('.template-content').textContent;
    templateError.textContent = '';
    templateModal.showModal();
    document.getElementById('templateName').focus();
}

function applyTemplateFilters() {
    let visible = 0;
    document.querySelectorAll('.template-card').forEach(card => {
        const match = (activeTemplateCategory === 'all' || card.dataset.category === activeTemplateCategory)
            && card.textContent.toLowerCase().includes(templateSearch);
        card.hidden = !match;
        if (match) visible++;
    });
    document.getElementById('training-template-results').textContent = visible
        ? visible + ' templates shown' : 'No matching templates. Change the category or search.';
}

function filterTemplates(category) {
    activeTemplateCategory = category;
    document.querySelectorAll('.filter-btn').forEach(button => {
        const selected = JSON.parse(button.dataset.args || '[]')[0] === category;
        button.classList.toggle('active', selected);
        button.setAttribute('aria-pressed', String(selected));
    });
    applyTemplateFilters();
}

function searchTemplates(query) {
    templateSearch = query.toLowerCase().trim();
    applyTemplateFilters();
}

function openCreateModal() {
    templateForm.reset();
    templateError.textContent = '';
    templateModal.showModal();
    document.getElementById('templateName').focus();
}

function closeModal() { templateModal.close(); }

function insertVariable(variable) {
    const textarea = document.getElementById('templateBody');
    textarea.setRangeText(variable, textarea.selectionStart, textarea.selectionEnd, 'end');
    textarea.focus();
}

function readCustomTemplates() {
    const saved = JSON.parse(localStorage.getItem(templateStorageKey) || '[]');
    if (!Array.isArray(saved) || saved.some(template => !template ||
        ['name', 'category', 'subject', 'body'].some(key => typeof template[key] !== 'string'))) {
        throw new Error('Saved template format is invalid');
    }
    return saved;
}

function renderCustomTemplate(template) {
    const card = document.querySelector('.template-card').cloneNode(true);
    card.hidden = false;
    card.dataset.category = template.category;
    card.querySelector('.template-title').textContent = template.name;
    card.querySelector('.template-desc').textContent = 'Your custom template, saved in this browser.';
    card.querySelector('.template-subject').textContent = 'Subject: ' + template.subject;
    card.querySelector('.template-content').textContent = template.body;
    const category = card.querySelector('.template-category');
    category.className = 'template-category';
    category.textContent = [...document.getElementById('templateCategory').options]
        .find(option => option.value === template.category)?.textContent || template.category;
    document.querySelector('.template-grid').append(card);
}

templateForm.addEventListener('submit', event => {
    event.preventDefault();
    const template = {
        name: document.getElementById('templateName').value.trim(),
        category: document.getElementById('templateCategory').value,
        subject: document.getElementById('templateSubject').value.trim(),
        body: document.getElementById('templateBody').value,
        created: new Date().toISOString(),
    };
    if (!template.name || !template.subject || !template.body.trim()) {
        templateError.textContent = 'Enter a template name, subject and email body before saving.';
        return;
    }
    try {
        const templates = readCustomTemplates();
        templates.push(template);
        localStorage.setItem(templateStorageKey, JSON.stringify(templates));
    } catch {
        templateError.textContent = 'Could not save in this browser. Your text is still here. Copy it before closing, or try Save again.';
        return;
    }
    renderCustomTemplate(template);
    applyTemplateFilters();
    closeModal();
    templateMessage('Template saved in this browser.');
});

const templateResults = document.createElement('p');
templateResults.id = 'training-template-results';
templateResults.className = 'training-status';
templateResults.setAttribute('role', 'status');
document.querySelector('.filter-bar').after(templateResults);
try {
    readCustomTemplates().forEach(renderCustomTemplate);
} catch {
    templateMessage('Could not load saved templates from this browser. Existing data has been kept; built-in templates remain available.', true);
}
filterTemplates('all');
