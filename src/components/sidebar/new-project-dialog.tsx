"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { DEFAULT_PROJECT_COLOR, PROJECT_COLORS } from "@/lib/project-colors";
import { createProjectAction } from "@/server/actions/projects";
import { createProjectSchema } from "@/server/actions/projects.schema";

export type NewProjectDialogProps = {
  spaceId: string;
  /** Existing projects, for "Copy statuses from…". */
  projects: { id: string; name: string }[];
};

const triggerRow =
  "flex h-8 w-full items-center gap-2 rounded-md px-2 text-sm text-muted-foreground hover:bg-accent hover:text-foreground";

const DEFAULT_STATUSES = "Default (To do, In progress, Done)";

export function NewProjectDialog({ spaceId, projects }: NewProjectDialogProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [color, setColor] = useState<string>(DEFAULT_PROJECT_COLOR);
  const [copyFrom, setCopyFrom] = useState("default");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const statusItems: Record<string, string> = {
    default: DEFAULT_STATUSES,
    ...Object.fromEntries(projects.map((p) => [p.id, `Copy from ${p.name}`])),
  };

  function reset() {
    setName("");
    setColor(DEFAULT_PROJECT_COLOR);
    setCopyFrom("default");
    setError(null);
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const parsed = createProjectSchema.safeParse({
      spaceId,
      name,
      color,
      copyStatusesFromProjectId: copyFrom !== "default" ? copyFrom : undefined,
    });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Invalid input");
      return;
    }
    setPending(true);
    setError(null);
    const res = await createProjectAction(parsed.data);
    setPending(false);
    if (!res.ok) {
      setError(res.error.message);
      return;
    }
    setOpen(false);
    reset();
    router.push(
      `/s/${spaceId}/p/${res.data.projectId}/l/${res.data.firstListId}`,
    );
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<button type="button" className={triggerRow} />}>
        <Plus className="size-4" />
        New project
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New project</DialogTitle>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="new-project-name">Name</Label>
            <Input
              id="new-project-name"
              autoFocus
              maxLength={80}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Website relaunch"
            />
          </div>
          <div className="space-y-2">
            <Label>Color</Label>
            <div className="flex flex-wrap gap-2">
              {PROJECT_COLORS.map((c) => (
                <button
                  key={c.value}
                  type="button"
                  aria-label={c.name}
                  aria-pressed={color === c.value}
                  className={cn(
                    "size-6 rounded-full",
                    color === c.value && "ring-2 ring-offset-2 ring-ring",
                  )}
                  style={{ backgroundColor: c.value }}
                  onClick={() => setColor(c.value)}
                />
              ))}
            </div>
          </div>
          {projects.length > 0 && (
            <div className="space-y-2">
              <Label>Statuses</Label>
              <Select
                items={statusItems}
                value={copyFrom}
                onValueChange={(v) => {
                  if (v !== null) setCopyFrom(v);
                }}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="default">{DEFAULT_STATUSES}</SelectItem>
                  {projects.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      Copy from {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
          <DialogFooter>
            <DialogClose render={<Button variant="outline" />}>
              Cancel
            </DialogClose>
            <Button type="submit" disabled={pending}>
              {pending ? "Creating…" : "Create project"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
