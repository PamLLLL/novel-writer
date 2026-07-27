"use client";

import { useState } from "react";
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
  Zap,
  Download,
  ArrowLeft,
  ChevronDown,
  ChevronRight,
  Package,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

interface NavItem {
  key: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}

interface NavGroup {
  label: string;
  items: NavItem[];
  collapsible?: boolean;
}

const manualSteps: NavGroup[] = [
  {
    label: "策划",
    items: [
      { key: "settings", label: "基础设定", icon: Settings2 },
      { key: "characters", label: "人物设定", icon: Users },
      { key: "worldview", label: "世界观", icon: Globe },
    ],
  },
  {
    label: "结构",
    items: [
      { key: "outline", label: "故事大纲", icon: Map },
      { key: "volumes", label: "分卷规划", icon: BookCopy },
      { key: "chapters", label: "章节大纲", icon: List },
    ],
  },
  {
    label: "写作",
    items: [
      { key: "write", label: "正文写作", icon: PenTool },
      { key: "quality", label: "质量检查", icon: ShieldCheck },
    ],
  },
];

const allManualKeys = manualSteps.flatMap((g) => g.items.map((i) => i.key));

export default function ProjectLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const params = useParams();
  const projectId = params.id as string;
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  const currentKey = pathname.split("/").pop() || "";
  const isAutoActive = currentKey === "auto";
  const isManualActive = allManualKeys.includes(currentKey);
  const isPublishActive = currentKey === "publish-materials" || currentKey === "export";

  const toggleGroup = (label: string) => {
    setCollapsed((prev) => ({ ...prev, [label]: !prev[label] }));
  };

  return (
    <div className="flex h-full">
      <nav className="w-52 border-r border-border bg-sidebar/50 flex flex-col shrink-0">
        {/* Back */}
        <div className="p-3 border-b border-border">
          <Link href="/">
            <Button variant="ghost" size="sm" className="w-full justify-start gap-2 text-xs">
              <ArrowLeft className="h-3.5 w-3.5" />
              返回项目列表
            </Button>
          </Link>
        </div>

        <div className="flex-1 py-2 px-2 overflow-auto">
          {/* ── 生成阶段 ── */}
          <div className="px-2 pt-1 pb-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            生成阶段
          </div>

          {/* Mode switch: two big buttons */}
          <div className="space-y-1 mb-1">
            <Link
              href={`/project/${projectId}/auto`}
              className={cn(
                "flex items-center gap-2 rounded-md px-2.5 py-2 text-sm font-medium transition-colors",
                isAutoActive
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-accent hover:text-foreground"
              )}
            >
              <Zap className="h-4 w-4 shrink-0" />
              一键生成
            </Link>

            {/* Manual creation: collapsible */}
            <div>
              <button
                onClick={() => toggleGroup("manual")}
                className={cn(
                  "flex items-center gap-2 w-full rounded-md px-2.5 py-2 text-sm font-medium transition-colors",
                  isManualActive && !isAutoActive
                    ? "bg-accent text-accent-foreground"
                    : "text-muted-foreground hover:bg-accent/50 hover:text-foreground"
                )}
              >
                <PenTool className="h-4 w-4 shrink-0" />
                <span className="flex-1 text-left">手动创作</span>
                {collapsed["manual"] ? (
                  <ChevronRight className="h-3 w-3" />
                ) : (
                  <ChevronDown className="h-3 w-3" />
                )}
              </button>

              {!collapsed["manual"] && (
                <div className="ml-3 mt-1 border-l border-border pl-2 space-y-2">
                  {manualSteps.map((group) => (
                    <div key={group.label}>
                      <div className="px-2 py-0.5 text-[10px] font-semibold text-muted-foreground/70">
                        {group.label}
                      </div>
                      <div className="space-y-0.5">
                        {group.items.map((item) => {
                          const href = `/project/${projectId}/${item.key}`;
                          const active = pathname === href;
                          return (
                            <Link
                              key={item.key}
                              href={href}
                              className={cn(
                                "flex items-center gap-2 rounded-md px-2 py-1 text-xs transition-colors",
                                active
                                  ? "bg-accent text-accent-foreground font-medium"
                                  : "text-muted-foreground hover:bg-accent/50 hover:text-foreground"
                              )}
                            >
                              <item.icon className="h-3 w-3 shrink-0" />
                              <span>{item.label}</span>
                            </Link>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* ── 发布阶段 ── */}
          <div className="border-t border-border my-2" />
          <div className="px-2 pt-1 pb-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            发布阶段
          </div>
          <div className="space-y-0.5">
            {([
              { key: "publish-materials", label: "发布素材", icon: Package },
              { key: "export", label: "导出", icon: Download },
            ] as NavItem[]).map((item) => {
              const href = `/project/${projectId}/${item.key}`;
              const active = pathname === href;
              return (
                <Link
                  key={item.key}
                  href={href}
                  className={cn(
                    "flex items-center gap-2 rounded-md px-2.5 py-1.5 text-sm transition-colors",
                    active
                      ? "bg-accent text-accent-foreground font-medium"
                      : "text-muted-foreground hover:bg-accent/50 hover:text-foreground"
                  )}
                >
                  <item.icon className="h-3.5 w-3.5 shrink-0" />
                  <span>{item.label}</span>
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
