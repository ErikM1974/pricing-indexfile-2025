const fixture = require('../fixtures/carhartt-bucks-source-mappings.json');
// Preserve pre-campaign content checks without replacing their original snapshots.
module.exports = function restorePreCarharttBucks(file, source) {
    let result = source.replace(/\r\n/g, '\n');
    for (const change of fixture.changes.filter(item => item.file === file).reverse()) {
        if (result.split(change.after).length - 1 !== change.count) throw new Error('Carhartt Bucks source mapping drift: ' + file);
        result = result.split(change.after).join(change.before);
    }
    return result;
};
