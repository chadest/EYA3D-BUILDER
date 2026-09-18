# Eya3D — Studio de Modélisation 3D, CAO & Rendu Professionnel dans le Navigateur

**Eya3D** est une application web complète (SaaS) de création et de modélisation 3D professionnelle s'exécutant directement dans le navigateur. Alliant la puissance d'un logiciel de CAO (DAO 2D/3D), d'un modeleur polygonal avancé, d'un atelier de sculpture numérique et d'un moteur de rendu temps réel, Eya3D offre un environnement fluide, réactif et sans installation.

---

## Sommaire

1. [Vue d'Ensemble & Points Forts](#vue-densemble--points-forts)
2. [Modes de Travail Principaux](#modes-de-travail-principaux)
   - [Mode Objet (Object)](#1-mode-objet-object)
   - [Mode Édition Polygonale (Edit)](#2-mode-édition-polygonale-edit)
   - [Mode Sculpture Numérique (Sculpt)](#3-mode-sculpture-numérique-sculpt)
   - [Mode Dessin CAO 2D & Courbes (Curve)](#4-mode-dessin-cao-2d--courbes-curve)
   - [Mode Opérations Booléennes CSG (CSG)](#5-mode-opérations-booléennes-csg-csg)
   - [Mode Modificateurs Paramétriques (Parametric)](#6-mode-modificateurs-paramétriques-parametric)
   - [Mode Déformations Complexes (Deform)](#7-mode-déformations-complexes-deform)
   - [Mode Squelettes & Rigging (Rigging)](#8-mode-squelettes--rigging-rigging)
   - [Mode Animation & Ligne de Temps (Animation)](#9-mode-animation--ligne-de-temps-animation)
   - [Mode Simulation Physique (Simulation)](#10-mode-simulation-physique-simulation)
3. [Outils de Primitives & Création Interactive](#outils-de-primitives--création-interactive)
4. [Moteur de Rendu, Studio & Matériaux PBR](#moteur-de-rendu-studio--matériaux-pbr)
5. [Outils de Mesure & Inspection Métrique](#outils-de-mesure--inspection-métrique)
6. [Importation & Exportation (I/O)](#importation--exportation-io)
7. [Éditeur de Scripts & Assistant IA Gemini](#éditeur-de-scripts--assistant-ia-gemini)
8. [Performances, Optimisations & Protection Anti-Gel](#performances-optimisations--protection-anti-gel)
9. [Interface, Thèmes & Raccourcis Clavier](#interface-thèmes--raccourcis-clavier)
10. [Architecture Technique & Dépendances](#architecture-technique--dépendances)
11. [Installation & Lancement](#installation--lancement)
12. [Déploiement Statique sur GitHub Pages](#déploiement-statique-sur-github-pages)

---

## Vue d'Ensemble & Points Forts

- **100% dans le navigateur** : Aucune installation lourde requise, propulsé par WebGL / Three.js et React 19.
- **Workflow hybride CAO & Artistique** : Passez instantanément d'un tracé 2D précis avec courbes de Bézier à une extrusion 3D, puis à la sculpture organique ou aux opérations booléennes solides.
- **Pile de modificateurs non-destructifs** : Subdivision de surface Catmull-Clark, symétrie miroir, réseaux répétitifs (Array) et cages Lattice.
- **Précision métrique et accrochage intelligent** : Système de magnétisme (Snapping) sur sommets, milieux, centres, intersections, angles et grille.
- **Architecture full-stack moderne** : Client React 19 ultra-optimisé avec serveur Express Node.js pour les intégrations d'intelligence artificielle Gemini.

---

## Modes de Travail Principaux

Eya3D propose 10 modes de travail dédiés, accessibles via le sélecteur central supérieur ou la barre d'outils dynamique :

### 1. Mode Objet (`Object`)
- **Sélection globale** : Sélection unique ou par boîte/lasso d'objets dans la scène 3D.
- **Gizmos de transformation 3D** :
  - Translation (flèches d'axes X, Y, Z).
  - Rotation (anneaux d'orientation avec pas angulaire paramétrable).
  - Échelle (mise à l'échelle uniforme ou par composante).
- **Gestion de la hiérarchie** : Outliner complet (arborescence des objets, visibilité on/off, mode fil de fer / wireframe, renommage, suppression, duplication rapide).
- **Repères de coordonnées** : Coordonnées globales (Monde) ou locales (Objet).

### 2. Mode Édition Polygonale (`Edit`)
- **Niveaux de sous-sélection** :
  - **Sommets (Vertices)** : Déplacement précis, fusion de sommets (Merge vertices by distance / center).
  - **Arêtes (Edges)** : Déplacement, biseau (Bevel d'arêtes), division.
  - **Faces (Faces)** : Sélection par clic ou boucle (Loop select).
- **Opérations de modélisation fondamentales** :
  - **Extrusion (`E`)** : Extrusion de faces individuelles ou de régions le long de la normale.
  - **Insertion / Décrochement (`I` - Inset)** : Création de faces intérieures concentriques.
  - **Biseau (`Ctrl+B` - Bevel)** : Arrondi d'arêtes ou de sommets avec nombre de segments réglable.
  - **Coupe en boucle (`Ctrl+R` - Loop Cut)** : Insertion d'anneaux d'arêtes le long des boucles de polygones.
  - **Pont (`Bridge Faces`)** : Raccordement automatique entre deux contours ou sélections de faces.
  - **Recalcul et inversion des normales** : Correction des faces inversées pour un ombrage net.

### 3. Mode Sculpture Numérique (`Sculpt`)
- **9 pinceaux de sculpture numérique** :
  1. **Standard Sculpt (Push / Pull)** : Élévation ou creusement selon la direction de la normale.
  2. **Clay (Argile)** : Accumulation de matière organique par bandes successives.
  3. **Inflate (Gonflement)** : Dilatation volumétrique uniforme de la surface.
  4. **Smooth (Lissage)** : Atténuation des irrégularités et adoucissement de la surface (`Shift + Glisser`).
  5. **Flatten (Aplatissement)** : Rabotage de la surface selon un plan moyen local.
  6. **Pinch (Pincement)** : Rapprochement des sommets vers le centre du curseur pour des plis vifs.
  7. **Grab (Tirage élastique)** : Déplacement souple d'une région entière de la géométrie.
  8. **Snakehook** : Étirement de cornes, pointes et excroissances organiques fluides.
  9. **Mask (Masquage)** : Protection de zones contre les déformations du pinceau.
- **Gizmo interactif de pinceau** :
  - Ajustement visuel en temps réel du rayon (`F` + mouvement souris) et de la force (`Shift+F`).
  - Affichage tête haute du rayon en unités métriques et du pourcentage de force.
- **Symétrie de sculpture** : Sculpture en miroir sur les axes X, Y ou Z.
- **Matcaps de sculpture** : Rendu en matcap argile, cire rouge, métal poli ou nacre pour évaluer précisément les volumes.

### 4. Mode Dessin CAO 2D & Courbes (`Curve`)
- **Plan de travail 2D orthogonal verrouillé ($Z=0$)** :
  - La caméra s'aligne automatiquement face au plan XY.
  - Les rotations 3D de caméra sont strictement bloquées durant le dessin afin d'éviter tout décalage géométrique non désiré.
- **Outil Courbe de Bézier (Plume CAO)** :
  - Pose de points d'ancrage successifs.
  - Déploiement et orientation des tangentes opposées par simple glissement à la création.
  - Fermeture automatique du contour par clic sur le premier sommet ou validation de courbe ouverte avec la touche **Entrée**.
- **Bibliothèque d'outils de tracé CAO** :
  - **Ligne (`L`)** : Segments chaînés ou isolés.
  - **Rectangle (`R`)** : Rectangles orthogonaux par deux coins opposés.
  - **Cercle (`C`)** : Cercles définis par centre et rayon.
  - **Arc 3 points** : Arcs de cercle définis par centre, point de départ et point d'arrivée.
  - **Spline interpolée** : Courbes passant par une série de points de passage.
  - **Rogner (Trim)** : Découpe de segments au croisement d'autres tracés.
  - **Prolonger (Extend)** : Extension d'une ligne jusqu'à l'entité frontière la plus proche.
  - **Congé (Fillet)** : Raccord arrondi entre deux lignes sécantes.
  - **Décalage (Offset)** : Copie parallèle équidistante d'un contour.
- **Système d'accrochage magnétique intelligent (Snap Points)** :
  - Extrémités (`ENDPOINT`), milieux de segments (`MIDPOINT`), centres de courbure (`CENTER`), intersections de lignes (`INTERSECTION`), pas de grille (`GRID`) et tangentes.
- **Conversion 2D vers 3D & Bascule fluide** :
  - Détection automatique des boucles fermées et calcul d'aire.
  - **Bouton « Extruder 3D »** : Génération instantanée d'un maillage 3D solide à la hauteur souhaitée avec bascule automatique vers la vue 3D d'inspection.
  - **Bouton « Révolution 360° (Lathe) »** : Création de pièces de révolution autour d'un axe.
  - **Bouton « Basculer 3D »** : Passage instantané entre vue 2D orthogonale verrouillée et perspective 3D libre.

### 5. Mode Opérations Booléennes CSG (`CSG`)
- **Moteur CSG haute précision** : Intégration de `three-bvh-csg` et `manifold-3d`.
- **Opérations supportées** :
  - **Union** : Fusion de deux solides en un maillage étanche unique.
  - **Différence (Soustraction)** : Découpe d'un volume par un autre (perçage, encastrement).
  - **Intersection** : Conservation exclusive du volume commun aux deux solides.
- **Contrôle visuel** : Sélection de l'objet primaire (cible) et de l'objet secondaire (outil) avec aperçu des arêtes résultantes.

### 6. Mode Modificateurs Paramétriques (`Parametric`)
- **Subdivision de surface (Catmull-Clark)** :
  - Lissage organique non-destructif de 1 à 3 niveaux.
  - Prise en charge des poids de plis (Crease weights) pour conserver des arêtes vives.
- **Réseau Répétitif (Array)** :
  - Duplication en nombre fixe d'exemplaires selon un vecteur de translation configurable.
  - Décalage relatif ou absolu.
- **Symétrie Miroir (Mirror)** :
  - Symétrie automatique par rapport aux plans X, Y ou Z.
  - Soudure automatique des sommets situés sur le plan de symétrie (Merge threshold).

### 7. Mode Déformations Complexes (`Deform`)
- **Torsion (Twist)** : Torsion paramétrique de la géométrie le long d'un axe avec angle en degrés.
- **Courbure (Bend)** : Flexion progressive de l'objet selon un angle et un rayon définis.
- **Cage Lattice (FFD - Free-Form Deformation)** :
  - Grille de contrôle englobante 3D ($3\times 3\times 3$).
  - Déformation souple des sommets de l'objet en manipulant les points de la cage.

### 8. Mode Squelettes & Rigging (`Rigging`)
- **Création de chaînes d'os (Bones / Squelette)** :
  - Arborescence hiérarchique de joints articulés.
  - Préréglages de squelettes (humanoïde bipède, quadrupède, colonne vertébrale).
- **Skinning & Auto-Weighting** :
  - Calcul automatique des poids d'influence par distance harmonique.
- **Ajustement du point de pivot (Origin)** :
  - Déplacement du centre de gravité ou du point d'ancrage sans modifier la position des sommets.

### 9. Mode Animation & Ligne de Temps (`Animation`)
- **Ligne de temps (Timeline) intégrée** :
  - Règle temporelle graduée en images (Frames).
  - Boutons de lecture, pause, avance image par image et boucle.
- **Pose & Clés d'animation (Keyframes)** :
  - Enregistrement des positions, rotations et échelles sur la timeline.
  - Interpolation fluide entre images clés.
- **Mode Plateau Tournant (Turntable)** :
  - Rotation automatique à 360° pour la présentation et l'inspection de vitrine.

### 10. Mode Simulation Physique (`Simulation`)
- **Moteur Rapier 3D** :
  - Simulation de dynamique des corps rigides (Rigid Bodies).
  - Définition de la gravité, de la masse, du coefficient de restitution (rebond) et du frottement.
  - Collisions précises (boîtes, sphères, coques convexes et maillages concaves).

---

## Outils de Primitives & Création Interactive

Eya3D intègre deux méthodes de création d'objets :
1. **Ajout instantané au centre** : Cube, Sphère UV, Cylindre, Cône, Tore, Plan, Étoile paramétrique, Texte 3D extrudé.
2. **Mode de tracé interactif (Main levée)** :
   - Clic sur la grille ou sur la surface d'un objet existant pour poser le point d'ancrage.
   - Glissement pour définir les dimensions de la base (largeur/profondeur ou rayon).
   - Élévation du curseur pour extruder la hauteur voulue avec accrochage métrique en direct.

---

## Moteur de Rendu, Studio & Matériaux PBR

- **Matériaux Physically Based Rendering (PBR)** :
  - Couleur diffuse (Albédo).
  - Rugosité (Roughness) et Métallance (Metalness).
  - Couleur émissive et intensité de luminescence.
  - Bascule entre ombrage plat (Flat Shading) et ombrage lissé (Smooth Shading).
  - Répétition des coordonnées de texture (UV Tiling).
- **Préréglages d'éclairage de studio** :
  - Studio neutre (Softbox équilibrée).
  - Éclairage 3 points classique (Key light, Fill light, Rim light).
  - Extérieur plein soleil avec ombres directionnelles douces.
  - Coucher de soleil aux teintes chaudes.
  - Ambiance Cyberpunk néon.
- **Superposition de contrôle** :
  - Affichage fil de fer (Wireframe overlay).
  - Grille de travail infinie et axes cardinaux repères.
  - Caméra perspective ou orthogonale avec widget d'orientation visuelle (ViewCube).

---

## Outils de Mesure & Inspection Métrique

- **Outil Règle / Mesure de distance** : Clic entre deux points ou sommets pour mesurer la distance euclidienne exacte.
- **Rapporteur d'angle** : Mesure de l'angle formé par 3 points dans l'espace.
- **Boîte englobante (Bounding Box)** : Affichage des dimensions hors-tout ($X \times Y \times Z$) en mètres ou millimètres.
- **Affichage tête haute (HUD)** : Rendu des cotes directement sur le canvas 3D.

---

## Importation & Exportation (I/O)

- **Importation** :
  - Glisser-déposer de fichiers directement sur la scène ou via le menu d'importation.
  - Formats supportés : `.gltf`, `.glb`, `.obj`, `.stl`, `.ply`.
- **Exportation** :
  - **GLTF / GLB** : Standard de l'industrie pour le web, le jeu vidéo et les métavers.
  - **OBJ (+ MTL)** : Format universel compatible Blender, Maya, 3ds Max.
  - **STL** : Modèle triangulé prêt pour l'impression 3D.
  - **USDZ** : Fichier optimisé pour la réalité augmentée sur iOS / Apple Vision Pro.
  - **SVG** : Export vectoriel 2D des esquisses CAO.

---

## Éditeur de Scripts & Assistant IA Gemini

- **Console de Script Monaco Editor** :
  - Éditeur de code intégré avec coloration syntaxique et complétion TypeScript.
  - API scriptable pour générer procéduralement des maillages, modifier des sommets ou automatiser des opérations répétitives.
- **Assistant IA Gemini intégré** :
  - Génération de code 3D et de géométries procédurales à partir de descriptions en langage naturel.
  - Conseils méthodologiques de modélisation et résolution de problèmes de topologie.

---

## Performances, Optimisations & Protection Anti-Gel

- **Moteur d'optimisation Three.js (`ThreeOptimizationEngine`)** :
  - Limiteur de rafraîchissement adaptatif (30 FPS, 60 FPS, 120 FPS ou illimité).
  - Élimination propre des tampons de géométrie et des textures (Memory Disposal) pour éviter les fuites de mémoire.
  - Utilisation de BVH (`three-mesh-bvh`) pour accélérer les raycasts de sélection et de sculpture à plusieurs centaines de milliers de polygones.
- **Bannière d'urgence anti-freeze** :
  - Détection automatique des temps d'exécution prolongés.
  - Bouton d'interruption sécurisée permettant de restaurer immédiatement le contrôle sans perdre la scène.
- **Système d'historique robuste** : Annulation (`Ctrl+Z`) et Rétablissement (`Ctrl+Y` / `Ctrl+Shift+Z`) fiables avec instantanés de mémoire légers.

---

## Interface, Thèmes & Raccourcis Clavier

- **Thèmes visuels** : Thème Sombre Studio professionnel, Sombre Ardoise et Clair Minimaliste.
- **Internationalisation** : Interface multilingue (Français, Anglais).
- **Raccourcis clavier majeurs** :
  - `Espace` : Barre d'outils contextuelle / Menu circulaire.
  - `G` / `T` : Outil Déplacement (Translate).
  - `R` : Outil Rotation.
  - `S` : Outil Échelle (Scale).
  - `Tab` : Bascule Mode Objet $\leftrightarrow$ Mode Édition.
  - `E` (en mode édition) : Extruder.
  - `I` (en mode édition) : Inset (insérer face).
  - `Ctrl + B` (en mode édition) : Bevel (biseau).
  - `Ctrl + R` (en mode édition) : Loop Cut (coupe en boucle).
  - `F` (en mode sculpture) : Ajuster le rayon du pinceau.
  - `Shift + F` (en mode sculpture) : Ajuster la force du pinceau.
  - `Échap` : Annuler l'outil actif ou le tracé en cours.
  - `Suppr` / `Retour arrière` : Supprimer la sélection.
  - `Ctrl + Z` / `Ctrl + Y` : Annuler / Rétablir.

---

## Architecture Technique & Dépendances

```
eya3d/
├── src/
│   ├── components/
│   │   ├── drawing/        # Affichage tête haute et outils d'esquisse 2D
│   │   ├── ui/             # Barres d'outils, étagère d'outils, outliner, inspecteur, modales
│   │   └── viewport/       # Composant Viewport3D, caméra, contrôles de scène et raycast
│   ├── core/
│   │   ├── csg/            # Moteur d'opérations booléennes (Manifold 3D & BVH)
│   │   ├── deformation/    # Torsion, courbure et Lattice FFD
│   │   ├── drawing/        # Moteur de dessin CAO 2D (Bézier, lignes, profils, extrusion)
│   │   ├── export/         # Exportateurs GLTF, OBJ, STL, USDZ
│   │   ├── geometry/       # Utilitaires de manipulation de maillage et de normales
│   │   ├── history/        # Gestionnaire de pile d'annulation/rétablissement
│   │   ├── io/             # Moteur de chargement et d'import/export de fichiers
│   │   ├── measurement/    # Outils de métrologie et de cotes
│   │   ├── optimization/   # Régulation de FPS, nettoyage de mémoire et accélération BVH
│   │   ├── parametric/     # Modificateurs SubD, Array, Mirror
│   │   ├── physics/        # Simulation dynamique Rapier
│   │   ├── primitives/     # Génération de primitives et dessin interactif
│   │   ├── rendering/      # Éclairages studio, ombrages et gestionnaire PBR
│   │   ├── rigging/        # Chaînes d'os, squelettes et pondération
│   │   ├── sculpting/      # Pinceaux de sculpture, gizmos de rayon/force
│   │   ├── splines/        # Évaluation et extrusion le long de courbes
│   │   └── subd/           # Algorithmes de subdivision Catmull-Clark
│   ├── store/
│   │   └── EditorStore.ts  # État global réactif de l'éditeur (State Management)
│   └── types/              # Définitions TypeScript complètes
├── server.ts               # Serveur backend Express + intégration Gemini API
└── package.json            # Dépendances et scripts de build
```

---

## Installation & Lancement

### Prérequis
- **Node.js** version 18 ou supérieure.
- Gestionnaire de paquets **npm** ou **yarn**.

### 1. Installation des dépendances
```bash
npm install
```

### 2. Démarrage en mode développement
Lance le serveur de développement avec rechargement à chaud et middleware Vite :
```bash
npm run dev
```
L'application sera accessible sur `http://localhost:3000`.

### 3. Vérification du code (Linter)
```bash
npm run lint
```

### 4. Compilation pour la production
Génère le paquet statique optimisé dans le dossier `dist/` et compile le serveur CommonJS :
```bash
npm run build
```

### 5. Démarrage en production
```bash
npm start
```

---

## Déploiement Statique sur GitHub Pages

L'ensemble du moteur de modélisation 3D, de CAO 2D, de sculpture, de rendu PBR et de simulation physique s'exécute à 100% côté client dans le navigateur WebGL. L'application peut donc être hébergée comme un site statique gratuit et performant sur **GitHub Pages**.

### 1. Configuration automatique (Recommandée via GitHub Actions)
Un workflow GitHub Actions est prêt à l'emploi dans `.github/workflows/deploy.yml`.

1. Poussez votre code sur votre dépôt GitHub :
   ```bash
   git add .
   git commit -m "feat: configuration déploiement statique GitHub Pages"
   git push origin main
   ```
2. Rendez-vous sur votre dépôt GitHub dans le navigateur.
3. Cliquez sur **Settings** > **Pages** (dans le menu de gauche).
4. Dans la section **Build and deployment** :
   - Sous **Source**, sélectionnez **GitHub Actions**.
5. C'est tout ! Dès chaque nouveau push sur la branche `main` (ou `master`), le workflow compile automatiquement le bundle statique (`npm run build:static`) et déploie le site sur :
   `https://<votre-nom-utilisateur>.github.io/<nom-du-depot>/`

### 2. Déploiement manuel local (Optionnel)
Si vous préférez générer vous-même les fichiers statiques sans GitHub Actions :
```bash
# Compiler le site statique dans le dossier dist/
npm run build:static

# Déployer dist/ sur la branche gh-pages (avec npx gh-pages par exemple)
npx gh-pages -d dist
```

---

## Licence

Projet sous licence propriétaire **Eya3D**. Tous droits réservés.
