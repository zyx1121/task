"use client";

import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/auth-context";
import { db } from "@/lib/firebase";
import {
  DndContext,
  DragEndEvent,
  DragOverEvent,
  DragOverlay,
  DragStartEvent,
  MouseSensor,
  TouchSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  horizontalListSortingStrategy,
} from "@dnd-kit/sortable";
import { ExitIcon, PlusIcon } from "@radix-ui/react-icons";
import { doc, onSnapshot, updateDoc } from "firebase/firestore";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import Task from "./task";
import TaskList from "./task-list";

interface Task {
  id: string;
  title: string;
  completed: boolean;
}

interface TaskList {
  id: string;
  name: string;
  tasks: Task[];
}

interface EditingTask {
  listId: string;
  taskId: string;
  title: string;
}

interface EditingList {
  listId: string;
  name: string;
}

export default function TaskBoard() {
  const { user, signOut } = useAuth();
  const router = useRouter();
  const [lists, setLists] = useState<TaskList[]>([]);
  const [editingList, setEditingList] = useState<EditingList | null>(null);
  const [addingTask, setAddingTask] = useState<{ [key: string]: boolean }>({});
  const [newTaskTitle, setNewTaskTitle] = useState<{ [key: string]: string }>(
    {}
  );
  const [editingTask, setEditingTask] = useState<EditingTask | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [activeData, setActiveData] = useState<{
    type: "list" | "task";
    listId?: string;
  } | null>(null);

  const sensors = useSensors(
    useSensor(MouseSensor, {
      activationConstraint: {
        distance: 10,
      },
    }),
    useSensor(TouchSensor, {
      activationConstraint: {
        delay: 250,
        tolerance: 5,
      },
    })
  );

  useEffect(() => {
    const unsubscribe = onSnapshot(
      doc(db, "users", user!.uid),
      (doc) => {
        if (doc.exists()) {
          const data = doc.data();
          setLists(data.taskboard?.lists || []);
        }
      },
      (error) => {
        console.error("Read Task Board failed:", error);
      }
    );

    return () => unsubscribe();
  }, [user, router]);

  const handleDragStart = (event: DragStartEvent) => {
    const { active } = event;
    setActiveId(active.id as string);
    setActiveData(
      active.data.current as { type: "list" | "task"; listId?: string }
    );
  };

  const handleDragOver = async (event: DragOverEvent) => {
    const { active, over } = event;
    if (!over) return;

    const activeId = active.id;
    const overId = over.id;

    if (activeId === overId) return;

    const activeData = active.data.current as {
      type: "list" | "task";
      listId?: string;
    };
    const overData = over.data.current as {
      type: "list" | "task";
      listId?: string;
    };

    if (activeData.type === "task") {
      const activeListId = activeData.listId;
      const overListId = overData.type === "list" ? overId : overData.listId;

      if (activeListId === overListId) {
        // 同一列表內的任務重新排序
        const activeList = lists.find((list) => list.id === activeListId);
        if (!activeList) return;

        const oldIndex = activeList.tasks.findIndex(
          (task) => task.id === activeId
        );
        const newIndex = activeList.tasks.findIndex(
          (task) => task.id === overId
        );

        if (oldIndex === -1 || newIndex === -1) return;

        const newLists = lists.map((list) => {
          if (list.id === activeListId) {
            const newTasks = [...list.tasks];
            const [removed] = newTasks.splice(oldIndex, 1);
            newTasks.splice(newIndex, 0, removed);
            return { ...list, tasks: newTasks };
          }
          return list;
        });

        setLists(newLists);

        try {
          await updateDoc(doc(db, "users", user!.uid), {
            "taskboard.lists": newLists,
          });
        } catch (error) {
          console.error("Update task order failed:", error);
        }
      }
    }
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over) return;

    const activeId = active.id;
    const overId = over.id;

    if (activeId === overId) return;

    const activeData = active.data.current as {
      type: "list" | "task";
      listId?: string;
    };
    const overData = over.data.current as {
      type: "list" | "task";
      listId?: string;
    };

    let newLists = [...lists];

    if (activeData.type === "list") {
      const oldIndex = lists.findIndex((list) => list.id === activeId);
      const newIndex = lists.findIndex((list) => list.id === overId);

      if (oldIndex !== -1 && newIndex !== -1) {
        newLists = arrayMove(lists, oldIndex, newIndex);
      }
    } else if (activeData.type === "task") {
      const sourceListId = activeData.listId;
      const targetListId = overData.type === "list" ? overId : overData.listId;

      if (sourceListId === targetListId) {
        // 同一列表內的任務重新排序，已在 handleDragOver 中處理
      } else {
        // 跨列表移動任務
        const sourceList = lists.find((list) => list.id === sourceListId);
        const targetList = lists.find((list) => list.id === targetListId);

        if (!sourceList || !targetList) return;

        const taskToMove = sourceList.tasks.find(
          (task) => task.id === activeId
        );
        if (!taskToMove) return;

        newLists = lists.map((list) => {
          if (list.id === sourceListId) {
            return {
              ...list,
              tasks: list.tasks.filter((task) => task.id !== activeId),
            };
          }
          if (list.id === targetListId) {
            const targetIndex =
              overData.type === "task"
                ? targetList.tasks.findIndex((task) => task.id === overId)
                : targetList.tasks.length;

            const newTasks = [...targetList.tasks];
            if (targetIndex === -1) {
              newTasks.push(taskToMove);
            } else {
              newTasks.splice(targetIndex, 0, taskToMove);
            }

            return {
              ...targetList,
              tasks: newTasks,
            };
          }
          return list;
        });
      }
    }

    setLists(newLists);
    setActiveId(null);
    setActiveData(null);

    try {
      await updateDoc(doc(db, "users", user!.uid), {
        "taskboard.lists": newLists,
      });
    } catch (error) {
      console.error("Update board failed:", error);
    }
  };

  const handleAddList = async () => {
    if (!user) return;

    const newList: TaskList = {
      id: `list-${Date.now()}`,
      name: "New List",
      tasks: [],
    };

    try {
      await updateDoc(doc(db, "users", user.uid), {
        "taskboard.lists": [...lists, newList],
      });
    } catch (error) {
      console.error("Add list failed:", error);
    }
  };

  const handleEditList = (list: TaskList) => {
    setEditingList({
      listId: list.id,
      name: list.name,
    });
  };

  const handleUpdateList = async () => {
    if (!editingList || !user) return;

    const newLists = lists.map((list) =>
      list.id === editingList.listId
        ? { ...list, name: editingList.name }
        : list
    );

    try {
      await updateDoc(doc(db, "users", user.uid), {
        "taskboard.lists": newLists,
      });
      setEditingList(null);
    } catch (error) {
      console.error("Update list failed:", error);
    }
  };

  const handleDeleteList = async (listId: string) => {
    if (!user) return;

    const newLists = lists.filter((list) => list.id !== listId);

    try {
      await updateDoc(doc(db, "users", user.uid), {
        "taskboard.lists": newLists,
      });
    } catch (error) {
      console.error("Delete list failed:", error);
    }
  };

  const handleAddTask = async (listId: string) => {
    if (!user || !newTaskTitle[listId]?.trim()) return;

    const newTask: Task = {
      id: `task-${Date.now()}`,
      title: newTaskTitle[listId].trim(),
      completed: false,
    };

    const newLists = lists.map((list) => {
      if (list.id === listId) {
        return {
          ...list,
          tasks: [...list.tasks, newTask],
        };
      }
      return list;
    });

    try {
      await updateDoc(doc(db, "users", user.uid), {
        "taskboard.lists": newLists,
      });
      setNewTaskTitle({ ...newTaskTitle, [listId]: "" });
      setAddingTask({ ...addingTask, [listId]: false });
    } catch (error) {
      console.error("Add task failed:", error);
    }
  };

  const handleEditTask = (listId: string, task: Task) => {
    setEditingTask({
      listId,
      taskId: task.id,
      title: task.title,
    });
  };

  const handleUpdateTask = async () => {
    if (!editingTask || !user) return;

    const newLists = lists.map((list) => {
      if (list.id === editingTask.listId) {
        return {
          ...list,
          tasks: list.tasks.map((task) =>
            task.id === editingTask.taskId
              ? { ...task, title: editingTask.title }
              : task
          ),
        };
      }
      return list;
    });

    try {
      await updateDoc(doc(db, "users", user.uid), {
        "taskboard.lists": newLists,
      });
      setEditingTask(null);
    } catch (error) {
      console.error("Update task failed:", error);
    }
  };

  const handleDeleteTask = async (listId: string, taskId: string) => {
    if (!user) return;

    const newLists = lists.map((list) => {
      if (list.id === listId) {
        return {
          ...list,
          tasks: list.tasks.filter((task) => task.id !== taskId),
        };
      }
      return list;
    });

    try {
      await updateDoc(doc(db, "users", user.uid), {
        "taskboard.lists": newLists,
      });
    } catch (error) {
      console.error("Delete task failed:", error);
    }
  };

  return (
    <div className="min-h-dvh">
      <header className="fixed top-0 right-0 p-4 flex justify-between items-center z-10">
        <div className="flex items-center space-x-1">
          <Button
            onClick={handleAddList}
            variant="ghost"
            size="icon"
            title="New List"
          >
            <PlusIcon className="h-4 w-4" />
          </Button>
          <Button onClick={signOut} variant="ghost" size="icon" title="Logout">
            <ExitIcon className="h-4 w-4" />
          </Button>
        </div>
      </header>

      <div className="h-dvh w-full flex md:items-center overflow-x-hidden md:overflow-x-auto overflow-y-auto md:overflow-y-hidden px-4 pt-16">
        <DndContext
          sensors={sensors}
          onDragStart={handleDragStart}
          onDragOver={handleDragOver}
          onDragEnd={handleDragEnd}
        >
          <div className="flex flex-col md:flex-row gap-4 mx-auto">
            <SortableContext
              items={lists.map((list) => list.id)}
              strategy={horizontalListSortingStrategy}
            >
              {lists.map((list) => (
                <TaskList
                  key={list.id}
                  id={list.id}
                  name={list.name}
                  tasks={list.tasks}
                  isEditing={editingList?.listId === list.id}
                  editingName={editingList?.name || ""}
                  isAddingTask={addingTask[list.id] || false}
                  newTaskTitle={newTaskTitle[list.id] || ""}
                  editingTaskId={editingTask?.taskId || null}
                  editingTaskTitle={editingTask?.title || ""}
                  onEdit={() => handleEditList(list)}
                  onDelete={() => handleDeleteList(list.id)}
                  onUpdate={handleUpdateList}
                  onCancel={() => setEditingList(null)}
                  onNameChange={(value) =>
                    setEditingList((prev) =>
                      prev ? { ...prev, name: value } : null
                    )
                  }
                  onAddTask={() => handleAddTask(list.id)}
                  onAddTaskClick={() =>
                    setAddingTask({ ...addingTask, [list.id]: true })
                  }
                  onCancelAddTask={() => {
                    setAddingTask({ ...addingTask, [list.id]: false });
                    setNewTaskTitle({ ...newTaskTitle, [list.id]: "" });
                  }}
                  onNewTaskTitleChange={(value) =>
                    setNewTaskTitle({ ...newTaskTitle, [list.id]: value })
                  }
                  onEditTask={(taskId) =>
                    handleEditTask(
                      list.id,
                      list.tasks.find((t) => t.id === taskId)!
                    )
                  }
                  onUpdateTask={handleUpdateTask}
                  onCancelEditTask={() => setEditingTask(null)}
                  onDeleteTask={(taskId) => handleDeleteTask(list.id, taskId)}
                  onEditingTaskTitleChange={(value) =>
                    setEditingTask((prev) =>
                      prev ? { ...prev, title: value } : null
                    )
                  }
                  getItemStyles={({ index, isDragging }) => ({
                    zIndex: isDragging ? 999 : list.tasks.length - index,
                  })}
                />
              ))}
            </SortableContext>
          </div>
          <DragOverlay>
            {activeId && activeData?.type === "task" && (
              <Task
                id={activeId}
                listId={activeData.listId!}
                title={
                  lists
                    .find((list) => list.id === activeData.listId)
                    ?.tasks.find((task) => task.id === activeId)?.title || ""
                }
                isEditing={false}
                editingTitle=""
                onEdit={() => {}}
                onDelete={() => {}}
                onUpdate={() => {}}
                onCancel={() => {}}
                onTitleChange={() => {}}
                isDragOverlay
              />
            )}
            {activeId && activeData?.type === "list" && (
              <TaskList
                id={activeId}
                name={lists.find((list) => list.id === activeId)?.name || ""}
                tasks={lists.find((list) => list.id === activeId)?.tasks || []}
                isEditing={false}
                editingName=""
                isAddingTask={false}
                newTaskTitle=""
                editingTaskId={null}
                editingTaskTitle=""
                onEdit={() => {}}
                onDelete={() => {}}
                onUpdate={() => {}}
                onCancel={() => {}}
                onNameChange={() => {}}
                onAddTask={() => {}}
                onAddTaskClick={() => {}}
                onCancelAddTask={() => {}}
                onNewTaskTitleChange={() => {}}
                onEditTask={() => {}}
                onUpdateTask={() => {}}
                onCancelEditTask={() => {}}
                onDeleteTask={() => {}}
                onEditingTaskTitleChange={() => {}}
                isDragOverlay
                getItemStyles={({ index }) => ({
                  zIndex: 999 - index,
                })}
              />
            )}
          </DragOverlay>
        </DndContext>
      </div>
    </div>
  );
}
