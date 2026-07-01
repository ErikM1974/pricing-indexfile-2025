# "My Logos" — customer logo library for the portal (BRAINSTORM + ID REGISTRY, 2026-07-01)

> Erik's idea: give portal customers a "My Logos" section — their logos + final mockups Steve produces. Steve keeps logos as PNG/PSD; customers constantly ask "do you have my logo?" Sources = Canva + Box (Steve works out of Box). Erik asked to STORE EVERY ID for later. NOT built yet. Companion to [CASPIO_PORTAL_DESIGN.md](CASPIO_PORTAL_DESIGN.md) + the roadmap in [PORTAL_RECS_REWARDS_PROPOSAL_2026-07.md](PORTAL_RECS_REWARDS_PROPOSAL_2026-07.md) (Theme 1 "My Logos").

## 🔑 KEY DISCOVERY (verified live via the connected Canva + Box MCPs, 2026-07-01)
- **Canva API WORKS** (connector connected). Logos live in named folders; **many logo filenames are PREFIXED WITH THE SHOPWORKS CUSTOMER ID** (e.g. `27482 Czaja Construction (Black).png`, `33615 Patriot Powder Coatings`, `37870 Interstate McBee`, `39258 University of Washington School of Medicine`, `52235 Puyallup Tribal Fisheries`). ⇒ a bulk import can AUTO-LINK a logo to `id_Customer` by parsing the leading digits. Older logos are company-name-only (no ID) = the data-quality gap to handle (manual match / fuzzy name match).
- **Box API WORKS** (Erik's account). Clean per-company logo libraries already exist, plus per-customer folders named `<id_Customer> <Company>` (e.g. `30831 KM Resorts`).
- **Durability caveat:** Canva thumbnail/export URLs are **signed + EXPIRING** (`exp=` query param) — cannot be stored as permanent portal image URLs. For the portal, the durable store is **Box** (shared link → the app's existing `resolveToProxyUrl()` / image-proxy) or the app's own hosting. Use Canva as a SOURCE to pull from, Box as the store.

## MCP server IDs (this session)
- **Canva** MCP server: `8eed29f3-0265-4550-b081-fc33c0dadb5a` (tools: list-folder-items, search-folders, search-designs, get-design, get-design-thumbnail, export-design, upload-asset-from-url, create-folder, list-brand-kits…). Needs interactive OAuth (may be absent in headless/cron).
- **Box** MCP server: `720881e4-b868-4a23-bcdd-a305ec846177` (who_am_i, list_folder_content_by_folder_id, search_folders_by_name, search_files_keyword, get_file_content, upload_file, create_folder, list_item_collaborations…).
- Box account = **Erik Mickelson**, user id `3895807019`, login erik@nwcustomapparel.com (Ops Mgr; ~3.2 TB used).

## Canva folder IDs (logos + relevant)
- **"Company Logos (png's)"** = `FAFrF2yUXxs` — the MAIN logo library (hundreds of per-company PNGs, ID-prefixed on newer ones; updated 2026-06). Sample image ids: `MAFyHB0hWco` (27482 Czaja Black), `MAGqLVfxW58` (39258 UW Med), `MAFrF0V-6rk` (Abbey Carpet).
- **"2026 - Client and Event Logos"** = `FAHHhKzhyrU` (current-year client/event logos).
- "Christmas Truck Designs" = `FAFvGKQ2vCQ`. Root list also has City Caps, Embroidery Photos 2025 (`FAF0YEvEOoo`), Transfer Photos, Safety Gear, Steve_Erik_Share (`FAFZcavmufU`), etc. Use `list-folder-items(folder_id, item_types:[image,design])`; paginate via `continuation`.

## Box folder IDs (logos / art / mockups) — root of Erik's Box
- **"Client Company (Enhanced) Logos"** = `152162724639` (54 items; enhanced per-company PNGs + subfolder "NWCA (Bags)" `108072037838`).
- **"Client Company (Original) Logos"** = `109795300744`.
- **"AAA...Steve Art Box 2020"** = `73634541055` (Steve's art).
- **"Digitizing"** = `71458116748` · **"Mockups"** = `71458164515` · **"Ruth Digitizing Mockups"** = `371198763693` · **"Design Previews"** = `366607792663`.
- **"Website Art Upload"** = `52683429050` · **"Northwestembroidery.com_file_upload"** = `168628434045` (customer-supplied art intake).
- **"Canva"** (Box-side sync) = `181686526696`.
- Per-customer folders at root, named `<id_Customer> <Company>`: `29065 Phillip Misner` (`129553650917`), `29177 Watts` (`129553726658`), `30831 KM Resorts` (`129553481989`), `253gear` (`131386422675`).

## Existing app data that already links designs/mockups → customer (reuse!)
- Caspio `Digitizing_Mockups.Id_Customer` (Ruth's mockups: 6 mockup slots + logo dims/thread/stitch). `EMB_Design_Files` (per-mockup `Thread_Sequence_JSON`, `Mockup_Slot`, stitch). `ArtRequests.Shopwork_customer_number` / `id_customer`. `Design_Lookup_2026.Design_Number` (~155K; Design_Number NOT unique). Order line items carry `id_Design` per job.
- App already renders Box images safely: `resolveToProxyUrl()` + `/api/image-proxy` + [box-url-rules.md](box-url-rules.md) (NEVER `axios.head()` a Box URL). Portal already has gated `/mockup/:id` + `/art-request/:id` detail pages.

## ▶ RECOMMENDED SIMPLE NEXT STEP (the first brick)
**One Caspio table `Customer_Logos` + a dead-simple "Add customer logo" panel in Steve's art dashboard + a read-only "My Logos" section in the portal.** Steve/rep adds a logo as customers ask (customer picker + a Box shared link OR upload + logo name + notes) → it appears in that customer's portal keyed by `id_Customer`. Grows organically; NO bulk migration to start.
- `Customer_Logos` fields (all STRING, PK_ID auto): `id_Customer`, `Company_Name`, `Logo_Name`, `Image_URL` (Box durable link), `Source` (Box/Canva/upload/mockup), `Design_Number` (optional), `Notes`, `Active`, `Created`, `Created_By`.
- Portal: gated `GET /api/portal/my-logos` (session id) + a "My Logos" gallery section (reuse the card grid). Staff: add-form writes the row (Created_By from SAML).
- THEN Phase 2 (bulk): pull the Canva "Company Logos (png's)" folder, parse the ID prefix → auto-seed `Customer_Logos` for ID-named files; Box "(Enhanced) Logos" for the rest (manual/fuzzy match). THEN Phase 3: when Steve finalizes a mockup, auto-add it to My Logos.

## Broader repository idea (Erik, future)
Also wants: a document folder where a rep dumps order approvals / customer-supplied artwork; a misc repository (docs, orders, approvals, images customers send); photograph a finished product. → generalize `Customer_Logos` into a `Customer_Files` model (Type = logo/approval/artwork/photo/doc) OR keep My Logos focused and add a separate "Documents" section later. Box "Website Art Upload"/"Northwestembroidery.com_file_upload" folders are the existing intake.

## Decisions for Erik
1. Durable store = Box (recommended, app already proxies Box) vs re-host elsewhere? (Canva URLs expire — can't store directly.)
2. Start manual-add (Steve adds as asked) vs invest in the Canva ID-prefix bulk import first?
3. "My Logos" = just logos, or the broader Customer_Files (approvals/artwork/photos) from day one?
