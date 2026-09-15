"""
Script to extract real Drosophila brain geometry from FlyWire/flybrains
and export optimized GLB and JSON assets for the 3D web application.
"""

import os
import json
import numpy as np
import trimesh
import flybrains
from fafbseg import flywire

ASSETS_DIR = "/Users/kodzy/Desktop/fly/public/assets"
os.makedirs(ASSETS_DIR, exist_ok=True)

print("1. Loading FlyWire whole-brain mesh...")
brain_mesh = flybrains.FLYWIRE.mesh_whole_brain

# Compute global center and scale factor for all assets
center = brain_mesh.centroid
bounds = brain_mesh.bounds
extent = bounds[1] - bounds[0]
max_extent = np.max(extent)
scale = 10.0 / max_extent  # normalize to 10 units wide

print(f"Center: {center}, Max extent: {max_extent}, Scale factor: {scale}")

# Save transform info
transform_info = {
    "center": center.tolist(),
    "scale": float(scale),
    "bounds": bounds.tolist()
}
with open(os.path.join(ASSETS_DIR, "transform.json"), "w") as f:
    json.dump(transform_info, f, indent=2)

# Transform brain mesh to centered coordinates
centered_brain = brain_mesh.copy()
centered_brain.apply_translation(-center)
centered_brain.apply_scale(scale)

# Simplify slightly for ultra-smooth 60fps web rendering if needed
print(f"Original vertices: {len(centered_brain.vertices)}, faces: {len(centered_brain.faces)}")
try:
    # Decimate slightly to ~25k faces for crisp fast web rendering
    simplified_brain = centered_brain.simplify_quadric_decimation(face_count=24000)
except Exception as e:
    print("Simplification fallback:", e)
    simplified_brain = centered_brain

glb_bytes = simplified_brain.export(file_type="glb")
brain_path = os.path.join(ASSETS_DIR, "fly_brain.glb")
with open(brain_path, "wb") as f:
    f.write(glb_bytes)
print(f"Exported fly_brain.glb ({len(glb_bytes) / 1024:.1f} KB)")

# 2. Export Neuropil regions
print("\n2. Loading and exporting key Neuropil volumes...")
target_neuropils = [
    ("ME_L", "Left Medulla (Vision)", "#4cc9f0"),
    ("ME_R", "Right Medulla (Vision)", "#4cc9f0"),
    ("AL_L", "Left Antennal Lobe (Smell)", "#f72585"),
    ("AL_R", "Right Antennal Lobe (Smell)", "#f72585"),
    ("MB_CA_L", "Mushroom Body Calyx L (Memory)", "#ffd166"),
    ("MB_CA_R", "Mushroom Body Calyx R (Memory)", "#ffd166"),
    ("EB", "Ellipsoid Body (Compass / Navigation)", "#06d6a0"),
    ("FB", "Fan-shaped Body (Central Complex)", "#118ab2"),
    ("LH_L", "Left Lateral Horn (Innate Instincts)", "#b5179e"),
    ("LH_R", "Right Lateral Horn (Innate Instincts)", "#b5179e"),
]

neuropil_manifest = []
for name, label, color in target_neuropils:
    try:
        vol = flywire.get_neuropil_volumes(name)
        v_mesh = trimesh.Trimesh(vertices=vol.vertices, faces=vol.faces)
        v_mesh.apply_translation(-center)
        v_mesh.apply_scale(scale)
        
        # export GLB
        v_glb = v_mesh.export(file_type="glb")
        v_path = os.path.join(ASSETS_DIR, f"neuropil_{name}.glb")
        with open(v_path, "wb") as f:
            f.write(v_glb)
            
        neuropil_manifest.append({
            "id": name,
            "label": label,
            "color": color,
            "file": f"assets/neuropil_{name}.glb",
            "vertices_count": len(v_mesh.vertices)
        })
        print(f" - Exported neuropil: {name} ({len(v_mesh.vertices)} vertices)")
    except Exception as e:
        print(f" - Error exporting neuropil {name}: {e}")

with open(os.path.join(ASSETS_DIR, "neuropils.json"), "w") as f:
    json.dump(neuropil_manifest, f, indent=2)

# 3. Export Sample Real Neurons (including PAM dopaminergic cluster neuron!)
print("\n3. Loading and transforming sample neuron skeletons...")
sample_neuron_types = [
    ("PAM", "Dopaminergic Reward Neuron (Mushroom Body PAM cluster)", "#00ff88", "dopamine"),
    ("ORN_DA1", "Olfactory Receptor Neuron (Pheromone/Odor)", "#ff007f", "acetylcholine"),
    ("L3", "Visual Lamina Interneuron (Contrast/Motion)", "#00d4ff", "acetylcholine"),
    ("EPG", "Compass Ring Neuron (Central Complex Heading Direction)", "#ffd166", "acetylcholine"),
    ("DNp01", "Descending Motor Command Neuron (Brain to Motor Center)", "#ff3366", "acetylcholine"),
]

ann = flywire.get_hierarchical_annotations()
neuron_manifest = []

for ctype_query, desc, color, nt in sample_neuron_types:
    try:
        if ctype_query == "PAM":
            sub = ann[ann["cell_type"].str.contains("PAM", na=False)]
        else:
            sub = ann[ann["cell_type"] == ctype_query]
            
        if sub.empty:
            continue
            
        row = sub.iloc[0]
        rid = int(row["root_id"])
        print(f"Fetching skeleton for {row['cell_type']} (root_id: {rid})...")
        sk = flywire.get_skeletons(rid)
        
        # Transform node coordinates
        nodes_df = sk.nodes.copy()
        coords = nodes_df[["x", "y", "z"]].values
        transformed_coords = (coords - center) * scale
        nodes_df["x"] = transformed_coords[:, 0]
        nodes_df["y"] = transformed_coords[:, 1]
        nodes_df["z"] = transformed_coords[:, 2]
        
        # Extract segments (pairs of connected points: node to parent)
        node_lookup = {int(row_node.node_id): (float(row_node.x), float(row_node.y), float(row_node.z)) 
                       for _, row_node in nodes_df.iterrows()}
        
        segments = []
        for _, row_node in nodes_df.iterrows():
            pid = int(row_node.parent_id)
            if pid in node_lookup:
                p_coord = node_lookup[pid]
                c_coord = (float(row_node.x), float(row_node.y), float(row_node.z))
                segments.append([p_coord, c_coord])
        
        soma_pos = None
        if hasattr(sk, "soma") and sk.soma is not None:
            try:
                soma_val = sk.soma
                if isinstance(soma_val, (list, np.ndarray)):
                    soma_id = int(soma_val[0]) if len(soma_val) > 0 else None
                else:
                    soma_id = int(soma_val)
                if soma_id and soma_id in node_lookup:
                    soma_pos = list(node_lookup[soma_id])
            except Exception:
                pass
        if soma_pos is None and len(segments) > 0:
            soma_pos = segments[0][0]

        neuron_data = {
            "root_id": str(rid),
            "cell_type": str(row["cell_type"]),
            "super_class": str(row["super_class"]),
            "description": desc,
            "neurotransmitter": nt,
            "color": color,
            "soma": soma_pos,
            "segments_count": len(segments),
            "segments": segments
        }
        
        n_filename = f"neuron_{rid}.json"
        with open(os.path.join(ASSETS_DIR, n_filename), "w") as f:
            json.dump(neuron_data, f)
            
        neuron_manifest.append({
            "root_id": str(rid),
            "cell_type": str(row["cell_type"]),
            "super_class": str(row["super_class"]),
            "description": desc,
            "neurotransmitter": nt,
            "color": color,
            "file": f"assets/{n_filename}",
            "segments_count": len(segments)
        })
        print(f" - Exported neuron {row['cell_type']} with {len(segments)} 3D branch segments")
    except Exception as e:
        print(f" - Error exporting neuron {ctype_query}: {e}")

with open(os.path.join(ASSETS_DIR, "neurons.json"), "w") as f:
    json.dump(neuron_manifest, f, indent=2)

print("\nAsset export completed successfully!")
