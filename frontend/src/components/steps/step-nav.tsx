"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

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

interface StepNavProps {
  stepKey: string;
  onBeforeNavigate?: () => Promise<void>;
  disabled?: boolean;
}

export function StepNav({ stepKey, onBeforeNavigate, disabled }: StepNavProps) {
  const router = useRouter();
  const params = useParams();
  const projectId = params.id as string;
  const [navigating, setNavigating] = useState<"prev" | "next" | null>(null);

  const currentIndex = STEPS.findIndex((s) => s.key === stepKey);
  const prevStep = currentIndex > 0 ? STEPS[currentIndex - 1] : null;
  const nextStep = currentIndex < STEPS.length - 1 ? STEPS[currentIndex + 1] : null;

  const go = async (step: typeof STEPS[number], dir: "prev" | "next") => {
    setNavigating(dir);
    try {
      if (onBeforeNavigate) await onBeforeNavigate();
      router.push(`/project/${projectId}/${step.key}`);
    } catch (e) {
      toast.error("保存失败，无法跳转", { description: String(e) });
      setNavigating(null);
    }
  };

  if (!prevStep && !nextStep) return null;

  return (
    <div className="flex items-center justify-between mt-8 pt-6 border-t border-border">
      {prevStep ? (
        <Button variant="ghost" onClick={() => go(prevStep, "prev")} disabled={disabled || !!navigating}>
          {navigating === "prev" ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : <ChevronLeft className="h-4 w-4 mr-1.5" />}
          {prevStep.label}
        </Button>
      ) : <div />}
      {nextStep && (
        <Button onClick={() => go(nextStep, "next")} disabled={disabled || !!navigating}>
          {navigating === "next" && <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />}
          {nextStep.label}
          {navigating !== "next" && <ChevronRight className="h-4 w-4 ml-1.5" />}
        </Button>
      )}
    </div>
  );
}
