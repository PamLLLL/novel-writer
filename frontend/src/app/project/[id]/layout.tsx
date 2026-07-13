"use client";

import Link from "next/link";
import { usePathname, useParams } from "next/navigation";
import {
  Settings2,
  Users,
  Globe,
  Map,
  BookCopy,
  List,
  PenTool,
  ShieldCheck,
  Palette,
  Zap,
  Download,
  ArrowLeft,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

const steps = [
  { key: "settings", label: "基础设定", icon: Settings2, step: 1 },
  { key: "characters", label: "人物设定", icon: Users, step: 2 },
  { key: "worldview", label: "世界观", icon: Globe, step: 3 },
  { key: "outline", label: "故事大纲", icon: Map, step: 4 },
  { key: "volumes", label: "分卷规划", icon: BookCopy, step: 5 },
  { key: "chapters", label: "章节大纲", icon: List, step: 6 },
  { key: "write", label: "正文写作", icon: PenTool, step: 7 },
  { key: "quality", label: "质量检查", icon: ShieldCheck, step: 8 },
];

const tools = [
  { key: "style", label: "风格设置", icon: Palette },
  { key: "auto", label: "一键生成", icon: Zap },
  { key: "export", label: "导出", icon: Download },
];

export default function ProjectLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const params = useParams();
  const projectId = params.id as string;

  return (
    <div className="flex h-full">
      <nav className="w-48 border-r border-border bg-sidebar/50 flex flex-col shrink-0">
        <div className="p-3 border-b border-border">
          <Link href="/">
            <Button variant="ghost" size="sm" className="w-full justify-start gap-2 text-xs">
              <ArrowLeft className="h-3.5 w-3.5" />
              返回项目列表
            </Button>
          </Link>
        </div>
        <div className="flex-1 py-2 px-2 overflow-auto">
          <div className="space-y-0.5">
            {steps.map((s) => {
              const href = `/project/${projectId}/${s.key}`;
              const isActive = pathname === href;
              return (
                <Link
                  key={s.key}
                  href={href}
                  className={cn(
                    "flex items-center gap-2.5 rounded-md px-2.5 py-2 text-sm transition-colors",
                    isActive
                      ? "bg-accent text-accent-foreground font-medium"
                      : "text-muted-foreground hover:bg-accent/50 hover:text-foreground"
                  )}
                >
                  <span className="flex items-center justify-center h-5 w-5 rounded text-[10px] font-semibold bg-muted text-muted-foreground shrink-0">
                    {s.step}
                  </span>
                  <s.icon className="h-3.5 w-3.5 shrink-0" />
                  <span>{s.label}</span>
                </Link>
              );
            })}
          </div>
          <div className="mt-4 pt-4 border-t border-border space-y-0.5">
            {tools.map((t) => {
              const href = `/project/${projectId}/${t.key}`;
              const isActive = pathname === href;
              return (
                <Link
                  key={t.key}
                  href={href}
                  className={cn(
                    "flex items-center gap-2.5 rounded-md px-2.5 py-2 text-sm transition-colors",
                    isActive
                      ? "bg-accent text-accent-foreground font-medium"
                      : "text-muted-foreground hover:bg-accent/50 hover:text-foreground"
                  )}
                >
                  <t.icon className="h-3.5 w-3.5 shrink-0" />
                  <span>{t.label}</span>
                </Link>
              );
            })}
          </div>
        </div>
      </nav>
      <div className="flex-1 overflow-auto">{children}</div>
    </div>
  );
}
