"""Native vocabulary paths must work in Unicode installation folders."""
import tempfile
import unittest
from pathlib import Path

from integrations.asr_runtime.vocabulary import bpe_vocabulary


class VocabularyPathTests(unittest.TestCase):
    def test_unicode_install_keeps_an_absolute_path_and_writes_once(self):
        with tempfile.TemporaryDirectory(prefix='capri-') as parent:
            root = Path(parent) / 'капри тест'
            root.mkdir()
            tokens = root / 'tokens.txt'
            tokens.write_text('▁Capri 0\n▁привет 1\n', encoding='utf-8')
            result = bpe_vocabulary(root, tokens)
            self.assertTrue(Path(result).is_absolute())
            self.assertTrue(result.startswith(str(root)))
            file = Path(result)
            self.assertEqual(file.read_text(encoding='utf-8'), '▁Capri\t-1.0\n▁привет\t-1.0\n')
            self.assertEqual(bpe_vocabulary(root, tokens), result)
            self.assertEqual(len(list(file.parent.iterdir())), 1)


if __name__ == '__main__':
    unittest.main()
