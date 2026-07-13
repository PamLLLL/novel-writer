export interface ApiKeyConfig {
  key: string;
  default_model: string;
}

export interface GlobalSettings {
  api_keys: Record<string, ApiKeyConfig>;
  default_provider: string;
  preferences: Record<string, unknown>;
}

export interface ProjectCreate {
  name: string;
  genre?: string;
  concept?: string;
  target_words?: number;
  target_platform?: string;
  style_config?: Record<string, unknown>;
}

export interface ProjectUpdate {
  name?: string;
  genre?: string;
  concept?: string;
  target_words?: number;
  target_platform?: string;
  style_config?: Record<string, unknown>;
  status?: string;
}

export interface ProjectSummary {
  id: string;
  name: string;
  genre: string;
  concept: string;
  target_words: number;
  target_platform: string;
  status: string;
  chapter_count: number;
  total_word_count: number;
  created_at: string;
  updated_at: string;
}

export interface ProjectDetail extends ProjectSummary {
  style_config: Record<string, unknown>;
}

export interface TestKeyRequest {
  provider: string;
  key: string;
  model?: string;
}

export interface TestKeyResponse {
  valid: boolean;
  error?: string | null;
}

export const GENRES = [
  "都市", "玄幻", "言情", "悬疑", "科幻",
  "历史", "武侠", "末世", "游戏", "灵异", "其他",
] as const;

export const WORD_COUNT_OPTIONS = [
  { label: "短篇 (1-5万字)", value: 30000 },
  { label: "中篇 (5-20万字)", value: 100000 },
  { label: "长篇 (20-50万字)", value: 350000 },
  { label: "超长篇 (50万+)", value: 600000 },
] as const;

export const PLATFORMS = [
  "番茄小说",
  "七猫免费小说",
  "起点中文网",
  "晋江文学城",
  "知乎盐选",
  "掌阅",
  "微信读书",
  "通用/不限",
] as const;

export const PROVIDERS = [
  { id: "anthropic", name: "Anthropic Claude", desc: "高质量长文生成首选", models: ["claude-sonnet-4-20250514", "claude-opus-4-20250514"], recommended: true },
  { id: "openai", name: "OpenAI", desc: "通用生成，用户基数大", models: ["gpt-4o", "gpt-4.1"] },
  { id: "deepseek", name: "DeepSeek", desc: "中文写作性价比高", models: ["deepseek-chat", "deepseek-reasoner"] },
  { id: "qwen", name: "通义千问", desc: "国产替代方案", models: ["qwen-max", "qwen-plus"] },
  { id: "gemini", name: "Google Gemini", desc: "长上下文能力强", models: ["gemini-2.5-flash", "gemini-2.5-pro"] },
  { id: "minimax", name: "MiniMax", desc: "长文本生成能力好", models: ["MiniMax-Text-01", "abab6.5s-chat"] },
  { id: "zhipu", name: "智谱 GLM", desc: "国产大模型，能力均衡", models: ["glm-4-plus", "glm-4-flash"] },
] as const;
