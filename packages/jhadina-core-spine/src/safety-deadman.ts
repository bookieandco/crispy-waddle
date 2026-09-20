export type DeadManState =
  | 'disarmed'
  | 'armed'
  | 'check-in-due'
  | 'confirmation-requested'
  | 'missed'
  | 'escalating'
  | 'resolved'
  | 'cancelled';

export type DeadManEvent =
  | 'arm'
  | 'check-in-due'
  | 'request-confirmation'
  | 'deadline-missed'
  | 'begin-escalation'
  | 'confirm-safe'
  | 'trusted-resolve'
  | 'cancel';

const transitions: Readonly<Record<DeadManState, Partial<Record<DeadManEvent, DeadManState>>>> = {
  disarmed: { arm: 'armed' },
  armed: { 'check-in-due': 'check-in-due', cancel: 'cancelled', 'confirm-safe': 'resolved' },
  'check-in-due': { 'request-confirmation': 'confirmation-requested', cancel: 'cancelled', 'confirm-safe': 'resolved' },
  'confirmation-requested': { 'deadline-missed': 'missed', cancel: 'cancelled', 'confirm-safe': 'resolved' },
  missed: { 'begin-escalation': 'escalating', cancel: 'cancelled', 'confirm-safe': 'resolved', 'trusted-resolve': 'resolved' },
  escalating: { cancel: 'cancelled', 'confirm-safe': 'resolved', 'trusted-resolve': 'resolved' },
  resolved: {},
  cancelled: {},
};

export function transitionDeadMan(state: DeadManState, event: DeadManEvent): DeadManState {
  const next = transitions[state][event];
  if (!next) throw new Error(`Invalid dead-man transition: ${state} -> ${event}`);
  return next;
}
