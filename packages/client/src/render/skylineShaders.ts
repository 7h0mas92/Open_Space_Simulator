/**
 * Shaders de la vue sur New York. Tout est procédural : aucune image n'est chargée, les
 * fenêtres, les marquages au sol et les reflets sont calculés pixel par pixel.
 *
 * - Façades : chaque immeuble a un style (verre, brique, pierre, bandeaux, brownstone) qui
 *   dessine ses fenêtres, un usage (bureaux ou logements) qui règle leur allumage, et une
 *   graine qui rend chaque fenêtre unique (couleur de lampe, stores, télé qui scintille).
 * - Toits et volumes unis : couleur de l'objet éclairée par le soleil et le ciel.
 * - Rue : asphalte, marquages, passages piétons et flaques des lampadaires la nuit.
 * - Fleuve : reflet du ciel, vaguelettes et scintillement du soleil.
 *
 * Toutes ces surfaces partagent le même éclairage : la lumière du ciel (ambiance), celle du
 * soleil (direction et couleur suivent l'heure) et un assombrissement au fond des rues, comme
 * dans un vrai canyon urbain. La brume de la scène (`scene.fog`) fond le lointain dans le ciel.
 */
import * as THREE from 'three';

/** Styles de façade, dans l'ordre où le shader les reconnaît (attribut `facade.x`). */
export const FACADE_STYLES = ['glass', 'brick', 'limestone', 'ribbon', 'brownstone'] as const;
export type FacadeStyle = (typeof FACADE_STYLES)[number];

/** Largeur d'une travée (une fenêtre et ses trumeaux) et hauteur d'un étage, en cases. */
export const FACADE_GRID: Readonly<Record<FacadeStyle, { bay: number; floor: number }>> = {
  glass: { bay: 1.3, floor: 2.6 },
  brick: { bay: 1.5, floor: 2.4 },
  limestone: { bay: 1.4, floor: 2.5 },
  ribbon: { bay: 1.6, floor: 2.6 },
  brownstone: { bay: 1.3, floor: 2.3 },
};

/** Réglages communs, recalculés à chaque image selon l'heure. */
export interface CityUniforms {
  /** Lumière du ciel (couleur x intensité). */
  readonly skyLight: { value: THREE.Color };
  /** Lumière du soleil (couleur x intensité). */
  readonly sunLight: { value: THREE.Color };
  /** Direction vers le soleil. */
  readonly sunDir: { value: THREE.Vector3 };
  /** Couleur de la brume et de l'horizon (reflétée par les vitres et l'eau). */
  readonly horizon: { value: THREE.Color };
  /** 0 en plein jour, 1 en pleine nuit. */
  readonly night: { value: number };
  /** Part des fenêtres allumées dans les bureaux et dans les logements (`cityLights.ts`). */
  readonly officeShare: { value: number };
  readonly homeShare: { value: number };
  /** Intensité des fenêtres allumées. */
  readonly glow: { value: number };
  /** Secondes réelles écoulées : vie de la ville (lampes qui changent, télés, vaguelettes). */
  readonly clock: { value: number };
  /** 1 en qualité moyenne et haute, 0 en basse : supprime les détails les plus coûteux. */
  readonly detail: { value: number };
  /** Centre du bureau : origine de la grille des rues. */
  readonly center: { value: THREE.Vector2 };
  /** Éclairage propre (couronnes des tours la nuit), 0 pour les autres volumes. */
  readonly selfLit: { value: number };
}

export function cityUniforms(): CityUniforms {
  return {
    skyLight: { value: new THREE.Color(0.6, 0.6, 0.6) },
    sunLight: { value: new THREE.Color(0.4, 0.4, 0.4) },
    sunDir: { value: new THREE.Vector3(0.4, 0.8, 0.4).normalize() },
    horizon: { value: new THREE.Color(0.6, 0.7, 0.8) },
    night: { value: 0 },
    officeShare: { value: 0.5 },
    homeShare: { value: 0.3 },
    glow: { value: 0.2 },
    clock: { value: 0 },
    detail: { value: 1 },
    center: { value: new THREE.Vector2() },
    selfLit: { value: 0 },
  };
}

const COMMON = /* glsl */ `
  uniform vec3 skyLight;
  uniform vec3 sunLight;
  uniform vec3 sunDir;
  uniform vec3 horizon;
  uniform float night;
  uniform float clock;
  uniform float detail;
  varying vec3 vWorld;
  varying vec3 vNormal;

  // Hachage sans sinus (Dave Hoskins) : stable sur toutes les cartes graphiques.
  float hash12(vec2 p) {
    vec3 p3 = fract(vec3(p.xyx) * 0.1031);
    p3 += dot(p3, p3.yzx + 33.33);
    return fract((p3.x + p3.y) * p3.z);
  }

  // 1 entre a et b, bords adoucis sur w (anti-crénelage).
  float band(float x, float a, float b, float w) {
    return smoothstep(a - w, a + w, x) - smoothstep(b - w, b + w, x);
  }

  // Lumière reçue par une surface : ciel (plus fort sur les toits) + soleil, assombrie au fond
  // des rues (la rue est à y = -45, le bureau à y = 0).
  vec3 cityLight(vec3 n) {
    float canyon = mix(0.42, 1.0, smoothstep(-45.0, -16.0, vWorld.y));
    float ndl = max(dot(n, sunDir), 0.0);
    return (skyLight * (0.72 + 0.28 * n.y) + sunLight * ndl) * canyon;
  }
`;

const VERTEX = /* glsl */ `
  #include <fog_pars_vertex>
  varying vec3 vWorld;
  varying vec3 vNormal;
  void passWorld() {
    vec4 world = modelMatrix * vec4(position, 1.0);
    vWorld = world.xyz;
    vNormal = normalize(mat3(modelMatrix) * normal);
    vec4 mvPosition = viewMatrix * world;
    gl_Position = projectionMatrix * mvPosition;
    #include <fog_vertex>
  }
`;

const OUTPUT = /* glsl */ `
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
  // Brume un peu plus légère que celle de la scène : la ville garde ses couleurs au loin.
  #if defined(USE_FOG) && !defined(FOG_EXP2)
    float fogFactor = smoothstep(fogNear, fogFar, vFogDepth) * 0.75;
    gl_FragColor.rgb = mix(gl_FragColor.rgb, fogColor, fogFactor);
  #endif
`;

function cityMaterial(
  name: string,
  uniforms: CityUniforms,
  vertex: string,
  fragment: string,
): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    name,
    fog: true,
    // Les réglages sont partagés : un seul calcul par image pour toute la ville.
    uniforms: { ...THREE.UniformsUtils.clone(THREE.UniformsLib.fog), ...uniforms },
    vertexShader: vertex,
    fragmentShader: fragment,
  });
}

/**
 * Façades. Attributs : `uv` = (travée, étage) comptés depuis le coin de la face et le pied de
 * l'immeuble, `facade` = (style, graine, usage, -), `color` = couleur du mur.
 */
export function facadeMaterial(uniforms: CityUniforms): THREE.ShaderMaterial {
  return cityMaterial(
    'skyline-facade',
    uniforms,
    /* glsl */ `
      ${VERTEX}
      attribute vec3 color;
      attribute vec4 facade;
      varying vec3 vColor;
      varying vec2 vUv;
      varying vec4 vFacade;
      void main() {
        vColor = color;
        vUv = uv;
        vFacade = facade;
        passWorld();
      }`,
    /* glsl */ `
      #include <fog_pars_fragment>
      ${COMMON}
      uniform float officeShare;
      uniform float homeShare;
      uniform float glow;
      varying vec3 vColor;
      varying vec2 vUv;
      varying vec4 vFacade;

      void main() {
        int style = int(vFacade.x + 0.5);
        float seed = vFacade.y * 97.0;
        bool home = vFacade.z > 0.5;
        vec2 cell = floor(vUv);
        vec2 f = fract(vUv);

        // Ouverture de la fenêtre dans sa travée : x0, x1 (largeur), y0, y1 (hauteur).
        vec4 win = vec4(0.05, 0.95, 0.24, 0.97);                 // verre : allège en bas
        if (style == 1) win = vec4(0.27, 0.73, 0.3, 0.8);        // brique : percements
        else if (style == 2) win = vec4(0.2, 0.8, 0.22, 0.84);   // pierre : piliers continus
        else if (style == 3) win = vec4(0.0, 1.0, 0.38, 0.82);   // bandeaux filants
        else if (style == 4) win = vec4(0.3, 0.7, 0.26, 0.8);    // brownstone
        // Rez-de-chaussée des immeubles anciens : grandes vitrines de boutiques.
        bool shop = cell.y < 0.5 && style != 0;
        if (shop) win = vec4(0.06, 0.94, 0.08, 0.8);

        // Anti-crénelage : quand une fenêtre ne fait plus que quelques pixels, on passe à sa
        // couverture moyenne (pas de moirés en dézoomant).
        vec2 fw = fwidth(vUv);
        vec2 aa = clamp(fw * 1.2, 0.002, 0.5);
        float lod = smoothstep(0.16, 0.42, max(fw.x, fw.y));
        float mask = band(f.x, win.x, win.y, aa.x) * band(f.y, win.z, win.w, aa.y);
        float coverage = (win.y - win.x) * (win.w - win.z);
        // Meneau au milieu des grandes baies, traverse sur la pierre.
        if (style == 0 || style == 3) mask *= 1.0 - 0.85 * band(f.x, 0.485, 0.515, aa.x);
        if (style == 2) mask *= 1.0 - 0.7 * band(f.y, 0.6, 0.63, aa.y);
        mask = mix(mask, coverage, lod);

        vec3 n = normalize(vNormal);
        vec3 light = cityLight(n);

        // Mur : couleur de l'immeuble, un peu d'usure d'un étage à l'autre, corniche sombre
        // sous chaque dalle pour les tours de verre.
        float grime = 0.9 + 0.1 * hash12(vec2(cell.y * 1.7, seed));
        vec3 wall = vColor * grime * light;
        if (style == 0) wall *= 1.0 - 0.25 * band(f.y, 0.0, 0.06, aa.y) * (1.0 - lod);

        // Vitre : reflet du ciel et de l'horizon, chaque carreau un peu différent, éclat du
        // soleil sur le verre quand la façade lui fait face.
        float pane = hash12(cell + seed);
        float mirror = style == 0 ? 0.5 : style == 3 ? 0.36 : 0.2;
        vec3 sky = mix(horizon * 0.6, skyLight * 1.1, 0.25 + 0.45 * pane);
        vec3 glass = mix(vec3(0.035, 0.05, 0.07), sky, mirror) * mix(0.55, 1.0, light.g);
        float facing = max(dot(n, sunDir), 0.0);
        glass += sunLight * pow(facing, 6.0) * (0.12 + 0.3 * pane) * mirror * detail;

        // Fenêtre allumée ? Un seuil par fenêtre (par plateau entier dans les bureaux),
        // comparé à la part du moment. Le seuil bouge un peu toutes les 6 à 20 s : de temps en
        // temps, quelqu'un allume ou éteint.
        float share = home ? homeShare : officeShare;
        if (shop) share = min(1.0, homeShare * 1.3);
        float own = hash12(cell * vec2(1.0, 1.31) + seed * 5.3);
        float key = home || shop ? own : mix(hash12(vec2(seed, cell.y * 3.1)), own, 0.3);
        float period = 6.0 + 14.0 * hash12(cell + seed * 7.7);
        float slot = floor(clock / period + pane * 7.0);
        key += (hash12(cell + vec2(slot * 1.37, seed)) - 0.5) * 0.14;
        float on = step(key, share);

        // Teinte de la lampe : chaude chez soi, néons froids au bureau, télé bleutée.
        float tone = hash12(cell + seed * 11.0);
        vec3 lamp = home
          ? (tone < 0.66 ? vec3(1.0, 0.6, 0.28) : tone < 0.9 ? vec3(1.0, 0.78, 0.5) : vec3(0.42, 0.58, 1.0))
          : (tone < 0.62 ? vec3(0.76, 0.86, 0.96) : vec3(1.0, 0.8, 0.55));
        if (shop) lamp = vec3(1.0, 0.86, 0.6);
        if (home && tone >= 0.9)
          lamp *= 0.7 + 0.3 * detail * sin(clock * (2.0 + tone * 6.0) + seed);
        // Intérieur : plafonnier en haut de la fenêtre, stores à moitié baissés chez certains.
        float inner = mix(0.38, 1.05, smoothstep(win.z, win.w, f.y));
        inner *= 0.55 + 0.45 * hash12(cell * 1.7 + seed);
        float blind = step(0.72, pane) * smoothstep(win.w - 0.3, win.w - 0.28, f.y);
        inner *= mix(1.0, 0.45, blind * detail);
        vec3 lit = lamp * on * glow * mix(inner, 1.0, lod);

        vec3 color = mix(wall, glass + lit, mask);
        gl_FragColor = vec4(color, 1.0);
        ${OUTPUT}
      }`,
  );
}

/** Toits, trottoirs, édicules, parc : la couleur de l'objet (attribut `color`) éclairée. */
export function solidMaterial(
  uniforms: CityUniforms,
  name = 'skyline-solid',
): THREE.ShaderMaterial {
  return cityMaterial(
    name,
    uniforms,
    /* glsl */ `
      ${VERTEX}
      attribute vec3 color;
      varying vec3 vColor;
      void main() {
        vColor = color;
        passWorld();
      }`,
    /* glsl */ `
      #include <fog_pars_fragment>
      ${COMMON}
      uniform float selfLit;
      varying vec3 vColor;
      void main() {
        vec3 color = vColor * cityLight(normalize(vNormal)) + vColor * selfLit;
        gl_FragColor = vec4(color, 1.0);
        ${OUTPUT}
      }`,
  );
}

/** Avenues et rues : la grille de Manhattan est dessinée d'après la position. */
export function streetMaterial(
  uniforms: CityUniforms,
  grid: { avenueSpacing: number; avenueWidth: number; streetSpacing: number; streetWidth: number },
): THREE.ShaderMaterial {
  const f = (value: number) => value.toFixed(3);
  return cityMaterial(
    'skyline-street',
    uniforms,
    /* glsl */ `
      ${VERTEX}
      void main() { passWorld(); }`,
    /* glsl */ `
      #include <fog_pars_fragment>
      ${COMMON}
      uniform vec2 center;
      const float AVE = ${f(grid.avenueSpacing)};
      const float AVE_HALF = ${f(grid.avenueWidth / 2)};
      const float ST = ${f(grid.streetSpacing)};
      const float ST_HALF = ${f(grid.streetWidth / 2)};

      // Ligne de largeur w autour de 0, nette de près, estompée au loin.
      float paint(float d, float w, float fw) {
        return (1.0 - smoothstep(w, w + fw, abs(d))) * (1.0 - smoothstep(0.08, 0.3, fw));
      }

      void main() {
        vec2 p = vWorld.xz - center;
        // Écart à l'axe de l'avenue (le long de z) et de la rue (le long de x) les plus proches.
        float ax = p.x - AVE * floor(p.x / AVE + 0.5);
        float sz = p.y - ST * floor(p.y / ST + 0.5);
        float fw = fwidth(p.x) + fwidth(p.y);
        bool avenue = abs(ax) < AVE_HALF;
        bool street = abs(sz) < ST_HALF;

        vec3 asphalt = vec3(0.2, 0.21, 0.23) * (0.92 + 0.08 * hash12(floor(p * 2.0)));
        float marks = 0.0;
        float dashZ = step(0.45, fract(p.y / 2.4));
        float dashX = step(0.45, fract(p.x / 2.4));
        if (avenue && !street) {
          // Avenue à sens unique, quatre voies séparées par des tirets blancs.
          marks += paint(abs(ax) - 0.8, 0.035, fw) * dashZ + paint(ax, 0.035, fw) * dashZ;
          // Passages piétons au bord des carrefours.
          float edge = abs(sz) - ST_HALF;
          if (edge < 0.55) marks += step(0.5, fract(ax * 2.2)) * (1.0 - smoothstep(0.08, 0.3, fw));
        } else if (street && !avenue) {
          marks += paint(sz, 0.03, fw) * dashX;
          float edge = abs(ax) - AVE_HALF;
          if (edge < 0.55) marks += step(0.5, fract(sz * 2.2)) * (1.0 - smoothstep(0.08, 0.3, fw));
        }
        vec3 color = mix(asphalt, vec3(0.86, 0.86, 0.82), clamp(marks, 0.0, 1.0) * 0.8);
        color *= cityLight(vec3(0.0, 1.0, 0.0));

        // La nuit, flaques orangées des lampadaires (un tous les 6 sur chaque avenue).
        vec2 lamp = vec2(ax + AVE_HALF - 0.2, p.y - 6.0 * floor(p.y / 6.0 + 0.5));
        float pool = exp(-dot(lamp, lamp) * 0.9);
        color += vec3(1.0, 0.62, 0.3) * pool * night * 0.55;
        gl_FragColor = vec4(color, 1.0);
        ${OUTPUT}
      }`,
  );
}

/** Le fleuve : eau sombre qui reflète le ciel, vaguelettes et reflets du soleil. */
export function waterMaterial(uniforms: CityUniforms): THREE.ShaderMaterial {
  return cityMaterial(
    'skyline-water',
    uniforms,
    /* glsl */ `
      ${VERTEX}
      void main() { passWorld(); }`,
    /* glsl */ `
      #include <fog_pars_fragment>
      ${COMMON}
      void main() {
        vec2 p = vWorld.xz;
        float t = clock * detail;
        float ripple = sin(p.x * 1.7 + t * 0.9) * sin(p.y * 0.6 - t * 0.6)
          + 0.5 * sin(p.x * 3.1 - p.y * 1.3 + t * 1.4);
        vec3 deep = vec3(0.05, 0.12, 0.16) * cityLight(vec3(0.0, 1.0, 0.0)) * 1.6;
        vec3 color = mix(deep, horizon * 0.85, 0.42 + 0.08 * ripple);
        float glint = smoothstep(1.05, 1.4, ripple) * (1.0 - night);
        color += sunLight * glint * 0.35 * detail;
        // Reflets des lumières de la ville sur l'eau, la nuit.
        float sparkle = step(0.985, hash12(floor(p * vec2(3.0, 0.8)) + floor(t * 0.5)));
        color += vec3(1.0, 0.8, 0.5) * sparkle * night * 0.5 * detail;
        gl_FragColor = vec4(color, 1.0);
        ${OUTPUT}
      }`,
  );
}
