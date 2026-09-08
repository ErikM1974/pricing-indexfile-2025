const crypto = require('crypto');

// The proxy deploy must send credentials before these gates are enabled.
module.exports = function createQuoteSyncAccess({ sharedSecret, requireStaff }) {
    function isStaffOrSync(req) {
        if (req.session && req.session.crmUser) return true;
        const supplied = req.get('X-CRM-API-Secret');
        if (typeof sharedSecret !== 'string' || !sharedSecret || typeof supplied !== 'string')
            return false;
        const expected = Buffer.from(sharedSecret);
        const actual = Buffer.from(supplied);
        return actual.length === expected.length && crypto.timingSafeEqual(actual, expected);
    }
    function requireStaffOrSync(req, res, next) {
        if (isStaffOrSync(req)) return next();
        return requireStaff(req, res, next);
    }
    return { isStaffOrSync, requireStaffOrSync };
};
