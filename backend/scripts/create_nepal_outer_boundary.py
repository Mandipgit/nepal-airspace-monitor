import json
from shapely.geometry import shape, mapping
from shapely.ops import unary_union
import os

input_path = os.path.abspath(r"f:\Flight Tracking\frontend\public\nepal.geojson")
output_path = os.path.abspath(r"f:\Flight Tracking\frontend\public\nepal-boundary.geojson")

with open(input_path, "r", encoding="utf-8") as f:
    data = json.load(f)

polygons = [shape(feature["geometry"]) for feature in data["features"]]
print(f"Loaded {len(polygons)} polygons.")

# Dissolve internal borders into the exact single outer boundary
nepal_outer = unary_union(polygons)

# If it's a polygon or multipolygon, let's inspect
print(f"Dissolved geometry type: {nepal_outer.geom_type}")
print(f"Bounds: {nepal_outer.bounds}")

geojson_data = {
    "type": "FeatureCollection",
    "features": [
        {
            "type": "Feature",
            "properties": {
                "name": "Nepal",
                "admin_level": 2
            },
            "geometry": mapping(nepal_outer)
        }
    ]
}

with open(output_path, "w", encoding="utf-8") as f:
    json.dump(geojson_data, f)

print(f"Saved exact Nepal boundary to {output_path} (size={os.path.getsize(output_path)} bytes)")
