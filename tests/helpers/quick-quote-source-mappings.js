const { changes } = require('../fixtures/quick-quote-workflow-source-mappings.json');
module.exports = function restorePreQuickQuote(file, source) {
    for (const change of changes.filter(row => row.file === file).reverse()) {
        if (!change.after || source.split(change.after).length - 1 !== change.count) throw new Error('Quick Quote workflow mapping drift: ' + file);
        source = source.split(change.after).join(change.before);
    }
    return source;
};
