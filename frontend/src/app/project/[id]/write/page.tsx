"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useParams } from "next/navigation";
import {
  Sparkles,
  Save,
  Loader2,
  FileText,
  History,
  PenLine,
  ArrowRight,
  RotateCcw,
  Wand2,
  AlertTriangle,
} from "lucide-react";
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
import {
  SceneOutlinePanel,
  type DetailedOutline,
} from "@/components/steps/scene-outline-panel";

const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE || "http://localhost:8000/api";

interface ChapterListItem {
  id: string;
  title: string;
  status: string;
  word_count: number;
  sort_order: number;
  volume_id: string;
  volume_title?: string;
}

interface ChapterDetail {
  id: string;
  title: string;
  content: string;
  status: string;
  word_count: number;
  detailed_outline?: DetailedOutline | null;
}

interface VersionItem {
  id: string;
  operation_type: string;
  word_count: number;
  created_at: string;
  preview: string;
}

export default function WritePage() {
  const params = useParams<{ id: string }>();
  const projectId = params.id;

  // Existing state
  const [chapters, setChapters] = useState<ChapterListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedChapterId, setSelectedChapterId] = useState<string>("");
  const [chapterDetail, setChapterDetail] = useState<ChapterDetail | null>(
    null
  );
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [content, setContent] = useState("");
  const [saving, setSaving] = useState(false);
  const [wordTarget, setWordTarget] = useState(3000);
  const [streamText, setStreamText] = useState("");
  const [progress, setProgress] = useState("");
  const streamRef = useRef("");
  const { start, stop, isStreaming } = useSSE();

  // Version history state
  const [showVersions, setShowVersions] = useState(false);
  const [versions, setVersions] = useState<VersionItem[]>([]);
  const [loadingVersions, setLoadingVersions] = useState(false);
  const [rollingBack, setRollingBack] = useState<string | null>(null);

  // AI generate direction
  const [generateDirection, setGenerateDirection] = useState("");

  // AI rewrite state
  const [showRewrite, setShowRewrite] = useState(false);
  const [rewriteInstruction, setRewriteInstruction] = useState("");

  // AI continue state
  const [continueWordTarget, setContinueWordTarget] = useState(1000);

  // Scene outline state
  const [detailedOutline, setDetailedOutline] = useState<DetailedOutline | null>(null);
  const [savingOutline, setSavingOutline] = useState(false);
  const outlineSSE = useSSE();

  // Polish state
  const [showPolish, setShowPolish] = useState(false);
  const [polishDirection, setPolishDirection] = useState("");

  // Stale chapter tracking
  const [staleChapterIds, setStaleChapterIds] = useState<Set<string>>(new Set());

  // ---- Data loading ----

  const loadChapters = useCallback(async () => {
    try {
      const data = await api.steps.getChapters(projectId);
      setChapters(data as unknown as ChapterListItem[]);
    } catch (e) {
      toast.error("加载章节列表失败", { description: String(e) });
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  const loadChapterDetail = useCallback(
    async (chapterId: string) => {
      setLoadingDetail(true);
      try {
        const data = await api.steps.getChapter(projectId, chapterId);
        const detail = data as unknown as ChapterDetail & {
          word_target?: number;
        };
        setChapterDetail(detail);
        setContent(detail.content || "");
        setDetailedOutline(
          (detail.detailed_outline as DetailedOutline | null) || null
        );
        if (detail.word_target && detail.word_target > 0) {
          setWordTarget(detail.word_target);
        }
      } catch (e) {
        toast.error("加载章节内容失败", { description: String(e) });
      } finally {
        setLoadingDetail(false);
      }
    },
    [projectId]
  );

  const loadVersions = useCallback(
    async (chapterId: string) => {
      setLoadingVersions(true);
      try {
        const res = await fetch(
          API_BASE +
            "/steps/" +
            projectId +
            "/chapter/" +
            chapterId +
            "/versions"
        );
        if (!res.ok) throw new Error("Failed to load versions");
        const data = await res.json();
        setVersions(data as VersionItem[]);
      } catch (e) {
        toast.error("加载版本历史失败", { description: String(e) });
      } finally {
        setLoadingVersions(false);
      }
    },
    [projectId]
  );

  useEffect(() => {
    loadChapters();
    api.steps.getStaleness(projectId).then((data) => {
      setStaleChapterIds(new Set(data.stale_chapters.map((c) => c.id)));
    }).catch(() => {});
  }, [loadChapters, projectId]);

  // ---- Chapter selection ----

  const selectChapter = (chapterId: string) => {
    setSelectedChapterId(chapterId);
    setStreamText("");
    streamRef.current = "";
    setProgress("");
    setShowVersions(false);
    setVersions([]);
    setShowRewrite(false);
    setRewriteInstruction("");
    setShowPolish(false);
    setPolishDirection("");
    setDetailedOutline(null);
    loadChapterDetail(chapterId);
  };

  // ---- Generate (existing) ----

  const handleGenerate = () => {
    if (!selectedChapterId) return;
    setStreamText("");
    streamRef.current = "";
    setProgress("");
    const url = api.steps.generateUrl(
      projectId,
      `chapter/${selectedChapterId}`
    );
    start(
      url,
      { word_target: wordTarget, user_direction: generateDirection },
      {
        onContent: (text) => {
          streamRef.current += text;
          setStreamText(streamRef.current);
          setContent(streamRef.current);
        },
        onProgress: (msg) => setProgress(msg),
        onDone: async (result) => {
          setStreamText("");
          setProgress("");
          const generatedContent =
            (result.content as string) || streamRef.current;
          setContent(generatedContent);
          try {
            await api.steps.updateChapter(projectId, selectedChapterId, {
              content: generatedContent,
              status: "completed",
            });
            await loadChapters();
            await loadChapterDetail(selectedChapterId);
            toast.success("生成完成并已保存");
            fetch(api.knowledge.updateStateUrl(projectId, selectedChapterId), {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: "{}",
            }).then(() => toast.success("叙事状态已更新")).catch(() => {});
          } catch (e) {
            toast.error("自动保存失败", { description: String(e) });
          }
        },
        onError: (msg) => {
          toast.error("生成失败", { description: msg });
          setProgress("");
        },
      }
    );
  };

  // ---- Save (existing) ----

  const handleSave = async () => {
    if (!selectedChapterId) return;
    setSaving(true);
    try {
      await api.steps.updateChapter(projectId, selectedChapterId, {
        content,
      });
      await loadChapters();
      await loadChapterDetail(selectedChapterId);
      toast.success("保存成功");
    } catch (e) {
      toast.error("保存失败", { description: String(e) });
    } finally {
      setSaving(false);
    }
  };

  // ---- Version rollback ----

  const handleRollback = async (versionId: string) => {
    if (!selectedChapterId) return;
    setRollingBack(versionId);
    try {
      const res = await fetch(
        API_BASE +
          "/steps/" +
          projectId +
          "/chapter/" +
          selectedChapterId +
          "/rollback/" +
          versionId,
        { method: "POST" }
      );
      if (!res.ok) throw new Error("Rollback failed");
      toast.success("已回退到该版本");
      await loadChapterDetail(selectedChapterId);
      await loadVersions(selectedChapterId);
      await loadChapters();
    } catch (e) {
      toast.error("回退失败", { description: String(e) });
    } finally {
      setRollingBack(null);
    }
  };

  // ---- AI Rewrite ----

  const handleRewrite = () => {
    if (!selectedChapterId || !rewriteInstruction.trim()) {
      toast.error("请输入改写指令");
      return;
    }
    setStreamText("");
    streamRef.current = "";
    setProgress("");
    const url =
      API_BASE +
      "/steps/" +
      projectId +
      "/generate/rewrite/" +
      selectedChapterId;
    start(
      url,
      { instruction: rewriteInstruction, selected_text: "" },
      {
        onContent: (text) => {
          streamRef.current += text;
          setStreamText(streamRef.current);
          setContent(streamRef.current);
        },
        onProgress: (msg) => setProgress(msg),
        onDone: async (result) => {
          setStreamText("");
          setProgress("");
          const rewrittenContent =
            (result.content as string) || streamRef.current;
          setContent(rewrittenContent);
          await loadChapters();
          toast.success("改写完成");
        },
        onError: (msg) => {
          toast.error("改写失败", { description: msg });
          setProgress("");
        },
      }
    );
  };

  // ---- AI Continue ----

  const handleContinue = () => {
    if (!selectedChapterId) return;
    setStreamText("");
    streamRef.current = "";
    setProgress("");
    const url =
      API_BASE +
      "/steps/" +
      projectId +
      "/generate/continue/" +
      selectedChapterId;
    start(
      url,
      { user_direction: generateDirection, word_target: continueWordTarget },
      {
        onContent: (text) => {
          streamRef.current += text;
          setStreamText(streamRef.current);
          setContent(streamRef.current);
        },
        onProgress: (msg) => setProgress(msg),
        onDone: async (result) => {
          setStreamText("");
          setProgress("");
          const continuedContent =
            (result.content as string) || streamRef.current;
          setContent(continuedContent);
          await loadChapters();
          toast.success("续写完成");
        },
        onError: (msg) => {
          toast.error("续写失败", { description: msg });
          setProgress("");
        },
      }
    );
  };

  // ---- Helpers ----

  const statusLabel = (status: string) => {
    switch (status) {
      case "completed":
        return "已完成";
      case "writing":
        return "写作中";
      default:
        return "待写作";
    }
  };

  const statusVariant = (status: string) => {
    switch (status) {
      case "completed":
        return "default" as const;
      case "writing":
        return "secondary" as const;
      default:
        return "outline" as const;
    }
  };

  const operationLabel = (op: string) => {
    switch (op) {
      case "generate":
        return "生成";
      case "rewrite":
        return "改写";
      case "continue":
        return "续写";
      case "manual":
        return "手动保存";
      case "rollback":
        return "回退";
      default:
        return op;
    }
  };

  // ---- Scene outline ----

  const handleGenerateOutline = () => {
    if (!selectedChapterId) return;
    const url = api.steps.generateDetailedOutlineUrl(projectId, selectedChapterId);
    outlineSSE.start(url, {}, {
      onContent: () => {},
      onProgress: (msg) => setProgress(msg),
      onDone: (result) => {
        setProgress("");
        if (result && (result as Record<string, unknown>).scenes) {
          setDetailedOutline(result as unknown as DetailedOutline);
          toast.success("场景细纲生成完成");
        }
      },
      onError: (msg) => {
        setProgress("");
        toast.error("细纲生成失败", { description: msg });
      },
    });
  };

  const handleSaveOutline = async () => {
    if (!selectedChapterId || !detailedOutline) return;
    setSavingOutline(true);
    try {
      await api.steps.saveDetailedOutline(
        projectId,
        selectedChapterId,
        detailedOutline as unknown as Record<string, unknown>
      );
      toast.success("细纲已保存");
    } catch (e) {
      toast.error("保存失败", { description: String(e) });
    } finally {
      setSavingOutline(false);
    }
  };

  // ---- Polish ----

  const handlePolish = () => {
    if (!selectedChapterId) return;
    setStreamText("");
    streamRef.current = "";
    setProgress("");
    const url = api.steps.polishUrl(projectId, selectedChapterId);
    start(url, { selected_text: "", user_direction: polishDirection }, {
      onContent: (text) => {
        streamRef.current += text;
        setStreamText(streamRef.current);
        setContent(streamRef.current);
      },
      onProgress: (msg) => setProgress(msg),
      onDone: async (result) => {
        setStreamText("");
        setProgress("");
        const polishedContent = (result.content as string) || streamRef.current;
        setContent(polishedContent);
        await loadChapters();
        await loadChapterDetail(selectedChapterId);
        toast.success("润色完成");
      },
      onError: (msg) => {
        toast.error("润色失败", { description: msg });
        setProgress("");
      },
    });
  };

  const formatDate = (dateStr: string) => {
    try {
      const d = new Date(dateStr);
      return d.toLocaleString("zh-CN", {
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return dateStr;
    }
  };

  // ---- Toggle version panel ----

  const toggleVersions = () => {
    if (!showVersions && selectedChapterId) {
      loadVersions(selectedChapterId);
    }
    setShowVersions((v) => !v);
  };

  // ---- Render ----

  if (loading) {
    return (
      <div className="p-6">
        <div className="text-sm text-muted-foreground">加载中...</div>
      </div>
    );
  }

  return (
    <div className="flex h-full">
      {/* Left: chapter list */}
      <div className="w-64 border-r border-border bg-muted/20 flex flex-col shrink-0 overflow-hidden">
        <div className="p-3 border-b border-border">
          <h2 className="text-sm font-semibold">章节列表</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            共 {chapters.length} 章
          </p>
        </div>
        <div className="flex-1 overflow-auto py-1">
          {chapters.length === 0 ? (
            <div className="p-4 text-sm text-muted-foreground text-center">
              暂无章节，请先完成章节大纲
            </div>
          ) : (
            chapters.map((ch) => (
              <button
                key={ch.id}
                className={`w-full text-left px-3 py-2.5 border-b border-border/50 transition-colors ${
                  selectedChapterId === ch.id
                    ? "bg-accent text-accent-foreground"
                    : "hover:bg-muted/50"
                }`}
                onClick={() => selectChapter(ch.id)}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-medium truncate flex items-center gap-1">
                    {staleChapterIds.has(ch.id) && (
                      <AlertTriangle className="h-3 w-3 text-yellow-500 shrink-0" />
                    )}
                    {ch.title}
                  </span>
                  <Badge
                    variant={statusVariant(ch.status)}
                    className="shrink-0 text-[10px]"
                  >
                    {statusLabel(ch.status)}
                  </Badge>
                </div>
                <div className="text-xs text-muted-foreground mt-1">
                  {ch.word_count > 0 ? `${ch.word_count} 字` : "尚未写作"}
                </div>
              </button>
            ))
          )}
        </div>
      </div>

      {/* Right: content editor */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {!selectedChapterId ? (
          <div className="flex-1 flex items-center justify-center text-muted-foreground">
            <div className="text-center">
              <FileText className="h-12 w-12 mx-auto mb-3 opacity-30" />
              <p className="text-sm">选择左侧章节开始写作</p>
            </div>
          </div>
        ) : loadingDetail ? (
          <div className="flex-1 flex items-center justify-center">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <>
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-border shrink-0">
              <div>
                <h3 className="font-semibold">
                  {chapterDetail?.title || ""}
                </h3>
                {chapterDetail && (
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {chapterDetail.word_count > 0
                      ? `${chapterDetail.word_count} 字`
                      : "尚未写作"}
                  </p>
                )}
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <div className="flex items-center gap-1.5">
                  <Input
                    type="number"
                    min={500}
                    value={wordTarget}
                    onChange={(e) =>
                      setWordTarget(Number(e.target.value) || 3000)
                    }
                    className="w-20 h-8 text-xs"
                  />
                  <span className="text-xs text-muted-foreground">字</span>
                </div>
                {isStreaming ? (
                  <Button variant="destructive" size="sm" onClick={stop}>
                    停止生成
                  </Button>
                ) : (
                  <Button
                    size="sm"
                    onClick={handleGenerate}
                    disabled={isStreaming}
                  >
                    <Sparkles className="h-3.5 w-3.5 mr-1.5" />
                    AI 生成
                  </Button>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleSave}
                  disabled={saving || isStreaming}
                >
                  {saving ? (
                    <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                  ) : (
                    <Save className="h-3.5 w-3.5 mr-1.5" />
                  )}
                  保存
                </Button>
              </div>
            </div>

            {/* Direction input */}
            <div className="px-4 py-2 border-b border-border bg-muted/10">
              <Textarea
                placeholder={'给 AI 提供创作方向（可选，如：第一句话必须是"算了，我来嫁。"、这章节奏要快每千字一个看点...）'}
                value={generateDirection}
                onChange={(e) => setGenerateDirection(e.target.value)}
                rows={2}
                className="text-sm"
              />
            </div>

            {/* Streaming progress */}
            {isStreaming && progress && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground px-4 py-2 bg-muted/30 border-b border-border">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                {progress}
              </div>
            )}

            {/* Scene Outline Panel */}
            <SceneOutlinePanel
              outline={detailedOutline}
              onOutlineChange={setDetailedOutline}
              onGenerate={handleGenerateOutline}
              onSave={handleSaveOutline}
              isStreaming={outlineSSE.isStreaming}
              isSaving={savingOutline}
            />

            {/* Editor */}
            <div className="flex-1 p-4 overflow-auto">
              <Label htmlFor="chapter-content" className="sr-only">
                章节内容
              </Label>
              <Textarea
                id="chapter-content"
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="在此输入章节内容，或点击「AI 生成」自动创作..."
                className="min-h-full resize-none text-sm leading-relaxed font-[inherit]"
                rows={30}
                disabled={isStreaming}
              />
            </div>

            {/* AI Tools: Rewrite + Continue */}
            <div className="border-t border-border shrink-0">
              <div className="px-4 py-2 flex items-center gap-2">
                <Button
                  variant={showRewrite ? "secondary" : "ghost"}
                  size="sm"
                  onClick={() => setShowRewrite((v) => !v)}
                >
                  <PenLine className="h-3.5 w-3.5 mr-1.5" />
                  AI 改写
                </Button>
                <Separator orientation="vertical" className="h-5" />
                <div className="flex items-center gap-1.5">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleContinue}
                    disabled={isStreaming || !selectedChapterId}
                  >
                    <ArrowRight className="h-3.5 w-3.5 mr-1.5" />
                    AI 续写
                  </Button>
                  <Input
                    type="number"
                    min={100}
                    value={continueWordTarget}
                    onChange={(e) =>
                      setContinueWordTarget(Number(e.target.value) || 1000)
                    }
                    className="w-20 h-7 text-xs"
                    disabled={isStreaming}
                  />
                  <span className="text-xs text-muted-foreground">字</span>
                </div>
                <Separator orientation="vertical" className="h-5" />
                <Button
                  variant={showPolish ? "secondary" : "ghost"}
                  size="sm"
                  onClick={() => setShowPolish((v) => !v)}
                >
                  <Wand2 className="h-3.5 w-3.5 mr-1.5" />
                  润色降AI味
                </Button>
                <div className="flex-1" />
                <Button
                  variant={showVersions ? "secondary" : "ghost"}
                  size="sm"
                  onClick={toggleVersions}
                >
                  <History className="h-3.5 w-3.5 mr-1.5" />
                  版本历史
                </Button>
              </div>

              {/* Rewrite panel */}
              {showRewrite && (
                <div className="px-4 pb-3">
                  <div className="flex gap-2 items-end">
                    <div className="flex-1">
                      <Label
                        htmlFor="rewrite-instruction"
                        className="text-xs text-muted-foreground mb-1 block"
                      >
                        改写指令
                      </Label>
                      <Textarea
                        id="rewrite-instruction"
                        value={rewriteInstruction}
                        onChange={(e) => setRewriteInstruction(e.target.value)}
                        placeholder="例如：改得更紧张、换成第一人称、增加细节描写..."
                        className="text-sm resize-none"
                        rows={2}
                        disabled={isStreaming}
                      />
                    </div>
                    <Button
                      size="sm"
                      onClick={handleRewrite}
                      disabled={
                        isStreaming || !rewriteInstruction.trim()
                      }
                      className="shrink-0"
                    >
                      {isStreaming ? (
                        <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                      ) : (
                        <PenLine className="h-3.5 w-3.5 mr-1.5" />
                      )}
                      改写整章
                    </Button>
                  </div>
                </div>
              )}

              {/* Polish panel */}
              {showPolish && (
                <div className="px-4 pb-3">
                  <div className="flex gap-2 items-end">
                    <div className="flex-1">
                      <Label
                        htmlFor="polish-direction"
                        className="text-xs text-muted-foreground mb-1 block"
                      >
                        润色方向（可选）
                      </Label>
                      <Textarea
                        id="polish-direction"
                        value={polishDirection}
                        onChange={(e) => setPolishDirection(e.target.value)}
                        placeholder="留空则按默认规则润色：替换AI典型表达、增强感官细节、调整节奏..."
                        className="text-sm resize-none"
                        rows={2}
                        disabled={isStreaming}
                      />
                    </div>
                    <Button
                      size="sm"
                      onClick={handlePolish}
                      disabled={isStreaming || !content}
                      className="shrink-0"
                    >
                      {isStreaming ? (
                        <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                      ) : (
                        <Wand2 className="h-3.5 w-3.5 mr-1.5" />
                      )}
                      润色整章
                    </Button>
                  </div>
                </div>
              )}

              {/* Version history panel */}
              {showVersions && (
                <div className="px-4 pb-3 max-h-60 overflow-auto">
                  {loadingVersions ? (
                    <div className="flex items-center gap-2 py-3 text-sm text-muted-foreground">
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      加载版本历史...
                    </div>
                  ) : versions.length === 0 ? (
                    <p className="text-sm text-muted-foreground py-3">
                      暂无版本历史
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {versions.map((v) => (
                        <Card key={v.id} className="shadow-none">
                          <CardContent className="p-3">
                            <div className="flex items-center justify-between gap-2">
                              <div className="flex items-center gap-2 min-w-0">
                                <Badge variant="secondary" className="text-[10px] shrink-0">
                                  {operationLabel(v.operation_type)}
                                </Badge>
                                <span className="text-xs text-muted-foreground shrink-0">
                                  {v.word_count} 字
                                </span>
                                <span className="text-xs text-muted-foreground shrink-0">
                                  {formatDate(v.created_at)}
                                </span>
                              </div>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="shrink-0 text-xs h-7"
                                onClick={() => handleRollback(v.id)}
                                disabled={
                                  isStreaming || rollingBack !== null
                                }
                              >
                                {rollingBack === v.id ? (
                                  <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                                ) : (
                                  <RotateCcw className="h-3 w-3 mr-1" />
                                )}
                                回退到此版本
                              </Button>
                            </div>
                            {v.preview && (
                              <p className="text-xs text-muted-foreground mt-1.5 line-clamp-2">
                                {v.preview}
                              </p>
                            )}
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </>
        )}
      </div>

      <div className="px-6 pb-6 max-w-4xl mx-auto">
        <StepNav
          stepKey="write"
          onBeforeNavigate={async () => {
            if (selectedChapterId && content) {
              await api.steps.updateChapter(projectId, selectedChapterId, {
                content,
              });
            }
          }}
          disabled={isStreaming}
        />
      </div>
    </div>
  );
}
