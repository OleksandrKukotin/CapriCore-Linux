"""Select a pinned voice wheel family without importing torch or loading weights."""
import argparse
import csv
import json
import os
import re
from pathlib import Path
import shutil
import subprocess

ROOT = Path(__file__).resolve().parents[2]


def select_profile(devices, visible=None, requested='auto', minimum_major=10):
    if requested not in {'auto', 'legacy', 'blackwell', 'amd'}:
        raise ValueError('Unknown voice runtime')
    if requested != 'auto':
        return requested
    selected = devices
    if visible is not None:
        ids = [v.strip() for v in visible.split(',') if v.strip()]
        selected = [d for d in devices if any(v == str(d.get('index')) or str(d.get('uuid', '')).startswith(v) for v in ids if v != '-1')]
    for device in selected:
        try:
            if int(str(device.get('capability', '')).split('.')[0]) >= minimum_major:
                return 'blackwell'
        except ValueError:
            pass
        name = str(device.get('name', ''))
        if 'blackwell' in name.lower() or re.search(r'\bRTX\s*(?:PRO\s*)?50\d{2}\b', name, re.I):
            return 'blackwell'
    return 'legacy'


def gpu_inventory():
    executable = shutil.which('nvidia-smi')
    if not executable:
        return [], 'NVIDIA inventory unavailable'
    options = {'timeout': 8, 'capture_output': True, 'text': True, 'encoding': 'utf-8', 'errors': 'replace'}
    try:
        result = subprocess.run([executable, '--query-gpu=index,uuid,name,compute_cap', '--format=csv,noheader,nounits'], **options)
        if result.returncode == 0:
            return [dict(zip(('index', 'uuid', 'name', 'capability'), [v.strip() for v in row])) for row in csv.reader(result.stdout.splitlines()) if len(row) == 4], None
        # Older driver tools may not expose compute_cap; names still identify RTX 50.
        result = subprocess.run([executable, '--query-gpu=index,uuid,name', '--format=csv,noheader,nounits'], **options)
        if result.returncode == 0:
            return [dict(zip(('index', 'uuid', 'name'), [v.strip() for v in row])) for row in csv.reader(result.stdout.splitlines()) if len(row) == 3], None
    except (OSError, subprocess.TimeoutExpired):
        pass
    return [], 'NVIDIA inventory failed'


def amd_supported(names):
    # RDNA3/RDNA4 cards supported by the ROCm PyTorch wheels; no gfx target spoofing.
    return any(re.search(r'\b(?:RX (?:9070(?: XT)?|9060 XT|7900 XTX|7700)|(?:AI )?PRO (?:R9700|W7900(?: Dual Slot)?))\b', str(name), re.I) for name in names)


def amd_inventory():
    # Display controllers from pciutils; without lspci no AMD GPU is assumed.
    try:
        inventory = subprocess.run(['lspci', '-mm'], capture_output=True, text=True, timeout=10)
        names = [row for row in inventory.stdout.splitlines()
                 if re.search(r'"(?:VGA compatible|3D|Display) controller"', row)]
        return [name for name in names if re.search(r'\b(?:AMD|Radeon)\b', name, re.I)]
    except (OSError, subprocess.TimeoutExpired):
        return []


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--profile', choices=['auto', 'legacy', 'blackwell', 'amd'], default='auto')
    args = parser.parse_args()
    devices, warning = gpu_inventory()
    spec = json.loads((ROOT / 'config/voice-runtime.json').read_text(encoding='utf-8'))
    profile = select_profile(devices, os.environ.get('CUDA_VISIBLE_DEVICES'), args.profile, spec['blackwellMinimumComputeMajor'])
    amd = []
    if profile == 'amd' or (profile == 'legacy' and not devices and args.profile == 'auto'):
        amd = amd_inventory()
        if amd_supported(amd):
            profile = 'amd'
    print(json.dumps({'profile': profile, **spec['profiles'][profile], 'devices': devices,
                      'warning': warning, **({'amdAdapterCount': len(amd)} if profile == 'amd' else {})}), flush=True)


if __name__ == '__main__':
    main()
