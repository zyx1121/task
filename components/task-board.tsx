"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/contexts/auth-context";
import { db } from "@/lib/firebase";
import {
  CheckIcon,
  Cross2Icon,
  ExitIcon,
  Pencil1Icon,
  PlusIcon,
} from "@radix-ui/react-icons";
import { doc, onSnapshot, updateDoc } from "firebase/firestore";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

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
  const [draggingTask, setDraggingTask] = useState<{
    task: Task;
    sourceListId: string;
  } | null>(null);
  const [draggingList, setDraggingList] = useState<{
    list: TaskList;
    index: number;
  } | null>(null);
  const [newTaskTitle, setNewTaskTitle] = useState<{ [key: string]: string }>(
    {}
  );
  const [addingTask, setAddingTask] = useState<{ [key: string]: boolean }>({});
  const [editingTask, setEditingTask] = useState<EditingTask | null>(null);
  const [editingList, setEditingList] = useState<EditingList | null>(null);

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

  const handleDragStart = (
    e: React.DragEvent,
    task: Task,
    sourceListId: string
  ) => {
    e.stopPropagation();
    if (editingTask) return;
    e.dataTransfer.setData("taskData", JSON.stringify({ task, sourceListId }));
    setDraggingTask({ task, sourceListId });
  };

  const handleTaskDragOver = (
    e: React.DragEvent,
    targetTask: Task,
    targetListId: string
  ) => {
    e.preventDefault();
    e.stopPropagation();

    if (!draggingTask) return;
    const { task: draggedTask, sourceListId } = draggingTask;
    if (draggedTask.id === targetTask.id) return;

    const targetList = lists.find((list) => list.id === targetListId);
    if (!targetList) return;

    const targetIndex = targetList.tasks.findIndex(
      (t) => t.id === targetTask.id
    );
    if (targetIndex === -1) return;

    const newLists = lists.map((list) => {
      if (list.id === sourceListId && sourceListId === targetListId) {
        const tasks = [...list.tasks];
        const draggedIndex = tasks.findIndex((t) => t.id === draggedTask.id);
        tasks.splice(draggedIndex, 1);
        tasks.splice(targetIndex, 0, draggedTask);
        return { ...list, tasks };
      }
      return list;
    });

    setLists(newLists);
  };

  const handleListDragOver = (
    e: React.DragEvent,
    targetListId: string,
    index: number
  ) => {
    e.preventDefault();

    // 如果是列表的拖曳
    if (draggingList && !draggingTask) {
      if (draggingList.index === index) return;

      const newLists = [...lists];
      const draggedList = newLists[draggingList.index];
      newLists.splice(draggingList.index, 1);
      newLists.splice(index, 0, draggedList);
      setLists(newLists);
      setDraggingList({ list: draggedList, index });
    }
  };

  const handleListDrop = async (e: React.DragEvent, targetListId: string) => {
    e.preventDefault();

    // 如果是任務的拖曳
    if (draggingTask) {
      const { task: draggedTask, sourceListId } = draggingTask;

      // 即使是在同一列表內的拖動，也需要更新 Firestore
      try {
        await updateDoc(doc(db, "users", user!.uid), {
          "taskboard.lists": lists,
        });
      } catch (error) {
        console.error("Update task order failed:", error);
      }

      // 如果是跨列表的拖動，則需要移動任務
      if (sourceListId !== targetListId) {
        const newLists = lists.map((list) => {
          if (list.id === sourceListId) {
            return {
              ...list,
              tasks: list.tasks.filter((t) => t.id !== draggedTask.id),
            };
          }
          if (list.id === targetListId) {
            return {
              ...list,
              tasks: [...list.tasks, draggedTask],
            };
          }
          return list;
        });

        try {
          await updateDoc(doc(db, "users", user!.uid), {
            "taskboard.lists": newLists,
          });
          setLists(newLists);
        } catch (error) {
          console.error("Move task failed:", error);
        }
      }
    }

    setDraggingTask(null);
  };

  const handleListDragEnd = async () => {
    if (!draggingList || !user) return;

    try {
      await updateDoc(doc(db, "users", user.uid), {
        "taskboard.lists": lists,
      });
    } catch (error) {
      console.error("Reorder lists failed:", error);
    }

    setDraggingList(null);
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

  const handleCancelEdit = () => {
    setEditingTask(null);
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

  const handleListDragStart = (
    e: React.DragEvent,
    list: TaskList,
    index: number
  ) => {
    if (e.target !== e.currentTarget) return;
    if (editingList || editingTask) return;
    setDraggingList({ list, index });
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
        <div className="flex flex-col md:flex-row gap-4 mx-auto">
          {lists.map((list, index) => (
            <div
              key={list.id}
              className={`flex-none w-[calc(100dvw-2rem)] md:w-[480px] bg-background p-4 rounded-lg border border-border overflow-y-auto md:mb-0 ${
                draggingList?.list.id === list.id ? "opacity-50" : ""
              }`}
              draggable={!editingList && !editingTask}
              onDragStart={(e) => handleListDragStart(e, list, index)}
              onDragOver={(e) => handleListDragOver(e, list.id, index)}
              onDragEnd={handleListDragEnd}
              onDrop={(e) => handleListDrop(e, list.id)}
            >
              <div className="flex justify-between items-center mb-4 cursor-move">
                {editingList?.listId === list.id ? (
                  <div className="flex-1 flex items-center">
                    <Input
                      type="text"
                      value={editingList.name}
                      onChange={(e) =>
                        setEditingList({
                          ...editingList,
                          name: e.target.value,
                        })
                      }
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          handleUpdateList();
                        } else if (e.key === "Escape") {
                          setEditingList(null);
                        }
                      }}
                      className="flex-1 text-xl font-bold mr-2"
                      autoFocus
                    />
                    <Button
                      onClick={handleUpdateList}
                      variant="ghost"
                      size="icon"
                    >
                      <CheckIcon className="h-4 w-4" />
                    </Button>
                    <Button
                      onClick={() => setEditingList(null)}
                      variant="ghost"
                      size="icon"
                    >
                      <Cross2Icon className="h-4 w-4" />
                    </Button>
                  </div>
                ) : (
                  <div className="flex justify-between items-center w-full group">
                    <h2 className="text-xl font-bold">{list.name}</h2>
                    <div className="flex items-center opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button
                        onClick={() => handleEditList(list)}
                        variant="ghost"
                        size="icon"
                      >
                        <Pencil1Icon className="h-4 w-4" />
                      </Button>
                      <Button
                        onClick={() =>
                          setAddingTask({ ...addingTask, [list.id]: true })
                        }
                        variant="ghost"
                        size="icon"
                      >
                        <PlusIcon className="h-4 w-4" />
                      </Button>
                      <Button
                        onClick={() => {
                          if (
                            window.confirm(
                              "Are you sure you want to delete this list? All tasks will be deleted."
                            )
                          ) {
                            handleDeleteList(list.id);
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
              <ul className="space-y-2">
                {addingTask[list.id] && (
                  <li className="bg-secondary p-3 rounded-lg shadow">
                    <div className="flex items-center">
                      <Input
                        type="text"
                        value={newTaskTitle[list.id] || ""}
                        onChange={(e) =>
                          setNewTaskTitle({
                            ...newTaskTitle,
                            [list.id]: e.target.value,
                          })
                        }
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            handleAddTask(list.id);
                          } else if (e.key === "Escape") {
                            setAddingTask({ ...addingTask, [list.id]: false });
                            setNewTaskTitle({ ...newTaskTitle, [list.id]: "" });
                          }
                        }}
                        placeholder="Enter task name..."
                        className="flex-1 mr-2"
                        autoFocus
                      />
                      <Button
                        onClick={() => handleAddTask(list.id)}
                        variant="ghost"
                        size="icon"
                      >
                        <CheckIcon className="h-4 w-4" />
                      </Button>
                      <Button
                        onClick={() => {
                          setAddingTask({ ...addingTask, [list.id]: false });
                          setNewTaskTitle({ ...newTaskTitle, [list.id]: "" });
                        }}
                        variant="ghost"
                        size="icon"
                      >
                        <Cross2Icon className="h-4 w-4" />
                      </Button>
                    </div>
                  </li>
                )}
                {list.tasks.map((task) => (
                  <li
                    key={task.id}
                    className={`bg-secondary p-3 rounded-lg shadow ${
                      editingTask?.taskId !== task.id ? "cursor-move" : ""
                    } ${draggingTask?.task.id === task.id ? "opacity-50" : ""}`}
                    draggable={editingTask?.taskId !== task.id}
                    onDragStart={(e) => handleDragStart(e, task, list.id)}
                    onDragOver={(e) => handleTaskDragOver(e, task, list.id)}
                    onDragEnd={(e) => {
                      e.stopPropagation();
                      if (draggingTask?.sourceListId === list.id) {
                        handleListDrop(e, list.id);
                      }
                      setDraggingTask(null);
                    }}
                  >
                    {editingTask?.taskId === task.id ? (
                      <div className="flex items-center">
                        <Input
                          type="text"
                          value={editingTask.title}
                          onChange={(e) =>
                            setEditingTask({
                              ...editingTask,
                              title: e.target.value,
                            })
                          }
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              handleUpdateTask();
                            } else if (e.key === "Escape") {
                              handleCancelEdit();
                            }
                          }}
                          className="flex-1 mr-2"
                          autoFocus
                        />
                        <Button
                          onClick={handleUpdateTask}
                          variant="ghost"
                          size="icon"
                        >
                          <CheckIcon className="h-4 w-4" />
                        </Button>
                        <Button
                          onClick={handleCancelEdit}
                          variant="ghost"
                          size="icon"
                        >
                          <Cross2Icon className="h-4 w-4" />
                        </Button>
                      </div>
                    ) : (
                      <div className="flex justify-between items-center group text-secondary-foreground">
                        <span>{task.title}</span>
                        <div className="flex items-center opacity-0 group-hover:opacity-100 transition-opacity">
                          <Button
                            onClick={() => handleEditTask(list.id, task)}
                            variant="ghost"
                            size="icon"
                          >
                            <Pencil1Icon className="h-4 w-4" />
                          </Button>
                          <Button
                            onClick={() => {
                              if (
                                window.confirm(
                                  "Are you sure you want to delete this task?"
                                )
                              ) {
                                handleDeleteTask(list.id, task.id);
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
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
