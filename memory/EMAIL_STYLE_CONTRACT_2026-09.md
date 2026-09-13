# Email styling and externally hosted UI — 2026-09-13

## Reviewed local email templates

The Christmas confirmation, customer mockup approval and both golf inquiry templates share `shared_components/css/email-theme.css`. The theme uses the application's canonical color tokens, Arial fallbacks, a fluid 640px card, readable controls and wrapping customer fields. It is a build source, never an email stylesheet link.

Run `npm run build:emails` after changing the theme or template markup, then `npm run check:emails`. The compiler resolves tokens into static inline declarations in the four HTML files. It applies the theme's rules in explicit source order, preserving other declarations; it is not a general CSS specificity compiler. Do not introduce at-rules, CSS variables in output, external stylesheet dependencies or `!important`. Keep section/header markers on immediate card cells so nested data cells do not inherit section padding. The mockup template uses the explicit compact density setting.

Edit copy and EmailJS bindings in the template files. Preserve escaped `{{variables}}`, intentional raw `{{{HTML}}}` slots, every link, provider instructions and the golf plain-text alternative. The immutable original fixture and unit tests check these contracts, including repeated-build stability. The Christmas deadline is October 20, 2026; 2025 Freeman Road East is the street address. The golf promotion still has its original August 31, 2026 deadline: this CSS pass does not renew that expired offer.

Four Chromium browser cases cover 1440/768/390/320px, long values and blocked images with synthetic data. All 24 screenshots and all six pages in four PDFs were visually inspected, including full vertical panels and duplicate accounting. No mail was sent. These checks establish local browser rendering and source preservation; they do not certify Outlook, Gmail, dark mode or provider template output.

## Publication boundary

Deploying this repository does not update saved EmailJS templates. All four provider copies remain publication-pending. Before publishing, verify the current provider template IDs, recipient/reply-to settings, campaign copy (especially the expired golf offer), exact variable bindings and rendering through the intended mail clients. Retain the previous provider template for rollback. No provider copy was changed during this review.

Ten Caspio/Jotform embedded surfaces remain externally owned: digitized-designs, old-designs, announcements-create/manage, the SanMar portal/invoices/credits, and digitizing/monogram/purchasing forms. Their app wrappers are reviewed; their inner controls, styles and runtime data require provider-side review. `migration-manifest.json` keeps these owners explicit rather than crediting wrapper checks as full provider coverage.

## Primary references

- [Gmail CSS support](https://developers.google.com/workspace/gmail/design/css): unsupported properties/selectors can be ignored; browser output is not a substitute for mail-client review.
- [EmailJS dynamic variables](https://www.emailjs.com/docs/user-guide/dynamic-variables-templates/): double braces escape variable content; triple braces intentionally inject HTML.

## Provider access checked on 2026-09-13

The existing Chrome sign-in reaches the EmailJS template list and the mockup approval editor (mockup_customer_approval). Its live recipient/sender settings and HTML were inspected without applying or saving changes. The list also shows template_golf_customer and template_golf_lead. The active Christmas form uses template_v80ysfp and template_sales_xmas; neither ID was visible in this signed-in account. Verify the intended account and template mapping before creating, replacing or publishing either Christmas email.

Caspio reached its login page with no authenticated editor session. The known Jotform build link for form243095362828059 redirected to the public Monogram Form2026 instead of an editor. Neither provider was edited, and no form, upload, test email or customer message was submitted. Their editor access and mail-client review remain concrete follow-up requirements.
