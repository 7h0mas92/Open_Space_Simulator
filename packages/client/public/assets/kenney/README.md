# Assets Kenney (licence CC0)

Les packs Kenney utilisés par le jeu sont versionnés ici, avec leur nom de dossier et leur
arborescence d'origine (copiés depuis les packs téléchargés sur kenney.nl le 2026-10-06) :

```
kenney/
├── kenney_blocky-characters_20/Models/GLB format/character-a.glb … character-r.glb
│                                                └── Textures/texture-a.png … texture-r.png
└── kenney_furniture-kit/Models/GLTF format/<modèle>.glb   (140 modèles)
```

Seuls ces dossiers ont été copiés, avec le `License.txt` de chaque pack : le reste des packs
(FBX, OBJ, aperçus) est inutile au jeu. Un test unitaire vérifie que chaque fichier du manifeste
est bien présent ici.
Les noms de fichiers attendus sont listés dans `src/render/assetManifest.ts`. Si un modèle manque,
le jeu affiche une forme Three.js de remplacement (la partie reste jouable).

Source : https://kenney.nl — licence CC0 1.0 (domaine public).
