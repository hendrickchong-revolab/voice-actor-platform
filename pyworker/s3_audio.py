import os
import tempfile
from dataclasses import dataclass
from urllib.parse import urlparse

import boto3


@dataclass(frozen=True)
class S3Location:
    bucket: str
    key: str


def parse_s3_uri(uri: str) -> S3Location:
    if not uri.startswith("s3://"):
        raise ValueError("Invalid audioUrl (expected s3://bucket/key)")
    parsed = urlparse(uri)
    bucket = parsed.netloc
    key = parsed.path.lstrip("/")
    if not bucket or not key:
        raise ValueError("Invalid audioUrl")
    return S3Location(bucket=bucket, key=key)


def s3_client():
    region = os.getenv("S3_REGION")
    endpoint = os.getenv("S3_ENDPOINT")
    access_key = os.getenv("S3_ACCESS_KEY_ID")
    secret_key = os.getenv("S3_SECRET_ACCESS_KEY")

    if not region or not access_key or not secret_key:
        raise RuntimeError("Missing S3 env vars")

    return boto3.client(
        "s3",
        region_name=region,
        endpoint_url=endpoint or None,
        aws_access_key_id=access_key,
        aws_secret_access_key=secret_key,
    )


def download_to_tempfile(s3_uri: str) -> str:
    loc = parse_s3_uri(s3_uri)
    s3 = s3_client()

    suffix = ".bin"
    if "." in loc.key.split("/")[-1]:
        suffix = "." + loc.key.split("/")[-1].split(".")[-1]

    fd, path = tempfile.mkstemp(prefix="va_audio_", suffix=suffix)
    os.close(fd)

    s3.download_file(loc.bucket, loc.key, path)
    return path
