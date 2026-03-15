"""R2/S3 storage client for the ML pipeline."""

import io
import boto3
from config import (
    R2_ENDPOINT,
    R2_ACCESS_KEY_ID,
    R2_SECRET_ACCESS_KEY,
    R2_BUCKET_NAME,
)

_s3: boto3.client | None = None


def get_s3():
    """Get or create the S3/R2 client."""
    global _s3
    if _s3 is None:
        _s3 = boto3.client(
            "s3",
            endpoint_url=R2_ENDPOINT,
            aws_access_key_id=R2_ACCESS_KEY_ID,
            aws_secret_access_key=R2_SECRET_ACCESS_KEY,
            region_name="auto",
        )
    return _s3


def download_file(key: str) -> bytes:
    """Download a file from R2 and return its contents."""
    s3 = get_s3()
    response = s3.get_object(Bucket=R2_BUCKET_NAME, Key=key)
    return response["Body"].read()


def upload_file(key: str, data: bytes, content_type: str = "application/octet-stream") -> str:
    """Upload data to R2 and return the key."""
    s3 = get_s3()
    s3.put_object(
        Bucket=R2_BUCKET_NAME,
        Key=key,
        Body=io.BytesIO(data),
        ContentType=content_type,
    )
    return key


def file_exists(key: str) -> bool:
    """Check if a file exists in R2."""
    s3 = get_s3()
    try:
        s3.head_object(Bucket=R2_BUCKET_NAME, Key=key)
        return True
    except s3.exceptions.ClientError:
        return False


def download_text(bates: str) -> str | None:
    """Download extracted text from R2. Returns None if the file doesn't exist."""
    key = f"text/{bates}.txt"
    try:
        data = download_file(key)
        return data.decode("utf-8")
    except Exception:
        return None


def upload_model(model_name: str, version: int, data: bytes) -> str:
    """Upload a model artifact to R2."""
    key = f"ml-models/{model_name}_v{version}.tar.gz"
    upload_file(key, data, "application/gzip")
    return key


def upload_embedding(bates: str, data: bytes) -> str:
    """Upload a document embedding to R2."""
    key = f"ml-embeddings/{bates}.npy"
    upload_file(key, data, "application/octet-stream")
    return key


def download_embedding(bates: str) -> bytes | None:
    """Download a document embedding from R2."""
    key = f"ml-embeddings/{bates}.npy"
    try:
        return download_file(key)
    except Exception:
        return None
