import json
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'python_modules'))

import boto3


def main():
    options = json.loads(str(sys.argv[1]))
    bucket = options["bucket"].strip()
    region = options.get("region", "").strip()
    key = options["key"].strip()
    file_path = options["filePath"].strip()
    file_name = options["fileName"].strip()
    expires_in = int(options["expiresIn"])
    content_type = options.get(
        "contentType",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    )

    if not bucket:
        raise ValueError("S3 bucket is required")
    if not key:
        raise ValueError("S3 object key is required")
    if not os.path.exists(file_path):
        raise FileNotFoundError(f"Test plan file not found: {file_path}")

    session = boto3.session.Session(region_name=region or None)
    s3 = session.client("s3")

    s3.upload_file(
        file_path,
        bucket,
        key,
        ExtraArgs={"ContentType": content_type},
    )

    presigned_url = s3.generate_presigned_url(
        "get_object",
        Params={
            "Bucket": bucket,
            "Key": key,
            "ResponseContentDisposition": f'attachment; filename="{file_name}"',
        },
        ExpiresIn=expires_in,
    )

    print(json.dumps({
        "bucket": bucket,
        "key": key,
        "fileName": file_name,
        "url": presigned_url,
        "expiresIn": expires_in,
    }))


if __name__ == "__main__":
    main()
