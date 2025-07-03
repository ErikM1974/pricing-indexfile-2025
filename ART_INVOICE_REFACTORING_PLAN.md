# Art Invoice System Refactoring Plan v3.0 (Safe & Practical)

**To:** Junior Developer
**From:** The Senior Dev Puzzled by the Plumbing
**Date:** 2025-07-03

**Goal**: Safely clean up the Art Invoice system to make it more organized and easier to maintain, without introducing complex patterns or breaking existing functionality.

---

### Part 1: The New Strategy - Low-Risk, High-Impact Changes

The previous plan was too ambitious. It introduced modern but complex concepts (ES6 modules, state management) that are unnecessary for this project and would require a development server and build tools we aren't using.

**This new plan is much safer and more practical.** We will focus on simple file organization and eliminating code duplication. We will **not** remove `onclick` attributes or change the core way the JavaScript works. This ensures that the application remains stable and easy to test at every step.

**What We Are Removing from the Old Plan:**
*   ❌ All `import`/`export` syntax (ES6 Modules)
*   ❌ State management systems
*   ❌ Render loops and component-based architecture
*   ❌ Removing `onclick` attributes from HTML

**What We Are Focusing On:**
*   ✅ Simple file separation (CSS and JS)
*   ✅ Creating a shared file for duplicated functions
*   ✅ Keeping global functions accessible for `onclick` handlers
*   ✅ Extracting configuration to make pricing changes easier

---

### Part 2: The Cleanup Plan

#### Phase 1: CSS Extraction (Zero Risk)

**Goal:** Get all CSS out of `<style>` tags and into a single, shared stylesheet.

1.  **Create Shared CSS File:**
    *   Create a new folder named `css`.
    *   Inside `css`, create a file named `art-invoice-shared.css`.
2.  **Move and Consolidate CSS:**
    *   Copy all CSS rules from the `<style>` tag in `art-invoice-view.html` and paste them into `art-invoice-shared.css`.
    *   Copy all CSS rules from the `<style>` tag in `calculators/art-invoice-creator.html`.
    *   Paste them into `art-invoice-shared.css`, carefully **removing any duplicated rules**. Pay special attention to the large, duplicated `@media print` section.
3.  **Link the Stylesheet:**
    *   In both HTML files, remove the entire `<style>` tag.
    *   In the `<head>` section of `art-invoice-view.html`, add this line:
        `<link rel="stylesheet" href="css/art-invoice-shared.css">`
    *   In the `<head>` section of `calculators/art-invoice-creator.html`, add this line:
        `<link rel="stylesheet" href="../css/art-invoice-shared.css">`
4.  **Testing:**
    *   Open both `art-invoice-view.html` and `art-invoice-creator.html` in your browser.
    *   **Verify:** They should look exactly the same as before. Check the print preview on both pages to ensure the print styles are working correctly.

#### Phase 2: Shared JavaScript Functions (Low Risk)

**Goal:** Create a single file for all duplicated JavaScript helper functions.

1.  **Create Shared Utilities File:**
    *   Create a new folder named `js`.
    *   Inside `js`, create a file named `art-invoice-utils.js`.
2.  **Move Duplicated Functions:**
    *   Identify functions that exist in both `art-invoice-view.html` and `art-invoice-creator.html`. These include:
        *   `hasArtwork`
        *   The entire "Modal Gallery System" (`showArtworkModal`, `createArtworkModal`, `closeArtworkModal`, etc.)
        *   `formatDate`
        *   `getSalesRepName` and related helpers
    *   Copy **one version** of each of these duplicated functions into `js/art-invoice-utils.js`.
3.  **Make Functions Global (Safely):**
    *   We cannot use `import`/`export`. Instead, we will ensure these functions are available globally by default. The browser does this automatically when you load a script with a `<script>` tag.
4.  **Link the Script and Clean Up:**
    *   In both HTML files, add this script tag **before** the main script block:
        `<script src="../js/art-invoice-utils.js"></script>`
    *   Now, in both HTML files, **delete** the duplicated functions you just moved from their main `<script>` blocks.
5.  **Testing:**
    *   Open both pages.
    *   **Verify:** The artwork gallery modal must open and work correctly on both pages. Dates and sales rep names must display correctly.

#### Phase 3: Main JavaScript File Separation (Medium Risk)

**Goal:** Move the main JavaScript logic for each page into its own file.

1.  **Create Page-Specific JS Files:**
    *   In the `js` folder, create `art-invoice-view.js`.
    *   In the `js` folder, create `art-invoice-creator.js`.
2.  **Move the JavaScript:**
    *   Cut all remaining JavaScript from inside the `<script>` tag of `art-invoice-view.html` and paste it into `js/art-invoice-view.js`.
    *   Repeat the process for `art-invoice-creator.html` and `js/art-invoice-creator.js`.
3.  **Link the New Scripts:**
    *   In `art-invoice-view.html`, replace the now-empty `<script>` tag with:
        `<script src="js/art-invoice-view.js"></script>`
    *   In `calculators/art-invoice-creator.html`, do the same:
        `<script src="../js/art-invoice-creator.js"></script>`
    *   **Crucially, ensure the script tags are in the correct order in the HTML:**
        1.  `art-invoice-config.js` (from Phase 4)
        2.  `art-invoice-service-v2.js`
        3.  `art-invoice-utils.js`
        4.  `art-invoice-creator.js` (or `view.js`)
4.  **Testing:**
    *   This is the highest-risk phase. Test all functionality thoroughly.
    *   **Creator Page:** Can you search for and select a request? Does the form populate? Does the live preview update? Can you submit the form?
    *   **View Page:** Does the invoice load? Do the Print and Email buttons work?

#### Phase 4: Configuration File (Low Risk)

**Goal:** Extract business-critical values from the `art-invoice-service-v2.js` file to make them easy to update.

1.  **Create Config File:**
    *   In the `js` folder, create `art-invoice-config.js`.
2.  **Move Business Constants:**
    *   In `art-invoice-config.js`, create a global configuration object:
    ```javascript
    var AppConfig = {
        hourlyRate: 75.00,
        rushMultiplier: 1.25,
        serviceCodes: {
            'GRT-25': { name: 'Quick Review', amount: 25.00 },
            'GRT-50': { name: 'Logo Mockup', amount: 50.00 }
            // The full list of service code objects
        }
    };
    ```
    *   Cut the `hourlyRate`, `rushMultiplier`, and the entire `this.serviceCodes` object from `art-invoice-service-v2.js` and paste them into the `AppConfig` object.
3.  **Update the Service:**
    *   In `art-invoice-service-v2.js`, replace all references to `this.hourlyRate` with `AppConfig.hourlyRate`, and `this.serviceCodes` with `AppConfig.serviceCodes`.
4.  **Link The Config Script:**
    *   In both HTML files, add the config script as the **very first** script tag:
        `<script src="../js/art-invoice-config.js"></script>`
5.  **Testing:**
    *   Open the invoice creator.
    *   **Verify:** Select a service from the dropdown. Does it populate with the correct price from `AppConfig`? Do calculations still work correctly?

By following this revised, more cautious plan, we can achieve our goal of a cleaner, more organized codebase without the risk of breaking our working application.