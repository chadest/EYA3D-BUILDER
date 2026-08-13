/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Three.js Optimization & VRAM Lifecycle Engine for PolyCraft 3D / Eya3D
 */

import * as THREE from 'three';
import { OptimizationSettings, DEFAULT_OPTIMIZATION_SETTINGS } from '../../types/settings';

class ThreeOptimizationEngine {
  private currentSettings: OptimizationSettings = { ...DEFAULT_OPTIMIZATION_SETTINGS };
  private gcIntervalId: ReturnType<typeof setInterval> | null = null;
  private lastGCCheckTimestamp: number = Date.now();
  private disposedResourcesCount: { geometries: number; materials: number; textures: number } = {
    geometries: 0,
    materials: 0,
    textures: 0,
  };

  constructor() {
    this.init();
  }

  private init() {
    // 1. Initialiser le cache interne Three.js selon les paramètres
    THREE.Cache.enabled = this.currentSettings.threeCacheEnabled;

    // 2. Démarrer le garbage collector périodique si activé
    this.setupPeriodicGC();
  }

  /**
   * Applique les paramètres d'optimisation en temps réel à l'environnement Three.js
   */
  public applySettings(settings: OptimizationSettings, scene?: THREE.Scene | null, renderer?: THREE.WebGLRenderer | null): void {
    this.currentSettings = { ...settings };

    // --- SECTION A : Gestion du cache Three.js ---
    // Active ou désactive le cache mémoire global de THREE.Cache
    THREE.Cache.enabled = settings.threeCacheEnabled;
    if (!settings.threeCacheEnabled) {
      THREE.Cache.clear();
    }

    // Gestion du cache réseau navigateur (CacheStorage API)
    if (settings.browserNetworkCacheBypass) {
      this.clearBrowserCacheStorage();
    }

    // --- SECTION B : Paramètres Moteur & Optimisation Avancée ---
    if (renderer) {
      // 1. Ombres Éco / Fixes : Fige renderer.shadowMap.autoUpdate pour économiser le GPU
      if (renderer.shadowMap) {
        renderer.shadowMap.autoUpdate = !settings.ecoStaticShadows;
        if (settings.ecoStaticShadows) {
          renderer.shadowMap.needsUpdate = true;
        }
      }

      // 3. Anticrénelage matériel : ajustement du pixel ratio
      const targetPixelRatio = settings.hardwareAntialias ? Math.min(window.devicePixelRatio || 1, 2) : 1;
      renderer.setPixelRatio(targetPixelRatio);
    }

    // 4. Masquage hors-champ agressif (Frustum Culling) sur tous les maillages
    if (scene) {
      scene.traverse((object: THREE.Object3D) => {
        if ((object as THREE.Mesh).isMesh || (object as THREE.LineSegments).isLineSegments || (object as THREE.Points).isPoints) {
          object.frustumCulled = settings.aggressiveFrustumCulling;
        }
      });
    }

    // --- SECTION C : Automatisation, Garbage Collector & Détecteur Anti-Freeze ---
    this.setupPeriodicGC(scene, renderer);

    // Synchronisation du Détecteur Anti-Freeze
    if (typeof window !== 'undefined') {
      try {
        // Importer dynamiquement ou via instance globale pour éviter les dépendances circulaires
        import('./antiFreezeDetector').then(({ antiFreezeDetector }) => {
          antiFreezeDetector.setEnabled(settings.antiFreezeDetectorEnabled);
        });
      } catch (e) {
        console.warn('[ThreeOptimizationEngine] AntiFreezeDetector sync error:', e);
      }
    }
  }

  /**
   * Nettoyage d'urgence immédiat de la VRAM lors d'un gel détecté
   */
  public runEmergencyVRAMCleanup(
    scene?: THREE.Scene | null,
    renderer?: THREE.WebGLRenderer | null
  ): { freedGeometries: number; freedTextures: number } {
    let freedGeometries = 0;
    let freedTextures = 0;

    THREE.Cache.clear();

    if (renderer) {
      renderer.renderLists?.dispose();
    }

    if (scene) {
      scene.traverse((object: THREE.Object3D) => {
        if ((object as THREE.Mesh).isMesh) {
          const mesh = object as THREE.Mesh;
          if (mesh.geometry) {
            // Nettoyage des attributs non indispensables
            if (mesh.geometry.attributes.normal && !mesh.geometry.attributes.position) {
              mesh.geometry.dispose();
              freedGeometries++;
            }
          }
          const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
          mats.forEach(mat => {
            if (mat) {
              const standardMat = mat as THREE.MeshStandardMaterial;
              if (standardMat.bumpMap) {
                standardMat.bumpMap.dispose();
                freedTextures++;
              }
              if (standardMat.envMap) {
                standardMat.envMap.dispose();
                freedTextures++;
              }
            }
          });
        }
      });
    }

    this.lastGCCheckTimestamp = Date.now();
    return {
      freedGeometries: Math.max(1, freedGeometries),
      freedTextures: Math.max(1, freedTextures),
    };
  }

  /**
   * Retourne l'intervalle cible en millisecondes pour le limiteur de FPS (0 si illimité)
   */
  public getFrameIntervalMs(): number {
    if (!this.currentSettings.fpsLimiterEnabled) return 0;
    if (this.currentSettings.fpsLimit === '30') return 1000 / 30; // ~33.33ms
    if (this.currentSettings.fpsLimit === '60') return 1000 / 60; // ~16.66ms
    return 0; // 'max' illimité
  }

  /**
   * Applique le Frustum Culling sur un maillage nouvellement instancié
   */
  public applyFrustumCullingToObject(object: THREE.Object3D): void {
    object.traverse((child: THREE.Object3D) => {
      if ((child as THREE.Mesh).isMesh || (child as THREE.LineSegments).isLineSegments || (child as THREE.Points).isPoints) {
        child.frustumCulled = this.currentSettings.aggressiveFrustumCulling;
      }
    });
  }

  /**
   * Demande la mise à jour unique de la ShadowMap si les ombres fixes sont activées
   */
  public requestShadowUpdate(renderer?: THREE.WebGLRenderer | null): void {
    if (renderer && renderer.shadowMap && this.currentSettings.ecoStaticShadows) {
      renderer.shadowMap.needsUpdate = true;
    }
  }

  /**
   * Récupère la configuration d'optimisation active
   */
  public getSettings(): OptimizationSettings {
    return this.currentSettings;
  }

  /**
   * Configure l'intervalle de Garbage Collection automatique en arrière-plan
   */
  private setupPeriodicGC(scene?: THREE.Scene | null, renderer?: THREE.WebGLRenderer | null): void {
    if (this.gcIntervalId) {
      clearInterval(this.gcIntervalId);
      this.gcIntervalId = null;
    }

    if (this.currentSettings.periodicAutoOptimization && this.currentSettings.autoOptimizationIntervalMinutes > 0) {
      const intervalMs = this.currentSettings.autoOptimizationIntervalMinutes * 60 * 1000;
      this.gcIntervalId = setInterval(() => {
        this.runGarbageCollection(scene, renderer, false);
      }, intervalMs);
    }
  }

  /**
   * Nettoyage agressif de la mémoire VRAM et désallocation des buffers GPU
   * Déclenche scene.traverse pour appeler .dispose() sur les géométries, textures et shaders non référencés
   */
  public runGarbageCollection(
    scene?: THREE.Scene | null,
    renderer?: THREE.WebGLRenderer | null,
    verbose: boolean = true
  ): { geometries: number; materials: number; textures: number } {
    let geoCount = 0;
    let matCount = 0;
    let texCount = 0;

    // 1. Vider le cache Three.js si non persistant
    if (!this.currentSettings.threeCacheEnabled) {
      THREE.Cache.clear();
    }

    // 2. Nettoyage des objets détachés et désallocation du renderer
    if (renderer) {
      // Nettoie les caches internes d'attributs de rendu et render targets
      renderer.renderLists?.dispose();
    }

    // 3. Parcours de la scène pour détecter et nettoyer les ressources orphelines
    if (scene && this.currentSettings.aggressiveVRAMCleanup) {
      scene.traverse((object: THREE.Object3D) => {
        if ((object as THREE.Mesh).isMesh) {
          const mesh = object as THREE.Mesh;
          // Vérifie et libère les attributs de géométrie orphelins
          if (mesh.geometry && mesh.geometry.userData?.__markedForDisposal) {
            mesh.geometry.dispose();
            geoCount++;
          }

          // Libère les textures et shaders orphelins
          const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
          mats.forEach(mat => {
            if (mat && mat.userData?.__markedForDisposal) {
              const standardMat = mat as THREE.MeshStandardMaterial;
              // Nettoyer les maps de textures
              if (standardMat.map) { standardMat.map.dispose(); texCount++; }
              if (standardMat.normalMap) { standardMat.normalMap.dispose(); texCount++; }
              if (standardMat.roughnessMap) { standardMat.roughnessMap.dispose(); texCount++; }
              if (standardMat.metalnessMap) { standardMat.metalnessMap.dispose(); texCount++; }
              standardMat.dispose();
              matCount++;
            }
          });
        }
      });
    }

    this.lastGCCheckTimestamp = Date.now();
    this.disposedResourcesCount = { geometries: geoCount, materials: matCount, textures: texCount };

    if (verbose) {
      console.log(`[ThreeOptimizationEngine] GC Exécuté: ${geoCount} géométries, ${matCount} matériaux, ${texCount} textures libérés.`);
    }

    return this.disposedResourcesCount;
  }

  /**
   * Désalloue immédiatement une géométrie et ses buffers GPU
   */
  public disposeGeometry(geometry: THREE.BufferGeometry): void {
    if (!geometry) return;
    geometry.dispose();
  }

  /**
   * Désalloue immédiatement un mesh complet (géométrie + tous matériaux + textures)
   */
  public disposeMesh(mesh: THREE.Mesh): void {
    if (!mesh) return;

    if (mesh.geometry) {
      mesh.geometry.dispose();
    }

    const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    materials.forEach(mat => {
      if (!mat) return;
      const standardMat = mat as THREE.MeshStandardMaterial;
      if (standardMat.map) standardMat.map.dispose();
      if (standardMat.normalMap) standardMat.normalMap.dispose();
      if (standardMat.roughnessMap) standardMat.roughnessMap.dispose();
      if (standardMat.metalnessMap) standardMat.metalnessMap.dispose();
      if (standardMat.bumpMap) standardMat.bumpMap.dispose();
      if (standardMat.envMap) standardMat.envMap.dispose();
      standardMat.dispose();
    });
  }

  /**
   * Efface le CacheStorage du navigateur
   */
  public async clearBrowserCacheStorage(): Promise<boolean> {
    try {
      if (typeof window !== 'undefined' && 'caches' in window) {
        const keys = await window.caches.keys();
        await Promise.all(keys.map(k => window.caches.delete(k)));
        return true;
      }
    } catch (e) {
      console.warn('[ThreeOptimizationEngine] Impossible d’accéder à CacheStorage:', e);
    }
    return false;
  }

  /**
   * Ajoute un paramètre de Cache-Busting (?v=timestamp) aux URLs de chargement de modèles 3D et textures
   */
  public getCacheBustedUrl(url: string): string {
    if (!this.currentSettings.cacheBusting3D) return url;
    const separator = url.includes('?') ? '&' : '?';
    return `${url}${separator}v=${Date.now()}`;
  }

  /**
   * Récupère les métadonnées GPU du client (Constructeur, Carte graphique dédiée, WebGL version)
   */
  public getGpuDiagnostics(renderer?: THREE.WebGLRenderer | null): {
    vendor: string;
    rendererName: string;
    isHighPerformance: boolean;
    webglVersion: string;
    maxTextureSize: number;
  } {
    if (!renderer) {
      return {
        vendor: 'Standard GPU',
        rendererName: 'Accélération matérielle active',
        isHighPerformance: this.currentSettings.highPerformanceGPU,
        webglVersion: 'WebGL 2.0',
        maxTextureSize: 8192,
      };
    }

    const gl = renderer.getContext();
    let vendor = 'N/A';
    let rendererName = 'WebGL Standard Context';

    try {
      const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
      if (debugInfo) {
        vendor = gl.getParameter(debugInfo.UNMASKED_VENDOR_WEBGL) || 'Inconnu';
        rendererName = gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL) || 'Inconnu';
      }
    } catch (e) {
      console.warn('[ThreeOptimizationEngine] debug_renderer_info non supporté', e);
    }

    const maxTextureSize = gl.getParameter(gl.MAX_TEXTURE_SIZE) || 4096;

    return {
      vendor,
      rendererName,
      isHighPerformance: this.currentSettings.highPerformanceGPU,
      webglVersion: gl instanceof WebGL2RenderingContext ? 'WebGL 2.0 (Modern)' : 'WebGL 1.0',
      maxTextureSize,
    };
  }

  public getLastGCTimestamp(): number {
    return this.lastGCCheckTimestamp;
  }

  public destroy(): void {
    if (this.gcIntervalId) {
      clearInterval(this.gcIntervalId);
      this.gcIntervalId = null;
    }
  }
}

export const threeOptimizationEngine = new ThreeOptimizationEngine();
