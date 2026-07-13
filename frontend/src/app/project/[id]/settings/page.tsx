"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { StepPage } from "@/components/steps/step-page";
import { api } from "@/lib/api-client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";

interface SettingsData {
  background: string;
  tone: string;
  core_conflict: string;
  themes: string;
  target_audience: string;
  unique_selling_point: string;
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
  }, [projectId]);

  const update = (field: keyof SettingsData, value: string) => {
    setData((prev) => ({ ...prev, [field]: value }));
  };

  return (
    <StepPage
      stepKey="settings"
      title="基础设定"
      description="定义故事的基本背景、基调和核心冲突，为后续创作奠定基础"
      generateUrl={api.steps.generateUrl(projectId, "settings")}
      onSave={async () => {
        await api.steps.saveSettings(projectId, {
          ...data,
          themes: data.themes.split(/[,，]/).map((t) => t.trim()).filter(Boolean),
        });
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
            <Label htmlFor="tone">基调与风格</Label>
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
