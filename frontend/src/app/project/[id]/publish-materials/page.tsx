"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Loader2, Sparkles, Save, X, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { api } from "@/lib/api-client";
import { useSSE } from "@/hooks/use-sse";

interface TitleSuggestion {
  title: string;
  rationale: string;
}

interface Protagonists {
  male_lead: { name: string; persona_tag: string };
  female_lead: { name: string; persona_tag: string };
  versus_line: string;
}

interface HookLine {
  line: string;
  usage: string;
}

interface PublishMaterials {
  title_suggestions: TitleSuggestion[];
  protagonists: Protagonists;
  tags: string[];
  hook_lines: HookLine[];
  synopsis_short: string;
  synopsis_medium: string;
  synopsis_long: string;
}

const emptyMaterials: PublishMaterials = {
  title_suggestions: [],
  protagonists: {
    male_lead: { name: "", persona_tag: "" },
    female_lead: { name: "", persona_tag: "" },
    versus_line: "",
  },
  tags: [],
  hook_lines: [],
  synopsis_short: "",
  synopsis_medium: "",
  synopsis_long: "",
};

export default function PublishMaterialsPage() {
  const { id: projectId } = useParams<{ id: string }>();
  const [data, setData] = useState<PublishMaterials>(emptyMaterials);
  const [direction, setDirection] = useState("");
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [streamText, setStreamText] = useState("");
  const [newTag, setNewTag] = useState("");
  const { start, stop, isStreaming } = useSSE();

  useEffect(() => {
    api.publish.getMaterials(projectId).then((res) => {
      if (res && Object.keys(res).length > 0) {
        setData({
          ...emptyMaterials,
          ...(res as Partial<PublishMaterials>),
        });
      }
    }).catch(() => {}).finally(() => setLoading(false));
  }, [projectId]);

  const handleGenerate = () => {
    setStreamText("");
    start(api.publish.generateUrl(projectId), { user_direction: direction }, {
      onContent: (text) => setStreamText((prev) => prev + text),
      onDone: (result) => {
        setStreamText("");
        if (result && Object.keys(result).length > 0) {
          setData({ ...emptyMaterials, ...(result as Partial<PublishMaterials>) });
        }
        toast.success("发布素材生成完成");
      },
      onError: (msg) => toast.error("生成失败", { description: msg }),
    });
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await api.publish.saveMaterials(projectId, data as unknown as Record<string, unknown>);
      toast.success("保存成功");
    } catch (e) {
      toast.error("保存失败", { description: String(e) });
    } finally {
      setSaving(false);
    }
  };

  const removeTag = (idx: number) => {
    setData((prev) => ({ ...prev, tags: prev.tags.filter((_, i) => i !== idx) }));
  };

  const addTag = () => {
    const tag = newTag.trim();
    if (tag && !data.tags.includes(tag)) {
      setData((prev) => ({ ...prev, tags: [...prev.tags, tag] }));
      setNewTag("");
    }
  };

  const synopsisTab = useState<"short" | "medium" | "long">("medium");
  const [activeTab, setActiveTab] = synopsisTab;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex items-start justify-between mb-6">
        <div>
          <h2 className="text-xl font-bold tracking-tight">发布素材</h2>
          <p className="text-sm text-muted-foreground mt-1">生成书名、标签、金句、简介等上架所需素材</p>
        </div>
        <div className="flex gap-2 shrink-0">
          {isStreaming ? (
            <Button variant="destructive" size="sm" onClick={stop}>停止生成</Button>
          ) : (
            <Button size="sm" onClick={handleGenerate}>
              <Sparkles className="h-3.5 w-3.5 mr-1.5" />
              {data.title_suggestions.length > 0 ? "重新生成" : "AI 生成"}
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
          placeholder="给 AI 提供方向（可选，如：书名要短、标签侧重甜宠...）"
          value={direction}
          onChange={(e) => setDirection(e.target.value)}
          rows={2}
          className="text-sm"
        />
      </div>

      {isStreaming && (
        <div className="mb-6 rounded-lg border border-border bg-muted/30 p-4">
          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-3">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            正在生成发布素材...
          </div>
          <pre className="text-sm whitespace-pre-wrap max-h-96 overflow-auto font-mono">
            {streamText || "等待响应..."}
          </pre>
        </div>
      )}

      <div className="space-y-6">
        {/* Title Suggestions */}
        <Card>
          <CardHeader><CardTitle>书名建议</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {data.title_suggestions.length === 0 ? (
              <p className="text-sm text-muted-foreground">点击「AI 生成」获取书名建议</p>
            ) : (
              data.title_suggestions.map((t, i) => (
                <div key={i} className="flex items-start gap-3 p-3 rounded-lg border border-border">
                  <Input
                    className="font-semibold text-base flex-1"
                    value={t.title}
                    onChange={(e) => {
                      const updated = [...data.title_suggestions];
                      updated[i] = { ...updated[i], title: e.target.value };
                      setData((prev) => ({ ...prev, title_suggestions: updated }));
                    }}
                  />
                  <p className="text-xs text-muted-foreground mt-2 flex-1">{t.rationale}</p>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        {/* Protagonists */}
        <Card>
          <CardHeader><CardTitle>主角信息</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>男主名字</Label>
                <Input
                  value={data.protagonists.male_lead.name}
                  onChange={(e) => setData((prev) => ({
                    ...prev,
                    protagonists: { ...prev.protagonists, male_lead: { ...prev.protagonists.male_lead, name: e.target.value } },
                  }))}
                  placeholder="男主角名字"
                />
                <Label>人设标签</Label>
                <Input
                  value={data.protagonists.male_lead.persona_tag}
                  onChange={(e) => setData((prev) => ({
                    ...prev,
                    protagonists: { ...prev.protagonists, male_lead: { ...prev.protagonists.male_lead, persona_tag: e.target.value } },
                  }))}
                  placeholder="如：冷面战神、腹黑总裁"
                />
              </div>
              <div className="space-y-2">
                <Label>女主名字</Label>
                <Input
                  value={data.protagonists.female_lead.name}
                  onChange={(e) => setData((prev) => ({
                    ...prev,
                    protagonists: { ...prev.protagonists, female_lead: { ...prev.protagonists.female_lead, name: e.target.value } },
                  }))}
                  placeholder="女主角名字"
                />
                <Label>人设标签</Label>
                <Input
                  value={data.protagonists.female_lead.persona_tag}
                  onChange={(e) => setData((prev) => ({
                    ...prev,
                    protagonists: { ...prev.protagonists, female_lead: { ...prev.protagonists.female_lead, persona_tag: e.target.value } },
                  }))}
                  placeholder="如：清冷小白花、元气少女"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>一句话人设对比</Label>
              <Input
                value={data.protagonists.versus_line}
                onChange={(e) => setData((prev) => ({
                  ...prev,
                  protagonists: { ...prev.protagonists, versus_line: e.target.value },
                }))}
                placeholder="如：清冷小白花vs霸道男总裁"
                className="font-medium"
              />
            </div>
          </CardContent>
        </Card>

        {/* Tags */}
        <Card>
          <CardHeader><CardTitle>作品标签</CardTitle></CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2 mb-3">
              {data.tags.map((tag, i) => (
                <Badge key={i} variant="secondary" className="gap-1 pr-1">
                  {tag}
                  <button onClick={() => removeTag(i)} className="ml-1 hover:text-destructive">
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              ))}
              {data.tags.length === 0 && (
                <p className="text-sm text-muted-foreground">点击「AI 生成」获取标签</p>
              )}
            </div>
            <div className="flex gap-2">
              <Input
                placeholder="添加标签..."
                value={newTag}
                onChange={(e) => setNewTag(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addTag())}
                className="flex-1"
              />
              <Button variant="outline" size="sm" onClick={addTag} disabled={!newTag.trim()}>
                <Plus className="h-3.5 w-3.5" />
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Hook Lines */}
        <Card>
          <CardHeader><CardTitle>金句 / Hook</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {data.hook_lines.length === 0 ? (
              <p className="text-sm text-muted-foreground">点击「AI 生成」获取金句</p>
            ) : (
              data.hook_lines.map((h, i) => (
                <div key={i} className="space-y-1">
                  <Input
                    value={h.line}
                    onChange={(e) => {
                      const updated = [...data.hook_lines];
                      updated[i] = { ...updated[i], line: e.target.value };
                      setData((prev) => ({ ...prev, hook_lines: updated }));
                    }}
                    className="font-medium"
                  />
                  <p className="text-xs text-muted-foreground pl-1">{h.usage}</p>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        {/* Synopsis */}
        <Card>
          <CardHeader><CardTitle>作品简介</CardTitle></CardHeader>
          <CardContent>
            <div className="flex gap-1 mb-3">
              {(["short", "medium", "long"] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`px-3 py-1.5 rounded-md text-xs transition-colors ${
                    activeTab === tab
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {{ short: "50字", medium: "100字", long: "300字" }[tab]}
                </button>
              ))}
            </div>
            <Textarea
              value={
                activeTab === "short"
                  ? data.synopsis_short
                  : activeTab === "medium"
                  ? data.synopsis_medium
                  : data.synopsis_long
              }
              onChange={(e) => {
                const key = `synopsis_${activeTab}` as keyof PublishMaterials;
                setData((prev) => ({ ...prev, [key]: e.target.value }));
              }}
              rows={activeTab === "long" ? 8 : activeTab === "medium" ? 4 : 2}
              placeholder={`${activeTab === "short" ? "50" : activeTab === "medium" ? "100" : "300"}字左右的作品简介`}
            />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
