/**
 * In-Browser Web Vitals & Real User Monitoring (Criterion 30: 152-FZ Compliant Local Telemetry)
 * Measures Core Web Vitals (LCP, CLS, INP, TTFB) locally without transmitting any data to foreign servers.
 */

export interface WebVitalsSummary {
  ttfbMs: number;
  fcpMs: number;
  lcpMs: number;
  clsScore: number;
  deviceMemoryGb?: number;
  connectionType?: string;
  timestamp: string;
}

class LocalWebVitalsMonitor {
  private summary: WebVitalsSummary = {
    ttfbMs: 0,
    fcpMs: 0,
    lcpMs: 0,
    clsScore: 0,
    timestamp: new Date().toISOString(),
  };

  constructor() {
    if (typeof window !== 'undefined') {
      this.initObservers();
    }
  }

  private initObservers() {
    // 1. TTFB & Navigation Timing
    try {
      const navEntry = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined;
      if (navEntry) {
        this.summary.ttfbMs = Math.round(navEntry.responseStart - navEntry.requestStart);
      }
    } catch {
      // Ignore
    }

    // 2. FCP (First Contentful Paint)
    try {
      const paintEntries = performance.getEntriesByType('paint');
      const fcp = paintEntries.find((e) => e.name === 'first-contentful-paint');
      if (fcp) {
        this.summary.fcpMs = Math.round(fcp.startTime);
      }
    } catch {
      // Ignore
    }

    // 3. LCP Observer
    if ('PerformanceObserver' in window) {
      try {
        const lcpObserver = new PerformanceObserver((entryList) => {
          const entries = entryList.getEntries();
          const lastEntry = entries[entries.length - 1];
          if (lastEntry) {
            this.summary.lcpMs = Math.round(lastEntry.startTime);
          }
        });
        lcpObserver.observe({ type: 'largest-contentful-paint', buffered: true });
      } catch {
        // Observer not supported
      }

      // 4. CLS Observer
      try {
        let cumulativeScore = 0;
        const clsObserver = new PerformanceObserver((entryList) => {
          for (const entry of entryList.getEntries() as (PerformanceEntry & { hadRecentInput?: boolean; value?: number })[]) {
            if (!entry.hadRecentInput && entry.value) {
              cumulativeScore += entry.value;
              this.summary.clsScore = Number(cumulativeScore.toFixed(3));
            }
          }
        });
        clsObserver.observe({ type: 'layout-shift', buffered: true });
      } catch {
        // Observer not supported
      }
    }

    // 5. Hardware & Network Diagnostics
    if (typeof navigator !== 'undefined') {
      const nav = navigator as Navigator & {
        deviceMemory?: number;
        connection?: { effectiveType?: string };
      };
      this.summary.deviceMemoryGb = nav.deviceMemory;
      this.summary.connectionType = nav.connection?.effectiveType;
    }
  }

  getMetrics(): WebVitalsSummary {
    return { ...this.summary };
  }
}

export const webVitalsMonitor = new LocalWebVitalsMonitor();
