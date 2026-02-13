"use client";

import { IconZap } from "@/components/cowork/icons";

export function SkillActivatedBlock({
  skills,
}: {
  skills: Array<{ id: string; name: string; description: string }>;
}) {
  if (!skills || skills.length === 0) return null;

  return (
    <div className="cowork-skill-activated">
      <div className="cowork-skill-activated__header">
        <IconZap size={14} />
        <span>
          Using skill{skills.length > 1 ? "s" : ""}:{" "}
          {skills.map((s) => s.name).join(", ")}
        </span>
      </div>
    </div>
  );
}
