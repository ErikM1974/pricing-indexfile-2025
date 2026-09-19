const changes = require('../fixtures/web-quote-push-source-mappings.json');
module.exports = function restorePreWebQuotePush(file, source) {
    for (const change of changes.filter(row => row.file === file).reverse()) {
        if (source.split(change.after).length - 1 !== 1) throw new Error('Web quote push mapping drift: ' + file);
        source = source.replace(change.after, change.before);
    }
    return source;
};
