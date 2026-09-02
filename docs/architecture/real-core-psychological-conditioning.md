# Real Core Psychological Conditioning

Jhadina uses the MBTI-in-Thoughts research pattern as an optional behavioral-conditioning layer. The upstream project demonstrates prompt-based personality conditioning and self-reflection without fine-tuning. See https://github.com/spcl/MBTI-in-Thoughts.

## Runtime rule

Do not bake mutable Jhadina state into a permanent model weight or static Modelfile. The model receives a generated system block at request time so identity, attention, preferences, open loops, uncertainty, and psychological priors can evolve without rebuilding the model.

For Ollama or llama.cpp, a static Modelfile may contain the invariant identity/policy portion, while the runtime supplies the current Real Core state in the request/system message.

For LangChain or CrewAI, pass `buildPsychologicalSystemPrompt(profile, realCore.snapshot())` into the agent's system message/role description.

## Architectural boundary

Psychological conditioning influences style, attention, reflection, and decision framing. It must not authorize actions, override policy, manufacture evidence, or mutate durable state directly. Real Core owns state; Context/Decision consume its projection; Policy remains the enforcement boundary.
