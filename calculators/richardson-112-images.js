/**
 * Richardson 112 Cap Color Images
 * Images from Richardson's PicaroXPO system
 * Data includes both Solid and Split (two-tone) color options
 *
 * Each color includes a URL to Richardson's dynamic image generator
 * which shows the cap in that specific color combination
 */

const RICHARDSON_112_COLORS = [
    // ===== SOLID COLORS =====
    {
        style: '112',
        category: 'Solid',
        color: 'Amber Gold',
        url: 'https://richardson.picarioxpo.com/112_FINAL.pfs?1=1&width=1600&height=950&p.tn=ambergold.jpg,ambergoldmesh.jpg,ambergold.jpg,ambergold.jpg,ambergold.jpg,436-brown.jpg,ambergold.jpg',
        description: '112 Trucker Hat - Amber Gold'
    },
    {
        style: '112',
        category: 'Solid',
        color: 'Charcoal',
        url: 'https://richardson.picarioxpo.com/112_FINAL.pfs?1=1&width=1600&height=950&p.tn=Charcoal.jpg,Charcoal.jpg,Charcoal.jpg,Charcoal.jpg,Charcoal.jpg,Charcoal.jpg,Charcoal.jpg',
        description: '112 Trucker Hat - Charcoal'
    },
    {
        style: '112',
        category: 'Solid',
        color: 'Coffee',
        url: 'https://richardson.picarioxpo.com/112_FINAL.pfs?1=1&width=1600&height=950&p.tn=Coffee.jpg,Coffee.jpg,Coffee.jpg,Coffee.jpg,Coffee.jpg,Coffee.jpg,Coffee.jpg',
        description: '112 Trucker Hat - Coffee'
    },
    {
        style: '112',
        category: 'Solid',
        color: 'Cream',
        url: 'https://richardson.picarioxpo.com/112_FINAL.pfs?1=1&width=1600&height=950&p.tn=112cream.jpg,Birch-112FP.jpg,112cream.jpg,112cream.jpg,112cream.jpg,Birch-112FP.jpg,112cream.jpg',
        description: '112 Trucker Hat - Cream'
    },
    {
        style: '112',
        category: 'Solid',
        color: 'Light Grey',
        url: 'https://richardson.picarioxpo.com/112_FINAL.pfs?1=1&width=1600&height=950&p.tn=lightgrey.jpg,lightgreymesh.jpg,lightgrey.jpg,lightgrey.jpg,lightgrey.jpg,lightgreymesh.jpg,lightgrey.jpg',
        description: '112 Trucker Hat - Light Grey'
    },
    {
        style: '112',
        category: 'Solid',
        color: 'Black',
        url: 'https://richardson.picarioxpo.com/112_FINAL.pfs?1=1&width=1600&height=950&p.tn=Black.jpg,Black.jpg,Black.jpg,Black.jpg,Black.jpg,Black.jpg,Black.jpg',
        description: '112 Trucker Hat - Black'
    },
    {
        style: '112',
        category: 'Solid',
        color: 'Navy',
        url: 'https://richardson.picarioxpo.com/112_FINAL.pfs?1=1&width=1600&height=950&p.tn=Navy.jpg,Navy.jpg,Navy.jpg,Navy.jpg,Navy.jpg,Navy.jpg,Navy.jpg',
        description: '112 Trucker Hat - Navy'
    },
    {
        style: '112',
        category: 'Solid',
        color: 'Quarry',
        url: 'https://richardson.picarioxpo.com/112_FINAL.pfs?1=1&width=1600&height=950&p.tn=Quarry-112.jpg,Quarry-112.jpg,Quarry-112.jpg,Quarry-112.jpg,Quarry-112.jpg,258-Light-Grey.jpg,Quarry-112.jpg',
        description: '112 Trucker Hat - Quarry'
    },
    {
        style: '112',
        category: 'Solid',
        color: 'Kelly',
        url: 'https://richardson.picarioxpo.com/112_FINAL.pfs?1=1&width=1600&height=950&p.tn=kelly.jpg,kelly.jpg,kelly.jpg,kelly.jpg,kelly.jpg,kelly.jpg,kelly.jpg',
        description: '112 Trucker Hat - Kelly'
    },
    {
        style: '112',
        category: 'Solid',
        color: 'Light Blue',
        url: 'https://richardson.picarioxpo.com/112_FINAL.pfs?1=1&width=1600&height=950&p.tn=258-Light-Blue.jpg,258-Light-Blue.jpg,258-Light-Blue.jpg,258-Light-Blue.jpg,258-Light-Blue.jpg,258-Light-Blue.jpg',
        description: '112 Trucker Hat - Light Blue'
    },
    {
        style: '112',
        category: 'Solid',
        color: 'Maroon',
        url: 'https://richardson.picarioxpo.com/112_FINAL.pfs?1=1&width=1600&height=950&p.tn=maroon.jpg,maroon.jpg,maroon.jpg,maroon.jpg,maroon.jpg,maroon.jpg,maroon.jpg',
        description: '112 Trucker Hat - Maroon'
    },
    {
        style: '112',
        category: 'Solid',
        color: 'Smoke Blue',
        url: 'https://richardson.picarioxpo.com/112_FINAL.pfs?1=1&width=1600&height=950&p.tn=Smoke-Blue-110.jpg,Smoke-Blue-110.jpg,Smoke-Blue-110.jpg,Smoke-Blue-110.jpg,Smoke-Blue-110.jpg,Smoke-Blue-110.jpg,Smoke-Blue-110.jpg',
        description: '112 Trucker Hat - Smoke Blue'
    },
    {
        style: '112',
        category: 'Solid',
        color: 'White',
        url: 'https://richardson.picarioxpo.com/112_FINAL.pfs?1=1&width=1600&height=950&p.tn=White.jpg,White.jpg,White.jpg,White.jpg,White.jpg,White.jpg,White.jpg',
        description: '112 Trucker Hat - White'
    },
    {
        style: '112',
        category: 'Solid',
        color: 'Columbia Blue',
        url: 'https://richardson.picarioxpo.com/112_FINAL.pfs?1=1&width=1600&height=950&p.tn=Columbia%20Blue.jpg,Columbia%20Blue.jpg,Columbia%20Blue.jpg,Columbia%20Blue.jpg,Columbia%20Blue.jpg,Columbia%20Blue.jpg,Columbia%20Blue.jpg',
        description: '112 Trucker Hat - Columbia Blue'
    },
    {
        style: '112',
        category: 'Solid',
        color: 'Dark Green',
        url: 'https://richardson.picarioxpo.com/112_FINAL.pfs?1=1&width=1600&height=950&p.tn=Dark%20Green.jpg,Dark%20Green.jpg,Dark%20Green.jpg,Dark%20Green.jpg,Dark%20Green.jpg,Dark%20Green.jpg,Dark%20Green.jpg',
        description: '112 Trucker Hat - Dark Green'
    },
    {
        style: '112',
        category: 'Solid',
        color: 'Loden',
        url: 'https://richardson.picarioxpo.com/112_FINAL.pfs?1=1&width=1600&height=950&p.tn=Loden-115.jpg,Loden-115_mesh.jpg,Loden-115.jpg,Loden-115.jpg,Loden-115.jpg,Loden-115_mesh.jpg,Loden-115.jpg',
        description: '112 Trucker Hat - Loden'
    },
    {
        style: '112',
        category: 'Solid',
        color: 'Orange',
        url: 'https://richardson.picarioxpo.com/112_FINAL.pfs?1=1&width=1600&height=950&p.tn=Orange.jpg,Orange.jpg,Orange.jpg,Orange.jpg,Orange.jpg,Orange.jpg,Orange.jpg',
        description: '112 Trucker Hat - Orange'
    },
    {
        style: '112',
        category: 'Solid',
        color: 'Red',
        url: 'https://richardson.picarioxpo.com/112_FINAL.pfs?1=1&width=1600&height=950&p.tn=Red.jpg,Red.jpg,Red.jpg,Red.jpg,Red.jpg,Red.jpg,Red.jpg',
        description: '112 Trucker Hat - Red'
    },
    {
        style: '112',
        category: 'Solid',
        color: 'Royal',
        url: 'https://richardson.picarioxpo.com/112_FINAL.pfs?1=1&width=1600&height=950&p.tn=Royal.jpg,Royal.jpg,Royal.jpg,Royal.jpg,Royal.jpg,Royal.jpg,Royal.jpg',
        description: '112 Trucker Hat - Royal'
    },

    // ===== SPLIT (TWO-TONE) COLORS =====
    {
        style: '112',
        category: 'Split',
        color: 'Caramel/Black',
        url: 'https://richardson.picarioxpo.com/112_FINAL.pfs?1=1&width=1600&height=950&p.tn=caramel.jpg,black.jpg,caramel.jpg,caramel.jpg,caramel.jpg,black.jpg,black.jpg',
        description: '112 Trucker Hat - Caramel/Black'
    },
    {
        style: '112',
        category: 'Split',
        color: 'Navy/Caramel',
        url: 'https://richardson.picarioxpo.com/112_FINAL.pfs?1=1&width=1600&height=950&p.tn=navy.jpg,caramel.jpg,navy.jpg,navy.jpg,navy.jpg,caramel.jpg,caramel.jpg',
        description: '112 Trucker Hat - Navy/Caramel'
    },
    {
        style: '112',
        category: 'Split',
        color: 'Chocolate Chip/Birch',
        url: 'https://richardson.picarioxpo.com/112_FINAL.pfs?1=1&width=1600&height=950&p.tn=chocolate-chip.jpg,birch.jpg,chocolate-chip.jpg,chocolate-chip.jpg,chocolate-chip.jpg,birch.jpg,birch.jpg',
        description: '112 Trucker Hat - Chocolate Chip/Birch'
    },
    {
        style: '112',
        category: 'Split',
        color: 'Navy/Khaki',
        url: 'https://richardson.picarioxpo.com/112_FINAL.pfs?1=1&width=1600&height=950&p.tn=navy.jpg,Khaki-Mesh.jpg,navy.jpg,navy.jpg,navy.jpg,Khaki-Mesh.jpg,Khaki-Mesh.jpg',
        description: '112 Trucker Hat - Navy/Khaki'
    },
    {
        style: '112',
        category: 'Split',
        color: 'Black/Charcoal',
        url: 'https://richardson.picarioxpo.com/112_FINAL.pfs?1=1&width=1600&height=950&p.tn=Black.jpg,Charcoal.jpg,Black.jpg,Black.jpg,Black.jpg,Charcoal.jpg,Charcoal.jpg',
        description: '112 Trucker Hat - Black/Charcoal'
    },
    {
        style: '112',
        category: 'Split',
        color: 'Black/Gold',
        url: 'https://richardson.picarioxpo.com/112_FINAL.pfs?1=1&width=1600&height=950&p.tn=Black.jpg,Gold.jpg,Black.jpg,Black.jpg,Black.jpg,Gold.jpg,Gold.jpg',
        description: '112 Trucker Hat - Black/Gold'
    },
    {
        style: '112',
        category: 'Split',
        color: 'Brown/Khaki',
        url: 'https://richardson.picarioxpo.com/112_FINAL.pfs?1=1&width=1600&height=950&p.tn=Brown.jpg,Khaki-Mesh.jpg,Brown.jpg,Brown.jpg,Brown.jpg,Khaki.jpg,Khaki.jpg',
        description: '112 Trucker Hat - Brown/Khaki'
    },
    {
        style: '112',
        category: 'Split',
        color: 'Black/Vegas Gold',
        url: 'https://richardson.picarioxpo.com/112_FINAL.pfs?1=1&width=1600&height=950&p.tn=Black.jpg,Vegas%20Gold.jpg,Black.jpg,Black.jpg,Black.jpg,Vegas%20Gold.jpg,Vegas%20Gold.jpg',
        description: '112 Trucker Hat - Black/Vegas Gold'
    },
    {
        style: '112',
        category: 'Split',
        color: 'Black/White',
        url: 'https://richardson.picarioxpo.com/112_FINAL.pfs?1=1&width=1600&height=950&p.tn=Black.jpg,White.jpg,Black.jpg,Black.jpg,Black.jpg,White.jpg,White.jpg',
        description: '112 Trucker Hat - Black/White'
    },
    {
        style: '112',
        category: 'Split',
        color: 'Columbia Blue/White',
        url: 'https://richardson.picarioxpo.com/112_FINAL.pfs?1=1&width=1600&height=950&p.tn=Columbia%20Blue.jpg,White.jpg,Columbia%20Blue.jpg,Columbia%20Blue.jpg,Columbia%20Blue.jpg,White.jpg,White.jpg',
        description: '112 Trucker Hat - Columbia Blue/White'
    },
    {
        style: '112',
        category: 'Split',
        color: 'Charcoal/Navy',
        url: 'https://richardson.picarioxpo.com/112_FINAL.pfs?1=1&width=1600&height=950&p.tn=Charcoal.jpg,Navy.jpg,Charcoal.jpg,Charcoal.jpg,Charcoal.jpg,Navy.jpg,Navy.jpg',
        description: '112 Trucker Hat - Charcoal/Navy'
    },
    {
        style: '112',
        category: 'Split',
        color: 'Charcoal/Neon Blue',
        url: 'https://richardson.picarioxpo.com/112_FINAL.pfs?1=1&width=1600&height=950&p.tn=Charcoal.jpg,Neon%20Blue.jpg,Charcoal.jpg,Charcoal.jpg,Charcoal.jpg,Charcoal.jpg,Neon%20Blue.jpg',
        description: '112 Trucker Hat - Charcoal/Neon Blue'
    },
    {
        style: '112',
        category: 'Split',
        color: 'Charcoal/Black',
        url: 'https://richardson.picarioxpo.com/112_FINAL.pfs?1=1&width=1600&height=950&p.tn=Charcoal.jpg,Black.jpg,Charcoal.jpg,Charcoal.jpg,Charcoal.jpg,Black.jpg,Black.jpg',
        description: '112 Trucker Hat - Charcoal/Black'
    },
    {
        style: '112',
        category: 'Split',
        color: 'Charcoal/Neon Orange',
        url: 'https://richardson.picarioxpo.com/112_FINAL.pfs?1=1&width=1600&height=950&p.tn=Charcoal.jpg,Neon%20Orange.jpg,Charcoal.jpg,Charcoal.jpg,Charcoal.jpg,Charcoal.jpg,Neon%20Orange.jpg',
        description: '112 Trucker Hat - Charcoal/Neon Orange'
    },
    {
        style: '112',
        category: 'Split',
        color: 'Charcoal/Columbia Blue',
        url: 'https://richardson.picarioxpo.com/112_FINAL.pfs?1=1&width=1600&height=950&p.tn=Charcoal.jpg,Columbia%20Blue.jpg,Charcoal.jpg,Charcoal.jpg,Charcoal.jpg,Columbia%20Blue.jpg,Columbia%20Blue.jpg',
        description: '112 Trucker Hat - Charcoal/Columbia Blue'
    },
    {
        style: '112',
        category: 'Split',
        color: 'Charcoal/Neon Green',
        url: 'https://richardson.picarioxpo.com/112_FINAL.pfs?1=1&width=1600&height=950&p.tn=Charcoal.jpg,Neon%20Green.jpg,Charcoal.jpg,Charcoal.jpg,Charcoal.jpg,Charcoal.jpg,Neon%20Green.jpg',
        description: '112 Trucker Hat - Charcoal/Neon Green'
    },
    {
        style: '112',
        category: 'Split',
        color: 'Charcoal/Kelly',
        url: 'https://richardson.picarioxpo.com/112_FINAL.pfs?1=1&width=1600&height=950&p.tn=Charcoal.jpg,Kelly.jpg,Charcoal.jpg,Charcoal.jpg,Charcoal.jpg,Kelly.jpg,Kelly.jpg',
        description: '112 Trucker Hat - Charcoal/Kelly'
    },
    {
        style: '112',
        category: 'Split',
        color: 'Charcoal/Neon Yellow',
        url: 'https://richardson.picarioxpo.com/112_FINAL.pfs?1=1&width=1600&height=950&p.tn=Charcoal.jpg,Neon%20Yellow.jpg,Charcoal.jpg,Charcoal.jpg,Charcoal.jpg,Charcoal.jpg,Neon%20Yellow.jpg',
        description: '112 Trucker Hat - Charcoal/Neon Yellow'
    },
    {
        style: '112',
        category: 'Split',
        color: 'Charcoal/Neon Pink',
        url: 'https://richardson.picarioxpo.com/112_FINAL.pfs?1=1&width=1600&height=950&p.tn=Charcoal.jpg,Neon%20Pink.jpg,Charcoal.jpg,Charcoal.jpg,Charcoal.jpg,Charcoal.jpg,Neon%20Pink.jpg',
        description: '112 Trucker Hat - Charcoal/Neon Pink'
    },
    {
        style: '112',
        category: 'Split',
        color: 'Charcoal/Red',
        url: 'https://richardson.picarioxpo.com/112_FINAL.pfs?1=1&width=1600&height=950&p.tn=Charcoal.jpg,Red.jpg,Charcoal.jpg,Charcoal.jpg,Charcoal.jpg,Red.jpg,Red.jpg',
        description: '112 Trucker Hat - Charcoal/Red'
    },
    {
        style: '112',
        category: 'Split',
        color: 'Charcoal/Orange',
        url: 'https://richardson.picarioxpo.com/112_FINAL.pfs?1=1&width=1600&height=950&p.tn=Charcoal.jpg,Orange.jpg,Charcoal.jpg,Charcoal.jpg,Charcoal.jpg,Orange.jpg,Orange.jpg',
        description: '112 Trucker Hat - Charcoal/Orange'
    },
    {
        style: '112',
        category: 'Split',
        color: 'Charcoal/Royal',
        url: 'https://richardson.picarioxpo.com/112_FINAL.pfs?1=1&width=1600&height=950&p.tn=Charcoal.jpg,Royal.jpg,Charcoal.jpg,Charcoal.jpg,Charcoal.jpg,Royal.jpg,Royal.jpg',
        description: '112 Trucker Hat - Charcoal/Royal'
    },
    {
        style: '112',
        category: 'Split',
        color: 'Cyan/White',
        url: 'https://richardson.picarioxpo.com/112_FINAL.pfs?1=1&width=1600&height=950&p.tn=Cyan.jpg,White.jpg,Cyan.jpg,Cyan.jpg,Cyan.jpg,White.jpg,White.jpg',
        description: '112 Trucker Hat - Cyan/White'
    }
];

/**
 * Get all colors for a specific style, optionally filtered by category
 * @param {string} styleNumber - Style number (e.g., '112')
 * @param {string} category - Optional category filter ('Solid' or 'Split')
 * @returns {Array} Array of color objects
 */
function getRichardson112Colors(styleNumber = '112', category = null) {
    let colors = RICHARDSON_112_COLORS.filter(item => item.style === styleNumber);

    if (category) {
        colors = colors.filter(item => item.category === category);
    }

    return colors;
}

/**
 * Get image URL for a specific style and color
 * @param {string} styleNumber - Style number (e.g., '112')
 * @param {string} colorName - Color name (e.g., 'Black')
 * @returns {string|null} Image URL or null if not found
 */
function getRichardson112ColorImage(styleNumber, colorName) {
    const item = RICHARDSON_112_COLORS.find(
        item => item.style === styleNumber &&
                item.color.toLowerCase() === colorName.toLowerCase()
    );
    return item ? item.url : null;
}

// Make available globally
if (typeof window !== 'undefined') {
    window.RICHARDSON_112_COLORS = RICHARDSON_112_COLORS;
    window.getRichardson112Colors = getRichardson112Colors;
    window.getRichardson112ColorImage = getRichardson112ColorImage;
}
