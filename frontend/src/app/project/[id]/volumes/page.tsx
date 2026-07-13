"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import { Plus, Trash2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { StepPage } from "@/components/steps/step-page";
import { api } from "@/lib/api-client";
import { toast } from "sonner";

interface Volume {
  id: string;
  title: string;
  summary: string;
  sort_order: number;
}

export default function VolumesPage() {
  const params = useParams<{ id: string }>();
  const projectId = params.id;
  const [volumes, setVolumes] = useState<Volume[]>([]);
  const [loading, setLoading] = useState(true);

  const loadVolumes = useCallback(async () => {
    try {
      const data = await api.steps.getVolumes(projectId);
      setVolumes(data as unknown as Volume[]);
    } catch (e) {
      toast.error("加载分卷数据失败", { description: String(e) });
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    loadVolumes();
  }, [loadVolumes]);

  const addVolume = () => {
    setVolumes((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        title: `第${prev.length + 1}卷`,
        summary: "",
        sort_order: prev.length,
      },
    ]);
  };

  const removeVolume = (index: number) => {
    setVolumes((prev) =>
      prev
        .filter((_, i) => i !== index)
        .map((v, i) => ({ ...v, sort_order: i }))
    );
  };

  const updateVolume = (index: number, field: keyof Volume, value: string) => {
    setVolumes((prev) =>
      prev.map((v, i) => (i === index ? { ...v, [field]: value } : v))
    );
  };

  if (loading) {
    return (
      <div className="p-6 max-w-4xl mx-auto">
        <div className="text-sm text-muted-foreground">加载中...</div>
      </div>
    );
  }

  return (
    <StepPage
      stepKey="volumes"
      title="分卷规划"
      description="规划小说的卷次结构，每卷包含标题和内容概要"
      generateUrl={api.steps.generateUrl(projectId, "volumes")}
      onSave={async () => {
        await api.steps.saveVolumes(projectId, volumes as unknown as Record<string, unknown>[]);
      }}
      onGenerated={(result) => {
        const generated = (result.volumes || result) as Record<string, unknown>[] | undefined;
        if (generated && Array.isArray(generated)) {
          setVolumes(
            generated.map((v, i) => {
              const parts: string[] = [];
              if (v.summary) parts.push(String(v.summary));
              if (v.key_arc) parts.push(`主线弧光：${String(v.key_arc)}`);
              if (v.start_state) parts.push(`开始状态：${String(v.start_state)}`);
              if (v.end_state) parts.push(`结束状态：${String(v.end_state)}`);
              return {
                id: (v.id as string) || crypto.randomUUID(),
                title: (v.title as string) || `第${i + 1}卷`,
                summary: parts.join("\n"),
                sort_order: i,
              };
            })
          );
        }
      }}
      hasData={volumes.length > 0}
    >
      {volumes.length === 0 ? (
        <Card>
          <CardContent>
            <div className="text-center py-8 text-muted-foreground">
              <p className="mb-4">暂无分卷数据，点击下方按钮添加或使用 AI 生成</p>
              <Button variant="outline" onClick={addVolume}>
                <Plus className="h-3.5 w-3.5 mr-1.5" />
                添加第一卷
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {volumes.map((volume, index) => (
            <Card key={volume.id}>
              <CardContent>
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 space-y-3">
                    <div className="flex items-center gap-3">
                      <span className="flex items-center justify-center h-6 w-6 rounded bg-primary/10 text-primary text-xs font-semibold shrink-0">
                        {index + 1}
                      </span>
                      <div className="flex-1">
                        <Label htmlFor={`vol-title-${index}`} className="sr-only">
                          卷标题
                        </Label>
                        <Input
                          id={`vol-title-${index}`}
                          value={volume.title}
                          onChange={(e) =>
                            updateVolume(index, "title", e.target.value)
                          }
                          placeholder="卷标题"
                          className="font-medium"
                        />
                      </div>
                    </div>
                    <div>
                      <Label
                        htmlFor={`vol-summary-${index}`}
                        className="text-xs text-muted-foreground mb-1 block"
                      >
                        内容概要
                      </Label>
                      <Textarea
                        id={`vol-summary-${index}`}
                        value={volume.summary}
                        onChange={(e) =>
                          updateVolume(index, "summary", e.target.value)
                        }
                        placeholder="描述本卷的主要剧情和核心冲突..."
                        rows={3}
                        className="text-sm"
                      />
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="shrink-0 text-muted-foreground hover:text-destructive"
                    onClick={() => removeVolume(index)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}

          <Separator />

          <div className="flex justify-center">
            <Button variant="outline" onClick={addVolume}>
              <Plus className="h-3.5 w-3.5 mr-1.5" />
              添加新卷
            </Button>
          </div>
        </div>
      )}
    </StepPage>
  );
}
