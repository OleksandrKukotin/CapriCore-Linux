// SPDX-License-Identifier: GPL-3.0-only
import { execFile } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { crc32 } from 'node:zlib';

/** A minimal ZIP writer (stored entries only) — enough for a VSIX package. */
export function storedZip(entries) {
  const locals = [];
  const centrals = [];
  let offset = 0;
  for (const [name, content] of entries) {
    const file = Buffer.from(name, 'utf8');
    const data = Buffer.isBuffer(content) ? content : Buffer.from(content, 'utf8');
    const crc = crc32(data);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4); // version needed
    local.writeUInt16LE(0x0800, 6); // UTF-8 names
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(data.length, 18);
    local.writeUInt32LE(data.length, 22);
    local.writeUInt16LE(file.length, 26);
    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4); // version made by
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(0x0800, 8);
    central.writeUInt32LE(crc, 16);
    central.writeUInt32LE(data.length, 20);
    central.writeUInt32LE(data.length, 24);
    central.writeUInt16LE(file.length, 28);
    central.writeUInt32LE(offset, 42);
    locals.push(local, file, data);
    centrals.push(central, file);
    offset += local.length + file.length + data.length;
  }
  const directory = Buffer.concat(centrals);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(entries.length, 8);
  end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(directory.length, 12);
  end.writeUInt32LE(offset, 16);
  return Buffer.concat([...locals, directory, end]);
}

/** Package integrations/coding-vscode as `.runtime/coding-vscode/capri-project-bridge.vsix`. */
export function buildCodingBridge(root) {
  const source = path.join(root, 'integrations/coding-vscode');
  const { version } = JSON.parse(readFileSync(path.join(source, 'package.json'), 'utf8'));
  if (!/^\d+\.\d+\.\d+$/.test(version)) throw new Error('Invalid editor bridge version');
  const manifest = `<?xml version="1.0" encoding="utf-8"?><PackageManifest Version="2.0.0" xmlns="http://schemas.microsoft.com/developer/vsx-schema/2011"><Metadata><Identity Language="en-US" Id="capri-project-bridge" Version="${version}" Publisher="capricore"/><DisplayName>Capri Project Bridge</DisplayName><Description xml:space="preserve">Local project documents and diagnostics for Capri.</Description><Tags>capri</Tags><Categories>Other</Categories><Properties><Property Id="Microsoft.VisualStudio.Code.Engine" Value="^1.90.0"/></Properties></Metadata><Installation><InstallationTarget Id="Microsoft.VisualStudio.Code"/></Installation><Dependencies/><Assets><Asset Type="Microsoft.VisualStudio.Code.Manifest" Path="extension/package.json" Addressable="true"/></Assets></PackageManifest>`;
  const contentTypes =
    '<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="json" ContentType="application/json"/><Default Extension="cjs" ContentType="application/javascript"/><Default Extension="vsixmanifest" ContentType="text/xml"/></Types>';
  const output = path.join(root, '.runtime/coding-vscode/capri-project-bridge.vsix');
  mkdirSync(path.dirname(output), { recursive: true });
  writeFileSync(
    output,
    storedZip([
      ['extension/package.json', readFileSync(path.join(source, 'package.json'))],
      ['extension/extension.cjs', readFileSync(path.join(source, 'extension.cjs'))],
      ['[Content_Types].xml', contentTypes],
      ['extension.vsixmanifest', manifest],
    ]),
  );
  return output;
}

export async function installCodingBridge(root, editor, signal) {
  const vsix = buildCodingBridge(root);
  signal?.throwIfAborted();
  await new Promise((resolve, reject) =>
    execFile(
      editor.executable,
      ['--install-extension', vsix, '--force'],
      { timeout: 90000, maxBuffer: 1024 * 1024, signal },
      (error) =>
        error
          ? reject(
              signal?.aborted
                ? signal.reason
                : new Error(
                    'The editor bridge could not be installed. Check the selected editor and retry.',
                  ),
            )
          : resolve(),
    ),
  );
}
