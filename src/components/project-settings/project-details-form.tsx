"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { updateProjectAction } from "@/server/actions/projects";
import { updateProjectSchema } from "@/server/actions/projects.schema";
import { PROJECT_COLORS } from "@/lib/project-colors";
import { cn } from "@/lib/utils";

export type ProjectDetailsFormProps = { projectId: string; name: string; color: string };

export function ProjectDetailsForm({ projectId, name, color }: ProjectDetailsFormProps) {
  const [value, setValue] = useState(name);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const parsed = updateProjectSchema.safeParse({
      projectId,
      name: value,
    });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Invalid input");
      return;
    }
    setPending(true);
    setError(null);
    const res = await updateProjectAction(parsed.data);
    setPending(false);
    if (!res.ok) setError(res.error.message);
  }

  async function setColor(next: string) {
    const res = await updateProjectAction({ projectId, color: next });
    if (!res.ok) toast.error(res.error.message);
  }

  return (
    <section className="space-y-4">
      <h2 className="text-base font-semibold">Project</h2>
      <form onSubmit={onSubmit} className="space-y-2">
        <div className="flex items-center gap-2">
          <Input
            value={value}
            onChange={(e) => setValue(e.target.value)}
            maxLength={80}
            aria-label="Project name"
            className="max-w-sm"
          />
          <Button
            type="submit"
            disabled={pending || value.trim() === name.trim()}
          >
            Save
          </Button>
        </div>
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
      </form>
      <div className="space-y-2">
        <Label>Color</Label>
        <div className="flex flex-wrap gap-2">
          {PROJECT_COLORS.map((c) => (
            <button
              key={c.value}
              type="button"
              aria-label={c.name}
              aria-pressed={color === c.value}
              onClick={() => void setColor(c.value)}
              className={cn(
                "size-6 rounded-full transition",
                color === c.value && "ring-2 ring-offset-2 ring-ring",
              )}
              style={{ backgroundColor: c.value }}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
