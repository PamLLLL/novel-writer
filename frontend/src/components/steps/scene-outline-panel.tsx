"use client";

import { useState } from "react";
import {
  ChevronDown,
  ChevronRight,
  Sparkles,
  Save,
  Loader2,
  Plus,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface Scene {
  location: string;
  time: string;
  pov: string;
  characters: string[];
  purpose: string;
  conflict: string;
  emotional_arc: string;
  key_beats: string[];
  sensory_anchors: string;
  dialogue_notes: string;
  transition_to_next: string;
}

export interface DetailedOutline {
  scenes: Scene[];
  chapter_arc: string;
  key_revelations: string[];
  foreshadowing_plants: string[];
  foreshadowing_payoffs: string[];
}

interface SceneOutlinePanelProps {
  outline: DetailedOutline | null;
  onOutlineChange: (outline: DetailedOutline) => void;
  onGenerate: () => void;
  onSave: () => void;
  isStreaming: boolean;
  isSaving: boolean;
}

const emptyScene: Scene = {
  location: "",
  time: "",
  pov: "",
  characters: [],
  purpose: "",
  conflict: "",
  emotional_arc: "",
  key_beats: [],
  sensory_anchors: "",
  dialogue_notes: "",
  transition_to_next: "",
};

export function SceneOutlinePanel({
  outline,
  onOutlineChange,
  onGenerate,
  onSave,
  isStreaming,
  isSaving,
}: SceneOutlinePanelProps) {
  const [expanded, setExpanded] = useState(true);
  const [expandedScenes, setExpandedScenes] = useState<Set<number>>(new Set());

  if (!outline && !isStreaming) {
    return (
      <div className="border-b border-border bg-muted/10 px-4 py-3">
        <div className="flex items-center justify-between">
          <div>
            <span className="text-sm font-medium">场景细纲</span>
            <span className="text-xs text-muted-foreground ml-2">
              生成场景级蓝图，大幅提升正文质量
            </span>
          </div>
          <Button size="sm" variant="outline" onClick={onGenerate} disabled={isStreaming}>
            <Sparkles className="h-3.5 w-3.5 mr-1.5" />
            生成细纲
          </Button>
        </div>
      </div>
    );
  }

  const scenes = outline?.scenes || [];

  const toggleScene = (idx: number) => {
    setExpandedScenes((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  };

  const updateScene = (idx: number, field: keyof Scene, value: unknown) => {
    if (!outline) return;
    const newScenes = [...outline.scenes];
    newScenes[idx] = { ...newScenes[idx], [field]: value };
    onOutlineChange({ ...outline, scenes: newScenes });
  };

  const updateBeat = (sceneIdx: number, beatIdx: number, value: string) => {
    if (!outline) return;
    const newScenes = [...outline.scenes];
    const newBeats = [...newScenes[sceneIdx].key_beats];
    newBeats[beatIdx] = value;
    newScenes[sceneIdx] = { ...newScenes[sceneIdx], key_beats: newBeats };
    onOutlineChange({ ...outline, scenes: newScenes });
  };

  const addBeat = (sceneIdx: number) => {
    if (!outline) return;
    const newScenes = [...outline.scenes];
    newScenes[sceneIdx] = {
      ...newScenes[sceneIdx],
      key_beats: [...newScenes[sceneIdx].key_beats, ""],
    };
    onOutlineChange({ ...outline, scenes: newScenes });
  };

  const removeBeat = (sceneIdx: number, beatIdx: number) => {
    if (!outline) return;
    const newScenes = [...outline.scenes];
    newScenes[sceneIdx] = {
      ...newScenes[sceneIdx],
      key_beats: newScenes[sceneIdx].key_beats.filter((_, i) => i !== beatIdx),
    };
    onOutlineChange({ ...outline, scenes: newScenes });
  };

  const addScene = () => {
    if (!outline) return;
    onOutlineChange({ ...outline, scenes: [...outline.scenes, { ...emptyScene }] });
  };

  const removeScene = (idx: number) => {
    if (!outline) return;
    onOutlineChange({
      ...outline,
      scenes: outline.scenes.filter((_, i) => i !== idx),
    });
  };

  return (
    <div className="border-b border-border bg-muted/10">
      <div
        className="flex items-center justify-between px-4 py-2 cursor-pointer hover:bg-muted/20"
        onClick={() => setExpanded((v) => !v)}
      >
        <div className="flex items-center gap-2">
          {expanded ? (
            <ChevronDown className="h-4 w-4" />
          ) : (
            <ChevronRight className="h-4 w-4" />
          )}
          <span className="text-sm font-medium">场景细纲</span>
          <Badge variant="secondary" className="text-[10px]">
            {scenes.length} 个场景
          </Badge>
        </div>
        <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
          <Button size="sm" variant="ghost" onClick={onGenerate} disabled={isStreaming}>
            <Sparkles className="h-3.5 w-3.5 mr-1.5" />
            重新生成
          </Button>
          <Button size="sm" variant="ghost" onClick={onSave} disabled={isSaving}>
            {isSaving ? (
              <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
            ) : (
              <Save className="h-3.5 w-3.5 mr-1.5" />
            )}
            保存
          </Button>
        </div>
      </div>

      {expanded && outline && (
        <div className="px-4 pb-3 space-y-2 max-h-80 overflow-auto">
          {scenes.map((scene, idx) => (
            <Card key={idx} className="shadow-none">
              <CardContent className="p-0">
                <div
                  className="flex items-center justify-between px-3 py-2 cursor-pointer hover:bg-muted/30"
                  onClick={() => toggleScene(idx)}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    {expandedScenes.has(idx) ? (
                      <ChevronDown className="h-3.5 w-3.5 shrink-0" />
                    ) : (
                      <ChevronRight className="h-3.5 w-3.5 shrink-0" />
                    )}
                    <Badge variant="outline" className="text-[10px] shrink-0">
                      场景 {idx + 1}
                    </Badge>
                    <span className="text-xs truncate">
                      {scene.location || "未设置"} | {scene.pov || "未设置"}
                    </span>
                    <span className="text-xs text-muted-foreground truncate">
                      {scene.purpose}
                    </span>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 w-6 p-0 shrink-0"
                    onClick={(e) => {
                      e.stopPropagation();
                      removeScene(idx);
                    }}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>

                {expandedScenes.has(idx) && (
                  <div className="px-3 pb-3 pt-1 space-y-2 border-t border-border/50">
                    <div className="grid grid-cols-3 gap-2">
                      <div>
                        <Label className="text-[10px]">地点</Label>
                        <Input
                          value={scene.location}
                          onChange={(e) => updateScene(idx, "location", e.target.value)}
                          className="h-7 text-xs"
                        />
                      </div>
                      <div>
                        <Label className="text-[10px]">时间</Label>
                        <Input
                          value={scene.time}
                          onChange={(e) => updateScene(idx, "time", e.target.value)}
                          className="h-7 text-xs"
                        />
                      </div>
                      <div>
                        <Label className="text-[10px]">POV角色</Label>
                        <Input
                          value={scene.pov}
                          onChange={(e) => updateScene(idx, "pov", e.target.value)}
                          className="h-7 text-xs"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <Label className="text-[10px]">场景目的</Label>
                        <Input
                          value={scene.purpose}
                          onChange={(e) => updateScene(idx, "purpose", e.target.value)}
                          className="h-7 text-xs"
                        />
                      </div>
                      <div>
                        <Label className="text-[10px]">冲突/张力</Label>
                        <Input
                          value={scene.conflict}
                          onChange={(e) => updateScene(idx, "conflict", e.target.value)}
                          className="h-7 text-xs"
                        />
                      </div>
                    </div>

                    <div>
                      <Label className="text-[10px]">情绪弧线</Label>
                      <Input
                        value={scene.emotional_arc}
                        onChange={(e) => updateScene(idx, "emotional_arc", e.target.value)}
                        className="h-7 text-xs"
                        placeholder="如：从轻松闲聊 → 暗中警觉 → 紧张对峙"
                      />
                    </div>

                    <div>
                      <Label className="text-[10px]">
                        关键节拍（具体的动作/对话要点）
                      </Label>
                      <div className="space-y-1">
                        {scene.key_beats.map((beat, bi) => (
                          <div key={bi} className="flex gap-1">
                            <Input
                              value={beat}
                              onChange={(e) => updateBeat(idx, bi, e.target.value)}
                              className="h-7 text-xs flex-1"
                            />
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 w-7 p-0 shrink-0"
                              onClick={() => removeBeat(idx, bi)}
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                        ))}
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 text-xs"
                          onClick={() => addBeat(idx)}
                        >
                          <Plus className="h-3 w-3 mr-1" />
                          添加节拍
                        </Button>
                      </div>
                    </div>

                    <div>
                      <Label className="text-[10px]">感官锚点</Label>
                      <Input
                        value={scene.sensory_anchors}
                        onChange={(e) => updateScene(idx, "sensory_anchors", e.target.value)}
                        className="h-7 text-xs"
                      />
                    </div>

                    <div>
                      <Label className="text-[10px]">对话指导</Label>
                      <Input
                        value={scene.dialogue_notes}
                        onChange={(e) => updateScene(idx, "dialogue_notes", e.target.value)}
                        className="h-7 text-xs"
                      />
                    </div>

                    <div>
                      <Label className="text-[10px]">过渡到下一场景</Label>
                      <Input
                        value={scene.transition_to_next}
                        onChange={(e) => updateScene(idx, "transition_to_next", e.target.value)}
                        className="h-7 text-xs"
                      />
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}

          <Button variant="outline" size="sm" className="w-full text-xs" onClick={addScene}>
            <Plus className="h-3 w-3 mr-1" />
            添加场景
          </Button>

          {outline.chapter_arc && (
            <div className="pt-1">
              <Label className="text-[10px]">本章弧线</Label>
              <Input
                value={outline.chapter_arc}
                onChange={(e) => onOutlineChange({ ...outline, chapter_arc: e.target.value })}
                className="h-7 text-xs"
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
