const fs = require('fs');
const path = require('path');
const vm = require('vm');

// No constructor or network: use the real stock-status method with a known vendor response.
const source = fs.readFileSync(path.join(__dirname, '../../shared_components/js/sample-inventory-service.js'), 'utf8');
const Service = vm.runInNewContext(source + '\nSampleInventoryService', {});

test.each([
    [{S: 100, M: 100}, 'in_stock', 'All sizes in stock', true],
    [{S: 0, M: 100}, 'out_of_stock', '1 size(s) out of stock', false],
    [{S: 10, M: 100}, 'low_stock', '1 size(s) low in stock', true],
])('sample availability includes an accurate message for %j', async (inventory, status, message, allAvailable) => {
    const service = Object.create(Service.prototype);
    service.fetchInventoryLevels = jest.fn().mockResolvedValue({sizes: ['S', 'M'], inventory});
    await expect(service.getStockStatus('PC54', 'Black', {S: 1, M: 2})).resolves.toMatchObject({status, message, allAvailable});
});
