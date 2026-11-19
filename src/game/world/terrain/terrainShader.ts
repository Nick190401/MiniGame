/**
 * Splat-mapped terrain: one GPU pass paints grass, roads, paving, water,
 * cliffs and the cave from the tile grid, with organic noise-warped borders,
 * animated water and drifting cloud shadows.
 */
export const TERRAIN_VERTEX = `
precision highp float;
uniform mat4 uProjectionMatrix;
uniform mat4 uViewMatrix;
attribute vec2 inPosition;
varying vec2 vWorld;
void main () {
  gl_Position = uProjectionMatrix * uViewMatrix * vec4(inPosition, 1.0, 1.0);
  vWorld = inPosition;
}
`;

export const TERRAIN_FRAGMENT = `
#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif

uniform float time;
uniform sampler2D uMaps;
uniform sampler2D uGrass;
uniform sampler2D uDirt;
uniform sampler2D uPaving;
uniform sampler2D uStone;
uniform sampler2D uNoise;
uniform vec2 uMapCell;
uniform vec2 uMapAtlas;
uniform float uCaveY;
uniform vec2 uPurifyCenter;
uniform float uPurifyRadius;
uniform float uPurifyFront;

varying vec2 vWorld;

const float TILE = 16.0;
const float PAD = 1.0;

vec3 mapTap(float index, vec2 tile) {
  vec2 texel = vec2(index * uMapCell.x + PAD, PAD) + tile;
  return texture2D(uMaps, texel / uMapAtlas).rgb;
}

vec3 noise(vec2 p, float scale) { return texture2D(uNoise, p / scale).rgb; }

float lum(vec3 c) { return dot(c, vec3(0.299, 0.587, 0.114)); }

// Organic border offset, in tiles.
vec2 warpAt(vec2 p) {
  vec2 a = noise(p, 420.0).rg - 0.5;
  vec2 b = noise(p + 37.0, 110.0).gb - 0.5;
  return a * 1.3 + b * 0.55;
}

float rockAt(vec2 p) {
  vec2 w = (noise(p, 260.0).rg - 0.5) * 1.1;
  return mapTap(2.0, p / TILE + w).b;
}

vec3 zoneTint(float y) {
  float row = y / TILE;
  vec3 village = vec3(1.02, 1.0, 0.92);
  vec3 meadow = vec3(1.0, 1.02, 0.9);
  vec3 brook = vec3(0.94, 1.0, 0.95);
  vec3 junction = vec3(0.9, 0.96, 0.97);
  vec3 grove = vec3(0.86, 0.94, 0.88);
  vec3 highlands = vec3(0.9, 0.9, 0.82);
  vec3 c = mix(village, meadow, smoothstep(18.0, 24.0, row));
  c = mix(c, brook, smoothstep(38.0, 44.0, row));
  c = mix(c, junction, smoothstep(54.0, 60.0, row));
  c = mix(c, grove, smoothstep(74.0, 80.0, row));
  c = mix(c, highlands, smoothstep(92.0, 98.0, row));
  return c;
}

vec3 grassColor(vec2 p, float lush, float forest) {
  vec3 g1 = texture2D(uGrass, p / 128.0).rgb;
  vec3 g2 = texture2D(uGrass, vec2(p.y, -p.x) / 152.0 + 0.31).rgb;
  float pick = smoothstep(0.38, 0.62, noise(p, 300.0).g);
  vec3 g = mix(g1, g2, pick);
  float macro = noise(p, 900.0).r;
  float patchy = smoothstep(0.42, 0.7, noise(p + 300.0, 520.0).g);
  g *= mix(vec3(1.08, 1.04, 0.84), vec3(0.88, 1.0, 0.9), smoothstep(0.35, 0.65, macro));
  g = mix(g, g * vec3(1.12, 1.06, 0.78), patchy * 0.35);
  g = mix(g, g * vec3(0.74, 0.9, 0.7), lush);
  vec3 litter = texture2D(uDirt, p / 96.0).rgb * vec3(0.5, 0.42, 0.32);
  vec3 forestFloor = mix(g * vec3(0.52, 0.62, 0.5), litter, smoothstep(0.35, 0.7, noise(p, 70.0).b));
  return mix(g, forestFloor, forest);
}

void main () {
  vec2 p = vWorld;
  vec2 tile = p / TILE;
  vec2 warp = warpAt(p);
  vec2 wt = tile + warp;
  vec3 m0 = mapTap(0.0, wt);
  vec3 m1 = mapTap(1.0, wt);
  vec3 m2 = mapTap(2.0, wt);
  vec3 m3 = mapTap(3.0, tile + warp * 0.4);
  vec3 straight0 = mapTap(0.0, tile + warp * 0.12);
  vec3 soft0 = mapTap(0.0, tile + warp * 0.45);

  vec3 n = noise(p, 64.0);
  float underground = smoothstep(uCaveY - 48.0, uCaveY, p.y);
  float junction = smoothstep(55.5 * TILE, 56.5 * TILE, p.y) * (1.0 - smoothstep(75.5 * TILE, 76.5 * TILE, p.y));

  float pur = clamp((uPurifyRadius - distance(p, uPurifyCenter)) / 90.0, 0.0, 1.0);
  vec3 stone = texture2D(uStone, p / 128.0).rgb;

  // ── Ground: meadow grass outdoors, gravel underground ────────────────────
  float lush = smoothstep(0.35, 0.65, m1.r + (n.r - 0.5) * 0.5);
  float forest = smoothstep(0.3, 0.7, m1.g + (n.g - 0.5) * 0.6);
  vec3 col = grassColor(p, lush, forest) * zoneTint(p.y);

  vec3 caveCorrupt = mix(vec3(0.085, 0.1, 0.11), vec3(0.22, 0.25, 0.25), stone.g);
  caveCorrupt *= 0.8 + 0.4 * noise(p, 220.0).r;
  vec3 caveLiving = mix(vec3(0.25, 0.2, 0.16), vec3(0.5, 0.43, 0.34), stone.g);
  caveLiving = mix(caveLiving, vec3(0.3, 0.42, 0.26), smoothstep(0.55, 0.75, noise(p, 90.0).g) * 0.45);
  vec3 caveFloor = mix(caveCorrupt, caveLiving, pur);
  // Damp patches and hairline cracks keep the floor from reading as flat noise.
  caveFloor *= 1.0 - 0.18 * smoothstep(0.55, 0.75, noise(p + 90.0, 150.0).b);
  caveFloor *= 1.0 - 0.35 * smoothstep(0.86, 0.95, 1.0 - abs(stone.r * 2.0 - 1.0)) * (1.0 - stone.g);
  col = mix(col, caveFloor, underground);

  float worn = smoothstep(0.35, 0.75, m1.b * (0.6 + noise(p, 48.0).b * 0.8));
  vec3 dirt = texture2D(uDirt, p / 128.0).rgb * vec3(0.96, 0.94, 0.9);
  dirt *= mix(vec3(1.0), vec3(0.88, 0.85, 0.8), smoothstep(0.4, 0.7, noise(p, 380.0).r));
  col = mix(col, mix(col, dirt * 0.92, 0.65), worn * (1.0 - underground));

  float dirtRaw = m0.r + (n.b - 0.5) * 0.55;
  float wDirt = smoothstep(0.42, 0.56, dirtRaw);
  // A darker trodden shoulder where grass gives way to the road.
  float shoulder = smoothstep(0.3, 0.46, dirtRaw) * (1.0 - smoothstep(0.5, 0.72, dirtRaw));
  col = mix(col, col * 0.82, shoulder * (1.0 - wDirt) * 0.8 * (1.0 - underground));
  vec3 road = dirt * mix(0.9, 1.03, smoothstep(0.5, 0.95, dirtRaw));
  col = mix(col, road * zoneTint(p.y), wDirt);

  float paveRaw = straight0.b;
  float wPave = smoothstep(0.47, 0.53, paveRaw);
  vec3 paving = texture2D(uPaving, p / 64.0).rgb;
  // Weathering at a larger scale than the paver repeat hides the tiling.
  paving *= mix(0.84, 1.1, noise(p + 131.0, 340.0).r);
  paving = mix(paving, paving * vec3(0.86, 0.84, 0.8), smoothstep(0.55, 0.75, noise(p, 150.0).b) * 0.6);
  paving = mix(paving, vec3(0.32, 0.38, 0.26), smoothstep(0.62, 0.8, noise(p + 57.0, 90.0).g) * 0.35);
  float curb = smoothstep(0.47, 0.53, paveRaw) * (1.0 - smoothstep(0.6, 0.72, paveRaw));
  paving = mix(paving, vec3(0.6, 0.62, 0.6), curb * 0.55);
  col = mix(col, paving, wPave);

  // ── Underground floors ───────────────────────────────────────────────────
  float wCave = smoothstep(0.45, 0.55, m2.r + (n.g - 0.5) * 0.3);
  if (wCave > 0.001) {
    vec3 floorCol = caveFloor;
    float stairs = m3.b;
    if (stairs > 0.02) {
      float s = fract(p.y / 5.0);
      float stepShade = mix(0.72, 1.08, smoothstep(0.0, 0.25, s)) * mix(1.0, 0.82, smoothstep(0.75, 1.0, s));
      floorCol = mix(floorCol, floorCol * stepShade * 1.1 + 0.02, smoothstep(0.3, 0.6, stairs));
    }
    col = mix(col, floorCol, wCave);
  }

  float wArena = smoothstep(0.45, 0.55, m2.g + (n.b - 0.5) * 0.25);
  if (wArena > 0.001) {
    float obs = texture2D(uStone, p / 160.0).b;
    float vein = smoothstep(0.62, 0.9, obs);
    float pulse = 0.65 + 0.35 * sin(time * 1.7 + p.x * 0.02 + p.y * 0.015);
    vec3 corrupt = mix(vec3(0.05, 0.04, 0.06), vec3(0.12, 0.1, 0.13), obs) + vec3(0.9, 0.25, 0.12) * vein * pulse * 0.55;
    vec3 living = mix(vec3(0.16, 0.14, 0.13), vec3(0.32, 0.28, 0.24), obs) + vec3(0.3, 0.75, 0.85) * vein * 0.35;
    col = mix(col, mix(corrupt, living, pur), wArena);
  }

  // Floors darken where they meet the cave walls.
  col *= 1.0 - underground * 0.45 * smoothstep(0.02, 0.5, m2.b);

  // ── Water ────────────────────────────────────────────────────────────────
  // Natural banks wobble gently; Junction basins keep their masonry edge.
  float naturalRaw = soft0.g + (noise(p, 210.0).g - 0.5) * 0.3;
  float basinRaw = mapTap(0.0, tile).g;
  float waterRaw = mix(naturalRaw, basinRaw, junction);
  float rim = junction * smoothstep(0.24, 0.3, basinRaw) * (1.0 - smoothstep(0.5, 0.56, basinRaw));
  float wet = smoothstep(0.26, 0.49, waterRaw) * (1.0 - junction);
  col = mix(col, col * vec3(0.7, 0.72, 0.76), wet * 0.65);
  float wWater = smoothstep(0.5, 0.53, waterRaw) * (1.0 - rim);
  if (wWater > 0.001) {
    float depth = m3.r;
    vec2 flow = vec2(time * 2.6, time * 1.2);
    float h1 = texture2D(uNoise, (p + flow) / 150.0).b;
    float h2 = texture2D(uNoise, (p * vec2(1.0, 1.25) - flow * 0.7) / 110.0 + 0.5).b;
    float hx = texture2D(uNoise, (p + flow + vec2(3.0, 0.0)) / 150.0).b - h1;
    float hy = texture2D(uNoise, (p + flow + vec2(0.0, 3.0)) / 150.0).b - h1;
    vec3 nrm = normalize(vec3(-hx * 5.0, -hy * 5.0, 1.0));

    vec3 shallowOut = vec3(0.27, 0.53, 0.52);
    vec3 deepOut = vec3(0.05, 0.2, 0.27);
    vec3 shallowCave = mix(vec3(0.05, 0.25, 0.24), vec3(0.2, 0.48, 0.58), pur);
    vec3 deepCave = mix(vec3(0.01, 0.07, 0.08), vec3(0.04, 0.16, 0.26), pur);
    vec3 shallow = mix(shallowOut, shallowCave, underground);
    vec3 deep = mix(deepOut, deepCave, underground);
    vec3 water = mix(shallow, deep, smoothstep(0.05, 0.85, depth));
    // Sandy bed visible through the shallows.
    vec3 bed = dirt * vec3(0.7, 0.76, 0.72);
    water = mix(bed, water, 0.5 + 0.5 * smoothstep(0.0, 0.45, depth));
    // Sky and cloud reflections, soft swell shading and a few sun glints.
    float cloudRefl = smoothstep(0.45, 0.75, texture2D(uNoise, (p * vec2(1.0, 0.6) + vec2(time * 7.0, time * 2.5)) / 1100.0).r);
    vec3 sky = mix(vec3(0.5, 0.68, 0.78), vec3(0.86, 0.9, 0.92), cloudRefl);
    vec3 sun = normalize(vec3(-0.45, -0.6, 0.66));
    water *= 0.93 + dot(nrm, sun) * 0.1;
    float fresnel = 0.16 + 0.24 * smoothstep(0.0, 0.5, depth);
    water = mix(water, mix(sky, vec3(0.16, 0.3, 0.34), underground), fresnel * (1.0 - underground * 0.6));
    float glint = pow(max(0.0, dot(reflect(-sun, nrm), vec3(0.0, 0.0, 1.0))), 28.0) * smoothstep(0.55, 0.7, h2);
    water += vec3(1.0, 0.97, 0.9) * glint * 0.35 * (1.0 - underground * 0.7);
    float caustic = smoothstep(1.0, 1.2, h1 + h2) * (1.0 - smoothstep(0.1, 0.6, depth));
    water += vec3(0.18, 0.26, 0.22) * caustic * 0.35;
    // Lapping foam line along natural banks.
    float bank = 1.0 - smoothstep(0.0, 0.06, waterRaw - 0.5);
    float lap = 0.5 + 0.5 * sin(time * 1.6 + (h1 - h2) * 9.0);
    water = mix(water, vec3(0.84, 0.9, 0.88), bank * lap * 0.45 * (1.0 - junction) * (1.0 - underground * 0.5));
    if (underground > 0.5) water += vec3(0.05, 0.4, 0.34) * (1.0 - pur) * 0.25 * (0.6 + 0.4 * sin(time * 1.3 + p.x * 0.05));
    col = mix(col, water, wWater);
  }
  if (rim > 0.001) {
    // Dressed stone coping around the Junction basins.
    vec3 coping = mix(vec3(0.5, 0.52, 0.5), vec3(0.74, 0.75, 0.71), stone.r);
    float bevel = smoothstep(0.3, 0.42, basinRaw);
    coping *= mix(1.12, 0.82, bevel);
    col = mix(col, coping, rim);
  }

  // ── Raised rock: cliffs outdoors, walls underground ──────────────────────
  float rockHere = smoothstep(0.47, 0.53, rockAt(p));
  if (rockHere > 0.001) {
    const float FACE = 12.0;
    float edgeBelow = FACE;
    for (int i = 1; i <= 5; i++) {
      float k = float(i) * FACE / 5.0;
      if (edgeBelow >= FACE && rockAt(p + vec2(0.0, k)) < 0.5) edgeBelow = k;
    }
    vec3 rs = texture2D(uStone, p / 96.0).rgb;
    float rx = texture2D(uStone, (p + vec2(1.2, 0.0)) / 96.0).r - rs.r;
    float ry = texture2D(uStone, (p + vec2(0.0, 1.2)) / 96.0).r - rs.r;
    float relief = clamp(1.0 + (-rx - ry) * 6.0, 0.55, 1.5);
    float depthIn = m3.g;
    vec3 rockOut = mix(vec3(0.3, 0.3, 0.27), vec3(0.64, 0.62, 0.56), rs.r);
    vec3 rockCave = mix(vec3(0.07, 0.085, 0.095), vec3(0.24, 0.26, 0.27), rs.r);
    vec3 rockLiving = mix(vec3(0.22, 0.18, 0.15), vec3(0.5, 0.42, 0.34), rs.r);
    rockCave = mix(rockCave, rockLiving, pur);
    vec3 rockTop = mix(rockOut, rockCave, underground) * relief;
    // Outdoor ledges carry moss on their tops.
    float moss = smoothstep(0.45, 0.7, noise(p, 60.0).g) * (1.0 - underground);
    rockTop = mix(rockTop, vec3(0.3, 0.42, 0.22) * (0.8 + rs.r * 0.4), moss * 0.6);
    // Broad shape lighting from the local rock gradient.
    float gx = rockAt(p + vec2(4.0, 0.0)) - rockAt(p - vec2(4.0, 0.0));
    float gy = rockAt(p + vec2(0.0, 4.0)) - rockAt(p - vec2(0.0, 4.0));
    rockTop *= 1.0 + (-gx * 0.3 - gy * 0.2);
    // Deep inside the cave mass everything sinks into darkness.
    rockTop *= mix(1.0, mix(0.22, 0.55, pur), underground * smoothstep(0.1, 0.9, depthIn));

    vec3 rockCol = rockTop;
    if (edgeBelow < FACE) {
      float t = edgeBelow / FACE; // 0 at the foot, 1 at the lip
      float streak = texture2D(uStone, vec2(p.x / 34.0, p.y / 260.0)).r;
      float strata = 0.9 + 0.1 * sin(p.y * 1.3 + streak * 6.0);
      vec3 faceCol = mix(rockOut, rockCave, underground) * (0.42 + 0.34 * streak) * strata;
      faceCol *= mix(0.55, 1.0, smoothstep(0.0, 0.4, t));
      float lip = smoothstep(0.82, 0.97, t);
      faceCol = mix(faceCol, rockTop * 1.25 + 0.03, lip);
      rockCol = faceCol;
    }
    col = mix(col, rockCol, rockHere);
  }

  // Contact shadow on floors directly below raised rock.
  if (mapTap(2.0, tile - vec2(0.0, 0.9)).b > 0.01 && rockHere < 0.5) {
    float occl = 0.0;
    for (int i = 1; i <= 3; i++) {
      float k = float(i) * 3.0;
      occl = max(occl, step(0.5, rockAt(p - vec2(0.0, k))) * (1.0 - float(i - 1) / 3.0));
    }
    col *= 1.0 - occl * 0.42;
  }

  // ── Light and atmosphere ─────────────────────────────────────────────────
  float outdoor = 1.0 - underground;
  float cloud = smoothstep(0.52, 0.7, texture2D(uNoise, (p + vec2(time * 7.0, time * 2.5)) / 1500.0).r);
  col *= 1.0 - cloud * 0.17 * outdoor;
  // Cave purification wavefront.
  float fd = (distance(p, uPurifyCenter) - uPurifyRadius) / 18.0;
  float front = exp(-fd * fd) * uPurifyFront;
  col += vec3(0.55, 0.85, 1.0) * front * underground;

  gl_FragColor = vec4(col, 1.0);
}
`;
