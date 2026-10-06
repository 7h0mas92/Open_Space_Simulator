/**
 * Effets visuels : fumée quand la prod tombe, confettis lors d'une levée de fonds.
 * (L'écran rouge clignotant pendant un incident est un calque CSS de l'interface.)
 */
import * as THREE from 'three';

interface Particle {
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  life: number;
  spin: number;
}

/** Petit générateur local : les effets sont purement décoratifs. */
function jitter(seed: { value: number }): number {
  seed.value = (seed.value * 16807) % 2147483647;
  return seed.value / 2147483647 - 0.5;
}

export class SmokeEffect {
  readonly root: THREE.Points;
  private readonly particles: Particle[] = [];
  private readonly positions: Float32Array;
  private readonly seed = { value: 1234 };
  active = false;

  constructor(
    private readonly capacity: number,
    private source: THREE.Vector3 = new THREE.Vector3(),
  ) {
    this.positions = new Float32Array(capacity * 3);
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(this.positions, 3));
    this.root = new THREE.Points(
      geometry,
      new THREE.PointsMaterial({
        color: 0x555a66,
        size: 0.6,
        transparent: true,
        opacity: 0.55,
        depthWrite: false,
      }),
    );
    this.root.frustumCulled = false;
  }

  setSource(source: THREE.Vector3): void {
    this.source = source;
  }

  update(delta: number): void {
    if (this.active && this.particles.length < this.capacity) {
      for (let i = 0; i < 2; i++) {
        this.particles.push({
          x: this.source.x + jitter(this.seed),
          y: 0.8,
          z: this.source.z + jitter(this.seed),
          vx: jitter(this.seed) * 0.3,
          vy: 0.9 + jitter(this.seed) * 0.3,
          vz: jitter(this.seed) * 0.3,
          life: 3,
          spin: 0,
        });
      }
    }
    for (const p of this.particles) {
      p.x += p.vx * delta;
      p.y += p.vy * delta;
      p.z += p.vz * delta;
      p.life -= delta;
    }
    for (let i = this.particles.length - 1; i >= 0; i--)
      if ((this.particles[i]?.life ?? 0) <= 0) this.particles.splice(i, 1);
    this.positions.fill(0);
    this.particles.forEach((p, i) => this.positions.set([p.x, p.y, p.z], i * 3));
    this.root.geometry.setDrawRange(0, this.particles.length);
    this.root.geometry.getAttribute('position').needsUpdate = true;
    this.root.visible = this.particles.length > 0;
  }

  get count(): number {
    return this.particles.length;
  }
}

const CONFETTI_COLORS = [0xf5b942, 0xe0584a, 0x4f7fd9, 0x4caf6e, 0x8f6ad8];

export class ConfettiEffect {
  readonly root: THREE.InstancedMesh;
  private readonly particles: Particle[] = [];
  private readonly seed = { value: 42 };
  private readonly dummy = new THREE.Object3D();

  constructor(private readonly capacity: number) {
    this.root = new THREE.InstancedMesh(
      new THREE.PlaneGeometry(0.12, 0.2),
      new THREE.MeshBasicMaterial({ side: THREE.DoubleSide }),
      capacity,
    );
    const color = new THREE.Color();
    for (let i = 0; i < capacity; i++)
      this.root.setColorAt(
        i,
        color.setHex(CONFETTI_COLORS[i % CONFETTI_COLORS.length] ?? 0xffffff),
      );
    this.root.count = 0;
    this.root.frustumCulled = false;
  }

  burst(center: THREE.Vector3): void {
    this.particles.length = 0;
    for (let i = 0; i < this.capacity; i++) {
      this.particles.push({
        x: center.x + jitter(this.seed) * 4,
        y: 5 + jitter(this.seed) * 2,
        z: center.z + jitter(this.seed) * 4,
        vx: jitter(this.seed),
        vy: -1 - Math.abs(jitter(this.seed)),
        vz: jitter(this.seed),
        life: 4,
        spin: jitter(this.seed) * 12,
      });
    }
  }

  update(delta: number): void {
    let index = 0;
    for (const p of this.particles) {
      p.life -= delta;
      if (p.life <= 0 || p.y < 0) continue;
      p.x += p.vx * delta;
      p.y += p.vy * delta;
      p.z += p.vz * delta;
      this.dummy.position.set(p.x, p.y, p.z);
      this.dummy.rotation.set(p.life * p.spin, p.life * p.spin * 0.7, 0);
      this.dummy.updateMatrix();
      this.root.setMatrixAt(index++, this.dummy.matrix);
    }
    this.root.count = index;
    this.root.instanceMatrix.needsUpdate = true;
  }

  get count(): number {
    return this.root.count;
  }
}
