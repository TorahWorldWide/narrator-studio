"""One-off: upload ~/audio-level/orig/*.mp3 to R2 bucket torah-audio under narration-orig/.

Run with system python3 -I (boto3 installed there). Resumable: skips keys that already exist
with the same size. Never touches any other prefix.
"""
import os
import sys
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

import boto3
from botocore.config import Config

BUCKET = 'torah-audio'
PREFIX = 'narration-orig/'
SRC = Path.home() / 'audio-level' / 'orig'
CREDS = Path.home() / '.hermes' / '.cf_r2_new_s3'


def load_creds():
    out = {}
    for line in CREDS.read_text().splitlines():
        if '=' in line:
            k, v = line.split('=', 1)
            out[k.strip()] = v.strip()
    return out


def main():
    c = load_creds()
    s3 = boto3.client(
        's3', endpoint_url=c['endpoint'], aws_access_key_id=c['access_key_id'],
        aws_secret_access_key=c['secret_access_key'], region_name='auto',
        config=Config(retries={'max_attempts': 5, 'mode': 'standard'}, max_pool_connections=16),
    )
    existing = {}
    for page in s3.get_paginator('list_objects_v2').paginate(Bucket=BUCKET, Prefix=PREFIX):
        for o in page.get('Contents', []):
            existing[o['Key']] = o['Size']
    files = sorted(SRC.glob('*.mp3'))
    todo = [f for f in files if existing.get(PREFIX + f.name) != f.stat().st_size]
    print(f'{len(files)} local, {len(existing)} already on R2, {len(todo)} to upload', flush=True)

    def put(f):
        with open(f, 'rb') as fh:
            s3.put_object(Bucket=BUCKET, Key=PREFIX + f.name, Body=fh, ContentType='audio/mpeg',
                          CacheControl='public, max-age=31536000, immutable')
        return f.name

    done = 0
    with ThreadPoolExecutor(max_workers=8) as ex:
        for _ in ex.map(put, todo):
            done += 1
            if done % 50 == 0:
                print(f'uploaded {done}/{len(todo)}', flush=True)
    n = sum(len(p.get('Contents', [])) for p in
            s3.get_paginator('list_objects_v2').paginate(Bucket=BUCKET, Prefix=PREFIX))
    print(f'DONE uploaded={done} prefix_count={n}', flush=True)
    return 0 if n == len(files) else 1


if __name__ == '__main__':
    sys.exit(main())
