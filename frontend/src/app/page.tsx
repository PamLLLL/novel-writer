"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, BookOpen, Trash2, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { api } from "@/lib/api-client";
import type { ProjectSummary, ProjectCreate } from "@/lib/types";
import { GENRES, WORD_COUNT_OPTIONS, PLATFORMS } from "@/lib/types";
import { cn } from "@/lib/utils";

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("zh-CN", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatWordCount(count: number) {
  if (count >= 10000) return `${(count / 10000).toFixed(1)}万字`;
  return `${count}字`;
}

export default function HomePage() {
  const router = useRouter();
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<ProjectSummary | null>(null);
  const [creating, setCreating] = useState(false);

  const [form, setForm] = useState<ProjectCreate>({
    name: "",
    genre: "",
    concept: "",
    target_words: 100000,
    target_platform: "通用/不限",
  });

  const loadProjects = async () => {
    try {
      const data = await api.projects.list();
      setProjects(data);
    } catch (e) {
      toast.error("加载项目失败", { description: String(e) });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProjects();
  }, []);

  const handleCreate = async () => {
    if (!form.name.trim()) {
      toast.error("请输入小说名称");
      return;
    }
    setCreating(true);
    try {
      await api.projects.create(form);
      toast.success("创建成功");
      setCreateOpen(false);
      setForm({ name: "", genre: "", concept: "", target_words: 100000, target_platform: "general" });
      loadProjects();
    } catch (e) {
      toast.error("创建失败", { description: String(e) });
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await api.projects.delete(deleteTarget.id);
      toast.success("已删除");
      setDeleteTarget(null);
      loadProjects();
    } catch (e) {
      toast.error("删除失败", { description: String(e) });
    }
  };

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">我的项目</h1>
          <p className="text-muted-foreground mt-1">管理你的小说创作项目</p>
        </div>
        <Button onClick={() => setCreateOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          新建项目
        </Button>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3].map((i) => (
            <Card key={i}>
              <CardHeader>
                <Skeleton className="h-5 w-3/4" />
                <Skeleton className="h-4 w-1/4 mt-2" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-12 w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : projects.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <div className="rounded-full bg-muted p-6 mb-6">
            <BookOpen className="h-12 w-12 text-muted-foreground" />
          </div>
          <h2 className="text-xl font-semibold mb-2">还没有任何项目</h2>
          <p className="text-muted-foreground mb-6 max-w-sm">
            创建你的第一个小说项目，开始 AI 辅助创作之旅
          </p>
          <Button onClick={() => setCreateOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            创建第一个项目
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {projects.map((project) => (
            <Card
              key={project.id}
              className="group cursor-pointer transition-all hover:shadow-md hover:-translate-y-0.5"
              onClick={() => router.push(`/project/${project.id}`)}
            >
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <h3 className="font-semibold text-lg leading-tight line-clamp-1">
                    {project.name}
                  </h3>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                    onClick={(e) => {
                      e.stopPropagation();
                      setDeleteTarget(project);
                    }}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
                {project.genre && (
                  <Badge variant="secondary" className="w-fit mt-1">
                    {project.genre}
                  </Badge>
                )}
              </CardHeader>
              <CardContent className="pb-3">
                {project.concept && (
                  <p className="text-sm text-muted-foreground line-clamp-2">
                    {project.concept}
                  </p>
                )}
                <div className="mt-3">
                  <div className="flex justify-between text-xs text-muted-foreground mb-1">
                    <span>{formatWordCount(project.total_word_count)}</span>
                    <span>目标 {formatWordCount(project.target_words)}</span>
                  </div>
                  <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full bg-primary/60 rounded-full transition-all"
                      style={{
                        width: `${Math.min(100, (project.total_word_count / project.target_words) * 100)}%`,
                      }}
                    />
                  </div>
                </div>
              </CardContent>
              <CardFooter className="pt-0 text-xs text-muted-foreground">
                <Clock className="h-3 w-3 mr-1" />
                {formatDate(project.updated_at)}
                {project.chapter_count > 0 && (
                  <span className="ml-auto">{project.chapter_count} 章</span>
                )}
              </CardFooter>
            </Card>
          ))}
        </div>
      )}

      {/* Create Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>新建小说项目</DialogTitle>
            <DialogDescription>填写基本信息，开始你的创作</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name">小说名称 *</Label>
              <Input
                id="name"
                placeholder="给你的小说起个名字"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>小说类型</Label>
              <Select value={form.genre || ""} onValueChange={(v) => setForm({ ...form, genre: v || "" })}>
                <SelectTrigger>
                  <SelectValue placeholder="选择类型" />
                </SelectTrigger>
                <SelectContent>
                  {GENRES.map((g) => (
                    <SelectItem key={g} value={g}>
                      {g}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="concept">核心创意</Label>
              <Textarea
                id="concept"
                placeholder="一句话描述你想写什么故事（如：一个外卖小哥意外获得读心术）"
                value={form.concept}
                onChange={(e) => setForm({ ...form, concept: e.target.value })}
                rows={3}
              />
            </div>
            <div className="space-y-2">
              <Label>目标字数</Label>
              <div className="flex gap-2 flex-wrap">
                {WORD_COUNT_OPTIONS.map((o) => (
                  <button
                    key={o.value}
                    type="button"
                    className={cn(
                      "px-3 py-1.5 rounded-md text-xs border transition-colors",
                      form.target_words === o.value
                        ? "bg-primary text-primary-foreground border-primary"
                        : "bg-background border-border hover:bg-accent"
                    )}
                    onClick={() => setForm({ ...form, target_words: o.value })}
                  >
                    {o.label}
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-2 mt-2">
                <Input
                  type="number"
                  min={1000}
                  placeholder="自定义字数"
                  value={form.target_words || ""}
                  onChange={(e) => setForm({ ...form, target_words: Number(e.target.value) || 0 })}
                  className="w-40"
                />
                <span className="text-sm text-muted-foreground">字</span>
              </div>
            </div>
            <div className="space-y-2">
              <Label>目标平台</Label>
              <Select
                value={form.target_platform || ""}
                onValueChange={(v) => setForm({ ...form, target_platform: v || "" })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="选择平台" />
                </SelectTrigger>
                <SelectContent>
                  {PLATFORMS.map((p) => (
                    <SelectItem key={p} value={p}>
                      {p}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>
              取消
            </Button>
            <Button onClick={handleCreate} disabled={creating}>
              {creating ? "创建中..." : "创建项目"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <Dialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>确认删除</DialogTitle>
            <DialogDescription>
              确定要删除「{deleteTarget?.name}」吗？此操作不可恢复，所有章节和设定数据将被永久删除。
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>
              取消
            </Button>
            <Button variant="destructive" onClick={handleDelete}>
              确认删除
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
