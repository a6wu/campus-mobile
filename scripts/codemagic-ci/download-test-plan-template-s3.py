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
    destination = options["destination"].strip()

    if not bucket:
        raise ValueError("S3 bucket is required")
    if not key:
        raise ValueError("S3 object key is required")
    if not destination:
        raise ValueError("Destination path is required")

    session = boto3.session.Session(region_name=region or None)
    s3 = session.client("s3")
    s3.download_file(bucket, key, destination)

    print(json.dumps({
        "bucket": bucket,
        "key": key,
        "destination": destination,
    }))


if __name__ == "__main__":
    main()
