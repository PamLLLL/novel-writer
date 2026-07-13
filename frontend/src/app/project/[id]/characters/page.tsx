"use client";

import { useEffect, useState, useRef } from "react";
import { useParams } from "next/navigation";
import { Plus, Trash2, Sparkles, Loader2 } from "lucide-react";
import { StepPage } from "@/components/steps/step-page";
import { api } from "@/lib/api-client";
import { useSSE } from "@/hooks/use-sse";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardAction,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

interface Character {
  name: string;
  role: string;
  relationship: string;
  personality: string;
  background: string;
  appearance: string;
}

const emptyCharacter: Character = {
  name: "",
  role: "",
  relationship: "",
  personality: "",
  background: "",
  appearance: "",
};

export default function CharactersPage() {
  const { id: projectId } = useParams<{ id: string }>();
  const [characters, setCharacters] = useState<Character[]>([]);
  const [completingIndex, setCompletingIndex] = useState<number | null>(null);
  const { start, stop, isStreaming } = useSSE();
  const streamRef = useRef("");

  useEffect(() => {
    api.steps.getCharacters(projectId).then((res) => {
      if (Array.isArray(res) && res.length > 0) {
        setCharacters(
          res.map((c) => ({
            name: (c.name as string) || "",
            role: (c.role as string) || "",
            relationship: (c.relationship as string) || "",
            personality: (c.personality as string) || "",
            background: (c.background as string) || "",
            appearance: (c.appearance as string) || "",
          }))
        );
      }
    }).catch(() => {});
  }, [projectId]);

  const updateCharacter = (index: number, field: keyof Character, value: string) => {
    setCharacters((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: value };
      return next;
    });
  };

  const addCharacter = () => {
    setCharacters((prev) => [...prev, { ...emptyCharacter }]);
  };

  const removeCharacter = (index: number) => {
    setCharacters((prev) => prev.filter((_, i) => i !== index));
  };

  const completeCharacter = (index: number) => {
    const char = characters[index];
    setCompletingIndex(index);
    streamRef.current = "";

    const url = `${process.env.NEXT_PUBLIC_API_BASE || "http://localhost:8000/api"}/steps/${projectId}/generate/complete-character`;

    start(url, {
      name: char.name,
      role: char.role,
      relationship: char.relationship,
    }, {
      onContent: (text) => {
        streamRef.current += text;
      },
      onDone: (result) => {
        setCharacters((prev) => {
          const next = [...prev];
          next[index] = {
            name: (result.name as string) || char.name || "",
            role: (result.role as string) || char.role || "",
            relationship: char.relationship,
            personality: (result.personality as string) || "",
            background: (result.background as string) || "",
            appearance: (result.appearance as string) || "",
          };
          return next;
        });
        setCompletingIndex(null);
        toast.success(`「${(result.name as string) || char.name}」设定生成完成`);
      },
      onError: (msg) => {
        setCompletingIndex(null);
        toast.error("生成失败", { description: msg });
      },
    });
  };

  const roleLabel = (role: string) => {
    const map: Record<string, string> = {
      protagonist: "主角",
      antagonist: "反派",
      supporting: "配角",
    };
    return map[role] || role;
  };

  const needsCompletion = (char: Character) => {
    return !char.personality && !char.background && !char.appearance;
  };

  return (
    <StepPage
      stepKey="characters"
      title="人物设定"
      description="塑造故事中的关键角色。可以只填名字和关系，点「AI 补全」自动生成详细设定"
      generateUrl={api.steps.generateUrl(projectId, "characters")}
      onSave={async () => {
        await api.steps.saveCharacters(
          projectId,
          characters as unknown as Record<string, unknown>[]
        );
      }}
      onGenerated={(result) => {
        const chars = (result.characters as Record<string, unknown>[]) || [];
        setCharacters(
          chars.map((c) => ({
            name: (c.name as string) || "",
            role: (c.role as string) || "",
            relationship: "",
            personality: (c.personality as string) || "",
            background: (c.background as string) || "",
            appearance: (c.appearance as string) || "",
          }))
        );
      }}
      hasData={characters.length > 0}
    >
      <div className="grid gap-4 md:grid-cols-2">
        {characters.map((char, index) => {
          const isCompleting = completingIndex === index && isStreaming;
          return (
            <Card key={index} className={isCompleting ? "ring-2 ring-primary/30" : ""}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  {char.name || `角色 ${index + 1}`}
                  {char.role && (
                    <Badge variant="secondary">{roleLabel(char.role)}</Badge>
                  )}
                  {needsCompletion(char) && char.name && (
                    <Badge variant="outline" className="text-xs">待补全</Badge>
                  )}
                </CardTitle>
                <CardAction>
                  <div className="flex gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => completeCharacter(index)}
                      disabled={isStreaming}
                      title="AI 补全角色设定"
                    >
                      {isCompleting ? (
                        <Loader2 className="h-4 w-4 animate-spin text-primary" />
                      ) : (
                        <Sparkles className="h-4 w-4 text-primary" />
                      )}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => removeCharacter(index)}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </CardAction>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label>姓名</Label>
                    <Input
                      placeholder="角色姓名"
                      value={char.name}
                      onChange={(e) => updateCharacter(index, "name", e.target.value)}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label>角色定位</Label>
                    <Input
                      placeholder="主角、反派、导师..."
                      value={char.role}
                      onChange={(e) => updateCharacter(index, "role", e.target.value)}
                    />
                  </div>
                </div>
                <div className="space-y-1">
                  <Label>与主角的关系</Label>
                  <Input
                    placeholder="如：青梅竹马、宿敌、师父、暗恋对象..."
                    value={char.relationship}
                    onChange={(e) => updateCharacter(index, "relationship", e.target.value)}
                  />
                </div>

                {isCompleting && (
                  <div className="rounded-md bg-muted/50 border border-border p-3">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      正在生成角色设定...
                    </div>
                    <pre className="text-xs whitespace-pre-wrap max-h-32 overflow-auto font-mono">
                      {streamRef.current || "等待响应..."}
                    </pre>
                  </div>
                )}

                <div className="space-y-1">
                  <Label>性格特征</Label>
                  <Textarea
                    placeholder={needsCompletion(char) ? "点击 ✨ 按钮让 AI 自动生成" : "描述角色的性格特点..."}
                    value={char.personality}
                    onChange={(e) => updateCharacter(index, "personality", e.target.value)}
                    rows={2}
                  />
                </div>
                <div className="space-y-1">
                  <Label>人物背景</Label>
                  <Textarea
                    placeholder={needsCompletion(char) ? "点击 ✨ 按钮让 AI 自动生成" : "角色的成长经历与背景故事..."}
                    value={char.background}
                    onChange={(e) => updateCharacter(index, "background", e.target.value)}
                    rows={2}
                  />
                </div>
                <div className="space-y-1">
                  <Label>外貌描写</Label>
                  <Textarea
                    placeholder={needsCompletion(char) ? "点击 ✨ 按钮让 AI 自动生成" : "角色的外貌特征..."}
                    value={char.appearance}
                    onChange={(e) => updateCharacter(index, "appearance", e.target.value)}
                    rows={2}
                  />
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Button variant="outline" className="w-full" onClick={addCharacter}>
        <Plus className="h-4 w-4 mr-2" />
        添加角色
      </Button>
    </StepPage>
  );
}
