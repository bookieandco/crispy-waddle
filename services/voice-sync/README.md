# Voice Sync Service

The service routes governed voice-sync work to isolated runtime adapters. MuseTalk is the preferred visual lip-sync engine, Wav2Lip is the visual fallback, and Rhubarb supplies phoneme/viseme timing.

Runtime adapters receive only resolved governed media assets and timing tracks. They return a generated artifact, bounded confidence, and evidence. They do not receive Jhadina credentials, policy authority, approval authority, or arbitrary network access.

The host redacts unexpected runtime failures. Generated media remains subject to Director Studio QC and explicit asset approval.
