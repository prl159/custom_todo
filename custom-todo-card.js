class CustomTodoCard extends HTMLElement {
  set hass(hass) {
    console.log("Card set hass() triggered");

    const config = this._config;
    if (!config.name) throw new Error("Card 'name' is required");

    const entityId = `sensor.custom_todo_${config.name.toLowerCase().replace(/[^a-z0-9_]+/g, '_')}`;
    const entity = hass.states[entityId];

    let tasks = this._overrideTasks || entity?.attributes?.tasks || [];
    const taskJson = JSON.stringify(tasks);

    if (this._overrideTasks && JSON.stringify(entity?.attributes?.tasks || []) === taskJson) {
      console.log("HA state has caught up. Clearing overrideTasks.");
      this._overrideTasks = null;
    }

    if (this._lastTaskJson && taskJson === this._lastTaskJson) {
      console.log("No changes in task list. Skipping re-render.");
      return;
    }

    console.log("Rendering with task list:", tasks);
    this._lastTaskJson = taskJson;

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
        .checkbox-group input {
          margin-left: 6px;
          transform: scale(1.2);
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

    this.attachCheckboxHandlers(hass, entityId);
    this.attachAddButtonHandler(hass, entityId);
  }

  renderTask(task) {
    return `
      <div class="task-row">
        <div class="task-name">${task.name}</div>
        <div class="checkbox-group">
          ${[0, 1, 2, 3, 4].map(j => `
            <input type="checkbox" ${task.checks[j] ? 'checked' : ''} data-name="${task.name}" data-check="${j}">
          `).join('')}
        </div>
      </div>
    `;
  }

  attachCheckboxHandlers(hass, entityId) {
    this.querySelectorAll('input[type="checkbox"]').forEach(input => {
      input.addEventListener('change', (e) => {
        const taskName = e.target.dataset.name;
        const checkIdx = parseInt(e.target.dataset.check);

        const entity = hass.states[entityId];
        const tasks = JSON.parse(JSON.stringify(entity?.attributes?.tasks || []));
        const task = tasks.find(t => t.name === taskName);
        if (!task) return;

        task.checks[checkIdx] = e.target.checked;
        console.log("Checkbox updated:", tasks);
        this._lastTaskJson = '';
        this._overrideTasks = tasks;
        this.publishTasks(hass, entityId, tasks);
      });
    });
  }

  attachAddButtonHandler(hass, entityId) {
    const input = this.querySelector('#new-task-input');
    const button = this.querySelector('#add-task-button');

    if (!input || !button) return;

    button.addEventListener('click', () => {
      const name = input.value.trim();
      if (!name) return;

      console.log("Add button clicked");

      const entity = hass.states[entityId];
      const tasks = JSON.parse(JSON.stringify(entity?.attributes?.tasks || []));

      const alreadyExists = tasks.some(t => t.name.toLowerCase() === name.toLowerCase());
      if (alreadyExists) {
        alert("A task with this name already exists.");
        return;
      }

      const updatedTasks = [...tasks, { name, checks: [false, false, false, false, false] }];
      console.log("Sending task to script:", updatedTasks);
      this._lastTaskJson = '';
      this._overrideTasks = updatedTasks;
      this.publishTasks(hass, entityId, updatedTasks);
      input.value = '';
    });
  }

  publishTasks(hass, entityId, tasks) {
    const topicBase = entityId.replace("sensor.", "").replace(/_/g, "/");
    const topic = `home/custom_todo/${topicBase}/attributes`;
    const payload = {
      topic,
      tasks
    };

    console.log("Calling script.set_custom_todo_mqtt with:", payload);

    try {
      hass.callService("script", "set_custom_todo_mqtt", payload);
    } catch (err) {
      console.error("Failed to call script.set_custom_todo_mqtt:", err);
    }
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
  name: 'Custom Todo Card (Debug Service)',
  description: 'Card with logging to verify script service execution'
});
