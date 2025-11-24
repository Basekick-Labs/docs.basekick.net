import requests
import os

token = 'dnXEmHroA5yoQb26AP0TcQIVRYo5REQZKU0D0I9l22g'

response = requests.post(
    "http://localhost:8000/api/v1/query",
    headers={
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json"
    },
    json={
        "sql": "SELECT * FROM prod.cpu ORDER BY time DESC LIMIT 10",
        "format": "json"
    }
)

data = response.json()
print(f"Rows: {len(data['data'])}")
for row in data['data']:
    print(row)
