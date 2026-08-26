/* =====================================================
   STAFF ROSTER — the ONE home for employee data (2026-08-27)

   Served ONLY through GET /api/staff/employees (requireStaff) for the
   staff dashboard's Team widget + staff directory. Lives in lib/ because
   nothing under lib/ is statically served — this data (names, birthdays,
   hire dates and especially termination dates) used to sit hardcoded in
   shared_components/js/staff-dashboard/services/employees-service.js,
   which the static mount hands to ANYONE on the internet (the staff gate
   covers only .html). Same pattern as lib/drive-access-data.json.

   To update: edit this array and deploy. birthday is "MM-DD" (no year —
   ages are deliberately not stored). endDate marks a former employee's
   last day; the dashboard filters them out of every widget but keeps the
   row so the directory's "former" status stays accurate.
   ===================================================== */

module.exports = [
    { firstName: "Jim",            lastName: "Mickelson", startDate: "1977-10-31", birthday: "03-25", position: "CEO" },
    { firstName: "Erik",           lastName: "Mickelson", startDate: "1996-12-16", birthday: "02-14", position: "Operations Manager" },
    { firstName: "Ruthie",         lastName: "Nhoung",    startDate: "1998-08-05", birthday: "01-19", position: "Production Manager" },
    { firstName: "Savy",           lastName: "Som",       startDate: "2008-04-21", birthday: "09-08", position: "Embroidery Machine Operator" },
    { firstName: "Sorphorn",       lastName: "Sorm",      startDate: "2011-04-11", birthday: "07-10", position: "Embroidery Machine Operator" },
    { firstName: "Nika",           lastName: "Lao",       startDate: "2012-07-31", birthday: "06-29", position: "Account Executive" },
    { firstName: "Taylar",         lastName: "Hanson",    startDate: "2015-04-20", birthday: "06-30", position: "Account Executive", endDate: "2025-08-29" },
    { firstName: "Bunsereytheavy", lastName: "Hoeu",      startDate: "2015-05-19", birthday: "01-01", position: "Embroidery Machine Operator" },
    { firstName: "Bradley",        lastName: "Wright",    startDate: "2017-08-10", birthday: "01-09", position: "Accounting/Purchasing/Webstores" },
    { firstName: "Steve",          lastName: "Deland",    startDate: "2017-09-28", birthday: "06-30", position: "Graphic Artist" },
    { firstName: "Kanha",          lastName: "Chhorn",    startDate: "2018-02-21", birthday: "06-11", position: "Embroidery Supervisor & Machine Operator" },
    { firstName: "Brian",          lastName: "Beardsley", startDate: "2018-08-13", birthday: "06-29", position: "DTG Supervisor" },
    { firstName: "Sreynai",        lastName: "Meang",     startDate: "2019-12-09", birthday: "09-02", position: "Embroidery Machine Operator" },
    { firstName: "Sothea",         lastName: "Tann",      startDate: "2022-09-22", birthday: "04-23", position: "Embroidery Machine Operator" },
    { firstName: "Joseph",         lastName: "Hallowell", startDate: "2023-04-03", birthday: "08-14", position: "DTG Operator" },
    { firstName: "Sothida",        lastName: "Khiev",     startDate: "2024-03-01", birthday: "06-29", position: "Embroidery Machine Operator" },
    { firstName: "Mikalah",        lastName: "Hede",      startDate: "2024-10-03", birthday: "04-21", position: "Shipping/Receiving Clerk" },
    { firstName: "Adriyella",      lastName: "Trujillo",  startDate: "2025-02-17", birthday: "02-10", position: "Office Assistant", endDate: "2025-11-15" },
    { firstName: "Taneisha",       lastName: "Clark",     startDate: "2025-08-12", birthday: "12-25", position: "Sales Coordinator" },
];
