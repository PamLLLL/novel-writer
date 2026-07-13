"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import {
  Download,
  FileText,
  FileType,
  BookOpen,
  Loader2,
  Hash,
  LetterText,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { api } from "@/lib/api-client";
import { toast } from "sonner";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:8000/api";

interface Chapter {
  id: string;
  title: string;
  content: string;
  status: string;
  word_count: number;
  sort_order: number;
  volume_id?: string;
  volume_title?: string;
}

interface ExportFormat {
  key: string;
  label: string;
  description: string;
  icon: React.ReactNode;
  extension: string;
  available: boolean;
}

function buildTxtContent(chapters: Chapter[], projectName: string): string {
  const lines: string[] = [];
  lines.push(projectName);
  lines.push("=".repeat(40));
  lines.push("");

  for (const ch of chapters) {
    lines.push(ch.title);
    lines.push("-".repeat(30));
    lines.push("");
    lines.push(ch.content || "（暂无内容）");
    lines.push("");
    lines.push("");
  }

  return lines.join("\n");
}

function buildMarkdownContent(chapters: Chapter[], projectName: string): string {
  const lines: string[] = [];
  lines.push(`# ${projectName}`);
  lines.push("");

  let currentVolume = "";

  for (const ch of chapters) {
    if (ch.volume_title && ch.volume_title !== currentVolume) {
      currentVolume = ch.volume_title;
      lines.push(`## ${currentVolume}`);
      lines.push("");
    }

    lines.push(`### ${ch.title}`);
    lines.push("");
    lines.push(ch.content || "*暂无内容*");
    lines.push("");
    lines.push("---");
    lines.push("");
  }

  return lines.join("\n");
}

function triggerDownload(content: string, filename: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export default function ExportPage() {
  const { id: projectId } = useParams<{ id: string }>();

  const [loading, setLoading] = useState(true);
  const [projectName, setProjectName] = useState("");
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [downloading, setDownloading] = useState<string | null>(null);

  useEffect(() => {
    const loadData = async () => {
      try {
        const [project, chaptersData] = await Promise.all([
          api.projects.get(projectId),
          api.steps.getChapters(projectId),
        ]);
        setProjectName(project.name || "未命名项目");
        setChapters(chaptersData as unknown as Chapter[]);
      } catch (e) {
        toast.error("加载数据失败", { description: String(e) });
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, [projectId]);

  const totalChapters = chapters.length;
  const completedChapters = chapters.filter((ch) => ch.status === "completed").length;
  const totalWords = chapters.reduce((sum, ch) => sum + (ch.word_count || 0), 0);

  const formats: ExportFormat[] = [
    {
      key: "txt",
      label: "纯文本 TXT",
      description: "简单的纯文本格式，兼容所有阅读设备",
      icon: <FileText className="h-6 w-6" />,
      extension: ".txt",
      available: true,
    },
    {
      key: "markdown",
      label: "Markdown",
      description: "带格式标记的文本，适合二次编辑和发布",
      icon: <Hash className="h-6 w-6" />,
      extension: ".md",
      available: true,
    },
    {
      key: "docx",
      label: "Word 文档",
      description: "Microsoft Word 格式，适合排版和打印",
      icon: <FileType className="h-6 w-6" />,
      extension: ".docx",
      available: true,
    },
    {
      key: "epub",
      label: "电子书 EPUB",
      description: "电子书格式，适合移动设备阅读",
      icon: <BookOpen className="h-6 w-6" />,
      extension: ".epub",
      available: true,
    },
  ];

  const handleExport = async (format: ExportFormat) => {
    if (!format.available) {
      toast("导出功能开发中", {
        description: `${format.label} 格式导出即将上线，敬请期待`,
      });
      return;
    }

    if (chapters.length === 0) {
      toast.error("暂无可导出的内容", { description: "请先生成章节内容" });
      return;
    }

    setDownloading(format.key);

    try {
      const filename = `${projectName}${format.extension}`;

      const res = await fetch(API_BASE + "/export/" + format.key, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ project_id: projectId }),
        });

        if (!res.ok) {
          const err = await res.json().catch(() => ({ detail: res.statusText }));
          throw new Error(err.detail || `导出失败: ${res.status}`);
        }

        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        toast.success("导出成功", { description: `已下载 ${filename}` });
    } catch (e) {
      toast.error("导出失败", { description: String(e) });
    } finally {
      setDownloading(null);
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
      <div className="mb-6">
        <h2 className="text-xl font-bold tracking-tight">导出</h2>
        <p className="text-sm text-muted-foreground mt-1">
          将你的小说导出为不同格式的文件
        </p>
      </div>

      {/* Project stats */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <LetterText className="h-4 w-4" />
            作品概览
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-6">
            <div className="text-center">
              <div className="text-2xl font-bold">{totalChapters}</div>
              <div className="text-sm text-muted-foreground">总章节数</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold">
                {completedChapters}
                <span className="text-sm font-normal text-muted-foreground">
                  {" "}
                  / {totalChapters}
                </span>
              </div>
              <div className="text-sm text-muted-foreground">已完成章节</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold">
                {totalWords.toLocaleString()}
              </div>
              <div className="text-sm text-muted-foreground">总字数</div>
            </div>
          </div>

          {completedChapters < totalChapters && totalChapters > 0 && (
            <div className="mt-4 pt-4 border-t border-border">
              <div className="flex items-center gap-2 text-sm text-amber-600 dark:text-amber-400">
                <Badge variant="outline" className="border-amber-300 text-amber-600 dark:text-amber-400">
                  提示
                </Badge>
                还有 {totalChapters - completedChapters} 个章节未完成，导出内容可能不完整
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Separator className="mb-6" />

      {/* Export format cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {formats.map((format) => {
          const isDownloading = downloading === format.key;
          return (
            <Card
              key={format.key}
              className={`transition-all ${
                format.available
                  ? "hover:shadow-md hover:border-primary/50"
                  : "opacity-60"
              }`}
            >
              <CardContent className="p-5">
                <div className="flex items-start gap-4">
                  <div
                    className={`p-3 rounded-lg ${
                      format.available
                        ? "bg-primary/10 text-primary"
                        : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {format.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-medium text-sm">{format.label}</h3>
                      {!format.available && (
                        <Badge variant="secondary" className="text-[10px]">
                          即将上线
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mb-3">
                      {format.description}
                    </p>
                    <Button
                      size="sm"
                      variant={format.available ? "default" : "outline"}
                      onClick={() => handleExport(format)}
                      disabled={isDownloading}
                      className="w-full"
                    >
                      {isDownloading ? (
                        <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                      ) : (
                        <Download className="h-3.5 w-3.5 mr-1.5" />
                      )}
                      {isDownloading ? "导出中..." : "下载"}
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
