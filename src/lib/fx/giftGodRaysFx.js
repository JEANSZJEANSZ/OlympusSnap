/**
 * Volumetric crepuscular god-rays — GPU shader, not flat plane spokes.
 * Olympus travertine palette (#fff8df / #ffd86a).
 * Plane is oversized + edge-vignetted so no hard rectangular clip.
 */
import { AdditiveBlending, Group, Mesh, PlaneGeometry, ShaderMaterial } from 'three';

const VERT = `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

const FRAG = `
precision highp float;
varying vec2 vUv;
uniform float uTime;
uniform float uIntensity;
uniform float uSeed;
uniform float uBurst;
uniform float uAspect;

float hash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}

float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  float a = hash(i);
  float b = hash(i + vec2(1.0, 0.0));
  float c = hash(i + vec2(0.0, 1.0));
  float d = hash(i + vec2(1.0, 1.0));
  return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}

float fbm(vec2 p) {
  float v = 0.0;
  float a = 0.5;
  for (int i = 0; i < 4; i++) {
    v += a * noise(p);
    p *= 2.05;
    a *= 0.5;
  }
  return v;
}

float rayBeam(float angle, float rayAngle, float width, float dist) {
  float diff = abs(mod(angle - rayAngle + 3.14159, 6.28318) - 3.14159);
  float beam = smoothstep(width, 0.0, diff);
  beam *= smoothstep(0.012, 0.09, dist) * smoothstep(0.88, 0.22, dist);
  return beam;
}

void main() {
  vec2 uv = vUv - 0.5;

  /* Aspect-correct radial coords so rays stay circular on wide planes */
  vec2 radial = vec2(uv.x * uAspect, uv.y);
  float dist = length(radial);
  float angle = atan(radial.y, radial.x);
  float rotAngle = angle + uTime * 0.06 + uBurst * 0.35;

  float rays = 0.0;

  for (float i = 0.0; i < 14.0; i++) {
    float rayAngle = i * 0.4488 + uSeed * 6.28318;
    float width = 0.035 + 0.028 * sin(i * 1.9 + uSeed * 12.0);
    float beam = rayBeam(rotAngle, rayAngle, width, dist);
    beam *= 0.55 + 0.45 * sin(i * 2.1 + uTime * 1.35 + uBurst * 4.0);
    rays += beam;
  }

  for (float j = 0.0; j < 28.0; j++) {
    float rayAngle = j * 0.2244 + uSeed * 3.14159 + uTime * 0.02;
    float beam = rayBeam(rotAngle, rayAngle, 0.014, dist);
    rays += beam * (0.18 + 0.12 * sin(j * 1.3 + uTime * 2.2));
  }

  float n = fbm(vec2(angle * 2.8 + uTime * 0.12, dist * 5.0 - uTime * 0.18 + uSeed));
  rays *= 0.58 + 0.42 * n;

  float hub = exp(-dist * dist * 10.0) * (1.35 + uBurst * 0.65);
  hub += exp(-dist * 5.5) * 0.55 * (0.65 + 0.35 * sin(uTime * 2.4 + uBurst * 6.0));

  float halo = smoothstep(0.62, 0.06, dist) * 0.42;
  halo *= 0.75 + 0.25 * sin(uTime * 0.9);

  float total = (rays * 0.85 + hub + halo) * uIntensity;

  vec3 inner = vec3(1.0, 0.973, 0.875);
  vec3 mid = vec3(1.0, 0.847, 0.416);
  vec3 outer = vec3(0.92, 0.72, 0.28);

  vec3 col = mix(outer, mid, clamp(rays * 1.8, 0.0, 1.0));
  col = mix(col, inner, clamp(hub * 1.2, 0.0, 1.0));
  col *= 1.0 + uBurst * 0.35;

  float alpha = total * smoothstep(0.82, 0.08, dist);
  alpha = clamp(alpha, 0.0, 0.92);

  /* Soft rectangular vignette — fade to zero well before plane edge (no hard box) */
  vec2 edgeUv = vec2(abs(uv.x) * uAspect, abs(uv.y));
  float boxEdge = max(edgeUv.x, edgeUv.y);
  float edgeFade = 1.0 - smoothstep(0.34, 0.47, boxEdge);
  edgeFade = edgeFade * edgeFade * edgeFade;
  alpha *= edgeFade;

  if (alpha < 0.002) discard;

  gl_FragColor = vec4(col * alpha, alpha);
}
`;

/** Oversize factor — plane larger than viewport so rays fade naturally */
const PLANE_PAD = 1.65;

/**
 * Shader god-rays parented to portrait reveal group.
 * @param {import('three').Group} parent
 * @param {boolean} reduced
 * @param {number} [seed]
 */
export function buildGodRaysShader(parent, reduced, seed = 0) {
	const group = new Group();
	group.position.z = -0.01;
	parent.add(group);

	let planeW = 14;
	let planeH = 14;

	const mat = new ShaderMaterial({
		uniforms: {
			uTime: { value: 0 },
			uIntensity: { value: 0 },
			uSeed: { value: ((seed >>> 0) % 997) / 997 },
			uBurst: { value: 0 },
			uAspect: { value: 1 }
		},
		vertexShader: VERT,
		fragmentShader: FRAG,
		transparent: true,
		depthWrite: false,
		depthTest: false,
		blending: AdditiveBlending
	});

	const mesh = new Mesh(new PlaneGeometry(planeW, planeH), mat);
	mesh.renderOrder = 0;
	mesh.frustumCulled = false;
	group.add(mesh);

	/**
	 * Size plane to cover full orthographic view (call on resize).
	 * @param {number} viewW
	 * @param {number} viewH
	 * @param {number} [parentScale] expected portraitReveal scale (compensate local size)
	 */
	function resize(viewW, viewH, parentScale = 1) {
		const inv = 1 / Math.max(0.12, parentScale);
		planeW = viewW * PLANE_PAD * inv;
		planeH = viewH * PLANE_PAD * inv;
		mat.uniforms.uAspect.value = planeW / Math.max(0.001, planeH);
		mesh.geometry.dispose();
		mesh.geometry = new PlaneGeometry(planeW, planeH);
	}

	function setOpacity(op) {
		const v = Math.max(0, Math.min(1, op));
		mat.uniforms.uIntensity.value = reduced ? v * 0.55 : v * 1.15;
		group.visible = v > 0.006;
	}

	/**
	 * @param {number} t
	 * @param {number} intensity
	 */
	function tick(t, intensity) {
		mat.uniforms.uTime.value = t;
		const amp = Math.max(0, intensity);
		const breath = 1 + Math.sin(t * 1.25) * 0.045 + amp * 0.06;
		group.scale.setScalar(breath * (0.94 + amp * 0.1));
		group.rotation.z = t * 0.028 + Math.sin(t * 0.7) * 0.012;
	}

	/** @param {number} burst 0–1 divine emergence punch */
	function setBurst(burst) {
		mat.uniforms.uBurst.value = Math.max(0, Math.min(1, burst));
	}

	setOpacity(0);
	return {
		group,
		setOpacity,
		tick,
		setBurst,
		resize,
		dispose: () => {
			mat.dispose();
			mesh.geometry.dispose();
		}
	};
}
