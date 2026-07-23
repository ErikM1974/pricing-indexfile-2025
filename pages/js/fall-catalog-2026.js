/**
 * fall-catalog-2026.js — "Fall Catalog '26" new-arrivals landing page.
 *
 * A CURATED lookbook of the 170+ new SanMar Fall 2026 styles. These styles are
 * brand-new and are NOT yet in the product-search database (Sanmar_Bulk, Feb
 * 2024), so this page can't be a filtered /catalog view — the dataset below is
 * sourced directly from SanMar's Fall 2026 catalog PDF (style index, pp.117-118)
 * grouped by the catalog's own brand/page order.
 *
 * IMAGES are the deterministic SanMar CDN main image
 * (https://cdnm.sanmar.com/catalog/images/{STYLE}.jpg) — verified live for these
 * new styles; a broken image degrades to a labeled placeholder.
 *
 * PRICE RULE (Erik's iron rule — never show a wrong price): the PDF lists SanMar
 * blank-garment list prices, NOT NWCA decorated pricing, so NO price is rendered
 * here. Every card routes to Request-a-Quote with the style pre-filled, which is
 * the correct, pricing-safe call to action for not-yet-in-catalog styles.
 */
(function () {
  'use strict';

  var BRANDS = [
    { name: 'MiiR', tag: 'Our newest brand — Japanese-inspired outerwear, bags & drinkware built to last.', count: 31 },
    { name: 'The North Face', tag: 'Iron Drift quilted layers and Textured Pine Grove fleece.', count: 8 },
    { name: 'Carhartt', tag: 'Rugged Flex duck jackets, grid fleece and heavy-duty gear.', count: 10 },
    { name: 'Nike', tag: 'Dri-FIT Primary and Stride performance layers.', count: 8 },
    { name: 'Brooks Brothers', tag: 'Refined fleece jackets, vests and 1/4-snaps.', count: 4 },
    { name: 'TravisMathew', tag: 'Momentum Shift, Coto and Waffle premium layers.', count: 5 },
    { name: 'Tommy Bahama', tag: 'Coconut Bay half- and full-zips.', count: 3 },
    { name: 'OGIO', tag: 'Driveline hybrid jacket and vest.', count: 3 },
    { name: 'New Era', tag: 'Double Back hoodies and Heritage fleece.', count: 6 },
    { name: 'Flexfit', tag: '110 snapbacks, Delta and classic fitted caps.', count: 8 },
    { name: 'Mercer+Mettle', tag: 'Soft shell, Brookline quilted and buttery-soft tops.', count: 10 },
    { name: 'Port Authority', tag: 'Therma-Tek fleece, Wearever polos, Dream Plush and bags.', count: 16 },
    { name: 'Sport-Tek', tag: 'Repeat, Versa and Pro Perform performance layers & caps.', count: 19 },
    { name: 'CornerStone', tag: 'Workwear Pro, ANSI hi-vis, tough fleece and utility packs.', count: 11 },
    { name: 'District', tag: 'MelloFleece hoodies and flannel plaid pants.', count: 5 },
    { name: 'Port & Company', tag: 'Foundation fleece, Fan Favorite tees and core cotton.', count: 6 },
    { name: 'Stanley/Stella', tag: 'Sustainable Creator, Freestyler and Chaser styles.', count: 9 },
    { name: 'Bella+Canvas', tag: '10-ounce heavyweight fleece and garment-dyed tee.', count: 3 },
    { name: 'Gildan', tag: 'Heavy Blend joggers, sweatpants and 1/4-zip.', count: 3 },
    { name: 'Jerzees', tag: 'Dri-Power sport shirts and NuBlend fleece.', count: 4 },
    { name: 'Comfort Colors', tag: 'Sunwashed caps, totes and carry-all bags.', count: 7 },
  ];

  var CATS = ['Jackets', 'Vests', 'Sweatshirts & Fleece', 'Polos', 'Tees', 'Tops', 'Pants', 'Caps', 'Bags & Gear', 'Loungewear'];

  var ITEMS = [
    { s: 'MRA452', n: 'MiiR Pourigami M1 Shell', b: 'MiiR', c: 'Jackets', p: 7 },
    { s: 'MRA440', n: 'MiiR Sashiko Full-Zip Stretch Puffy', b: 'MiiR', c: 'Sweatshirts & Fleece', p: 9 },
    { s: 'MRAW440', n: 'MiiR Women\'s Sashiko Full-Zip Stretch Puffy', b: 'MiiR', c: 'Sweatshirts & Fleece', p: 9 },
    { s: 'MRA444', n: 'MiiR Sashiko Stretch Puffy Shacket', b: 'MiiR', c: 'Jackets', p: 11 },
    { s: 'MRAW445', n: 'MiiR Women\'s Sashiko Stretch Puffy Long Jacket', b: 'MiiR', c: 'Jackets', p: 11 },
    { s: 'MRA442', n: 'MiiR Sashiko Stretch Puffy Vest', b: 'MiiR', c: 'Vests', p: 13 },
    { s: 'MRAW442', n: 'MiiR Women\'s Sashiko Stretch Puffy Vest', b: 'MiiR', c: 'Vests', p: 13 },
    { s: 'MRA472', n: 'MiiR Nozawa Soft Shell Vest', b: 'MiiR', c: 'Vests', p: 15 },
    { s: 'MRA474', n: 'MiiR Nozawa Full-Zip Soft Shell', b: 'MiiR', c: 'Jackets', p: 15 },
    { s: 'MRAW473', n: 'MiiR Women\'s Nozawa Soft Shell Vest', b: 'MiiR', c: 'Vests', p: 15 },
    { s: 'MRAW474', n: 'MiiR Women\'s Nozawa Full-Zip Soft Shell', b: 'MiiR', c: 'Jackets', p: 15 },
    { s: 'MRA220', n: 'MiiR Kumo 1/4-Snap Pullover', b: 'MiiR', c: 'Sweatshirts & Fleece', p: 17 },
    { s: 'MRAW221', n: 'MiiR Women\'s Kumo 1/4-Zip Pullover', b: 'MiiR', c: 'Sweatshirts & Fleece', p: 17 },
    { s: 'MRAW222', n: 'MiiR Women\'s Kumo Full-Zip', b: 'MiiR', c: 'Sweatshirts & Fleece', p: 17 },
    { s: 'MRA230', n: 'MiiR Kivu Hybrid Full-Zip Hooded Jacket', b: 'MiiR', c: 'Jackets', p: 18 },
    { s: 'MRAW231', n: 'MiiR Women\'s Kivu Hybrid Full-Zip Jacket', b: 'MiiR', c: 'Jackets', p: 18 },
    { s: 'MRA235', n: 'MiiR Kivu 1/4-Zip', b: 'MiiR', c: 'Sweatshirts & Fleece', p: 19 },
    { s: 'MRAW235', n: 'MiiR Women\'s Kivu 1/4-Zip', b: 'MiiR', c: 'Sweatshirts & Fleece', p: 19 },
    { s: 'MRA110', n: 'MiiR Alta Polo', b: 'MiiR', c: 'Polos', p: 20 },
    { s: 'MRAW110', n: 'MiiR Women\'s Alta Polo', b: 'MiiR', c: 'Polos', p: 20 },
    { s: 'MRB1002', n: 'MiiR Kondoh Pack', b: 'MiiR', c: 'Bags & Gear', p: 22 },
    { s: 'MRB1000', n: 'MiiR Kondoh Double-Handle Pack', b: 'MiiR', c: 'Bags & Gear', p: 23 },
    { s: 'MRB1001', n: 'MiiR Kondoh Classic Pack', b: 'MiiR', c: 'Bags & Gear', p: 23 },
    { s: 'MRB1060', n: 'MiiR Causeway Crossbody', b: 'MiiR', c: 'Bags & Gear', p: 24 },
    { s: 'MRB1072', n: 'MiiR Vessel Crossbody', b: 'MiiR', c: 'Bags & Gear', p: 24 },
    { s: 'MRB1070', n: 'MiiR Causeway Tech Organizer', b: 'MiiR', c: 'Bags & Gear', p: 25 },
    { s: 'MRB1071', n: 'MiiR Causeway Travel Organizer', b: 'MiiR', c: 'Bags & Gear', p: 25 },
    { s: 'MRB1080', n: 'MiiR Kondoh Weekend Duffel', b: 'MiiR', c: 'Bags & Gear', p: 26 },
    { s: 'MRB1081', n: 'MiiR Kondoh Duffel', b: 'MiiR', c: 'Bags & Gear', p: 26 },
    { s: 'MRB1101', n: 'MiiR Kori 24-Can Vertical Pack Cooler', b: 'MiiR', c: 'Bags & Gear', p: 27 },
    { s: 'MRB1102', n: 'MiiR Kori 12-Can Vertical Cooler', b: 'MiiR', c: 'Bags & Gear', p: 27 },
    { s: 'NF0A8JEV', n: 'The North Face Iron Drift Quilted Jacket', b: 'The North Face', c: 'Jackets', p: 29 },
    { s: 'NF0A8JEZ', n: 'The North Face Women\'s Iron Drift Quilted Jacket', b: 'The North Face', c: 'Jackets', p: 29 },
    { s: 'NF0A8JEX', n: 'The North Face Iron Drift Quilted Shirt Jacket', b: 'The North Face', c: 'Jackets', p: 30 },
    { s: 'NF0A8JEW', n: 'The North Face Iron Drift Quilted Vest', b: 'The North Face', c: 'Vests', p: 31 },
    { s: 'NF0A8JEY', n: 'The North Face Women\'s Iron Drift Quilted Hooded Parka', b: 'The North Face', c: 'Jackets', p: 31 },
    { s: 'NF0A8JF0', n: 'The North Face Women\'s Iron Drift Quilted Vest', b: 'The North Face', c: 'Vests', p: 31 },
    { s: 'NF0A8JF6', n: 'The North Face Textured Pine Grove 1/2-Zip', b: 'The North Face', c: 'Sweatshirts & Fleece', p: 33 },
    { s: 'NF0A8JF7', n: 'The North Face Women\'s Textured Pine Grove 1/2-Zip', b: 'The North Face', c: 'Sweatshirts & Fleece', p: 33 },
    { s: 'CT106432', n: 'Carhartt Montana Rugged Flex Duck Jacket', b: 'Carhartt', c: 'Jackets', p: 35 },
    { s: 'CT106433', n: 'Carhartt Montana Rugged Flex Duck Vest', b: 'Carhartt', c: 'Vests', p: 35 },
    { s: 'CT106980', n: 'Carhartt Full Swing Washed Duck Active Jac', b: 'Carhartt', c: 'Jackets', p: 36 },
    { s: 'CT106378', n: 'Carhartt Midweight 1/4-Zip Sweater Fleece', b: 'Carhartt', c: 'Sweatshirts & Fleece', p: 37 },
    { s: 'CT107814', n: 'Carhartt Force 1/2-Zip Grid Fleece', b: 'Carhartt', c: 'Sweatshirts & Fleece', p: 37 },
    { s: 'CTT100617', n: 'Carhartt Tall Rain Defender Paxton Heavyweight Hooded Zip Mock Sweatshirt', b: 'Carhartt', c: 'Sweatshirts & Fleece', p: 37 },
    { s: 'CTB0000687', n: 'Carhartt 16-Inch Molded Base Heavyweight Tool Bag', b: 'Carhartt', c: 'Bags & Gear', p: 38 },
    { s: 'CTB0000688', n: 'Carhartt 10L Sling Bag', b: 'Carhartt', c: 'Bags & Gear', p: 38 },
    { s: 'CTB0000608', n: 'Carhartt 3L Travel Kit', b: 'Carhartt', c: 'Bags & Gear', p: 39 },
    { s: 'CTB0000609', n: 'Carhartt Insulated Lunch Cooler', b: 'Carhartt', c: 'Bags & Gear', p: 39 },
    { s: 'NKIO8126', n: 'Nike Dri-FIT Primary Hoodie', b: 'Nike', c: 'Sweatshirts & Fleece', p: 41 },
    { s: 'NKIO8127', n: 'Nike Dri-FIT Primary Crew', b: 'Nike', c: 'Sweatshirts & Fleece', p: 41 },
    { s: 'NKIO8128', n: 'Nike Dri-FIT Primary 1/4-Zip', b: 'Nike', c: 'Sweatshirts & Fleece', p: 41 },
    { s: 'NKIO8129', n: 'Nike Women\'s Dri-FIT Primary 1/4-Zip', b: 'Nike', c: 'Sweatshirts & Fleece', p: 41 },
    { s: 'NKIO8137', n: 'Nike Dri-FIT Stride 1/2-Zip', b: 'Nike', c: 'Sweatshirts & Fleece', p: 43 },
    { s: 'NKIO8141', n: 'Nike Women\'s Dri-FIT Stride 1/2-Zip', b: 'Nike', c: 'Sweatshirts & Fleece', p: 43 },
    { s: 'NKIO8132', n: 'Nike Women\'s Bomber Jacket', b: 'Nike', c: 'Jackets', p: 44 },
    { s: 'NKIO8125', n: 'Nike Therma-FIT Pocket 1/4-Zip', b: 'Nike', c: 'Sweatshirts & Fleece', p: 45 },
    { s: 'BB18611', n: 'Brooks Brothers Women\'s Fleece Jacket', b: 'Brooks Brothers', c: 'Jackets', p: 46 },
    { s: 'BB18612', n: 'Brooks Brothers Fleece 1/4-Snap Neck', b: 'Brooks Brothers', c: 'Sweatshirts & Fleece', p: 46 },
    { s: 'BB18614', n: 'Brooks Brothers Fleece Vest', b: 'Brooks Brothers', c: 'Vests', p: 47 },
    { s: 'BB18615', n: 'Brooks Brothers Women\'s Fleece Vest', b: 'Brooks Brothers', c: 'Vests', p: 47 },
    { s: 'TMA42219', n: 'TravisMathew Women\'s Momentum Shift 1/2-Zip', b: 'TravisMathew', c: 'Sweatshirts & Fleece', p: 49 },
    { s: 'TMA42408', n: 'TravisMathew Momentum Shift 1/4-Zip', b: 'TravisMathew', c: 'Sweatshirts & Fleece', p: 49 },
    { s: 'TMA47413', n: 'TravisMathew Bomber Jacket', b: 'TravisMathew', c: 'Jackets', p: 50 },
    { s: 'TMA42777', n: 'TravisMathew Women\'s Coto 1/2-Zip', b: 'TravisMathew', c: 'Sweatshirts & Fleece', p: 51 },
    { s: 'TMA46418', n: 'TravisMathew Waffle 1/4-Zip', b: 'TravisMathew', c: 'Sweatshirts & Fleece', p: 51 },
    { s: 'SW222374TB', n: 'Tommy Bahama Women\'s Coconut Bay Full-Zip', b: 'Tommy Bahama', c: 'Sweatshirts & Fleece', p: 52 },
    { s: 'ST228073TB', n: 'Tommy Bahama Coconut Bay 1/2-Zip', b: 'Tommy Bahama', c: 'Sweatshirts & Fleece', p: 53 },
    { s: 'SW222350TB', n: 'Tommy Bahama Women\'s Coconut Bay 1/2-Zip', b: 'Tommy Bahama', c: 'Sweatshirts & Fleece', p: 53 },
    { s: 'LOG761', n: 'OGIO Women\'s Driveline Hybrid Vest', b: 'OGIO', c: 'Vests', p: 55 },
    { s: 'OG760', n: 'OGIO Driveline Hybrid Jacket', b: 'OGIO', c: 'Jackets', p: 55 },
    { s: 'OG761', n: 'OGIO Driveline Hybrid Vest', b: 'OGIO', c: 'Vests', p: 55 },
    { s: 'LNEA566', n: 'New Era Women\'s Double Back Full-Zip Hoodie', b: 'New Era', c: 'Sweatshirts & Fleece', p: 57 },
    { s: 'NEA565', n: 'New Era Double Back Pullover Hoodie', b: 'New Era', c: 'Sweatshirts & Fleece', p: 57 },
    { s: 'NEA566', n: 'New Era Double Back Full-Zip', b: 'New Era', c: 'Sweatshirts & Fleece', p: 57 },
    { s: 'NEA567', n: 'New Era Double Back 1/4-Zip', b: 'New Era', c: 'Sweatshirts & Fleece', p: 57 },
    { s: 'LNEA528', n: 'New Era Women\'s Heritage Fleece 1/2-Zip', b: 'New Era', c: 'Sweatshirts & Fleece', p: 58 },
    { s: 'NEA528', n: 'New Era Heritage Fleece 1/2-Zip', b: 'New Era', c: 'Sweatshirts & Fleece', p: 59 },
    { s: 'FF5001', n: 'Flexfit V-Flexfit Cotton Twill Cap', b: 'Flexfit', c: 'Caps', p: 61 },
    { s: 'FF6277', n: 'Flexfit Wooly Combed Cap', b: 'Flexfit', c: 'Caps', p: 61 },
    { s: 'FF6533', n: 'Flexfit Ultrafiber Airmesh Cap', b: 'Flexfit', c: 'Caps', p: 61 },
    { s: 'FF110F', n: 'Flexfit 110 Snapback Cap', b: 'Flexfit', c: 'Caps', p: 62 },
    { s: 'FF6511', n: 'Flexfit Trucker Mesh Cap', b: 'Flexfit', c: 'Caps', p: 62 },
    { s: 'FF110M', n: 'Flexfit 110 Mesh Cap', b: 'Flexfit', c: 'Caps', p: 63 },
    { s: 'FF180', n: 'Flexfit Delta Cap', b: 'Flexfit', c: 'Caps', p: 63 },
    { s: 'FF180AP', n: 'Flexfit Delta Perforated Cap', b: 'Flexfit', c: 'Caps', p: 63 },
    { s: 'MM7104', n: 'Mercer+Mettle Comfort Soft Shell Jacket', b: 'Mercer+Mettle', c: 'Jackets', p: 64 },
    { s: 'MM7105', n: 'Mercer+Mettle Women\'s Comfort Soft Shell Jacket', b: 'Mercer+Mettle', c: 'Jackets', p: 64 },
    { s: 'MM7220', n: 'Mercer+Mettle Brookline Quilted Jacket', b: 'Mercer+Mettle', c: 'Jackets', p: 67 },
    { s: 'MM7221', n: 'Mercer+Mettle Women\'s Brookline Quilted Jacket', b: 'Mercer+Mettle', c: 'Jackets', p: 67 },
    { s: 'MM7222', n: 'Mercer+Mettle Brookline Quilted Vest', b: 'Mercer+Mettle', c: 'Vests', p: 67 },
    { s: 'MM7223', n: 'Mercer+Mettle Women\'s Brookline Quilted Vest', b: 'Mercer+Mettle', c: 'Vests', p: 67 },
    { s: 'MM2017', n: 'Mercer+Mettle Women\'s Long Sleeve Buttery Soft Blouse', b: 'Mercer+Mettle', c: 'Tops', p: 68 },
    { s: 'MM2019', n: 'Mercer+Mettle Women\'s Long Sleeve Buttery Soft Pullover Blouse', b: 'Mercer+Mettle', c: 'Tops', p: 68 },
    { s: 'MM1040', n: 'Mercer+Mettle Lite Spacer Polo', b: 'Mercer+Mettle', c: 'Polos', p: 69 },
    { s: 'MM1041', n: 'Mercer+Mettle Women\'s Short Sleeve Lite Spacer Top', b: 'Mercer+Mettle', c: 'Tops', p: 69 },
    { s: 'F180', n: 'Port Authority Therma-Tek Fleece Jacket', b: 'Port Authority', c: 'Jackets', p: 71 },
    { s: 'F181', n: 'Port Authority Therma-Tek Fleece Vest', b: 'Port Authority', c: 'Vests', p: 71 },
    { s: 'L180', n: 'Port Authority Women\'s Therma-Tek Fleece Jacket', b: 'Port Authority', c: 'Jackets', p: 71 },
    { s: 'LK821', n: 'Port Authority Women\'s Breakwater 1/4-Zip', b: 'Port Authority', c: 'Sweatshirts & Fleece', p: 72 },
    { s: 'J855', n: 'Port Authority Packable Puffy Anorak', b: 'Port Authority', c: 'Jackets', p: 73 },
    { s: 'K240LS', n: 'Port Authority Wearever Performance Pique Long Sleeve Polo', b: 'Port Authority', c: 'Polos', p: 75 },
    { s: 'K240P', n: 'Port Authority Wearever Performance Pique Pocket Polo', b: 'Port Authority', c: 'Polos', p: 75 },
    { s: 'K241', n: 'Port Authority Wearever Performance Pique 1/4-Zip', b: 'Port Authority', c: 'Polos', p: 75 },
    { s: 'LK241', n: 'Port Authority Women\'s Wearever Performance Pique 1/4-Zip', b: 'Port Authority', c: 'Polos', p: 75 },
    { s: 'Y240', n: 'Port Authority Youth Wearever Performance Pique Polo', b: 'Port Authority', c: 'Polos', p: 75 },
    { s: 'BP44', n: 'Port Authority Dream Plush Open Hoodie', b: 'Port Authority', c: 'Loungewear', p: 76 },
    { s: 'R104', n: 'Port Authority Dream Plush Robe', b: 'Port Authority', c: 'Loungewear', p: 76 },
    { s: 'BG472', n: 'Port Authority Matte Oxford Tote', b: 'Port Authority', c: 'Bags & Gear', p: 77 },
    { s: 'BG755', n: 'Port Authority Matte Oxford Hanging Travel Case', b: 'Port Authority', c: 'Bags & Gear', p: 77 },
    { s: 'BP37', n: 'Port Authority Dream Plush Blanket', b: 'Port Authority', c: 'Bags & Gear', p: 77 },
    { s: 'BP38', n: 'Port Authority Dream Plush Travel Blanket Kit', b: 'Port Authority', c: 'Bags & Gear', p: 77 },
    { s: 'JST480', n: 'Sport-Tek Repeat Jacket', b: 'Sport-Tek', c: 'Jackets', p: 79 },
    { s: 'JST481', n: 'Sport-Tek Repeat 1/2-Zip', b: 'Sport-Tek', c: 'Sweatshirts & Fleece', p: 79 },
    { s: 'LST480', n: 'Sport-Tek Women\'s Repeat Jacket', b: 'Sport-Tek', c: 'Jackets', p: 79 },
    { s: 'LST481', n: 'Sport-Tek Women\'s Repeat 1/2-Zip', b: 'Sport-Tek', c: 'Sweatshirts & Fleece', p: 79 },
    { s: 'LST491', n: 'Sport-Tek Women\'s Versa 1/4-Zip', b: 'Sport-Tek', c: 'Sweatshirts & Fleece', p: 80 },
    { s: 'ST491', n: 'Sport-Tek Versa 1/4-Zip', b: 'Sport-Tek', c: 'Sweatshirts & Fleece', p: 80 },
    { s: 'LST492', n: 'Sport-Tek Women\'s Versa Long Sleeve Pullover Hoodie', b: 'Sport-Tek', c: 'Sweatshirts & Fleece', p: 81 },
    { s: 'ST492', n: 'Sport-Tek Versa Long Sleeve Pullover Hoodie', b: 'Sport-Tek', c: 'Sweatshirts & Fleece', p: 81 },
    { s: 'ST582', n: 'Sport-Tek Pro Perform Full-Zip', b: 'Sport-Tek', c: 'Sweatshirts & Fleece', p: 82 },
    { s: 'LST581', n: 'Sport-Tek Women\'s Pro Perform 1/4-Zip', b: 'Sport-Tek', c: 'Sweatshirts & Fleece', p: 83 },
    { s: 'LST582', n: 'Sport-Tek Women\'s Pro Perform Full-Zip', b: 'Sport-Tek', c: 'Sweatshirts & Fleece', p: 83 },
    { s: 'ST580', n: 'Sport-Tek Pro Perform Pullover Hoodie', b: 'Sport-Tek', c: 'Sweatshirts & Fleece', p: 83 },
    { s: 'ST581', n: 'Sport-Tek Pro Perform 1/4-Zip', b: 'Sport-Tek', c: 'Sweatshirts & Fleece', p: 83 },
    { s: 'ST858', n: 'Sport-Tek Sport-Wick Stretch Sleeveless Hooded 1/4-Zip', b: 'Sport-Tek', c: 'Sweatshirts & Fleece', p: 84 },
    { s: 'ST859', n: 'Sport-Tek Sport-Wick Stretch Pocketed Crewneck', b: 'Sport-Tek', c: 'Sweatshirts & Fleece', p: 84 },
    { s: 'YST550', n: 'Sport-Tek Youth Competitor Polo', b: 'Sport-Tek', c: 'Polos', p: 85 },
    { s: 'YST850', n: 'Sport-Tek Youth Sport-Wick Stretch 1/4-Zip Pullover', b: 'Sport-Tek', c: 'Sweatshirts & Fleece', p: 85 },
    { s: 'STC74', n: 'Sport-Tek Stretch-Tek Snapback Trucker Cap', b: 'Sport-Tek', c: 'Caps', p: 87 },
    { s: 'STC75', n: 'Sport-Tek Stretch-Tek 5-Panel Trucker Cap', b: 'Sport-Tek', c: 'Caps', p: 87 },
    { s: 'CSF750', n: 'CornerStone Fleece Overlay Jacket', b: 'CornerStone', c: 'Jackets', p: 88 },
    { s: 'CSF751', n: 'CornerStone Fleece Overlay Vest', b: 'CornerStone', c: 'Vests', p: 88 },
    { s: 'CSF633', n: 'CornerStone Tough Fleece 1/4-Zip Hoodie', b: 'CornerStone', c: 'Sweatshirts & Fleece', p: 89 },
    { s: 'CS452', n: 'CornerStone Workwear Pro Tactical Polo', b: 'CornerStone', c: 'Polos', p: 90 },
    { s: 'CS452LS', n: 'CornerStone Workwear Pro Tactical Long Sleeve Polo', b: 'CornerStone', c: 'Polos', p: 90 },
    { s: 'CS453', n: 'CornerStone Women\'s Workwear Pro Tactical Polo', b: 'CornerStone', c: 'Polos', p: 90 },
    { s: 'CS454', n: 'CornerStone Workwear Pro Gripper Polo', b: 'CornerStone', c: 'Polos', p: 91 },
    { s: 'CS205', n: 'CornerStone ANSI 107 Class 2 Short Sleeve Mesh Blocked Tee', b: 'CornerStone', c: 'Tees', p: 92 },
    { s: 'CS207', n: 'CornerStone ANSI 107 Class 2 Long Sleeve Mesh Blocked Tee', b: 'CornerStone', c: 'Tees', p: 92 },
    { s: 'CSB215', n: 'CornerStone Utility Pro Molded Bottom Pack', b: 'CornerStone', c: 'Bags & Gear', p: 93 },
    { s: 'CSB430', n: 'CornerStone Utility Pro Tool Tote', b: 'CornerStone', c: 'Bags & Gear', p: 93 },
    { s: 'DT6700', n: 'District MelloFleece Hoodie', b: 'District', c: 'Sweatshirts & Fleece', p: 94 },
    { s: 'DT6702', n: 'District MelloFleece Full-Zip Hoodie', b: 'District', c: 'Sweatshirts & Fleece', p: 94 },
    { s: 'DT6704', n: 'District MelloFleece Crew', b: 'District', c: 'Sweatshirts & Fleece', p: 94 },
    { s: 'DT1810', n: 'District Flannel Pocket Pant', b: 'District', c: 'Pants', p: 96 },
    { s: 'DT1800', n: 'District Flannel Plaid Pant', b: 'District', c: 'Pants', p: 97 },
    { s: 'PC460', n: 'Port & Co Fan Favorite Varsity Tee', b: 'Port & Company', c: 'Tees', p: 98 },
    { s: 'PC54H', n: 'Port & Co Core Cotton Pullover Hooded Tee', b: 'Port & Company', c: 'Sweatshirts & Fleece', p: 99 },
    { s: 'PC68H', n: 'Port & Co Easy Fleece Pullover Hooded Sweatshirt', b: 'Port & Company', c: 'Sweatshirts & Fleece', p: 100 },
    { s: 'PC68YH', n: 'Port & Co Youth Easy Fleece Pullover Hooded Sweatshirt', b: 'Port & Company', c: 'Sweatshirts & Fleece', p: 100 },
    { s: 'PC107', n: 'Port & Co Foundation Fleece Pullover Crewneck Sweatshirt', b: 'Port & Company', c: 'Sweatshirts & Fleece', p: 101 },
    { s: 'PC107H', n: 'Port & Co Foundation Fleece Pullover Hooded Sweatshirt', b: 'Port & Company', c: 'Sweatshirts & Fleece', p: 101 },
    { s: 'SXU019', n: 'Stanley/Stella Unisex Freestyler Vintage Heavyweight Tee', b: 'Stanley/Stella', c: 'Tees', p: 102 },
    { s: 'SXU041', n: 'Stanley/Stella Unisex Creator 2.0 Vintage Tee', b: 'Stanley/Stella', c: 'Tees', p: 102 },
    { s: 'SXU042', n: 'Stanley/Stella Unisex Chaser Vintage Hooded Sweatshirt', b: 'Stanley/Stella', c: 'Sweatshirts & Fleece', p: 103 },
    { s: 'SXU043', n: 'Stanley/Stella Unisex Easer Vintage Crewneck Sweatshirt', b: 'Stanley/Stella', c: 'Sweatshirts & Fleece', p: 103 },
    { s: 'SXU038', n: 'Stanley/Stella Unisex Chaser Hooded Sweatshirt', b: 'Stanley/Stella', c: 'Sweatshirts & Fleece', p: 104 },
    { s: 'SXW036', n: 'Stanley/Stella Women\'s Stella Alma Crewneck Sweatshirt', b: 'Stanley/Stella', c: 'Sweatshirts & Fleece', p: 104 },
    { s: 'SXU017', n: 'Stanley/Stella Unisex Sparker 2.0 Tee', b: 'Stanley/Stella', c: 'Tees', p: 105 },
    { s: 'SXU020', n: 'Stanley/Stella Unisex Blaster 2.0 Tee', b: 'Stanley/Stella', c: 'Tees', p: 105 },
    { s: 'SXU039', n: 'Stanley/Stella Unisex Asher Tee', b: 'Stanley/Stella', c: 'Tees', p: 105 },
    { s: 'BC6110GD', n: 'BELLA+CANVAS Women\'s Heavyweight Garment-Dyed Tee', b: 'Bella+Canvas', c: 'Tees', p: 106 },
    { s: 'BC4739', n: 'BELLA+CANVAS Unisex 10-Ounce Heavyweight Full-Zip Hooded Sweatshirt', b: 'Bella+Canvas', c: 'Sweatshirts & Fleece', p: 107 },
    { s: 'BC4740', n: 'BELLA+CANVAS Unisex 10-Ounce Heavyweight 1/2-Zip Sweatshirt', b: 'Bella+Canvas', c: 'Sweatshirts & Fleece', p: 107 },
    { s: '18810', n: 'Gildan Heavy Blend 1/4-Zip Sweatshirt', b: 'Gildan', c: 'Sweatshirts & Fleece', p: 108 },
    { s: '18100', n: 'Gildan Heavy Blend Pocket Sweatpant', b: 'Gildan', c: 'Pants', p: 109 },
    { s: '18250', n: 'Gildan Heavy Blend Jogger', b: 'Gildan', c: 'Pants', p: 109 },
    { s: '437LS', n: 'Jerzees Dri-Power Sport Shirt', b: 'Jerzees', c: 'Tees', p: 110 },
    { s: '437W', n: 'Jerzees Women\'s Dri-Power Sport Shirt', b: 'Jerzees', c: 'Tees', p: 110 },
    { s: '437B', n: 'Jerzees Youth Dri-Power Sport Shirt', b: 'Jerzees', c: 'Tees', p: 111 },
    { s: '995Y', n: 'Jerzees Youth NuBlend 1/4-Zip Cadet Collar Sweatshirt', b: 'Jerzees', c: 'Sweatshirts & Fleece', p: 111 },
    { s: 'CCET0', n: 'Comfort Colors Everyday Tote', b: 'Comfort Colors', c: 'Bags & Gear', p: 112 },
    { s: 'CCNT0', n: 'Comfort Colors Nomad Carry-All Bag', b: 'Comfort Colors', c: 'Bags & Gear', p: 112 },
    { s: 'CCSB0', n: 'Comfort Colors Explorer Sling Bag', b: 'Comfort Colors', c: 'Bags & Gear', p: 112 },
    { s: 'CCRC0', n: 'Comfort Colors Rope Cap', b: 'Comfort Colors', c: 'Caps', p: 113 },
    { s: 'CCSC0', n: 'Comfort Colors Sunwashed Cap', b: 'Comfort Colors', c: 'Caps', p: 113 },
    { s: 'CCST0', n: 'Comfort Colors Sunwashed Trucker Cap', b: 'Comfort Colors', c: 'Caps', p: 113 },
    { s: 'CCWC0', n: 'Comfort Colors Coastal Washed Cap', b: 'Comfort Colors', c: 'Caps', p: 113 },
  ];

  var QUOTE_URL = '/pages/request-a-quote.html';
  var IMG_BASE = 'https://cdnm.sanmar.com/catalog/images/';

  function esc(v) {
    return String(v == null ? '' : v)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }
  function byId(id) { return document.getElementById(id); }
  function slug(s) { return String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, ''); }

  function quoteHref(item) {
    return QUOTE_URL + '?style=' + encodeURIComponent(item.s) +
           '&product=' + encodeURIComponent(item.n) +
           '&source=' + encodeURIComponent('Fall Catalog 26');
  }

  var els = {
    search: byId('fcSearch'),
    catChips: byId('fcCatChips'),
    brandNav: byId('fcBrandNav'),
    count: byId('fcCount'),
    sections: byId('fcSections'),
    empty: byId('fcEmpty'),
    clear: byId('fcClear')
  };

  var state = { cat: '', q: '' };

  /* ── Card + section markup ─────────────────────────────────────── */
  function cardHtml(item) {
    var img = IMG_BASE + item.s + '.jpg';
    var href = quoteHref(item);
    return '' +
      '<article class="fc-card" data-cat="' + esc(item.c) + '" data-style="' + esc(item.s) + '">' +
        '<a class="fc-card-media" href="' + esc(href) + '">' +
          '<img loading="lazy" src="' + esc(img) + '" alt="' + esc(item.n) + '" ' +
               'onerror="this.closest(&#39;.fc-card&#39;).classList.add(&#39;no-img&#39;)">' +
          '<span class="fc-card-fallback">' + esc(item.s) + '</span>' +
        '</a>' +
        '<div class="fc-card-body">' +
          '<span class="fc-card-brand">' + esc(item.b) + '</span>' +
          '<h3 class="fc-card-name"><a href="' + esc(href) + '">' + esc(item.n) + '</a></h3>' +
          '<div class="fc-card-foot">' +
            '<span class="fc-card-style">' + esc(item.s) + '</span>' +
            '<span class="fc-card-cat">' + esc(item.c) + '</span>' +
          '</div>' +
          '<a class="fc-card-cta" href="' + esc(href) + '">Request a quote' +
            '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5" aria-hidden="true"><polyline points="9 18 15 12 9 6"></polyline></svg>' +
          '</a>' +
        '</div>' +
      '</article>';
  }

  function matches(item) {
    if (state.cat && item.c !== state.cat) return false;
    if (state.q) {
      var hay = (item.s + ' ' + item.n + ' ' + item.b).toLowerCase();
      var terms = state.q.toLowerCase().split(/\s+/).filter(Boolean);
      for (var i = 0; i < terms.length; i++) if (hay.indexOf(terms[i]) === -1) return false;
    }
    return true;
  }

  /* ── Render ────────────────────────────────────────────────────── */
  function render() {
    var shown = 0;
    var navHtml = '';
    var sectionsHtml = '';

    for (var b = 0; b < BRANDS.length; b++) {
      var brand = BRANDS[b];
      var brandItems = [];
      for (var i = 0; i < ITEMS.length; i++) {
        if (ITEMS[i].b === brand.name && matches(ITEMS[i])) brandItems.push(ITEMS[i]);
      }
      if (!brandItems.length) continue;
      shown += brandItems.length;
      var id = 'brand-' + slug(brand.name);

      navHtml += '<a class="fc-nav-chip" href="#' + id + '">' + esc(brand.name) +
                 '<span class="fc-nav-count">' + brandItems.length + '</span></a>';

      var cards = '';
      for (var j = 0; j < brandItems.length; j++) cards += cardHtml(brandItems[j]);

      sectionsHtml += '' +
        '<section class="fc-brand" id="' + id + '">' +
          '<div class="fc-brand-head">' +
            '<h2 class="fc-brand-name">' + esc(brand.name) + '</h2>' +
            '<p class="fc-brand-tag">' + esc(brand.tag) + '</p>' +
            '<span class="fc-brand-count">' + brandItems.length + ' new</span>' +
          '</div>' +
          '<div class="fc-grid">' + cards + '</div>' +
        '</section>';
    }

    els.brandNav.innerHTML = navHtml;
    els.sections.innerHTML = sectionsHtml;

    var filtering = !!(state.cat || state.q);
    els.count.textContent = filtering
      ? (shown + ' of ' + ITEMS.length + ' styles')
      : (ITEMS.length + ' new styles');
    els.empty.hidden = shown > 0;
    els.sections.hidden = shown === 0;
    if (els.clear) els.clear.hidden = !filtering;
  }

  /* ── Category chips ────────────────────────────────────────────── */
  function buildChips() {
    var html = '<button class="fc-chip is-active" type="button" data-cat="">All' +
               '<span class="fc-chip-count">' + ITEMS.length + '</span></button>';
    for (var i = 0; i < CATS.length; i++) {
      var c = CATS[i];
      var n = 0;
      for (var k = 0; k < ITEMS.length; k++) if (ITEMS[k].c === c) n++;
      html += '<button class="fc-chip" type="button" data-cat="' + esc(c) + '">' +
              esc(c) + '<span class="fc-chip-count">' + n + '</span></button>';
    }
    els.catChips.innerHTML = html;
  }

  function setCat(cat) {
    state.cat = cat;
    var chips = els.catChips.querySelectorAll('.fc-chip');
    for (var i = 0; i < chips.length; i++) {
      chips[i].classList.toggle('is-active', (chips[i].getAttribute('data-cat') || '') === cat);
    }
    render();
  }

  /* ── Wiring ────────────────────────────────────────────────────── */
  function debounce(fn, ms) {
    var t = null;
    return function () { var a = arguments, s = this; clearTimeout(t); t = setTimeout(function () { fn.apply(s, a); }, ms); };
  }

  function init() {
    if (!els.sections) return;
    buildChips();
    render();

    els.catChips.addEventListener('click', function (e) {
      var chip = e.target.closest('.fc-chip');
      if (!chip) return;
      setCat(chip.getAttribute('data-cat') || '');
    });

    els.search.addEventListener('input', debounce(function () {
      state.q = els.search.value.trim();
      render();
    }, 160));

    if (els.clear) {
      els.clear.addEventListener('click', function () {
        state.q = ''; els.search.value = '';
        setCat('');
      });
    }

    // Smooth-scroll brand nav with sticky-offset correction
    els.brandNav.addEventListener('click', function (e) {
      var a = e.target.closest('a[href^="#"]');
      if (!a) return;
      var target = document.getElementById(a.getAttribute('href').slice(1));
      if (!target) return;
      e.preventDefault();
      var y = target.getBoundingClientRect().top + window.pageYOffset - 96;
      window.scrollTo({ top: y, behavior: 'smooth' });
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
