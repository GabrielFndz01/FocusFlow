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
  ChevronLeft, ChevronRight, Sun, AlertTriangle
} from 'lucide-react';

export default function App() {
  const [tasks, setTasks] = useState(() => {
    const savedTasks = localStorage.getItem('focus_flow_tasks');
    return savedTasks ? JSON.parse(savedTasks) : [
      { id: 1, title: 'Bienvenido a Focus Flow', details: 'Tutorial', topic: 'Otro', deadline: new Date().toISOString(), priority: 'Baja', completed: false, createdAt: new Date().toISOString(), completedAt: null }
    ];
  });

  const [activeTab, setActiveTab] = useState('tasks');
  const [calendarDate, setCalendarDate] = useState(new Date());
  
  // ESTADOS DEL FORMULARIO
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [dateStr, setDateStr] = useState('');
  const [timeStr, setTimeStr] = useState('');
  const [priority, setPriority] = useState('Media');
  const [details, setDetails] = useState('');
  const [topic, setTopic] = useState('Otro');
  const [selectedDays, setSelectedDays] = useState([]); // Array para guardar los días elegidos [1,2,3...]

  // ESTADO PARA EL MODAL DE BORRADO
  const [deletePrompt, setDeletePrompt] = useState({ isOpen: false, task: null });

  useEffect(() => {
    localStorage.setItem('focus_flow_tasks', JSON.stringify(tasks));
  }, [tasks]);

  const addTask = (e) => {
    e.preventDefault();
    if (!title.trim()) return;
    
    let finalDeadline = null;
    if (dateStr) {
      const finalTime = timeStr || '23:59';
      finalDeadline = new Date(`${dateStr}T${finalTime}`);
    } else if (selectedDays.length > 0) {
      alert("Debes seleccionar una 'Fecha de inicio' para crear tareas repetitivas.");
      return;
    }

    const tasksToAdd = [];

    // LÓGICA DE REPETICIÓN PERSONALIZADA
    if (selectedDays.length > 0 && finalDeadline) {
      const groupId = `group_${Date.now()}`; // Identificador único para el grupo de tareas
      let current = new Date(finalDeadline);
      let daysChecked = 0;
      let added = 0;

      // Genera tareas basándose en los días seleccionados para los próximos 60 días
      while (daysChecked < 60) {
        if (selectedDays.includes(current.getDay())) {
          tasksToAdd.push({
            id: Date.now() + added,
            groupId, // Vinculamos la tarea a su grupo
            title, details, topic, 
            deadline: new Date(current).toISOString(), 
            priority, completed: false, 
            createdAt: new Date().toISOString(), completedAt: null
          });
          added++;
        }
        current.setDate(current.getDate() + 1);
        daysChecked++;
      }
    } else {
      // Tarea única
      tasksToAdd.push({
        id: Date.now(), title, details, topic, groupId: null,
        deadline: finalDeadline ? finalDeadline.toISOString() : null, 
        priority, completed: false, 
        createdAt: new Date().toISOString(), completedAt: null
      });
    }
    
    setTasks([...tasksToAdd, ...tasks]);
    setTitle(''); setDateStr(''); setTimeStr(''); setPriority('Media'); setDetails(''); setTopic('Otro'); setSelectedDays([]);
    setIsModalOpen(false);
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

  // MANEJADOR DE BORRADO INTELIGENTE
  const handleDeleteClick = (task) => {
    if (task.groupId) {
      // Si la tarea pertenece a un grupo, abrimos la pregunta
      setDeletePrompt({ isOpen: true, task });
    } else {
      // Si es única, la borramos directo
      deleteTask(task.id);
    }
  };

  const confirmDelete = (type) => {
    if (type === 'single') {
      setTasks(tasks.filter(t => t.id !== deletePrompt.task.id));
    } else if (type === 'group') {
      setTasks(tasks.filter(t => t.groupId !== deletePrompt.task.groupId));
    }
    setDeletePrompt({ isOpen: false, task: null });
  };

  const deleteTask = (id) => setTasks(tasks.filter(task => task.id !== id));
  
  const clearDoneAndOverdue = () => {
    setTasks(tasks.filter(task => {
      const isOverdue = task.deadline && !task.completed && isPast(parseISO(task.deadline));
      return !task.completed && !isOverdue;
    }));
  };

  const sortedTasks = useMemo(() => {
    return [...tasks].sort((a, b) => {
      if (a.completed !== b.completed) return a.completed ? 1 : -1;
      if (a.deadline && b.deadline) return new Date(a.deadline) - new Date(b.deadline);
      return 0;
    });
  }, [tasks]);

  const todayTasks = useMemo(() => {
    return sortedTasks.filter(t => t.deadline && isSameDay(parseISO(t.deadline), new Date()));
  }, [sortedTasks]);

  const urgentTasks = useMemo(() => {
    return tasks
      .filter(t => t.deadline && !t.completed)
      .filter(t => {
        const hoursLeft = differenceInHours(parseISO(t.deadline), new Date());
        return hoursLeft >= 0 && hoursLeft <= 48;
      })
      .sort((a, b) => new Date(a.deadline) - new Date(b.deadline))
      .slice(0, 4);
  }, [tasks]);

  const analyticsStats = useMemo(() => {
    const completedTasks = tasks.filter(t => t.completed && t.createdAt && t.completedAt);
    let avgHours = 0;
    let chartData = [];

    if (completedTasks.length > 0) {
      const totalHours = completedTasks.reduce((acc, t) => acc + differenceInHours(parseISO(t.completedAt), parseISO(t.createdAt)), 0);
      avgHours = Math.max(1, Math.round(totalHours / completedTasks.length));
      chartData = completedTasks.map(t => ({
        name: t.title.substring(0, 10) + '...',
        horas: differenceInHours(parseISO(t.completedAt), parseISO(t.createdAt)) || 1
      })).slice(-10);
    }
    return { avgHours, chartData, totalCompleted: completedTasks.length };
  }, [tasks]);

  const calendarDays = useMemo(() => {
    const start = startOfWeek(startOfMonth(calendarDate), { weekStartsOn: 1 });
    const end = endOfWeek(endOfMonth(calendarDate), { weekStartsOn: 1 });
    return eachDayOfInterval({ start, end });
  }, [calendarDate]);

  const prevMonth = () => { if (getMonth(calendarDate) > 0) setCalendarDate(subMonths(calendarDate, 1)); };
  const nextMonth = () => { if (getMonth(calendarDate) < 11) setCalendarDate(addMonths(calendarDate, 1)); };

  const renderTask = (task) => {
    const isOverdue = task.deadline && !task.completed && isPast(parseISO(task.deadline));
    const hoursLeft = task.deadline ? differenceInHours(parseISO(task.deadline), new Date()) : null;
    const isUrgent = !task.completed && !isOverdue && hoursLeft !== null && hoursLeft <= 48 && hoursLeft >= 0;

    const isDimmed = task.completed || isOverdue;

    let accentColor = task.completed ? "bg-emerald-500" : (isOverdue ? "bg-slate-700" : (isUrgent ? "bg-rose-500" : "bg-cyan-500"));
    let tagStyle = task.completed ? "bg-emerald-500/10 text-emerald-400" : (isOverdue ? "bg-slate-800/80 text-slate-500" : (isUrgent ? "bg-rose-500 text-black shadow-[0_0_10px_rgba(244,63,94,0.3)]" : "bg-cyan-500/10 text-cyan-400"));
    let tagText = task.completed ? "LISTO" : (isOverdue ? "VENCIDO" : (isUrgent ? "URGENTE" : "EN CURSO"));

    return (
      <motion.div key={task.id} layout initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, scale: 0.9 }}
        className={`relative bg-[#16181d] rounded-xl p-5 flex items-center gap-5 border ${isUrgent ? 'border-rose-500/30' : 'border-slate-800/50'} group transition-all ${isDimmed ? 'opacity-50 grayscale' : ''}`}
      >
        <div className={`absolute left-0 top-0 bottom-0 w-1 ${accentColor} rounded-l-xl`}></div>
        
        <button 
          onClick={() => toggleTask(task.id)} 
          disabled={isOverdue} 
          className={`${task.completed ? 'text-emerald-500' : 'text-slate-500 hover:text-cyan-400'} disabled:opacity-30 disabled:cursor-not-allowed`}
        >
          {task.completed ? <CheckSquare size={22} /> : <Square size={22} />}
        </button>

        <div className="flex-1">
          <h3 className={`text-lg font-medium ${task.completed ? 'line-through text-slate-500' : (isOverdue ? 'text-slate-500' : (isUrgent ? 'text-rose-100' : 'text-slate-100'))}`}>{task.title}</h3>
          <div className="flex items-center gap-3 mt-1.5">
            <span className={`px-2 py-0.5 text-[9px] uppercase font-bold rounded ${tagStyle}`}>{tagText}</span>
            {task.topic && <span className="text-xs text-slate-400 font-medium">{task.topic}</span>}
            {task.details && <span className="text-xs text-slate-500 hidden sm:block">• {task.details}</span>}
          </div>
        </div>
        <div className="flex items-center gap-4">
          {task.deadline && (
            <div className={`px-3 py-1.5 rounded bg-[#0b0c10] border border-slate-800 text-xs ${(isOverdue || isUrgent) && !task.completed ? (isOverdue ? 'text-slate-500' : 'text-rose-400 font-bold') : 'text-cyan-400'}`}>
              {format(parseISO(task.deadline), "dd MMM, HH:mm")}
            </div>
          )}
          <button onClick={() => handleDeleteClick(task)} className="opacity-0 group-hover:opacity-100 p-2 hover:bg-rose-500/20 text-rose-500 rounded-lg transition-all"><Trash2 size={18} /></button>
        </div>
      </motion.div>
    );
  };

  const diasSemana = [
    { id: 1, label: 'Lu' }, { id: 2, label: 'Ma' }, { id: 3, label: 'Mi' },
    { id: 4, label: 'Ju' }, { id: 5, label: 'Vi' }, { id: 6, label: 'Sa' }, { id: 0, label: 'Do' }
  ];

  return (
    <div className="flex h-screen bg-[#0b0c10] text-slate-300 font-sans overflow-hidden">
      
      <aside className="w-64 bg-[#121318] border-r border-slate-800/50 flex flex-col hidden md:flex">
        <div className="p-6">
          <button onClick={() => setActiveTab('tasks')} className="text-xl font-bold tracking-widest text-white flex items-center gap-2 hover:opacity-80 transition-opacity">
            FOCUS<span className="text-cyan-400">FLOW</span>
          </button>
        </div>
        
        <nav className="flex-1 px-4 space-y-2 mt-4">
          <button onClick={() => setActiveTab('tasks')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all ${activeTab === 'tasks' ? 'bg-cyan-950/30 text-cyan-400 border-l-2 border-cyan-400' : 'text-slate-400 hover:text-white hover:bg-white/5'}`}>
            <LayoutDashboard size={18} /> <span className="text-sm font-medium">Todas</span>
          </button>
          <button onClick={() => setActiveTab('today')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all ${activeTab === 'today' ? 'bg-cyan-950/30 text-cyan-400 border-l-2 border-cyan-400' : 'text-slate-400 hover:text-white hover:bg-white/5'}`}>
            <Sun size={18} /> <span className="text-sm font-medium">Hoy</span>
          </button>
          <button onClick={() => setActiveTab('calendar')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all ${activeTab === 'calendar' ? 'bg-cyan-950/30 text-cyan-400 border-l-2 border-cyan-400' : 'text-slate-400 hover:text-white hover:bg-white/5'}`}>
            <Calendar size={18} /> <span className="text-sm font-medium">Cronograma</span>
          </button>
          <button onClick={() => setActiveTab('priorities')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all ${activeTab === 'priorities' ? 'bg-cyan-950/30 text-cyan-400 border-l-2 border-cyan-400' : 'text-slate-400 hover:text-white hover:bg-white/5'}`}>
            <AlertCircle size={18} /> <span className="text-sm font-medium">Prioridades</span>
          </button>
          <button onClick={() => setActiveTab('analytics')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all ${activeTab === 'analytics' ? 'bg-cyan-950/30 text-cyan-400 border-l-2 border-cyan-400' : 'text-slate-400 hover:text-white hover:bg-white/5'}`}>
            <Archive size={18} /> <span className="text-sm font-medium">Analíticas</span>
          </button>
        </nav>

        <div className="p-6">
          <button onClick={clearDoneAndOverdue} className="flex items-center justify-center gap-2 w-full py-3 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 rounded-xl text-xs font-bold transition-all">
            <Eraser size={14} /> PURGAR TERMINADAS
          </button>
        </div>
      </aside>

      <main className="flex-1 flex flex-col h-full overflow-hidden">
        <header className="h-20 border-b border-slate-800/50 flex items-center justify-between px-8 bg-[#0b0c10]/80 backdrop-blur-md z-10">
          <div className="flex gap-6 text-sm font-medium">
            <span className="text-cyan-400 font-bold tracking-widest uppercase">
              {activeTab === 'tasks' ? 'Directorio General' : activeTab === 'today' ? 'Foco de Hoy' : activeTab}
            </span>
          </div>
          <div className="flex items-center gap-6">
            <button onClick={() => setIsModalOpen(true)} className="bg-cyan-500 hover:bg-cyan-400 text-black font-bold px-4 py-2 rounded-lg flex items-center gap-2 text-sm transition-all shadow-[0_0_15px_rgba(34,211,238,0.3)]">
              <Plus size={18} /> Crear Tarea
            </button>
            <Bell className="text-slate-400" size={20} />
            <div className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center text-white"><User size={16} /></div>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-8">
          <div className="max-w-5xl mx-auto">
            
            {activeTab === 'tasks' && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                <div className="mb-10">
                  <h2 className="text-4xl font-light text-white tracking-wide">Directorio <span className="text-cyan-400 font-semibold">General</span></h2>
                </div>
                <div className="flex flex-col gap-4">
                  <AnimatePresence>
                    {sortedTasks.map(renderTask)}
                  </AnimatePresence>
                </div>
              </motion.div>
            )}

            {activeTab === 'today' && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                <div className="mb-10">
                  <h2 className="text-4xl font-light text-white tracking-wide">Foco <span className="text-yellow-400 font-semibold">de Hoy</span></h2>
                  <p className="text-slate-400 text-sm mt-2">{format(new Date(), "EEEE, d 'de' MMMM", { locale: es }).toUpperCase()}</p>
                </div>
                {todayTasks.length === 0 ? (
                  <div className="text-center text-slate-500 mt-20 border border-slate-800/50 rounded-2xl p-10 bg-[#16181d]/50">
                    <Sun size={48} className="mx-auto mb-4 opacity-20" />
                    <p>Día despejado. No tienes directivas programadas para hoy.</p>
                  </div>
                ) : (
                  <div className="flex flex-col gap-4">
                    <AnimatePresence>
                      {todayTasks.map(renderTask)}
                    </AnimatePresence>
                  </div>
                )}
              </motion.div>
            )}

            {activeTab === 'priorities' && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                <div className="mb-10">
                  <h2 className="text-4xl font-light text-white tracking-wide">Máxima <span className="text-rose-400 font-semibold">Alerta</span></h2>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {urgentTasks.length === 0 ? (
                    <p className="text-emerald-400 text-sm bg-emerald-500/10 p-4 rounded-xl border border-emerald-500/20">¡Todo bajo control!</p>
                  ) : (
                    urgentTasks.map((task) => (
                      <div key={task.id} className="bg-rose-500/5 border border-rose-500/30 rounded-xl p-6 relative overflow-hidden">
                        <div className="absolute top-0 right-0 bg-rose-500 text-black text-[10px] font-bold px-3 py-1 rounded-bl-xl">URGENTE</div>
                        <h3 className="text-xl font-medium text-white mb-2 mt-4">{task.title}</h3>
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-slate-300 font-medium">{task.topic}</span>
                          <span className="flex items-center gap-1 text-rose-400 font-medium"><Clock size={16} /> Vence en: {differenceInHours(parseISO(task.deadline), new Date())} hs</span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </motion.div>
            )}

            {activeTab === 'analytics' && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                <div className="mb-10">
                  <h2 className="text-4xl font-light text-white tracking-wide">Rendimiento <span className="text-cyan-400 font-semibold">Personal</span></h2>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                  <div className="bg-[#16181d] border border-slate-800/50 rounded-xl p-8">
                    <h4 className="text-[10px] uppercase font-bold tracking-widest text-slate-500 mb-2">Promedio de Resolución</h4>
                    <div className="text-5xl font-light text-cyan-400">{analyticsStats.avgHours} <span className="text-lg text-slate-500">horas</span></div>
                  </div>
                  <div className="bg-[#16181d] border border-slate-800/50 rounded-xl p-8">
                    <h4 className="text-[10px] uppercase font-bold tracking-widest text-slate-500 mb-2">Tareas Finalizadas</h4>
                    <div className="text-5xl font-light text-emerald-400">{analyticsStats.totalCompleted}</div>
                  </div>
                </div>
              </motion.div>
            )}

            {activeTab === 'calendar' && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                <div className="mb-10 flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
                  <div>
                    <h2 className="text-4xl font-light text-white tracking-wide">Cronograma <span className="text-cyan-400 font-semibold">Operativo</span></h2>
                  </div>
                  <div className="flex items-center gap-4 bg-[#16181d] border border-slate-800 rounded-lg p-2">
                    <button onClick={prevMonth} disabled={getMonth(calendarDate) === 0} className="p-1 text-slate-400 hover:text-white disabled:opacity-30 disabled:hover:text-slate-400 transition-colors"><ChevronLeft size={20} /></button>
                    <div className="w-32 text-center text-sm font-bold text-cyan-400 tracking-wider">{format(calendarDate, 'MMMM yyyy', { locale: es }).toUpperCase()}</div>
                    <button onClick={nextMonth} disabled={getMonth(calendarDate) === 11} className="p-1 text-slate-400 hover:text-white disabled:opacity-30 disabled:hover:text-slate-400 transition-colors"><ChevronRight size={20} /></button>
                  </div>
                </div>

                <div className="grid grid-cols-7 gap-2 mb-2">
                  {['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'].map(day => (
                    <div key={day} className="text-center text-[10px] font-bold text-slate-500 uppercase">{day}</div>
                  ))}
                </div>
                <div className="grid grid-cols-7 gap-2">
                  {calendarDays.map((day, idx) => {
                    const isCurrentMonth = isSameMonth(day, calendarDate);
                    const isToday = isSameDay(day, new Date());
                    const dayTasks = tasks.filter(t => t.deadline && isSameDay(parseISO(t.deadline), day));

                    return (
                      <div key={idx} className={`h-24 p-2 rounded-lg border transition-all overflow-hidden ${isCurrentMonth ? 'bg-[#16181d] border-slate-800' : 'bg-[#0b0c10] border-transparent opacity-30'} ${isToday ? 'border-cyan-500/50 shadow-[0_0_15px_rgba(34,211,238,0.1)]' : ''}`}>
                        <div className={`text-xs font-bold mb-1 ${isToday ? 'text-cyan-400' : 'text-slate-400'}`}>{format(day, 'd')}</div>
                        <div className="flex flex-col gap-1 mt-1">
                          {dayTasks.slice(0, 3).map(t => {
                            const topicIcon = (t.topic && t.topic !== 'Otro') ? t.topic.slice(-2) : '';
                            return (
                              <div key={t.id} className={`text-[9px] truncate px-1.5 py-0.5 rounded ${t.completed ? 'bg-emerald-500/20 text-emerald-400' : 'bg-cyan-500/20 text-cyan-300'}`}>
                                {topicIcon} {t.title}
                              </div>
                            );
                          })}
                          {dayTasks.length > 3 && <div className="text-[9px] text-slate-500 pl-1">+{dayTasks.length - 3} más</div>}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </motion.div>
            )}

          </div>
        </div>
      </main>

      {/* MODAL PARA PREGUNTAR COMO BORRAR TAREAS REPETITIVAS */}
      <AnimatePresence>
        {deletePrompt.isOpen && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
            <motion.div initial={{ scale: 0.9 }} animate={{ scale: 1 }} className="bg-[#16181d] border border-slate-700 rounded-2xl p-8 w-full max-w-md shadow-2xl flex flex-col items-center text-center">
              <div className="bg-rose-500/20 p-4 rounded-full text-rose-500 mb-4">
                <AlertTriangle size={32} />
              </div>
              <h2 className="text-xl font-bold text-white mb-2">Eliminar Tarea Recurrente</h2>
              <p className="text-slate-400 text-sm mb-8">Esta tarea forma parte de una repetición. ¿Deseas borrar solo esta instancia o todas las repeticiones futuras?</p>
              
              <div className="flex flex-col gap-3 w-full">
                <button onClick={() => confirmDelete('single')} className="bg-[#0b0c10] border border-slate-700 hover:border-cyan-500 text-white font-medium py-3 px-4 rounded-xl transition-colors">
                  Borrar Solo Esta
                </button>
                <button onClick={() => confirmDelete('group')} className="bg-rose-500 hover:bg-rose-400 text-black font-bold py-3 px-4 rounded-xl transition-colors shadow-lg shadow-rose-500/20">
                  Borrar Toda la Serie
                </button>
                <button onClick={() => setDeletePrompt({ isOpen: false, task: null })} className="text-slate-500 hover:text-white font-medium py-2 mt-2 transition-colors">
                  Cancelar
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* MODAL DE CREAR TAREA */}
      <AnimatePresence>
        {isModalOpen && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
            <motion.div initial={{ scale: 0.9 }} animate={{ scale: 1 }} className="bg-[#16181d] border border-slate-700 rounded-2xl p-8 w-full max-w-md shadow-2xl">
              <h2 className="text-2xl font-bold text-white mb-6">Nueva tarea</h2>
              <form onSubmit={addTask} className="flex flex-col gap-4">
                <input type="text" placeholder="Título" value={title} onChange={(e) => setTitle(e.target.value)} autoFocus className="bg-[#0b0c10] border border-slate-700 rounded-xl p-4 text-white focus:border-cyan-500 transition-all outline-none" required />
                
                <div className="flex gap-4">
                  <div className="flex-1">
                    <label className="text-[10px] text-slate-500 uppercase tracking-widest ml-1 mb-1 block">Detalles (Opcional)</label>
                    <input type="text" value={details} onChange={(e) => setDetails(e.target.value)} className="w-full bg-[#0b0c10] border border-slate-700 rounded-xl p-3 text-white text-sm outline-none focus:border-cyan-500 transition-colors" />
                  </div>
                  <div className="flex-1">
                    <label className="text-[10px] text-slate-500 uppercase tracking-widest ml-1 mb-1 block">Tópico</label>
                    <select value={topic} onChange={(e) => setTopic(e.target.value)} className="w-full bg-[#0b0c10] border border-slate-700 rounded-xl p-3 text-slate-300 text-sm outline-none appearance-none cursor-pointer focus:border-cyan-500 transition-colors">
                      <option value="Gym💪">Gym 💪</option>
                      <option value="Estudio 📚">Estudio 📚</option>
                      <option value="Trabajo💼">Trabajo 💼</option>
                      <option value="UTNⵥ">UTN ⵥ</option>
                      <option value="Social🧉">Social 🧉</option>
                      <option value="Otro">Otro</option>
                    </select>
                  </div>
                </div>

                {/* BOTONES INTERACTIVOS DE DÍAS */}
                <div>
                  <label className="text-[10px] text-slate-500 uppercase tracking-widest ml-1 mb-1 block">Se repite los días (Opcional)</label>
                  <div className="flex gap-1 justify-between">
                    {diasSemana.map(day => (
                      <button
                        key={day.id}
                        type="button"
                        onClick={() => setSelectedDays(prev => prev.includes(day.id) ? prev.filter(d => d !== day.id) : [...prev, day.id])}
                        className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all ${
                          selectedDays.includes(day.id) 
                            ? 'bg-cyan-500 text-black shadow-[0_0_10px_rgba(34,211,238,0.4)]' 
                            : 'bg-[#0b0c10] text-slate-400 border border-slate-700 hover:border-cyan-500/50'
                        }`}
                      >
                        {day.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex gap-4">
                  <div className="flex-1">
                    <label className="text-[10px] text-slate-500 uppercase tracking-widest ml-1 mb-1 block">
                      {selectedDays.length > 0 ? 'Fecha de inicio' : 'Fecha límite'}
                    </label>
                    <input type="date" value={dateStr} onChange={(e) => setDateStr(e.target.value)} className="w-full bg-[#0b0c10] border border-slate-700 rounded-xl p-3 text-slate-300 text-sm outline-none focus:border-cyan-500 transition-colors" style={{ colorScheme: 'dark' }} required={selectedDays.length > 0} />
                  </div>
                  <div className="flex-1">
                    <label className="text-[10px] text-slate-500 uppercase tracking-widest ml-1 mb-1 block">Hora (Opcional)</label>
                    <input type="time" value={timeStr} onChange={(e) => setTimeStr(e.target.value)} className="w-full bg-[#0b0c10] border border-slate-700 rounded-xl p-3 text-slate-300 text-sm outline-none focus:border-cyan-500 transition-colors" style={{ colorScheme: 'dark' }} />
                  </div>
                </div>
                
                <div className="flex gap-4 mt-4">
                  <button type="button" onClick={() => {setIsModalOpen(false); setSelectedDays([]);}} className="flex-1 text-slate-500 font-bold uppercase text-xs tracking-widest hover:text-white transition-colors">Cancelar</button>
                  <button type="submit" className="flex-2 bg-cyan-500 hover:bg-cyan-400 text-black font-black py-4 px-6 rounded-xl transition-all shadow-lg shadow-cyan-500/20">AÑADIR</button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}