"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useParams } from "next/navigation";
import { Plus, Trash2, Sparkles, Save, Loader2, Zap } from "lucide-react";
import { StepNav } from "@/components/steps/step-nav";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { api } from "@/lib/api-client";
import { useSSE } from "@/hooks/use-sse";
import { toast } from "sonner";

interface Volume {
  id: string;
  title: string;
  summary: string;
}

interface Chapter {
  id: string;
  title: string;
  summary: string;
  sort_order: number;
  word_target: number;
}

export default function ChaptersPage() {
  const { id: projectId } = useParams<{ id: string }>();

  const [volumes, setVolumes] = useState<Volume[]>([]);
  const [selectedVolumeId, setSelectedVolumeId] = useState("");
  const [chaptersByVolume, setChaptersByVolume] = useState<Record<string, Chapter[]>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [chapterWordTarget, setChapterWordTarget] = useState(3000);
  const [direction, setDirection] = useState("");
  const [streamText, setStreamText] = useState("");
  const [progress, setProgress] = useState("");
  const [generatingAll, setGeneratingAll] = useState(false);
  const [generatingVolIdx, setGeneratingVolIdx] = useState(-1);
  const streamRef = useRef("");
  const { start, stop, isStreaming } = useSSE();
  const abortAllRef = useRef(false);

  const chapters = chaptersByVolume[selectedVolumeId] || [];

  const setChapters = (updater: Chapter[] | ((prev: Chapter[]) => Chapter[])) => {
    setChaptersByVolume((prev) => {
      const current = prev[selectedVolumeId] || [];
      const next = typeof updater === "function" ? updater(current) : updater;
      return { ...prev, [selectedVolumeId]: next };
    });
  };

  useEffect(() => {
    (async () => {
      try {
        const data = await api.steps.getVolumes(projectId);
        const vols = data as unknown as Volume[];
        setVolumes(vols);

        const allChapters: Record<string, Chapter[]> = {};
        for (const vol of vols) {
          const chs = await api.steps.getChapters(projectId, vol.id);
          allChapters[vol.id] = chs as unknown as Chapter[];
        }
        setChaptersByVolume(allChapters);

        if (vols.length > 0) setSelectedVolumeId(vols[0].id);
      } catch (e) {
        toast.error("加载数据失败", { description: String(e) });
      } finally {
        setLoading(false);
      }
    })();
  }, [projectId]);

  const saveVolume = async (volumeId: string) => {
    const chs = chaptersByVolume[volumeId];
    if (!chs || chs.length === 0) return;
    await api.steps.saveChapterOutlines(
      projectId, volumeId, chs as unknown as Record<string, unknown>[]
    );
  };

  const saveAll = async () => {
    for (const vol of volumes) {
      await saveVolume(vol.id);
    }
  };

  const switchVolume = async (volumeId: string) => {
    if (volumeId === selectedVolumeId) return;
    // auto-save current volume before switching
    try {
      await saveVolume(selectedVolumeId);
    } catch {
      // silent - don't block switching
    }
    setSelectedVolumeId(volumeId);
  };

  const addChapter = () => {
    setChapters((prev) => [
      ...prev,
      { id: crypto.randomUUID(), title: `第${prev.length + 1}章`, summary: "", sort_order: prev.length, word_target: chapterWordTarget },
    ]);
  };

  const removeChapter = (index: number) => {
    setChapters((prev) => prev.filter((_, i) => i !== index).map((c, i) => ({ ...c, sort_order: i })));
  };

  const updateChapter = (index: number, field: keyof Chapter, value: string) => {
    setChapters((prev) => prev.map((c, i) => (i === index ? { ...c, [field]: value } : c)));
  };

  const parseChapters = (result: Record<string, unknown>): Chapter[] => {
    const generated = result.chapters as Record<string, unknown>[] | undefined;
    if (!generated || !Array.isArray(generated)) return [];
    return generated.map((c, i) => ({
      id: (c.id as string) || crypto.randomUUID(),
      title: (c.title as string) || `第${i + 1}章`,
      summary: (c.summary as string) || "",
      sort_order: i,
      word_target: (c.word_target as number) || chapterWordTarget,
    }));
  };

  // Generate for a single volume
  const handleGenerate = () => {
    setStreamText("");
    streamRef.current = "";
    setProgress("");
    start(
      api.steps.generateUrl(projectId, "chapter-outlines"),
      { volume_id: selectedVolumeId, user_direction: direction, chapter_word_target: chapterWordTarget },
      {
        onContent: (text) => { streamRef.current += text; setStreamText(streamRef.current); },
        onProgress: (msg) => setProgress(msg),
        onDone: (result) => {
          setStreamText("");
          setProgress("");
          const chs = parseChapters(result);
          if (chs.length > 0) setChapters(chs);
          // auto-save
          api.steps.saveChapterOutlines(projectId, selectedVolumeId, chs as unknown as Record<string, unknown>[]).catch(() => {});
          toast.success("当前卷章节大纲生成完成");
        },
        onError: (msg) => { toast.error("生成失败", { description: msg }); setProgress(""); },
      }
    );
  };

  // Generate for ALL volumes sequentially
  const handleGenerateAll = async () => {
    setGeneratingAll(true);
    abortAllRef.current = false;

    for (let i = 0; i < volumes.length; i++) {
      if (abortAllRef.current) break;
      const vol = volumes[i];
      setGeneratingVolIdx(i);
      setSelectedVolumeId(vol.id);
      setProgress(`正在为「${vol.title}」生成章节大纲...（${i + 1}/${volumes.length}）`);
      setStreamText("");
      streamRef.current = "";

      const result = await new Promise<Record<string, unknown> | null>((resolve) => {
        start(
          api.steps.generateUrl(projectId, "chapter-outlines"),
          { volume_id: vol.id, user_direction: direction, chapter_word_target: chapterWordTarget },
          {
            onContent: (text) => { streamRef.current += text; setStreamText(streamRef.current); },
            onProgress: (msg) => setProgress(`「${vol.title}」(${i + 1}/${volumes.length}) — ${msg}`),
            onDone: (r) => resolve(r),
            onError: (msg) => { toast.error(`「${vol.title}」生成失败`, { description: msg }); resolve(null); },
          }
        );
      });

      if (result) {
        const chs = parseChapters(result);
        if (chs.length > 0) {
          setChaptersByVolume((prev) => ({ ...prev, [vol.id]: chs }));
          await api.steps.saveChapterOutlines(projectId, vol.id, chs as unknown as Record<string, unknown>[]).catch(() => {});
        }
      }
    }

    setGeneratingAll(false);
    setGeneratingVolIdx(-1);
    setStreamText("");
    setProgress("");
    toast.success("所有分卷章节大纲生成完成");
  };

  const stopAll = () => {
    abortAllRef.current = true;
    stop();
    setGeneratingAll(false);
    setGeneratingVolIdx(-1);
    setStreamText("");
    setProgress("");
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await saveAll();
      toast.success("全部保存成功");
    } catch (e) {
      toast.error("保存失败", { description: String(e) });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="p-6 max-w-4xl mx-auto"><div className="text-sm text-muted-foreground">加载中...</div></div>;
  }

  if (volumes.length === 0) {
    return (
      <div className="p-6 max-w-4xl mx-auto">
        <h2 className="text-xl font-bold tracking-tight">章节大纲</h2>
        <p className="text-sm text-muted-foreground mt-1">请先完成分卷规划，再进行章节大纲设计</p>
        <Card className="mt-6">
          <CardContent>
            <div className="text-center py-8 text-muted-foreground">
              暂无分卷数据，请先前往「分卷规划」步骤创建卷次
            </div>
          </CardContent>
        </Card>
        <StepNav stepKey="chapters" />
      </div>
    );
  }

  const isBusy = isStreaming || generatingAll;

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex items-start justify-between mb-6">
        <div>
          <h2 className="text-xl font-bold tracking-tight">章节大纲</h2>
          <p className="text-sm text-muted-foreground mt-1">为每卷规划章节结构，可逐卷生成或一键全部生成</p>
        </div>
        <div className="flex gap-2 shrink-0">
          {isBusy ? (
            <Button variant="destructive" size="sm" onClick={generatingAll ? stopAll : stop}>
              停止生成
            </Button>
          ) : (
            <>
              <Button size="sm" variant="outline" onClick={handleGenerate} disabled={!selectedVolumeId}>
                <Sparkles className="h-3.5 w-3.5 mr-1.5" />
                生成当前卷
              </Button>
              <Button size="sm" onClick={handleGenerateAll}>
                <Zap className="h-3.5 w-3.5 mr-1.5" />
                一键全部生成
              </Button>
            </>
          )}
          <Button variant="outline" size="sm" onClick={handleSave} disabled={saving || isBusy}>
            {saving ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <Save className="h-3.5 w-3.5 mr-1.5" />}
            保存
          </Button>
        </div>
      </div>

      {/* Volume tabs */}
      <div className="flex gap-2 mb-4 flex-wrap">
        {volumes.map((vol, i) => {
          const count = (chaptersByVolume[vol.id] || []).length;
          const isGeneratingThis = generatingAll && generatingVolIdx === i;
          return (
            <Button
              key={vol.id}
              variant={selectedVolumeId === vol.id ? "default" : "outline"}
              size="sm"
              onClick={() => switchVolume(vol.id)}
              disabled={isBusy}
              className="gap-1.5"
            >
              {isGeneratingThis && <Loader2 className="h-3 w-3 animate-spin" />}
              {vol.title}
              {count > 0 && <Badge variant="secondary" className="ml-1 text-[10px] px-1.5">{count}章</Badge>}
            </Button>
          );
        })}
      </div>

      {/* Word target + Direction */}
      <div className="mb-4 space-y-3">
        <div className="flex items-center gap-4">
          <Label className="shrink-0 text-sm">每章目标字数</Label>
          <div className="flex items-center gap-2">
            <Input
              type="number"
              min={500}
              value={chapterWordTarget}
              onChange={(e) => setChapterWordTarget(Number(e.target.value) || 3000)}
              className="w-28"
            />
            <span className="text-sm text-muted-foreground">字</span>
          </div>
          <div className="flex gap-1.5">
            {[2000, 3000, 4000, 5000].map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => setChapterWordTarget(v)}
                className={`px-2 py-1 rounded text-xs border transition-colors ${chapterWordTarget === v ? "bg-primary text-primary-foreground border-primary" : "bg-background border-border hover:bg-accent"}`}
              >
                {v}
              </button>
            ))}
          </div>
        </div>
        <Textarea
          placeholder="给 AI 提供创作方向（可选，如：注重悬念设置、每章结尾要有钩子...）"
          value={direction}
          onChange={(e) => setDirection(e.target.value)}
          rows={2}
          className="text-sm"
        />
      </div>

      {/* Streaming */}
      {isBusy && (
        <div className="mb-6 rounded-lg border border-border bg-muted/30 p-4">
          {progress && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-3">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              {progress}
            </div>
          )}
          <pre className="text-sm whitespace-pre-wrap max-h-96 overflow-auto font-mono">
            {streamText || "等待响应..."}
          </pre>
        </div>
      )}

      {/* Chapter list */}
      <div className="space-y-4">
        {chapters.length === 0 && !isBusy ? (
          <Card>
            <CardContent>
              <div className="text-center py-8 text-muted-foreground">
                <p className="mb-4">当前卷暂无章节，点击「生成当前卷」或「一键全部生成」</p>
                <Button variant="outline" onClick={addChapter}>
                  <Plus className="h-3.5 w-3.5 mr-1.5" />
                  手动添加章节
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : (
          chapters.map((chapter, index) => (
            <Card key={chapter.id}>
              <CardContent>
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 space-y-3">
                    <div className="flex items-center gap-3">
                      <Badge variant="outline" className="shrink-0 text-xs">
                        {index + 1}
                      </Badge>
                      <Input
                        placeholder="章节标题"
                        value={chapter.title}
                        onChange={(e) => updateChapter(index, "title", e.target.value)}
                        className="font-medium"
                      />
                    </div>
                    <Textarea
                      placeholder="章节内容摘要..."
                      value={chapter.summary}
                      onChange={(e) => updateChapter(index, "summary", e.target.value)}
                      rows={3}
                    />
                    <div className="flex items-center gap-2">
                      <Label className="text-xs text-muted-foreground shrink-0">目标字数</Label>
                      <Input
                        type="number"
                        min={500}
                        value={chapter.word_target || chapterWordTarget}
                        onChange={(e) => {
                          const val = Number(e.target.value) || chapterWordTarget;
                          setChapters((prev) => prev.map((c, i) => i === index ? { ...c, word_target: val } : c));
                        }}
                        className="w-24 h-7 text-xs"
                      />
                      <span className="text-xs text-muted-foreground">字</span>
                    </div>
                  </div>
                  <Button variant="ghost" size="sm" className="shrink-0 mt-1" onClick={() => removeChapter(index)}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))
        )}

        {chapters.length > 0 && (
          <>
            <Separator />
            <div className="flex justify-center">
              <Button variant="outline" onClick={addChapter}>
                <Plus className="h-3.5 w-3.5 mr-1.5" />
                添加新章节
              </Button>
            </div>
          </>
        )}
      </div>

      <StepNav
        stepKey="chapters"
        onBeforeNavigate={saveAll}
        disabled={isBusy}
      />
    </div>
  );
}
