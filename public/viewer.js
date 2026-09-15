/**
 * FlyBrain 3D Explorer - Three.js Scene, Fly Simulation & Neural Activity Controller
 */

// Global State
const state = {
  posts: [],
  currentPostIndex: 0,
  autoScroll: true,
  autoScrollInterval: null,
  isXrayMode: false,
  soundEnabled: false,
  isCinematic: false,
  
  // Real-time neural metrics
  currentDopamineHz: 89.3,
  targetDopamineHz: 89.3,
  currentSpikes: 63207,
  targetSpikes: 63207,
  viralityScore: 88.4,
  currentReaction: "🔥",
  
  // Audio
  audioCtx: null
};

// Three.js Core Objects
let scene, camera, renderer, controls;
let flyGroup, phoneGroup, brainGroup;
let flyParts = {};
let phoneScreenCanvas, phoneScreenCtx, phoneScreenTexture;
let clock = new THREE.Clock();

// =============================================================================
// Initialization
// =============================================================================
window.addEventListener("DOMContentLoaded", () => {
  initThree();
  initOscilloscope();
  initTelegramFeed();
  initUIListeners();
  initDragAndDrop();
  animate();
});

// =============================================================================
// Three.js Setup
// =============================================================================
function initThree() {
  const container = document.getElementById("canvas-container");
  const width = container.clientWidth || window.innerWidth;
  const height = container.clientHeight || window.innerHeight;

  // Scene
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x070a10);
  scene.fog = new THREE.FogExp2(0x070a10, 0.035);

  // Camera
  camera = new THREE.PerspectiveCamera(42, width / height, 0.1, 1000);
  camera.position.set(0, 5, 12);

  // Renderer
  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: "high-performance" });
  renderer.setSize(width, height);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.1;
  container.appendChild(renderer.domElement);

  // Controls
  controls = new THREE.OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.05;
  controls.maxPolarAngle = Math.PI / 2 - 0.02; // don't go below table
  controls.minDistance = 3;
  controls.maxDistance = 25;
  controls.target.set(0, 1.2, 0);

  // Lighting - Balanced Studio Lighting for Rich Drosophila Contrast
  const ambientLight = new THREE.AmbientLight(0xffeedd, 0.65);
  scene.add(ambientLight);

  const keyLight = new THREE.DirectionalLight(0xffffff, 1.25);
  keyLight.position.set(5, 12, 7);
  keyLight.castShadow = true;
  keyLight.shadow.mapSize.width = 1024;
  keyLight.shadow.mapSize.height = 1024;
  keyLight.shadow.bias = -0.0005;
  scene.add(keyLight);

  // Dedicated Fly Studio Fill Light
  const flyFillLight = new THREE.DirectionalLight(0xffecd0, 0.7);
  flyFillLight.position.set(-2, 7, 7);
  scene.add(flyFillLight);

  // Cyan rim / accent light from phone side
  const rimLight = new THREE.PointLight(0x00f0ff, 1.5, 20);
  rimLight.position.set(-6, 4, -4);
  scene.add(rimLight);

  // Warm lab fill light
  const fillLight = new THREE.PointLight(0xffb060, 0.8, 16);
  fillLight.position.set(4, 2, 5);
  scene.add(fillLight);

  // Environment: Laboratory Table
  buildLabEnvironment();

  // Create Smartphone Model
  buildPhoneModel();

  // Create Free-Standing Drosophila Fly Model
  buildFlyModel();

  // Load Real FlyWire Brain & Neurons in Head
  loadFlyWireBrain();

  // Window Resize
  window.addEventListener("resize", onWindowResize);
}

function onWindowResize() {
  const container = document.getElementById("canvas-container");
  const width = container.clientWidth || window.innerWidth;
  const height = container.clientHeight || window.innerHeight;
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
  renderer.setSize(width, height);
}

// =============================================================================
// Environment (Lab Bench / Table)
// =============================================================================
function buildLabEnvironment() {
  // Table Top
  const tableGeo = new THREE.BoxGeometry(20, 0.4, 16);
  const tableMat = new THREE.MeshStandardMaterial({
    color: 0x121722,
    roughness: 0.35,
    metalness: 0.15
  });
  const table = new THREE.Mesh(tableGeo, tableMat);
  table.position.y = -0.2;
  table.receiveShadow = true;
  scene.add(table);

  // Subtle lab grid on table
  const grid = new THREE.GridHelper(18, 36, 0x00f0ff, 0x1c2436);
  grid.position.y = 0.01;
  scene.add(grid);

  // Soft glow pedestal under the fly
  const padGeo = new THREE.CylinderGeometry(2.2, 2.2, 0.03, 32);
  const padMat = new THREE.MeshStandardMaterial({
    color: 0x0e1420,
    roughness: 0.6,
    metalness: 0.2
  });
  const pad = new THREE.Mesh(padGeo, padMat);
  pad.position.set(0, 0.02, 1.2);
  pad.receiveShadow = true;
  scene.add(pad);
}

// =============================================================================
// 3D Smartphone Model & Dynamic Screen Canvas
// =============================================================================
// =============================================================================
// 3D Smartphone Model & Dynamic Screen Canvas
// =============================================================================
let channelAvatarImg = new Image();
channelAvatarImg.src = "assets/channel_avatar.jpg";
channelAvatarImg.onload = () => {
  if (phoneScreenTexture) phoneScreenTexture.needsUpdate = true;
};

function buildPhoneModel() {
  phoneGroup = new THREE.Group();
  phoneGroup.position.set(0, 1.62, -1.95);
  phoneGroup.rotation.x = -0.14; // slightly tilted back on stand

  // Phone Body (Enlarged by ~25% as requested)
  const bodyGeo = new THREE.BoxGeometry(2.7, 4.65, 0.14);
  const bodyMat = new THREE.MeshStandardMaterial({
    color: 0x1a2130,
    metalness: 0.8,
    roughness: 0.25
  });
  const body = new THREE.Mesh(bodyGeo, bodyMat);
  body.castShadow = true;
  phoneGroup.add(body);

  // Metallic Edge Bezel
  const bezelGeo = new THREE.BoxGeometry(2.76, 4.71, 0.12);
  const bezelMat = new THREE.MeshStandardMaterial({
    color: 0x2e3b52,
    metalness: 0.9,
    roughness: 0.2
  });
  const bezel = new THREE.Mesh(bezelGeo, bezelMat);
  phoneGroup.add(bezel);

  // Screen Canvas for Dynamic Texture (Higher resolution 640x1100)
  phoneScreenCanvas = document.createElement("canvas");
  phoneScreenCanvas.width = 640;
  phoneScreenCanvas.height = 1100;
  phoneScreenCtx = phoneScreenCanvas.getContext("2d");

  // Initial draw on phone screen
  drawPhoneScreenPlaceholder();

  phoneScreenTexture = new THREE.CanvasTexture(phoneScreenCanvas);
  phoneScreenTexture.minFilter = THREE.LinearFilter;
  phoneScreenTexture.magFilter = THREE.LinearFilter;

  const screenGeo = new THREE.PlaneGeometry(2.58, 4.52);
  const screenMat = new THREE.MeshBasicMaterial({
    map: phoneScreenTexture
  });
  const screen = new THREE.Mesh(screenGeo, screenMat);
  screen.position.z = 0.075;
  phoneGroup.add(screen);

  // Phone Stand Base
  const standGeo = new THREE.BoxGeometry(1.9, 0.08, 1.3);
  const standMat = new THREE.MeshStandardMaterial({ color: 0x0f1520, metalness: 0.7, roughness: 0.3 });
  const stand = new THREE.Mesh(standGeo, standMat);
  stand.position.set(0, -1.62, 0.2);
  stand.rotation.x = 0.14;
  phoneGroup.add(stand);

  scene.add(phoneGroup);
}

function drawPhoneScreenPlaceholder() {
  const ctx = phoneScreenCtx;
  const w = 640;
  const h = 1100;

  // Background
  ctx.fillStyle = "#0e1626";
  ctx.fillRect(0, 0, w, h);

  // Telegram Header
  ctx.fillStyle = "#172136";
  ctx.fillRect(0, 0, w, 90);

  // Channel Title
  ctx.fillStyle = "#ffffff";
  ctx.font = "bold 26px 'Outfit', sans-serif";
  ctx.fillText("Fluffy tail", 100, 52);

  ctx.fillStyle = "#64b5f6";
  ctx.font = "15px 'JetBrains Mono', monospace";
  ctx.fillText("@fluffy_tail_group", 100, 78);

  // Avatar placeholder
  ctx.fillStyle = "#ff5400";
  ctx.beginPath();
  ctx.arc(52, 50, 30, 0, Math.PI * 2);
  ctx.fill();

  // Placeholder Post Box
  ctx.fillStyle = "#1e293b";
  ctx.fillRect(20, 110, w - 40, 720);

  ctx.fillStyle = "#8b9bb4";
  ctx.font = "22px 'Outfit', sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("Загрузка публикаций...", w / 2, 450);
  ctx.textAlign = "left";

  if (phoneScreenTexture) phoneScreenTexture.needsUpdate = true;
}

function updatePhoneScreen(post, reactionEmoji) {
  const ctx = phoneScreenCtx;
  const w = 640;
  const h = 1100;

  // Background
  ctx.fillStyle = "#0c1322";
  ctx.fillRect(0, 0, w, h);

  // Top Status Bar (time & battery)
  ctx.fillStyle = "#ffffff";
  ctx.font = "16px monospace";
  ctx.fillText("15:20", 28, 26);
  ctx.fillText("98% 🔋", w - 90, 26);

  // Telegram Header
  ctx.fillStyle = "#152033";
  ctx.fillRect(0, 38, w, 82);

  // Draw Real Channel Avatar
  if (channelAvatarImg && channelAvatarImg.complete && channelAvatarImg.naturalWidth > 0) {
    ctx.save();
    ctx.beginPath();
    ctx.arc(55, 79, 28, 0, Math.PI * 2);
    ctx.clip();
    ctx.drawImage(channelAvatarImg, 27, 51, 56, 56);
    ctx.restore();
    ctx.strokeStyle = "rgba(255, 255, 255, 0.25)";
    ctx.lineWidth = 2;
    ctx.stroke();
  } else {
    const grad = ctx.createLinearGradient(27, 51, 83, 107);
    grad.addColorStop(0, "#ff5400");
    grad.addColorStop(1, "#ff007f");
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(55, 79, 28, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 20px sans-serif";
    ctx.fillText("FT", 42, 86);
  }

  // Channel Title
  ctx.fillStyle = "#ffffff";
  ctx.font = "bold 24px 'Outfit', sans-serif";
  ctx.fillText("Fluffy tail", 96, 70);

  // Real subscriber count (6 582)
  const subsCount = state.memberCount ? state.memberCount.toLocaleString("ru-RU") : "6 582";
  ctx.fillStyle = "#4cc9f0";
  ctx.font = "14px 'JetBrains Mono', monospace";
  ctx.fillText(`@fluffy_tail_group • ${subsCount} подписчиков`, 96, 96);

  // Post Card Box
  const cardY = 132;
  const cardH = 880;
  ctx.fillStyle = "#141c2c";
  if (ctx.roundRect) {
    ctx.beginPath();
    ctx.roundRect(16, cardY, w - 32, cardH, 16);
    ctx.fill();
  } else {
    ctx.fillRect(16, cardY, w - 32, cardH);
  }

  // Load and Draw Image
  if (post && post.photo) {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      ctx.save();
      // Rounded image clipping
      ctx.beginPath();
      const targetW = w - 44;
      const targetH = 680;
      if (ctx.roundRect) {
        ctx.roundRect(22, cardY + 12, targetW, targetH, 14);
      } else {
        ctx.rect(22, cardY + 12, targetW, targetH);
      }
      ctx.clip();

      const imgAspect = img.width / img.height;
      let drawW = targetW;
      let drawH = targetW / imgAspect;
      if (drawH < targetH) {
        drawH = targetH;
        drawW = targetH * imgAspect;
      }
      const offsetX = 22 + (targetW - drawW) / 2;
      const offsetY = cardY + 12 + (targetH - drawH) / 2;
      ctx.drawImage(img, offsetX, offsetY, drawW, drawH);
      ctx.restore();

      // Post Caption Text
      ctx.fillStyle = "#e2e8f0";
      ctx.font = "18px 'Outfit', sans-serif";
      const caption = post.text || post.title || "Fluffy tail media";
      ctx.fillText(caption.slice(0, 50), 26, cardY + 725);

      // Views and Time
      ctx.fillStyle = "#64748b";
      ctx.font = "14px 'JetBrains Mono', monospace";
      ctx.fillText("👁 4.8K • Telegram Channel", 26, cardY + 755);

      // Reaction Bubble on phone
      if (reactionEmoji) {
        ctx.fillStyle = "rgba(10, 15, 26, 0.94)";
        ctx.beginPath();
        if (ctx.roundRect) {
          ctx.roundRect(w - 125, cardY + 610, 90, 56, 28);
        } else {
          ctx.rect(w - 125, cardY + 610, 90, 56);
        }
        ctx.fill();
        ctx.strokeStyle = "rgba(255, 255, 255, 0.4)";
        ctx.lineWidth = 2;
        ctx.stroke();

        ctx.font = "34px sans-serif";
        ctx.fillText(reactionEmoji, w - 108, cardY + 650);
      }

      phoneScreenTexture.needsUpdate = true;
    };
    img.onerror = () => {
      console.warn("Image load error for", post.photo);
      phoneScreenTexture.needsUpdate = true;
    };
    img.src = post.photo;
  }
}

// =============================================================================
// Free-Standing 3D Drosophila Fly Model
// =============================================================================
function buildFlyModel() {
  flyGroup = new THREE.Group();
  // Place fly directly on desk surface (legs touch at Y=0), facing phone at -Z
  flyGroup.position.set(0, 0.085, 0.95);
  flyGroup.rotation.set(0, 0, 0);
  scene.add(flyGroup);

  // Micro-ommatidia bump texture for authentic faceted eye sheen
  const ommatidiaCanvas = document.createElement("canvas");
  ommatidiaCanvas.width = 64;
  ommatidiaCanvas.height = 64;
  const oCtx = ommatidiaCanvas.getContext("2d");
  oCtx.fillStyle = "#808080";
  oCtx.fillRect(0, 0, 64, 64);
  oCtx.fillStyle = "#ffffff";
  for (let y = 0; y < 64; y += 8) {
    for (let x = 0; x < 64; x += 8) {
      const offX = (y % 16 === 0) ? 0 : 4;
      oCtx.beginPath();
      oCtx.arc(x + offX, y, 2.8, 0, Math.PI * 2);
      oCtx.fill();
    }
  }
  const ommatidiaBump = new THREE.CanvasTexture(ommatidiaCanvas);
  ommatidiaBump.wrapS = THREE.RepeatWrapping;
  ommatidiaBump.wrapT = THREE.RepeatWrapping;
  ommatidiaBump.repeat.set(12, 12);

  const loader = new THREE.GLTFLoader();
  loader.load(
    "assets/realistic_fly.glb",
    (gltf) => {
      const flyMesh = gltf.scene;
      
      flyMesh.traverse((child) => {
        if (child.isMesh) {
          child.castShadow = true;
          child.receiveShadow = true;

          // Recompute smooth vertex normals so all faces receive full lighting!
          if (child.geometry) {
            child.geometry.computeVertexNormals();
          }

          const n = child.name.toLowerCase();
          if (n.includes("eyes")) {
            // Authentic deep matte ruby-red Drosophila compound eyes
            child.material = new THREE.MeshStandardMaterial({
              color: 0xaa0e26, // Deep vibrant ruby red
              roughness: 0.65, // Matte surface
              metalness: 0.04,
              emissive: 0x220005, // Subtle inner ruby glow
              emissiveIntensity: 0.25,
              transparent: false,
              opacity: 1.0,
              side: THREE.DoubleSide // 100% solid, never see-through
            });
            flyParts.eyes = child;
          } else if (n.includes("bristle")) {
            // Dark charcoal-black sensory macrochaetae spines
            child.material = new THREE.MeshStandardMaterial({
              color: 0x0c0d10,
              roughness: 0.4,
              metalness: 0.35,
              side: THREE.DoubleSide
            });
            flyParts.bristles = child;
          } else if (n.includes("stripe")) {
            // Dark black segmented chitin stripes on abdomen
            child.material = new THREE.MeshStandardMaterial({
              color: 0x141518, // Deep black chitin bands
              roughness: 0.44,
              metalness: 0.15,
              side: THREE.DoubleSide
            });
            flyParts.abdomenStripes = child;
          } else if (n.includes("abdomen") || n.includes("amber")) {
            // Dark gray segmented abdomen base
            child.material = new THREE.MeshStandardMaterial({
              color: 0x3d414a, // Sleek dark gray cuticle
              roughness: 0.52,
              metalness: 0.10,
              side: THREE.DoubleSide
            });
            flyParts.abdomenAmber = child;
            flyParts.abdomen = child;
          } else if (n.includes("body")) {
            // Sleek dark gray / graphite Drosophila head capsule & thoracic scutum
            child.material = new THREE.MeshStandardMaterial({
              color: 0x353842, // Rich dark gray chitin
              roughness: 0.48,
              metalness: 0.14,
              side: THREE.DoubleSide
            });
            flyParts.body = child;
          } else if (n.includes("leg")) {
            // Dark gray articulated legs
            child.material = new THREE.MeshStandardMaterial({
              color: 0x2e313a, // Dark slate-gray legs
              roughness: 0.55,
              metalness: 0.12,
              side: THREE.DoubleSide
            });
            if (n.includes("front_leg_right")) {
              flyParts.frontLegR = child;
            } else {
              flyParts.legs = child;
            }
          } else if (n.includes("halteres")) {
            // Muted dark-slate balancing organs
            child.material = new THREE.MeshStandardMaterial({
              color: 0x686c75,
              roughness: 0.45,
              metalness: 0.05,
              side: THREE.DoubleSide
            });
            flyParts.halteres = child;
          } else if (n.includes("membrane")) {
            // Clean, delicate translucent wing membrane
            child.material = new THREE.MeshPhysicalMaterial({
              color: 0xe6f0f0,
              transmission: 0.85,
              opacity: 0.65,
              transparent: true,
              roughness: 0.12,
              ior: 1.48,
              reflectivity: 0.55,
              side: THREE.DoubleSide
            });
          } else if (n.includes("vein")) {
            // Dark chitin wing veins
            child.material = new THREE.MeshStandardMaterial({
              color: 0x3a3836,
              roughness: 0.42,
              metalness: 0.18,
              side: THREE.DoubleSide
            });
          }
        }
      });

      // Wing nodes for flapping / buzzing animation
      flyParts.wingLMem = flyMesh.getObjectByName("wing_left_membrane");
      flyParts.wingLVein = flyMesh.getObjectByName("wing_left_veins");
      flyParts.wingRMem = flyMesh.getObjectByName("wing_right_membrane");
      flyParts.wingRVein = flyMesh.getObjectByName("wing_right_veins");
      
      // Articulated front right leg for natural screen swipe gesture
      flyParts.frontLegR = flyMesh.getObjectByName("front_leg_right") || flyParts.frontLegR;

      // Store reference to head/body for animation checks
      flyParts.head = flyParts.body || flyMesh;

      flyGroup.add(flyMesh);
      console.log("Realistic anatomical Drosophila model loaded successfully!");
    },
    undefined,
    (err) => {
      console.error("Error loading realistic_fly.glb:", err);
    }
  );
}

// =============================================================================
// Real FlyWire Brain & Neurons (Inside Head / X-Ray Mode)
// =============================================================================
function loadFlyWireBrain() {
  brainGroup = new THREE.Group();
  brainGroup.position.set(0, 1.12, -0.85); // anatomically aligned inside realistic head
  brainGroup.scale.set(0.075, 0.075, 0.075);
  brainGroup.visible = false; // toggled on in X-ray mode

  const loader = new THREE.GLTFLoader();

  // Load Brain Shell
  loader.load("assets/fly_brain.glb", (gltf) => {
    const brainMesh = gltf.scene;
    brainMesh.traverse((child) => {
      if (child.isMesh) {
        child.material = new THREE.MeshPhysicalMaterial({
          color: 0x00d4ff,
          transmission: 0.88,
          opacity: 0.65,
          transparent: true,
          roughness: 0.25,
          wireframe: false,
          emissive: 0x004488,
          emissiveIntensity: 0.3
        });
      }
    });
    brainGroup.add(brainMesh);
  });

  // Load Key Neuropils (Optic, Antennal, Mushroom body)
  fetch("assets/neuropils.json")
    .then((r) => r.json())
    .then((neuropils) => {
      neuropils.forEach((np) => {
        loader.load(np.file, (gltf) => {
          const m = gltf.scene;
          m.traverse((c) => {
            if (c.isMesh) {
              c.material = new THREE.MeshStandardMaterial({
                color: new THREE.Color(np.color),
                transparent: true,
                opacity: 0.75,
                roughness: 0.3,
                emissive: new THREE.Color(np.color),
                emissiveIntensity: 0.5
              });
            }
          });
          brainGroup.add(m);
        });
      });
    })
    .catch((e) => console.warn("Neuropils load notice:", e));

  // Load PAM06 Dopamine Neuron skeleton (real FlyWire branch coordinates!)
  fetch("assets/neuron_720575940608166748.json")
    .then((r) => r.json())
    .then((nData) => {
      const linePositions = [];
      nData.segments.forEach(([p1, p2]) => {
        linePositions.push(p1[0], p1[1], p1[2]);
        linePositions.push(p2[0], p2[1], p2[2]);
      });

      const lineGeo = new THREE.BufferGeometry();
      lineGeo.setAttribute("position", new THREE.Float32BufferAttribute(linePositions, 3));
      const lineMat = new THREE.LineBasicMaterial({
        color: 0x00ff88,
        linewidth: 2,
        transparent: true,
        opacity: 0.95
      });
      const neuronLines = new THREE.LineSegments(lineGeo, lineMat);
      brainGroup.add(neuronLines);

      // Soma sphere
      if (nData.soma) {
        const somaGeo = new THREE.SphereGeometry(0.12, 12, 12);
        const somaMat = new THREE.MeshBasicMaterial({ color: 0xa7f307 });
        const soma = new THREE.Mesh(somaGeo, somaMat);
        soma.position.set(nData.soma[0], nData.soma[1], nData.soma[2]);
        brainGroup.add(soma);
      }
    })
    .catch((e) => console.warn("Neuron load notice:", e));

  flyGroup.add(brainGroup);
}

// Toggle X-Ray Mode
function toggleXrayMode() {
  state.isXrayMode = !state.isXrayMode;
  document.getElementById("xray-status").textContent = state.isXrayMode ? "ВКЛ" : "ВЫКЛ";
  document.getElementById("btn-xray").classList.toggle("btn-accent", state.isXrayMode);

  if (brainGroup) {
    brainGroup.visible = state.isXrayMode;
  }

  // Adjust fly body opacity
  const flyOpacity = state.isXrayMode ? 0.22 : 1.0;
  flyGroup.traverse((child) => {
    if (child.isMesh && child.parent !== brainGroup) {
      if (child.material) {
        const isMembrane = child.name && child.name.toLowerCase().includes("membrane");
        if (state.isXrayMode) {
          child.material.transparent = true;
          child.material.opacity = 0.22;
        } else {
          child.material.transparent = isMembrane;
          child.material.opacity = isMembrane ? 0.72 : 1.0;
        }
      }
    }
  });

  const statusText = document.getElementById("fly-status-text");
  statusText.textContent = state.isXrayMode 
    ? "X-Ray: Визуализация FlyWire PAM11 дофаминовых цепей" 
    : "Изучает экран (внимание)";
}

// =============================================================================
// Telegram Feed & Post Sync
// =============================================================================
function initTelegramFeed() {
  fetchPosts();
}

function fetchPosts() {
  fetch("/api/posts")
    .then((r) => r.json())
    .then((data) => {
      if (data.posts && data.posts.length > 0) {
        if (data.member_count) {
          state.memberCount = data.member_count;
        }
        // Only keep posts with valid photos, filter out text commands like /start
        const validPosts = data.posts.filter((p) => p.photo && !p.text?.startsWith("/start"));
        state.posts = validPosts.length > 0 ? validPosts : data.posts;
        document.getElementById("nav-channel-name").textContent = data.channel || "@fluffy_tail_group";
        document.getElementById("post-channel-label").textContent = data.channel || "@fluffy_tail_group";
        showPost(0);
      }
    })
    .catch((err) => console.error("Error fetching posts:", err));
}

function showPost(index) {
  if (state.posts.length === 0) return;
  if (index < 0) index = state.posts.length - 1;
  if (index >= state.posts.length) index = 0;
  state.currentPostIndex = index;

  const post = state.posts[index];
  document.getElementById("posts-counter").textContent = `${index + 1} / ${state.posts.length}`;
  
  const thumb = document.getElementById("post-thumbnail");
  if (post.photo) {
    thumb.src = post.photo;
    thumb.style.display = "block";
  } else {
    thumb.style.display = "none";
  }

  document.getElementById("post-text-label").textContent = post.text || post.title || "Fluffy tail media post";

  // Trigger fly attention and articulated front leg screen swipe
  flyTriggerAttention();
  triggerLegSwipe();

  // Draw on 3D phone screen immediately
  updatePhoneScreen(post, null);

  // Run fly vision & virality analysis
  analyzeCurrentPost(post);
}

function analyzeCurrentPost(post) {
  if (!post.photo) return;

  fetch("/api/analyze", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      photo: post.photo,
      message_id: post.message_id
    })
  })
    .then((r) => r.json())
    .then((res) => {
      if (res.analysis) {
        applyAnalysisResults(res.analysis, post);
      }
    })
    .catch((err) => console.error("Analysis error:", err));
}

function applyAnalysisResults(analysis, post) {
  state.targetDopamineHz = analysis.dopamine_hz;
  state.targetSpikes = analysis.fly_spikes;
  state.viralityScore = analysis.virality_score;
  state.currentReaction = analysis.reaction;

  // Update UI Sidebar
  document.getElementById("verdict-reaction-emoji").textContent = analysis.reaction;
  document.getElementById("reaction-badge-fly").textContent = analysis.reaction;
  document.getElementById("verdict-text").textContent = analysis.verdict;
  document.getElementById("verdict-reasoning").textContent = analysis.reasoning;

  if (analysis.metrics) {
    document.getElementById("metric-contrast").textContent = `${analysis.metrics.contrast}%`;
    document.getElementById("metric-saturation").textContent = `${analysis.metrics.saturation}%`;
    document.getElementById("metric-edges").textContent = `${analysis.metrics.edge_density}%`;
    document.getElementById("metric-warmth").textContent = `${analysis.metrics.warmth}%`;
  }

  // Update Virality Bar
  document.getElementById("val-virality-pct").textContent = `${analysis.virality_score}%`;
  document.getElementById("virality-bar-fill").style.width = `${analysis.virality_score}%`;

  // Update Phone Screen with post and reaction bubble
  updatePhoneScreen(post, analysis.reaction);

  // Play audio clicks if enabled
  if (state.soundEnabled) {
    playSpikeBurst(analysis.dopamine_hz);
  }

  // Fly Behavior reaction animation
  if (analysis.virality_score >= 75) {
    flyTriggerExcitement();
  }
}

// =============================================================================
// Fly Micro-Animations & Behaviors
// =============================================================================
let flyExcitementTimer = 0;
let flyTapTimer = 0;
let isFlipping = false;
let flipProgress = 0.0;
const FLIP_DURATION = 1.05;

// Articulated Front Right Leg Swiping Gesture
let isLegSwiping = false;
let legSwipeProgress = 0.0;
const LEG_SWIPE_DURATION = 0.62;
let swipeAudioPlayed = false;
let phoneBounce = 0.0;

function triggerLegSwipe() {
  if (isFlipping) return;
  isLegSwiping = true;
  legSwipeProgress = 0.0;
  swipeAudioPlayed = false;

  const status = document.getElementById("fly-status-text");
  if (status) {
    status.textContent = "📱 СВАЙП: Муха листает экран передней лапкой";
    setTimeout(() => {
      if (status && !isFlipping && !isLegSwiping) status.textContent = "Изучает экран (внимание)";
    }, 2200);
  }
}

function playSwipeAudio() {
  if (!state.soundEnabled) return;
  initAudio();
  if (!state.audioCtx) return;
  try {
    const ctx = state.audioCtx;
    const now = ctx.currentTime;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const filter = ctx.createBiquadFilter();

    osc.type = "sine";
    osc.frequency.setValueAtTime(310, now);
    osc.frequency.exponentialRampToValueAtTime(75, now + 0.14);

    filter.type = "lowpass";
    filter.frequency.setValueAtTime(950, now);
    filter.frequency.exponentialRampToValueAtTime(180, now + 0.14);

    gain.gain.setValueAtTime(0.12, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.14);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 0.15);
  } catch (e) {}
}

function flyTriggerAttention() {
  flyTapTimer = 1.0;
}

function flyTriggerExcitement() {
  flyExcitementTimer = 2.0;
  const status = document.getElementById("fly-status-text");
  status.textContent = "🔥 ВСПЛЕСК ДОФАМИНА: Муха ставит реакцию!";
  setTimeout(() => {
    if (status) status.textContent = "Изучает экран (внимание)";
  }, 3000);
}

function performFlyFlip() {
  if (isFlipping) return;
  isFlipping = true;
  flipProgress = 0.0;

  playFlyBuzz();

  state.targetDopamineHz = Math.min(125, state.targetDopamineHz + 18.0);
  state.targetSpikes += 5200;

  const status = document.getElementById("fly-status-text");
  if (status) {
    status.textContent = "🤸 МУХА ДЕЛАЕТ САЛЬТО В ВОЗДУХЕ (+18 Hz)!";
    setTimeout(() => {
      if (status) status.textContent = "Изучает экран (внимание)";
    }, 2800);
  }
}

function playFlyBuzz() {
  initAudio();
  if (!state.audioCtx) return;
  try {
    const osc = state.audioCtx.createOscillator();
    const gain = state.audioCtx.createGain();
    osc.type = "sawtooth";
    osc.frequency.setValueAtTime(180, state.audioCtx.currentTime);
    osc.frequency.linearRampToValueAtTime(380, state.audioCtx.currentTime + 0.4);
    osc.frequency.linearRampToValueAtTime(190, state.audioCtx.currentTime + 0.95);

    gain.gain.setValueAtTime(0.09, state.audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, state.audioCtx.currentTime + 0.95);

    osc.connect(gain);
    gain.connect(state.audioCtx.destination);
    osc.start();
    osc.stop(state.audioCtx.currentTime + 0.95);
  } catch (e) {}
}

function updateFlyAnimation(delta, time) {
  if (!flyParts.head && !flyParts.body) return;

  const baseWingRotL = -1.309;
  const baseWingRotR = 1.309;

  // Salto / Somersault Flip Animation
  if (isFlipping) {
    flipProgress += delta / FLIP_DURATION;
    if (flipProgress >= 1.0) {
      flipProgress = 1.0;
      isFlipping = false;
      flyGroup.position.set(0, 0.085, 0.95);
      flyGroup.rotation.set(0, 0, 0);
      // Reset wings to resting fold
      if (flyParts.wingLMem) flyParts.wingLMem.rotation.y = baseWingRotL;
      if (flyParts.wingLVein) flyParts.wingLVein.rotation.y = baseWingRotL;
      if (flyParts.wingRMem) flyParts.wingRMem.rotation.y = baseWingRotR;
      if (flyParts.wingRVein) flyParts.wingRVein.rotation.y = baseWingRotR;
    } else {
      // Parabolic jump up to Y=2.3
      const jumpY = 0.085 + Math.sin(flipProgress * Math.PI) * 2.2;
      flyGroup.position.y = jumpY;
      // Complete 360 forward somersault flip
      flyGroup.rotation.x = -flipProgress * Math.PI * 2;

      // High-frequency wing fluttering in flight stance
      const flightL = -0.25 + Math.sin(time * 65.0) * 0.45;
      const flightR = 0.25 - Math.sin(time * 65.0) * 0.45;
      if (flyParts.wingLMem) flyParts.wingLMem.rotation.y = flightL;
      if (flyParts.wingLVein) flyParts.wingLVein.rotation.y = flightL;
      if (flyParts.wingRMem) flyParts.wingRMem.rotation.y = flightR;
      if (flyParts.wingRVein) flyParts.wingRVein.rotation.y = flightR;
      return; // skip idle animation during flip
    }
  }

  // 1. Abdomen Breathing (pulsing segmented tergites and stripes)
  const breath = 1.0 + Math.sin(time * 3.5) * 0.025;
  if (flyParts.abdomenAmber) {
    flyParts.abdomenAmber.scale.set(1.0, breath, breath);
  }
  if (flyParts.abdomenStripes) {
    flyParts.abdomenStripes.scale.set(1.0, breath, breath);
  }

  // 2. Wings resting / fluttering on dopamine excitement
  if (flyExcitementTimer > 0) {
    flyExcitementTimer -= delta;
    const flutter = Math.sin(time * 50.0) * 0.22;
    if (flyParts.wingLMem) flyParts.wingLMem.rotation.y = baseWingRotL + flutter;
    if (flyParts.wingLVein) flyParts.wingLVein.rotation.y = baseWingRotL + flutter;
    if (flyParts.wingRMem) flyParts.wingRMem.rotation.y = baseWingRotR - flutter;
    if (flyParts.wingRVein) flyParts.wingRVein.rotation.y = baseWingRotR - flutter;
  } else {
    const microBreath = Math.sin(time * 2.5) * 0.015;
    if (flyParts.wingLMem) flyParts.wingLMem.rotation.y = baseWingRotL + microBreath;
    if (flyParts.wingLVein) flyParts.wingLVein.rotation.y = baseWingRotL + microBreath;
    if (flyParts.wingRMem) flyParts.wingRMem.rotation.y = baseWingRotR - microBreath;
    if (flyParts.wingRVein) flyParts.wingRVein.rotation.y = baseWingRotR - microBreath;
  }

  // 3. Subtle Exoskeleton Posture Shift
  if (flyParts.body) {
    const bodyBob = Math.sin(time * 2.0) * 0.008;
    flyParts.body.rotation.x = bodyBob;
  }

  // 4. Articulated Front Right Leg Swipe Gesture & Idle Grooming
  if (flyParts.frontLegR) {
    if (isLegSwiping) {
      legSwipeProgress += delta / LEG_SWIPE_DURATION;
      if (legSwipeProgress >= 1.0) {
        legSwipeProgress = 1.0;
        isLegSwiping = false;
        flyParts.frontLegR.rotation.set(0, 0, 0);
      } else {
        const p = legSwipeProgress;
        if (p < 0.35) {
          // Phase 1: Reach forward & upward toward phone screen
          const t1 = p / 0.35;
          const ease1 = Math.sin(t1 * Math.PI * 0.5);
          flyParts.frontLegR.rotation.x = ease1 * 0.54;
          flyParts.frontLegR.rotation.y = ease1 * -0.22;
          flyParts.frontLegR.rotation.z = ease1 * 0.16;
        } else if (p < 0.72) {
          // Phase 2: Natural downward & lateral swipe stroke across glass
          if (!swipeAudioPlayed) {
            swipeAudioPlayed = true;
            playSwipeAudio();
            phoneBounce = -0.018; // Tactile phone stand micro-flex
          }
          const t2 = (p - 0.35) / 0.37;
          const strokeEase = Math.sin(t2 * Math.PI * 0.5);
          flyParts.frontLegR.rotation.x = 0.54 - strokeEase * 0.38;
          flyParts.frontLegR.rotation.y = -0.22 - Math.sin(t2 * Math.PI) * 0.26;
          flyParts.frontLegR.rotation.z = 0.16 - strokeEase * 0.10;
        } else {
          // Phase 3: Smooth return to table resting stance
          const t3 = (p - 0.72) / 0.28;
          const returnEase = Math.cos(t3 * Math.PI * 0.5);
          flyParts.frontLegR.rotation.x = 0.16 * returnEase;
          flyParts.frontLegR.rotation.y = -0.22 * returnEase;
          flyParts.frontLegR.rotation.z = 0.06 * returnEase;
        }
      }
    } else {
      // Natural idle micro-twitch / grooming
      const idleGroom = Math.sin(time * 3.5) * 0.015;
      flyParts.frontLegR.rotation.set(idleGroom, 0, 0);
    }
  }

  // 5. Tactile phone spring recoil after tap
  if (phoneGroup && Math.abs(phoneBounce) > 0.0005) {
    phoneBounce += (0 - phoneBounce) * 0.14;
    phoneGroup.position.y = 1.62 + phoneBounce;
  }
}

// =============================================================================
// Live Oscilloscope Wave (PAM11 Firing Rate Canvas)
// =============================================================================
let oscPhase = 0;
function initOscilloscope() {
  const canvas = document.getElementById("osc-canvas");
  const ctx = canvas.getContext("2d");

  function drawWave() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Grid lines
    ctx.strokeStyle = "rgba(255, 255, 255, 0.05)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, canvas.height / 2);
    ctx.lineTo(canvas.width, canvas.height / 2);
    ctx.stroke();

    // Wave calculation based on current dopamine Hz
    const hzFactor = state.currentDopamineHz / 85.0;
    const amp = 10 + (state.currentDopamineHz - 60) * 0.4;

    ctx.strokeStyle = "#a7f307";
    ctx.shadowColor = "rgba(167, 243, 7, 0.5)";
    ctx.shadowBlur = 8;
    ctx.lineWidth = 1.8;
    ctx.beginPath();

    oscPhase += 0.12 * hzFactor;

    for (let x = 0; x < canvas.width; x++) {
      const progress = x / canvas.width;
      // Combine multiple harmonic frequencies + jitter
      const noise = Math.sin(x * 0.8 + oscPhase * 2.0) * 2.5;
      const wave = Math.sin(progress * 18.0 * hzFactor + oscPhase) * (amp * 0.6)
                 + Math.sin(progress * 38.0 + oscPhase * 1.5) * (amp * 0.35)
                 + noise;
      const y = canvas.height / 2 + wave;
      if (x === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
    ctx.shadowBlur = 0;

    requestAnimationFrame(drawWave);
  }
  drawWave();
}

// =============================================================================
// Sound Synthesis (Web Audio Extracellular Neural Spikes)
// =============================================================================
function initAudio() {
  if (!state.audioCtx) {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    state.audioCtx = new AudioContext();
  }
  if (state.audioCtx.state === "suspended") {
    state.audioCtx.resume();
  }
}

function playSpikeBurst(hz) {
  if (!state.audioCtx || !state.soundEnabled) return;

  const count = Math.floor(hz / 18);
  for (let i = 0; i < count; i++) {
    setTimeout(() => {
      if (!state.soundEnabled) return;
      playSingleClick();
    }, i * (35 + Math.random() * 20));
  }
}

function playSingleClick() {
  if (!state.audioCtx) return;
  const osc = state.audioCtx.createOscillator();
  const gain = state.audioCtx.createGain();

  osc.type = "sine";
  osc.frequency.setValueAtTime(1400 + Math.random() * 600, state.audioCtx.currentTime);
  osc.frequency.exponentialRampToValueAtTime(300, state.audioCtx.currentTime + 0.015);

  gain.gain.setValueAtTime(0.06, state.audioCtx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, state.audioCtx.currentTime + 0.015);

  osc.connect(gain);
  gain.connect(state.audioCtx.destination);

  osc.start();
  osc.stop(state.audioCtx.currentTime + 0.015);
}

// Clean Mode (Minimal dashboard as in video)
function toggleCleanMode() {
  const app = document.getElementById("app");
  const isClean = app.classList.toggle("clean-mode");
  const restoreBtn = document.getElementById("btn-restore-ui");
  if (restoreBtn) restoreBtn.classList.toggle("hidden", !isClean);
}

// Fly Vision Mode (First-Person Compound Eye)
let isFlyVision = false;
let savedCamPos = new THREE.Vector3();
let savedCamTarget = new THREE.Vector3();

function toggleFlyVision() {
  isFlyVision = !isFlyVision;
  const overlay = document.getElementById("fly-vision-overlay");
  const btn = document.getElementById("btn-fly-vision");

  if (isFlyVision) {
    if (state.isCinematic) toggleCinematicMode(false);

    savedCamPos.copy(camera.position);
    savedCamTarget.copy(controls.target);

    // Camera viewpoint directly in fly's compound eyes looking at phone
    camera.position.set(0, 1.20, 0.05);
    controls.target.set(0, 1.45, -2.0);
    controls.minDistance = 0.2;

    if (flyGroup) flyGroup.visible = false;
    if (overlay) overlay.classList.remove("hidden");
    if (btn) btn.classList.add("btn-accent");

    const status = document.getElementById("fly-status-text");
    if (status) status.textContent = "👁️ Глазами мухи: 780 фасеток (спектр Rh1/Rh6)";
  } else {
    camera.position.copy(savedCamPos.length() > 0 ? savedCamPos : new THREE.Vector3(0, 5, 12));
    controls.target.copy(savedCamTarget.length() > 0 ? savedCamTarget : new THREE.Vector3(0, 1.2, 0));
    controls.minDistance = 3;

    if (flyGroup) flyGroup.visible = true;
    if (overlay) overlay.classList.add("hidden");
    if (btn) btn.classList.remove("btn-accent");

    const status = document.getElementById("fly-status-text");
    if (status) status.textContent = "Изучает экран (внимание)";
  }
  controls.update();
}

// =============================================================================
// Cinematic Recording Mode (Butter-Smooth 60 FPS Camera Choreography)
// =============================================================================
let cinematicTime = 0;

function toggleCinematicMode(forceState) {
  if (typeof forceState === "boolean") {
    state.isCinematic = forceState;
  } else {
    state.isCinematic = !state.isCinematic;
  }

  if (state.isCinematic && isFlyVision) {
    toggleFlyVision();
  }

  const topBtn = document.getElementById("btn-cinematic");
  const cineCamBtn = document.getElementById("cam-btn-cine");
  const indicator = document.getElementById("cinematic-indicator");

  if (state.isCinematic) {
    if (topBtn) topBtn.classList.add("btn-cinematic-active");
    if (cineCamBtn) cineCamBtn.classList.add("active");
    if (indicator) indicator.classList.remove("hidden");
    cinematicTime = 0;
  } else {
    if (topBtn) topBtn.classList.remove("btn-cinematic-active");
    if (cineCamBtn) cineCamBtn.classList.remove("active");
    if (indicator) indicator.classList.add("hidden");
    const isoBtn = document.querySelector('.cam-btn[data-view="iso"]');
    if (isoBtn && !document.querySelector('.cam-btn.active')) {
      isoBtn.classList.add("active");
    }
  }
}

function updateCinematicCamera(delta) {
  if (!state.isCinematic) return;

  // Dynamic cinematic velocity
  cinematicTime += delta * 0.28;
  const t = cinematicTime;

  // Frontal-lateral sweeping panoramic arc:
  // Angle theta oscillates smoothly between -76° and +76° (1.32 rad)
  // Distance undulates between 4.8 and 6.2 units
  // Camera stays in front of the phone screen (Z >= +0.8) at all times so the phone never occludes the fly!
  const theta = 1.32 * Math.sin(t * 0.45);
  const dist = 5.2 + 1.1 * Math.cos(t * 0.45);

  const camX = Math.sin(theta) * dist;
  const camZ = Math.cos(theta) * dist - 0.35; // Stays between +0.8 and +5.9 in front of screen!
  const camY = 2.05 + 0.95 * Math.sin(t * 0.75); // Undulates between 1.1 (eye-level macro) and 3.0 (crane overview)

  // Butter-smooth damping to target coordinates (60 FPS studio feel)
  camera.position.x += (camX - camera.position.x) * 0.055;
  camera.position.y += (camY - camera.position.y) * 0.055;
  camera.position.z += (camZ - camera.position.z) * 0.055;

  // Dynamic focus: tracks smoothly between fly head (0, 1.15, 0.4) and phone screen (0, 1.6, -1.2)
  const focusY = 1.28 + Math.sin(t * 0.9) * 0.25;
  const focusZ = -0.35 + Math.sin(t * 0.6) * 0.75;
  controls.target.x += (0 - controls.target.x) * 0.055;
  controls.target.y += (focusY - controls.target.y) * 0.055;
  controls.target.z += (focusZ - controls.target.z) * 0.055;
}

// Raycaster for clicking directly on the 3D fly
const raycaster = new THREE.Raycaster();
const mouseCoords = new THREE.Vector2();

window.addEventListener("pointerdown", (e) => {
  if (
    e.target.closest(".glass-panel") ||
    e.target.closest("button") ||
    e.target.closest("input") ||
    e.target.closest(".fly-vision-hud") ||
    e.target.closest(".modal-card")
  ) return;

  mouseCoords.x = (e.clientX / window.innerWidth) * 2 - 1;
  mouseCoords.y = -(e.clientY / window.innerHeight) * 2 + 1;
  raycaster.setFromCamera(mouseCoords, camera);

  if (flyGroup) {
    const hits = raycaster.intersectObjects(flyGroup.children, true);
    if (hits.length > 0) {
      performFlyFlip();
    }
  }
});

// =============================================================================
// UI Event Handlers
// =============================================================================
function initUIListeners() {
  // Clean Mode (Minimalist Dashboard)
  const cleanBtn = document.getElementById("btn-clean-mode");
  if (cleanBtn) cleanBtn.addEventListener("click", toggleCleanMode);

  const restoreBtn = document.getElementById("btn-restore-ui");
  if (restoreBtn) restoreBtn.addEventListener("click", toggleCleanMode);

  // Fly Vision Mode
  const flyVisionBtn = document.getElementById("btn-fly-vision");
  if (flyVisionBtn) flyVisionBtn.addEventListener("click", toggleFlyVision);

  const exitFlyVisionBtn = document.getElementById("btn-exit-fly-vision");
  if (exitFlyVisionBtn) exitFlyVisionBtn.addEventListener("click", toggleFlyVision);

  // Escape key shortcut
  window.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      if (state.isCinematic) {
        toggleCinematicMode(false);
        return;
      }
      if (isFlyVision) toggleFlyVision();
      const app = document.getElementById("app");
      if (app.classList.contains("clean-mode")) toggleCleanMode();
    }
  });

  // Refresh Posts
  const refreshBtn = document.getElementById("btn-refresh");
  if (refreshBtn) {
    refreshBtn.addEventListener("click", () => {
      refreshBtn.classList.add("btn-accent");
      refreshBtn.innerHTML = '<span class="icon">⏳</span> Загрузка...';
      fetchPosts();
      setTimeout(() => {
        refreshBtn.classList.remove("btn-accent");
        refreshBtn.innerHTML = '<span class="icon">🔄</span> Обновить';
      }, 1200);
    });
  }

  // X-Ray Mode
  document.getElementById("btn-xray").addEventListener("click", toggleXrayMode);

  // Sound Toggle
  document.getElementById("btn-sound").addEventListener("click", () => {
    initAudio();
    state.soundEnabled = !state.soundEnabled;
    document.getElementById("sound-icon").textContent = state.soundEnabled ? "🔊" : "🔇";
    document.getElementById("btn-sound").classList.toggle("btn-accent", state.soundEnabled);
  });

  // Next / Prev Post
  document.getElementById("btn-next-post").addEventListener("click", () => {
    showPost(state.currentPostIndex + 1);
  });
  document.getElementById("btn-prev-post").addEventListener("click", () => {
    showPost(state.currentPostIndex - 1);
  });

  // Auto Scroll Toggle
  const autoBtn = document.getElementById("btn-auto-scroll");
  autoBtn.addEventListener("click", () => {
    state.autoScroll = !state.autoScroll;
    autoBtn.classList.toggle("active", state.autoScroll);
    autoBtn.textContent = state.autoScroll ? "⏸ АВТО" : "▶ АВТО";
    toggleAutoScroll();
  });
  toggleAutoScroll();

  // Upload Photo Button
  const fileInput = document.getElementById("file-input");
  document.getElementById("btn-upload").addEventListener("click", () => {
    fileInput.click();
  });
  fileInput.addEventListener("change", (e) => {
    if (e.target.files.length > 0) {
      uploadLocalFile(e.target.files[0]);
    }
  });

  // Force React Button
  document.getElementById("btn-force-react").addEventListener("click", () => {
    const post = state.posts[state.currentPostIndex];
    if (post) {
      fetch("/api/react", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message_id: post.message_id,
          emoji: state.currentReaction
        })
      })
        .then((r) => r.json())
        .then((res) => {
          alert(res.ok ? `Реакция ${state.currentReaction} отправлена в Telegram!` : `Ответ Telegram: ${JSON.stringify(res)}`);
        });
    }
  });

  // Cinematic Camera Tour Button (top nav)
  const cineBtn = document.getElementById("btn-cinematic");
  if (cineBtn) {
    cineBtn.addEventListener("click", () => {
      toggleCinematicMode();
      document.querySelectorAll(".cam-btn").forEach((b) => b.classList.remove("active"));
      if (state.isCinematic) {
        const cBtn = document.getElementById("cam-btn-cine");
        if (cBtn) cBtn.classList.add("active");
      } else {
        const isoBtn = document.querySelector('.cam-btn[data-view="iso"]');
        if (isoBtn) isoBtn.classList.add("active");
      }
    });
  }

  // Dedicated Stop Cinematic Mode on floating indicator (accessible in Clean Mode!)
  const cineIndicator = document.getElementById("cinematic-indicator");
  if (cineIndicator) {
    cineIndicator.addEventListener("click", () => {
      toggleCinematicMode(false);
    });
  }
  const stopCineBtn = document.getElementById("btn-stop-cinematic");
  if (stopCineBtn) {
    stopCineBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      toggleCinematicMode(false);
    });
  }

  // Keyboard shortcut 'C' to toggle/stop cinematic tour anytime
  window.addEventListener("keydown", (e) => {
    if (e.key === "c" || e.key === "C" || e.key === "с" || e.key === "С") {
      if (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA") return;
      toggleCinematicMode();
    }
  });

  // When user interacts with OrbitControls (drags to rotate), automatically yield and exit cinematic mode
  if (controls) {
    controls.addEventListener("start", () => {
      if (state.isCinematic) {
        toggleCinematicMode(false);
      }
    });
  }

  // Camera preset buttons
  document.querySelectorAll(".cam-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".cam-btn").forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      const view = btn.getAttribute("data-view");
      applyCameraView(view);
    });
  });

  // Settings Modal
  const modal = document.getElementById("modal-settings");
  document.getElementById("btn-settings").addEventListener("click", () => {
    modal.classList.remove("hidden");
    loadSettings();
  });
  document.getElementById("btn-close-modal").addEventListener("click", () => {
    modal.classList.add("hidden");
  });

  document.getElementById("btn-save-settings").addEventListener("click", saveSettings);
  document.getElementById("btn-test-bot").addEventListener("click", testBotConnection);
}

function toggleAutoScroll() {
  if (state.autoScrollInterval) clearInterval(state.autoScrollInterval);
  if (state.autoScroll) {
    state.autoScrollInterval = setInterval(() => {
      showPost(state.currentPostIndex + 1);
    }, 6000);
  }
}

function applyCameraView(view) {
  if (view === "cine") {
    toggleCinematicMode(true);
    return;
  } else {
    toggleCinematicMode(false);
  }

  switch (view) {
    case "front":
      camera.position.set(0, 1.8, 4.5);
      controls.target.set(0, 1.1, 0);
      break;
    case "side":
      camera.position.set(5.5, 1.8, 0);
      controls.target.set(0, 1.0, 0);
      break;
    case "top":
      camera.position.set(0, 9, 0.5);
      controls.target.set(0, 0.5, 0);
      break;
    case "iso":
    default:
      camera.position.set(0, 5, 12);
      controls.target.set(0, 1.2, 0);
      break;
  }
}

// Drag & Drop
function initDragAndDrop() {
  const overlay = document.getElementById("drag-drop-overlay");

  window.addEventListener("dragover", (e) => {
    e.preventDefault();
    overlay.classList.remove("hidden");
  });

  window.addEventListener("dragleave", (e) => {
    if (e.relatedTarget === null) {
      overlay.classList.add("hidden");
    }
  });

  window.addEventListener("drop", (e) => {
    e.preventDefault();
    overlay.classList.add("hidden");
    if (e.dataTransfer.files.length > 0) {
      uploadLocalFile(e.dataTransfer.files[0]);
    }
  });
}

function uploadLocalFile(file) {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("title", file.name.replace(/\.[^/.]+$/, ""));

  fetch("/api/upload", {
    method: "POST",
    body: formData
  })
    .then((r) => r.json())
    .then((res) => {
      if (res.ok && res.post) {
        state.posts.unshift(res.post);
        showPost(0);
      }
    })
    .catch((e) => console.error("Upload error:", e));
}

// Telegram Settings Management
function loadSettings() {
  fetch("/api/config")
    .then((r) => r.json())
    .then((data) => {
      if (data.config) {
        document.getElementById("input-bot-token").value = data.config.bot_token || "";
        document.getElementById("input-channel").value = data.config.channel || "@fluffy_tail_group";
        document.getElementById("check-auto-react").checked = Boolean(data.config.auto_react);
      }
      if (data.bot_info) {
        showBotStatus(data.bot_info);
      }
    });
}

function saveSettings() {
  const token = document.getElementById("input-bot-token").value.trim();
  const channel = document.getElementById("input-channel").value.trim();
  const autoReact = document.getElementById("check-auto-react").checked;

  fetch("/api/config", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      bot_token: token,
      channel: channel,
      auto_react: autoReact
    })
  })
    .then((r) => r.json())
    .then((data) => {
      showBotStatus(data.bot_info);
      document.getElementById("modal-settings").classList.add("hidden");
      fetchPosts();
    });
}

function testBotConnection() {
  const token = document.getElementById("input-bot-token").value.trim();
  const channel = document.getElementById("input-channel").value.trim();

  fetch("/api/config", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ bot_token: token, channel: channel, auto_react: true })
  })
    .then((r) => r.json())
    .then((data) => {
      showBotStatus(data.bot_info);
    });
}

function showBotStatus(info) {
  const box = document.getElementById("bot-status-msg");
  box.classList.remove("hidden", "success", "error");

  if (!info) {
    box.classList.add("hidden");
    return;
  }

  if (info.ok) {
    box.classList.add("success");
    box.textContent = `✅ Успешно! Бот @${info.bot_username} («${info.bot_name}») подключен к системе.`;
  } else {
    box.classList.add("error");
    box.textContent = `❌ Ошибка проверки: ${info.error}`;
  }
}

// =============================================================================
// Animation Loop
// =============================================================================
function animate() {
  requestAnimationFrame(animate);

  const delta = clock.getDelta();
  const time = clock.getElapsedTime();

  // Smooth interpolation of Dopamine Hz and Spikes
  state.currentDopamineHz += (state.targetDopamineHz - state.currentDopamineHz) * 0.08;
  state.currentSpikes += (state.targetSpikes - state.currentSpikes) * 0.08;

  document.getElementById("val-dopamine").textContent = state.currentDopamineHz.toFixed(1);
  document.getElementById("val-spikes").textContent = Math.round(state.currentSpikes).toLocaleString();

  // Update Fly 3D animations
  updateFlyAnimation(delta, time);

  // Smooth 60 FPS cinematic camera tour
  if (state.isCinematic) {
    updateCinematicCamera(delta);
  }

  // Orbit controls update
  controls.update();

  // Render Scene
  renderer.render(scene, camera);
}
