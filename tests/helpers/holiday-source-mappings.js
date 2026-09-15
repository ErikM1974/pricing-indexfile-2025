const { changes } = require('../fixtures/holiday-request-source-mappings.json');
module.exports = function restorePreHoliday(file, source) {
    source = require('./carhartt-bucks-source-mappings')(file, source);
    source = require('./finish-line-source-mappings')(file, source);
    for (const change of changes.filter(row => row.file === file).reverse()) {
        if (source.split(change.after).length - 1 !== change.count) throw new Error('Holiday integration mapping drift: ' + file);
        source = source.split(change.after).join(change.before);
    }
    return source;
};
