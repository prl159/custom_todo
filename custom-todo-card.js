class CustomTodoCard extends HTMLElement {
  set hass(hass) {
    const config = this._config;
    if (!config.name) throw new Error("Card 'name' is required");

    const entityId = `sensor.custom_todo_${config.name.toLowerCase().replace(/[^a-z0-9_]+/g, '_')}`;
    const entity = hass.states[entityId];
    const existingInput = this.querySelector?.('#new-task-input');
    const inputValue = existingInput ? existingInput.value : '';
    const tasks = entity?.attributes?.tasks || [];

    this.innerHTML = `
      <ha-card header="${config.title || 'Custom Todo'}">
        <div class="card-content">
          ${!entity ? `<div class="warning">🚫 Entity <code>${entityId}</code> not found.</div>` : `
            <div class="add-row">
              <input id="new-task-input" type="text" placeholder="New task name">
              <button id="add-task-button">Add</button>
            </div>
            <div class="section" id="in-progress-section"></div>
            <div class="section" id="completed-section"></div>
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
          border-bottom: 1px solid var(--divider-color);
        }
        .task-name { flex-grow: 1; font-size: 1rem; }
        .checkbox-group input {
          margin-left: 6px;
          transform: scale(1.2);
        }
        h2 { margin-top: 1.5em; margin-bottom: 0.5em; font-size: 1.2em; }
        h3 { margin-top: 1em; margin-bottom: 0.2em; font-size: 1em; }
        .add-row { display: flex; gap: 8px; margin-bottom: 16px; }
        .add-row input { flex-grow: 1; padding: 6px 8px; }
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
    if (inputBox) inputBox.value = inputValue;
    if (!entity) return;

    setTimeout(() => {
      this.renderGroupedTasks(tasks);
      this.attachCheckboxHandlers(hass, entityId, tasks);
      this.attachAddButtonHandler(hass, entityId, tasks);
    }, 0);
  }

  renderGroupedTasks(tasks) {
    const inProgress = tasks.filter(t => !t.checks.every(c => c));
    const completed = tasks.filter(t => t.checks.every(c => c));

    const groupByType = (arr) => {
      return arr.reduce((acc, task) => {
        const type = task.type || 'Other';
        if (!acc[type]) acc[type] = [];
        acc[type].push(task);
        return acc;
      }, {});
    };

    const renderTask = (task) => `
      <div class="task-row">
        <div class="task-name">${task.name}</div>
        <div class="checkbox-group">
          ${[0,1,2,3,4].map(j => `
            <input type="checkbox" ${task.checks[j] ? 'checked' : ''} data-name="${task.name}" data-check="${j}">
          `).join('')}
        </div>
      </div>
    `;

    const renderGrouped = (tasks) => {
      const grouped = groupByType(tasks);
      return Object.entries(grouped).map(([type, items]) => `
        <h3>${type}</h3>
        ${items.map(renderTask).join('')}
      `).join('');
    };

    this.querySelector('#in-progress-section').innerHTML = inProgress.length
      ? `<h2>In Progress</h2>${renderGrouped(inProgress)}` : '';

    this.querySelector('#completed-section').innerHTML = completed.length
      ? `<h2>Completed</h2>${renderGrouped(completed)}` : '';
  }

  attachCheckboxHandlers(hass, entityId, tasks) {
    this.querySelectorAll('input[type="checkbox"]').forEach(input => {
      input.addEventListener('change', (e) => {
        const taskName = e.target.dataset.name;
        const checkIdx = parseInt(e.target.dataset.check);
        const updatedTasks = JSON.parse(JSON.stringify(tasks));
        const task = updatedTasks.find(t => t.name === taskName);
        if (!task) return;
        task.checks[checkIdx] = e.target.checked;
        this.publishTasks(hass, entityId, updatedTasks);
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
      const updatedTasks = [...tasks, { name, type: 'Unsorted', checks: [false, false, false, false, false] }];
      this.publishTasks(hass, entityId, updatedTasks);
      input.value = '';
    });
  }

  publishTasks(hass, entityId, tasks) {
    const topicBase = entityId.replace("sensor.", "").replace(/_/g, "/");
    hass.callService("script", "set_custom_todo_mqtt", {
      topic: `home/custom_todo/${topicBase}/attributes`,
      tasks: tasks
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
  name: 'Custom Todo Card (MQTT)',
  description: 'Grouped by type, stored in MQTT via script'
});
