"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import {
  Zap,
  Loader2,
  CheckCircle2,
  Circle,
  Square,
  Clock,
  AlertCircle,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { api } from "@/lib/api-client";
import { useSSE } from "@/hooks/use-sse";
import { toast } from "sonner";

type StepStatus = "pending" | "running" | "done" | "error";

interface StepDef {
  key: string;
  label: string;
  description: string;
}

interface StepState {
  status: StepStatus;
  message: string;
}

const STEPS: StepDef[] = [
  { key: "settings", label: "基础设定", description: "生成故事背景、基调和核心冲突" },
  { key: "characters", label: "人物设定", description: "生成主要角色和配角设定" },
  { key: "worldview", label: "世界观", description: "构建故事世界观和设定体系" },
  { key: "outline", label: "故事大纲", description: "生成完整的故事大纲" },
  { key: "volumes", label: "分卷规划", description: "规划分卷结构" },
  { key: "chapter-outlines", label: "章节大纲", description: "为每卷生成章节大纲" },
  { key: "chapters", label: "正文写作", description: "逐章生成正文内容" },
  { key: "quality-check", label: "质量检查", description: "AI 检查全文一致性和质量问题" },
];

function initStepStates(): Record<string, StepState> {
  const init: Record<string, StepState> = {};
  STEPS.forEach((s) => {
    init[s.key] = { status: "pending", message: "" };
  });
  return init;
}

function loadLog(projectId: string): string[] {
  try {
    const raw = sessionStorage.getItem(`auto-log-${projectId}`);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveLog(projectId: string, log: string[]) {
  try {
    sessionStorage.setItem(`auto-log-${projectId}`, JSON.stringify(log.slice(-100)));
  } catch { /* ignore */ }
}

export default function AutoPage() {
  const { id: projectId } = useParams<{ id: string }>();

  const [stepStates, setStepStates] = useState<Record<string, StepState>>(initStepStates);
  const [currentStepIdx, setCurrentStepIdx] = useState(-1);
  const [streamText, setStreamText] = useState("");
  const [progress, setProgress] = useState("");
  const [isRunning, setIsRunning] = useState(false);
  const [completedLog, setCompletedLog] = useState<string[]>([]);
  const [initialLoaded, setInitialLoaded] = useState(false);

  const streamRef = useRef("");
  const abortRef = useRef(false);
  const { start, stop, isStreaming } = useSSE();

  // On mount: detect which steps already have data and restore log
  useEffect(() => {
    const restoredLog = loadLog(projectId);
    if (restoredLog.length > 0) {
      setCompletedLog(restoredLog);
    }

    (async () => {
      const states = initStepStates();
      try {
        const settings = await api.steps.getSettings(projectId);
        if (settings && Object.keys(settings).length > 0 && (settings.background || settings.tone)) {
          states.settings = { status: "done", message: "已有数据" };
        }
      } catch { /* empty */ }
      try {
        const chars = await api.steps.getCharacters(projectId);
        if (chars && chars.length > 0) {
          states.characters = { status: "done", message: "已有数据" };
        }
      } catch { /* empty */ }
      try {
        const wv = await api.steps.getWorldview(projectId);
        if (wv && Object.keys(wv).length > 0) {
          states.worldview = { status: "done", message: "已有数据" };
        }
      } catch { /* empty */ }
      try {
        const ol = await api.steps.getOutline(projectId);
        if (ol && Object.keys(ol).length > 0) {
          states.outline = { status: "done", message: "已有数据" };
        }
      } catch { /* empty */ }
      try {
        const vols = await api.steps.getVolumes(projectId);
        if (vols && vols.length > 0) {
          states.volumes = { status: "done", message: "已有数据" };

          const chapters = await api.steps.getChapters(projectId);
          if (chapters && chapters.length > 0) {
            states["chapter-outlines"] = { status: "done", message: "已有数据" };

            const hasContent = chapters.some((c: Record<string, unknown>) => c.content && (c.content as string).length > 0);
            if (hasContent) {
              states.chapters = { status: "done", message: "已有数据" };
            }
          }
        }
      } catch { /* empty */ }

      setStepStates(states);
      setInitialLoaded(true);
    })();
  }, [projectId]);

  const updateStep = useCallback((key: string, update: Partial<StepState>) => {
    setStepStates((prev) => ({
      ...prev,
      [key]: { ...prev[key], ...update },
    }));
  }, []);

  const addLog = useCallback((msg: string) => {
    setCompletedLog((prev) => {
      const next = [...prev, `[${new Date().toLocaleTimeString()}] ${msg}`];
      saveLog(projectId, next);
      return next;
    });
  }, [projectId]);

  const runSSE = useCallback(
    (url: string, body: Record<string, unknown>): Promise<Record<string, unknown> | null> => {
      return new Promise((resolve) => {
        if (abortRef.current) {
          resolve(null);
          return;
        }
        streamRef.current = "";
        setStreamText("");
        start(url, body, {
          onContent: (text) => {
            streamRef.current += text;
            setStreamText(streamRef.current);
          },
          onProgress: (msg) => setProgress(msg),
          onDone: (result) => {
            setStreamText("");
            setProgress("");
            resolve(result);
          },
          onError: (msg) => {
            setProgress("");
            resolve(null);
            toast.error("生成出错", { description: msg });
          },
        });
      });
    },
    [start]
  );

  const handleStart = async () => {
    setIsRunning(true);
    abortRef.current = false;
    setCompletedLog([]);
    saveLog(projectId, []);

    const init = initStepStates();
    setStepStates(init);

    const basicSteps = ["settings", "characters", "worldview", "outline", "volumes"];

    for (let i = 0; i < basicSteps.length; i++) {
      if (abortRef.current) break;
      const stepKey = basicSteps[i];
      const stepDef = STEPS.find((s) => s.key === stepKey)!;
      setCurrentStepIdx(STEPS.findIndex((s) => s.key === stepKey));
      updateStep(stepKey, { status: "running", message: "正在生成..." });
      setProgress(`正在生成${stepDef.label}...`);

      const result = await runSSE(
        api.steps.generateUrl(projectId, stepKey),
        { user_direction: "" }
      );

      if (abortRef.current) break;

      if (!result) {
        updateStep(stepKey, { status: "error", message: "生成失败" });
        addLog(`${stepDef.label} - 生成失败`);
        continue;
      }

      try {
        switch (stepKey) {
          case "settings":
            await api.steps.saveSettings(projectId, result);
            break;
          case "characters":
            await api.steps.saveCharacters(projectId, (result.characters as Record<string, unknown>[]) || []);
            break;
          case "worldview":
            await api.steps.saveWorldview(projectId, result);
            break;
          case "outline":
            await api.steps.saveOutline(projectId, result);
            break;
          case "volumes":
            await api.steps.saveVolumes(projectId, (result.volumes as Record<string, unknown>[]) || []);
            break;
        }
        updateStep(stepKey, { status: "done", message: "完成" });
        addLog(`${stepDef.label} - 生成并保存成功`);
      } catch (e) {
        updateStep(stepKey, { status: "error", message: "保存失败" });
        addLog(`${stepDef.label} - 保存失败: ${String(e)}`);
      }
    }

    if (abortRef.current) { setIsRunning(false); return; }

    // Step 6: chapter outlines
    updateStep("chapter-outlines", { status: "running", message: "正在生成..." });
    setCurrentStepIdx(STEPS.findIndex((s) => s.key === "chapter-outlines"));

    let volumes: Record<string, unknown>[] = [];
    try {
      volumes = await api.steps.getVolumes(projectId);
    } catch {
      updateStep("chapter-outlines", { status: "error", message: "获取分卷失败" });
      addLog("章节大纲 - 获取分卷数据失败");
    }

    for (let vi = 0; vi < volumes.length; vi++) {
      if (abortRef.current) break;
      const vol = volumes[vi];
      const volTitle = (vol.title as string) || `第${vi + 1}卷`;
      setProgress(`正在为「${volTitle}」生成章节大纲 (${vi + 1}/${volumes.length})...`);

      const result = await runSSE(
        api.steps.generateUrl(projectId, "chapter-outlines"),
        { volume_id: vol.id as string, user_direction: "" }
      );

      if (abortRef.current) break;

      if (result) {
        try {
          await api.steps.saveChapterOutlines(projectId, vol.id as string, (result.chapters as Record<string, unknown>[]) || []);
          addLog(`「${volTitle}」章节大纲 - 生成并保存成功`);
        } catch (e) {
          addLog(`「${volTitle}」章节大纲 - 保存失败: ${String(e)}`);
        }
      } else {
        addLog(`「${volTitle}」章节大纲 - 生成失败`);
      }
    }

    if (!abortRef.current) updateStep("chapter-outlines", { status: "done", message: "完成" });
    if (abortRef.current) { setIsRunning(false); return; }

    // Step 7: chapter content
    updateStep("chapters", { status: "running", message: "正在生成..." });
    setCurrentStepIdx(STEPS.findIndex((s) => s.key === "chapters"));

    let allChapters: Record<string, unknown>[] = [];
    try {
      allChapters = await api.steps.getChapters(projectId);
    } catch {
      updateStep("chapters", { status: "error", message: "获取章节失败" });
      addLog("正文写作 - 获取章节列表失败");
    }

    for (let ci = 0; ci < allChapters.length; ci++) {
      if (abortRef.current) break;
      const ch = allChapters[ci];
      const chTitle = (ch.title as string) || `第${ci + 1}章`;
      setProgress(`正在生成「${chTitle}」正文 (${ci + 1}/${allChapters.length})...`);

      const result = await runSSE(
        api.steps.generateUrl(projectId, "chapter/" + (ch.id as string)),
        {}
      );

      if (abortRef.current) break;

      if (result) {
        try {
          await api.steps.updateChapter(projectId, ch.id as string, {
            content: result.content as string,
            status: "completed",
          });
          addLog(`「${chTitle}」正文 - 生成并保存成功`);
        } catch (e) {
          addLog(`「${chTitle}」正文 - 保存失败: ${String(e)}`);
        }
      } else {
        addLog(`「${chTitle}」正文 - 生成失败`);
      }
    }

    if (!abortRef.current) {
      updateStep("chapters", { status: "done", message: "完成" });
    }

    if (abortRef.current) { setIsRunning(false); return; }

    // Step 8: quality check
    updateStep("quality-check", { status: "running", message: "正在检查..." });
    setCurrentStepIdx(STEPS.findIndex((s) => s.key === "quality-check"));
    setProgress("正在对全文进行质量检查...");

    const qcResult = await runSSE(
      api.steps.generateUrl(projectId, "quality-check"),
      {}
    );

    if (!abortRef.current) {
      if (qcResult) {
        updateStep("quality-check", { status: "done", message: "完成" });
        const issues = (qcResult.issues as unknown[]) || [];
        const score = qcResult.overall_score || "N/A";
        addLog(`质量检查完成 — 评分：${score}，发现 ${issues.length} 个问题`);
      } else {
        updateStep("quality-check", { status: "error", message: "检查失败" });
        addLog("质量检查 - 执行失败");
      }
      addLog("全部生成完成！");
      toast.success("一键生成完成", { description: "所有步骤已执行完毕" });
    }

    setIsRunning(false);
    setCurrentStepIdx(-1);
    setStreamText("");
    setProgress("");
  };

  const handleStop = () => {
    abortRef.current = true;
    stop();
    setIsRunning(false);
    setStreamText("");
    setProgress("");
    toast.info("已停止生成");
  };

  const getStepIcon = (status: StepStatus) => {
    switch (status) {
      case "done":
        return <CheckCircle2 className="h-4 w-4 text-green-500" />;
      case "running":
        return <Loader2 className="h-4 w-4 text-primary animate-spin" />;
      case "error":
        return <AlertCircle className="h-4 w-4 text-destructive" />;
      default:
        return <Circle className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const getStatusBadge = (status: StepStatus) => {
    switch (status) {
      case "done":
        return <Badge className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">完成</Badge>;
      case "running":
        return <Badge variant="default">进行中</Badge>;
      case "error":
        return <Badge variant="destructive">失败</Badge>;
      default:
        return <Badge variant="outline">等待</Badge>;
    }
  };

  const doneCount = STEPS.filter((s) => stepStates[s.key]?.status === "done").length;

  if (!initialLoaded) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-start justify-between mb-6">
        <div>
          <h2 className="text-xl font-bold tracking-tight">一键生成</h2>
          <p className="text-sm text-muted-foreground mt-1">
            自动执行全部创作步骤，从基础设定到正文写作一气呵成
          </p>
        </div>
        {isRunning ? (
          <Button variant="destructive" size="sm" onClick={handleStop}>
            <Square className="h-3.5 w-3.5 mr-1.5" />
            停止生成
          </Button>
        ) : (
          <Button size="sm" onClick={handleStart}>
            <Zap className="h-3.5 w-3.5 mr-1.5" />
            {doneCount > 0 ? "重新生成" : "开始一键生成"}
          </Button>
        )}
      </div>

      {/* Progress bar */}
      {(isRunning || doneCount > 0) && (
        <div className="mb-4">
          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
            <Clock className="h-3.5 w-3.5" />
            进度：{doneCount} / {STEPS.length} 步骤完成
          </div>
          <div className="w-full bg-muted rounded-full h-2">
            <div
              className="bg-primary h-2 rounded-full transition-all duration-500"
              style={{ width: `${(doneCount / STEPS.length) * 100}%` }}
            />
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Step list */}
        <div className="lg:col-span-1">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">生成步骤</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="divide-y divide-border">
                {STEPS.map((step, idx) => {
                  const state = stepStates[step.key];
                  const isCurrent = currentStepIdx === idx;
                  return (
                    <div
                      key={step.key}
                      className={`flex items-center gap-3 px-4 py-3 transition-colors ${
                        isCurrent ? "bg-accent/50" : ""
                      }`}
                    >
                      {getStepIcon(state.status)}
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium flex items-center gap-2">
                          <span className="text-xs text-muted-foreground">{idx + 1}.</span>
                          {step.label}
                        </div>
                        <div className="text-xs text-muted-foreground truncate">
                          {step.description}
                        </div>
                      </div>
                      {getStatusBadge(state.status)}
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Main content area */}
        <div className="lg:col-span-2 space-y-4">
          {(isStreaming || streamText || progress) && (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm flex items-center gap-2">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  {currentStepIdx >= 0
                    ? `正在执行：${STEPS[currentStepIdx].label}`
                    : "处理中..."}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {progress && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground mb-3">
                    <Loader2 className="h-3 w-3 animate-spin" />
                    {progress}
                  </div>
                )}
                <pre className="text-sm whitespace-pre-wrap max-h-80 overflow-auto rounded-lg border border-border bg-muted/30 p-4 font-mono">
                  {streamText || "等待响应..."}
                </pre>
              </CardContent>
            </Card>
          )}

          {/* Log */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">执行日志</CardTitle>
            </CardHeader>
            <CardContent>
              {completedLog.length === 0 ? (
                <div className="text-center py-8 text-sm text-muted-foreground">
                  {isRunning
                    ? "等待第一个步骤完成..."
                    : doneCount > 0
                    ? "之前的生成已完成，数据已保存。可点击「重新生成」重新执行。"
                    : "点击「开始一键生成」启动自动创作流程"}
                </div>
              ) : (
                <div className="space-y-1 max-h-96 overflow-auto">
                  {completedLog.map((log, i) => (
                    <div
                      key={i}
                      className={`text-xs font-mono px-2 py-1 rounded ${
                        log.includes("失败")
                          ? "text-destructive bg-destructive/5"
                          : "text-muted-foreground"
                      }`}
                    >
                      {log}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Completion */}
          {!isRunning && doneCount === STEPS.length && (
            <>
              <Separator />
              <Card className="border-green-200 dark:border-green-800">
                <CardContent className="py-6">
                  <div className="text-center space-y-2">
                    <CheckCircle2 className="h-8 w-8 text-green-500 mx-auto" />
                    <p className="font-medium">全部生成完成！</p>
                    <p className="text-sm text-muted-foreground">
                      可前往左侧「发布素材」生成上架素材，或「导出」下载小说文件
                    </p>
                  </div>
                </CardContent>
              </Card>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
