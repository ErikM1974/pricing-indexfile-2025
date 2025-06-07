// Footer Component
// Phase 6: UI Redesign - Consistent footer across pages

export class Footer {
  constructor(options = {}) {
    this.options = {
      companyName: 'Northwest Custom Apparel',
      tagline: 'Family Owned and Operated Since 1977',
      address: '2025 Freeman Road East, Milton, WA 98354',
      phone: '253-922-5793',
      email: 'sales@nwcustomapparel.com',
      hours: '9AM-5PM',
      showQuickLinks: true,
      showSocial: false,
      theme: 'light',
      ...options
    };
    
    this.element = this.createElement();
  }
  
  createElement() {
    const footer = document.createElement('footer');
    footer.className = `ds-footer ds-footer-${this.options.theme}`;
    
    const container = document.createElement('div');
    container.className = 'ds-footer-container';
    
    // Main content grid
    const grid = document.createElement('div');
    grid.className = 'ds-footer-grid';
    
    // Company info column
    const companyCol = this.createCompanyColumn();
    grid.appendChild(companyCol);
    
    // Contact column
    const contactCol = this.createContactColumn();
    grid.appendChild(contactCol);
    
    // Quote request column
    const quoteCol = this.createQuoteColumn();
    grid.appendChild(quoteCol);
    
    // Quick links column (optional)
    if (this.options.showQuickLinks) {
      const linksCol = this.createQuickLinksColumn();
      grid.appendChild(linksCol);
    }
    
    container.appendChild(grid);
    
    // Copyright bar
    const copyright = this.createCopyright();
    container.appendChild(copyright);
    
    footer.appendChild(container);
    
    return footer;
  }
  
  createCompanyColumn() {
    const column = document.createElement('div');
    column.className = 'ds-footer-column';
    
    const title = document.createElement('h3');
    title.className = 'ds-footer-title';
    title.textContent = this.options.companyName;
    column.appendChild(title);
    
    const tagline = document.createElement('p');
    tagline.className = 'ds-footer-tagline';
    tagline.textContent = this.options.tagline;
    column.appendChild(tagline);
    
    const address = document.createElement('p');
    address.className = 'ds-footer-text';
    address.innerHTML = `📍 ${this.options.address}`;
    column.appendChild(address);
    
    return column;
  }
  
  createContactColumn() {
    const column = document.createElement('div');
    column.className = 'ds-footer-column';
    
    const title = document.createElement('h3');
    title.className = 'ds-footer-title';
    title.textContent = 'Contact Us';
    column.appendChild(title);
    
    const phone = document.createElement('p');
    phone.className = 'ds-footer-text';
    phone.innerHTML = `📞 Call: <a href="tel:${this.options.phone}" class="ds-footer-link">${this.options.phone}</a>`;
    column.appendChild(phone);
    
    const text = document.createElement('p');
    text.className = 'ds-footer-text';
    text.innerHTML = `📱 Text: <a href="sms:${this.options.phone}" class="ds-footer-link">${this.options.phone}</a>`;
    column.appendChild(text);
    
    const email = document.createElement('p');
    email.className = 'ds-footer-text';
    email.innerHTML = `✉️ Email: <a href="mailto:${this.options.email}" class="ds-footer-link">${this.options.email}</a>`;
    column.appendChild(email);
    
    const hours = document.createElement('p');
    hours.className = 'ds-footer-text';
    hours.innerHTML = `🕒 Hours: ${this.options.hours}`;
    column.appendChild(hours);
    
    return column;
  }
  
  createQuoteColumn() {
    const column = document.createElement('div');
    column.className = 'ds-footer-column';
    
    const title = document.createElement('h3');
    title.className = 'ds-footer-title';
    title.textContent = 'Request a Quote';
    column.appendChild(title);
    
    const info = document.createElement('p');
    info.className = 'ds-footer-tagline';
    info.textContent = 'Send quote requests to:';
    column.appendChild(info);
    
    const email = document.createElement('p');
    email.className = 'ds-footer-text';
    email.innerHTML = `✉️ <a href="mailto:${this.options.email}?subject=Quote Request" class="ds-footer-link ds-footer-link-underlined">${this.options.email}</a>`;
    column.appendChild(email);
    
    const note = document.createElement('p');
    note.className = 'ds-footer-note';
    note.textContent = 'Include: quantity, design details, and deadline';
    column.appendChild(note);
    
    return column;
  }
  
  createQuickLinksColumn() {
    const column = document.createElement('div');
    column.className = 'ds-footer-column';
    
    const title = document.createElement('h3');
    title.className = 'ds-footer-title';
    title.textContent = 'Quick Links';
    column.appendChild(title);
    
    const links = [
      { text: 'Home', href: '/' },
      { text: 'Products', href: '/products' },
      { text: 'Pricing', href: '/pricing' },
      { text: 'Contact', href: '/contact' }
    ];
    
    const list = document.createElement('ul');
    list.className = 'ds-footer-links';
    
    links.forEach(link => {
      const li = document.createElement('li');
      const a = document.createElement('a');
      a.href = link.href;
      a.className = 'ds-footer-link';
      a.textContent = link.text;
      li.appendChild(a);
      list.appendChild(li);
    });
    
    column.appendChild(list);
    
    return column;
  }
  
  createCopyright() {
    const copyright = document.createElement('div');
    copyright.className = 'ds-footer-copyright';
    
    const text = document.createElement('p');
    text.textContent = `© ${new Date().getFullYear()} ${this.options.companyName}. All rights reserved.`;
    copyright.appendChild(text);
    
    return copyright;
  }
  
  getElement() {
    return this.element;
  }
  
  static getStyles() {
    return `
      .ds-footer {
        background: var(--background);
        border-top: 1px solid var(--border);
        margin-top: var(--spacing-12);
        padding: var(--spacing-8) 0;
        font-size: var(--text-sm);
      }
      
      .ds-footer-dark {
        background: var(--color-gray-900);
        color: var(--color-gray-100);
      }
      
      .ds-footer-dark .ds-footer-link {
        color: var(--color-gray-300);
      }
      
      .ds-footer-dark .ds-footer-link:hover {
        color: white;
      }
      
      .ds-footer-container {
        max-width: 1200px;
        margin: 0 auto;
        padding: 0 var(--spacing-4);
      }
      
      .ds-footer-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
        gap: var(--spacing-8);
        margin-bottom: var(--spacing-8);
      }
      
      .ds-footer-column {
        /* Column styles */
      }
      
      .ds-footer-title {
        font-size: var(--text-lg);
        font-weight: var(--font-semibold);
        margin-bottom: var(--spacing-3);
        color: var(--text-primary);
      }
      
      .ds-footer-tagline {
        color: var(--text-secondary);
        margin-bottom: var(--spacing-2);
      }
      
      .ds-footer-text {
        color: var(--text-secondary);
        margin-bottom: var(--spacing-2);
        line-height: 1.6;
      }
      
      .ds-footer-link {
        color: var(--primary);
        text-decoration: none;
        transition: color var(--duration-200) var(--ease-out);
      }
      
      .ds-footer-link:hover {
        color: var(--primary-dark);
        text-decoration: underline;
      }
      
      .ds-footer-link-underlined {
        text-decoration: underline;
      }
      
      .ds-footer-note {
        font-size: var(--text-xs);
        color: var(--text-muted);
        margin-top: var(--spacing-2);
      }
      
      .ds-footer-links {
        list-style: none;
        padding: 0;
        margin: 0;
      }
      
      .ds-footer-links li {
        margin-bottom: var(--spacing-2);
      }
      
      .ds-footer-copyright {
        border-top: 1px solid var(--border);
        padding-top: var(--spacing-4);
        text-align: center;
        color: var(--text-muted);
      }
      
      @media (max-width: 768px) {
        .ds-footer-grid {
          grid-template-columns: 1fr;
          gap: var(--spacing-6);
        }
      }
    `;
  }
}

// Helper function
export function createFooter(options) {
  return new Footer(options);
}