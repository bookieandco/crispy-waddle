const { buildParcelEvidence } = require('./parcel-corroboration');

function runParcelIdentityFixture() {
  return buildParcelEvidence({
    treasury: { parcelId: '123-45-678' },
    assessor: { parcelId: '12345678' },
    candidate: {
      parcelId: '123-45-678',
      username: 'controlled-public-handle',
    },
  });
}

module.exports = { runParcelIdentityFixture };
