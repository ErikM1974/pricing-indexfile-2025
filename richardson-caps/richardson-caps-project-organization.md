# Richardson Caps Project Organization

## Files to Keep

1. **Final Output Files**
   - `richardson-caps-catalog-updated.md` - The comprehensive catalog with all cap colors including the combination colors
   - `richardson-combination-caps.md` - Specific catalog for just the combination caps
   - `richardson-combination-caps.json` - JSON data for the combination caps
   - `view-combination-caps.html` - Interactive viewer for the combination caps

2. **Core Scripts**
   - `richardson-combination-caps-manual.js` - The script that generates the combination cap URLs

## Files to Delete

1. **Temporary/Development Files**
   - `richardson-combination-fullsize-scraper.js` - Failed attempt at scraping
   - `verify-combination-urls.html` - Temporary verification file
   - `richardson-catalog-verification.md` - Verification document
   - `combination-colors-plan.md` - Planning document
   - `richardson-cap-images-full.csv` - Intermediate data file
   - `richardson-fullsize-cap-images.json` - Intermediate data file

2. **Superseded Files**
   - `richardson-caps-catalog.md` - Replaced by the updated version
   - `richardson-scraper.js` - Initial scraper
   - `richardson-fullsize-scraper.js` - Intermediate scraper
   - `richardson-combination-scraper.js` - Intermediate scraper
   - `richardson-fullsize-url-generator.js` - Intermediate URL generator
   - `download-richardson-caps.html` - Test file

## Recommended File Structure

```
richardson-caps/
├── data/
│   └── richardson-combination-caps.json
├── docs/
│   ├── richardson-caps-catalog-updated.md
│   └── richardson-combination-caps.md
├── scripts/
│   └── richardson-combination-caps-manual.js
└── view-combination-caps.html
```

## Implementation Steps

1. Create the directory structure:
   ```
   mkdir -p richardson-caps/data
   mkdir -p richardson-caps/docs
   mkdir -p richardson-caps/scripts
   ```

2. Move the files to keep to their appropriate locations:
   ```
   copy richardson-caps-catalog-updated.md richardson-caps/docs/
   copy richardson-combination-caps.md richardson-caps/docs/
   copy richardson-combination-caps.json richardson-caps/data/
   copy richardson-combination-caps-manual.js richardson-caps/scripts/
   ```

3. Delete the temporary and superseded files after confirming the moved files are intact.

## Benefits of This Organization

1. **Clear Separation of Concerns**
   - `data/` - Contains raw data files
   - `docs/` - Contains documentation and catalogs
   - `scripts/` - Contains code for generating the data

2. **Reduced Clutter**
   - Removes temporary and development files
   - Keeps only the essential files needed for future reference or use

3. **Easier Maintenance**
   - Organized structure makes it easier to find and update files
   - Clear naming conventions make the purpose of each file obvious