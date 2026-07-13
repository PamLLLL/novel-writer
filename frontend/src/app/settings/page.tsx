"use client";

import { useEffect, useState } from "react";
import { Eye, EyeOff, Check, X, Loader2, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { api } from "@/lib/api-client";
import type { GlobalSettings, ApiKeyConfig } from "@/lib/types";
import { PROVIDERS } from "@/lib/types";

type TestState = "idle" | "testing" | "success" | "error";

export default function SettingsPage() {
  const [settings, setSettings] = useState<GlobalSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showKeys, setShowKeys] = useState<Record<string, boolean>>({});
  const [testStates, setTestStates] = useState<Record<string, TestState>>({});
  const [testErrors, setTestErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    api.settings
      .get()
      .then(setSettings)
      .catch((e) => toast.error("加载设置失败", { description: String(e) }))
      .finally(() => setLoading(false));
  }, []);

  const updateKey = (providerId: string, field: keyof ApiKeyConfig, value: string) => {
    if (!settings) return;
    const current = settings.api_keys[providerId] || { key: "", default_model: "" };
    setSettings({
      ...settings,
      api_keys: {
        ...settings.api_keys,
        [providerId]: { ...current, [field]: value },
      },
    });
  };

  const handleTest = async (providerId: string) => {
    if (!settings) return;
    const config = settings.api_keys[providerId];
    if (!config?.key) {
      toast.error("请先输入 API Key");
      return;
    }
    setTestStates((s) => ({ ...s, [providerId]: "testing" }));
    setTestErrors((s) => ({ ...s, [providerId]: "" }));
    try {
      const result = await api.settings.testKey({
        provider: providerId,
        key: config.key,
        model: config.default_model || undefined,
      });
      if (result.valid) {
        setTestStates((s) => ({ ...s, [providerId]: "success" }));
        toast.success("连接成功");
      } else {
        setTestStates((s) => ({ ...s, [providerId]: "error" }));
        setTestErrors((s) => ({ ...s, [providerId]: result.error || "验证失败" }));
        toast.error("连接失败", { description: result.error || "" });
      }
    } catch (e) {
      setTestStates((s) => ({ ...s, [providerId]: "error" }));
      setTestErrors((s) => ({ ...s, [providerId]: String(e) }));
      toast.error("测试失败", { description: String(e) });
    }
  };

  const handleSave = async () => {
    if (!settings) return;
    setSaving(true);
    try {
      await api.settings.update(settings);
      toast.success("设置已保存");
    } catch (e) {
      toast.error("保存失败", { description: String(e) });
    } finally {
      setSaving(false);
    }
  };

  if (loading || !settings) {
    return (
      <div className="p-8 max-w-4xl mx-auto">
        <h1 className="text-2xl font-bold tracking-tight mb-8">全局设置</h1>
        <div className="text-muted-foreground">加载中...</div>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">全局设置</h1>
          <p className="text-muted-foreground mt-1">配置 AI 模型和偏好</p>
        </div>
        <Button onClick={handleSave} disabled={saving}>
          {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
          保存设置
        </Button>
      </div>

      <div className="space-y-4 mb-8">
        <div className="space-y-2">
          <Label>默认 AI 提供商</Label>
          <Select
            value={settings.default_provider}
            onValueChange={(v) => v && setSettings({ ...settings, default_provider: v })}
          >
            <SelectTrigger className="w-64">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PROVIDERS.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <Separator className="mb-8" />

      <div className="space-y-6">
        {PROVIDERS.map((provider) => {
          const config = settings.api_keys[provider.id] || { key: "", default_model: "" };
          const isVisible = showKeys[provider.id];
          const testState = testStates[provider.id] || "idle";
          const hasKey = !!config.key;

          return (
            <Card key={provider.id}>
              <CardHeader className="pb-4">
                <div className="flex items-center gap-3">
                  <CardTitle className="text-base">{provider.name}</CardTitle>
                  {"recommended" in provider && provider.recommended && (
                    <Badge variant="secondary" className="gap-1">
                      <Star className="h-3 w-3" />
                      推荐
                    </Badge>
                  )}
                  {hasKey && (
                    <div className="ml-auto flex items-center gap-1.5">
                      <div className="h-2 w-2 rounded-full bg-green-500" />
                      <span className="text-xs text-muted-foreground">已配置</span>
                    </div>
                  )}
                </div>
                <CardDescription>{provider.desc}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>API Key</Label>
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <Input
                        type={isVisible ? "text" : "password"}
                        placeholder="输入 API Key"
                        value={config.key}
                        onChange={(e) => updateKey(provider.id, "key", e.target.value)}
                        className="pr-10"
                      />
                      <Button
                        variant="ghost"
                        size="icon"
                        className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7"
                        onClick={() =>
                          setShowKeys((s) => ({ ...s, [provider.id]: !s[provider.id] }))
                        }
                      >
                        {isVisible ? (
                          <EyeOff className="h-3.5 w-3.5" />
                        ) : (
                          <Eye className="h-3.5 w-3.5" />
                        )}
                      </Button>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleTest(provider.id)}
                      disabled={!hasKey || testState === "testing"}
                      className="shrink-0"
                    >
                      {testState === "testing" && (
                        <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />
                      )}
                      {testState === "success" && (
                        <Check className="h-3.5 w-3.5 mr-1 text-green-500" />
                      )}
                      {testState === "error" && (
                        <X className="h-3.5 w-3.5 mr-1 text-destructive" />
                      )}
                      测试连接
                    </Button>
                  </div>
                  {testState === "error" && testErrors[provider.id] && (
                    <p className="text-xs text-destructive">{testErrors[provider.id]}</p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label>默认模型</Label>
                  <Select
                    value={config.default_model || provider.models[0]}
                    onValueChange={(v) => v && updateKey(provider.id, "default_model", v)}
                  >
                    <SelectTrigger className="w-64">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {provider.models.map((m) => (
                        <SelectItem key={m} value={m}>
                          {m}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
