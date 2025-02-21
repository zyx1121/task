import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { CheckIcon, Cross2Icon, Pencil1Icon } from "@radix-ui/react-icons";

interface TaskProps {
  id: string;
  title: string;
  listId: string;
  isEditing: boolean;
  editingTitle: string;
  onEdit: () => void;
  onDelete: () => void;
  onUpdate: () => void;
  onCancel: () => void;
  onTitleChange: (value: string) => void;
  isDragOverlay?: boolean;
  style?: {
    zIndex: number;
  };
}

export default function Task({
  id,
  title,
  listId,
  isEditing,
  editingTitle,
  onEdit,
  onDelete,
  onUpdate,
  onCancel,
  onTitleChange,
  isDragOverlay,
  style: customStyle,
}: TaskProps) {
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
      type: "task",
      listId,
    },
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    ...customStyle,
  };

  return (
    <li
      ref={setNodeRef}
      style={style}
      className={`bg-secondary p-3 rounded-lg shadow ${
        !isEditing ? "cursor-move" : ""
      } ${isDragging ? "opacity-50" : ""} ${
        isDragOverlay ? "shadow-2xl z-[9999]" : ""
      }`}
      {...attributes}
      {...listeners}
    >
      {isEditing ? (
        <div className="flex items-center">
          <Input
            type="text"
            value={editingTitle}
            onChange={(e) => onTitleChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                onUpdate();
              } else if (e.key === "Escape") {
                onCancel();
              }
            }}
            className="flex-1 mr-2"
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
        <div className="flex justify-between items-center group text-secondary-foreground">
          <span>{title}</span>
          <div className="flex items-center opacity-0 group-hover:opacity-100 transition-opacity">
            <Button onClick={onEdit} variant="ghost" size="icon">
              <Pencil1Icon className="h-4 w-4" />
            </Button>
            <Button
              onClick={() => {
                if (
                  window.confirm("Are you sure you want to delete this task?")
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
    </li>
  );
}
