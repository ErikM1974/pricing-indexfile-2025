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
        url: 'https://c3eku948.caspio.com/dp/a0e150004df4984fb1ef4d30b01a/files/9148418',
        description: '112 Trucker Hat - Amber Gold'
    },
    {
        style: '112',
        category: 'Solid',
        color: 'Charcoal',
        url: 'https://c3eku948.caspio.com/dp/a0e150004df4984fb1ef4d30b01a/files/9148432',
        description: '112 Trucker Hat - Charcoal'
    },
    {
        style: '112',
        category: 'Solid',
        color: 'Coffee',
        url: 'https://c3eku948.caspio.com/dp/a0e150004df4984fb1ef4d30b01a/files/9148419',
        description: '112 Trucker Hat - Coffee'
    },
    {
        style: '112',
        category: 'Solid',
        color: 'Cream',
        url: 'https://c3eku948.caspio.com/dp/a0e150004df4984fb1ef4d30b01a/files/9148437',
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
        url: 'https://c3eku948.caspio.com/dp/a0e150004df4984fb1ef4d30b01a/files/9148415',
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
        url: 'https://c3eku948.caspio.com/dp/a0e150004df4984fb1ef4d30b01a/files/9148406',
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
        url: 'https://c3eku948.caspio.com/dp/a0e150004df4984fb1ef4d30b01a/files/9148402',
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
        url: 'https://c3eku948.caspio.com/dp/a0e150004df4984fb1ef4d30b01a/files/9148408',
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
    },

    // ===== ADDITIONAL SPLIT COLORS =====
    {
        style: '112',
        category: 'Split',
        color: 'Cardinal/White',
        url: 'https://richardson.picarioxpo.com/112_FINAL.pfs?1=1&width=1600&height=950&p.tn=Cardinal.jpg,White.jpg,Cardinal.jpg,Cardinal.jpg,Cardinal.jpg,White.jpg,White.jpg',
        description: '112 Trucker Hat - Cardinal/White'
    },
    {
        style: '112',
        category: 'Split',
        color: 'Charcoal/White',
        url: 'https://richardson.picarioxpo.com/112_FINAL.pfs?1=1&width=1600&height=950&p.tn=Charcoal.jpg,White.jpg,Charcoal.jpg,Charcoal.jpg,Charcoal.jpg,White.jpg,White.jpg',
        description: '112 Trucker Hat - Charcoal/White'
    },
    {
        style: '112',
        category: 'Split',
        color: 'Royal/White',
        url: 'https://richardson.picarioxpo.com/112_FINAL.pfs?1=1&width=1600&height=950&p.tn=Royal.jpg,White.jpg,Royal.jpg,Royal.jpg,Royal.jpg,White.jpg,White.jpg',
        description: '112 Trucker Hat - Royal/White'
    },
    {
        style: '112',
        category: 'Split',
        color: 'Dark Green/White',
        url: 'https://richardson.picarioxpo.com/112_FINAL.pfs?1=1&width=1600&height=950&p.tn=Dark%20Green.jpg,White.jpg,Dark%20Green.jpg,Dark%20Green.jpg,Dark%20Green.jpg,White.jpg,White.jpg',
        description: '112 Trucker Hat - Dark Green/White'
    },
    {
        style: '112',
        category: 'Split',
        color: 'Heather Grey/Black',
        url: 'https://richardson.picarioxpo.com/112_FINAL.pfs?1=1&width=1600&height=950&p.tn=112-Heather-Grey.jpg,Black.jpg,112-Heather-Grey.jpg,112-Heather-Grey.jpg,112-Heather-Grey.jpg,Black.jpg,Black.jpg',
        description: '112 Trucker Hat - Heather Grey/Black'
    },
    {
        style: '112',
        category: 'Split',
        color: 'Red/White',
        url: 'https://richardson.picarioxpo.com/112_FINAL.pfs?1=1&width=1600&height=950&p.tn=Red.jpg,White.jpg,Red.jpg,Red.jpg,Red.jpg,White.jpg,White.jpg',
        description: '112 Trucker Hat - Red/White'
    },
    {
        style: '112',
        category: 'Split',
        color: 'Maroon/White',
        url: 'https://richardson.picarioxpo.com/112_FINAL.pfs?1=1&width=1600&height=950&p.tn=Maroon.jpg,White.jpg,Maroon.jpg,Maroon.jpg,Maroon.jpg,White.jpg,White.jpg',
        description: '112 Trucker Hat - Maroon/White'
    },
    {
        style: '112',
        category: 'Split',
        color: 'Navy/Orange',
        url: 'https://richardson.picarioxpo.com/112_FINAL.pfs?1=1&width=1600&height=950&p.tn=Navy.jpg,Orange.jpg,Navy.jpg,Navy.jpg,Navy.jpg,Orange.jpg,Orange.jpg',
        description: '112 Trucker Hat - Navy/Orange'
    },
    {
        style: '112',
        category: 'Split',
        color: 'Red/Black',
        url: 'https://richardson.picarioxpo.com/112_FINAL.pfs?1=1&width=1600&height=950&p.tn=Red.jpg,Black.jpg,Red.jpg,Red.jpg,Red.jpg,Black.jpg,Black.jpg',
        description: '112 Trucker Hat - Red/Black'
    },
    {
        style: '112',
        category: 'Split',
        color: 'Royal/Black',
        url: 'https://richardson.picarioxpo.com/112_FINAL.pfs?1=1&width=1600&height=950&p.tn=Royal.jpg,Black.jpg,Royal.jpg,Royal.jpg,Royal.jpg,Black.jpg,Black.jpg',
        description: '112 Trucker Hat - Royal/Black'
    },
    {
        style: '112',
        category: 'Split',
        color: 'Purple/White',
        url: 'https://richardson.picarioxpo.com/112_FINAL.pfs?1=1&width=1600&height=950&p.tn=Purple.jpg,White.jpg,Purple.jpg,Purple.jpg,Purple.jpg,White.jpg,White.jpg',
        description: '112 Trucker Hat - Purple/White'
    },
    {
        style: '112',
        category: 'Split',
        color: 'Orange/White',
        url: 'https://richardson.picarioxpo.com/112_FINAL.pfs?1=1&width=1600&height=950&p.tn=Orange.jpg,White.jpg,Orange.jpg,Orange.jpg,Orange.jpg,White.jpg,White.jpg',
        description: '112 Trucker Hat - Orange/White'
    },
    {
        style: '112',
        category: 'Split',
        color: 'Orange/Black',
        url: 'https://richardson.picarioxpo.com/112_FINAL.pfs?1=1&width=1600&height=950&p.tn=Orange.jpg,Black.jpg,Orange.jpg,Orange.jpg,Orange.jpg,Black.jpg,Black.jpg',
        description: '112 Trucker Hat - Orange/Black'
    },
    {
        style: '112',
        category: 'Split',
        color: 'Navy/White',
        url: 'https://richardson.picarioxpo.com/112_FINAL.pfs?1=1&width=1600&height=950&p.tn=Navy.jpg,White.jpg,Navy.jpg,Navy.jpg,Navy.jpg,White.jpg,White.jpg',
        description: '112 Trucker Hat - Navy/White'
    },
    {
        style: '112',
        category: 'Split',
        color: 'Loden/Black',
        url: 'https://richardson.picarioxpo.com/112_FINAL.pfs?1=1&width=1600&height=950&p.tn=Loden-115.jpg,Black.jpg,Loden-115.jpg,Loden-115.jpg,Loden-115.jpg,Black.jpg,Black.jpg',
        description: '112 Trucker Hat - Loden/Black'
    },
    {
        style: '112',
        category: 'Split',
        color: 'Khaki/White',
        url: 'https://richardson.picarioxpo.com/112_FINAL.pfs?1=1&width=1600&height=950&p.tn=%20Khaki-112.jpg,White.jpg,%20Khaki-112.jpg,%20Khaki-112.jpg,%20Khaki-112.jpg,White.jpg,White.jpg',
        description: '112 Trucker Hat - Khaki/White'
    },
    {
        style: '112',
        category: 'Split',
        color: 'Kelly/White',
        url: 'https://richardson.picarioxpo.com/112_FINAL.pfs?1=1&width=1600&height=950&p.tn=Kelly.jpg,White.jpg,Kelly.jpg,Kelly.jpg,Kelly.jpg,White.jpg,White.jpg',
        description: '112 Trucker Hat - Kelly/White'
    },
    {
        style: '112',
        category: 'Split',
        color: 'Khaki/Coffee',
        url: 'https://richardson.picarioxpo.com/112_FINAL.pfs?1=1&width=1600&height=950&p.tn=%20Khaki-112.jpg,Coffee.jpg,%20Khaki-112.jpg,%20Khaki-112.jpg,%20Khaki-112.jpg,Coffee.jpg,Coffee.jpg',
        description: '112 Trucker Hat - Khaki/Coffee'
    },
    {
        style: '112',
        category: 'Split',
        color: 'Hot Pink/White',
        url: 'https://richardson.picarioxpo.com/112_FINAL.pfs?1=1&width=1600&height=950&p.tn=Hot%20Pink.jpg,White.jpg,Hot%20Pink.jpg,Hot%20Pink.jpg,Hot%20Pink.jpg,White.jpg,White.jpg',
        description: '112 Trucker Hat - Hot Pink/White'
    },
    {
        style: '112',
        category: 'Split',
        color: 'Heather Grey/Dark Green',
        url: 'https://richardson.picarioxpo.com/112_FINAL.pfs?1=1&width=1600&height=950&p.tn=112-Heather-Grey.jpg,Dark%20Green.jpg,112-Heather-Grey.jpg,112-Heather-Grey.jpg,112-Heather-Grey.jpg,Dark%20Green.jpg,Dark%20Green.jpg',
        description: '112 Trucker Hat - Heather Grey/Dark Green'
    },
    {
        style: '112',
        category: 'Split',
        color: 'Heather Grey/Navy',
        url: 'https://richardson.picarioxpo.com/112_FINAL.pfs?1=1&width=1600&height=950&p.tn=112-Heather-Grey.jpg,Navy.jpg,112-Heather-Grey.jpg,112-Heather-Grey.jpg,112-Heather-Grey.jpg,Navy.jpg,Navy.jpg',
        description: '112 Trucker Hat - Heather Grey/Navy'
    },
    {
        style: '112',
        category: 'Split',
        color: 'Heather Grey/Royal',
        url: 'https://richardson.picarioxpo.com/112_FINAL.pfs?1=1&width=1600&height=950&p.tn=112-Heather-Grey.jpg,Royal.jpg,112-Heather-Grey.jpg,112-Heather-Grey.jpg,112-Heather-Grey.jpg,Royal.jpg,Royal.jpg',
        description: '112 Trucker Hat - Heather Grey/Royal'
    },
    {
        style: '112',
        category: 'Split',
        color: 'Heather Grey/White',
        url: 'https://richardson.picarioxpo.com/112_FINAL.pfs?1=1&width=1600&height=950&p.tn=112-Heather-Grey.jpg,White.jpg,112-Heather-Grey.jpg,112-Heather-Grey.jpg,112-Heather-Grey.jpg,White.jpg,White.jpg',
        description: '112 Trucker Hat - Heather Grey/White'
    },
    {
        style: '112',
        category: 'Split',
        color: 'Hot Pink/Black',
        url: 'https://richardson.picarioxpo.com/112_FINAL.pfs?1=1&width=1600&height=950&p.tn=Hot%20Pink.jpg,Black.jpg,Hot%20Pink.jpg,Hot%20Pink.jpg,Hot%20Pink.jpg,Black.jpg,Black.jpg',
        description: '112 Trucker Hat - Hot Pink/Black'
    },
    {
        style: '112',
        category: 'Split',
        color: 'Cardinal/Black',
        url: 'https://richardson.picarioxpo.com/112_FINAL.pfs?1=1&width=1600&height=950&p.tn=Cardinal.jpg,Black.jpg,Cardinal.jpg,Cardinal.jpg,Cardinal.jpg,Black.jpg,Black.jpg',
        description: '112 Trucker Hat - Cardinal/Black'
    },
    {
        style: '112',
        category: 'Split',
        color: 'Navy/Charcoal',
        url: 'https://richardson.picarioxpo.com/112_FINAL.pfs?1=1&width=1600&height=950&p.tn=Navy.jpg,Charcoal.jpg,Navy.jpg,Navy.jpg,Navy.jpg,Charcoal.jpg,Charcoal.jpg',
        description: '112 Trucker Hat - Navy/Charcoal'
    },
    {
        style: '112',
        category: 'Split',
        color: 'Biscuit/True Blue',
        url: 'https://richardson.picarioxpo.com/112_FINAL.pfs?1=1&width=1600&height=950&p.tn=Biscuit.jpg,Blue-Ribon.jpg,Biscuit.jpg,Biscuit.jpg,Biscuit.jpg,Blue-Ribon.jpg,Blue-Ribon.jpg',
        description: '112 Trucker Hat - Biscuit/True Blue'
    },
    {
        style: '112',
        category: 'Split',
        color: 'Black/Yellow',
        url: 'https://richardson.picarioxpo.com/112_FINAL.pfs?1=1&width=1600&height=950&p.tn=Black.jpg,Yellow.jpg,Black.jpg,Black.jpg,Black.jpg,Yellow.jpg,Yellow.jpg',
        description: '112 Trucker Hat - Black/Yellow'
    },
    {
        style: '112',
        category: 'Split',
        color: 'Heather Grey/Light Grey',
        url: 'https://richardson.picarioxpo.com/112_FINAL.pfs?1=1&width=1600&height=950&p.tn=112-Heather-Grey.jpg,Light-Grey.jpg,112-Heather-Grey.jpg,112-Heather-Grey.jpg,112-Heather-Grey.jpg,Light-Grey.jpg,Light-Grey.jpg',
        description: '112 Trucker Hat - Heather Grey/Light Grey'
    },

    // ===== TRI-COLOR (THREE-TONE) COLORS =====
    {
        style: '112',
        category: 'Tri-Color',
        color: 'Mink Beige/Charcoal/Amber Gold',
        url: 'https://richardson.picarioxpo.com/112_FINAL.pfs?1=1&width=1600&height=950&p.tn=Mink-Beige.jpg,Charcoal.jpg,Amber-Gold.jpg,Amber-Gold.jpg,Mink-Beige.jpg,Charcoal.jpg,Charcoal.jpg',
        description: '112 Trucker Hat - Mink Beige/Charcoal/Amber Gold'
    },
    {
        style: '112',
        category: 'Tri-Color',
        color: 'Blue Teal/Birch/Navy',
        url: 'https://richardson.picarioxpo.com/112_FINAL.pfs?1=1&width=1600&height=950&p.tn=Blue%20Teal.jpg,Birch.jpg,Navy.jpg,Navy.jpg,Blue%20Teal.jpg,Birch.jpg,Birch.jpg',
        description: '112 Trucker Hat - Blue Teal/Birch/Navy'
    },
    {
        style: '112',
        category: 'Tri-Color',
        color: 'White/Columbia Blue/Yellow',
        url: 'https://richardson.picarioxpo.com/112_FINAL.pfs?1=1&width=1600&height=950&p.tn=White.jpg,Columbia%20Blue.jpg,Yellow_220.jpg,Yellow_220.jpg,White.jpg,Birch.jpg,Columbia%20Blue.jpg',
        description: '112 Trucker Hat - White/Columbia Blue/Yellow'
    },
    {
        style: '112',
        category: 'Tri-Color',
        color: 'Heather Grey/Red/Black',
        url: 'https://richardson.picarioxpo.com/112_FINAL.pfs?1=1&width=1600&height=950&p.tn=112-Heather-Grey.jpg,Red.jpg,Black.jpg,black.jpg,112-Heather-Grey.jpg,Red.jpg,Red.jpg',
        description: '112 Trucker Hat - Heather Grey/Red/Black'
    },
    {
        style: '112',
        category: 'Tri-Color',
        color: 'Heather Grey/Birch/Army Olive',
        url: 'https://richardson.picarioxpo.com/112_FINAL.pfs?1=1&width=1600&height=950&p.tn=112-Heather-Grey.jpg,Birch.jpg,Army-Olive.jpg,Army-Olive.jpg,112-Heather-Grey.jpg,birch.jpg,birch.jpg',
        description: '112 Trucker Hat - Heather Grey/Birch/Army Olive'
    },
    {
        style: '112',
        category: 'Tri-Color',
        color: 'Cream/Navy/Amber Gold',
        url: 'https://richardson.picarioxpo.com/112_FINAL.pfs?1=1&width=1600&height=950&p.tn=112cream.jpg,Navy.jpg,AmberGold.jpg,AmberGold.jpg,112cream.jpg,Navy.jpg',
        description: '112 Trucker Hat - Cream/Navy/Amber Gold'
    },
    {
        style: '112',
        category: 'Tri-Color',
        color: 'Cream/Grey Brown/Brown',
        url: 'https://richardson.picarioxpo.com/112_FINAL.pfs?1=1&width=1600&height=950&p.tn=112cream.jpg,Grey-Brown.jpg,brown.jpg,brown.jpg,112cream.jpg,Brown.jpg',
        description: '112 Trucker Hat - Cream/Grey Brown/Brown'
    },
    {
        style: '112',
        category: 'Tri-Color',
        color: 'Heather Grey/Birch/Amber Gold',
        url: 'https://richardson.picarioxpo.com/112_FINAL.pfs?1=1&width=1600&height=950&p.tn=112-Heather-Grey.jpg,Birch.jpg,Amber-Gold.jpg,Amber-Gold.jpg,112-Heather-Grey.jpg,Birch.jpg,Birch.jpg',
        description: '112 Trucker Hat - Heather Grey/Birch/Amber Gold'
    },
    {
        style: '112',
        category: 'Tri-Color',
        color: 'Cream/Black/Loden',
        url: 'https://richardson.picarioxpo.com/112_FINAL.pfs?1=1&width=1600&height=950&p.tn=112cream.jpg,Black.jpg,Loden-115.jpg,Loden-115.jpg,112cream.jpg,Black.jpg,Black.jpg',
        description: '112 Trucker Hat - Cream/Black/Loden'
    },
    {
        style: '112',
        category: 'Tri-Color',
        color: 'Black/White/Red',
        url: 'https://richardson.picarioxpo.com/112_FINAL.pfs?1=1&width=1600&height=950&p.tn=Black.jpg,White.jpg,Red.jpg,Red.jpg,Black.jpg,White.jpg,White.jpg',
        description: '112 Trucker Hat - Black/White/Red'
    },
    {
        style: '112',
        category: 'Tri-Color',
        color: 'Columbia Blue/White/Navy',
        url: 'https://richardson.picarioxpo.com/112_FINAL.pfs?1=1&width=1600&height=950&p.tn=Columbia%20Blue.jpg,White.jpg,Navy.jpg,Navy.jpg,Columbia%20Blue.jpg,White.jpg,White.jpg',
        description: '112 Trucker Hat - Columbia Blue/White/Navy'
    },
    {
        style: '112',
        category: 'Tri-Color',
        color: 'Royal/White/Red',
        url: 'https://richardson.picarioxpo.com/112_FINAL.pfs?1=1&width=1600&height=950&p.tn=Royal.jpg,White.jpg,Red.jpg,Red.jpg,Royal.jpg,White.jpg,White.jpg',
        description: '112 Trucker Hat - Royal/White/Red'
    },
    {
        style: '112',
        category: 'Tri-Color',
        color: 'Red/White/Navy',
        url: 'https://richardson.picarioxpo.com/112_FINAL.pfs?1=1&width=1600&height=950&p.tn=Red.jpg,White.jpg,Navy.jpg,Navy.jpg,Red.jpg,White.jpg,White.jpg',
        description: '112 Trucker Hat - Red/White/Navy'
    },
    {
        style: '112',
        category: 'Tri-Color',
        color: 'Grey/Charcoal/Black',
        url: 'https://richardson.picarioxpo.com/112_FINAL.pfs?1=1&width=1600&height=950&p.tn=Light-Grey.jpg,Charcoal.jpg,Black.jpg,Black.jpg,Light-Grey.jpg,Charcoal.jpg,Charcoal.jpg',
        description: '112 Trucker Hat - Grey/Charcoal/Black'
    },
    {
        style: '112',
        category: 'Tri-Color',
        color: 'Red/White/Black',
        url: 'https://richardson.picarioxpo.com/112_FINAL.pfs?1=1&width=1600&height=950&p.tn=Red.jpg,White.jpg,Black.jpg,Black.jpg,Red.jpg,White.jpg,White.jpg',
        description: '112 Trucker Hat - Red/White/Black'
    },
    {
        style: '112',
        category: 'Tri-Color',
        color: 'Orange/White/Black',
        url: 'https://richardson.picarioxpo.com/112_FINAL.pfs?1=1&width=1600&height=950&p.tn=Orange.jpg,White.jpg,Black.jpg,Black.jpg,Orange.jpg,White.jpg,White.jpg',
        description: '112 Trucker Hat - Orange/White/Black'
    },
    {
        style: '112',
        category: 'Tri-Color',
        color: 'Navy/White/Red',
        url: 'https://richardson.picarioxpo.com/112_FINAL.pfs?1=1&width=1600&height=950&p.tn=Navy.jpg,White.jpg,Red.jpg,Red.jpg,Navy.jpg,White.jpg,White.jpg',
        description: '112 Trucker Hat - Navy/White/Red'
    },
    {
        style: '112',
        category: 'Tri-Color',
        color: 'Black/White/Heather Grey',
        url: 'https://richardson.picarioxpo.com/112_FINAL.pfs?1=1&width=1600&height=950&p.tn=Black.jpg,White.jpg,112-Heather-Grey.jpg,112-Heather-Grey.jpg,Black.jpg,White.jpg,White.jpg',
        description: '112 Trucker Hat - Black/White/Heather Grey'
    },
    {
        style: '112',
        category: 'Tri-Color',
        color: 'Navy/White/Heather Grey',
        url: 'https://richardson.picarioxpo.com/112_FINAL.pfs?1=1&width=1600&height=950&p.tn=Navy.jpg,White.jpg,112-Heather-Grey.jpg,112-Heather-Grey.jpg,Navy.jpg,White.jpg,White.jpg',
        description: '112 Trucker Hat - Navy/White/Heather Grey'
    },
    {
        style: '112',
        category: 'Tri-Color',
        color: 'Red/White/Heather Grey',
        url: 'https://richardson.picarioxpo.com/112_FINAL.pfs?1=1&width=1600&height=950&p.tn=Red.jpg,White.jpg,112-Heather-Grey.jpg,112-Heather-Grey.jpg,Red.jpg,White.jpg,White.jpg',
        description: '112 Trucker Hat - Red/White/Heather Grey'
    },
    {
        style: '112',
        category: 'Tri-Color',
        color: 'Royal/White/Heather Grey',
        url: 'https://richardson.picarioxpo.com/112_FINAL.pfs?1=1&width=1600&height=950&p.tn=Royal.jpg,White.jpg,112-Heather-Grey.jpg,112-Heather-Grey.jpg,Royal.jpg,White.jpg,White.jpg',
        description: '112 Trucker Hat - Royal/White/Heather Grey'
    },
    {
        style: '112',
        category: 'Tri-Color',
        color: 'Grey/Charcoal/Navy',
        url: 'https://richardson.picarioxpo.com/112_FINAL.pfs?1=1&width=1600&height=950&p.tn=Light-Grey.jpg,Charcoal.jpg,Navy.jpg,Navy.jpg,Light-Grey.jpg,Charcoal.jpg,Charcoal.jpg',
        description: '112 Trucker Hat - Grey/Charcoal/Navy'
    },
    {
        style: '112',
        category: 'Tri-Color',
        color: 'Heather Grey/Cardinal/Navy',
        url: 'https://richardson.picarioxpo.com/112_FINAL.pfs?1=1&width=1600&height=950&p.tn=112-Heather-Grey.jpg,Cardinal.jpg,Navy.jpg,Navy.jpg,112-Heather-Grey.jpg,Cardinal.jpg,Cardinal.jpg',
        description: '112 Trucker Hat - Heather Grey/Cardinal/Navy'
    },
    {
        style: '112',
        category: 'Tri-Color',
        color: 'Heather Grey/Charcoal/Dark Orange',
        url: 'https://richardson.picarioxpo.com/112_FINAL.pfs?1=1&width=1600&height=950&p.tn=112-Heather-Grey.jpg,Charcoal.jpg,Dark%20Orange.jpg,Dark%20Orange.jpg,112-Heather-Grey.jpg,Charcoal.jpg,Charcoal.jpg',
        description: '112 Trucker Hat - Heather Grey/Charcoal/Dark Orange'
    },
    {
        style: '112',
        category: 'Tri-Color',
        color: 'Heather Grey/Charcoal/Maroon',
        url: 'https://richardson.picarioxpo.com/112_FINAL.pfs?1=1&width=1600&height=950&p.tn=112-Heather-Grey.jpg,Charcoal.jpg,Maroon.jpg,Maroon.jpg,112-Heather-Grey.jpg,Charcoal.jpg,Charcoal.jpg',
        description: '112 Trucker Hat - Heather Grey/Charcoal/Maroon'
    },

    // ===== COMBINATION COLORS (VISOR VARIATIONS) =====
    {
        style: '112',
        category: 'Combination',
        color: 'Black/Black/White',
        url: 'https://richardson.picarioxpo.com/112_FINAL.pfs?1=1&width=1600&height=950&p.tn=Black.jpg,Black.jpg,White.jpg,White.jpg,Black.jpg,Black.jpg,Black.jpg',
        description: '112 Trucker Hat - Black/Black/White'
    },
    {
        style: '112',
        category: 'Combination',
        color: 'Black/Black/Grey',
        url: 'https://richardson.picarioxpo.com/112_FINAL.pfs?1=1&width=1600&height=950&p.tn=Black.jpg,Black.jpg,Light-Grey.jpg,Light-Grey.jpg,Black.jpg,Black.jpg,Black.jpg',
        description: '112 Trucker Hat - Black/Black/Grey'
    },
    {
        style: '112',
        category: 'Combination',
        color: 'Black/Black/Red',
        url: 'https://richardson.picarioxpo.com/112_FINAL.pfs?1=1&width=1600&height=950&p.tn=Black.jpg,Black.jpg,Red.jpg,Red.jpg,Black.jpg,Black.jpg,Black.jpg',
        description: '112 Trucker Hat - Black/Black/Red'
    },
    {
        style: '112',
        category: 'Combination',
        color: 'Black/Black/Royal',
        url: 'https://richardson.picarioxpo.com/112_FINAL.pfs?1=1&width=1600&height=950&p.tn=Black.jpg,Black.jpg,Royal.jpg,Royal.jpg,Black.jpg,Black.jpg,Black.jpg',
        description: '112 Trucker Hat - Black/Black/Royal'
    },
    {
        style: '112',
        category: 'Combination',
        color: 'Black/Black/Orange',
        url: 'https://richardson.picarioxpo.com/112_FINAL.pfs?1=1&width=1600&height=950&p.tn=Black.jpg,Black.jpg,Orange.jpg,Orange.jpg,Black.jpg,Black.jpg,Black.jpg',
        description: '112 Trucker Hat - Black/Black/Orange'
    },
    {
        style: '112',
        category: 'Combination',
        color: 'Black/Black/Navy',
        url: 'https://richardson.picarioxpo.com/112_FINAL.pfs?1=1&width=1600&height=950&p.tn=Black.jpg,Black.jpg,Navy.jpg,Navy.jpg,Black.jpg,Black.jpg,Black.jpg',
        description: '112 Trucker Hat - Black/Black/Navy'
    },
    {
        style: '112',
        category: 'Combination',
        color: 'Navy/Navy/White',
        url: 'https://richardson.picarioxpo.com/112_FINAL.pfs?1=1&width=1600&height=950&p.tn=Navy.jpg,Navy.jpg,White.jpg,White.jpg,Navy.jpg,Navy.jpg,Navy.jpg',
        description: '112 Trucker Hat - Navy/Navy/White'
    },
    {
        style: '112',
        category: 'Combination',
        color: 'Navy/Navy/Grey',
        url: 'https://richardson.picarioxpo.com/112_FINAL.pfs?1=1&width=1600&height=950&p.tn=Navy.jpg,Navy.jpg,Light-Grey.jpg,Light-Grey.jpg,Navy.jpg,Navy.jpg,Navy.jpg',
        description: '112 Trucker Hat - Navy/Navy/Grey'
    },
    {
        style: '112',
        category: 'Combination',
        color: 'Navy/Navy/Orange',
        url: 'https://richardson.picarioxpo.com/112_FINAL.pfs?1=1&width=1600&height=950&p.tn=Navy.jpg,Navy.jpg,Orange.jpg,Orange.jpg,Navy.jpg,Navy.jpg,Navy.jpg',
        description: '112 Trucker Hat - Navy/Navy/Orange'
    },
    {
        style: '112',
        category: 'Combination',
        color: 'Charcoal/Charcoal/White',
        url: 'https://richardson.picarioxpo.com/112_FINAL.pfs?1=1&width=1600&height=950&p.tn=Charcoal.jpg,Charcoal.jpg,White.jpg,White.jpg,Charcoal.jpg,Charcoal.jpg,Charcoal.jpg',
        description: '112 Trucker Hat - Charcoal/Charcoal/White'
    },
    {
        style: '112',
        category: 'Combination',
        color: 'Charcoal/Charcoal/Black',
        url: 'https://richardson.picarioxpo.com/112_FINAL.pfs?1=1&width=1600&height=950&p.tn=Charcoal.jpg,Charcoal.jpg,Black.jpg,Black.jpg,Charcoal.jpg,Charcoal.jpg,Charcoal.jpg',
        description: '112 Trucker Hat - Charcoal/Charcoal/Black'
    },
    {
        style: '112',
        category: 'Combination',
        color: 'Charcoal/Charcoal/Red',
        url: 'https://richardson.picarioxpo.com/112_FINAL.pfs?1=1&width=1600&height=950&p.tn=Charcoal.jpg,Charcoal.jpg,Red.jpg,Red.jpg,Charcoal.jpg,Charcoal.jpg,Charcoal.jpg',
        description: '112 Trucker Hat - Charcoal/Charcoal/Red'
    },
    {
        style: '112',
        category: 'Combination',
        color: 'Charcoal/Charcoal/Orange',
        url: 'https://richardson.picarioxpo.com/112_FINAL.pfs?1=1&width=1600&height=950&p.tn=Charcoal.jpg,Charcoal.jpg,Orange.jpg,Orange.jpg,Charcoal.jpg,Charcoal.jpg,Charcoal.jpg',
        description: '112 Trucker Hat - Charcoal/Charcoal/Orange'
    },
    {
        style: '112',
        category: 'Combination',
        color: 'Charcoal/Charcoal/Royal',
        url: 'https://c3eku948.caspio.com/dp/a0e150004df4984fb1ef4d30b01a/files/9148412',
        description: '112 Trucker Hat - Charcoal/Charcoal/Royal'
    },
    {
        style: '112',
        category: 'Combination',
        color: 'Heather Grey/Heather Grey/Black',
        url: 'https://richardson.picarioxpo.com/112_FINAL.pfs?1=1&width=1600&height=950&p.tn=112-Heather-Grey.jpg,112-Heather-Grey.jpg,Black.jpg,Black.jpg,112-Heather-Grey.jpg,112-Heather-Grey.jpg,112-Heather-Grey.jpg',
        description: '112 Trucker Hat - Heather Grey/Heather Grey/Black'
    },
    {
        style: '112',
        category: 'Combination',
        color: 'Heather Grey/Heather Grey/Navy',
        url: 'https://richardson.picarioxpo.com/112_FINAL.pfs?1=1&width=1600&height=950&p.tn=112-Heather-Grey.jpg,112-Heather-Grey.jpg,Navy.jpg,Navy.jpg,112-Heather-Grey.jpg,112-Heather-Grey.jpg,112-Heather-Grey.jpg',
        description: '112 Trucker Hat - Heather Grey/Heather Grey/Navy'
    },
    {
        style: '112',
        category: 'Combination',
        color: 'Heather Grey/Heather Grey/Red',
        url: 'https://richardson.picarioxpo.com/112_FINAL.pfs?1=1&width=1600&height=950&p.tn=112-Heather-Grey.jpg,112-Heather-Grey.jpg,Red.jpg,Red.jpg,112-Heather-Grey.jpg,112-Heather-Grey.jpg,112-Heather-Grey.jpg',
        description: '112 Trucker Hat - Heather Grey/Heather Grey/Red'
    },
    {
        style: '112',
        category: 'Combination',
        color: 'Heather Grey/Heather Grey/Royal',
        url: 'https://richardson.picarioxpo.com/112_FINAL.pfs?1=1&width=1600&height=950&p.tn=112-Heather-Grey.jpg,112-Heather-Grey.jpg,Royal.jpg,Royal.jpg,112-Heather-Grey.jpg,112-Heather-Grey.jpg,112-Heather-Grey.jpg',
        description: '112 Trucker Hat - Heather Grey/Heather Grey/Royal'
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
