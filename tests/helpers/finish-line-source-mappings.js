const changes = require('../fixtures/finish-line-source-mappings.json');
module.exports = function restorePreFinishLine(file, source) {
    for (const change of changes.filter(row => row.file === file).reverse()) {
        if (source.split(change.after).length - 1 !== 1) throw new Error('Finish Line dashboard mapping drift: ' + file);
        source = source.replace(change.after, change.before);
    }
    return source;
};
