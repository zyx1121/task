import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Task as TaskType } from "@/types";
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  CheckIcon,
  Cross2Icon,
  Pencil1Icon,
  PlusIcon,
} from "@radix-ui/react-icons";
import Task from "./task";

interface TaskListProps {
  id: string;
  name: string;
  tasks: TaskType[];
  isEditing: boolean;
  editingName: string;
  isAddingTask: boolean;
  newTaskTitle: string;
  editingTaskId: string | null;
  editingTaskTitle: string;
  onEdit: () => void;
  onDelete: () => void;
  onUpdate: () => void;
  onCancel: () => void;
  onNameChange: (value: string) => void;
  onAddTask: () => void;
  onAddTaskClick: () => void;
  onCancelAddTask: () => void;
  onNewTaskTitleChange: (value: string) => void;
  onEditTask: (taskId: string) => void;
  onUpdateTask: () => void;
  onCancelEditTask: () => void;
  onDeleteTask: (taskId: string) => void;
  onEditingTaskTitleChange: (value: string) => void;
  isDragOverlay?: boolean;
  getItemStyles?: (args: {
    index: number;
    overIndex: number;
    isDragging: boolean;
  }) => {
    zIndex: number;
  };
}

export default function TaskList({
  id,
  name,
  tasks,
  isEditing,
  editingName,
  isAddingTask,
  newTaskTitle,
  editingTaskId,
  editingTaskTitle,
  onEdit,
  onDelete,
  onUpdate,
  onCancel,
  onNameChange,
  onAddTask,
  onAddTaskClick,
  onCancelAddTask,
  onNewTaskTitleChange,
  onEditTask,
  onUpdateTask,
  onCancelEditTask,
  onDeleteTask,
  onEditingTaskTitleChange,
  isDragOverlay,
  getItemStyles,
}: TaskListProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id,
    data: {
      type: "list",
    },
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex-none w-[calc(100dvw-2rem)] md:w-[480px] bg-background p-4 rounded-lg border border-border h-fit ${
        isDragging ? "opacity-50" : ""
      } ${isDragOverlay ? "shadow-2xl" : ""}`}
    >
      <div
        className="flex justify-between items-center mb-4 cursor-move"
        {...attributes}
        {...listeners}
      >
        {isEditing ? (
          <div className="flex-1 flex items-center">
            <Input
              type="text"
              value={editingName}
              onChange={(e) => onNameChange(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  onUpdate();
                } else if (e.key === "Escape") {
                  onCancel();
                }
              }}
              className="flex-1 text-xl font-bold mr-2"
              autoFocus
            />
            <Button onClick={onUpdate} variant="ghost" size="icon">
              <CheckIcon className="h-4 w-4" />
            </Button>
            <Button onClick={onCancel} variant="ghost" size="icon">
              <Cross2Icon className="h-4 w-4" />
            </Button>
          </div>
        ) : (
          <div className="flex justify-between items-center w-full group">
            <h2 className="text-xl font-bold">{name}</h2>
            <div className="flex items-center opacity-0 group-hover:opacity-100 transition-opacity">
              <Button onClick={onEdit} variant="ghost" size="icon">
                <Pencil1Icon className="h-4 w-4" />
              </Button>
              <Button onClick={onAddTaskClick} variant="ghost" size="icon">
                <PlusIcon className="h-4 w-4" />
              </Button>
              <Button
                onClick={() => {
                  if (
                    window.confirm(
                      "Are you sure you want to delete this list? All tasks will be deleted."
                    )
                  ) {
                    onDelete();
                  }
                }}
                variant="ghost"
                size="icon"
              >
                <Cross2Icon className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </div>
      <ul className="space-y-2 max-h-[calc(100dvh-12rem)] overflow-y-auto">
        {isAddingTask && (
          <li className="bg-secondary p-3 rounded-lg shadow">
            <div className="flex items-center">
              <Input
                type="text"
                value={newTaskTitle}
                onChange={(e) => onNewTaskTitleChange(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    onAddTask();
                  } else if (e.key === "Escape") {
                    onCancelAddTask();
                  }
                }}
                placeholder="Enter task name..."
                className="flex-1 mr-2"
                autoFocus
              />
              <Button onClick={onAddTask} variant="ghost" size="icon">
                <CheckIcon className="h-4 w-4" />
              </Button>
              <Button onClick={onCancelAddTask} variant="ghost" size="icon">
                <Cross2Icon className="h-4 w-4" />
              </Button>
            </div>
          </li>
        )}
        <SortableContext
          items={tasks.map((task) => task.id)}
          strategy={verticalListSortingStrategy}
        >
          {tasks.map((task, index) => (
            <Task
              key={task.id}
              id={task.id}
              listId={id}
              title={task.title}
              isEditing={editingTaskId === task.id}
              editingTitle={editingTaskTitle}
              onEdit={() => onEditTask(task.id)}
              onDelete={() => onDeleteTask(task.id)}
              onUpdate={onUpdateTask}
              onCancel={onCancelEditTask}
              onTitleChange={onEditingTaskTitleChange}
              style={getItemStyles?.({
                index,
                overIndex: -1,
                isDragging: false,
              })}
            />
          ))}
        </SortableContext>
      </ul>
    </div>
  );
}
