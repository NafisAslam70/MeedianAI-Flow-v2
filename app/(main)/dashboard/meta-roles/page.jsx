import { useEffect, useState } from "react";

const TaskForm = ({ task, onSubmit }) => {
  const [title, setTitle] = useState(task?.title || "");
  const [description, setDescription] = useState(task?.description || "");
  const [submissables, setSubmissables] = useState(task?.submissables || ""); // New field
  const [action, setAction] = useState(task?.action || ""); // New field

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit({ title, description, submissables, action });
  };

  return (
    <form onSubmit={handleSubmit}>
      <input
        type="text"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Task Title"
        required
      />
      <textarea
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        placeholder="Task Description"
      />
      <textarea
        value={submissables}
        onChange={(e) => setSubmissables(e.target.value)}
        placeholder="Submissables"
      />
      <input
        type="text"
        value={action}
        onChange={(e) => setAction(e.target.value)}
        placeholder="Action"
      />
      <button type="submit">Submit</button>
    </form>
  );
};

const TaskList = ({ tasks, onEdit }) => {
  return (
    <div>
      {tasks.map((task) => (
        <div key={task.id}>
          <h3>{task.title}</h3>
          <p>{task.description}</p>
          <p><strong>Submissables:</strong> {task.submissables}</p> {/* Display submissables */}
          <p><strong>Action:</strong> {task.action}</p> {/* Display action */}
          <button onClick={() => onEdit(task)}>Edit</button>
        </div>
      ))}
    </div>
  );
};

const MetaRolesPage = () => {
  const [tasks, setTasks] = useState([]);
  const [editingTask, setEditingTask] = useState(null);

  const fetchTasks = async () => {
    const response = await fetch("/api/admin/manageMeedian?section=metaRoleTasks&roleDefId=1");
    const data = await response.json();
    setTasks(data.tasks);
  };

  const handleEdit = (task) => {
    setEditingTask(task);
  };

  const handleSubmit = async (task) => {
    const payload = task.id
      ? { updates: [{ ...task }] } // Batch update format
      : { ...task, roleDefId: 1 }; // Single task creation

    const method = task.id ? "POST" : "POST"; // Use POST for both cases

    await fetch("/api/admin/manageMeedian?section=metaRoleTasks", {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    setEditingTask(null);
    fetchTasks();
  };

  useEffect(() => {
    fetchTasks();
  }, []);

  return (
    <div>
      <h1>MRI & Roles</h1>
      {editingTask ? (
        <TaskForm task={editingTask} onSubmit={handleSubmit} />
      ) : (
        <TaskForm onSubmit={handleSubmit} />
      )}
      <TaskList tasks={tasks} onEdit={handleEdit} />
    </div>
  );
};

export default MetaRolesPage;