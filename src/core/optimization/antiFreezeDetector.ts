/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Anti-Freeze Detector Engine for 3D CAD Modeling
 * Uses a background Web Worker heartbeat to detect main-thread freezes (>1500ms),
 * intercept crashes, execute emergency Garbage Collection and safely degrade
 * heavy Three.js graphics options to rescue active modeling sessions.
 */

import * as THREE from 'three';
import { threeOptimizationEngine } from './threeOptimizationEngine';
import { editorStore } from '../../store/EditorStore';

export interface FreezeEventInfo {
  timestamp: number;
  lagDurationMs: number;
  thresholdMs: number;
  freedGeometries: number;
  freedTextures: number;
  degradedOptions: string[];
}

export type FreezeCallback = (info: FreezeEventInfo) => void;

class AntiFreezeDetector {
  private isEnabled: boolean = true;
  private isMonitoring: boolean = false;
  private thresholdMs: number = 1500; // 1.5 seconds freeze threshold
  private heartbeatIntervalMs: number = 250; // Main thread pulse every 250ms
  
  private worker: Worker | null = null;
  private mainHeartbeatTimer: number | null = null;
  private lastHeartbeatTime: number = Date.now();
  private lastFreezeTime: number = 0;
  private freezeCooldownMs: number = 5000; // Prevent spamming rescue within 5s
  
  private freezeCallbacks: Set<FreezeCallback> = new Set();
  public totalFreezesIntercepted: number = 0;
  public lastRescueInfo: FreezeEventInfo | null = null;

  constructor() {
    this.initWorker();
  }

  /**
   * Initializes the background Web Worker via an inline Blob
   * to ensure background thread execution even when main JS thread is frozen.
   */
  private initWorker(): void {
    try {
      if (typeof window === 'undefined' || typeof Worker === 'undefined') return;

      const workerCode = `
        let lastPing = Date.now();
        let threshold = 1500;
        let checkTimer = null;
        let isRunning = false;

        self.onmessage = function(e) {
          const data = e.data;
          if (data.type === 'START') {
            threshold = data.threshold || 1500;
            lastPing = Date.now();
            isRunning = true;
            if (checkTimer) clearInterval(checkTimer);
            checkTimer = setInterval(checkLag, 200);
          } else if (data.type === 'PULSE') {
            lastPing = Date.now();
          } else if (data.type === 'CONFIG') {
            if (data.threshold) threshold = data.threshold;
          } else if (data.type === 'STOP') {
            isRunning = false;
            if (checkTimer) {
              clearInterval(checkTimer);
              checkTimer = null;
            }
          }
        };

        function checkLag() {
          if (!isRunning) return;
          const now = Date.now();
          const lag = now - lastPing;
          if (lag >= threshold) {
            self.postMessage({ type: 'FREEZE_DETECTED', lag: lag, threshold: threshold });
            // Reset to prevent rapid consecutive spamming while thread unblocks
            lastPing = now;
          }
        }
      `;

      const blob = new Blob([workerCode], { type: 'application/javascript' });
      const workerUrl = URL.createObjectURL(blob);
      this.worker = new Worker(workerUrl);

      this.worker.onmessage = (e: MessageEvent) => {
        if (e.data && e.data.type === 'FREEZE_DETECTED') {
          this.handleFreezeDetected(e.data.lag, e.data.threshold);
        }
      };

      this.worker.onerror = (err) => {
        console.warn('[AntiFreezeDetector] Worker warning, fallback to requestAnimationFrame watchdog:', err);
      };
    } catch (err) {
      console.warn('[AntiFreezeDetector] Could not create Worker, will use fallback loop:', err);
    }
  }

  /**
   * Starts monitoring the main thread
   */
  public start(thresholdMs: number = 1500): void {
    this.thresholdMs = thresholdMs;
    this.isEnabled = true;
    this.isMonitoring = true;
    this.lastHeartbeatTime = Date.now();

    // Start Worker watchdog
    if (this.worker) {
      this.worker.postMessage({
        type: 'START',
        threshold: this.thresholdMs,
      });
    }

    // Start Main Thread pulse
    if (this.mainHeartbeatTimer) {
      clearInterval(this.mainHeartbeatTimer);
    }

    this.mainHeartbeatTimer = window.setInterval(() => {
      if (!this.isEnabled) return;
      const now = Date.now();
      const localLag = now - this.lastHeartbeatTime - this.heartbeatIntervalMs;
      
      // Fallback main-thread lag detection if worker was throttled or blocked
      if (localLag >= this.thresholdMs) {
        this.handleFreezeDetected(localLag + this.heartbeatIntervalMs, this.thresholdMs);
      }

      this.lastHeartbeatTime = now;

      if (this.worker) {
        this.worker.postMessage({ type: 'PULSE', time: now });
      }
    }, this.heartbeatIntervalMs);

    console.log(`[AntiFreezeDetector] Surveillance active (Seuil: ${this.thresholdMs}ms).`);
  }

  /**
   * Stops the anti-freeze watchdog
   */
  public stop(): void {
    this.isMonitoring = false;
    this.isEnabled = false;

    if (this.mainHeartbeatTimer) {
      clearInterval(this.mainHeartbeatTimer);
      this.mainHeartbeatTimer = null;
    }

    if (this.worker) {
      this.worker.postMessage({ type: 'STOP' });
    }

    console.log('[AntiFreezeDetector] Surveillance arrêtée.');
  }

  /**
   * Sets whether the detector is enabled
   */
  public setEnabled(enabled: boolean): void {
    if (enabled === this.isEnabled && this.isMonitoring === enabled) return;
    this.isEnabled = enabled;
    if (enabled) {
      this.start(this.thresholdMs);
    } else {
      this.stop();
    }
  }

  /**
   * Intercepts a detected freeze, executes emergency rescue protocol
   */
  private handleFreezeDetected(lagMs: number, thresholdMs: number): void {
    const now = Date.now();
    if (!this.isEnabled) return;
    if (now - this.lastFreezeTime < this.freezeCooldownMs) {
      return; // Cooldown to avoid double triggers
    }
    this.lastFreezeTime = now;
    this.totalFreezesIntercepted++;

    console.warn(`🚨 [AntiFreezeDetector] FREEZE DÉTECTÉ : ${lagMs}ms (Seuil: ${thresholdMs}ms) ! Déclenchement du protocole de secours...`);

    // 1. Exécuter la Garbage Collection d'urgence VRAM
    const scene = editorStore.activeThreeScene;
    const renderer = editorStore.activeThreeRenderer;
    const cleanupResult = threeOptimizationEngine.runEmergencyVRAMCleanup(scene, renderer);

    // 2. Dégrader temporairement les options graphiques lourdes
    const degradedOptions: string[] = [];

    // Figer les ombres dynamiques
    if (renderer && renderer.shadowMap) {
      renderer.shadowMap.autoUpdate = false;
      degradedOptions.push('Ombres dynamiques figées (shadowMap.autoUpdate = false)');
    }

    // Réduire le pixel ratio si antialias élevé
    if (renderer) {
      renderer.setPixelRatio(1.0);
      degradedOptions.push('Résolution GPU ramenée à 1.0x (Désactivation sous-échantillonnage)');
    }

    // Forcer Frustum Culling
    if (scene) {
      threeOptimizationEngine.applySettings(
        {
          ...threeOptimizationEngine.getSettings(),
          ecoStaticShadows: true,
          aggressiveFrustumCulling: true,
          hardwareAntialias: false,
        },
        scene,
        renderer
      );
      degradedOptions.push('Masquage hors-champ (Frustum Culling) forcé sur tous les maillages');
    }

    const rescueInfo: FreezeEventInfo = {
      timestamp: now,
      lagDurationMs: Math.round(lagMs),
      thresholdMs: thresholdMs,
      freedGeometries: cleanupResult.freedGeometries,
      freedTextures: cleanupResult.freedTextures,
      degradedOptions,
    };

    this.lastRescueInfo = rescueInfo;

    // 3. Notifier l'EditorStore pour affichage d'alerte React
    editorStore.triggerAntiFreezeRescue(rescueInfo);

    // 4. Notifier les callbacks enregistrés
    this.freezeCallbacks.forEach(cb => {
      try {
        cb(rescueInfo);
      } catch (err) {
        console.error('[AntiFreezeDetector] Erreur callback:', err);
      }
    });
  }

  /**
   * Subscribe to freeze rescue events
   */
  public onFreeze(callback: FreezeCallback): () => void {
    this.freezeCallbacks.add(callback);
    return () => this.freezeCallbacks.delete(callback);
  }

  /**
   * Simulates a main thread freeze for testing & verification
   */
  public simulateFreeze(durationMs: number = 1600): void {
    console.log(`[AntiFreezeDetector] Simulation d'un gel de thread de ${durationMs}ms...`);
    const start = performance.now();
    while (performance.now() - start < durationMs) {
      // Synchronously block the JavaScript main thread
    }
    console.log(`[AntiFreezeDetector] Fin du gel simulé (${durationMs}ms).`);
  }

  public getStatus(): { isMonitoring: boolean; isEnabled: boolean; thresholdMs: number; totalFreezes: number } {
    return {
      isMonitoring: this.isMonitoring,
      isEnabled: this.isEnabled,
      thresholdMs: this.thresholdMs,
      totalFreezes: this.totalFreezesIntercepted,
    };
  }
}

export const antiFreezeDetector = new AntiFreezeDetector();
