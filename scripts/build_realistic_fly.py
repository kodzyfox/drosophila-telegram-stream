"""
Assembles high-detail anatomical meshes from flybody into an ultra-realistic,
museum-quality Drosophila melanogaster 3D model for Three.js.
Features:
- Solid, matte, deep ruby-red compound eyes
- Warm honey-caramel thorax and head cuticle
- Geometrically segmented abdomen with alternating honey-amber and dark chitin stripes
- Articulated amber-brown legs with pretarsal claws
- Separately hinged wings with iridescent membrane and chitinous venation
- Exact vertex normals on all parts for correct PBR shading.
"""

import os
import glob
import numpy as np
import trimesh

RAW_DIR = "/Users/kodzy/Desktop/fly/data/flybody_raw"
OUTPUT_GLB = "/Users/kodzy/Desktop/fly/public/assets/realistic_fly.glb"

print("1. Initializing build configuration...")

SCALE = 0.95
R = np.array([
    [ 0.0, -1.0,  0.0],
    [ 0.0,  0.0,  1.0],
    [ 1.0,  0.0,  0.0]
])

def to_three(v):
    return (R @ v.T).T * SCALE

scene = trimesh.Scene()

# -----------------------------------------------------------------------------
# 1. Compound Eyes & Ocelli (Solid, Deep Ruby-Red)
# -----------------------------------------------------------------------------
print("2. Building Compound Eyes & Ocelli...")
eye_files = ['head_red.obj', 'head_ocelli.obj']
eye_meshes = [trimesh.load(os.path.join(RAW_DIR, f)) for f in eye_files]
eyes = trimesh.util.concatenate(eye_meshes)
eyes.vertices = to_three(eyes.vertices)
_ = eyes.vertex_normals
scene.add_geometry(eyes, node_name='eyes', geom_name='geom_eyes')

# -----------------------------------------------------------------------------
# 2. Bristles (Sensory Macrochaetae)
# -----------------------------------------------------------------------------
print("3. Building Bristles...")
bristle_files = [
    'head_black.obj',
    'thorax_black.obj',
    'rostrum_bristle-brown.obj',
    'haustellum_black.obj',
    'antenna_left_black.obj',
    'antenna_right_black.obj'
]
bristle_meshes = [trimesh.load(os.path.join(RAW_DIR, f)) for f in bristle_files]
bristles = trimesh.util.concatenate(bristle_meshes)
bristles.vertices = to_three(bristles.vertices)
_ = bristles.vertex_normals
scene.add_geometry(bristles, node_name='bristles', geom_name='geom_bristles')

# -----------------------------------------------------------------------------
# 3. Head & Thorax Body (Honey-Amber Chitin)
# -----------------------------------------------------------------------------
print("4. Building Head & Thorax Exoskeleton...")
head_files = [
    'head_body.obj',
    'rostrum_body.obj',
    'haustellum_body.obj',
    'labrum_left_lower.obj',
    'labrum_right_lower.obj',
    'antenna_left_body.obj',
    'antenna_right_body.obj'
]
head_meshes = [trimesh.load(os.path.join(RAW_DIR, f)) for f in head_files]
head_m = trimesh.util.concatenate(head_meshes)
head_m.vertices = to_three(head_m.vertices)

thx_m = trimesh.load(os.path.join(RAW_DIR, 'thorax_body.obj'))
thx_m.vertices = to_three(thx_m.vertices)

thorax_head = trimesh.util.concatenate([head_m, thx_m])
_ = thorax_head.vertex_normals
scene.add_geometry(thorax_head, node_name='body', geom_name='geom_body')

# -----------------------------------------------------------------------------
# 4. Abdomen: Real Anatomical Stripes (Amber + Dark Chitin Bands)
# -----------------------------------------------------------------------------
print("5. Building Segmented Abdomen with Authentic Tergite Striping...")
amber_submeshes = []
stripe_submeshes = []

for i in range(1, 9):
    m = trimesh.load(os.path.join(RAW_DIR, f"abdomen_{i}_body.obj"))
    x_min, x_max = m.bounds[:, 0]
    
    # Split each tergite into anterior amber and posterior dark band
    face_centers_x = m.triangles.mean(axis=1)[:, 0]
    frac = (face_centers_x - x_min) / (x_max - x_min + 1e-6)
    
    stripe_mask = frac > 0.50
    amber_mask = ~stripe_mask
    
    m_stripe = m.submesh([stripe_mask], append=True)
    m_amber = m.submesh([amber_mask], append=True)
    
    m_stripe.vertices = to_three(m_stripe.vertices)
    m_amber.vertices = to_three(m_amber.vertices)
    
    stripe_submeshes.append(m_stripe)
    amber_submeshes.append(m_amber)

for i in range(1, 8):
    m_low = trimesh.load(os.path.join(RAW_DIR, f"abdomen_{i}_lower.obj"))
    m_low.vertices = to_three(m_low.vertices)
    amber_submeshes.append(m_low)

abdomen_amber = trimesh.util.concatenate(amber_submeshes)
_ = abdomen_amber.vertex_normals
scene.add_geometry(abdomen_amber, node_name='abdomen_amber', geom_name='geom_abdomen_amber')

abdomen_stripes = trimesh.util.concatenate(stripe_submeshes)
_ = abdomen_stripes.vertex_normals
scene.add_geometry(abdomen_stripes, node_name='abdomen_stripes', geom_name='geom_abdomen_stripes')

# -----------------------------------------------------------------------------
# 5. Articulated Legs & Claws (with Hinged Front Right Leg for Screen Swipe)
# -----------------------------------------------------------------------------
print("6. Building Legs & Claws (Separating Front Right Leg for Screen Swiping)...")
leg_files = [f for f in os.listdir(RAW_DIR) if any(part in f for part in ['coxa', 'femur', 'tibia', 'tarsus', 'claw'])]
front_r_files = [f for f in leg_files if 'T1' in f and 'right' in f]
other_leg_files = [f for f in leg_files if f not in front_r_files]

# 5a. Base 5 legs
other_meshes = [trimesh.load(os.path.join(RAW_DIR, f)) for f in other_leg_files]
other_legs = trimesh.util.concatenate(other_meshes)
other_legs.vertices = to_three(other_legs.vertices)
_ = other_legs.vertex_normals
scene.add_geometry(other_legs, node_name='legs', geom_name='geom_legs')

# 5b. Front Right Leg (centered at thorax coxa joint for screen swipe gesture)
coxa_r = trimesh.load(os.path.join(RAW_DIR, 'coxa_T1_right_body.obj'))
idx_top_z = coxa_r.vertices[:, 2].argmax()
J_T1_R = coxa_r.vertices[idx_top_z]

J_3 = to_three(J_T1_R.reshape(1, 3))[0]
T_leg = np.eye(4)
T_leg[:3, 3] = J_3

front_r_meshes = [trimesh.load(os.path.join(RAW_DIR, f)) for f in front_r_files]
front_r_leg = trimesh.util.concatenate(front_r_meshes)
front_r_leg.vertices = to_three(front_r_leg.vertices - J_T1_R)
_ = front_r_leg.vertex_normals
scene.add_geometry(front_r_leg, node_name='front_leg_right', geom_name='geom_front_leg_right', transform=T_leg)

# -----------------------------------------------------------------------------
# 6. Halteres (Balancing Organs)
# -----------------------------------------------------------------------------
print("7. Building Halteres...")
h_meshes = [
    trimesh.load(os.path.join(RAW_DIR, 'haltere_left_body.obj')),
    trimesh.load(os.path.join(RAW_DIR, 'haltere_right_body.obj'))
]
halteres = trimesh.util.concatenate(h_meshes)
halteres.vertices = to_three(halteres.vertices)
_ = halteres.vertex_normals
scene.add_geometry(halteres, node_name='halteres', geom_name='geom_halteres')

# -----------------------------------------------------------------------------
# 7. Separately Hinged Wings (Membrane & Veins)
# -----------------------------------------------------------------------------
print("8. Building Hinged Left & Right Wings in Rest Pose...")

H_L = np.array([0.012, -0.387, 1.327])
H_R = np.array([0.012,  0.387, 1.327])

H_L_3 = np.array([-H_L[1]*SCALE, H_L[2]*SCALE, H_L[0]*SCALE])
H_R_3 = np.array([-H_R[1]*SCALE, H_R[2]*SCALE, H_R[0]*SCALE])

theta_L = np.radians(-75)
T_L = np.eye(4)
T_L[0, 0] = np.cos(theta_L); T_L[0, 2] = np.sin(theta_L)
T_L[2, 0] = -np.sin(theta_L); T_L[2, 2] = np.cos(theta_L)
T_L[:3, 3] = H_L_3

theta_R = np.radians(75)
T_R = np.eye(4)
T_R[0, 0] = np.cos(theta_R); T_R[0, 2] = np.sin(theta_R)
T_R[2, 0] = -np.sin(theta_R); T_R[2, 2] = np.cos(theta_R)
T_R[:3, 3] = H_R_3

# Left Wing
wlm = trimesh.load(os.path.join(RAW_DIR, 'wing_left_membrane.obj'))
wlm.vertices = to_three(wlm.vertices - H_L)
_ = wlm.vertex_normals
scene.add_geometry(wlm, node_name='wing_left_membrane', geom_name='geom_wlm', transform=T_L)

wlb = trimesh.load(os.path.join(RAW_DIR, 'wing_left_brown.obj'))
wlb.vertices = to_three(wlb.vertices - H_L)
_ = wlb.vertex_normals
scene.add_geometry(wlb, node_name='wing_left_veins', geom_name='geom_wlb', transform=T_L)

# Right Wing
wrm = trimesh.load(os.path.join(RAW_DIR, 'wing_right_membrane.obj'))
wrm.vertices = to_three(wrm.vertices - H_R)
_ = wrm.vertex_normals
scene.add_geometry(wrm, node_name='wing_right_membrane', geom_name='geom_wrm', transform=T_R)

wrb = trimesh.load(os.path.join(RAW_DIR, 'wing_right_brown.obj'))
wrb.vertices = to_three(wrb.vertices - H_R)
_ = wrb.vertex_normals
scene.add_geometry(wrb, node_name='wing_right_veins', geom_name='geom_wrb', transform=T_R)

# -----------------------------------------------------------------------------
# 8. Export GLB
# -----------------------------------------------------------------------------
print("9. Exporting realistic_fly.glb...")
glb_data = scene.export(file_type='glb')
with open(OUTPUT_GLB, 'wb') as f:
    f.write(glb_data)

print(f"SUCCESS: Exported {OUTPUT_GLB} ({len(glb_data)/(1024*1024):.2f} MB)")
