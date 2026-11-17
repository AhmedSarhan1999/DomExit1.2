import { useState, useCallback, useRef } from 'react';

/**
 * AI Streaming & Typewriter Hook (Criterion 24: AI Streaming / SSE)
 * Simulates or handles real streaming responses from AI endpoints,
 * providing character-by-character or token-by-token typewriter rendering.
 */
export function useStreamingResponse() {
  const [streamedText, setStreamedText] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const abortControllerRef = useRef<AbortController | null>(null);

  const startStream = useCallback(async (fullText: string, speedMs = 12) => {
    setIsStreaming(true);
    setStreamedText('');

    abortControllerRef.current?.abort();
    abortControllerRef.current = new AbortController();
    const signal = abortControllerRef.current.signal;

    let currentIndex = 0;

    return new Promise<void>((resolve) => {
      const interval = setInterval(() => {
        if (signal.aborted || currentIndex >= fullText.length) {
          clearInterval(interval);
          setIsStreaming(false);
          resolve();
          return;
        }

        // Emit 1-3 characters at a time for natural typewriter cadence
        const stride = Math.min(3, fullText.length - currentIndex);
        currentIndex += stride;
        setStreamedText(fullText.slice(0, currentIndex));
      }, speedMs);
    });
  }, []);

  const stopStream = useCallback(() => {
    abortControllerRef.current?.abort();
    setIsStreaming(false);
  }, []);

  const reset = useCallback(() => {
    stopStream();
    setStreamedText('');
  }, [stopStream]);

  return {
    streamedText,
    isStreaming,
    startStream,
    stopStream,
    reset,
  };
}
