export type PlatformDataMode = 'demo' | 'production';

const MODE_STORAGE_KEY = 'domexit_platform_data_mode';

export class PlatformModeRepository {
  private static cachedMode: PlatformDataMode | null = null;

  static getMode(): PlatformDataMode {
    if (this.cachedMode) return this.cachedMode;
    try {
      const stored = localStorage.getItem(MODE_STORAGE_KEY);
      if (stored === 'production' || stored === 'demo') {
        this.cachedMode = stored;
        return stored;
      }
    } catch {
      // ignore
    }
    this.cachedMode = 'demo';
    return 'demo';
  }

  static isProductionMode(): boolean {
    return this.getMode() === 'production';
  }

  static setMode(mode: PlatformDataMode): void {
    this.cachedMode = mode;
    try {
      localStorage.setItem(MODE_STORAGE_KEY, mode);
    } catch {
      // ignore
    }
    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent('domexit:data_mode_changed', { detail: { mode } })
      );
    }
  }

  static toggleMode(): PlatformDataMode {
    const current = this.getMode();
    const next: PlatformDataMode = current === 'demo' ? 'production' : 'demo';
    this.setMode(next);
    return next;
  }
}
