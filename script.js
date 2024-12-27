let folders = [];
let currentFolderIndex = null;
let currentTask = 0;
let currentStep = 0;
let isAdding = true;
let timerInterval;
let startTime;
let taskTimers = {};

// Solicitar permiso para notificaciones al cargar la página
if ("Notification" in window && Notification.permission !== "granted") {
    Notification.requestPermission();
}

// Cargar carpetas desde localStorage al iniciar
window.onload = function() {
    const storedFolders = localStorage.getItem('folders');
    if (storedFolders) {
        folders = JSON.parse(storedFolders);
    }
    renderApp();
};

function saveFolders() {
    localStorage.setItem('folders', JSON.stringify(folders));
}

function renderApp() {
    const app = document.getElementById('app');
    app.innerHTML = ''; // Limpiar contenido previo
    if (currentFolderIndex === null) {
        // Mostrar signo '+' para crear carpeta
        app.innerHTML = `
            <div class="card animated fadeInUp" style="text-align:center;">
                <button onclick="createFolder()" style="font-size: 3em; width: 80px; height: 80px; border-radius: 50%;">+</button>
            </div>
            <div id="folderList"></div>
        `;
        renderFolders();
    } else {
        if (isAdding) {
            app.innerHTML = `
                <div class="card animated fadeInUp">
                    <div style="display: flex; align-items: center;">
                        <button class="backButton" onclick="goBackToFolders()">🔙</button>
                        <h1 style="flex-grow: 1; text-align: center;">${folders[currentFolderIndex].name}</h1>
                    </div>
                    <input id="newTaskTitle" placeholder="Título de la tarea" onkeydown="if(event.key === 'Enter') addTask()">
                    <!-- Sección de temporizador -->
                    <div class="timer-section">
                        <label>
                            <input type="checkbox" id="enableTimer">
                            Habilitar Temporizador
                        </label>
                        <input type="number" id="timerMinutes" class="timer-input" placeholder="Tiempo en minutos">
                    </div>
                </div>
                <div id="taskList"></div>
                <!-- El botón de Play fijo -->
                <button id="playButton" onclick="startTasks()" ${folders[currentFolderIndex].tasks.length === 0 || !folders[currentFolderIndex].tasks.some(task => !task.completed) ? 'disabled' : ''}>▶️</button>
            `;
            // Mostrar/ocultar el input de tiempo según el estado del checkbox
            document.getElementById('enableTimer').addEventListener('change', function() {
                const timerInput = document.getElementById('timerMinutes');
                timerInput.style.display = this.checked ? 'block' : 'none';
            });
            renderTasks();
        } else {
            app.innerHTML = `
                <div class="card animated fadeInUp">
                    <button class="backButton" onclick="resetTasks()">🔙</button>
                </div>
            `;
            renderTask();
        }
    }
}

function renderFolders() {
    const folderList = document.getElementById('folderList');
    folderList.innerHTML = folders.map((folder, index) => `
        <div class="card animated fadeInUp draggable" data-type="folder" data-folder-index="${index}">
            <div class="task-header">
                <div class="grip"><span class="no-pointer">☰</span></div>
                <h2 onclick="openFolder(${index})">${folder.name}</h2>
                <div>
                    <button class="icon-button" onclick="event.stopPropagation(); editFolder(${index})">✏️</button>
                    <button class="icon-button" onclick="event.stopPropagation(); deleteFolder(${index})">🗑️</button>
                </div>
            </div>
        </div>
    `).join('');
    setupDragAndDrop();
}

function openFolder(index) {
    currentFolderIndex = index;
    renderApp();
}

function goBackToFolders() {
    currentFolderIndex = null;
    isAdding = true;
    renderApp();
}

function createFolder() {
    const folderName = prompt('Nombre de la nueva carpeta:');
    if (folderName && folderName.trim() !== '') {
        folders.push({ name: folderName.trim(), tasks: [] });
        saveFolders();
        renderApp();
    }
}

function editFolder(index) {
    const newName = prompt('Editar nombre de la carpeta:', folders[index].name);
    if (newName && newName.trim() !== '') {
        folders[index].name = newName.trim();
        saveFolders();
        renderApp();
    }
}

function deleteFolder(index) {
    if (confirm('¿Estás seguro de que quieres eliminar esta carpeta y todas sus tareas?')) {
        // Limpiar temporizadores asociados a las tareas de la carpeta
        folders[index].tasks.forEach((task, taskIndex) => {
            clearTaskTimer(taskIndex);
        });
        folders.splice(index, 1);
        saveFolders();
        renderApp();
    }
}

function renderTasks() {
    const taskList = document.getElementById('taskList');
    const tasks = folders[currentFolderIndex].tasks;

    // Separar tareas activas y completadas
    const activeTasks = tasks.filter(task => !task.completed);
    const completedTasks = tasks.filter(task => task.completed);

    // Renderizar tareas activas
    taskList.innerHTML = activeTasks.map((task, index) => {
        const taskIndex = tasks.indexOf(task);
        return `
        <div class="card animated fadeInUp draggable" data-type="task" data-task-index="${taskIndex}">
            <div class="task-header">
                <div class="grip"><span>☰</span></div>
                <h2>${task.title}</h2>
                <div>
                    <button class="icon-button" onclick="completeTask(${taskIndex})" title="Marcar como Completada">✔️</button>
                    <button class="icon-button" onclick="editTask(${taskIndex})" title="Editar Tarea">✏️</button>
                    <button class="icon-button" onclick="deleteTask(${taskIndex})" title="Eliminar Tarea">🗑️</button>
                    <button class="icon-button" onclick="exportTask(${taskIndex})" title="Exportar Tarea">⬇️</button>
                </div>
            </div>
            <!-- Mostrar si el temporizador está habilitado -->
            ${task.timerEnabled ? `<p>⏰ Recordatorio en ${task.timerMinutes} minutos</p>` : ''}
            <input id="newStep${taskIndex}" placeholder="Nuevo paso" onkeydown="if(event.key === 'Enter') addStep(${taskIndex})">
            <ul class="step-list" data-task-index="${taskIndex}">
                ${task.steps.map((step, stepIndex) => `
                    <li class="task-step draggable" data-type="step" data-task-index="${taskIndex}" data-step-index="${stepIndex}">
                        <div class="step-content">
                            <div class="grip">☰</div>
                            <p>${step}</p>
                        </div>
                        <div>
                            <button class="icon-button" onclick="editStep(${taskIndex}, ${stepIndex})" title="Editar Paso">✏️</button>
                            <button class="icon-button" onclick="deleteStep(${taskIndex}, ${stepIndex})" title="Eliminar Paso">🗑️</button>
                        </div>
                    </li>
                `).join('')}
            </ul>
        </div>
        `;
    }).join('');

    // Renderizar tareas completadas
    if (completedTasks.length > 0) {
        taskList.innerHTML += `
            <div class="card animated fadeInUp">
                <h2>Tareas Completadas</h2>
                <div>
                    ${completedTasks.map((task, index) => {
                        const taskIndex = tasks.indexOf(task);
                        return `
                        <div class="completed-task">
                            <h2>${task.title}</h2>
                            <div>
                                <button class="icon-button" onclick="reactivateTask(${taskIndex})" title="Reactivar Tarea">⏪</button>
                                <button class="icon-button" onclick="deleteTask(${taskIndex}, true)" title="Eliminar Tarea">🗑️</button>
                            </div>
                        </div>
                        `;
                    }).join('')}
                </div>
            </div>
        `;
    }
    setupDragAndDrop();
}

function addTask() {
    const newTaskTitle = document.getElementById('newTaskTitle').value;
    const enableTimer = document.getElementById('enableTimer').checked;
    let timerMinutes = parseInt(document.getElementById('timerMinutes').value);

    if (newTaskTitle.trim() !== '') {
        const newTask = {
            title: newTaskTitle.trim(),
            steps: [],
            completed: false,
            timerEnabled: enableTimer,
            timerMinutes: enableTimer && !isNaN(timerMinutes) && timerMinutes > 0 ? timerMinutes : null
        };

        folders[currentFolderIndex].tasks.push(newTask);
        document.getElementById('newTaskTitle').value = '';
        document.getElementById('enableTimer').checked = false;
        document.getElementById('timerMinutes').value = '';
        document.getElementById('timerMinutes').style.display = 'none';

        if (newTask.timerEnabled && newTask.timerMinutes) {
            const taskIndex = folders[currentFolderIndex].tasks.length - 1;
            setTaskTimer(taskIndex, newTask.timerMinutes);
        }

        saveFolders();
        renderApp();
    }
}

function editTask(taskIndex) {
    const task = folders[currentFolderIndex].tasks[taskIndex];
    const newTitle = prompt("Editar título de la tarea:", task.title);
    if (newTitle !== null && newTitle.trim() !== '') {
        task.title = newTitle.trim();
    }

    // Mostrar una ventana para editar el temporizador
    const changeTimer = confirm("¿Deseas cambiar la configuración del temporizador para esta tarea?");
    if (changeTimer) {
        const timerEnabled = confirm("¿Habilitar temporizador?");
        if (timerEnabled) {
            let timerMinutes = prompt("Ingresa el tiempo en minutos para el recordatorio:", task.timerMinutes || '');
            timerMinutes = parseInt(timerMinutes);
            if (!isNaN(timerMinutes) && timerMinutes > 0) {
                task.timerEnabled = true;
                task.timerMinutes = timerMinutes;
                setTaskTimer(taskIndex, timerMinutes);
            } else {
                alert("Tiempo inválido. El temporizador no se habilitará.");
                task.timerEnabled = false;
                clearTaskTimer(taskIndex);
            }
        } else {
            task.timerEnabled = false;
            clearTaskTimer(taskIndex);
        }
    }

    saveFolders();
    renderApp();
}

function deleteTask(taskIndex, isCompleted = false) {
    if (confirm("¿Estás seguro de que quieres eliminar esta tarea?")) {
        clearTaskTimer(taskIndex);
        folders[currentFolderIndex].tasks.splice(taskIndex, 1);
        saveFolders();
        renderApp();
    }
}

function completeTask(taskIndex) {
    const task = folders[currentFolderIndex].tasks[taskIndex];
    task.completed = true;
    clearTaskTimer(taskIndex);
    saveFolders();
    renderApp();
}

function reactivateTask(taskIndex) {
    const task = folders[currentFolderIndex].tasks[taskIndex];
    task.completed = false;
    saveFolders();
    renderApp();
}

function addStep(taskIndex) {
    const newStepInput = document.getElementById(`newStep${taskIndex}`);
    const newStep = newStepInput.value;
    if (newStep.trim() !== '') {
        const task = folders[currentFolderIndex].tasks[taskIndex];
        task.steps.push(newStep.trim());
        newStepInput.value = '';
        saveFolders();
        renderApp();
    }
}

function editStep(taskIndex, stepIndex) {
    const task = folders[currentFolderIndex].tasks[taskIndex];
    const newStep = prompt("Editar paso:", task.steps[stepIndex]);
    if (newStep !== null && newStep.trim() !== '') {
        task.steps[stepIndex] = newStep.trim();
        saveFolders();
        renderApp();
    }
}

function deleteStep(taskIndex, stepIndex) {
    if (confirm("¿Estás seguro de que quieres eliminar este paso?")) {
        const task = folders[currentFolderIndex].tasks[taskIndex];
        task.steps.splice(stepIndex, 1);
        saveFolders();
        renderApp();
    }
}

function startTasks() {
    const tasks = folders[currentFolderIndex].tasks;
    if (tasks.length > 0 && tasks.some(task => task.steps.length > 0 && !task.completed)) {
        isAdding = false;
        currentTask = 0;
        currentStep = 0;
        startTimer();
        renderApp();
    }
}

function renderTask() {
    const tasks = folders[currentFolderIndex].tasks;
    // Filtrar tareas activas
    const activeTasks = tasks.filter(task => !task.completed);
    if (activeTasks.length === 0) {
        alert("No hay tareas activas para mostrar.");
        resetTasks();
        return;
    }

    const app = document.getElementById('app');
    const task = activeTasks[currentTask];
    const totalTasks = activeTasks.length;
    const totalSteps = task.steps.length;
    const progress = ((currentStep + 1) / totalSteps) * 100;

    app.innerHTML += `
        <div class="card animated fadeInUp">
            <h1>${task.title}</h1>
            <p>Tarea ${currentTask + 1} de ${totalTasks}</p>
            <div class="step-text">
                <h2>Paso ${currentStep + 1}: ${task.steps[currentStep]}</h2>
            </div>
            <div id="timer">00:00:00</div>
            <div class="progress-container">
                <div class="progress-bar" style="width: ${progress}%"></div>
            </div>
            <br>
            <div style="text-align: center;">
                <button onclick="prevStep()" ${currentTask === 0 && currentStep === 0 ? 'disabled' : ''}>⏮️</button>
                <button onclick="nextStep()" ${currentTask === totalTasks - 1 && currentStep === totalSteps - 1 ? 'disabled' : ''}>⏭️</button>
            </div>
        </div>
    `;
}

function nextStep() {
    const tasks = folders[currentFolderIndex].tasks;
    const activeTasks = tasks.filter(task => !task.completed);
    if (currentStep < activeTasks[currentTask].steps.length - 1) {
        currentStep++;
    } else if (currentTask < activeTasks.length - 1) {
        currentTask++;
        currentStep = 0;
    }
    startTimer();
    renderApp();
}

function prevStep() {
    const tasks = folders[currentFolderIndex].tasks;
    const activeTasks = tasks.filter(task => !task.completed);
    if (currentStep > 0) {
        currentStep--;
    } else if (currentTask > 0) {
        currentTask--;
        currentStep = activeTasks[currentTask].steps.length - 1;
    }
    startTimer();
    renderApp();
}

function resetTasks() {
    isAdding = true;
    clearInterval(timerInterval);
    saveFolders();
    renderApp();
}

function startTimer() {
    clearInterval(timerInterval);
    startTime = Date.now();
    timerInterval = setInterval(updateTimer, 1000);
}

function updateTimer() {
    const elapsedTime = Date.now() - startTime;
    const hours = Math.floor(elapsedTime / 3600000);
    const minutes = Math.floor((elapsedTime % 3600000) / 60000);
    const seconds = Math.floor((elapsedTime % 60000) / 1000);

    const timerElement = document.getElementById('timer');
    if (timerElement) {
        timerElement.textContent = `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
    }
}

function pad(num) {
    return num.toString().padStart(2, '0');
}

function setTaskTimer(taskIndex, minutes) {
    const milliseconds = minutes * 60 * 1000;
    const task = folders[currentFolderIndex].tasks[taskIndex];

    // Limpiar cualquier temporizador previo
    clearTaskTimer(taskIndex);

    // Establecer nuevo temporizador
    taskTimers[taskIndex] = setTimeout(() => {
        triggerAlarm(task.title);
    }, milliseconds);
}

function clearTaskTimer(taskIndex) {
    if (taskTimers[taskIndex]) {
        clearTimeout(taskTimers[taskIndex]);
        delete taskTimers[taskIndex];
    }
}

function triggerAlarm(taskTitle) {
    // Mostrar notificación si es posible
    if ("Notification" in window && Notification.permission === "granted") {
        new Notification("¡Recordatorio de Tarea!", {
            body: `Es hora de trabajar en: ${taskTitle}`,
            icon: 'data:image/svg+xml;base64,' + btoa('<svg width="64" height="64" xmlns="http://www.w3.org/2000/svg"><circle cx="32" cy="32" r="30" fill="#e74c3c"/><text x="32" y="42" font-size="32" text-anchor="middle" fill="#fff">⏰</text></svg>')
        });
    } else {
        alert(`¡Recordatorio de Tarea!\nEs hora de trabajar en: ${taskTitle}`);
    }

    // Vibración en dispositivos compatibles
    if (navigator.vibrate) {
        navigator.vibrate([500, 200, 500]);
    }
}

function exportTask(taskIndex) {
    const task = folders[currentFolderIndex].tasks[taskIndex];
    const taskJSON = JSON.stringify(task);
    const blob = new Blob([taskJSON], {type: "application/json"});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `tarea_${taskIndex + 1}.json`;
    a.click();
    URL.revokeObjectURL(url);
}

function importTasks() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = function(event) {
        const file = event.target.files[0];
        const reader = new FileReader();
        reader.onload = function(e) {
            try {
                const importedData = JSON.parse(e.target.result);
                if (Array.isArray(importedData)) {
                    folders[currentFolderIndex].tasks = folders[currentFolderIndex].tasks.concat(importedData);
                } else if (importedData.title && Array.isArray(importedData.steps)) {
                    folders[currentFolderIndex].tasks.push(importedData);
                } else {
                    throw new Error('Formato de archivo no válido');
                }
                saveFolders();
                renderApp();
            } catch (error) {
                alert('Error al importar las tareas. Asegúrate de que el archivo es válido.');
            }
        };
        reader.readAsText(file);
    };
    input.click();
}

// Funciones de arrastrar y soltar utilizando SortableJS
function setupDragAndDrop() {
    // Reordenar carpetas
    if (currentFolderIndex === null) {
        const folderList = document.getElementById('folderList');
        Sortable.create(folderList, {
            animation: 150,
            handle: '.grip',
            onEnd: function (evt) {
                const movedFolder = folders.splice(evt.oldIndex, 1)[0];
                folders.splice(evt.newIndex, 0, movedFolder);
                saveFolders();
                renderApp();
            },
        });
    } else {
        // Reordenar tareas
        const taskList = document.getElementById('taskList');
        Sortable.create(taskList, {
            animation: 150,
            handle: '.grip',
            onEnd: function (evt) {
                const tasks = folders[currentFolderIndex].tasks;
                const movedTask = tasks.splice(evt.oldIndex, 1)[0];
                tasks.splice(evt.newIndex, 0, movedTask);
                saveFolders();
                renderApp();
            },
        });

        // Reordenar pasos en cada tarea
        const stepLists = document.querySelectorAll('.step-list');
        stepLists.forEach((stepList) => {
            const taskIndex = parseInt(stepList.getAttribute('data-task-index'));
            Sortable.create(stepList, {
                animation: 150,
                handle: '.grip',
                onEnd: function (evt) {
                    const steps = folders[currentFolderIndex].tasks[taskIndex].steps;
                    const movedStep = steps.splice(evt.oldIndex, 1)[0];
                    steps.splice(evt.newIndex, 0, movedStep);
                    saveFolders();
                    renderApp();
                },
            });
        });
    }
}

/* ----------------------------
   REGISTRO DEL SERVICE WORKER
   ---------------------------- */
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('./service-worker.js')
            .then(() => console.log('Service Worker registrado correctamente.'))
            .catch(err => console.error('Error al registrar Service Worker:', err));
    });
}
