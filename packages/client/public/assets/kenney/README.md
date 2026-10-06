# Assets Kenney (licence CC0)

Déposer ici les packs Kenney, en gardant leur nom de dossier et leur arborescence d'origine :

```
kenney/
├── kenney_blocky-characters_20/Models/GLB format/character-a.glb … character-r.glb
│                                                └── Textures/texture-a.png … texture-r.png
└── kenney_furniture-kit/Models/GLTF format/<modèle>.glb   (140 modèles)
```

Seuls ces dossiers sont chargés par le jeu ; le reste des packs (FBX, OBJ, aperçus) est inutile.
Les noms de fichiers attendus sont listés dans `src/render/assetManifest.ts`. Si un modèle manque,
le jeu affiche une forme Three.js de remplacement (la partie reste jouable).

Source : https://kenney.nl — licence CC0 1.0 (domaine public).
