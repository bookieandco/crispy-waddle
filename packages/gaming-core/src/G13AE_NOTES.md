# G13ae — input ordering and capability-failure containment

The controller gate must reject unsupported typed inputs before `InputIntegrityMonitor.accept()` runs. Rejected controller inputs must not advance sequence state, duplicate/reorder counters, or reach transport/runtime delivery.
