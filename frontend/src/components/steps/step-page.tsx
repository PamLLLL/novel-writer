"use client";

import { useState, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { Loader2, Sparkles, Save, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { useSSE } from "@/hooks/use-sse";

const STEPS = [
  { key: "settings", label: "基础设定" },
  { key: "characters", label: "人物设定" },
  { key: "worldview", label: "世界观" },
  { key: "outline", label: "故事大纲" },
  { key: "volumes", label: "分卷规划" },
  { key: "chapters", label: "章节大纲" },
  { key: "write", label: "正文写作" },
  { key: "quality", label: "质量检查" },
];

interface StepPageProps {
  title: string;
  description: string;
  generateUrl: string;
  children: React.ReactNode;
  onSave: () => Promise<void>;
  onGenerated: (result: Record<string, unknown>) => void;
  hasData: boolean;
  stepKey?: string;
}

export function StepPage({
  title,
  description,
  generateUrl,
  children,
  onSave,
  onGenerated,
  hasData,
  stepKey,
}: StepPageProps) {
  const router = useRouter();
  const params = useParams();
  const projectId = params.id as string;

  const [direction, setDirection] = useState("");
  const [saving, setSaving] = useState(false);
  const [navigating, setNavigating] = useState<"prev" | "next" | null>(null);
  const [streamText, setStreamText] = useState("");
  const [progress, setProgress] = useState("");
  const { start, stop, isStreaming } = useSSE();
  const streamRef = useRef("");

  const currentIndex = stepKey ? STEPS.findIndex((s) => s.key === stepKey) : -1;
  const prevStep = currentIndex > 0 ? STEPS[currentIndex - 1] : null;
  const nextStep = currentIndex >= 0 && currentIndex < STEPS.length - 1 ? STEPS[currentIndex + 1] : null;

  const handleGenerate = () => {
    setStreamText("");
    streamRef.current = "";
    setProgress("");
    start(generateUrl, { user_direction: direction }, {
      onContent: (text) => {
        streamRef.current += text;
        setStreamText(streamRef.current);
      },
      onProgress: (msg) => setProgress(msg),
      onDone: (result) => {
        setProgress("");
        onGenerated(result);
        toast.success("生成完成，原始输出保留在下方供参考");
      },
      onError: (msg) => {
        toast.error("生成失败", { description: msg });
        setProgress("");
      },
    });
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave();
      toast.success("保存成功");
    } catch (e) {
      toast.error("保存失败", { description: String(e) });
    } finally {
      setSaving(false);
    }
  };

  const navigateTo = async (step: typeof STEPS[number], dir: "prev" | "next") => {
    setNavigating(dir);
    try {
      await onSave();
      router.push(`/project/${projectId}/${step.key}`);
    } catch (e) {
      toast.error("保存失败，无法跳转", { description: String(e) });
      setNavigating(null);
    }
  };

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex items-start justify-between mb-6">
        <div>
          <h2 className="text-xl font-bold tracking-tight">{title}</h2>
          <p className="text-sm text-muted-foreground mt-1">{description}</p>
        </div>
        <div className="flex gap-2 shrink-0">
          {isStreaming ? (
            <Button variant="destructive" size="sm" onClick={stop}>
              停止生成
            </Button>
          ) : (
            <Button size="sm" onClick={handleGenerate}>
              <Sparkles className="h-3.5 w-3.5 mr-1.5" />
              {hasData ? "重新生成" : "AI 生成"}
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={handleSave} disabled={saving}>
            {saving ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <Save className="h-3.5 w-3.5 mr-1.5" />}
            保存
          </Button>
        </div>
      </div>

      <div className="mb-4">
        <Textarea
          placeholder="给 AI 提供创作方向（可选，如：主角性格要更内向、加入一条感情副线...）"
          value={direction}
          onChange={(e) => setDirection(e.target.value)}
          rows={2}
          className="text-sm"
        />
      </div>

      {(isStreaming || streamText) && (
        <div className="mb-6 rounded-lg border border-border bg-muted/30 p-4">
          {progress && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-3">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              {progress}
            </div>
          )}
          {!isStreaming && streamText && (
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-muted-foreground">AI 原始输出（供参考）</span>
              <Button variant="ghost" size="sm" className="h-6 text-xs" onClick={() => setStreamText("")}>
                收起
              </Button>
            </div>
          )}
          <pre className="text-sm whitespace-pre-wrap max-h-96 overflow-auto font-mono">
            {streamText || "等待响应..."}
          </pre>
        </div>
      )}

      <div className="space-y-6">{children}</div>

      {(prevStep || nextStep) && (
        <div className="flex items-center justify-between mt-8 pt-6 border-t border-border">
          {prevStep ? (
            <Button
              variant="ghost"
              onClick={() => navigateTo(prevStep, "prev")}
              disabled={!!navigating || isStreaming}
            >
              {navigating === "prev" ? (
                <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
              ) : (
                <ChevronLeft className="h-4 w-4 mr-1.5" />
              )}
              {prevStep.label}
            </Button>
          ) : (
            <div />
          )}
          {nextStep && (
            <Button
              onClick={() => navigateTo(nextStep, "next")}
              disabled={!!navigating || isStreaming}
            >
              {navigating === "next" ? (
                <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
              ) : null}
              {nextStep.label}
              {navigating !== "next" && <ChevronRight className="h-4 w-4 ml-1.5" />}
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
