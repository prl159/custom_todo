class CustomTodoCard extends HTMLElement {
  constructor() {
    super();
    const stored = JSON.parse(localStorage.getItem("custom_todo_expand_state") || "{}");
    this._expandedGroups = stored.groups || {};
    this._showCompleted = stored.completed ?? false;
    this._filter = stored.filter ?? '';
  }

  set hass(hass) {
    this._hass = hass;
    const config = this._config;
    const groupCols = config.no_grouped_columns || 1;
    if (!config.name) throw new Error("Card 'name' is required");

    const entityId = `sensor.custom_todo_${config.name.toLowerCase().replace(/[^a-z0-9_]+/g, '_')}`;
    const entity = hass.states[entityId];

    let tasks = entity?.attributes?.tasks || [];
    tasks = tasks.map(task => ({
      ...task,
      id: task.id ?? `${task.name.toLowerCase().replace(/\W/g, "_")}_${Date.now()}`
    }));

    if (this._filter?.length > 0) {
      const keyword = this._filter.toLowerCase();
      tasks = tasks.filter(t => t.name.toLowerCase().includes(keyword) || (t.type || '').toLowerCase().includes(keyword));
    }

    tasks.sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));

    const existingInput = this.querySelector?.('#new-task-input');
    const inputValue = existingInput?.value ?? '';
    const wasFocused = document.activeElement === existingInput;

    const incomplete = tasks.filter(t => !t.checks.every(c => c));
    const completed = tasks.filter(t => t.checks.every(c => c));

    const grouped = {};
    for (const task of incomplete) {
      const group = task.type || "Ungrouped";
      if (!grouped[group]) grouped[group] = [];
      grouped[group].push(task);
    }

    const groupHtml = Object.entries(grouped).map(([type, items]) => {
      const open = this._expandedGroups[type] ?? true;
      return `
        <div class="group">
          <h3 class="group-title" data-group="${type}">
            <span class="caret">${open ? "▼" : "▶"}</span> ${type}
          </h3>
          <div class="group-tasks" data-container="${type}" style="display:${open ? "grid" : "none"}; grid-template-columns: repeat(auto-fill, minmax(calc(100% / ${groupCols}), 1fr)); gap: 8px;">
            ${items.map(task => this.renderTask(task)).join('')}
          </div>
        </div>
      `;
    }).join('');

    const completedOpen = this._showCompleted;
    const completedHtml = `
      <div class="group">
        <h2 class="group-title" data-completed>
          <span class="caret">${completedOpen ? "▼" : "▶"}</span> Completed
        </h2>
        <div class="group-tasks" data-container="completed" style="display:${completedOpen ? "block" : "none"};">
          ${completed.map(task => this.renderTask(task)).join('')}
        </div>
      </div>
    `;

    let content = '';
    if (!entity) {
      content = `<div class="warning">🚫 Entity <code>${entityId}</code> not found.</div>`;
    } else {
      content = `
        <div class="add-row">
          <input id="new-task-input" type="text" placeholder="New task name">
          <button id="add-task-button">Add</button>
        </div>
        <div class="search-row">
          <input id="search-task-input" type="text" placeholder="Search..." value="${this._filter || ''}">
        </div>
        ${(tasks.length === 0) ? '<div class="no-tasks">📭 No tasks</div>' : ''}
        <h2 class="section-title">In Progress</h2>
        ${groupHtml}
        ${(completed.length > 0) ? completedHtml : ''}
      `;
    }

    this.innerHTML = `
      <ha-card header="${config.title || 'Custom Todo'}">
        <div class="card-content">
          ${content}
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
        .group-title {
          margin: 16px 0 8px;
          cursor: pointer;
        }
        .section-title {
          margin: 24px 0 12px;
        }
        .caret {
          font-size: 0.9rem;
          margin-right: 4px;
        }
        .add-row, .search-row {
          display: flex;
          gap: 8px;
          margin-bottom: 16px;
        }
        .add-row input, .search-row input {
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
        @media (max-width: 600px) {
          .group-tasks {
            grid-template-columns: 1fr !important;
          }
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

    const searchBox = this.querySelector('#search-task-input');
    if (searchBox) {
      searchBox.addEventListener('input', (e) => {
        this._filter = e.target.value;
        this._saveExpandState();
        this.setHass(this._hass);
      });
    }

    if (!entity) return;
    this.attachCheckboxHandlers(hass, entityId, tasks);
    this.attachAddButtonHandler(hass, entityId, tasks);
    this.attachDeleteButtonHandlers(hass, entityId, tasks);
    this.attachToggleHandlers();
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

  attachToggleHandlers() {
    this.querySelectorAll('[data-group]').forEach(el => {
      el.addEventListener('click', () => {
        const group = el.dataset.group;
        this._expandedGroups[group] = !this._expandedGroups[group];
        this._saveExpandState();
        const container = this.querySelector(`[data-container="${group}"]`);
        if (container) container.style.display = this._expandedGroups[group] ? 'grid' : 'none';
        el.querySelector('.caret').textContent = this._expandedGroups[group] ? '▼' : '▶';
      });
    });
    this.querySelectorAll('[data-completed]').forEach(el => {
      el.addEventListener('click', () => {
        this._showCompleted = !this._showCompleted;
        this._saveExpandState();
        const container = this.querySelector('[data-container="completed"]');
        if (container) container.style.display = this._showCompleted ? 'block' : 'none';
        el.querySelector('.caret').textContent = this._showCompleted ? '▼' : '▶';
      });
    });
  }

  _saveExpandState() {
    localStorage.setItem("custom_todo_expand_state", JSON.stringify({
      groups: this._expandedGroups,
      completed: this._showCompleted,
      filter: this._filter
    }));
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
  name: 'Custom Todo Card',
  description: 'Todo card with groups, search, persistent state, and MQTT support'
});
