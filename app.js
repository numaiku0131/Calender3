// ==========================================================================
// Application State & Storage
// ==========================================================================

// Global state
let currentDate = new Date(); // Tracks the currently viewed month
let selectedDate = formatDateString(new Date()); // YYYY-MM-DD
let tasks = loadTasksFromStorage(); // Day-specific tasks
let recurringTasks = loadRecurringTasksFromStorage(); // Recurring rules
let workoutRoutines = loadWorkoutRoutinesFromStorage(); // Workout rules
let workoutChartInstance = null; // Chart.js instance
let currentLayoutMode = localStorage.getItem('layout_mode') || 'auto'; // 'auto' | 'desktop' | 'mobile'

// Load and save functions
function loadTasksFromStorage() {
  const saved = localStorage.getItem('daily_calendar_tasks');
  return saved ? JSON.parse(saved) : {};
}

function saveTasksToStorage() {
  localStorage.setItem('daily_calendar_tasks', JSON.stringify(tasks));
}

function loadRecurringTasksFromStorage() {
  const saved = localStorage.getItem('recurring_calendar_tasks');
  return saved ? JSON.parse(saved) : [];
}

function saveRecurringTasksToStorage() {
  localStorage.setItem('recurring_calendar_tasks', JSON.stringify(recurringTasks));
}

function loadWorkoutRoutinesFromStorage() {
  const saved = localStorage.getItem('workout_calendar_routines');
  return saved ? JSON.parse(saved) : [];
}

function saveWorkoutRoutinesToStorage() {
  localStorage.setItem('workout_calendar_routines', JSON.stringify(workoutRoutines));
}

// Helper: Ensure backward compatibility and return uniform day object
function getDayData(dateStr) {
  let data = tasks[dateStr];
  if (!data) {
    return { items: [], initializedRecurring: false };
  }
  // If old array format, migrate it to the object format
  if (Array.isArray(data)) {
    tasks[dateStr] = {
      items: data,
      initializedRecurring: true
    };
    saveTasksToStorage();
    return tasks[dateStr];
  }
  return data;
}

// Helper: Format Date
function formatDateString(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// Helper: Parse Date
function parseDateString(dateStr) {
  const [year, month, day] = dateStr.split('-').map(Number);
  return new Date(year, month - 1, day);
}

// ==========================================================================
// DOM Elements
// ==========================================================================
const monthYearDisplay = document.getElementById('current-month-year');
const calendarDaysGrid = document.getElementById('calendar-days');
const prevMonthBtn = document.getElementById('prev-month-btn');
const nextMonthBtn = document.getElementById('next-month-btn');
const todayBtn = document.getElementById('today-btn');
const layoutToggleBtn = document.getElementById('layout-toggle-btn');

// Tabs
const tabToday = document.getElementById('tab-today');
const tabRecurring = document.getElementById('tab-recurring');
const tabWorkout = document.getElementById('tab-workout');
const todayTasksContainer = document.getElementById('today-tasks-container');
const recurringTasksContainer = document.getElementById('recurring-tasks-container');
const workoutTasksContainer = document.getElementById('workout-tasks-container');

// Bottom Tabs (for Mobile layout)
const bottomTabCalendar = document.getElementById('bottom-tab-calendar');
const bottomTabToday = document.getElementById('bottom-tab-today');
const bottomTabRecurring = document.getElementById('bottom-tab-recurring');
const bottomTabWorkout = document.getElementById('bottom-tab-workout');

// Today's Task panel
const selectedDateDisplay = document.getElementById('selected-date-display');
const taskProgressBar = document.getElementById('task-progress-bar');
const progressPercentage = document.getElementById('progress-percentage');
const taskForm = document.getElementById('task-form');
const taskInput = document.getElementById('task-input');
const taskList = document.getElementById('task-list');
const noTasksMessage = document.getElementById('no-tasks-message');

// Recurring Task panel
const recurringForm = document.getElementById('recurring-form');
const recurringInput = document.getElementById('recurring-input');
const recurringTypeRadios = document.getElementsByName('recurring-type');
const weeklySelectorContainer = document.getElementById('weekly-selector-container');
const monthlySelectorContainer = document.getElementById('monthly-selector-container');
const monthlyDaySelect = document.getElementById('monthly-day-select');
const recurringList = document.getElementById('recurring-list');
const noRecurringMessage = document.getElementById('no-recurring-message');

// Workout Manager panel
const workoutForm = document.getElementById('workout-form');
const workoutNameInput = document.getElementById('workout-name-input');
const workoutRepsInput = document.getElementById('workout-reps-input');
const workoutList = document.getElementById('workout-list');
const noWorkoutsMessage = document.getElementById('no-workouts-message');
const noChartMessage = document.getElementById('no-chart-message');

// ==========================================================================
// Initialization & Event Listeners
// ==========================================================================
document.addEventListener('DOMContentLoaded', () => {
  // Apply saved layout mode
  applyLayoutMode();

  // Initialize mobile view default (active calendar view)
  switchMobileView('calendar');

  populateMonthlySelect();
  initializeAllVisibleDateTasks();
  
  renderCalendar();
  renderTasks();
  renderRecurringTasks();
  renderWorkoutList();
  
  lucide.createIcons();

  // Register Service Worker for PWA (offline & installable)
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js').then(() => {
      console.log('Service Worker registered successfully.');
    }).catch((err) => {
      console.warn('Service Worker registration failed:', err);
    });
  }
});

// Layout Mode Toggling & Application
layoutToggleBtn.addEventListener('click', () => {
  if (currentLayoutMode === 'auto') {
    currentLayoutMode = 'desktop';
  } else if (currentLayoutMode === 'desktop') {
    currentLayoutMode = 'mobile';
  } else {
    currentLayoutMode = 'auto';
  }
  
  localStorage.setItem('layout_mode', currentLayoutMode);
  applyLayoutMode();
  
  // Re-render chart if visible because width changed
  if (tabWorkout.classList.contains('active')) {
    renderWorkoutChart();
  }
});

function applyLayoutMode() {
  // Remove all layout classes
  document.body.classList.remove('layout-auto', 'layout-desktop', 'layout-mobile');
  
  let iconName = 'sliders-horizontal';
  let buttonText = '表示: 自動';
  
  if (currentLayoutMode === 'desktop') {
    document.body.classList.add('layout-desktop');
    iconName = 'monitor';
    buttonText = '表示: PC固定';
  } else if (currentLayoutMode === 'mobile') {
    document.body.classList.add('layout-mobile');
    iconName = 'tablet-smartphone';
    buttonText = '表示: スマホ固定';
  } else {
    document.body.classList.add('layout-auto');
  }
  
  layoutToggleBtn.innerHTML = `<i data-lucide="${iconName}"></i><span>${buttonText}</span>`;
  lucide.createIcons();
}

// Navigation handlers
prevMonthBtn.addEventListener('click', () => {
  currentDate.setMonth(currentDate.getMonth() - 1);
  initializeAllVisibleDateTasks();
  renderCalendar();
});

nextMonthBtn.addEventListener('click', () => {
  currentDate.setMonth(currentDate.getMonth() + 1);
  initializeAllVisibleDateTasks();
  renderCalendar();
});

todayBtn.addEventListener('click', () => {
  const today = new Date();
  currentDate = new Date(today.getFullYear(), today.getMonth(), 1);
  selectedDate = formatDateString(today);
  initializeAllVisibleDateTasks();
  renderCalendar();
  renderTasks();
});

// Today Task Form Submission
taskForm.addEventListener('submit', (e) => {
  e.preventDefault();
  const text = taskInput.value.trim();
  if (!text) return;
  
  addTask(text);
  taskInput.value = '';
});

// Tab Switch Logic
tabToday.addEventListener('click', () => {
  setActiveTab(tabToday, todayTasksContainer);
  renderTasks();
});

tabRecurring.addEventListener('click', () => {
  setActiveTab(tabRecurring, recurringTasksContainer);
  renderRecurringTasks();
});

tabWorkout.addEventListener('click', () => {
  setActiveTab(tabWorkout, workoutTasksContainer);
  renderWorkoutList();
  renderWorkoutChart();
});

// Bottom Navigation Switch Logic (Smartphone view)
function switchMobileView(viewName) {
  // Update body classes for view toggle
  document.body.classList.remove('show-calendar', 'show-tasks');
  
  // Reset all bottom tab active classes
  [bottomTabCalendar, bottomTabToday, bottomTabRecurring, bottomTabWorkout].forEach(tab => {
    tab.classList.remove('active');
  });

  // Set clicked tab to active
  if (viewName === 'calendar') {
    bottomTabCalendar.classList.add('active');
    document.body.classList.add('show-calendar');
  } else {
    document.body.classList.add('show-tasks');
    if (viewName === 'today') {
      bottomTabToday.classList.add('active');
      setActiveTab(tabToday, todayTasksContainer);
      renderTasks();
    } else if (viewName === 'recurring') {
      bottomTabRecurring.classList.add('active');
      setActiveTab(tabRecurring, recurringTasksContainer);
      renderRecurringTasks();
    } else if (viewName === 'workout') {
      bottomTabWorkout.classList.add('active');
      setActiveTab(tabWorkout, workoutTasksContainer);
      renderWorkoutList();
      renderWorkoutChart();
    }
  }
}

bottomTabCalendar.addEventListener('click', () => switchMobileView('calendar'));
bottomTabToday.addEventListener('click', () => switchMobileView('today'));
bottomTabRecurring.addEventListener('click', () => switchMobileView('recurring'));
bottomTabWorkout.addEventListener('click', () => switchMobileView('workout'));

function setActiveTab(activeTabEl, activeContainerEl) {
  [tabToday, tabRecurring, tabWorkout].forEach(tab => tab.classList.remove('active'));
  [todayTasksContainer, recurringTasksContainer, workoutTasksContainer].forEach(c => c.style.display = 'none');
  
  activeTabEl.classList.add('active');
  activeContainerEl.style.display = 'block';

  // Synchronize bottom navigation active state
  [bottomTabToday, bottomTabRecurring, bottomTabWorkout].forEach(tab => tab.classList.remove('active'));
  if (activeTabEl === tabToday) bottomTabToday.classList.add('active');
  if (activeTabEl === tabRecurring) bottomTabRecurring.classList.add('active');
  if (activeTabEl === tabWorkout) bottomTabWorkout.classList.add('active');
}

// Recurring Type Selection Logic
recurringTypeRadios.forEach(radio => {
  radio.addEventListener('change', (e) => {
    const val = e.target.value;
    weeklySelectorContainer.style.display = val === 'weekly' ? 'block' : 'none';
    monthlySelectorContainer.style.display = val === 'monthly' ? 'block' : 'none';
  });
});

// Recurring Form Submission
recurringForm.addEventListener('submit', (e) => {
  e.preventDefault();
  const text = recurringInput.value.trim();
  if (!text) return;
  
  const type = Array.from(recurringTypeRadios).find(r => r.checked).value;
  let value = null;
  
  if (type === 'weekly') {
    const checkboxes = document.querySelectorAll('input[name="weekly-day"]:checked');
    if (checkboxes.length === 0) {
      alert('曜日を少なくとも1つ選択してください。');
      return;
    }
    value = Array.from(checkboxes).map(cb => parseInt(cb.value));
  } else if (type === 'monthly') {
    value = parseInt(monthlyDaySelect.value);
  }
  
  addRecurringTask(text, type, value);
  
  // Reset form
  recurringInput.value = '';
  document.querySelectorAll('input[name="weekly-day"]').forEach(cb => cb.checked = false);
  document.getElementById('recurring-form').querySelector('input[value="daily"]').checked = true;
  weeklySelectorContainer.style.display = 'none';
  monthlySelectorContainer.style.display = 'none';
});

// Workout Form Submission
workoutForm.addEventListener('submit', (e) => {
  e.preventDefault();
  const name = workoutNameInput.value.trim();
  const reps = parseInt(workoutRepsInput.value);
  if (!name || isNaN(reps) || reps <= 0) return;
  
  const checkboxes = document.querySelectorAll('input[name="workout-day"]:checked');
  if (checkboxes.length === 0) {
    alert('実施する曜日を少なくとも1つ選択してください。');
    return;
  }
  const weekdays = Array.from(checkboxes).map(cb => parseInt(cb.value));
  
  addWorkoutRoutine(name, reps, weekdays);
  
  // Reset form
  workoutNameInput.value = '';
  workoutRepsInput.value = '';
  document.querySelectorAll('input[name="workout-day"]').forEach(cb => cb.checked = false);
});

// Populate day selector for monthly option
function populateMonthlySelect() {
  monthlyDaySelect.innerHTML = '';
  for (let i = 1; i <= 31; i++) {
    const opt = document.createElement('option');
    opt.value = i;
    opt.textContent = `${i}日`;
    monthlyDaySelect.appendChild(opt);
  }
}

// ==========================================================================
// Auto-Inserting Logic for Calendar
// ==========================================================================
function initializeAllVisibleDateTasks() {
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const lastDate = new Date(year, month + 1, 0).getDate();
  
  let updated = false;
  for (let day = 1; day <= lastDate; day++) {
    const dateObj = new Date(year, month, day);
    const dateStr = formatDateString(dateObj);
    if (autoInsertRecurringAndWorkoutTasks(dateStr)) {
      updated = true;
    }
  }
  if (updated) {
    saveTasksToStorage();
  }
}

// Check and auto-insert both recurring tasks and workout routines for a date
// Returns true if tasks list was updated
function autoInsertRecurringAndWorkoutTasks(dateStr) {
  const dayData = getDayData(dateStr);
  const dateObj = parseDateString(dateStr);
  const dayOfWeek = dateObj.getDay();
  const dayOfMonth = dateObj.getDate();
  
  let addedAny = false;
  
  // 1. Auto-insert general recurring rules (only if not initialized)
  if (!dayData.initializedRecurring) {
    recurringTasks.forEach(rule => {
      let matches = false;
      if (rule.type === 'daily') matches = true;
      else if (rule.type === 'weekly' && Array.isArray(rule.value)) matches = rule.value.includes(dayOfWeek);
      else if (rule.type === 'monthly') matches = rule.value === dayOfMonth;
      
      if (matches) {
        const newTask = {
          id: `rec-instance-${rule.id}-${dateStr}`,
          text: rule.text,
          completed: false,
          recurringId: rule.id
        };
        if (!dayData.items.some(item => item.recurringId === rule.id)) {
          dayData.items.push(newTask);
          addedAny = true;
        }
      }
    });
    
    dayData.initializedRecurring = true;
    addedAny = true;
  }
  
  // 2. Auto-insert workout routines (separately evaluated based on weekdays, doesn't depend on initializedRecurring flag
  // because we want newly created workouts to immediately show up on already opened calendar dates)
  workoutRoutines.forEach(routine => {
    if (routine.weekdays.includes(dayOfWeek)) {
      const routineTaskId = `workout-instance-${routine.id}-${dateStr}`;
      
      // Add if not already present
      if (!dayData.items.some(item => item.workoutRoutineId === routine.id)) {
        dayData.items.push({
          id: routineTaskId,
          text: `🏋️ 筋トレ: ${routine.name} (${routine.reps}回)`,
          completed: false,
          workoutRoutineId: routine.id,
          reps: routine.reps
        });
        addedAny = true;
      }
    }
  });
  
  if (addedAny) {
    tasks[dateStr] = dayData;
  }
  return addedAny;
}

// ==========================================================================
// General Recurring Task Rule CRUD
// ==========================================================================
function addRecurringTask(text, type, value) {
  const newRule = {
    id: 'rec_' + Date.now().toString(),
    text: text,
    type: type,
    value: value
  };
  
  recurringTasks.push(newRule);
  saveRecurringTasksToStorage();
  
  // Re-evaluate visible cells and selected day
  initializeAllVisibleDateTasks();
  
  // Force append to selectedDate if it matches
  const selectedDateObj = parseDateString(selectedDate);
  const dayOfWeek = selectedDateObj.getDay();
  const dayOfMonth = selectedDateObj.getDate();
  let matches = false;
  if (type === 'daily') matches = true;
  else if (type === 'weekly' && Array.isArray(value)) matches = value.includes(dayOfWeek);
  else if (type === 'monthly') matches = value === dayOfMonth;
  
  if (matches) {
    const dayData = getDayData(selectedDate);
    if (!dayData.items.some(item => item.recurringId === newRule.id)) {
      dayData.items.push({
        id: `rec-instance-${newRule.id}-${selectedDate}`,
        text: text,
        completed: false,
        recurringId: newRule.id
      });
      tasks[selectedDate] = dayData;
      saveTasksToStorage();
    }
  }
  
  renderRecurringTasks();
  renderCalendar();
  renderTasks();
}

function deleteRecurringTask(ruleId) {
  recurringTasks = recurringTasks.filter(rule => rule.id !== ruleId);
  saveRecurringTasksToStorage();
  
  const todayStr = formatDateString(new Date());
  Object.keys(tasks).forEach(dateStr => {
    if (dateStr >= todayStr) {
      const dayData = getDayData(dateStr);
      const originalLen = dayData.items.length;
      dayData.items = dayData.items.filter(item => !(item.recurringId === ruleId && !item.completed));
      if (dayData.items.length !== originalLen) {
        tasks[dateStr] = dayData;
      }
    }
  });
  
  saveTasksToStorage();
  renderRecurringTasks();
  renderCalendar();
  renderTasks();
}

function renderRecurringTasks() {
  recurringList.innerHTML = '';
  if (recurringTasks.length === 0) {
    noRecurringMessage.style.display = 'flex';
  } else {
    noRecurringMessage.style.display = 'none';
    recurringTasks.forEach(rule => {
      const li = document.createElement('li');
      li.className = 'recurring-item';
      
      const infoDiv = document.createElement('div');
      infoDiv.className = 'recurring-info';
      
      const textSpan = document.createElement('span');
      textSpan.className = 'recurring-text';
      textSpan.textContent = rule.text;
      
      const ruleSpan = document.createElement('span');
      ruleSpan.className = 'recurring-rule';
      
      let ruleText = '';
      let iconName = 'refresh-cw';
      if (rule.type === 'daily') {
        ruleText = '毎日';
        iconName = 'repeat';
      } else if (rule.type === 'weekly') {
        const daysMap = ['日', '月', '火', '水', '木', '金', '土'];
        const daysStr = rule.value.map(d => daysMap[d]).join('・');
        ruleText = `毎週: ${daysStr}曜日`;
        iconName = 'calendar-days';
      } else if (rule.type === 'monthly') {
        ruleText = `毎月: ${rule.value}日`;
        iconName = 'calendar';
      }
      
      ruleSpan.innerHTML = `<i data-lucide="${iconName}"></i> <span>${ruleText}</span>`;
      
      infoDiv.appendChild(textSpan);
      infoDiv.appendChild(ruleSpan);
      
      const deleteBtn = document.createElement('button');
      deleteBtn.className = 'btn-delete';
      deleteBtn.innerHTML = '<i data-lucide="trash-2"></i>';
      deleteBtn.addEventListener('click', () => deleteRecurringTask(rule.id));
      
      li.appendChild(infoDiv);
      li.appendChild(deleteBtn);
      recurringList.appendChild(li);
    });
  }
  lucide.createIcons();
}

// ==========================================================================
// Workout Manager CRUD & Graph Logic
// ==========================================================================
function addWorkoutRoutine(name, reps, weekdays) {
  const newRoutine = {
    id: 'workout_' + Date.now().toString(),
    name: name,
    reps: reps,
    weekdays: weekdays
  };
  
  workoutRoutines.push(newRoutine);
  saveWorkoutRoutinesToStorage();
  
  // Auto-inject visible calendar cells
  initializeAllVisibleDateTasks();
  
  // Force append to selectedDate if it matches
  const selectedDateObj = parseDateString(selectedDate);
  const dayOfWeek = selectedDateObj.getDay();
  if (weekdays.includes(dayOfWeek)) {
    const dayData = getDayData(selectedDate);
    if (!dayData.items.some(item => item.workoutRoutineId === newRoutine.id)) {
      dayData.items.push({
        id: `workout-instance-${newRoutine.id}-${selectedDate}`,
        text: `🏋️ 筋トレ: ${name} (${reps}回)`,
        completed: false,
        workoutRoutineId: newRoutine.id,
        reps: reps
      });
      tasks[selectedDate] = dayData;
      saveTasksToStorage();
    }
  }
  
  renderWorkoutList();
  renderWorkoutChart();
  renderCalendar();
  renderTasks();
}

function deleteWorkoutRoutine(routineId) {
  workoutRoutines = workoutRoutines.filter(r => r.id !== routineId);
  saveWorkoutRoutinesToStorage();
  
  // Clean up: Delete future uncompleted tasks instance of this workout routine
  const todayStr = formatDateString(new Date());
  Object.keys(tasks).forEach(dateStr => {
    if (dateStr >= todayStr) {
      const dayData = getDayData(dateStr);
      const originalLen = dayData.items.length;
      dayData.items = dayData.items.filter(item => !(item.workoutRoutineId === routineId && !item.completed));
      if (dayData.items.length !== originalLen) {
        tasks[dateStr] = dayData;
      }
    }
  });
  
  saveTasksToStorage();
  renderWorkoutList();
  renderWorkoutChart();
  renderCalendar();
  renderTasks();
}

function renderWorkoutList() {
  workoutList.innerHTML = '';
  if (workoutRoutines.length === 0) {
    noWorkoutsMessage.style.display = 'flex';
  } else {
    noWorkoutsMessage.style.display = 'none';
    workoutRoutines.forEach(routine => {
      const li = document.createElement('li');
      li.className = 'workout-item';
      
      const infoDiv = document.createElement('div');
      infoDiv.className = 'workout-info';
      
      const titleSpan = document.createElement('span');
      titleSpan.className = 'workout-title';
      titleSpan.textContent = `${routine.name} (${routine.reps}回)`;
      
      const metaSpan = document.createElement('span');
      metaSpan.className = 'workout-meta';
      
      const daysMap = ['日', '月', '火', '水', '木', '金', '土'];
      const daysStr = routine.weekdays.map(d => daysMap[d]).join('・');
      metaSpan.innerHTML = `<i data-lucide="calendar"></i> <span>曜日: ${daysStr}</span>`;
      
      infoDiv.appendChild(titleSpan);
      infoDiv.appendChild(metaSpan);
      
      const deleteBtn = document.createElement('button');
      deleteBtn.className = 'btn-delete';
      deleteBtn.innerHTML = '<i data-lucide="trash-2"></i>';
      deleteBtn.addEventListener('click', () => deleteWorkoutRoutine(routine.id));
      
      li.appendChild(infoDiv);
      li.appendChild(deleteBtn);
      workoutList.appendChild(li);
    });
  }
  lucide.createIcons();
}

// Calculate total workout completions and reps per routine
function getWorkoutStats() {
  const stats = {};
  workoutRoutines.forEach(routine => {
    stats[routine.id] = {
      name: routine.name,
      totalReps: 0,
      completions: 0
    };
  });
  
  // Scan all stored dates in tasks
  Object.keys(tasks).forEach(dateStr => {
    const dayData = getDayData(dateStr);
    dayData.items.forEach(item => {
      if (item.completed && item.workoutRoutineId && stats[item.workoutRoutineId] !== undefined) {
        stats[item.workoutRoutineId].totalReps += (item.reps || 0);
        stats[item.workoutRoutineId].completions += 1;
      }
    });
  });
  
  return stats;
}

// Render workout progress chart using Chart.js
function renderWorkoutChart() {
  const stats = getWorkoutStats();
  const routinesList = Object.values(stats);
  
  const canvas = document.getElementById('workout-chart');
  
  // Check if we have any data to plot
  const totalRepsSum = routinesList.reduce((acc, curr) => acc + curr.totalReps, 0);
  
  if (routinesList.length === 0 || totalRepsSum === 0) {
    noChartMessage.style.display = 'flex';
    canvas.style.display = 'none';
    if (workoutChartInstance) {
      workoutChartInstance.destroy();
      workoutChartInstance = null;
    }
    return;
  }
  
  noChartMessage.style.display = 'none';
  canvas.style.display = 'block';
  
  const labels = routinesList.map(r => r.name);
  const dataValues = routinesList.map(r => r.totalReps);
  
  const ctx = canvas.getContext('2d');
  
  if (workoutChartInstance) {
    workoutChartInstance.destroy();
  }
  
  // Create beautiful indigo/violet neon gradient for the bar fill
  const gradient = ctx.createLinearGradient(0, 0, 400, 0);
  gradient.addColorStop(0, 'rgba(99, 102, 241, 0.85)'); // Indigo
  gradient.addColorStop(1, 'rgba(219, 39, 119, 0.95)'); // Pink / Violet
  
  workoutChartInstance = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: labels,
      datasets: [{
        label: '累計回数',
        data: dataValues,
        backgroundColor: gradient,
        borderColor: '#a5b4fc',
        borderWidth: 1,
        borderRadius: 8,
        barThickness: 20
      }]
    },
    options: {
      indexAxis: 'y', // Horizontal Bar Chart
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          display: false
        },
        tooltip: {
          backgroundColor: '#10162a',
          titleFont: { family: 'Outfit', size: 13 },
          bodyFont: { family: 'Outfit', size: 12 },
          borderColor: 'rgba(255, 255, 255, 0.1)',
          borderWidth: 1
        }
      },
      scales: {
        x: {
          grid: {
            color: 'rgba(255, 255, 255, 0.05)',
            drawBorder: false
          },
          ticks: {
            color: '#94a3b8',
            font: { family: 'Outfit', size: 11 }
          }
        },
        y: {
          grid: {
            display: false
          },
          ticks: {
            color: '#f8fafc',
            font: { family: 'Outfit', size: 12, weight: '500' }
          }
        }
      }
    }
  });
}

// ==========================================================================
// Calendar Logic
// ==========================================================================
function renderCalendar() {
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  
  monthYearDisplay.textContent = `${year}年 ${month + 1}月`;
  calendarDaysGrid.innerHTML = '';
  
  const firstDayIndex = new Date(year, month, 1).getDay();
  const lastDate = new Date(year, month + 1, 0).getDate();
  
  for (let i = 0; i < firstDayIndex; i++) {
    const emptyCell = document.createElement('div');
    emptyCell.className = 'day-cell empty-day';
    calendarDaysGrid.appendChild(emptyCell);
  }
  
  const todayStr = formatDateString(new Date());
  
  for (let day = 1; day <= lastDate; day++) {
    const cellDateObj = new Date(year, month, day);
    const cellDateStr = formatDateString(cellDateObj);
    
    const dayCell = document.createElement('div');
    dayCell.className = 'day-cell';
    dayCell.dataset.date = cellDateStr;
    
    if (cellDateStr === todayStr) {
      dayCell.classList.add('today');
    }
    
    if (cellDateStr === selectedDate) {
      dayCell.classList.add('selected');
    }
    
    const dayNumSpan = document.createElement('span');
    dayNumSpan.className = 'day-number';
    dayNumSpan.textContent = day;
    dayCell.appendChild(dayNumSpan);

    // Mini task list inside calendar cells
    autoInsertRecurringAndWorkoutTasks(cellDateStr);
    const dayData = getDayData(cellDateStr);
    const dayTasks = dayData.items || [];
    
    if (dayTasks.length > 0) {
      const miniTasksContainer = document.createElement('div');
      miniTasksContainer.className = 'day-mini-tasks';
      
      const maxVisible = 2;
      const visibleTasks = dayTasks.slice(0, maxVisible);
      
      visibleTasks.forEach(task => {
        const miniTask = document.createElement('div');
        miniTask.className = `mini-task-item ${task.completed ? 'completed' : ''}`;
        
        // Identify workout routines to apply special styling
        if (task.workoutRoutineId) {
          miniTask.setAttribute('data-workout', 'true');
        }
        
        miniTask.textContent = task.text;
        miniTasksContainer.appendChild(miniTask);
      });
      
      if (dayTasks.length > maxVisible) {
        const moreDiv = document.createElement('div');
        moreDiv.className = 'mini-task-more';
        moreDiv.textContent = `+他${dayTasks.length - maxVisible}件`;
        miniTasksContainer.appendChild(moreDiv);
      }
      
      dayCell.appendChild(miniTasksContainer);
    }
    
    const progressContainer = document.createElement('div');
    progressContainer.className = 'day-progress-container';
    
    const progressBar = document.createElement('div');
    progressBar.className = 'day-progress-bar';
    
    const progressFill = document.createElement('div');
    progressFill.className = 'day-progress-fill';
    
    const cellProgress = getTaskProgress(cellDateStr);
    if (cellProgress.total > 0) {
      const percentage = Math.round((cellProgress.completed / cellProgress.total) * 100);
      progressFill.style.width = `${percentage}%`;
      
      if (percentage === 100) {
        progressFill.classList.add('completed');
      } else {
        progressFill.classList.add('in-progress');
      }
    } else {
      progressFill.style.width = '0%';
    }
    
    progressBar.appendChild(progressFill);
    progressContainer.appendChild(progressBar);
    dayCell.appendChild(progressContainer);
    
    dayCell.addEventListener('click', () => {
      const prevSelected = calendarDaysGrid.querySelector('.day-cell.selected');
      if (prevSelected) {
        prevSelected.classList.remove('selected');
      }
      
      dayCell.classList.add('selected');
      selectedDate = cellDateStr;
      
      // If bottom navigation is active, automatically navigate to today's tasks tab
      const isMobile = window.getComputedStyle(document.getElementById('bottom-tab-bar')).display !== 'none';
      if (isMobile) {
        switchMobileView('today');
      } else {
        tabToday.click();
      }
    });
    
    calendarDaysGrid.appendChild(dayCell);
  }
}

function getTaskProgress(dateStr) {
  const dayData = getDayData(dateStr);
  const total = dayData.items.length;
  const completed = dayData.items.filter(t => t.completed).length;
  return { total, completed };
}

// ==========================================================================
// Task Logic
// ==========================================================================
function renderTasks() {
  const parsedDate = parseDateString(selectedDate);
  const weekdays = ['日', '月', '火', '水', '木', '金', '土'];
  const dayOfWeek = weekdays[parsedDate.getDay()];
  selectedDateDisplay.textContent = `${parsedDate.getFullYear()}年${parsedDate.getMonth() + 1}月${parsedDate.getDate()}日 (${dayOfWeek})`;
  
  taskList.innerHTML = '';
  
  // Make sure tasks are auto-initialized for this day
  if (autoInsertRecurringAndWorkoutTasks(selectedDate)) {
    saveTasksToStorage();
  }
  
  const dayData = getDayData(selectedDate);
  const dayTasks = dayData.items;
  
  if (dayTasks.length === 0) {
    noTasksMessage.style.display = 'flex';
    updateTaskProgressBar(0);
  } else {
    noTasksMessage.style.display = 'none';
    
    dayTasks.forEach(task => {
      const li = document.createElement('li');
      li.className = `task-item ${task.completed ? 'completed' : ''}`;
      li.dataset.id = task.id;
      
      const contentDiv = document.createElement('div');
      contentDiv.className = 'task-item-content';
      
      const checkbox = document.createElement('div');
      checkbox.className = 'custom-checkbox';
      checkbox.innerHTML = '<i data-lucide="check"></i>';
      checkbox.addEventListener('click', () => toggleTaskComplete(task.id));
      
      const textSpan = document.createElement('span');
      textSpan.className = 'task-text';
      textSpan.textContent = task.text;
      textSpan.addEventListener('click', () => toggleTaskComplete(task.id));
      
      contentDiv.appendChild(checkbox);
      contentDiv.appendChild(textSpan);
      
      const deleteBtn = document.createElement('button');
      deleteBtn.className = 'btn-delete';
      deleteBtn.innerHTML = '<i data-lucide="trash-2"></i>';
      deleteBtn.setAttribute('aria-label', 'タスクを削除');
      deleteBtn.addEventListener('click', () => deleteTask(task.id));
      
      li.appendChild(contentDiv);
      li.appendChild(deleteBtn);
      
      taskList.appendChild(li);
    });
    
    const progress = getTaskProgress(selectedDate);
    const percentage = Math.round((progress.completed / progress.total) * 100);
    updateTaskProgressBar(percentage);
  }
  
  lucide.createIcons();
}

function updateTaskProgressBar(percentage) {
  taskProgressBar.style.width = `${percentage}%`;
  progressPercentage.textContent = `${percentage}%`;
}

function addTask(text) {
  const dayData = getDayData(selectedDate);
  const newTask = {
    id: Date.now().toString(),
    text: text,
    completed: false
  };
  
  dayData.items.push(newTask);
  dayData.initializedRecurring = true;
  tasks[selectedDate] = dayData;
  
  saveTasksToStorage();
  renderTasks();
  updateCalendarCellProgress(selectedDate);
}

function toggleTaskComplete(taskId) {
  const dayData = getDayData(selectedDate);
  dayData.items = dayData.items.map(task => {
    if (task.id === taskId) {
      return { ...task, completed: !task.completed };
    }
    return task;
  });
  tasks[selectedDate] = dayData;
  
  saveTasksToStorage();
  renderTasks();
  updateCalendarCellProgress(selectedDate);
  
  // If active tab is Workout, update chart real-time
  if (tabWorkout.classList.contains('active')) {
    renderWorkoutChart();
  }
}

function deleteTask(taskId) {
  const dayData = getDayData(selectedDate);
  dayData.items = dayData.items.filter(task => task.id !== taskId);
  tasks[selectedDate] = dayData;
  
  saveTasksToStorage();
  renderTasks();
  updateCalendarCellProgress(selectedDate);
  
  // Update chart if workout task is deleted
  if (tabWorkout.classList.contains('active')) {
    renderWorkoutChart();
  }
}

function updateCalendarCellProgress(dateStr) {
  const dayCell = calendarDaysGrid.querySelector(`.day-cell[data-date="${dateStr}"]`);
  if (!dayCell) return;
  
  // 1. Update Progress Bar
  const progressFill = dayCell.querySelector('.day-progress-fill');
  if (progressFill) {
    const progress = getTaskProgress(dateStr);
    if (progress.total > 0) {
      const percentage = Math.round((progress.completed / progress.total) * 100);
      progressFill.style.width = `${percentage}%`;
      if (percentage === 100) {
        progressFill.className = 'day-progress-fill completed';
      } else {
        progressFill.className = 'day-progress-fill in-progress';
      }
    } else {
      progressFill.style.width = '0%';
      progressFill.className = 'day-progress-fill';
    }
  }

  // 2. Update Mini Tasks List
  const oldContainer = dayCell.querySelector('.day-mini-tasks');
  if (oldContainer) {
    oldContainer.remove();
  }

  const dayData = getDayData(dateStr);
  const dayTasks = dayData.items || [];
  
  if (dayTasks.length > 0) {
    const miniTasksContainer = document.createElement('div');
    miniTasksContainer.className = 'day-mini-tasks';
    
    const maxVisible = 2;
    const visibleTasks = dayTasks.slice(0, maxVisible);
    
    visibleTasks.forEach(task => {
      const miniTask = document.createElement('div');
      miniTask.className = `mini-task-item ${task.completed ? 'completed' : ''}`;
      
      if (task.workoutRoutineId) {
        miniTask.setAttribute('data-workout', 'true');
      }
      
      miniTask.textContent = task.text;
      miniTasksContainer.appendChild(miniTask);
    });
    
    if (dayTasks.length > maxVisible) {
      const moreDiv = document.createElement('div');
      moreDiv.className = 'mini-task-more';
      moreDiv.textContent = `+他${dayTasks.length - maxVisible}件`;
      miniTasksContainer.appendChild(moreDiv);
    }
    
    const progressContainer = dayCell.querySelector('.day-progress-container');
    if (progressContainer) {
      dayCell.insertBefore(miniTasksContainer, progressContainer);
    } else {
      dayCell.appendChild(miniTasksContainer);
    }
  }
}
