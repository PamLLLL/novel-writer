"use client";

import { useEffect, useState, useRef } from "react";
import { useParams } from "next/navigation";
import { Palette, Save, Loader2, Eye, Check } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { api } from "@/lib/api-client";
import { useSSE } from "@/hooks/use-sse";
import { toast } from "sonner";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:8000/api";

interface Preset {
  id: string;
  name: string;
  description: string;
  instruction: string;
}

interface Platform {
  name: string;
  chapter_length: number;
  style: string;
}

interface StyleConfig {
  preset: string;
  custom_description: string;
  [key: string]: unknown;
}

export default function StylePage() {
  const { id: projectId } = useParams<{ id: string }>();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [presets, setPresets] = useState<Preset[]>([]);
  const [platforms, setPlatforms] = useState<Platform[]>([]);
  const [selectedPreset, setSelectedPreset] = useState("");
  const [customDescription, setCustomDescription] = useState("");
  const [selectedPlatform, setSelectedPlatform] = useState("");
  const [previewText, setPreviewText] = useState("");
  const streamRef = useRef("");
  const { start, stop, isStreaming } = useSSE();

  useEffect(() => {
    const loadData = async () => {
      try {
        const [styleRes, presetsRes, platformsRes] = await Promise.all([
          fetch(API_BASE + "/style/" + projectId).then((r) => r.json()),
          fetch(API_BASE + "/style/presets").then((r) => r.json()),
          fetch(API_BASE + "/style/platforms").then((r) => r.json()),
        ]);

        const config = styleRes as StyleConfig;
        setSelectedPreset(config.preset || "");
        setCustomDescription(config.custom_description || "");

        setPresets(presetsRes as Preset[]);
        setPlatforms(platformsRes as Platform[]);

        // Load project to get target_platform
        const project = await api.projects.get(projectId);
        if (project.target_platform) {
          setSelectedPlatform(project.target_platform as string);
        }
      } catch (e) {
        toast.error("加载风格配置失败", { description: String(e) });
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, [projectId]);

  const selectedPlatformData = platforms.find((p) => p.name === selectedPlatform);

  const handlePreview = () => {
    setPreviewText("");
    streamRef.current = "";
    start(
      API_BASE + "/style/" + projectId + "/preview",
      {},
      {
        onContent: (text) => {
          streamRef.current += text;
          setPreviewText(streamRef.current);
        },
        onDone: () => {
          toast.success("风格预览生成完成");
        },
        onError: (msg) => {
          toast.error("预览生成失败", { description: msg });
        },
      }
    );
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await Promise.all([
        fetch(API_BASE + "/style/" + projectId, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            style_config: {
              preset: selectedPreset,
              custom_description: customDescription,
            },
          }),
        }),
        api.projects.update(projectId, { target_platform: selectedPlatform }),
      ]);
      toast.success("风格配置已保存");
    } catch (e) {
      toast.error("保存失败", { description: String(e) });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="p-6 max-w-4xl mx-auto">
        <div className="text-sm text-muted-foreground">加载中...</div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex items-start justify-between mb-6">
        <div>
          <h2 className="text-xl font-bold tracking-tight">风格设置</h2>
          <p className="text-sm text-muted-foreground mt-1">
            配置写作风格、选择预设或自定义风格描述
          </p>
        </div>
        <Button onClick={handleSave} disabled={saving || isStreaming} size="sm">
          {saving ? (
            <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
          ) : (
            <Save className="h-3.5 w-3.5 mr-1.5" />
          )}
          保存
        </Button>
      </div>

      {/* Preset Styles */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Palette className="h-4 w-4" />
            预设风格
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {presets.map((preset) => (
              <button
                key={preset.id}
                type="button"
                onClick={() => setSelectedPreset(preset.id)}
                className={`relative text-left rounded-lg border p-3 transition-all hover:shadow-sm ${
                  selectedPreset === preset.id
                    ? "ring-2 ring-primary border-primary bg-primary/5"
                    : "border-border hover:border-primary/50"
                }`}
              >
                {selectedPreset === preset.id && (
                  <div className="absolute top-2 right-2">
                    <Check className="h-4 w-4 text-primary" />
                  </div>
                )}
                <div className="font-medium text-sm">{preset.name}</div>
                <div className="text-xs text-muted-foreground mt-1 line-clamp-2">
                  {preset.description}
                </div>
              </button>
            ))}
          </div>
          {presets.length === 0 && (
            <div className="text-center py-4 text-sm text-muted-foreground">
              暂无预设风格
            </div>
          )}
        </CardContent>
      </Card>

      {/* Custom Style */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>自定义风格</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <Label htmlFor="custom-style">风格描述</Label>
            <Textarea
              id="custom-style"
              placeholder="描述你想要的写作风格，例如：简洁明快的叙事节奏，多用短句，善用白描手法，注重对话推进情节..."
              value={customDescription}
              onChange={(e) => setCustomDescription(e.target.value)}
              rows={4}
            />
            <p className="text-xs text-muted-foreground">
              自定义描述会与预设风格结合使用，优先级高于预设
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Target Platform */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>目标平台</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>选择发布平台</Label>
              <Select value={selectedPlatform} onValueChange={(v) => setSelectedPlatform(v ?? "")}>
                <SelectTrigger className="w-full max-w-sm">
                  <SelectValue placeholder="选择目标平台" />
                </SelectTrigger>
                <SelectContent>
                  {platforms.map((platform) => (
                    <SelectItem key={platform.name} value={platform.name}>
                      {platform.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {selectedPlatformData && (
              <div className="rounded-lg border border-border bg-muted/30 p-4 space-y-2">
                <div className="flex items-center gap-2">
                  <Badge variant="secondary">平台要求</Badge>
                  <span className="font-medium text-sm">{selectedPlatformData.name}</span>
                </div>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-muted-foreground">建议章节字数：</span>
                    <span className="font-medium">
                      {selectedPlatformData.chapter_length.toLocaleString()} 字
                    </span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">风格要求：</span>
                    <span className="font-medium">{selectedPlatformData.style}</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <Separator className="mb-6" />

      {/* Style Preview */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Eye className="h-4 w-4" />
              风格预览
            </CardTitle>
            {isStreaming ? (
              <Button variant="destructive" size="sm" onClick={stop}>
                停止生成
              </Button>
            ) : (
              <Button variant="outline" size="sm" onClick={handlePreview}>
                <Eye className="h-3.5 w-3.5 mr-1.5" />
                预览风格效果
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {isStreaming || previewText ? (
            <div className="rounded-lg border border-border bg-muted/30 p-4">
              {isStreaming && !previewText && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  正在生成风格预览...
                </div>
              )}
              <pre className="text-sm whitespace-pre-wrap max-h-96 overflow-auto">
                {previewText}
              </pre>
            </div>
          ) : (
            <div className="text-center py-8 text-sm text-muted-foreground">
              点击「预览风格效果」查看当前风格配置下的示例文本
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
