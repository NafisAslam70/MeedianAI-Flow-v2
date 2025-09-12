"use client";
import { useEffect, useState } from "react";

const TaskForm = ({ task, onSubmit }) => {
  const [title, setTitle] = useState(task?.title || "");
  const [description, setDescription] = useState(task?.description || "");
  const [submissables, setSubmissables] = useState(task?.submissables || ""); // New field
  const [action, setAction] = useState(task?.action || ""); // New field
  const [timeSensitive, setTimeSensitive] = useState(!!task?.timeSensitive);
  // mode: none | timestamp | window
  const initialMode = task?.execAt ? 'timestamp' : (task?.windowStart || task?.windowEnd ? 'window' : 'none');
  const [timeMode, setTimeMode] = useState(initialMode);
  const [execAt, setExecAt] = useState(task?.execAt ? new Date(task.execAt).toISOString().slice(0,16) : "");
  const [windowStart, setWindowStart] = useState(task?.windowStart ? new Date(task.windowStart).toISOString().slice(0,16) : "");
  const [windowEnd, setWindowEnd] = useState(task?.windowEnd ? new Date(task.windowEnd).toISOString().slice(0,16) : "");

  const handleSubmit = (e) => {
    e.preventDefault();
    const payload = { title, description, submissables, action, timeSensitive };
    if (timeSensitive) {
      if (timeMode === 'timestamp') {
        payload.execAt = execAt ? new Date(execAt).toISOString() : null;
        payload.windowStart = null;
        payload.windowEnd = null;
      } else if (timeMode === 'window') {
        payload.execAt = null;
        payload.windowStart = windowStart ? new Date(windowStart).toISOString() : null;
        payload.windowEnd = windowEnd ? new Date(windowEnd).toISOString() : null;
      }
    } else {
      payload.execAt = null; payload.windowStart = null; payload.windowEnd = null;
    }
    onSubmit(payload);
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
      <div style={{ marginTop: 8 }}>
        <label style={{ display: 'block', marginBottom: 4 }}>
          <input type="checkbox" checked={timeSensitive} onChange={(e)=> setTimeSensitive(e.target.checked)} /> Time sensitive
        </label>
        {timeSensitive && (
          <div style={{ border: '1px solid #ddd', padding: 8, borderRadius: 8, marginBottom: 8 }}>
            <div style={{ display: 'flex', gap: 16, marginBottom: 8 }}>
              <label><input type="radio" name="tm" checked={timeMode==='timestamp'} onChange={()=> setTimeMode('timestamp')} /> Exact time</label>
              <label><input type="radio" name="tm" checked={timeMode==='window'} onChange={()=> setTimeMode('window')} /> Time window</label>
              <label><input type="radio" name="tm" checked={timeMode==='none'} onChange={()=> setTimeMode('none')} /> None</label>
            </div>
            {timeMode === 'timestamp' && (
              <div>
                <label>Execute at (local): </label>
                <input type="datetime-local" value={execAt} onChange={(e)=> setExecAt(e.target.value)} />
              </div>
            )}
            {timeMode === 'window' && (
              <div style={{ display: 'flex', gap: 12 }}>
                <div>
                  <label>Window start: </label>
                  <input type="datetime-local" value={windowStart} onChange={(e)=> setWindowStart(e.target.value)} />
                </div>
                <div>
                  <label>Window end: </label>
                  <input type="datetime-local" value={windowEnd} onChange={(e)=> setWindowEnd(e.target.value)} />
                </div>
              </div>
            )}
          </div>
        )}
        <button type="submit">Submit</button>
      </div>
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
          <p><strong>Submissables:</strong> {task.submissables}</p>
          <p><strong>Action:</strong> {task.action}</p> {/* Display action */}
          {task.timeSensitive && (
            <div>
              <p><strong>Time Sensitive:</strong> Yes</p>
              {task.execAt && <p><strong>Exec At:</strong> {new Date(task.execAt).toLocaleString()}</p>}
              {task.windowStart && <p><strong>Window:</strong> {new Date(task.windowStart).toLocaleString()} – {task.windowEnd ? new Date(task.windowEnd).toLocaleString() : ''}</p>}
            </div>
          )}
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
