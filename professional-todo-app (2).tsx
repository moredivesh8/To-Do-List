import React, { useState, useEffect, useRef } from 'react';
import { Check, Trash2, Edit2, Plus, Calendar, Flag, Search, Filter, CheckCircle2, Circle, X, Home, ListTodo, BarChart3, MapPin, Settings, Moon, Sun, Upload, Download, AlertCircle, Clock, PlayCircle, ChevronUp, ChevronDown, Bell, BellOff } from 'lucide-react';

export default function TaskFlowPro() {
  const [todos, setTodos] = useState([]);
  const [page, setPage] = useState('home');
  const [theme, setTheme] = useState('dark');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState('deadline-asc');
  const [filterBy, setFilterBy] = useState('all');
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingTask, setEditingTask] = useState(null);
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  const [showToast, setShowToast] = useState(null);
  const notificationCheckInterval = useRef(null);

  const [formData, setFormData] = useState({
    title: '',
    deadline: '',
    time: '',
    category: 'Personal',
    priority: 'Medium'
  });

  useEffect(() => {
    loadFromStorage();
    requestNotificationPermission();
    startNotificationCheck();
    return () => {
      if (notificationCheckInterval.current) {
        clearInterval(notificationCheckInterval.current);
      }
    };
  }, []);

  useEffect(() => {
    saveToStorage();
  }, [todos, theme]);

  const loadFromStorage = () => {
    const saved = localStorage.getItem('taskflow-todos');
    const savedTheme = localStorage.getItem('taskflow-theme');
    if (saved) setTodos(JSON.parse(saved));
    if (savedTheme) setTheme(savedTheme);
  };

  const saveToStorage = () => {
    localStorage.setItem('taskflow-todos', JSON.stringify(todos));
    localStorage.setItem('taskflow-theme', theme);
  };

  const requestNotificationPermission = async () => {
    if ('Notification' in window && Notification.permission === 'default') {
      const permission = await Notification.requestPermission();
      setNotificationsEnabled(permission === 'granted');
    } else if (Notification.permission === 'granted') {
      setNotificationsEnabled(true);
    }
  };

  const startNotificationCheck = () => {
    notificationCheckInterval.current = setInterval(() => {
      checkDeadlines();
    }, 30000);
  };

  const checkDeadlines = () => {
    const now = new Date();
    todos.forEach(todo => {
      if (!todo.completed && todo.deadline && todo.time) {
        const taskDateTime = new Date(`${todo.deadline}T${todo.time}`);
        const timeDiff = taskDateTime - now;
        const oneMinute = 60 * 1000;
        
        if (timeDiff > 0 && timeDiff <= oneMinute && !todo.notified) {
          if (notificationsEnabled && 'Notification' in window && Notification.permission === 'granted') {
            new Notification('TaskFlow Pro - Deadline Alert!', {
              body: `"${todo.title}" is due in less than 1 minute!`,
              icon: '⏰',
              tag: todo.id
            });
          } else {
            showToastMessage(`⏰ "${todo.title}" is due in less than 1 minute!`, 'warning');
          }
          
          const updatedTodos = todos.map(t => 
            t.id === todo.id ? { ...t, notified: true } : t
          );
          setTodos(updatedTodos);
        }
      }
    });
  };

  const showToastMessage = (message, type = 'info') => {
    setShowToast({ message, type });
    setTimeout(() => setShowToast(null), 4000);
  };

  const addTask = () => {
    if (!formData.title.trim()) return;
    
    const newTask = {
      id: Date.now(),
      title: formData.title,
      deadline: formData.deadline,
      time: formData.time,
      category: formData.category,
      priority: formData.priority,
      completed: false,
      createdAt: new Date().toISOString(),
      notified: false
    };
    
    setTodos([...todos, newTask]);
    resetForm();
    setShowAddModal(false);
    showToastMessage('✅ Task added successfully!', 'success');
  };

  const updateTask = () => {
    if (!formData.title.trim()) return;
    
    const updatedTodos = todos.map(t => 
      t.id === editingTask.id 
        ? { ...t, ...formData, notified: false }
        : t
    );
    setTodos(updatedTodos);
    resetForm();
    setEditingTask(null);
    setShowAddModal(false);
    showToastMessage('✏️ Task updated successfully!', 'success');
  };

  const deleteTask = (id) => {
    setTodos(todos.filter(t => t.id !== id));
    showToastMessage('🗑️ Task deleted', 'info');
  };

  const toggleComplete = (id) => {
    const updatedTodos = todos.map(t => 
      t.id === id ? { ...t, completed: !t.completed } : t
    );
    setTodos(updatedTodos);
  };

  const resetForm = () => {
    setFormData({
      title: '',
      deadline: '',
      time: '',
      category: 'Personal',
      priority: 'Medium'
    });
  };

  const openEditModal = (task) => {
    setEditingTask(task);
    setFormData({
      title: task.title,
      deadline: task.deadline,
      time: task.time,
      category: task.category,
      priority: task.priority
    });
    setShowAddModal(true);
  };

  const exportData = () => {
    const dataStr = JSON.stringify(todos, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `taskflow-backup-${Date.now()}.json`;
    link.click();
    showToastMessage('📥 Tasks exported successfully!', 'success');
  };

  const importData = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const imported = JSON.parse(event.target.result);
        setTodos(imported);
        showToastMessage('📤 Tasks imported successfully!', 'success');
      } catch (error) {
        showToastMessage('❌ Invalid file format', 'error');
      }
    };
    reader.readAsText(file);
  };

  const clearAllTasks = () => {
    if (window.confirm('Are you sure you want to delete all tasks?')) {
      setTodos([]);
      showToastMessage('🗑️ All tasks cleared', 'info');
    }
  };

  const getFilteredAndSortedTasks = () => {
    let filtered = [...todos];

    if (searchQuery) {
      filtered = filtered.filter(t => 
        t.title.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    
    switch (filterBy) {
      case 'pending':
        filtered = filtered.filter(t => !t.completed);
        break;
      case 'completed':
        filtered = filtered.filter(t => t.completed);
        break;
      case 'overdue':
        filtered = filtered.filter(t => {
          if (t.completed || !t.deadline) return false;
          const taskDate = new Date(t.deadline);
          return taskDate < today;
        });
        break;
      case 'today':
        filtered = filtered.filter(t => {
          if (!t.deadline) return false;
          const taskDate = new Date(t.deadline);
          return taskDate.toDateString() === today.toDateString();
        });
        break;
    }

    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'deadline-asc':
          if (!a.deadline) return 1;
          if (!b.deadline) return -1;
          return new Date(a.deadline) - new Date(b.deadline);
        case 'deadline-desc':
          if (!a.deadline) return 1;
          if (!b.deadline) return -1;
          return new Date(b.deadline) - new Date(a.deadline);
        case 'priority':
          const priorityOrder = { High: 0, Medium: 1, Low: 2 };
          return priorityOrder[a.priority] - priorityOrder[b.priority];
        case 'newest':
          return new Date(b.createdAt) - new Date(a.createdAt);
        default:
          return 0;
      }
    });

    return filtered;
  };

  const getStats = () => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    
    return {
      total: todos.length,
      pending: todos.filter(t => !t.completed).length,
      completed: todos.filter(t => t.completed).length,
      overdue: todos.filter(t => {
        if (t.completed || !t.deadline) return false;
        return new Date(t.deadline) < today;
      }).length,
      today: todos.filter(t => {
        if (!t.deadline) return false;
        return new Date(t.deadline).toDateString() === today.toDateString();
      }).length
    };
  };

  const getDeadlineProgress = (task) => {
    if (!task.deadline || !task.time || task.completed) return 100;
    
    const now = new Date();
    const deadlineDateTime = new Date(`${task.deadline}T${task.time}`);
    const createdDateTime = new Date(task.createdAt);
    
    const total = deadlineDateTime - createdDateTime;
    const elapsed = now - createdDateTime;
    const progress = (elapsed / total) * 100;
    
    return Math.min(Math.max(progress, 0), 100);
  };

  const isOverdue = (task) => {
    if (!task.deadline || task.completed) return false;
    const now = new Date();
    const taskDate = new Date(`${task.deadline}T${task.time || '23:59'}`);
    return taskDate < now;
  };

  const getTodayTasks = () => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    
    return todos.filter(t => {
      if (!t.deadline || t.completed) return false;
      const taskDate = new Date(t.deadline);
      return taskDate.toDateString() === today.toDateString();
    });
  };

  const getRoadmap = () => {
    const todayTasks = getTodayTasks();
    const priorityOrder = { High: 0, Medium: 1, Low: 2 };
    
    return todayTasks.sort((a, b) => {
      const priorityDiff = priorityOrder[a.priority] - priorityOrder[b.priority];
      if (priorityDiff !== 0) return priorityDiff;
      
      if (!a.deadline || !a.time) return 1;
      if (!b.deadline || !b.time) return -1;
      return new Date(`${a.deadline}T${a.time}`) - new Date(`${b.deadline}T${b.time}`);
    });
  };

  const getEstimatedTime = (priority) => {
    switch (priority) {
      case 'High': return 60;
      case 'Medium': return 30;
      case 'Low': return 15;
      default: return 30;
    }
  };

  const stats = getStats();
  const filteredTasks = getFilteredAndSortedTasks();
  const todayTasks = getTodayTasks();
  const roadmap = getRoadmap();

  const categories = {
    Study: { color: 'from-blue-500 to-cyan-500', icon: '📚' },
    Work: { color: 'from-purple-500 to-pink-500', icon: '💼' },
    Personal: { color: 'from-green-500 to-emerald-500', icon: '🏠' },
    Fitness: { color: 'from-red-500 to-orange-500', icon: '💪' }
  };

  const priorityColors = {
    High: 'text-red-400',
    Medium: 'text-yellow-400',
    Low: 'text-green-400'
  };

  const themeStyles = theme === 'dark' 
    ? {
        bg: 'bg-gradient-to-br from-gray-900 via-purple-900 to-violet-900',
        card: 'bg-white/10 backdrop-blur-xl border-white/20',
        text: 'text-white',
        textSecondary: 'text-gray-300',
        input: 'bg-white/5 border-white/20 text-white placeholder-gray-400',
        button: 'bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600',
        sidebar: 'bg-black/30 backdrop-blur-xl border-white/10'
      }
    : {
        bg: 'bg-gradient-to-br from-pink-50 via-purple-50 to-blue-50',
        card: 'bg-white/90 backdrop-blur-xl border-gray-200',
        text: 'text-gray-900',
        textSecondary: 'text-gray-600',
        input: 'bg-white border-gray-300 text-gray-900 placeholder-gray-400',
        button: 'bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600',
        sidebar: 'bg-white/90 backdrop-blur-xl border-gray-200'
      };

  return (
    <div className={`min-h-screen ${themeStyles.bg} transition-colors duration-500`}>
      {showToast && (
        <div className={`fixed top-4 right-4 z-50 ${themeStyles.card} border rounded-xl p-4 shadow-2xl`}>
          <p className={`${themeStyles.text} font-medium`}>{showToast.message}</p>
        </div>
      )}

      <div className={`fixed left-0 top-0 h-full w-64 ${themeStyles.sidebar} border-r p-6 z-40`}>
        <div className="mb-8">
          <h1 className={`text-2xl font-bold ${themeStyles.text} mb-1`}>TaskFlow Pro</h1>
          <p className={`text-sm ${themeStyles.textSecondary}`}>Manage your life</p>
        </div>

        <nav className="space-y-2 mb-8">
          {[
            { id: 'home', icon: Home, label: 'Home' },
            { id: 'tasks', icon: ListTodo, label: 'All Tasks' },
            { id: 'today', icon: Calendar, label: 'Today' },
            { id: 'roadmap', icon: MapPin, label: 'Roadmap' },
            { id: 'stats', icon: BarChart3, label: 'Statistics' },
            { id: 'settings', icon: Settings, label: 'Settings' }
          ].map(item => (
            <button
              key={item.id}
              onClick={() => setPage(item.id)}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${
                page === item.id
                  ? `${themeStyles.button} text-white shadow-lg scale-105`
                  : `${themeStyles.text} hover:bg-white/10`
              }`}
            >
              <item.icon className="w-5 h-5" />
              <span className="font-medium">{item.label}</span>
            </button>
          ))}
        </nav>

        <button
          onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
          className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl ${themeStyles.card} border ${themeStyles.text} hover:scale-105 transition-all`}
        >
          {theme === 'dark' ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
          <span className="font-medium">{theme === 'dark' ? 'Light' : 'Dark'} Mode</span>
        </button>
      </div>

      <div className="ml-64 p-8">
        {page === 'home' && (
          <div>
            <div className="flex justify-between items-center mb-8">
              <div>
                <h2 className={`text-4xl font-bold ${themeStyles.text} mb-2`}>Welcome Back!</h2>
                <p className={themeStyles.textSecondary}>Here's your productivity overview</p>
              </div>
              <button
                onClick={() => { setEditingTask(null); resetForm(); setShowAddModal(true); }}
                className={`${themeStyles.button} text-white px-6 py-3 rounded-xl font-semibold shadow-lg hover:shadow-xl transition-all flex items-center gap-2`}
              >
                <Plus className="w-5 h-5" />
                New Task
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-8">
              {[
                { label: 'Total', value: stats.total, color: 'from-blue-500 to-cyan-500', icon: '📊' },
                { label: 'Pending', value: stats.pending, color: 'from-yellow-500 to-orange-500', icon: '⏳' },
                { label: 'Completed', value: stats.completed, color: 'from-green-500 to-emerald-500', icon: '✅' },
                { label: 'Overdue', value: stats.overdue, color: 'from-red-500 to-pink-500', icon: '⚠️' },
                { label: 'Today', value: stats.today, color: 'from-purple-500 to-violet-500', icon: '📅' }
              ].map((stat, index) => (
                <div key={index} className={`${themeStyles.card} border rounded-2xl p-6 hover:scale-105 transition-all shadow-lg`}>
                  <div className="text-3xl mb-2">{stat.icon}</div>
                  <div className={`text-4xl font-bold bg-gradient-to-r ${stat.color} bg-clip-text text-transparent mb-1`}>
                    {stat.value}
                  </div>
                  <div className={`text-sm ${themeStyles.textSecondary}`}>{stat.label}</div>
                </div>
              ))}
            </div>

            {stats.total > 0 && (
              <div className={`${themeStyles.card} border rounded-2xl p-8 mb-8 shadow-lg`}>
                <h3 className={`text-xl font-bold ${themeStyles.text} mb-6`}>Overall Progress</h3>
                <div className="flex items-center justify-center gap-8">
                  <div className="relative w-48 h-48">
                    <svg className="transform -rotate-90 w-48 h-48">
                      <circle cx="96" cy="96" r="88" stroke="currentColor" strokeWidth="12" fill="none" className={themeStyles.textSecondary} opacity="0.2" />
                      <circle 
                        cx="96" 
                        cy="96" 
                        r="88" 
                        stroke="url(#gradient)" 
                        strokeWidth="12" 
                        fill="none"
                        strokeLinecap="round"
                        strokeDasharray={`${2 * Math.PI * 88}`}
                        strokeDashoffset={`${2 * Math.PI * 88 * (1 - stats.completed / stats.total)}`}
                        className="transition-all duration-1000"
                      />
                      <defs>
                        <linearGradient id="gradient" x1="0%" y1="0%" x2="100%" y2="100%">
                          <stop offset="0%" stopColor="#8B5CF6" />
                          <stop offset="100%" stopColor="#EC4899" />
                        </linearGradient>
                      </defs>
                    </svg>
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="text-center">
                        <div className={`text-4xl font-bold ${themeStyles.text}`}>
                          {Math.round((stats.completed / stats.total) * 100)}%
                        </div>
                        <div className={`text-sm ${themeStyles.textSecondary}`}>Complete</div>
                      </div>
                    </div>
                  </div>
                  <div>
                    <p className={`${themeStyles.text} text-lg mb-2`}>
                      You've completed <span className="font-bold text-green-500">{stats.completed}</span> out of <span className="font-bold">{stats.total}</span> tasks!
                    </p>
                    <p className={themeStyles.textSecondary}>
                      {stats.pending > 0 ? `Keep going! ${stats.pending} tasks remaining.` : '🎉 All tasks completed!'}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {todayTasks.length > 0 && (
              <div className={`${themeStyles.card} border rounded-2xl p-6 shadow-lg`}>
                <h3 className={`text-xl font-bold ${themeStyles.text} mb-4`}>Today's Tasks</h3>
                <div className="space-y-3">
                  {todayTasks.slice(0, 3).map(task => (
                    <div key={task.id} className={`${themeStyles.card} border rounded-xl p-4 hover:shadow-lg transition-all`}>
                      <div className="flex items-center gap-3">
                        <button onClick={() => toggleComplete(task.id)}>
                          {task.completed ? <CheckCircle2 className="w-6 h-6 text-green-500" /> : <Circle className="w-6 h-6 text-gray-400" />}
                        </button>
                        <div className="flex-1">
                          <p className={`font-medium ${task.completed ? 'line-through opacity-50' : ''} ${themeStyles.text}`}>{task.title}</p>
                          <p className={`text-sm ${themeStyles.textSecondary}`}>
                            {categories[task.category].icon} {task.category} • {task.time}
                          </p>
                        </div>
                        <Flag className={`w-5 h-5 ${priorityColors[task.priority]}`} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {page === 'tasks' && (
          <div>
            <div className="flex justify-between items-center mb-6">
              <h2 className={`text-3xl font-bold ${themeStyles.text}`}>All Tasks</h2>
              <button
                onClick={() => { setEditingTask(null); resetForm(); setShowAddModal(true); }}
                className={`${themeStyles.button} text-white px-6 py-3 rounded-xl font-semibold shadow-lg hover:shadow-xl transition-all flex items-center gap-2`}
              >
                <Plus className="w-5 h-5" />
                New Task
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
              <div className="relative">
                <Search className={`absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 ${themeStyles.textSecondary}`} />
                <input
                  type="text"
                  placeholder="Search tasks..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className={`w-full pl-10 pr-4 py-3 rounded-xl border ${themeStyles.input} focus:outline-none focus:ring-2 focus:ring-purple-500`}
                />
              </div>

              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className={`px-4 py-3 rounded-xl border ${themeStyles.input} focus:outline-none focus:ring-2 focus:ring-purple-500`}
              >
                <option value="deadline-asc">Deadline ↑</option>
                <option value="deadline-desc">Deadline ↓</option>
                <option value="priority">Priority</option>
                <option value="newest">Newest First</option>
              </select>

              <select
                value={filterBy}
                onChange={(e) => setFilterBy(e.target.value)}
                className={`px-4 py-3 rounded-xl border ${themeStyles.input} focus:outline-none focus:ring-2 focus:ring-purple-500`}
              >
                <option value="all">All Tasks</option>
                <option value="pending">Pending</option>
                <option value="completed">Completed</option>
                <option value="overdue">Overdue</option>
                <option value="today">Today</option>
              </select>
            </div>

            <div className="space-y-4">
              {filteredTasks.length === 0 ? (
                <div className={`${themeStyles.card} border rounded-2xl p-12 text-center shadow-lg`}>
                  <CheckCircle2 className={`w-20 h-20 ${themeStyles.textSecondary} opacity-20 mx-auto mb-4`} />
                  <p className={`${themeStyles.text} text-xl mb-2`}>No tasks found</p>
                  <p className={themeStyles.textSecondary}>Try adjusting your filters or add a new task</p>
                </div>
              ) : (
                filteredTasks.map(task => {
                  const progress = getDeadlineProgress(task);
                  const overdue = isOverdue(task);
                  
                  return (
                    <div key={task.id} className={`${themeStyles.card} border rounded-2xl p-6 shadow-lg hover:shadow-xl transition-all`}>
                      <div className="flex items-start gap-4 mb-4">
                        <button onClick={() => toggleComplete(task.id)} className="mt-1">
                          {task.completed ? 
                            <CheckCircle2 className="w-7 h-7 text-green-500" /> : 
                            <Circle className="w-7 h-7 text-gray-400 hover:text-purple-500" />
                          }
                        </button>

                        <div className="flex-1 min-w-0">
                          <h3 className={`text-xl font-bold ${task.completed ? 'line-through opacity-50' : ''} ${themeStyles.text} mb-2`}>
                            {task.title}
                          </h3>
                          
                          <div className="flex flex-wrap gap-3 mb-3">
                            <span className={`px-3 py-1 rounded-full text-sm font-medium text-white bg-gradient-to-r ${categories[task.category].color}`}>
                              {categories[task.category].icon} {task.category}
                            </span>
                            <span className="flex items-center gap-1">
                              <Flag className={`w-4 h-4 ${priorityColors[task.priority]}`} />
                              <span className={`text-sm font-medium ${priorityColors[task.priority]}`}>{task.priority}</span>
                            </span>
                            {task.deadline && (
                              <span className={`flex items-center gap-1 text-sm ${themeStyles.textSecondary}`}>
                                <Calendar className="w-4 h-4" />
                                {new Date(task.deadline).toLocaleDateString()} {task.time && `• ${task.time}`}
                              </span>
                            )}
                            {overdue && !task.completed && (
                              <span className="flex items-center gap-1 text-sm text-red-500 font-semibold">
                                <AlertCircle className="w-4 h-4" />
                                OVERDUE
                              </span>
                            )}
                          </div>

                          {task.deadline && task.time && !task.completed && (
                            <div className="relative mb-2">
                              <div className="h-8 bg-gray-800 rounded-full overflow-hidden relative">
                                <div 
                                  className={`h-full transition-all duration-1000 ${progress > 80 ? 'bg-red-500' : progress > 50 ? 'bg-yellow-500' : 'bg-green-500'}`}
                                  style={{ width: `${progress}%` }}
                                />
                                <div className="absolute inset-0 flex items-center justify-between px-3 text-xs font-semibold text-white">
                                  <span>🏃 Runner</span>
                                  <span>💀 {Math.max(0, Math.round(100 - progress))}% left</span>
                                </div>
                              </div>
                            </div>
                          )}
                        </div>

                        <div className="flex gap-2 flex-shrink-0">
                          <button
                            onClick={() => openEditModal(task)}
                            className="p-2 text-gray-400 hover:text-blue-500 hover:bg-blue-50 rounded-lg transition-all"
                          >
                            <Edit2 className="w-5 h-5" />
                          </button>
                          <button
                            onClick={() => deleteTask(task.id)}
                            className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                          >
                            <Trash2 className="w-5 h-5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}

        {page === 'today' && (
          <div>
            <h2 className={`text-3xl font-bold ${themeStyles.text} mb-6`}>Today's Tasks</h2>
            
            {todayTasks.length === 0 ? (
              <div className={`${themeStyles.card} border rounded-2xl p-12 text-center shadow-lg`}>
                <Calendar className={`w-20 h-20 ${themeStyles.textSecondary} opacity-20 mx-auto mb-4`} />
                <p className={`${themeStyles.text} text-xl mb-2`}>No tasks scheduled for today</p>
                <p className={themeStyles.textSecondary}>You're all caught up!</p>
              </div>
            ) : (
              <div className="space-y-4">
                {todayTasks.map(task => {
                  const progress = getDeadlineProgress(task);
                  const overdue = isOverdue(task);
                  
                  return (
                    <div key={task.id} className={`${themeStyles.card} border rounded-2xl p-6 shadow-lg`}>
                      <div className="flex items-start gap-4">
                        <button onClick={() => toggleComplete(task.id)} className="mt-1">
                          {task.completed ? 
                            <CheckCircle2 className="w-7 h-7 text-green-500" /> : 
                            <Circle className="w-7 h-7 text-gray-400 hover:text-purple-500" />
                          }
                        </button>

                        <div className="flex-1">
                          <h3 className={`text-xl font-bold ${task.completed ? 'line-through opacity-50' : ''} ${themeStyles.text} mb-2`}>
                            {task.title}
                          </h3>
                          
                          <div className="flex flex-wrap gap-3 mb-3">
                            <span className={`px-3 py-1 rounded-full text-sm font-medium text-white bg-gradient-to-r ${categories[task.category].color}`}>
                              {categories[task.category].icon} {task.category}
                            </span>
                            <span className="flex items-center gap-1">
                              <Flag className={`w-4 h-4 ${priorityColors[task.priority]}`} />
                              <span className={`text-sm font-medium ${priorityColors[task.priority]}`}>{task.priority}</span>
                            </span>
                            {task.time && (
                              <span className={`flex items-center gap-1 text-sm ${themeStyles.textSecondary}`}>
                                <Clock className="w-4 h-4" />
                                {task.time}
                              </span>
                            )}
                          </div>

                          {task.time && !task.completed && (
                            <div className="relative">
                              <div className="h-8 bg-gray-800 rounded-full overflow-hidden relative">
                                <div 
                                  className={`h-full transition-all duration-1000 ${progress > 80 ? 'bg-red-500' : progress > 50 ? 'bg-yellow-500' : 'bg-green-500'}`}
                                  style={{ width: `${progress}%` }}
                                />
                                <div className="absolute inset-0 flex items-center justify-between px-3 text-xs font-semibold text-white">
                                  <span>🏃 Runner</span>
                                  <span>💀 {Math.max(0, Math.round(100 - progress))}% left</span>
                                </div>
                              </div>
                            </div>
                          )}
                        </div>

                        <div className="flex gap-2">
                          <button
                            onClick={() => openEditModal(task)}
                            className="p-2 text-gray-400 hover:text-blue-500 hover:bg-blue-50 rounded-lg transition-all"
                          >
                            <Edit2 className="w-5 h-5" />
                          </button>
                          <button
                            onClick={() => deleteTask(task.id)}
                            className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                          >
                            <Trash2 className="w-5 h-5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {page === 'roadmap' && (
          <div>
            <h2 className={`text-3xl font-bold ${themeStyles.text} mb-2`}>Today's Roadmap</h2>
            <p className={`${themeStyles.textSecondary} mb-6`}>Prioritized task plan for today</p>
            
            {roadmap.length === 0 ? (
              <div className={`${themeStyles.card} border rounded-2xl p-12 text-center shadow-lg`}>
                <MapPin className={`w-20 h-20 ${themeStyles.textSecondary} opacity-20 mx-auto mb-4`} />
                <p className={`${themeStyles.text} text-xl mb-2`}>No roadmap for today</p>
                <p className={themeStyles.textSecondary}>Add tasks with today's deadline to see your roadmap</p>
              </div>
            ) : (
              <div>
                <div className={`${themeStyles.card} border rounded-2xl p-6 mb-6 shadow-lg`}>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className={`${themeStyles.text} font-semibold mb-1`}>Total Time Estimate</p>
                      <p className={themeStyles.textSecondary}>Based on priority levels</p>
                    </div>
                    <div className="text-right">
                      <p className={`text-3xl font-bold ${themeStyles.text}`}>
                        {roadmap.reduce((sum, task) => sum + getEstimatedTime(task.priority), 0)} min
                      </p>
                      <p className={`text-sm ${themeStyles.textSecondary}`}>
                        ~{Math.round(roadmap.reduce((sum, task) => sum + getEstimatedTime(task.priority), 0) / 60)} hours
                      </p>
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  {roadmap.map((task, index) => (
                    <div key={task.id} className={`${themeStyles.card} border-l-4 ${
                      task.priority === 'High' ? 'border-red-500' :
                      task.priority === 'Medium' ? 'border-yellow-500' : 'border-green-500'
                    } rounded-2xl p-6 shadow-lg`}>
                      <div className="flex items-start gap-4">
                        <div className={`w-10 h-10 rounded-full ${themeStyles.button} flex items-center justify-center text-white font-bold text-lg`}>
                          {index + 1}
                        </div>

                        <div className="flex-1">
                          <h3 className={`text-xl font-bold ${themeStyles.text} mb-2`}>{task.title}</h3>
                          
                          <div className="flex flex-wrap gap-3 mb-2">
                            <span className={`px-3 py-1 rounded-full text-sm font-medium text-white bg-gradient-to-r ${categories[task.category].color}`}>
                              {categories[task.category].icon} {task.category}
                            </span>
                            <span className="flex items-center gap-1">
                              <Flag className={`w-4 h-4 ${priorityColors[task.priority]}`} />
                              <span className={`text-sm font-medium ${priorityColors[task.priority]}`}>{task.priority}</span>
                            </span>
                            <span className={`flex items-center gap-1 text-sm ${themeStyles.textSecondary}`}>
                              <Clock className="w-4 h-4" />
                              Est. {getEstimatedTime(task.priority)} min
                            </span>
                            {task.time && (
                              <span className={`flex items-center gap-1 text-sm ${themeStyles.textSecondary}`}>
                                <Calendar className="w-4 h-4" />
                                Due at {task.time}
                              </span>
                            )}
                          </div>

                          {index === 0 && !task.completed && (
                            <button className="mt-3 px-6 py-2 bg-green-500 hover:bg-green-600 text-white rounded-lg font-semibold flex items-center gap-2 transition-all">
                              <PlayCircle className="w-5 h-5" />
                              Start This Task
                            </button>
                          )}
                        </div>

                        <button onClick={() => toggleComplete(task.id)} className="mt-1">
                          {task.completed ? 
                            <CheckCircle2 className="w-7 h-7 text-green-500" /> : 
                            <Circle className="w-7 h-7 text-gray-400 hover:text-purple-500" />
                          }
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {page === 'stats' && (
          <div>
            <h2 className={`text-3xl font-bold ${themeStyles.text} mb-6`}>Statistics</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
              <div className={`${themeStyles.card} border rounded-2xl p-6 shadow-lg`}>
                <h3 className={`text-xl font-bold ${themeStyles.text} mb-4`}>Task Breakdown</h3>
                <div className="space-y-3">
                  {Object.keys(categories).map(cat => {
                    const count = todos.filter(t => t.category === cat).length;
                    const percentage = stats.total > 0 ? (count / stats.total) * 100 : 0;
                    
                    return (
                      <div key={cat}>
                        <div className="flex justify-between mb-1">
                          <span className={`${themeStyles.text} font-medium`}>
                            {categories[cat].icon} {cat}
                          </span>
                          <span className={themeStyles.textSecondary}>{count} tasks</span>
                        </div>
                        <div className="h-3 bg-gray-700 rounded-full overflow-hidden">
                          <div 
                            className={`h-full bg-gradient-to-r ${categories[cat].color} transition-all duration-500`}
                            style={{ width: `${percentage}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className={`${themeStyles.card} border rounded-2xl p-6 shadow-lg`}>
                <h3 className={`text-xl font-bold ${themeStyles.text} mb-4`}>Priority Distribution</h3>
                <div className="space-y-3">
                  {['High', 'Medium', 'Low'].map(priority => {
                    const count = todos.filter(t => t.priority === priority).length;
                    const percentage = stats.total > 0 ? (count / stats.total) * 100 : 0;
                    
                    return (
                      <div key={priority}>
                        <div className="flex justify-between mb-1">
                          <span className={`${themeStyles.text} font-medium`}>
                            <Flag className={`w-4 h-4 inline ${priorityColors[priority]}`} /> {priority}
                          </span>
                          <span className={themeStyles.textSecondary}>{count} tasks</span>
                        </div>
                        <div className="h-3 bg-gray-700 rounded-full overflow-hidden">
                          <div 
                            className={`h-full ${
                              priority === 'High' ? 'bg-red-500' :
                              priority === 'Medium' ? 'bg-yellow-500' : 'bg-green-500'
                            } transition-all duration-500`}
                            style={{ width: `${percentage}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className={`${themeStyles.card} border rounded-2xl p-6 shadow-lg`}>
              <h3 className={`text-xl font-bold ${themeStyles.text} mb-4`}>Completion Rate</h3>
              <div className="text-center py-8">
                <div className={`text-6xl font-bold ${themeStyles.text} mb-2`}>
                  {stats.total > 0 ? Math.round((stats.completed / stats.total) * 100) : 0}%
                </div>
                <p className={themeStyles.textSecondary}>
                  {stats.completed} out of {stats.total} tasks completed
                </p>
                {stats.total > 0 && (
                  <div className="mt-6 h-4 bg-gray-700 rounded-full overflow-hidden max-w-md mx-auto">
                    <div 
                      className="h-full bg-gradient-to-r from-green-500 to-emerald-500 transition-all duration-1000"
                      style={{ width: `${(stats.completed / stats.total) * 100}%` }}
                    />
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {page === 'settings' && (
          <div>
            <h2 className={`text-3xl font-bold ${themeStyles.text} mb-6`}>Settings</h2>
            
            <div className="space-y-4">
              <div className={`${themeStyles.card} border rounded-2xl p-6 shadow-lg`}>
                <h3 className={`text-xl font-bold ${themeStyles.text} mb-4`}>Notifications</h3>
                <div className="flex items-center justify-between">
                  <div>
                    <p className={`${themeStyles.text} font-medium mb-1`}>Deadline Reminders</p>
                    <p className={`text-sm ${themeStyles.textSecondary}`}>Get notified 1 minute before deadline</p>
                  </div>
                  <button
                    onClick={requestNotificationPermission}
                    className={`px-4 py-2 rounded-lg ${notificationsEnabled ? 'bg-green-500' : 'bg-gray-500'} text-white font-medium hover:opacity-80 transition-all flex items-center gap-2`}
                  >
                    {notificationsEnabled ? <Bell className="w-5 h-5" /> : <BellOff className="w-5 h-5" />}
                    {notificationsEnabled ? 'Enabled' : 'Disabled'}
                  </button>
                </div>
              </div>

              <div className={`${themeStyles.card} border rounded-2xl p-6 shadow-lg`}>
                <h3 className={`text-xl font-bold ${themeStyles.text} mb-4`}>Data Management</h3>
                <div className="space-y-3">
                  <button
                    onClick={exportData}
                    className={`w-full px-6 py-3 ${themeStyles.button} text-white rounded-xl font-semibold hover:shadow-lg transition-all flex items-center justify-center gap-2`}
                  >
                    <Download className="w-5 h-5" />
                    Export Tasks (JSON)
                  </button>
                  
                  <label className={`w-full px-6 py-3 ${themeStyles.card} border ${themeStyles.text} rounded-xl font-semibold hover:shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer`}>
                    <Upload className="w-5 h-5" />
                    Import Tasks (JSON)
                    <input
                      type="file"
                      accept=".json"
                      onChange={importData}
                      className="hidden"
                    />
                  </label>
                  
                  <button
                    onClick={clearAllTasks}
                    className="w-full px-6 py-3 bg-red-500 hover:bg-red-600 text-white rounded-xl font-semibold hover:shadow-lg transition-all flex items-center justify-center gap-2"
                  >
                    <Trash2 className="w-5 h-5" />
                    Clear All Tasks
                  </button>
                </div>
              </div>

              <div className={`${themeStyles.card} border rounded-2xl p-6 shadow-lg`}>
                <h3 className={`text-xl font-bold ${themeStyles.text} mb-2`}>About TaskFlow Pro</h3>
                <p className={themeStyles.textSecondary}>
                  Version 1.0.0 • A professional task management application
                </p>
              </div>
            </div>
          </div>
        )}
      </div>

      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className={`${themeStyles.card} border rounded-2xl p-8 max-w-2xl w-full shadow-2xl`}>
            <div className="flex justify-between items-center mb-6">
              <h2 className={`text-2xl font-bold ${themeStyles.text}`}>
                {editingTask ? 'Edit Task' : 'New Task'}
              </h2>
              <button
                onClick={() => { setShowAddModal(false); setEditingTask(null); resetForm(); }}
                className={`p-2 ${themeStyles.text} hover:bg-white/10 rounded-lg transition-all`}
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className={`block ${themeStyles.text} font-medium mb-2`}>Task Title</label>
                <input
                  type="text"
                  value={formData.title}
                  onChange={(e) => setFormData({...formData, title: e.target.value})}
                  placeholder="Enter task title..."
                  className={`w-full px-4 py-3 rounded-xl border ${themeStyles.input} focus:outline-none focus:ring-2 focus:ring-purple-500`}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className={`block ${themeStyles.text} font-medium mb-2`}>Deadline Date</label>
                  <input
                    type="date"
                    value={formData.deadline}
                    onChange={(e) => setFormData({...formData, deadline: e.target.value})}
                    className={`w-full px-4 py-3 rounded-xl border ${themeStyles.input} focus:outline-none focus:ring-2 focus:ring-purple-500`}
                  />
                </div>

                <div>
                  <label className={`block ${themeStyles.text} font-medium mb-2`}>Time</label>
                  <input
                    type="time"
                    value={formData.time}
                    onChange={(e) => setFormData({...formData, time: e.target.value})}
                    className={`w-full px-4 py-3 rounded-xl border ${themeStyles.input} focus:outline-none focus:ring-2 focus:ring-purple-500`}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className={`block ${themeStyles.text} font-medium mb-2`}>Category</label>
                  <select
                    value={formData.category}
                    onChange={(e) => setFormData({...formData, category: e.target.value})}
                    className={`w-full px-4 py-3 rounded-xl border ${themeStyles.input} focus:outline-none focus:ring-2 focus:ring-purple-500`}
                  >
                    <option value="Study">📚 Study</option>
                    <option value="Work">💼 Work</option>
                    <option value="Personal">🏠 Personal</option>
                    <option value="Fitness">💪 Fitness</option>
                  </select>
                </div>

                <div>
                  <label className={`block ${themeStyles.text} font-medium mb-2`}>Priority</label>
                  <select
                    value={formData.priority}
                    onChange={(e) => setFormData({...formData, priority: e.target.value})}
                    className={`w-full px-4 py-3 rounded-xl border ${themeStyles.input} focus:outline-none focus:ring-2 focus:ring-purple-500`}
                  >
                    <option value="Low">Low</option>
                    <option value="Medium">Medium</option>
                    <option value="High">High</option>
                  </select>
                </div>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  onClick={editingTask ? updateTask : addTask}
                  className={`flex-1 px-6 py-3 ${themeStyles.button} text-white rounded-xl font-semibold hover:shadow-lg transition-all`}
                >
                  {editingTask ? 'Update Task' : 'Add Task'}
                </button>
                <button
                  onClick={() => { setShowAddModal(false); setEditingTask(null); resetForm(); }}
                  className={`px-6 py-3 ${themeStyles.card} border ${themeStyles.text} rounded-xl font-semibold hover:shadow-lg transition-all`}
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}