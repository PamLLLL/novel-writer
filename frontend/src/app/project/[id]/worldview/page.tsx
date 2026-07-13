"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Plus, Trash2 } from "lucide-react";
import { StepPage } from "@/components/steps/step-page";
import { api } from "@/lib/api-client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

interface WorldviewData {
  world_type: string;
  geography: string;
  society: string;
  power_system: string;
  history: string;
  culture: string;
  technology: string;
  rules: string[];
}

const emptyWorldview: WorldviewData = {
  world_type: "",
  geography: "",
  society: "",
  power_system: "",
  history: "",
  culture: "",
  technology: "",
  rules: [],
};

export default function WorldviewPage() {
  const { id: projectId } = useParams<{ id: string }>();
  const [data, setData] = useState<WorldviewData>(emptyWorldview);

  useEffect(() => {
    api.steps.getWorldview(projectId).then((res) => {
      setData({
        world_type: (res.world_type as string) || "",
        geography: (res.geography as string) || "",
        society: (res.society as string) || "",
        power_system: (res.power_system as string) || "",
        history: (res.history as string) || "",
        culture: (res.culture as string) || "",
        technology: (res.technology as string) || "",
        rules: Array.isArray(res.rules)
          ? (res.rules as string[])
          : [],
      });
    }).catch(() => {});
  }, [projectId]);

  const update = (field: keyof Omit<WorldviewData, "rules">, value: string) => {
    setData((prev) => ({ ...prev, [field]: value }));
  };

  const updateRule = (index: number, value: string) => {
    setData((prev) => {
      const rules = [...prev.rules];
      rules[index] = value;
      return { ...prev, rules };
    });
  };

  const addRule = () => {
    setData((prev) => ({ ...prev, rules: [...prev.rules, ""] }));
  };

  const removeRule = (index: number) => {
    setData((prev) => ({
      ...prev,
      rules: prev.rules.filter((_, i) => i !== index),
    }));
  };

  const hasData =
    !!data.world_type ||
    !!data.geography ||
    !!data.society ||
    !!data.power_system;

  return (
    <StepPage
      stepKey="worldview"
      title="世界观"
      description="构建故事的世界体系，包括地理、社会、力量体系等核心设定"
      generateUrl={api.steps.generateUrl(projectId, "worldview")}
      onSave={async () => {
        await api.steps.saveWorldview(projectId, {
          ...data,
          rules: data.rules.filter((r) => r.trim() !== ""),
        });
      }}
      onGenerated={(result) => {
        setData({
          world_type: (result.world_type as string) || "",
          geography: (result.geography as string) || "",
          society: (result.society as string) || "",
          power_system: (result.power_system as string) || "",
          history: (result.history as string) || "",
          culture: (result.culture as string) || "",
          technology: (result.technology as string) || "",
          rules: Array.isArray(result.rules)
            ? (result.rules as string[])
            : [],
        });
      }}
      hasData={hasData}
    >
      <Card>
        <CardHeader>
          <CardTitle>世界基本设定</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="world_type">世界类型</Label>
            <Input
              id="world_type"
              placeholder="如：东方玄幻、西方奇幻、近未来科幻、现代都市..."
              value={data.world_type}
              onChange={(e) => update("world_type", e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="geography">地理环境</Label>
            <Textarea
              id="geography"
              placeholder="描述世界的地理格局、重要地标和区域..."
              value={data.geography}
              onChange={(e) => update("geography", e.target.value)}
              rows={3}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="society">社会结构</Label>
            <Textarea
              id="society"
              placeholder="描述社会的组织形式、阶层、权力结构..."
              value={data.society}
              onChange={(e) => update("society", e.target.value)}
              rows={3}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="power_system">力量体系</Label>
            <Textarea
              id="power_system"
              placeholder="描述世界中的力量或魔法体系、等级划分..."
              value={data.power_system}
              onChange={(e) => update("power_system", e.target.value)}
              rows={3}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="history">历史沿革</Label>
            <Textarea
              id="history"
              placeholder="世界的重要历史事件和时间线..."
              value={data.history}
              onChange={(e) => update("history", e.target.value)}
              rows={3}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="culture">文化特色</Label>
            <Textarea
              id="culture"
              placeholder="世界中的文化传统、风俗习惯、信仰体系..."
              value={data.culture}
              onChange={(e) => update("culture", e.target.value)}
              rows={3}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="technology">科技水平</Label>
            <Textarea
              id="technology"
              placeholder="世界的科技或工艺发展水平..."
              value={data.technology}
              onChange={(e) => update("technology", e.target.value)}
              rows={3}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>世界规则</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {data.rules.map((rule, index) => (
            <div key={index} className="flex gap-2">
              <Textarea
                placeholder={`规则 ${index + 1}：描述一条世界观中的核心规则...`}
                value={rule}
                onChange={(e) => updateRule(index, e.target.value)}
                rows={2}
                className="flex-1"
              />
              <Button
                variant="ghost"
                size="sm"
                className="shrink-0 self-start mt-1"
                onClick={() => removeRule(index)}
              >
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            </div>
          ))}
          <Button variant="outline" className="w-full" onClick={addRule}>
            <Plus className="h-4 w-4 mr-2" />
            添加规则
          </Button>
        </CardContent>
      </Card>
    </StepPage>
  );
}
