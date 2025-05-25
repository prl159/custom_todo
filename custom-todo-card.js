class CustomTodoCard extends HTMLElement {
  set hass(hass) {
    const config = this._config;
    if (!config.name) throw new Error("Card 'name' is required");

    const entityId = `sensor.custom_todo_${config.name.toLowerCase().replace(/[^a-z0-9_]+/g, '_')}`;
    const entity = hass.states[entityId];

    let tasks = entity?.attributes?.tasks || [];

    // Add persistent ID if missing
    tasks = tasks.map(task => ({
      ...task,
      id: task.id ?? `${task.name.toLowerCase().replace(/\W/g, "_")}_${Date.now()}`
    }));

    // Sort alphabetically (case-insensitive)
    tasks.sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));

    const existingInput = this.querySelector?.('#new-task-input');
    const inputValue = existingInput?.value ?? '';
    const wasFocused = document.activeElement === existingInput;

    const incomplete = tasks.filter(t => !t.checks.every(c => c));
    const completed = tasks.filter(t => t.checks.every(c => c));

    this.innerHTML = `
      <ha-card header="${config.title || 'Custom Todo'}">
        <div class="card-content">
          ${!entity ? `
            <div class="warning">
              🚫 Entity <code>${entityId}</code> not found.
            </div>` : `
            <div class="add-row">
              <input id="new-task-input" type="text" placeholder="New task name">
              <button id="add-task-button">Add</button>
            </div>

            ${tasks.length === 0 ? `<div class="no-tasks">📭 No tasks</div>` : ''}

            ${incomplete.length > 0 ? `<div class="section"><div class="section-title">In Progress</div>${incomplete.map((task) => this.renderTask(task)).join('')}</div>` : ''}
            ${completed.length > 0 ? `<div class="section"><div class="section-title">Completed</div>${completed.map((task) => this.renderTask(task)).join('')}</div>` : ''}
          `}
        </div>
      </ha-card>
      <style>
        .card-content { padding: 0 16px 16px; }
        .task-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 8px 0;
          border-bottom: 1px solid var(--divider-color, #e0e0e0);
        }
        .task-name { flex-grow: 1; font-size: 1rem; }
        .checkbox-group {
          display: flex;
          align-items: center;
        }
        .checkbox-group input {
          margin-left: 6px;
          transform: scale(1.2);
        }
        .delete-btn {
          background: none;
          border: none;
          color: var(--error-color, red);
          font-size: 1.2rem;
          margin-left: 10px;
          cursor: pointer;
        }
        .section-title {
          font-size: 0.9rem;
          font-weight: bold;
          margin: 16px 0 4px;
        }
        .add-row {
          display: flex;
          gap: 8px;
          margin-bottom: 16px;
        }
        .add-row input {
          flex-grow: 1;
          padding: 6px 8px;
        }
        .add-row button {
          background: var(--primary-color);
          color: white;
          border: none;
          padding: 6px 12px;
          border-radius: 4px;
          cursor: pointer;
        }
        .no-tasks {
          text-align: center;
          color: var(--secondary-text-color);
          font-style: italic;
        }
        .warning {
          background: #fff3cd;
          padding: 12px;
          border: 1px solid #ffeeba;
          border-radius: 4px;
          margin: 8px 0;
          font-size: 0.9rem;
        }
      </style>
    `;

    const inputBox = this.querySelector('#new-task-input');
    if (inputBox) {
      inputBox.value = inputValue;
      if (wasFocused) {
        inputBox.focus();
        inputBox.setSelectionRange(inputValue.length, inputValue.length);
      }
    }

    if (!entity) return;

    this.attachCheckboxHandlers(hass, entityId, tasks);
    this.attachAddButtonHandler(hass, entityId, tasks);
    this.attachDeleteButtonHandlers(hass, entityId, tasks);
  }

  renderTask(task) {
    return `
      <div class="task-row">
        <div class="task-name">${task.name}</div>
        <div class="checkbox-group">
          ${[0, 1, 2, 3, 4].map(j => `
            <input type="checkbox" ${task.checks[j] ? 'checked' : ''} data-id="${task.id}" data-name="${task.name}" data-check="${j}">
          `).join('')}
          <button class="delete-btn" data-id="${task.id}" title="Remove task">✖</button>
        </div>
      </div>
    `;
  }

  attachCheckboxHandlers(hass, entityId, tasks) {
    this.querySelectorAll('input[type="checkbox"]').forEach(input => {
      input.addEventListener('change', (e) => {
        const taskId = e.target.dataset.id;
        const taskName = e.target.dataset.name;
        const checkIdx = parseInt(e.target.dataset.check);

        const task = tasks.find(t => t.id === taskId && t.name === taskName);
        if (!task) return;

        task.checks[checkIdx] = e.target.checked;
        this.publishTasks(hass, entityId, tasks);
      });
    });
  }

  attachAddButtonHandler(hass, entityId, tasks) {
    const input = this.querySelector('#new-task-input');
    const button = this.querySelector('#add-task-button');

    if (!input || !button) return;

    button.addEventListener('click', () => {
      const name = input.value.trim();
      if (!name) return;

      const alreadyExists = tasks.some(t => t.name.toLowerCase() === name.toLowerCase());
      if (alreadyExists) {
        alert("A task with this name already exists.");
        return;
      }

      const newTask = {
        name,
        checks: [false, false, false, false, false],
        id: `${name.toLowerCase().replace(/\W/g, "_")}_${Date.now()}`
      };

      const updatedTasks = [...tasks, newTask];
      this.publishTasks(hass, entityId, updatedTasks);
      input.value = '';
    });
  }

  attachDeleteButtonHandlers(hass, entityId, tasks) {
    this.querySelectorAll('.delete-btn').forEach(button => {
      button.addEventListener('click', (e) => {
        const taskId = e.target.dataset.id;
        const updatedTasks = tasks.filter(t => t.id !== taskId);
        this.publishTasks(hass, entityId, updatedTasks);
      });
    });
  }

  publishTasks(hass, entityId, tasks) {
    const topicBase = entityId.replace("sensor.custom_todo_", "");
    const topic = `home/custom_todo/${topicBase}/attributes`;

    hass.callService("script", "set_custom_todo_mqtt", {
      topic,
      tasks
    });
  }

  setConfig(config) {
    this._config = config;
  }

  getCardSize() {
    return 3;
  }
}

customElements.define('custom-todo-card', CustomTodoCard);

window.customCards = window.customCards || [];
window.customCards.push({
  type: 'custom-todo-card',
  name: 'Custom Todo Card (Sorted & Deletable)',
  description: 'Alphabetically sorted task list with checkbox tracking and delete buttons'
});
