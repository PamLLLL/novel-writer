"use client";

import { useState, useRef, useEffect } from "react";
import { StepNav } from "@/components/steps/step-nav";
import { useParams } from "next/navigation";
import {
  Sparkles,
  Loader2,
  ShieldCheck,
  AlertTriangle,
  Info,
  XCircle,
  CheckCircle2,
  Wrench,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { api } from "@/lib/api-client";
import { useSSE } from "@/hooks/use-sse";
import { toast } from "sonner";

interface QualityIssue {
  severity: "error" | "warning" | "info";
  category: string;
  chapter_title: string;
  location: string;
  description: string;
  suggestion: string;
  original_text: string;
}

interface QualityResult {
  overall_score: number;
  issues: QualityIssue[];
  strengths: string[];
  summary: string;
}

interface ChapterInfo {
  id: string;
  title: string;
}

export default function QualityPage() {
  const { id: projectId } = useParams<{ id: string }>();

  const [result, setResult] = useState<QualityResult | null>(null);
  const [chapters, setChapters] = useState<ChapterInfo[]>([]);
  const [streamText, setStreamText] = useState("");
  const [progress, setProgress] = useState("");
  const [fixingIndex, setFixingIndex] = useState<number | null>(null);
  const [fixedIndices, setFixedIndices] = useState<Set<number>>(new Set());
  const streamRef = useRef("");
  const { start, stop, isStreaming } = useSSE();

  useEffect(() => {
    api.steps.getChapters(projectId).then((data) => {
      setChapters((data as unknown as ChapterInfo[]).map(c => ({ id: c.id, title: c.title })));
    }).catch(() => {});
  }, [projectId]);

  const findChapterId = (chapterTitle: string): string | null => {
    if (!chapterTitle) return null;
    const exact = chapters.find(c => c.title === chapterTitle);
    if (exact) return exact.id;
    const partial = chapters.find(c =>
      c.title.includes(chapterTitle) || chapterTitle.includes(c.title)
    );
    return partial?.id || null;
  };

  const handleCheck = () => {
    setStreamText("");
    streamRef.current = "";
    setProgress("");
    setResult(null);
    setFixedIndices(new Set());
    start(api.steps.generateUrl(projectId, "quality-check"), {}, {
      onContent: (text) => { streamRef.current += text; setStreamText(streamRef.current); },
      onProgress: (msg) => setProgress(msg),
      onDone: (data) => {
        setStreamText("");
        setProgress("");
        const issues = ((data.issues as Record<string, unknown>[]) ?? []).map(i => ({
          severity: (i.severity as string) || "info",
          category: (i.category as string) || "",
          chapter_title: (i.chapter_title as string) || "",
          location: (i.location as string) || "",
          description: (i.description as string) || "",
          suggestion: (i.suggestion as string) || "",
          original_text: (i.original_text as string) || "",
        })) as QualityIssue[];
        setResult({
          overall_score: (data.overall_score as number) ?? 0,
          issues,
          strengths: (data.strengths as string[]) ?? [],
          summary: (data.summary as string) ?? "",
        });
        toast.success("检查完成");
      },
      onError: (msg) => { toast.error("检查失败", { description: msg }); setProgress(""); },
    });
  };

  const handleApplyFix = (issue: QualityIssue, index: number) => {
    const chapterId = findChapterId(issue.chapter_title);
    if (!chapterId) {
      toast.error("无法匹配章节", { description: `找不到「${issue.chapter_title}」对应的章节` });
      return;
    }
    setFixingIndex(index);
    setStreamText("");
    streamRef.current = "";

    const url = `${process.env.NEXT_PUBLIC_API_BASE || "http://localhost:8000/api"}/steps/${projectId}/generate/apply-fix`;
    start(url, {
      chapter_id: chapterId,
      issue_description: issue.description,
      suggestion: issue.suggestion,
      original_text: issue.original_text,
    }, {
      onContent: (text) => { streamRef.current += text; setStreamText(streamRef.current); },
      onProgress: (msg) => setProgress(msg),
      onDone: () => {
        setStreamText("");
        setProgress("");
        setFixingIndex(null);
        setFixedIndices(prev => new Set(prev).add(index));
        toast.success(`「${issue.chapter_title}」已修改`);
      },
      onError: (msg) => {
        setFixingIndex(null);
        setStreamText("");
        toast.error("修改失败", { description: msg });
      },
    });
  };

  const severityIcon = (severity: string) => {
    switch (severity) {
      case "error": return <XCircle className="h-4 w-4 text-red-500" />;
      case "warning": return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
      default: return <Info className="h-4 w-4 text-blue-500" />;
    }
  };

  const severityBadge = (severity: string) => {
    switch (severity) {
      case "error": return <Badge variant="destructive">错误</Badge>;
      case "warning": return <Badge className="bg-yellow-500/10 text-yellow-600 dark:text-yellow-400">警告</Badge>;
      default: return <Badge className="bg-blue-500/10 text-blue-600 dark:text-blue-400">建议</Badge>;
    }
  };

  const scoreColor = (score: number) => {
    if (score >= 80) return "text-green-600 dark:text-green-400";
    if (score >= 60) return "text-yellow-600 dark:text-yellow-400";
    return "text-red-600 dark:text-red-400";
  };

  const groupIssues = (issues: QualityIssue[]) => {
    const groups: Record<string, QualityIssue[]> = {};
    for (const s of ["error", "warning", "info"]) {
      const filtered = issues.filter(i => i.severity === s);
      if (filtered.length > 0) groups[s] = filtered;
    }
    return groups;
  };

  const groupLabel = (s: string) => s === "error" ? "错误" : s === "warning" ? "警告" : "建议";

  const getGlobalIndex = (severity: string, localIndex: number): number => {
    if (!result) return -1;
    let count = 0;
    for (const issue of result.issues) {
      if (issue.severity === severity) {
        if (count === localIndex) return result.issues.indexOf(issue);
        count++;
      }
    }
    return -1;
  };

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex items-start justify-between mb-6">
        <div>
          <h2 className="text-xl font-bold tracking-tight">质量检查</h2>
          <p className="text-sm text-muted-foreground mt-1">AI 全面审查小说内容，发现问题可一键应用修改建议</p>
        </div>
        <div className="shrink-0">
          {isStreaming && fixingIndex === null ? (
            <Button variant="destructive" size="sm" onClick={stop}>停止检查</Button>
          ) : (
            <Button size="sm" onClick={handleCheck} disabled={isStreaming}>
              <ShieldCheck className="h-3.5 w-3.5 mr-1.5" />
              {result ? "重新检查" : "开始检查"}
            </Button>
          )}
        </div>
      </div>

      {isStreaming && (
        <div className="mb-6 rounded-lg border border-border bg-muted/30 p-4">
          {progress && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-3">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              {progress}
            </div>
          )}
          <pre className="text-sm whitespace-pre-wrap max-h-96 overflow-auto font-mono">
            {streamText || "正在分析..."}
          </pre>
        </div>
      )}

      {!result && !isStreaming && (
        <Card>
          <CardContent>
            <div className="text-center py-12 text-muted-foreground">
              <ShieldCheck className="h-12 w-12 mx-auto mb-3 opacity-30" />
              <p className="text-sm mb-1">点击「开始检查」运行 AI 质量审查</p>
              <p className="text-xs">检查内容包括：情节逻辑、人设一致性、文风统一、节奏把控等</p>
            </div>
          </CardContent>
        </Card>
      )}

      {result && !isStreaming && (
        <div className="space-y-6">
          <Card>
            <CardContent>
              <div className="flex items-center gap-6">
                <div className="text-center">
                  <div className={`text-4xl font-bold ${scoreColor(result.overall_score)}`}>{result.overall_score}</div>
                  <div className="text-xs text-muted-foreground mt-1">综合评分</div>
                </div>
                <Separator orientation="vertical" className="h-16" />
                <div className="flex-1">
                  <p className="text-sm leading-relaxed">{result.summary}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {result.strengths.length > 0 && (
            <Card>
              <CardHeader><CardTitle className="flex items-center gap-2 text-base"><CheckCircle2 className="h-4 w-4 text-green-500" />亮点</CardTitle></CardHeader>
              <CardContent>
                <ul className="space-y-2">
                  {result.strengths.map((s, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm">
                      <span className="text-green-500 mt-0.5 shrink-0">+</span>
                      <span>{s}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}

          {result.issues.length > 0 && Object.entries(groupIssues(result.issues)).map(([severity, issues]) => (
            <div key={severity}>
              <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                {severityIcon(severity)}
                {groupLabel(severity)}
                <Badge variant="secondary" className="text-[10px]">{issues.length}</Badge>
              </h3>
              <div className="space-y-3">
                {issues.map((issue, localIdx) => {
                  const globalIdx = getGlobalIndex(severity, localIdx);
                  const isFixed = fixedIndices.has(globalIdx);
                  const isFixing = fixingIndex === globalIdx;
                  const chapterId = findChapterId(issue.chapter_title);

                  return (
                    <Card key={localIdx} className={isFixed ? "opacity-60" : ""}>
                      <CardContent>
                        <div className="space-y-2">
                          <div className="flex items-center gap-2 flex-wrap">
                            {severityBadge(issue.severity)}
                            <Badge variant="outline">{issue.category}</Badge>
                            {issue.chapter_title && (
                              <span className="text-xs text-muted-foreground">{issue.chapter_title}</span>
                            )}
                            {issue.location && issue.location !== issue.chapter_title && (
                              <span className="text-xs text-muted-foreground">{issue.location}</span>
                            )}
                            {isFixed && <Badge className="bg-green-500/10 text-green-600">已修复</Badge>}
                          </div>
                          <p className="text-sm">{issue.description}</p>
                          {issue.original_text && (
                            <div className="text-sm bg-red-500/5 border border-red-500/10 rounded-md px-3 py-2 italic">
                              &ldquo;{issue.original_text}&rdquo;
                            </div>
                          )}
                          {issue.suggestion && (
                            <div className="text-sm text-muted-foreground bg-muted/50 rounded-md px-3 py-2">
                              <span className="font-medium">建议：</span>{issue.suggestion}
                            </div>
                          )}
                          {issue.suggestion && chapterId && !isFixed && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleApplyFix(issue, globalIdx)}
                              disabled={isStreaming}
                              className="mt-1"
                            >
                              {isFixing ? (
                                <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                              ) : (
                                <Wrench className="h-3.5 w-3.5 mr-1.5" />
                              )}
                              应用修改建议
                            </Button>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </div>
          ))}

          {result.issues.length === 0 && (
            <Card>
              <CardContent>
                <div className="text-center py-6 text-muted-foreground">
                  <CheckCircle2 className="h-8 w-8 mx-auto mb-2 text-green-500" />
                  <p className="text-sm">未发现问题，内容质量良好！</p>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      <StepNav stepKey="quality" disabled={isStreaming} />
    </div>
  );
}
