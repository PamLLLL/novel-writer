"use client";

import { useCallback, useRef, useState } from "react";

interface SSECallbacks {
  onContent?: (text: string) => void;
  onProgress?: (message: string) => void;
  onDone?: (result: Record<string, unknown>) => void;
  onError?: (message: string) => void;
}

export function useSSE() {
  const [isStreaming, setIsStreaming] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  const start = useCallback(
    async (url: string, body: Record<string, unknown>, callbacks: SSECallbacks) => {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      setIsStreaming(true);

      try {
        const res = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
          signal: controller.signal,
        });

        if (!res.ok) {
          const err = await res.json().catch(() => ({ detail: res.statusText }));
          callbacks.onError?.(err.detail || `Request failed: ${res.status}`);
          setIsStreaming(false);
          return;
        }

        const reader = res.body?.getReader();
        if (!reader) {
          callbacks.onError?.("No response body");
          setIsStreaming(false);
          return;
        }

        const decoder = new TextDecoder();
        let buffer = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() || "";

          let currentEvent = "";
          for (const line of lines) {
            if (line.startsWith("event: ")) {
              currentEvent = line.slice(7).trim();
            } else if (line.startsWith("data: ")) {
              const dataStr = line.slice(6);
              try {
                const data = JSON.parse(dataStr);
                switch (currentEvent) {
                  case "content":
                    callbacks.onContent?.(data.text || "");
                    break;
                  case "progress":
                    callbacks.onProgress?.(data.message || "");
                    break;
                  case "done":
                    callbacks.onDone?.(data.result || data);
                    break;
                  case "error":
                    callbacks.onError?.(data.message || "Unknown error");
                    break;
                }
              } catch {
                // ignore parse errors
              }
              currentEvent = "";
            }
          }
        }
      } catch (e) {
        if ((e as Error).name !== "AbortError") {
          callbacks.onError?.(String(e));
        }
      } finally {
        setIsStreaming(false);
        abortRef.current = null;
      }
    },
    []
  );

  const stop = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setIsStreaming(false);
  }, []);

  return { start, stop, isStreaming };
}
