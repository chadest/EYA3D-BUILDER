/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Settings and Optimization Options Type Definitions for Eya3D CAD Studio
 */

export type RendererEngineType = 'webgl' | 'webgpu';
export type FpsLimitOption = '30' | '60' | 'max';

export interface OptimizationSettings {
  // Section A: Caches & VRAM Memory Management
  clearCacheOnStartup: boolean;          // Purge auto des caches à l'initialisation du composant 3D
  threeCacheEnabled: boolean;            // Active/Désactive THREE.Cache.enabled
  aggressiveVRAMCleanup: boolean;        // scene.traverse + .dispose() systématique sur géométries & textures
  browserNetworkCacheBypass: boolean;    // Désactive/vide CacheStorage pour garantir la fraîcheur UI
  cacheBusting3D: boolean;               // Injection dynamique de ?v=timestamp sur les URLs de textures & GLTF

  // Section B: Render Engine Settings & Advanced Switches
  primaryRenderer: RendererEngineType;   // 'webgl' (stable standard) vs 'webgpu' (expérimental)
  highPerformanceGPU: boolean;           // powerPreference: "high-performance" (active GPU dédié Nvidia/AMD)
  dracoWorkerMultithreading: boolean;    // Décodage géométrie multithreadé via Web Workers & DRACOLoader
  
  // Nouveaux Switchs d'Optimisation Avancée Three.js
  ecoStaticShadows: boolean;             // Ombres Éco / Fixes (renderer.shadowMap.autoUpdate = false)
  fpsLimiterEnabled: boolean;            // Limiteur de FPS activé
  fpsLimit: FpsLimitOption;              // Palier de limitation FPS ('30', '60', 'max')
  hardwareAntialias: boolean;            // Anticrénelage matériel (antialias WebGLRenderer / scaling pixel ratio)
  aggressiveFrustumCulling: boolean;     // Masquage hors-champ agressif (force mesh.frustumCulled = true)
  antiFreezeDetectorEnabled: boolean;    // Détecteur Anti-Freeze Actif (Surveillance Web Worker >1500ms)
  antiFreezeThresholdMs: number;         // Seuil de détection du freeze en millisecondes (défaut: 1500ms)

  // Section C: Automation & Periodic System
  periodicAutoOptimization: boolean;     // Garbage collector Three.js périodique
  autoOptimizationIntervalMinutes: number;// Intervalle de nettoyage VRAM (en minutes, ex: 3, 5, 10, 15)
}

export type SupportedLanguage = 'fr' | 'en' | 'de' | 'es' | 'ja' | 'zh';

export interface LanguageInfo {
  code: SupportedLanguage;
  name: string;
  nativeName: string;
  flag: string;
}

export type ThemeStyle = 'dark' | 'night' | 'light';

export interface ThemeSettings {
  mode: ThemeStyle;
  accentColor: string;
  highContrast: boolean;
  viewportBgStyle: 'dark_charcoal' | 'deep_night' | 'studio_slate' | 'neutral_light';
}

export interface ShortcutItem {
  id: string;
  category: 'Navigation & Vue' | 'Édition & Maillage' | 'Transformations' | 'Système & Historique';
  action: string;
  shortcut: string[];
  description?: string;
}

export interface SettingsOptions {
  activeTab: 'optimization' | 'languages' | 'themes' | 'shortcuts';
  optimization: OptimizationSettings;
  theme: ThemeSettings;
  language: SupportedLanguage;
}

export const DEFAULT_OPTIMIZATION_SETTINGS: OptimizationSettings = {
  clearCacheOnStartup: true,
  threeCacheEnabled: true,
  aggressiveVRAMCleanup: true,
  browserNetworkCacheBypass: false,
  cacheBusting3D: true,
  primaryRenderer: 'webgl',
  highPerformanceGPU: true,
  dracoWorkerMultithreading: true,
  ecoStaticShadows: false,
  fpsLimiterEnabled: false,
  fpsLimit: '60',
  hardwareAntialias: true,
  aggressiveFrustumCulling: true,
  antiFreezeDetectorEnabled: true,
  antiFreezeThresholdMs: 1500,
  periodicAutoOptimization: true,
  autoOptimizationIntervalMinutes: 5,
};

export const SUPPORTED_LANGUAGES: LanguageInfo[] = [
  { code: 'fr', name: 'Français', nativeName: 'Français (France)', flag: '🇫🇷' },
  { code: 'en', name: 'English', nativeName: 'English (US)', flag: '🇺🇸' },
  { code: 'de', name: 'Allemand', nativeName: 'Deutsch', flag: '🇩🇪' },
  { code: 'es', name: 'Espagnol', nativeName: 'Español', flag: '🇪🇸' },
  { code: 'ja', name: 'Japonais', nativeName: '日本語', flag: '🇯🇵' },
  { code: 'zh', name: 'Chinois', nativeName: '简体中文', flag: '🇨🇳' },
];

export const DEFAULT_SHORTCUTS: ShortcutItem[] = [
  {
    id: 'undo',
    category: 'Système & Historique',
    action: 'Annuler la dernière action',
    shortcut: ['Ctrl', 'Z'],
    description: 'Restaure l’état précédent de la géométrie ou de l’objet',
  },
  {
    id: 'redo',
    category: 'Système & Historique',
    action: 'Rétablir la dernière action',
    shortcut: ['Ctrl', 'Y'],
    description: 'Réapplique l’action annulée',
  },
  {
    id: 'delete_obj',
    category: 'Système & Historique',
    action: 'Supprimer la sélection',
    shortcut: ['Suppr', '/ Backspace'],
    description: 'Supprime l’objet ou l’élément sélectionné avec libération VRAM',
  },
  {
    id: 'orbit',
    category: 'Navigation & Vue',
    action: 'Rotation orbitale de la caméra',
    shortcut: ['Clic Droit', 'ou Clic Gauche + Drag'],
    description: 'Fait pivoter la vue 3D autour du centre cible',
  },
  {
    id: 'pan',
    category: 'Navigation & Vue',
    action: 'Translation de vue (Pan)',
    shortcut: ['Shift', '+ Clic Droit'],
    description: 'Déplace le plan de caméra latéralement',
  },
  {
    id: 'zoom',
    category: 'Navigation & Vue',
    action: 'Zoom avant / arrière',
    shortcut: ['Molette Souris'],
    description: 'Ajuste la distance focale de la caméra',
  },
  {
    id: 'translate',
    category: 'Transformations',
    action: 'Gizmo Déplacement (Position)',
    shortcut: ['G', 'ou W'],
    description: 'Active le manipulateur de translation d’axe XYZ',
  },
  {
    id: 'rotate',
    category: 'Transformations',
    action: 'Gizmo Rotation',
    shortcut: ['R', 'ou E'],
    description: 'Active le manipulateur de rotation angulaire',
  },
  {
    id: 'scale',
    category: 'Transformations',
    action: 'Gizmo Échelle (Scale)',
    shortcut: ['S'],
    description: 'Active le manipulateur de redimensionnement',
  },
  {
    id: 'edit_mode',
    category: 'Édition & Maillage',
    action: 'Basculer Mode Objet / Mode Édition',
    shortcut: ['Tab'],
    description: 'Permet d’accéder aux sommets, arêtes et faces',
  },
  {
    id: 'extrude',
    category: 'Édition & Maillage',
    action: 'Extrusion de face sélectionnée',
    shortcut: ['E'],
    description: 'Génère de nouvelles faces le long de la normale',
  },
  {
    id: 'inset',
    category: 'Édition & Maillage',
    action: 'Insertion de face (Inset)',
    shortcut: ['I'],
    description: 'Rétrécit les polygones sélectionnés vers l’intérieur',
  },
  {
    id: 'wireframe',
    category: 'Navigation & Vue',
    action: 'Affichage Filaire (Wireframe)',
    shortcut: ['Z', 'ou Bouton Oeil'],
    description: 'Affiche la structure topologique polygonale',
  },
];
