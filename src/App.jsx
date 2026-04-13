import React, { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  isPast, parseISO, format, differenceInHours, startOfMonth, 
  endOfMonth, startOfWeek, endOfWeek, eachDayOfInterval, isSameMonth, isSameDay,
  addMonths, subMonths, getMonth
} from 'date-fns';
import { es } from 'date-fns/locale';
import { LineChart, Line, ResponsiveContainer, XAxis, Tooltip } from 'recharts';
import { 
  LayoutDashboard, Calendar, AlertCircle, Archive, 
  Plus, Bell, User, CheckSquare, Square, Trash2, Eraser, Clock,
  ChevronLeft, ChevronRight, Sun, AlertTriangle, Pencil, CheckCircle2, Menu, X, Zap
} from 'lucide-react';

export default function App() {
  const [tasks, setTasks] = useState(() => {
    const savedTasks = localStorage.getItem('focus_flow_tasks');
    return savedTasks ? JSON.parse(savedTasks) : [];
  });

  const [activeTab, setActiveTab] = useState('tasks');
  const [calendarDate, setCalendarDate] = useState(new Date());
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isTemporary, setIsTemporary] = useState(false); // Para distinguir tareas fugaces
  
  // ESTADOS DEL FORMULARIO
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState(null);
  const [title, setTitle] = useState('');
  const [dateStr, setDateStr] = useState('');
  const [timeStr, setTimeStr] = useState('');
  const [priority, setPriority] = useState('Media');
  const [details, setDetails] = useState('');
  const [topic, setTopic] = useState('Otro');
  const [selectedDays, setSelectedDays] = useState([]);

  // ESTADOS SECUNDARIOS
  const [deletePrompt, setDeletePrompt] = useState({ isOpen: false, task: null });
  const [undoQueue, setUndoQueue] = useState(null);
  const [selectedDayTasks, setSelectedDayTasks] = useState(null); // Para el modal del calendario
  const [filterTopic, setFilterTopic] = useState('Todos'); // Filtro de categorías


  // AGREGA ESTOS DOS NUEVOS:
  const [touchStart, setTouchStart] = useState(null);
  const [touchEnd, setTouchEnd] = useState(null);

  useEffect(() => {
    localStorage.setItem('focus_flow_tasks', JSON.stringify(tasks));
  }, [tasks]);

  // ABRIR MODAL PARA EDITAR
  const openEditModal = (task) => {
    setEditingTask(task);
    setTitle(task.title);
    setDetails(task.details || '');
    setTopic(task.topic || 'Otro');
    setIsTemporary(task.isTemporary || false);
    if (task.deadline) {
      const d = new Date(task.deadline);
      setDateStr(format(d, 'yyyy-MM-dd'));
      setTimeStr(format(d, 'HH:mm'));
    } else {
      setDateStr(''); setTimeStr('');
    }
    setIsModalOpen(true);
  };

  // LIMPIAR FORMULARIO
  const resetForm = () => {
    setEditingTask(null); setTitle(''); setDateStr(''); setTimeStr(''); 
    setPriority('Media'); setDetails(''); setTopic('Otro'); setSelectedDays([]);
    setIsTemporary(false);
    setIsModalOpen(false);
  };

  const saveTask = (e) => {
    e.preventDefault();
    if (!title.trim()) return;
    
    let finalDeadline = null;
    if (dateStr) {
      const finalTime = timeStr || '23:59';
      finalDeadline = new Date(`${dateStr}T${finalTime}`);
    } else if (selectedDays.length > 0 && !editingTask) {
      alert("Debes seleccionar una 'Fecha de inicio' para crear tareas repetitivas.");
      return;
    }

    // SI ESTAMOS EDITANDO
    if (editingTask) {
      setTasks(tasks.map(t => 
        t.id === editingTask.id 
          ? { ...t, title, details, topic, priority, deadline: finalDeadline ? finalDeadline.toISOString() : null, isTemporary } 
          : t
      ));
      resetForm();
      return;
    }

    // SI ES NUEVA
    const tasksToAdd = [];
    if (selectedDays.length > 0 && finalDeadline) {
      const groupId = `group_${Date.now()}`;
      let current = new Date(finalDeadline);
      let daysChecked = 0; let added = 0;

      while (daysChecked < 60) {
        if (selectedDays.includes(current.getDay())) {
          tasksToAdd.push({
            id: Date.now() + added, groupId, title, details, topic, 
            deadline: new Date(current).toISOString(), priority, completed: false, 
            createdAt: new Date().toISOString(), completedAt: null, isTemporary
          });
          added++;
        }
        current.setDate(current.getDate() + 1); daysChecked++;
      }
    } else {
      tasksToAdd.push({
        id: Date.now(), title, details, topic, groupId: null,
        deadline: finalDeadline ? finalDeadline.toISOString() : null, priority, completed: false, 
        createdAt: new Date().toISOString(), completedAt: null, isTemporary
      });
    }
    
    setTasks([...tasksToAdd, ...tasks]);
    resetForm();
  };

  const toggleTask = (id) => {
    setTasks(tasks.map(task => {
      if (task.id === id) {
        const isNowCompleted = !task.completed;
        return { ...task, completed: isNowCompleted, completedAt: isNowCompleted ? new Date().toISOString() : null };
      }
      return task;
    }));
  };

  // SISTEMA DE BORRADO Y DESHACER
  const handleDeleteClick = (task) => {
    if (task.groupId) setDeletePrompt({ isOpen: true, task });
    else executeDelete('single', task);
  };

  const executeDelete = (type, task) => {
    let tasksToRemove = [];
    if (type === 'single') tasksToRemove = tasks.filter(t => t.id === task.id);
    else if (type === 'group') tasksToRemove = tasks.filter(t => t.groupId === task.groupId);
    
    setTasks(tasks.filter(t => !tasksToRemove.includes(t)));
    setDeletePrompt({ isOpen: false, task: null });

    // Configurar el Deshacer (10 segundos)
    if (undoQueue?.timeoutId) clearTimeout(undoQueue.timeoutId);
    const timeoutId = setTimeout(() => setUndoQueue(null), 10000);
    setUndoQueue({ tasks: tasksToRemove, timeoutId });
  };

  const undoDelete = () => {
    if (!undoQueue) return;
    clearTimeout(undoQueue.timeoutId);
    setTasks(prev => [...prev, ...undoQueue.tasks]);
    setUndoQueue(null);
  };
  
  const clearDoneAndOverdue = () => {
    setTasks(tasks.filter(task => {
      const isOverdue = task.deadline && !task.completed && isPast(parseISO(task.deadline));
      return !task.completed && !isOverdue; // Mantiene las no completadas y no vencidas
    }));
  };

  // FILTROS Y ORDENAMIENTO
  const allIncompleteTasks = useMemo(() => {
    let filtered = tasks.filter(t => !t.completed);
    if (filterTopic !== 'Todos') filtered = filtered.filter(t => t.topic === filterTopic);
    return filtered.sort((a, b) => (a.deadline && b.deadline ? new Date(a.deadline) - new Date(b.deadline) : 0));
  }, [tasks, filterTopic]);

  const todayTasks = useMemo(() => {
    const scheduledTasks = allIncompleteTasks.filter(t => t.deadline && isSameDay(parseISO(t.deadline), new Date()));
    const tempTasks = allIncompleteTasks.filter(t => t.isTemporary);
    return [...scheduledTasks, ...tempTasks];
  }, [allIncompleteTasks]);

  const completedTasks = useMemo(() => {
    return tasks.filter(t => t.completed).sort((a, b) => new Date(b.completedAt) - new Date(a.completedAt));
  }, [tasks]);

  const temporaryTasks = useMemo(() => {
    return tasks.filter(t => t.isTemporary && !t.completed);
  }, [tasks]);

  const urgentTasks = useMemo(() => {
    const scheduled = tasks.filter(t => t.deadline && !t.completed).filter(t => {
      const hoursLeft = differenceInHours(parseISO(t.deadline), new Date());
      return hoursLeft >= 0 && hoursLeft <= 48;
    }).sort((a, b) => new Date(a.deadline) - new Date(b.deadline));
    
    const temporary = tasks.filter(t => t.isTemporary && !t.completed);
    const combined = [...scheduled, ...temporary];
    
    return combined.slice(0, 4);
  }, [tasks]);

  const analyticsStats = useMemo(() => {
    const completed = tasks.filter(t => t.completed && t.createdAt && t.completedAt);
    let avgHours = 0; let chartData = [];
    if (completed.length > 0) {
      const totalHours = completed.reduce((acc, t) => acc + differenceInHours(parseISO(t.completedAt), parseISO(t.createdAt)), 0);
      avgHours = Math.max(1, Math.round(totalHours / completed.length));
      chartData = completed.map(t => ({ name: t.title.substring(0, 10) + '...', horas: differenceInHours(parseISO(t.completedAt), parseISO(t.createdAt)) || 1 })).slice(-10);
    }
    return { avgHours, chartData, totalCompleted: completed.length };
  }, [tasks]);

  const calendarDays = useMemo(() => {
    const start = startOfWeek(startOfMonth(calendarDate), { weekStartsOn: 1 });
    const end = endOfWeek(endOfMonth(calendarDate), { weekStartsOn: 1 });
    return eachDayOfInterval({ start, end });
  }, [calendarDate]);

  const renderTask = (task) => {
    const isOverdue = task.deadline && !task.completed && isPast(parseISO(task.deadline));
    const hoursLeft = task.deadline ? differenceInHours(parseISO(task.deadline), new Date()) : null;
    const isUrgent = !task.completed && !isOverdue && hoursLeft !== null && hoursLeft <= 48 && hoursLeft >= 0;

    let accentColor = task.completed ? "bg-emerald-500" : (isOverdue ? "bg-slate-700" : (isUrgent ? "bg-rose-500" : "bg-cyan-500"));
    let tagStyle = task.completed ? "bg-emerald-500/10 text-emerald-400" : (isOverdue ? "bg-slate-800/80 text-slate-500" : (isUrgent ? "bg-rose-500 text-black shadow-[0_0_10px_rgba(244,63,94,0.3)]" : "bg-cyan-500/10 text-cyan-400"));
    let tagText = task.completed ? "COMPLETADA" : (isOverdue ? "VENCIDO" : (isUrgent ? "URGENTE" : "EN CURSO"));

    return (
      <motion.div key={task.id} layout initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.9 }}
        className={`relative bg-[#16181d] rounded-xl p-4 md:p-5 flex items-center gap-3 md:gap-5 border ${isUrgent ? 'border-rose-500/30' : 'border-slate-800/50'} group transition-all`}
      >
        <div className={`absolute left-0 top-0 bottom-0 w-1 ${accentColor} rounded-l-xl`}></div>
        
        <button onClick={() => toggleTask(task.id)} className={`${task.completed ? 'text-emerald-500' : 'text-slate-500 hover:text-cyan-400'} flex-shrink-0 transition-transform active:scale-90`}>
          {task.completed ? <CheckSquare size={22} /> : <Square size={22} />}
        </button>

        <div className="flex-1 min-w-0">
          <h3 className={`text-base md:text-lg font-medium truncate ${task.completed ? 'line-through text-slate-500' : (isOverdue ? 'text-slate-500' : (isUrgent ? 'text-rose-100' : 'text-slate-100'))}`}>{task.title}</h3>
          <div className="flex items-center gap-2 mt-1 flex-wrap">
            <span className={`px-2 py-0.5 text-[9px] uppercase font-bold rounded ${tagStyle}`}>{tagText}</span>
            {task.topic && <span className="text-xs text-slate-400 font-medium">{task.topic}</span>}
            {task.details && <span className="text-xs text-slate-500 hidden sm:block truncate max-w-[200px]">• {task.details}</span>}
          </div>
        </div>
        <div className="flex items-center gap-2 md:gap-4 flex-shrink-0">
          {task.deadline && (
            <div className={`px-2 py-1 md:px-3 md:py-1.5 rounded bg-[#0b0c10] border border-slate-800 text-[10px] md:text-xs ${(isOverdue || isUrgent) && !task.completed ? (isOverdue ? 'text-slate-500' : 'text-rose-400 font-bold') : 'text-cyan-400'}`}>
              {format(parseISO(task.deadline), "dd MMM, HH:mm")}
            </div>
          )}
          {!task.completed && (
            <button onClick={() => openEditModal(task)} className="p-2 text-slate-500 hover:text-cyan-400 rounded-lg transition-colors hidden md:block"><Pencil size={16} /></button>
          )}
          <button onClick={() => handleDeleteClick(task)} className="p-2 text-slate-500 hover:bg-rose-500/20 hover:text-rose-500 rounded-lg transition-all"><Trash2 size={16} /></button>
        </div>
      </motion.div>
    );
  };

  const NavButtons = () => (
    <>
      <button onClick={() => {setActiveTab('tasks'); setIsMobileMenuOpen(false)}} className={`flex items-center gap-3 px-4 py-3 rounded-lg w-full transition-all ${activeTab === 'tasks' ? 'bg-cyan-950/30 text-cyan-400 md:border-l-2 border-cyan-400' : 'text-slate-400 hover:text-white hover:bg-white/5'}`}><LayoutDashboard size={18} /> <span className="text-sm font-medium">Todas</span></button>
      <button onClick={() => {setActiveTab('today'); setIsMobileMenuOpen(false)}} className={`flex items-center gap-3 px-4 py-3 rounded-lg w-full transition-all ${activeTab === 'today' ? 'bg-cyan-950/30 text-cyan-400 md:border-l-2 border-cyan-400' : 'text-slate-400 hover:text-white hover:bg-white/5'}`}><Sun size={18} /> <span className="text-sm font-medium">Hoy</span></button>
      <button onClick={() => {setActiveTab('temporary'); setIsMobileMenuOpen(false)}} className={`flex items-center gap-3 px-4 py-3 rounded-lg w-full transition-all ${activeTab === 'temporary' ? 'bg-purple-950/30 text-purple-400 md:border-l-2 border-purple-400' : 'text-slate-400 hover:text-white hover:bg-white/5'}`}><Zap size={18} /> <span className="text-sm font-medium">Fugaces</span></button>
      <button onClick={() => {setActiveTab('completed'); setIsMobileMenuOpen(false)}} className={`flex items-center gap-3 px-4 py-3 rounded-lg w-full transition-all ${activeTab === 'completed' ? 'bg-cyan-950/30 text-cyan-400 md:border-l-2 border-cyan-400' : 'text-slate-400 hover:text-white hover:bg-white/5'}`}><CheckCircle2 size={18} /> <span className="text-sm font-medium">Completadas</span></button>
      <button onClick={() => {setActiveTab('calendar'); setIsMobileMenuOpen(false)}} className={`flex items-center gap-3 px-4 py-3 rounded-lg w-full transition-all ${activeTab === 'calendar' ? 'bg-cyan-950/30 text-cyan-400 md:border-l-2 border-cyan-400' : 'text-slate-400 hover:text-white hover:bg-white/5'}`}><Calendar size={18} /> <span className="text-sm font-medium">Cronograma</span></button>
      <button onClick={() => {setActiveTab('priorities'); setIsMobileMenuOpen(false)}} className={`flex items-center gap-3 px-4 py-3 rounded-lg w-full transition-all ${activeTab === 'priorities' ? 'bg-cyan-950/30 text-cyan-400 md:border-l-2 border-cyan-400' : 'text-slate-400 hover:text-white hover:bg-white/5'}`}><AlertCircle size={18} /> <span className="text-sm font-medium">Prioridades</span></button>
      <button onClick={() => {setActiveTab('analytics'); setIsMobileMenuOpen(false)}} className={`flex items-center gap-3 px-4 py-3 rounded-lg w-full transition-all ${activeTab === 'analytics' ? 'bg-cyan-950/30 text-cyan-400 md:border-l-2 border-cyan-400' : 'text-slate-400 hover:text-white hover:bg-white/5'}`}><Archive size={18} /> <span className="text-sm font-medium">Analíticas</span></button>
    </>
  );
  // LÓGICA PARA DESLIZAR (SWIPE) EN MÓVILES
  const minSwipeDistance = 50; // Distancia mínima que debe recorrer el dedo
  const tabOrder = ['tasks', 'today', 'temporary', 'completed', 'calendar', 'priorities', 'analytics'];

  const onTouchStart = (e) => {
    setTouchEnd(null);
    setTouchStart(e.targetTouches[0].clientX);
  };

  const onTouchMove = (e) => {
    setTouchEnd(e.targetTouches[0].clientX);
  };

  const onTouchEnd = () => {
    if (!touchStart || !touchEnd) return;
    const distance = touchStart - touchEnd;
    const isLeftSwipe = distance > minSwipeDistance;
    const isRightSwipe = distance < -minSwipeDistance;

    if (isLeftSwipe || isRightSwipe) {
      const currentIndex = tabOrder.indexOf(activeTab);
      if (isLeftSwipe && currentIndex < tabOrder.length - 1) {
        // Deslizó hacia la izquierda -> Siguiente pestaña
        setActiveTab(tabOrder[currentIndex + 1]);
      }
      if (isRightSwipe && currentIndex > 0) {
        // Deslizó hacia la derecha -> Pestaña anterior
        setActiveTab(tabOrder[currentIndex - 1]);
      }
    }
  };

  return (
    <div className="flex h-screen bg-[#0b0c10] text-slate-300 font-sans overflow-hidden">
      
      {/* SIDEBAR (Desktop) */}
      <aside className="w-64 bg-[#121318] border-r border-slate-800/50 hidden md:flex flex-col z-20">
        <div className="p-6"><h1 className="text-xl font-bold tracking-widest text-white flex items-center gap-2">FOCUS<span className="text-cyan-400">FLOW</span></h1></div>
        <nav className="flex-1 px-4 space-y-2 mt-4"><NavButtons /></nav>
      </aside>

      {/* MENÚ MÓVIL (Fondo Oscuro) */}
      <AnimatePresence>
        {isMobileMenuOpen && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-[#0b0c10] z-50 md:hidden flex flex-col">
            <div className="p-6 flex justify-between items-center border-b border-slate-800/50">
              <h1 className="text-xl font-bold tracking-widest text-white">FOCUS<span className="text-cyan-400">FLOW</span></h1>
              <button onClick={() => setIsMobileMenuOpen(false)} className="text-slate-400 hover:text-white p-2"><X size={24} /></button>
            </div>
            <nav className="p-4 space-y-2 flex-1 overflow-y-auto"><NavButtons /></nav>
          </motion.div>
        )}
      </AnimatePresence>

      <main 
        className="flex-1 flex flex-col h-full overflow-hidden relative"
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
      >
        {/* HEADER */}
        <header className="h-16 md:h-20 border-b border-slate-800/50 flex items-center justify-between px-4 md:px-8 bg-[#0b0c10]/80 backdrop-blur-md z-10">
          <div className="flex items-center gap-3">
            <h2 className="text-cyan-400 font-bold tracking-widest uppercase text-xs md:text-sm">{activeTab === 'tasks' ? 'Directorio General' : activeTab === 'today' ? 'Foco de Hoy' : activeTab === 'temporary' ? 'Tareas Fugaces' : activeTab}</h2>
          </div>
          <div className="flex items-center gap-3 md:gap-6">
            <button onClick={() => resetForm() || setIsModalOpen(true)} className="bg-cyan-500 hover:bg-cyan-400 text-black font-bold px-3 py-1.5 md:px-4 md:py-2 rounded-lg flex items-center gap-2 text-sm transition-all shadow-[0_0_15px_rgba(34,211,238,0.3)]">
              <Plus size={18} /> <span className="hidden md:inline">Crear Tarea</span>
            </button>
            <Bell className="text-slate-400 hidden md:block" size={20} />
            <div className="w-8 h-8 rounded-full bg-slate-700 items-center justify-center text-white hidden md:flex"><User size={16} /></div>
          </div>
        </header>

        {/* ÁREA SCROLLABLE */}
        <div className="flex-1 overflow-y-auto p-4 md:p-8 pb-24 md:pb-8">
          <div className="max-w-5xl mx-auto">
            
            {/* TAREAS GENERALES */}
            {activeTab === 'tasks' && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                <div className="flex flex-col md:flex-row md:justify-between md:items-end mb-8 gap-4">
                  <div>
                    <h2 className="text-3xl md:text-4xl font-light text-white tracking-wide">Directorio <span className="text-cyan-400 font-semibold">General</span></h2>
                  </div>
                  <select value={filterTopic} onChange={(e) => setFilterTopic(e.target.value)} className="bg-[#16181d] border border-slate-700 rounded-lg p-2 text-slate-300 text-sm outline-none w-full md:w-auto">
                    <option value="Todos">Todas las categorías</option>
                    <option value="Gym💪">Gym 💪</option>
                    <option value="Estudio 📚">Estudio 📚</option>
                    <option value="Trabajo💼">Trabajo 💼</option>
                    <option value="UTNⵥ">UTN ⵥ</option>
                    <option value="Social🧉">Social 🧉</option>
                    <option value="Otro">Otro</option>
                  </select>
                </div>
                {allIncompleteTasks.length === 0 ? (
                  <p className="text-slate-500 text-center mt-10">No hay tareas pendientes en esta categoría.</p>
                ) : (
                  <div className="flex flex-col gap-3 md:gap-4"><AnimatePresence>{allIncompleteTasks.map(renderTask)}</AnimatePresence></div>
                )}
              </motion.div>
            )}

            {/* HOY */}
            {activeTab === 'today' && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                <div className="flex flex-col md:flex-row md:justify-between md:items-end mb-8 gap-4">
                  <div>
                    <h2 className="text-3xl md:text-4xl font-light text-white tracking-wide">Foco <span className="text-yellow-400 font-semibold">de Hoy</span></h2>
                    <p className="text-slate-400 text-sm mt-1">{format(new Date(), "EEEE, d 'de' MMMM", { locale: es }).toUpperCase()}</p>
                  </div>
                  <select value={filterTopic} onChange={(e) => setFilterTopic(e.target.value)} className="bg-[#16181d] border border-slate-700 rounded-lg p-2 text-slate-300 text-sm outline-none w-full md:w-auto">
                    <option value="Todos">Todas las categorías</option>
                    <option value="Gym💪">Gym 💪</option>
                    <option value="Estudio 📚">Estudio 📚</option>
                    <option value="Trabajo💼">Trabajo 💼</option>
                    <option value="UTNⵥ">UTN ⵥ</option>
                    <option value="Social🧉">Social 🧉</option>
                    <option value="Otro">Otro</option>
                  </select>
                </div>
                {todayTasks.length === 0 ? (
                  <div className="text-center text-slate-500 mt-10 border border-slate-800/50 rounded-2xl p-10 bg-[#16181d]/50">
                    <Sun size={48} className="mx-auto mb-4 opacity-20" />
                    <p>Día despejado. No hay tareas pendientes para hoy en esta categoría.</p>
                  </div>
                ) : (
                  <div className="flex flex-col gap-3 md:gap-4"><AnimatePresence>{todayTasks.map(renderTask)}</AnimatePresence></div>
                )}
              </motion.div>
            )}

            {/* TAREAS FUGACES */}
            {activeTab === 'temporary' && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                <div className="flex flex-col md:flex-row md:justify-between md:items-end mb-8 gap-4">
                  <div>
                    <h2 className="text-3xl md:text-4xl font-light text-white tracking-wide">Tareas <span className="text-purple-400 font-semibold">Fugaces</span></h2>
                    <p className="text-slate-400 text-sm mt-1">Sin fecha ni hora, crea y gestiona libremente</p>
                  </div>
                </div>
                {temporaryTasks.length === 0 ? (
                  <div className="text-center text-slate-500 mt-10 border border-slate-800/50 rounded-2xl p-10 bg-[#16181d]/50">
                    <Zap size={48} className="mx-auto mb-4 opacity-20" />
                    <p>No tienes tareas fugaces. ¡Crea una rápidamente!</p>
                  </div>
                ) : (
                  <div className="flex flex-col gap-3 md:gap-4"><AnimatePresence>{temporaryTasks.map(renderTask)}</AnimatePresence></div>
                )}
              </motion.div>
            )}

            {/* COMPLETADAS */}
            {activeTab === 'completed' && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                <div className="flex flex-col md:flex-row md:justify-between md:items-end mb-8 gap-4">
                  <div>
                    <h2 className="text-3xl md:text-4xl font-light text-white tracking-wide">Operaciones <span className="text-emerald-400 font-semibold">Completadas</span></h2>
                  </div>
                  <button onClick={clearDoneAndOverdue} className="flex items-center justify-center gap-2 px-4 py-2 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 rounded-lg text-xs font-bold transition-all w-full md:w-auto">
                    <Eraser size={14} /> PURGAR TERMINADAS Y VENCIDAS
                  </button>
                </div>
                {completedTasks.length === 0 ? (
                  <p className="text-slate-500 text-center mt-10">Aún no has completado ninguna tarea.</p>
                ) : (
                  <div className="flex flex-col gap-3 md:gap-4"><AnimatePresence>{completedTasks.map(renderTask)}</AnimatePresence></div>
                )}
              </motion.div>
            )}

            {/* PRIORIDADES, ANALÍTICAS Y CALENDARIO */}
            {activeTab === 'priorities' && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                <h2 className="text-3xl md:text-4xl font-light text-white tracking-wide mb-8">Máxima <span className="text-rose-400 font-semibold">Alerta</span></h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
                  {urgentTasks.length === 0 ? <p className="text-emerald-400 text-sm bg-emerald-500/10 p-4 rounded-xl border border-emerald-500/20 col-span-2">¡Todo bajo control!</p> : urgentTasks.map((task) => (
                    <div key={task.id} className="bg-rose-500/5 border border-rose-500/30 rounded-xl p-6 relative overflow-hidden">
                      <div className="absolute top-0 right-0 bg-rose-500 text-black text-[10px] font-bold px-3 py-1 rounded-bl-xl">URGENTE</div>
                      <h3 className="text-xl font-medium text-white mb-2 mt-4 truncate">{task.title}</h3>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-slate-300 font-medium">{task.topic}</span>
                        <span className="flex items-center gap-1 text-rose-400 font-medium"><Clock size={16} /> {differenceInHours(parseISO(task.deadline), new Date())} hs</span>
                      </div>
                    </div>
                  ))}
                </div>
              </motion.div>
            )}

            {activeTab === 'analytics' && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                <h2 className="text-3xl md:text-4xl font-light text-white tracking-wide mb-8">Rendimiento <span className="text-cyan-400 font-semibold">Personal</span></h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6 mb-8">
                  <div className="bg-[#16181d] border border-slate-800/50 rounded-xl p-6 md:p-8"><h4 className="text-[10px] uppercase font-bold tracking-widest text-slate-500 mb-2">Promedio Resolución</h4><div className="text-4xl md:text-5xl font-light text-cyan-400">{analyticsStats.avgHours} <span className="text-base md:text-lg text-slate-500">hs</span></div></div>
                  <div className="bg-[#16181d] border border-slate-800/50 rounded-xl p-6 md:p-8"><h4 className="text-[10px] uppercase font-bold tracking-widest text-slate-500 mb-2">Tareas Finalizadas</h4><div className="text-4xl md:text-5xl font-light text-emerald-400">{analyticsStats.totalCompleted}</div></div>
                </div>
              </motion.div>
            )}

            {activeTab === 'calendar' && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                <div className="flex flex-col md:flex-row md:justify-between md:items-end mb-8 gap-4">
                  <h2 className="text-3xl md:text-4xl font-light text-white tracking-wide">Cronograma <span className="text-cyan-400 font-semibold">Operativo</span></h2>
                  <div className="flex items-center gap-4 bg-[#16181d] border border-slate-800 rounded-lg p-2 w-full md:w-auto justify-center">
                    <button onClick={() => getMonth(calendarDate) > 0 && setCalendarDate(subMonths(calendarDate, 1))} className="p-1 text-slate-400 hover:text-white transition-colors"><ChevronLeft size={20} /></button>
                    <div className="w-32 text-center text-sm font-bold text-cyan-400 tracking-wider">{format(calendarDate, 'MMMM yyyy', { locale: es }).toUpperCase()}</div>
                    <button onClick={() => getMonth(calendarDate) < 11 && setCalendarDate(addMonths(calendarDate, 1))} className="p-1 text-slate-400 hover:text-white transition-colors"><ChevronRight size={20} /></button>
                  </div>
                </div>
                <div className="grid grid-cols-7 gap-1 md:gap-2 mb-2">
                  {['Lu', 'Ma', 'Mi', 'Ju', 'Vi', 'Sa', 'Do'].map(day => <div key={day} className="text-center text-[10px] font-bold text-slate-500 uppercase">{day}</div>)}
                </div>
                <div className="grid grid-cols-7 gap-1 md:gap-2">
                  {calendarDays.map((day, idx) => {
                    const isCurrentMonth = isSameMonth(day, calendarDate);
                    const isToday = isSameDay(day, new Date());
                    const dayTasks = tasks.filter(t => t.deadline && isSameDay(parseISO(t.deadline), day));

                    return (
                      <div key={idx} onClick={() => dayTasks.length > 0 && setSelectedDayTasks({ day, tasks: dayTasks })} className={`h-16 md:h-24 p-1 md:p-2 rounded-lg border transition-all overflow-hidden cursor-pointer ${isCurrentMonth ? 'bg-[#16181d] border-slate-800' : 'bg-[#0b0c10] border-transparent opacity-30'} ${isToday ? 'border-cyan-500/50 shadow-[0_0_15px_rgba(34,211,238,0.1)]' : ''} ${dayTasks.length > 0 ? 'hover:bg-slate-800' : ''}`}>
                        <div className={`text-[10px] md:text-xs font-bold mb-1 ${isToday ? 'text-cyan-400' : 'text-slate-400'}`}>{format(day, 'd')}</div>
                        <div className="flex flex-col gap-1 mt-1">
                          {dayTasks.slice(0, 2).map(t => (
                            <div key={t.id} className={`text-[8px] md:text-[9px] truncate px-1 py-0.5 rounded ${t.completed ? 'bg-emerald-500/20 text-emerald-400' : 'bg-cyan-500/20 text-cyan-300'}`}>
                              {(t.topic && t.topic !== 'Otro') ? t.topic.slice(-2) : ''} {t.title}
                            </div>
                          ))}
                          {dayTasks.length > 2 && <div className="text-[8px] md:text-[9px] text-slate-500 pl-1">+{dayTasks.length - 2}</div>}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </motion.div>
            )}
          </div>
        </div>

        {/* BOTTOM NAV BAR (MÓVIL) */}
        <div className="md:hidden fixed bottom-0 left-0 right-0 bg-[#0b0c10]/95 backdrop-blur-md border-t border-slate-800/50 flex justify-around items-center p-2 z-40 pb-safe">
          <button onClick={() => setActiveTab('tasks')} className={`p-3 rounded-xl transition-colors ${activeTab === 'tasks' ? 'text-cyan-400 bg-cyan-950/30' : 'text-slate-500 hover:text-slate-300'}`}><LayoutDashboard size={22} /></button>
          <button onClick={() => setActiveTab('today')} className={`p-3 rounded-xl transition-colors ${activeTab === 'today' ? 'text-cyan-400 bg-cyan-950/30' : 'text-slate-500 hover:text-slate-300'}`}><Sun size={22} /></button>
          <button onClick={() => setActiveTab('temporary')} className={`p-3 rounded-xl transition-colors ${activeTab === 'temporary' ? 'text-purple-400 bg-purple-950/30' : 'text-slate-500 hover:text-slate-300'}`}><Zap size={22} /></button>
          <button onClick={() => setActiveTab('completed')} className={`p-3 rounded-xl transition-colors ${activeTab === 'completed' ? 'text-cyan-400 bg-cyan-950/30' : 'text-slate-500 hover:text-slate-300'}`}><CheckCircle2 size={22} /></button>
          <button onClick={() => setIsMobileMenuOpen(true)} className="p-3 rounded-xl text-slate-500 hover:text-slate-300 transition-colors"><Menu size={22} /></button>
        </div>

        {/* NOTIFICACIÓN FLOTANTE (DESHACER) */}
        <AnimatePresence>
          {undoQueue && (
            <motion.div initial={{ opacity: 0, y: 50 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.8 }} className="fixed bottom-20 md:bottom-8 right-4 md:right-8 bg-[#16181d] border border-slate-700 shadow-2xl p-4 rounded-xl flex items-center gap-4 z-50">
              <span className="text-sm text-slate-300">Tarea(s) eliminada(s)</span>
              <button onClick={undoDelete} className="bg-slate-800 hover:bg-slate-700 text-cyan-400 font-bold px-3 py-1.5 rounded-lg text-xs transition-colors">Deshacer</button>
            </motion.div>
          )}
        </AnimatePresence>

      </main>

      {/* MODAL: VER TAREAS DEL DÍA (CALENDARIO) */}
      <AnimatePresence>
        {selectedDayTasks && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
            <motion.div initial={{ scale: 0.9 }} animate={{ scale: 1 }} className="bg-[#16181d] border border-slate-700 rounded-2xl p-6 w-full max-w-lg shadow-2xl max-h-[80vh] flex flex-col">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl md:text-2xl font-bold text-white tracking-wide">{format(selectedDayTasks.day, "EEEE, d 'de' MMMM", { locale: es }).toUpperCase()}</h2>
                <button onClick={() => setSelectedDayTasks(null)} className="text-slate-500 hover:text-white"><X size={24} /></button>
              </div>
              <div className="flex-1 overflow-y-auto pr-2 flex flex-col gap-3">
                {selectedDayTasks.tasks.map(renderTask)}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* MODAL: ELIMINAR RECURRENTE */}
      <AnimatePresence>
        {deletePrompt.isOpen && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
            <motion.div initial={{ scale: 0.9 }} animate={{ scale: 1 }} className="bg-[#16181d] border border-slate-700 rounded-2xl p-6 md:p-8 w-full max-w-md shadow-2xl flex flex-col items-center text-center">
              <div className="bg-rose-500/20 p-4 rounded-full text-rose-500 mb-4"><AlertTriangle size={32} /></div>
              <h2 className="text-xl font-bold text-white mb-2">Eliminar Tarea Recurrente</h2>
              <p className="text-slate-400 text-sm mb-8">Esta tarea forma parte de una repetición. ¿Deseas borrar solo esta o todas las repeticiones futuras?</p>
              <div className="flex flex-col gap-3 w-full">
                <button onClick={() => executeDelete('single', deletePrompt.task)} className="bg-[#0b0c10] border border-slate-700 hover:border-cyan-500 text-white font-medium py-3 px-4 rounded-xl transition-colors">Borrar Solo Esta</button>
                <button onClick={() => executeDelete('group', deletePrompt.task)} className="bg-rose-500 hover:bg-rose-400 text-black font-bold py-3 px-4 rounded-xl transition-colors shadow-lg shadow-rose-500/20">Borrar Toda la Serie</button>
                <button onClick={() => setDeletePrompt({ isOpen: false, task: null })} className="text-slate-500 hover:text-white font-medium py-2 mt-2 transition-colors">Cancelar</button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* MODAL: CREAR/EDITAR TAREA */}
      <AnimatePresence>
        {isModalOpen && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
            <motion.div initial={{ scale: 0.9 }} animate={{ scale: 1 }} className="bg-[#16181d] border border-slate-700 rounded-2xl p-6 md:p-8 w-full max-w-md shadow-2xl max-h-[90vh] overflow-y-auto">
              <h2 className="text-2xl font-bold text-white mb-6">{editingTask ? 'Editar Tarea' : 'Nueva Tarea'}</h2>
              <form onSubmit={saveTask} className="flex flex-col gap-4">
                <input type="text" placeholder="Título" value={title} onChange={(e) => setTitle(e.target.value)} autoFocus className="bg-[#0b0c10] border border-slate-700 rounded-xl p-3 md:p-4 text-white focus:border-cyan-500 transition-all outline-none" required />
                
                <div className="flex items-center gap-2 p-3 bg-purple-500/10 border border-purple-500/30 rounded-xl">
                  <input type="checkbox" id="tempCheck" checked={isTemporary} onChange={(e) => setIsTemporary(e.target.checked)} className="w-4 h-4 cursor-pointer" />
                  <label htmlFor="tempCheck" className="text-sm text-purple-300 cursor-pointer font-medium">Tarea fugaz (sin fecha)</label>
                </div>
                
                <div className="flex flex-col sm:flex-row gap-4">
                  <div className="flex-1">
                    <label className="text-[10px] text-slate-500 uppercase tracking-widest ml-1 mb-1 block">Detalles (Opcional)</label>
                    <input type="text" value={details} onChange={(e) => setDetails(e.target.value)} className="w-full bg-[#0b0c10] border border-slate-700 rounded-xl p-3 text-white text-sm outline-none focus:border-cyan-500 transition-colors" />
                  </div>
                  <div className="flex-1">
                    <label className="text-[10px] text-slate-500 uppercase tracking-widest ml-1 mb-1 block">Tópico</label>
                    <select value={topic} onChange={(e) => setTopic(e.target.value)} className="w-full bg-[#0b0c10] border border-slate-700 rounded-xl p-3 text-slate-300 text-sm outline-none appearance-none cursor-pointer focus:border-cyan-500 transition-colors">
                      <option value="Gym💪">Gym 💪</option><option value="Estudio 📚">Estudio 📚</option><option value="Trabajo💼">Trabajo 💼</option>
                      <option value="UTNⵥ">UTN ⵥ</option><option value="Social🧉">Social 🧉</option><option value="Otro">Otro</option>
                    </select>
                  </div>
                </div>

                {!editingTask && !isTemporary && (
                  <div>
                    <label className="text-[10px] text-slate-500 uppercase tracking-widest ml-1 mb-1 block">Se repite los días (Opcional)</label>
                    <div className="flex gap-1 justify-between">
                      {[{id:1,l:'Lu'},{id:2,l:'Ma'},{id:3,l:'Mi'},{id:4,l:'Ju'},{id:5,l:'Vi'},{id:6,l:'Sa'},{id:0,l:'Do'}].map(day => (
                        <button key={day.id} type="button" onClick={() => setSelectedDays(prev => prev.includes(day.id) ? prev.filter(d => d !== day.id) : [...prev, day.id])}
                          className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all ${selectedDays.includes(day.id) ? 'bg-cyan-500 text-black' : 'bg-[#0b0c10] text-slate-400 border border-slate-700'}`}
                        >
                          {day.l}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {!isTemporary && (
                  <div className="flex gap-4">
                    <div className="flex-1">
                      <label className="text-[10px] text-slate-500 uppercase tracking-widest ml-1 mb-1 block">{selectedDays.length > 0 && !editingTask ? 'Fecha de inicio' : 'Fecha límite'}</label>
                      <input type="date" value={dateStr} onChange={(e) => setDateStr(e.target.value)} className="w-full bg-[#0b0c10] border border-slate-700 rounded-xl p-3 text-slate-300 text-sm outline-none focus:border-cyan-500 transition-colors" style={{ colorScheme: 'dark' }} required={selectedDays.length > 0 && !editingTask} />
                    </div>
                    <div className="flex-1">
                      <label className="text-[10px] text-slate-500 uppercase tracking-widest ml-1 mb-1 block">Hora (Opcional)</label>
                      <input type="time" value={timeStr} onChange={(e) => setTimeStr(e.target.value)} className="w-full bg-[#0b0c10] border border-slate-700 rounded-xl p-3 text-slate-300 text-sm outline-none focus:border-cyan-500 transition-colors" style={{ colorScheme: 'dark' }} />
                    </div>
                  </div>
                )}
                
                <div className="flex gap-4 mt-4">
                  <button type="button" onClick={resetForm} className="flex-1 text-slate-500 font-bold uppercase text-xs tracking-widest hover:text-white transition-colors">Cancelar</button>
                  <button type="submit" className="flex-2 bg-cyan-500 hover:bg-cyan-400 text-black font-black py-4 px-6 rounded-xl transition-all shadow-lg shadow-cyan-500/20">{editingTask ? 'GUARDAR CAMBIOS' : 'AÑADIR'}</button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}