import test from 'node:test';
import assert from 'node:assert/strict';
import type {
  CodeWordBinding,
  EmergencyProtocol,
  EmergencyThreatAssessment,
} from './emergency-domain.js';

test('critical personal-danger protocol can require evidence and escalation', () => {
  const assessment: EmergencyThreatAssessment = {
    threat: 'personal-danger',
    severity: 'critical',
    confidence: 1,
    reasonCode: 'configured-code-word',
  };

  const protocol: EmergencyProtocol = {
    id: 'personal-danger-01',
    name: 'Personal danger',
    threat: 'personal-danger',
    minimumSeverity: 'critical',
    evidencePolicy: {
      audio: true,
      video: true,
      location: true,
      retentionSeconds: 60 * 60 * 24 * 30,
    },
    actions: [
      { kind: 'start-evidence-session' },
      { kind: 'capture-location' },
      {
        kind: 'notify-contact-group',
        notification: {
          contactGroupId: 'primary-safety',
          allowedInformation: ['emergency-status', 'location'],
          requireAcknowledgement: true,
        },
      },
      {
        kind: 'start-escalation-timer',
        escalation: {
          afterSeconds: 120,
          action: 'notify-contact-group',
          contactGroupId: 'secondary-safety',
        },
      },
    ],
  };

  assert.equal(assessment.threat, protocol.threat);
  assert.equal(protocol.evidencePolicy.audio, true);
  assert.equal(protocol.evidencePolicy.video, true);
  assert.equal(protocol.evidencePolicy.location, true);
  assert.equal(protocol.actions.length, 4);
});

test('code-word bindings contain a verifier rather than plaintext', () => {
  const binding: CodeWordBinding = {
    id: 'cw-01',
    protocolId: 'personal-danger-01',
    enabled: true,
    verifier: 'opaque-verifier-reference',
  };

  assert.equal(binding.verifier, 'opaque-verifier-reference');
  assert.equal('secret' in binding, false);
});
