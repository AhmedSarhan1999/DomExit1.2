/**
 * OpenTelemetry-style Slow Query & DAL API Tracer (Criterion 29 / Item 18)
 * Measures query execution times, logs warnings for operations > 500ms with trace IDs,
 * and maintains an in-memory ring-buffer for developer/admin diagnostics.
 */

export interface QueryTraceRecord {
  traceId: string;
  operation: string;
  durationMs: number;
  timestamp: string;
  success: boolean;
  slow: boolean;
  error?: string;
}

class SlowQueryTracer {
  private static readonly SLOW_THRESHOLD_MS = 500;
  private static readonly MAX_RECORDS = 50;
  private records: QueryTraceRecord[] = [];

  async trace<T>(operation: string, fn: () => Promise<T>): Promise<T> {
    const traceId = `trc-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
    const start = performance.now();
    let success = true;
    let errorMsg: string | undefined;

    try {
      return await fn();
    } catch (err) {
      success = false;
      errorMsg = err instanceof Error ? err.message : String(err);
      throw err;
    } finally {
      const durationMs = Math.round(performance.now() - start);
      const isSlow = durationMs > SlowQueryTracer.SLOW_THRESHOLD_MS;

      const record: QueryTraceRecord = {
        traceId,
        operation,
        durationMs,
        timestamp: new Date().toISOString(),
        success,
        slow: isSlow,
        error: errorMsg,
      };

      this.addRecord(record);

      if (isSlow && import.meta.env.DEV) {
        console.warn(
          `[SlowQueryTracer] ⚠️ Operation "${operation}" took ${durationMs}ms (> ${SlowQueryTracer.SLOW_THRESHOLD_MS}ms) [Trace: ${traceId}]`
        );
      }
    }
  }

  getRecentTraces(): QueryTraceRecord[] {
    return [...this.records];
  }

  getSlowTraces(): QueryTraceRecord[] {
    return this.records.filter((r) => r.slow);
  }

  private addRecord(record: QueryTraceRecord) {
    this.records.unshift(record);
    if (this.records.length > SlowQueryTracer.MAX_RECORDS) {
      this.records.pop();
    }
  }
}

export const queryTracer = new SlowQueryTracer();
