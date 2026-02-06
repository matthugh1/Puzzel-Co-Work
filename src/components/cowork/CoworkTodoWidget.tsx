"use client";

import type { CoworkTodoItem } from "@/types/cowork";
import {
  IconCheckCircle,
  IconCircle,
  IconLoader,
} from "@/components/cowork/icons";

interface CoworkTodoWidgetProps {
  items: CoworkTodoItem[];
}

export function CoworkTodoWidget({ items }: CoworkTodoWidgetProps) {
  const completed = items.filter((t) => t.status === "completed").length;

  const getIcon = (status: string) => {
    switch (status) {
      case "completed":
        return <IconCheckCircle size={16} />;
      case "in_progress":
        return <IconLoader size={16} />;
      default:
        return <IconCircle size={16} />;
    }
  };

  const getClass = (status: string) => {
    switch (status) {
      case "completed":
        return "cowork-todo-item cowork-todo-item--completed";
      case "in_progress":
        return "cowork-todo-item cowork-todo-item--in-progress";
      default:
        return "cowork-todo-item cowork-todo-item--pending";
    }
  };

  return (
    <div className="cowork-todo-widget">
      <div className="cowork-todo-widget__header">
        <span>Progress</span>
        <span className="cowork-todo-widget__count">
          {completed}/{items.length}
        </span>
      </div>
      <div className="cowork-todo-widget__list">
        {items.map((item) => (
          <div key={item.id} className={getClass(item.status)}>
            <span className="cowork-todo-item__icon">{getIcon(item.status)}</span>
            <span>{item.content}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
