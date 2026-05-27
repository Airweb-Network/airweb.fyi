// Per-locale overrides for Airweb docs.
// Keys are "<sectionId|pageSlug>.<field>" where field is one of:
//   label        (for sections)
//   title        (for pages)
//   description  (for pages)
//   html         (for pages)
//
// Missing keys fall back to the English source in pages.js. Placeholders
// {{APEX}}, {{PUBLIC_DOMAIN}}, {{PUBLIC_DOMAIN_BASE}}, {{SSH_HOST}},
// {{SSH_PORT}} are substituted at render time, so keep them verbatim in
// translated HTML.

module.exports = require('./translations/index');
