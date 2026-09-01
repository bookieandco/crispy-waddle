# G13ae implementation target

1. Authorize controller/session/health/capability before integrity acceptance.
2. Check resynchronization before integrity acceptance.
3. Only accepted, synchronized inputs may enter transport/runtime delivery.
4. A rejected typed capability input must not advance sequence state or integrity counters.
