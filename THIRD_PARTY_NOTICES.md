# Third-party notices

The files in src/engine were adapted from [achimala/claude-toons](https://github.com/achimala/claude-toons), commit 0fac2edc29d06493597d486cae3799441ecef7d8.

Copyright (c) 2026 Anshu Chimala. MIT License; the complete license is retained in LICENSE.

Adaptations include Uint32Array Canvas output, sprite callbacks in clawd/clawd3d, fixed-character anchors, a provider-neutral director prompt, and a Harness event/Worker/UI integration. The original authentication and Anthropic request implementation are not used.

DeepSeek Harness packages retain their own licenses and are dependencies of the host runtime. This plugin targets @deepseek-ai/dsh 0.2.0-rc.2.

The new character assets were generated with the built-in image_gen tool using the user's supplied character reference. Prompts and character design records are stored in design/.

Local resource ZIP imports use [fflate](https://github.com/101arrowz/fflate), version 0.8.3, Copyright (c) 2026 Arjun Barrett. MIT License. The full license is included in THIRD_PARTY_LICENSES/fflate.txt. The mint robot and garden example in examples/ is original procedural pixel art created for this project.
