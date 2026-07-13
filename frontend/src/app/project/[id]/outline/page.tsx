"use client";

import { useEffect, useState, useRef } from "react";
import { useParams } from "next/navigation";
import { Plus, Trash2, Sparkles, Loader2, AlertTriangle } from "lucide-react";
import { StepPage } from "@/components/steps/step-page";
import { api } from "@/lib/api-client";
import { useSSE } from "@/hooks/use-sse";
import { Card, CardContent, CardHeader, CardTitle, CardAction } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

interface Act {
  title: string;
  summary: string;
  key_events: string[];
  turning_point: string;
}

interface Subplot {
  name: string;
  description: string;
}

interface Foreshadow {
  setup: string;
  payoff: string;
}

interface OutlineData {
  act_one: Act;
  act_two: Act;
  act_three: Act;
  subplots: Subplot[];
  foreshadowing: Foreshadow[];
}

const emptyAct: Act = { title: "", summary: "", key_events: [], turning_point: "" };

const emptyOutline: OutlineData = {
  act_one: { ...emptyAct },
  act_two: { ...emptyAct },
  act_three: { ...emptyAct },
  subplots: [],
  foreshadowing: [],
};

function stringify(val: unknown): string {
  if (typeof val === "string") return val;
  if (val && typeof val === "object") {
    const obj = val as Record<string, unknown>;
    return Object.values(obj).filter(v => typeof v === "string").join(" — ") || JSON.stringify(val);
  }
  return String(val ?? "");
}

function parseAct(raw: Record<string, unknown> | undefined): Act {
  if (!raw) return { ...emptyAct };
  const keyEvents = Array.isArray(raw.key_events)
    ? raw.key_events.map(stringify)
    : [];
  return {
    title: stringify(raw.title),
    summary: stringify(raw.summary),
    key_events: keyEvents,
    turning_point: stringify(raw.turning_point || raw.midpoint || ""),
  };
}

function parseSubplots(raw: unknown): Subplot[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((item) => {
    if (typeof item === "string") return { name: "", description: item };
    const obj = item as Record<string, unknown>;
    return {
      name: stringify(obj.name || ""),
      description: stringify(obj.description || ""),
    };
  });
}

function parseForeshadowing(raw: unknown): Foreshadow[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((item) => {
    if (typeof item === "string") return { setup: item, payoff: "" };
    const obj = item as Record<string, unknown>;
    return {
      setup: stringify(obj.setup || ""),
      payoff: stringify(obj.payoff || ""),
    };
  });
}

function parseOutline(res: Record<string, unknown>): OutlineData {
  return {
    act_one: parseAct(res.act_one as Record<string, unknown> | undefined),
    act_two: parseAct(res.act_two as Record<string, unknown> | undefined),
    act_three: parseAct(res.act_three as Record<string, unknown> | undefined),
    subplots: parseSubplots(res.subplots),
    foreshadowing: parseForeshadowing(res.foreshadowing),
  };
}

const ACT_META: { key: "act_one" | "act_two" | "act_three"; label: string; desc: string }[] = [
  { key: "act_one", label: "第一幕 — 开端", desc: "引入角色与世界，建立核心冲突" },
  { key: "act_two", label: "第二幕 — 发展", desc: "冲突升级，角色成长与转变" },
  { key: "act_three", label: "第三幕 — 高潮与结局", desc: "矛盾爆发，走向最终结局" },
];

export default function OutlinePage() {
  const { id: projectId } = useParams<{ id: string }>();
  const [data, setData] = useState<OutlineData>(emptyOutline);
  const [generatingAct, setGeneratingAct] = useState<string | null>(null);
  const [generatingItem, setGeneratingItem] = useState<string | null>(null);
  const { start, stop, isStreaming } = useSSE();
  const streamRef = useRef("");

  useEffect(() => {
    api.steps.getOutline(projectId).then((res) => {
      if (res && Object.keys(res).length > 0) setData(parseOutline(res));
    }).catch(() => {});
  }, [projectId]);

  const updateAct = (actKey: "act_one" | "act_two" | "act_three", field: keyof Act, value: string) => {
    setData((prev) => ({ ...prev, [actKey]: { ...prev[actKey], [field]: value } }));
  };

  const updateKeyEvent = (actKey: "act_one" | "act_two" | "act_three", index: number, value: string) => {
    setData((prev) => {
      const events = [...prev[actKey].key_events];
      events[index] = value;
      return { ...prev, [actKey]: { ...prev[actKey], key_events: events } };
    });
  };

  const addKeyEvent = (actKey: "act_one" | "act_two" | "act_three") => {
    setData((prev) => ({
      ...prev,
      [actKey]: { ...prev[actKey], key_events: [...prev[actKey].key_events, ""] },
    }));
  };

  const removeKeyEvent = (actKey: "act_one" | "act_two" | "act_three", index: number) => {
    setData((prev) => ({
      ...prev,
      [actKey]: { ...prev[actKey], key_events: prev[actKey].key_events.filter((_, i) => i !== index) },
    }));
  };

  const generateSingleAct = (actKey: string) => {
    setGeneratingAct(actKey);
    streamRef.current = "";

    const url = `${process.env.NEXT_PUBLIC_API_BASE || "http://localhost:8000/api"}/steps/${projectId}/generate/outline-act`;

    start(url, {
      act: actKey,
      user_direction: "",
      existing_outline: {
        act_one: data.act_one,
        act_two: data.act_two,
        act_three: data.act_three,
      },
    }, {
      onContent: (text) => { streamRef.current += text; },
      onDone: (result) => {
        setData((prev) => ({
          ...prev,
          [actKey]: parseAct(result as Record<string, unknown>),
        }));
        setGeneratingAct(null);
        toast.success("生成完成");
      },
      onError: (msg) => {
        setGeneratingAct(null);
        toast.error("生成失败", { description: msg });
      },
    });
  };

  const generateItem = (itemType: string, act: string = "") => {
    const label = itemType === "key_event" ? "关键事件" : itemType === "subplot" ? "副线" : "伏笔";
    setGeneratingItem(`${itemType}:${act}`);
    streamRef.current = "";

    const url = `${process.env.NEXT_PUBLIC_API_BASE || "http://localhost:8000/api"}/steps/${projectId}/generate/outline-item`;

    start(url, {
      item_type: itemType,
      act,
      existing_outline: data,
    }, {
      onContent: (text) => { streamRef.current += text; },
      onDone: (result) => {
        if (itemType === "key_event" && act) {
          const event = (result as Record<string, unknown>).event as string || streamRef.current.trim();
          setData((prev) => ({
            ...prev,
            [act]: { ...prev[act as keyof OutlineData] as Act, key_events: [...(prev[act as keyof OutlineData] as Act).key_events, event] },
          }));
        } else if (itemType === "subplot") {
          const r = result as Record<string, unknown>;
          setData((prev) => ({
            ...prev,
            subplots: [...prev.subplots, { name: (r.name as string) || "", description: (r.description as string) || "" }],
          }));
        } else if (itemType === "foreshadowing") {
          const r = result as Record<string, unknown>;
          setData((prev) => ({
            ...prev,
            foreshadowing: [...prev.foreshadowing, { setup: (r.setup as string) || "", payoff: (r.payoff as string) || "" }],
          }));
        }
        setGeneratingItem(null);
        toast.success(`${label}已生成`);
      },
      onError: (msg) => {
        setGeneratingItem(null);
        toast.error("生成失败", { description: msg });
      },
    });
  };

  const [cascadeResult, setCascadeResult] = useState<{ affected: { chapter_title: string; impact: string; severity: string; suggestion: string }[]; summary: string } | null>(null);
  const [showCascade, setShowCascade] = useState(false);
  const cascadeSSE = useSSE();

  const saveData = async () => {
    await api.steps.saveOutline(projectId, data as unknown as Record<string, unknown>);
  };

  const handleCascadeCheck = () => {
    setShowCascade(true);
    setCascadeResult(null);
    const url = api.knowledge.upstreamCascadeUrl(projectId);
    cascadeSSE.start(url, { change_type: "大纲", change_summary: "" }, {
      onContent: () => {},
      onDone: (result) => {
        setCascadeResult(result as unknown as typeof cascadeResult);
      },
      onError: (msg) => toast.error("分析失败", { description: msg }),
    });
  };

  const hasData = !!data.act_one.title || !!data.act_one.summary || !!data.act_two.title || !!data.act_three.title;

  return (
    <StepPage
      stepKey="outline"
      title="故事大纲"
      description="规划三幕式故事结构。可以整体生成，也可以对每一幕单独生成"
      generateUrl={api.steps.generateUrl(projectId, "outline")}
      onSave={saveData}
      onGenerated={(result) => setData(parseOutline(result))}
      hasData={hasData}
    >
      {ACT_META.map(({ key, label, desc }) => {
        const isGenerating = generatingAct === key && isStreaming;
        return (
          <Card key={key} className={isGenerating ? "ring-2 ring-primary/30" : ""}>
            <CardHeader>
              <CardTitle>{label}</CardTitle>
              <CardAction>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => generateSingleAct(key)}
                  disabled={isStreaming}
                  title={`单独生成${label}`}
                >
                  {isGenerating ? (
                    <Loader2 className="h-4 w-4 animate-spin text-primary" />
                  ) : (
                    <Sparkles className="h-4 w-4 text-primary" />
                  )}
                </Button>
              </CardAction>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">{desc}</p>

              {isGenerating && (
                <div className="rounded-md bg-muted/50 border border-border p-3">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    正在生成...
                  </div>
                  <pre className="text-xs whitespace-pre-wrap max-h-32 overflow-auto font-mono">
                    {streamRef.current || "等待响应..."}
                  </pre>
                </div>
              )}

              <div className="space-y-2">
                <Label>标题</Label>
                <Input
                  placeholder={`${label}的标题...`}
                  value={data[key].title}
                  onChange={(e) => updateAct(key, "title", e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label>概要</Label>
                <Textarea
                  placeholder={`${label}的剧情概要...`}
                  value={data[key].summary}
                  onChange={(e) => updateAct(key, "summary", e.target.value)}
                  rows={4}
                />
              </div>

              <div className="space-y-2">
                <Label>转折点</Label>
                <Input
                  placeholder="本幕的关键转折..."
                  value={data[key].turning_point}
                  onChange={(e) => updateAct(key, "turning_point", e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label>关键事件</Label>
                {data[key].key_events.map((event, idx) => (
                  <div key={idx} className="flex gap-2">
                    <Input
                      placeholder={`事件 ${idx + 1}...`}
                      value={event}
                      onChange={(e) => updateKeyEvent(key, idx, e.target.value)}
                      className="flex-1"
                    />
                    <Button variant="ghost" size="sm" onClick={() => removeKeyEvent(key, idx)}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                ))}
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => addKeyEvent(key)}>
                    <Plus className="h-4 w-4 mr-1" />
                    手动添加
                  </Button>
                  <Button
                    variant="outline" size="sm"
                    onClick={() => generateItem("key_event", key)}
                    disabled={isStreaming}
                  >
                    {generatingItem === `key_event:${key}` ? (
                      <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                    ) : (
                      <Sparkles className="h-4 w-4 mr-1 text-primary" />
                    )}
                    AI 生成事件
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })}

      {/* 副线剧情 */}
      <Card>
        <CardHeader>
          <CardTitle>副线剧情</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {data.subplots.map((subplot, index) => (
            <div key={index} className="flex gap-2">
              <div className="flex-1 space-y-2">
                <Input
                  placeholder="副线名称"
                  value={subplot.name}
                  onChange={(e) => {
                    const next = [...data.subplots];
                    next[index] = { ...next[index], name: e.target.value };
                    setData((prev) => ({ ...prev, subplots: next }));
                  }}
                />
                <Textarea
                  placeholder="副线描述..."
                  value={subplot.description}
                  onChange={(e) => {
                    const next = [...data.subplots];
                    next[index] = { ...next[index], description: e.target.value };
                    setData((prev) => ({ ...prev, subplots: next }));
                  }}
                  rows={2}
                />
              </div>
              <Button variant="ghost" size="sm" className="shrink-0 self-start mt-1" onClick={() => {
                setData((prev) => ({ ...prev, subplots: prev.subplots.filter((_, i) => i !== index) }));
              }}>
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            </div>
          ))}
          <div className="flex gap-2">
            <Button variant="outline" className="flex-1" onClick={() => {
              setData((prev) => ({ ...prev, subplots: [...prev.subplots, { name: "", description: "" }] }));
            }}>
              <Plus className="h-4 w-4 mr-2" />
              手动添加
            </Button>
            <Button variant="outline" className="flex-1" onClick={() => generateItem("subplot")} disabled={isStreaming}>
              {generatingItem === "subplot:" ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Sparkles className="h-4 w-4 mr-2 text-primary" />
              )}
              AI 生成副线
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* 伏笔设置 */}
      <Card>
        <CardHeader>
          <CardTitle>伏笔设置</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {data.foreshadowing.map((item, index) => (
            <div key={index} className="flex gap-2">
              <div className="flex-1 space-y-2">
                <Input
                  placeholder="伏笔埋设（在哪里埋下什么线索）"
                  value={item.setup}
                  onChange={(e) => {
                    const next = [...data.foreshadowing];
                    next[index] = { ...next[index], setup: e.target.value };
                    setData((prev) => ({ ...prev, foreshadowing: next }));
                  }}
                />
                <Input
                  placeholder="伏笔回收（在哪里揭示）"
                  value={item.payoff}
                  onChange={(e) => {
                    const next = [...data.foreshadowing];
                    next[index] = { ...next[index], payoff: e.target.value };
                    setData((prev) => ({ ...prev, foreshadowing: next }));
                  }}
                />
              </div>
              <Button variant="ghost" size="sm" className="shrink-0 self-start mt-1" onClick={() => {
                setData((prev) => ({ ...prev, foreshadowing: prev.foreshadowing.filter((_, i) => i !== index) }));
              }}>
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            </div>
          ))}
          <div className="flex gap-2">
            <Button variant="outline" className="flex-1" onClick={() => {
              setData((prev) => ({ ...prev, foreshadowing: [...prev.foreshadowing, { setup: "", payoff: "" }] }));
            }}>
              <Plus className="h-4 w-4 mr-2" />
              手动添加
            </Button>
            <Button variant="outline" className="flex-1" onClick={() => generateItem("foreshadowing")} disabled={isStreaming}>
              {generatingItem === "foreshadowing:" ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Sparkles className="h-4 w-4 mr-2 text-primary" />
              )}
              AI 生成伏笔
            </Button>
          </div>
        </CardContent>
      </Card>
      {/* 影响分析 */}
      {hasData && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4" />
              修改影响分析
            </CardTitle>
            <CardAction>
              <Button
                variant="outline"
                size="sm"
                onClick={handleCascadeCheck}
                disabled={cascadeSSE.isStreaming}
              >
                {cascadeSSE.isStreaming ? (
                  <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                ) : (
                  <Sparkles className="h-4 w-4 mr-1" />
                )}
                检查影响
              </Button>
            </CardAction>
          </CardHeader>
          <CardContent>
            {!showCascade ? (
              <p className="text-sm text-muted-foreground">
                修改大纲后，点击「检查影响」分析对已写章节的影响
              </p>
            ) : cascadeSSE.isStreaming ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                正在分析...
              </div>
            ) : cascadeResult ? (
              <div className="space-y-3">
                <p className="text-sm">{cascadeResult.summary}</p>
                {cascadeResult.affected && cascadeResult.affected.length > 0 && (
                  <div className="space-y-2">
                    {cascadeResult.affected.map((item, i) => (
                      <div key={i} className="rounded-md border border-border p-3 text-sm">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-medium">{item.chapter_title}</span>
                          <span className={`text-xs px-1.5 py-0.5 rounded ${
                            item.severity === "high" ? "bg-red-100 text-red-700" :
                            item.severity === "medium" ? "bg-yellow-100 text-yellow-700" :
                            "bg-blue-100 text-blue-700"
                          }`}>
                            {item.severity === "high" ? "高" : item.severity === "medium" ? "中" : "低"}
                          </span>
                        </div>
                        <p className="text-muted-foreground">{item.impact}</p>
                        <p className="text-xs mt-1">{item.suggestion}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : null}
          </CardContent>
        </Card>
      )}
    </StepPage>
  );
}
