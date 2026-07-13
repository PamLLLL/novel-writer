import type {
  GlobalSettings,
  ProjectCreate,
  ProjectDetail,
  ProjectSummary,
  ProjectUpdate,
  TestKeyRequest,
  TestKeyResponse,
} from "./types";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:8000/api";

class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
    this.name = "ApiError";
  }
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new ApiError(res.status, err.detail || `Request failed: ${res.status}`);
  }
  return res.json();
}

function streamUrl(path: string): string {
  return `${API_BASE}${path}`;
}

export const api = {
  projects: {
    list: () => request<ProjectSummary[]>("/projects"),
    create: (data: ProjectCreate) =>
      request<ProjectDetail>("/projects", {
        method: "POST",
        body: JSON.stringify(data),
      }),
    get: (id: string) => request<ProjectDetail>(`/projects/${id}`),
    update: (id: string, data: ProjectUpdate) =>
      request<ProjectDetail>(`/projects/${id}`, {
        method: "PUT",
        body: JSON.stringify(data),
      }),
    delete: (id: string) =>
      request<{ status: string }>(`/projects/${id}`, { method: "DELETE" }),
  },
  settings: {
    get: () => request<GlobalSettings>("/settings"),
    update: (data: GlobalSettings) =>
      request<{ status: string }>("/settings", {
        method: "PUT",
        body: JSON.stringify(data),
      }),
    testKey: (data: TestKeyRequest) =>
      request<TestKeyResponse>("/settings/test-key", {
        method: "POST",
        body: JSON.stringify(data),
      }),
  },
  steps: {
    getSettings: (id: string) => request<Record<string, unknown>>(`/steps/${id}/settings`),
    saveSettings: (id: string, data: Record<string, unknown>) =>
      request(`/steps/${id}/settings`, { method: "PUT", body: JSON.stringify({ data }) }),
    getCharacters: (id: string) => request<Record<string, unknown>[]>(`/steps/${id}/characters`),
    saveCharacters: (id: string, data: Record<string, unknown>[]) =>
      request(`/steps/${id}/characters`, { method: "PUT", body: JSON.stringify({ data }) }),
    getWorldview: (id: string) => request<Record<string, unknown>>(`/steps/${id}/worldview`),
    saveWorldview: (id: string, data: Record<string, unknown>) =>
      request(`/steps/${id}/worldview`, { method: "PUT", body: JSON.stringify({ data }) }),
    getOutline: (id: string) => request<Record<string, unknown>>(`/steps/${id}/outline`),
    saveOutline: (id: string, data: Record<string, unknown>) =>
      request(`/steps/${id}/outline`, { method: "PUT", body: JSON.stringify({ data }) }),
    getVolumes: (id: string) => request<Record<string, unknown>[]>(`/steps/${id}/volumes`),
    saveVolumes: (id: string, data: Record<string, unknown>[]) =>
      request<Record<string, unknown>[]>(`/steps/${id}/volumes`, { method: "PUT", body: JSON.stringify({ data }) }),
    getChapters: (id: string, volumeId?: string) =>
      request<Record<string, unknown>[]>(`/steps/${id}/chapters${volumeId ? `?volume_id=${volumeId}` : ""}`),
    saveChapterOutlines: (id: string, volumeId: string, data: Record<string, unknown>[]) =>
      request(`/steps/${id}/chapters/${volumeId}`, { method: "PUT", body: JSON.stringify({ data }) }),
    getChapter: (id: string, chapterId: string) =>
      request<Record<string, unknown>>(`/steps/${id}/chapter/${chapterId}`),
    updateChapter: (id: string, chapterId: string, data: Record<string, unknown>) =>
      request(`/steps/${id}/chapter/${chapterId}`, { method: "PUT", body: JSON.stringify(data) }),
    generateUrl: (id: string, step: string) => streamUrl(`/steps/${id}/generate/${step}`),
    generateDetailedOutlineUrl: (id: string, chapterId: string) =>
      streamUrl(`/steps/${id}/generate/detailed-outline/${chapterId}`),
    generateBatchDetailedOutlinesUrl: (id: string) =>
      streamUrl(`/steps/${id}/generate/batch-detailed-outlines`),
    saveDetailedOutline: (id: string, chapterId: string, outline: Record<string, unknown>) =>
      request(`/steps/${id}/chapter/${chapterId}/detailed-outline`, {
        method: "PUT",
        body: JSON.stringify({ detailed_outline: outline }),
      }),
    polishUrl: (id: string, chapterId: string) =>
      streamUrl(`/steps/${id}/generate/polish/${chapterId}`),
    getStaleness: (id: string) =>
      request<{ stale_chapters: { id: string; title: string }[]; upstream_updated: string | null }>(`/steps/${id}/staleness`),
  },
  knowledge: {
    get: (id: string) => request<Record<string, unknown>>(`/knowledge/${id}`),
    buildUrl: (id: string) => streamUrl(`/knowledge/${id}/build`),
    updateStateUrl: (id: string, chapterId: string) =>
      streamUrl(`/knowledge/${id}/update-state/${chapterId}`),
    upstreamCascadeUrl: (id: string) => streamUrl(`/knowledge/${id}/upstream-cascade`),
  },
};
