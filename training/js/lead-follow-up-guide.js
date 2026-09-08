/* Training guide interactions. Clipboard feedback stays with its template. */
async function copyTemplate(templateId, button) {
    const template = document.getElementById('template-' + templateId);
    if (!template || !button || button.disabled) return;
    const example = template.closest('.template-example');
    let status = example.querySelector('.copy-status');
    if (!status) {
        status = document.createElement('p');
        status.className = 'copy-status';
        status.setAttribute('role', 'status');
        example.appendChild(status);
    }
    button.disabled = true;
    status.classList.remove('is-error');
    status.textContent = 'Copying template…';
    try {
        await navigator.clipboard.writeText(template.textContent);
        status.textContent = 'Template copied.';
    } catch (_error) {
        status.classList.add('is-error');
        status.textContent = 'Copy failed. Select the template text and copy it manually, or try again.';
    } finally {
        button.disabled = false;
    }
}

function toggleAccordion(header) {
    const opening = header.getAttribute('aria-expanded') !== 'true';
    document.querySelectorAll('.accordion-header').forEach(button => {
        const open = button === header && opening;
        button.setAttribute('aria-expanded', String(open));
        button.nextElementSibling.classList.toggle('active', open);
    });
}

document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', event => {
            const target = document.getElementById(anchor.getAttribute('href').slice(1));
            if (!target) return;
            event.preventDefault();
            target.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' });
        });
    });
});
