import msgpack
import requests
from datetime import datetime
import os

token = 'dvX59MkYekCaH7gi6bD41AvLZh_9KBZ3sV1jcF0E0_M'

# Send multiple rows in one request
data = {
    "m": "cpu",
    "columns": {
        "time": [
            int(datetime.now().timestamp() * 1000),
            int(datetime.now().timestamp() * 1000),
            int(datetime.now().timestamp() * 1000)
        ],
        "host": ["server01", "server02", "server03"],
        "usage_idle": [95.0, 87.5, 92.3],
        "usage_user": [3.2, 8.1, 5.4],
        "usage_system": [1.8, 4.4, 2.3]
    }
}

# Send data
response = requests.post(
    "http://localhost:8000/api/v1/write/msgpack",
    headers={
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/msgpack"
    },
    data=msgpack.packb(data)
)

if response.status_code == 204:
    print("Successfully wrote data!")
else:
    print(f"Error {response.status_code}: {response.text}")
