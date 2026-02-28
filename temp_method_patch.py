# -*- coding: utf-8 -*-
from pathlib import Path
path = Path('src/components/Grids_Calculation.vue')
text = path.read_text(encoding='utf-8')
start = text.index('    _buildGenerationJobInputs()')
end = text.index('    _buildGenerationJobSpec()', start)
new_section = '    // --- 封E��皁E�� Web Worker に渡しやすいよう、主要�E力をまとめる ---\r\n    _buildGenerationJobInputs() {\r\n      const source = collectGenerationJobInputSource(this);\r\n      return buildGenerationJobInputs(source);\r\n    },\r\n'
text = text[:start] + new_section + text[end:]
path.write_text(text, encoding='utf-8')
