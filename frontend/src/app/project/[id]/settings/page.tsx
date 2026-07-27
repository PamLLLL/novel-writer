"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Check } from "lucide-react";
import { StepPage } from "@/components/steps/step-page";
import { api } from "@/lib/api-client";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:8000/api";

interface SettingsData {
  background: string;
  tone: string;
  core_conflict: string;
  themes: string;
  target_audience: string;
  unique_selling_point: string;
}

interface StylePreset {
  id: string;
  name: string;
  description: string;
}

interface PlatformInfo {
  name: string;
  chapter_length: string;
  style: string;
}

const emptySettings: SettingsData = {
  background: "",
  tone: "",
  core_conflict: "",
  themes: "",
  target_audience: "",
  unique_selling_point: "",
};

export default function SettingsPage() {
  const { id: projectId } = useParams<{ id: string }>();
  const [data, setData] = useState<SettingsData>(emptySettings);
  const [presets, setPresets] = useState<StylePreset[]>([]);
  const [platforms, setPlatforms] = useState<PlatformInfo[]>([]);
  const [selectedPreset, setSelectedPreset] = useState("");
  const [customStyle, setCustomStyle] = useState("");
  const [selectedPlatform, setSelectedPlatform] = useState("");
  const [referenceTexts, setReferenceTexts] = useState<string[]>(["", "", ""]);

  useEffect(() => {
    api.steps.getSettings(projectId).then((res) => {
      setData({
        background: (res.background as string) || "",
        tone: (res.tone as string) || "",
        core_conflict: (res.core_conflict as string) || "",
        themes: Array.isArray(res.themes)
          ? (res.themes as string[]).join(", ")
          : (res.themes as string) || "",
        target_audience: (res.target_audience as string) || "",
        unique_selling_point: (res.unique_selling_point as string) || "",
      });
    }).catch(() => {});

    // Load style config
    fetch(`${API_BASE}/style/${projectId}`).then(r => r.json()).then((cfg) => {
      setSelectedPreset((cfg.preset as string) || "");
      setCustomStyle((cfg.custom_description as string) || "");
      const refs = cfg.reference_texts;
      if (Array.isArray(refs)) {
        setReferenceTexts([refs[0] || "", refs[1] || "", refs[2] || ""]);
      }
    }).catch(() => {});

    // Load project for platform
    api.projects.get(projectId).then((p) => {
      setSelectedPlatform(p.target_platform || "");
    }).catch(() => {});

    // Load presets + platforms
    fetch(`${API_BASE}/style/presets`).then(r => r.json()).then(setPresets).catch(() => {});
    fetch(`${API_BASE}/style/platforms`).then(r => r.json()).then(setPlatforms).catch(() => {});
  }, [projectId]);

  const update = (field: keyof SettingsData, value: string) => {
    setData((prev) => ({ ...prev, [field]: value }));
  };

  const selectedPlatformInfo = platforms.find(p => p.name === selectedPlatform);

  return (
    <StepPage
      stepKey="settings"
      title="基础设定"
      description="定义故事的基本背景、基调、写作风格和目标平台"
      generateUrl={api.steps.generateUrl(projectId, "settings")}
      onSave={async () => {
        // Save step settings
        await api.steps.saveSettings(projectId, {
          ...data,
          themes: data.themes.split(/[,，]/).map((t) => t.trim()).filter(Boolean),
        });
        // Save style config
        const styleRes = await fetch(`${API_BASE}/style/${projectId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            style_config: { preset: selectedPreset, custom_description: customStyle, reference_texts: referenceTexts.filter(t => t.trim()) },
          }),
        });
        if (!styleRes.ok) throw new Error("风格保存失败");
        // Save platform
        await api.projects.update(projectId, { target_platform: selectedPlatform });
      }}
      onGenerated={(result) => {
        setData({
          background: (result.background as string) || "",
          tone: (result.tone as string) || "",
          core_conflict: (result.core_conflict as string) || "",
          themes: Array.isArray(result.themes)
            ? (result.themes as string[]).join(", ")
            : (result.themes as string) || "",
          target_audience: (result.target_audience as string) || "",
          unique_selling_point: (result.unique_selling_point as string) || "",
        });
      }}
      hasData={!!data.background || !!data.core_conflict}
    >
      {/* Style + Platform */}
      <Card>
        <CardHeader>
          <CardTitle>写作风格与平台</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>预设风格</Label>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
              {presets.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setSelectedPreset(selectedPreset === p.id ? "" : p.id)}
                  className={cn(
                    "relative rounded-lg border px-3 py-2 text-left text-sm transition-all hover:shadow-sm",
                    selectedPreset === p.id
                      ? "border-primary bg-primary/5 ring-1 ring-primary"
                      : "border-border hover:border-primary/50"
                  )}
                >
                  {selectedPreset === p.id && (
                    <div className="absolute top-1 right-1">
                      <Check className="h-3.5 w-3.5 text-primary" />
                    </div>
                  )}
                  <div className="font-medium text-xs">{p.name}</div>
                  <div className="text-[10px] text-muted-foreground mt-0.5 line-clamp-2">{p.description}</div>
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label>自定义风格补充</Label>
            <Textarea
              placeholder="用你自己的话描述想要的写作风格（可选，会与预设风格叠加）"
              value={customStyle}
              onChange={(e) => setCustomStyle(e.target.value)}
              rows={2}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>目标平台</Label>
              <Select value={selectedPlatform} onValueChange={(v) => v && setSelectedPlatform(v)}>
                <SelectTrigger>
                  <SelectValue placeholder="选择平台" />
                </SelectTrigger>
                <SelectContent>
                  {platforms.map((p) => (
                    <SelectItem key={p.name} value={p.name}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {selectedPlatformInfo && (
              <div className="space-y-1 text-xs text-muted-foreground pt-6">
                <div>章节长度：<Badge variant="secondary" className="text-[10px]">{selectedPlatformInfo.chapter_length}</Badge></div>
                <div className="line-clamp-2">{selectedPlatformInfo.style}</div>
              </div>
            )}
          </div>
          <div className="space-y-2">
            <Label>参考范文（可选，粘贴目标平台的优秀作品片段，AI 会模仿其风格）</Label>
            {referenceTexts.map((text, idx) => (
              <Textarea
                key={idx}
                placeholder={`范文${idx + 1}：粘贴一段你喜欢的、符合目标平台风格的文字...`}
                value={text}
                onChange={(e) => {
                  const updated = [...referenceTexts];
                  updated[idx] = e.target.value;
                  setReferenceTexts(updated);
                }}
                rows={3}
              />
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Story Settings */}
      <Card>
        <CardHeader>
          <CardTitle>故事基础设定</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="background">故事背景</Label>
            <Textarea
              id="background"
              placeholder="描述故事发生的时代、地点和社会环境..."
              value={data.background}
              onChange={(e) => update("background", e.target.value)}
              rows={4}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="tone">基调</Label>
            <Input
              id="tone"
              placeholder="如：轻松幽默、悬疑紧张、史诗恢弘..."
              value={data.tone}
              onChange={(e) => update("tone", e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="core_conflict">核心冲突</Label>
            <Textarea
              id="core_conflict"
              placeholder="描述贯穿全书的核心矛盾与冲突..."
              value={data.core_conflict}
              onChange={(e) => update("core_conflict", e.target.value)}
              rows={3}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="themes">主题标签</Label>
            <Input
              id="themes"
              placeholder="用逗号分隔，如：成长、爱情、救赎..."
              value={data.themes}
              onChange={(e) => update("themes", e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="target_audience">目标读者</Label>
            <Input
              id="target_audience"
              placeholder="如：18-30岁都市青年、网文读者..."
              value={data.target_audience}
              onChange={(e) => update("target_audience", e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="unique_selling_point">独特卖点</Label>
            <Textarea
              id="unique_selling_point"
              placeholder="这个故事的独特之处是什么？与同类作品的差异化..."
              value={data.unique_selling_point}
              onChange={(e) => update("unique_selling_point", e.target.value)}
              rows={3}
            />
          </div>
        </CardContent>
      </Card>
    </StepPage>
  );
}
