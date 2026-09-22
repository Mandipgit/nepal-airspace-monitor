import json
import urllib.request
import os

url = "https://raw.githubusercontent.com/opentechcommunity/map-of-nepal/master/nepal.geojson"
target_path = os.path.abspath(r"f:\Flight Tracking\frontend\public\nepal.geojson")

print(f"Downloading Nepal GeoJSON from {url}...")
req = urllib.request.Request(
    url,
    headers={"User-Agent": "Mozilla/5.0"}
)
with urllib.request.urlopen(req) as resp:
    data = resp.read()

# Validate JSON
parsed = json.loads(data.decode("utf-8"))
print(f"Successfully parsed JSON. Type: {parsed.get('type')}, Features count: {len(parsed.get('features', []))}")

with open(target_path, "wb") as f:
    f.write(data)

print(f"Saved {len(data)} bytes to {target_path}")
