"""Bounded startup status for native exits that precede the authenticated server."""
import errno
import os
import time


def memory_status():
    """System memory facts from /proc/meminfo, in bytes."""
    fields = {'MemTotal': 'totalPhysical', 'MemAvailable': 'availablePhysical',
              'CommitLimit': 'commitLimit', 'Committed_AS': 'committed'}
    try:
        values = {}
        with open('/proc/meminfo', encoding='ascii') as meminfo:
            for line in meminfo:
                key, _, rest = line.partition(':')
                if key in fields:
                    values[fields[key]] = int(rest.split()[0]) * 1024
        return values or None
    except (OSError, ValueError):
        return None


def startup_failure(error):
    # Allocation failures surface as MemoryError or ENOMEM (for example a CUDA or
    # mmap reservation the kernel's overcommit policy refuses).
    memory = isinstance(error, MemoryError) or getattr(error, 'errno', None) == errno.ENOMEM
    return dict(schemaVersion=1, pid=os.getpid(), at=int(time.time()*1000),
                code='CAPRI_VOICE_COMMIT_LIMIT' if memory else 'CAPRI_VOICE_STARTUP_FAILED',
                errorClass=type(error).__name__, memory=memory_status())
