/**
 * dst-palette.js — Robison-Anton 40wt thread palette for the DST Studio.
 *
 * SNAPSHOT of GET /api/embroidery/palette on the inksoft-transform backend
 * (the same palette the Mockup Generator uses), taken 2026-08-04, 225 colors (1 entry with catalog=None dropped — not orderable).
 * Embedded so the Studio works with zero backend dependencies; refresh by
 * re-running the curl in the file history if the RA catalog ever changes.
 * Catalog numbers are REAL RA numbers — never hand-edit hex/catalog pairs.
 */
(function (root, factory) {
    if (typeof module === 'object' && module.exports) { module.exports = factory(); }
    else { root.DSTPalette = factory(); }
}(typeof self !== 'undefined' ? self : this, function () {
    'use strict';

    var COLORS = [
    { catalog: "2341", name: "Ash", hex: "#3A4972", family: "Blue" },
    { catalog: "2206", name: "Baby Blue", hex: "#99BADD", family: "Blue" },
    { catalog: "2541", name: "Black Chrome", hex: "#4B5B6E", family: "Blue" },
    { catalog: "2435", name: "Blue Horizon", hex: "#6689CC", family: "Blue" },
    { catalog: "2438", name: "Blue Suede", hex: "#0C2340", family: "Blue" },
    { catalog: "2526", name: "Bright Blue", hex: "#6689CC", family: "Blue" },
    { catalog: "2523", name: "China Blue", hex: "#002D72", family: "Blue" },
    { catalog: "2404", name: "Cinder", hex: "#8C92AC", family: "Blue" },
    { catalog: "2245", name: "Copen", hex: "#418FDE", family: "Blue" },
    { catalog: "2444", name: "Dark Teal", hex: "#005F7F", family: "Blue" },
    { catalog: "6944", name: "Dark Teal", hex: "#005F7F", family: "Blue" },
    { catalog: "2529", name: "Dolphin Blue", hex: "#3A75C4", family: "Blue" },
    { catalog: "2437", name: "Empire Blue", hex: "#3F2893", family: "Blue" },
    { catalog: "2300", name: "Ice Blue", hex: "#ABCAE9", family: "Blue" },
    { catalog: "2302", name: "Imperial Blue", hex: "#1D4F91", family: "Blue" },
    { catalog: "2384", name: "Jay Blue", hex: "#8D92C8", family: "Blue" },
    { catalog: "2304", name: "Lake Blue", hex: "#71C5E8", family: "Blue" },
    { catalog: "6804", name: "Lake Blue", hex: "#71C5E8", family: "Blue" },
    { catalog: "2386", name: "Light Midnight", hex: "#555C72", family: "Blue" },
    { catalog: "2287", name: "Mauve", hex: "#7474C1", family: "Blue" },
    { catalog: "2520", name: "Mid Windsor", hex: "#00A3DD", family: "Blue" },
    { catalog: "2387", name: "Midnight Navy", hex: "#0C2340", family: "Blue" },
    { catalog: "2388", name: "Pacific Blue", hex: "#0072B5", family: "Blue" },
    { catalog: "2619", name: "Pro Brilliance", hex: "#0051BA", family: "Blue" },
    { catalog: "2736", name: "Pro brite star", hex: "#2B1166", family: "Blue" },
    { catalog: "2625", name: "Pro Navy", hex: "#192168", family: "Blue" },
    { catalog: "2647", name: "Pro-College Blue", hex: "#002649", family: "Blue" },
    { catalog: "2536", name: "Rockport Blue", hex: "#9BAABF", family: "Blue" },
    { catalog: "2210", name: "Royal", hex: "#003DA5", family: "Blue" },
    { catalog: "2485", name: "Saturn Gray", hex: "#3E4B51", family: "Blue" },
    { catalog: "2275", name: "Slate Blue", hex: "#6D87A8", family: "Blue" },
    { catalog: "2487", name: "Smoky", hex: "#353842", family: "Blue" },
    { catalog: "6769", name: "Sun Blue", hex: "#AFBCDB", family: "Blue" },
    { catalog: "2427", name: "Violet Blue", hex: "#332875", family: "Blue" },
    { catalog: "2303", name: "White-Navy", hex: "#003B5C", family: "Blue" },
    { catalog: "2577", name: "Wonder Blue", hex: "#4FA5C7", family: "Blue" },
    { catalog: "2479", name: "Almond", hex: "#865C2B", family: "Brown" },
    { catalog: "2227", name: "Chocolate", hex: "#765B50", family: "Brown" },
    { catalog: "2372", name: "Dark Brown", hex: "#4E3524", family: "Brown" },
    { catalog: "2290", name: "Date", hex: "#754719", family: "Brown" },
    { catalog: "2337", name: "Espresso", hex: "#473729", family: "Brown" },
    { catalog: "6837", name: "Espresso", hex: "#473729", family: "Brown" },
    { catalog: "2478", name: "Light Coco", hex: "#755426", family: "Brown" },
    { catalog: "2477", name: "Sand Dune", hex: "#6B4714", family: "Brown" },
    { catalog: "2585", name: "Banner Gray", hex: "#919693", family: "Gray" },
    { catalog: "2296", name: "Black", hex: "#2D2926", family: "Gray" },
    { catalog: "2265", name: "Charcoal", hex: "#3D3935", family: "Gray" },
    { catalog: "2565", name: "H Charcoal", hex: "#54585A", family: "Gray" },
    { catalog: "2407", name: "Metal", hex: "#505759", family: "Gray" },
    { catalog: "2340", name: "Pearl Grey", hex: "#DBD3D3", family: "Gray" },
    { catalog: "2592", name: "Silver Steel", hex: "#ADAFAA", family: "Gray" },
    { catalog: "2484", name: "Silvery Gray", hex: "#8C8984", family: "Gray" },
    { catalog: "2274", name: "Steel Grey", hex: "#B0B7BC", family: "Gray" },
    { catalog: "2486", name: "Strom Gray", hex: "#B2A8B5", family: "Gray" },
    { catalog: "2217", name: "Twilight", hex: "#686663", family: "Gray" },
    { catalog: "2221", name: "Willow", hex: "#88928B", family: "Gray" },
    { catalog: "2220", name: "Blue", hex: "#78D64B", family: "Green" },
    { catalog: "2208", name: "Dark Green", hex: "#007B4C", family: "Green" },
    { catalog: "2284", name: "Deep Green", hex: "#046A38", family: "Green" },
    { catalog: "2214", name: "Emerald", hex: "#00AF3F", family: "Green" },
    { catalog: "2320", name: "Erin Green", hex: "#80C342", family: "Green" },
    { catalog: "2315", name: "Evergreen", hex: "#024930", family: "Green" },
    { catalog: "2282", name: "Flite Green", hex: "#C6D6A0", family: "Green" },
    { catalog: "6782", name: "Flite Green", hex: "#C6D6A0", family: "Green" },
    { catalog: "2319", name: "Green Oak", hex: "#B5CC8E", family: "Green" },
    { catalog: "6819", name: "Green Oak", hex: "#B5CC8E", family: "Green" },
    { catalog: "2458", name: "Green Petal", hex: "#024930", family: "Green" },
    { catalog: "2392", name: "Harbor Green", hex: "#4F6D5E", family: "Green" },
    { catalog: "6892", name: "Harbor Green", hex: "#4F6D5E", family: "Green" },
    { catalog: "2312", name: "Isle Green", hex: "#70CE9B", family: "Green" },
    { catalog: "6812", name: "Isle Green", hex: "#70CE9B", family: "Green" },
    { catalog: "2226", name: "Meadow", hex: "#2D8C2E", family: "Green" },
    { catalog: "2322", name: "Ming", hex: "#80C342", family: "Green" },
    { catalog: "2238", name: "Mint", hex: "#B5E8BF", family: "Green" },
    { catalog: "6738", name: "Mint", hex: "#B5E8BF", family: "Green" },
    { catalog: "2211", name: "Nile", hex: "#60C659", family: "Green" },
    { catalog: "6711", name: "Nile", hex: "#60C659", family: "Green" },
    { catalog: "2202", name: "Olive", hex: "#7B9971", family: "Green" },
    { catalog: "2317", name: "Olive Drab", hex: "#9CAA8B", family: "Green" },
    { catalog: "2241", name: "Palm Leaf", hex: "#A7BCA3", family: "Green" },
    { catalog: "6741", name: "Palm Leaf", hex: "#A7BCA3", family: "Green" },
    { catalog: "2595", name: "Sage", hex: "#547730", family: "Green" },
    { catalog: "2311", name: "Seafoam", hex: "#70CE9B", family: "Green" },
    { catalog: "6811", name: "Seafoam", hex: "#70CE9B", family: "Green" },
    { catalog: "2551", name: "Spring Garden", hex: "#5C7E73", family: "Green" },
    { catalog: "2279", name: "Spruce", hex: "#74AA50", family: "Green" },
    { catalog: "2607", name: "TH Green", hex: "#1C6653", family: "Green" },
    { catalog: "2594", name: "Wintergreen", hex: "#007732", family: "Green" },
    { catalog: "2224", name: "Beige", hex: "#AA753F", family: "Orange" },
    { catalog: "2377", name: "Bisque", hex: "#F2C4AF", family: "Orange" },
    { catalog: "2582", name: "Bone", hex: "#FFF0DC", family: "Orange" },
    { catalog: "2488", name: "Cocoa Mulch", hex: "#B28260", family: "Orange" },
    { catalog: "2376", name: "Dark Maroon", hex: "#C5AFA0", family: "Orange" },
    { catalog: "6876", name: "Dark Maroon", hex: "#C5AFA0", family: "Orange" },
    { catalog: "2232", name: "Ecru", hex: "#EDD3BC", family: "Orange" },
    { catalog: "2413", name: "Flesh", hex: "#BA8B5E", family: "Orange" },
    { catalog: "6913", name: "Flesh", hex: "#BA8B5E", family: "Orange" },
    { catalog: "2234", name: "Glow", hex: "#FFC658", family: "Orange" },
    { catalog: "6734", name: "Glow", hex: "#FFC658", family: "Orange" },
    { catalog: "6703", name: "Gold", hex: "#F7D5B0", family: "Orange" },
    { catalog: "2570", name: "Golden Tan", hex: "#B9975B", family: "Orange" },
    { catalog: "2272", name: "Grape", hex: "#A5856E", family: "Orange" },
    { catalog: "2572", name: "Grayrod", hex: "#B7AFA3", family: "Orange" },
    { catalog: "2325", name: "Lemon", hex: "#FF8200", family: "Orange" },
    { catalog: "6825", name: "Lemon", hex: "#FF8200", family: "Orange" },
    { catalog: "2493", name: "Light Bronze", hex: "#C18E60", family: "Orange" },
    { catalog: "2203", name: "Light Navy", hex: "#F7D5B0", family: "Orange" },
    { catalog: "2399", name: "New Gold", hex: "#BB8B47", family: "Orange" },
    { catalog: "2218", name: "Orange", hex: "#FF6900", family: "Orange" },
    { catalog: "2236", name: "Paprika", hex: "#F95602", family: "Orange" },
    { catalog: "2573", name: "Pewter", hex: "#998E80", family: "Orange" },
    { catalog: "2739", name: "Pro-Gray", hex: "#99897C", family: "Orange" },
    { catalog: "2289", name: "Rust", hex: "#BE5400", family: "Orange" },
    { catalog: "2273", name: "Tan", hex: "#C5B9A6", family: "Orange" },
    { catalog: "2231", name: "Toast", hex: "#BA7530", family: "Orange" },
    { catalog: "2213", name: "Yellow", hex: "#FCA311", family: "Orange" },
    { catalog: "2228", name: "Begonia", hex: "#EF5B83", family: "Pink" },
    { catalog: "6728", name: "Begonia", hex: "#EF5B83", family: "Pink" },
    { catalog: "2237", name: "Carnation", hex: "#F99FC9", family: "Pink" },
    { catalog: "2405", name: "Dover Gray", hex: "#DBB4CC", family: "Pink" },
    { catalog: "2422", name: "Ducky Mauve", hex: "#8E6877", family: "Pink" },
    { catalog: "6922", name: "Ducky Mauve", hex: "#8E6877", family: "Pink" },
    { catalog: "6737", name: "Empire Blue", hex: "#F99FC9", family: "Pink" },
    { catalog: "2271", name: "Heather", hex: "#CEBFC6", family: "Pink" },
    { catalog: "2260", name: "Hot Pink", hex: "#CE0058", family: "Pink" },
    { catalog: "2276", name: "Lavender", hex: "#E5CEDB", family: "Pink" },
    { catalog: "6776", name: "Lavender", hex: "#E5CEDB", family: "Pink" },
    { catalog: "2588", name: "Mid Lilac", hex: "#E29ED6", family: "Pink" },
    { catalog: "2291", name: "Passion", hex: "#93328E", family: "Pink" },
    { catalog: "2223", name: "Pink", hex: "#F5A2C4", family: "Pink" },
    { catalog: "6723", name: "Pink", hex: "#F5A2C4", family: "Pink" },
    { catalog: "2292", name: "Plum", hex: "#9E2387", family: "Pink" },
    { catalog: "6792", name: "Plum", hex: "#9E2387", family: "Pink" },
    { catalog: "2490", name: "Plum Wine", hex: "#642F6C", family: "Pink" },
    { catalog: "2261", name: "Ruby Glint", hex: "#DA1984", family: "Pink" },
    { catalog: "6761", name: "Ruby Glint", hex: "#DA1984", family: "Pink" },
    { catalog: "2252", name: "Russet", hex: "#6F2C3F", family: "Pink" },
    { catalog: "2285", name: "Violet", hex: "#C964CF", family: "Pink" },
    { catalog: "6785", name: "Violet", hex: "#C964CF", family: "Pink" },
    { catalog: "2259", name: "Wild Pink", hex: "#E04E84", family: "Pink" },
    { catalog: "6759", name: "Wild Pink", hex: "#E04E84", family: "Pink" },
    { catalog: "6788", name: "Bisque", hex: "#9E70AE", family: "Purple" },
    { catalog: "2381", name: "Dark Purple", hex: "#512A72", family: "Purple" },
    { catalog: "2288", name: "Iris", hex: "#9E70AE", family: "Purple" },
    { catalog: "2254", name: "Purple", hex: "#5D2E8C", family: "Purple" },
    { catalog: "2406", name: "Sterling", hex: "#A893AD", family: "Purple" },
    { catalog: "2286", name: "Tulip", hex: "#8F5FBA", family: "Purple" },
    { catalog: "2251", name: "Brown", hex: "#3E2B2E", family: "Red" },
    { catalog: "2249", name: "Burgundy", hex: "#AF272F", family: "Red" },
    { catalog: "2268", name: "Carolina Red", hex: "#862633", family: "Red" },
    { catalog: "6762", name: "Cherry Blossom", hex: "#C8102E", family: "Red" },
    { catalog: "2339", name: "Coffee Bean", hex: "#5B2D28", family: "Red" },
    { catalog: "2270", name: "Cranberry", hex: "#99233C", family: "Red" },
    { catalog: "2205", name: "Dark Rust", hex: "#FF585D", family: "Red" },
    { catalog: "2375", name: "Dusty Rose", hex: "#FCBFC9", family: "Red" },
    { catalog: "6875", name: "Dusty Rose", hex: "#FCBFC9", family: "Red" },
    { catalog: "2263", name: "Foxy Red", hex: "#CE1126", family: "Red" },
    { catalog: "2207", name: "Grey", hex: "#DDC6C4", family: "Red" },
    { catalog: "2281", name: "Jocky Red", hex: "#BF0A30", family: "Red" },
    { catalog: "2294", name: "Melon", hex: "#FF8E6F", family: "Red" },
    { catalog: "6794", name: "Melon", hex: "#FF8E6F", family: "Red" },
    { catalog: "2255", name: "Opal Mist", hex: "#FF7956", family: "Red" },
    { catalog: "2277", name: "Persimmon", hex: "#F4364C", family: "Red" },
    { catalog: "6777", name: "Persimmon", hex: "#F4364C", family: "Red" },
    { catalog: "2266", name: "Radiant Red", hex: "#C41E3A", family: "Red" },
    { catalog: "6766", name: "Radiant Red", hex: "#C41E3A", family: "Red" },
    { catalog: "2293", name: "Rose", hex: "#FC9BB2", family: "Red" },
    { catalog: "2329", name: "Saffron", hex: "#F93F26", family: "Red" },
    { catalog: "6829", name: "Saffron", hex: "#F93F26", family: "Red" },
    { catalog: "2219", name: "Scarlet", hex: "#BA0C2F", family: "Red" },
    { catalog: "2420", name: "Tuxedo Red", hex: "#EF3340", family: "Red" },
    { catalog: "2267", name: "Wildfire", hex: "#A32638", family: "Red" },
    { catalog: "6767", name: "Wildfire", hex: "#A32638", family: "Red" },
    { catalog: "2225", name: "Wine", hex: "#7C2230", family: "Red" },
    { catalog: "2307", name: "Aquamarine", hex: "#009CA6", family: "Teal" },
    { catalog: "6807", name: "Aquamarine", hex: "#009CA6", family: "Teal" },
    { catalog: "2549", name: "Blue Spruce", hex: "#005E5D", family: "Teal" },
    { catalog: "6889", name: "California Blue", hex: "#00A0C4", family: "Teal" },
    { catalog: "2389", name: "California Blue", hex: "#00A0C4", family: "Teal" },
    { catalog: "2449", name: "Fern Green", hex: "#006663", family: "Teal" },
    { catalog: "6949", name: "Fern Green", hex: "#006663", family: "Teal" },
    { catalog: "2459", name: "Green Sail", hex: "#193833", family: "Teal" },
    { catalog: "2518", name: "Indian Ocean Blue", hex: "#2DC6D6", family: "Teal" },
    { catalog: "2552", name: "Ivy", hex: "#13322B", family: "Teal" },
    { catalog: "2521", name: "Mallard Blue", hex: "#006D75", family: "Teal" },
    { catalog: "2445", name: "MD Green", hex: "#007272", family: "Teal" },
    { catalog: "2310", name: "Mint Julep", hex: "#93DDDB", family: "Teal" },
    { catalog: "2446", name: "oceanicgreen", hex: "#006D75", family: "Teal" },
    { catalog: "2390", name: "Peppermint", hex: "#00B388", family: "Teal" },
    { catalog: "2306", name: "Periwinkle", hex: "#00A3AD", family: "Teal" },
    { catalog: "6806", name: "Periwinkle", hex: "#00A3AD", family: "Teal" },
    { catalog: "2391", name: "Pine Green", hex: "#008C82", family: "Teal" },
    { catalog: "2615", name: "Pro Hunter", hex: "#006D66", family: "Teal" },
    { catalog: "2621", name: "Pro Teal", hex: "#006B77", family: "Teal" },
    { catalog: "2313", name: "Sprite", hex: "#B2D8D8", family: "Teal" },
    { catalog: "2309", name: "Teal", hex: "#609191", family: "Teal" },
    { catalog: "2204", name: "Turquoise", hex: "#00C1D5", family: "Teal" },
    { catalog: "6704", name: "Turquoise", hex: "#00C1D5", family: "Teal" },
    { catalog: "2343", name: "Eggshell", hex: "#FFFFEB", family: "White" },
    { catalog: "2342", name: "Natural white", hex: "#FFFFEB", family: "White" },
    { catalog: "2403", name: "Oyster", hex: "#FFFFF5", family: "White" },
    { catalog: "2297", name: "White", hex: "#FAFAFF", family: "White" },
    { catalog: "2558", name: "Buttercup", hex: "#FFC61E", family: "Yellow" },
    { catalog: "2235", name: "Canary", hex: "#FEDD00", family: "Yellow" },
    { catalog: "2316", name: "Celery", hex: "#F2EABC", family: "Yellow" },
    { catalog: "6816", name: "Celery", hex: "#F2EABC", family: "Yellow" },
    { catalog: "2539", name: "Chrome", hex: "#D1CCBF", family: "Yellow" },
    { catalog: "2544", name: "Desert Cactus", hex: "#897719", family: "Yellow" },
    { catalog: "2569", name: "Earthen Tan", hex: "#7A5B11", family: "Yellow" },
    { catalog: "2242", name: "Goldenrod", hex: "#FFC72C", family: "Yellow" },
    { catalog: "2264", name: "Maize", hex: "#F7E8AA", family: "Yellow" },
    { catalog: "2216", name: "Marigold", hex: "#FFD460", family: "Yellow" },
    { catalog: "2278", name: "Moss", hex: "#899064", family: "Yellow" },
    { catalog: "2331", name: "Mustard", hex: "#D0A82A", family: "Yellow" },
    { catalog: "2250", name: "Newport", hex: "#C8B575", family: "Yellow" },
    { catalog: "2201", name: "Old Gold", hex: "#DAAB00", family: "Yellow" },
    { catalog: "2456", name: "Peapod", hex: "#A3AF07", family: "Yellow" },
    { catalog: "2332", name: "Penny", hex: "#F1BE48", family: "Yellow" },
    { catalog: "2568", name: "Perfect Tan", hex: "#C1A875", family: "Yellow" },
    { catalog: "6750", name: "Pistachio", hex: "#C8B575", family: "Yellow" },
    { catalog: "2474", name: "Rattan", hex: "#C1A875", family: "Yellow" },
    { catalog: "2476", name: "Seashell", hex: "#D6CCAF", family: "Yellow" },
    { catalog: "2212", name: "Sungold", hex: "#AC8E2E", family: "Yellow" },
    { catalog: "2298", name: "Taupe", hex: "#D1BF91", family: "Yellow" },
    { catalog: "2400", name: "Topaz", hex: "#BF910C", family: "Yellow" },
    ];

    var FAMILIES = ["Blue","Brown","Gray","Green","Orange","Pink","Purple","Red","Teal","White","Yellow"];

    /* Vivid, well-separated defaults for auto-assigning runs before the
       operator picks real threads. Every number below is verified to exist
       in the snapshot above — never add one without checking. */
    var DEFAULT_CATALOGS = [
        '2296', // Black
        '2266', // Radiant Red
        '2245', // Copen (blue)
        '2242', // Goldenrod
        '2214', // Emerald
        '2254', // Purple
        '2260', // Hot Pink
        '2307', // Aquamarine
        '2372', // Dark Brown
        '2565', // H Charcoal
        '2302', // Imperial Blue
        '2320'  // Erin Green
    ];

    function byCatalog(catalog) {
        for (var i = 0; i < COLORS.length; i++) {
            if (COLORS[i].catalog === catalog) return COLORS[i];
        }
        return null;
    }

    /* Nearest palette entry to an arbitrary hex (simple RGB distance). */
    function nearest(hex) {
        var m = /^#?([0-9a-f]{6})$/i.exec(String(hex || ''));
        if (!m) return null;
        var v = parseInt(m[1], 16);
        var r = (v >> 16) & 255, g = (v >> 8) & 255, b = v & 255;
        var best = null, bestD = Infinity;
        for (var i = 0; i < COLORS.length; i++) {
            var w = parseInt(COLORS[i].hex.slice(1), 16);
            var dr = r - ((w >> 16) & 255), dg = g - ((w >> 8) & 255), db = b - (w & 255);
            var d = dr * dr + dg * dg + db * db;
            if (d < bestD) { bestD = d; best = COLORS[i]; }
        }
        return best;
    }

    return { COLORS: COLORS, FAMILIES: FAMILIES, DEFAULT_CATALOGS: DEFAULT_CATALOGS, byCatalog: byCatalog, nearest: nearest };
}));
