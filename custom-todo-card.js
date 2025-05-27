class CustomTodoCard extends HTMLElement {
  constructor() {
    super();
    this._configNameKey = null;
    this._expandedGroups = {};
    this._showCompleted = false;
    this._showInProgress = true;
    this._filter = '';
    this._draftNewTask = '';
    this._draftNewType = '';
    this._initialized = false;
  }

  set hass(hass) {
    this._hass = hass;
    const config = this._config;
    const tickCount = Number(config.no_of_ticks || 1);
    const groupCols = config.no_grouped_columns || 1;
    const containsType = !!config.contains_type;
    const nameKey = config.name.toLowerCase().replace(/[^a-z0-9_]+/g, '_');
    const entityId = `sensor.custom_todo_${nameKey}`;
    const entity = hass.states[entityId];

    if (!config.name) throw new Error("Card 'name' is required");

    this._configNameKey = nameKey;
    const expandKey = `custom_todo_expand_state_${nameKey}`;
    const draftKey = `custom_todo_draft_task_${nameKey}`;
    const draftTypeKey = `custom_todo_draft_type_${nameKey}`;

    const stored = JSON.parse(localStorage.getItem(expandKey) || "{}");
    this._expandedGroups = stored.groups || {};
    this._showCompleted = stored.completed ?? false;
    this._showInProgress = stored.inprogress ?? true;
    this._filter = stored.filter ?? '';
    this._draftNewTask = localStorage.getItem(draftKey) || '';
    this._draftNewType = localStorage.getItem(draftTypeKey) || '';

    let tasks = entity?.attributes?.tasks || [];
    tasks = tasks.map(task => ({
      ...task,
      checks: Array.isArray(task.checks)
        ? [...task.checks, ...Array(tickCount).fill(false)].slice(0, tickCount)
        : Array(tickCount).fill(false),
      id: task.id ?? `${task.name.toLowerCase().replace(/\W/g, "_")}_${Date.now()}`
    }));

    if (this._filter) {
      const kw = this._filter.toLowerCase();
      tasks = tasks.filter(t => (t.name?.toLowerCase().includes(kw) || false));
    }

    if (!this._initialized) {
      const style = document.createElement('style');
      style.textContent = `
        .task-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 8px;
        }
        .task-name {
          flex-grow: 1;
        }
        .checkbox-group {
          display: flex;
          align-items: center;
          gap: 4px;
        }
        .add-row input,
        .search-row input,
        .type-row input {
          width: 95%;
          height: 36px;
          font-size: 16px;
          padding: 4px 8px;
          margin-bottom: 8px;
        }
        .add-row button {
          height: 36px;
          margin-left: 8px;
        }
      `;
      this.appendChild(style);

      const typeInputHTML = containsType ? `<div class="type-row"><input id="new-type-input" type="text" placeholder="Type (optional)"></div>` : '';

      this.innerHTML = `
        <ha-card>
          <div class="card-header" style="display:flex; align-items:center; justify-content:space-between; padding: 16px; font-weight:500; font-size: 1.1em; cursor: pointer;">
            ${config.icon ? `<ha-icon icon="${config.icon}" style="margin-right: 8px;"></ha-icon>` : ''}
            <span>${config.title || 'Custom Todo'}</span>
          </div>
          <div class="card-content">
            <div class="add-row">
              <input id="new-task-input" type="text" placeholder="New task name">
              <button id="add-task-button">Add</button>
            </div>
            ${typeInputHTML}
            <div class="search-row">
              <input id="search-task-input" type="text" placeholder="Search...">
            </div>
            <div id="task-area"></div>
          </div>
        </ha-card>`;

      const searchInput = this.querySelector('#search-task-input');
      const newTaskInput = this.querySelector('#new-task-input');
      const newTypeInput = this.querySelector('#new-type-input');

      searchInput.value = this._filter;
      newTaskInput.value = this._draftNewTask;
      if (newTypeInput) newTypeInput.value = this._draftNewType;

      searchInput.addEventListener('input', e => {
        this._filter = e.target.value;
        this._saveExpandState();
        clearTimeout(this._filterDebounce);
        this._filterDebounce = setTimeout(() => this.setHass(hass), 100);
      });

      newTaskInput.addEventListener('input', () => {
        this._draftNewTask = newTaskInput.value;
        localStorage.setItem(draftKey, newTaskInput.value);
      });

      if (newTypeInput) {
        newTypeInput.addEventListener('input', () => {
          this._draftNewType = newTypeInput.value;
          localStorage.setItem(draftTypeKey, newTypeInput.value);
        });
      }

      this.querySelector('#add-task-button').addEventListener('click', () =>
        this.addTask(hass, entityId, tasks, tickCount, containsType)
      );

      this.querySelector('.card-header')?.addEventListener('click', () => {
        const taskArea = this.querySelector('#task-area');
        if (!taskArea) return;
        const isVisible = taskArea.style.display !== 'none';
        taskArea.style.display = isVisible ? 'none' : 'block';
        this._saveExpandState();
      });

      this._initialized = true;
    }

    this.renderTaskArea(tasks, tickCount, groupCols, entityId);
  }

  renderTaskArea(tasks, tickCount, groupCols, entityId) {
    const taskArea = this.querySelector('#task-area');
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
            ${items.map(task => this.renderTask(task, tickCount)).join('')}
          </div>
        </div>`;
    }).join('');

    const completedHtml = completed.length ? `
      <div class="group">
        <h2 class="group-title" data-completed>
          <span class="caret">${this._showCompleted ? "▼" : "▶"}</span> Completed
        </h2>
        <div class="group-tasks" data-container="completed" style="display:${this._showCompleted ? "block" : "none"};">
          ${completed.map(task => this.renderTask(task, tickCount)).join('')}
        </div>
      </div>` : '';

    const inProgressHtml = incomplete.length ? `
      <div class="group">
        <h2 class="group-title" data-inprogress>
          <span class="caret">${this._showInProgress ? "▼" : "▶"}</span> In Progress
        </h2>
        <div class="group-tasks" data-container="inprogress" style="display:${this._showInProgress ? "block" : "none"};">
          ${groupHtml}
        </div>
      </div>` : '';

    taskArea.innerHTML = `${tasks.length === 0 ? '<div class="no-tasks">📭 No tasks</div>' : ''}${inProgressHtml}${completedHtml}`;

    this.attachCheckboxHandlers(this._hass, entityId, tasks);
    this.attachDeleteButtonHandlers(this._hass, entityId, tasks);
    this.attachToggleHandlers();
  }

  renderTask(task, tickCount) {
    return `<div class="task-row">
      <div class="task-name">${task.name}</div>
      <div class="checkbox-group">
        ${Array.from({ length: tickCount }).map((_, i) =>
          `<input type="checkbox" ${task.checks[i] ? 'checked' : ''} data-id="${task.id}" data-check="${i}">`).join('')}
        <button class="delete-btn" data-id="${task.id}" title="Remove task">✖</button>
      </div>
    </div>`;
  }

  addTask(hass, entityId, tasks, tickCount, containsType) {
    const input = this.querySelector('#new-task-input');
    const typeInput = this.querySelector('#new-type-input');
    const name = input?.value.trim();
    const type = containsType ? (typeInput?.value.trim() || '') : undefined;
    if (!name) return;
    if (tasks.some(t => t.name.toLowerCase() === name.toLowerCase())) {
      alert("Task already exists."); return;
    }
    const task = {
      name,
      id: `${name.toLowerCase().replace(/\W/g, "_")}_${Date.now()}`,
      checks: Array(tickCount).fill(false)
    };
    if (containsType) task.type = type;
    this.publishTasks(hass, entityId, [...tasks, task]);
    input.value = '';
    if (typeInput) typeInput.value = '';
    localStorage.removeItem(`custom_todo_draft_task_${this._configNameKey}`);
    localStorage.removeItem(`custom_todo_draft_type_${this._configNameKey}`);
    this._draftNewTask = '';
    this._draftNewType = '';
  }

  attachCheckboxHandlers(hass, entityId, tasks) {
    this.querySelectorAll('input[type="checkbox"]').forEach(input => {
      input.addEventListener('change', e => {
        const id = e.target.dataset.id, check = +e.target.dataset.check;
        const task = tasks.find(t => t.id === id);
        if (!task) return;
        task.checks[check] = e.target.checked;
        this.publishTasks(hass, entityId, tasks);
      });
    });
  }

  attachDeleteButtonHandlers(hass, entityId, tasks) {
    this.querySelectorAll('.delete-btn').forEach(button =>
      button.addEventListener('click', e => {
        const id = e.target.dataset.id;
        this.publishTasks(hass, entityId, tasks.filter(t => t.id !== id));
      })
    );
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

    this.querySelectorAll('[data-inprogress]').forEach(el => {
      el.addEventListener('click', () => {
        this._showInProgress = !this._showInProgress;
        this._saveExpandState();
        const container = this.querySelector('[data-container="inprogress"]');
        if (container) container.style.display = this._showInProgress ? 'block' : 'none';
        el.querySelector('.caret').textContent = this._showInProgress ? '▼' : '▶';
      });
    });
  }

  _saveExpandState() {
    localStorage.setItem(`custom_todo_expand_state_${this._configNameKey}`, JSON.stringify({
      groups: this._expandedGroups,
      completed: this._showCompleted,
      inprogress: this._showInProgress,
      filter: this._filter
    }));
  }

  publishTasks(hass, entityId, tasks) {
    const topic = `home/custom_todo/${entityId.replace("sensor.custom_todo_", "")}/attributes`;
    hass.callService("script", "set_custom_todo_mqtt", { topic, tasks });
  }

  setConfig(config) { this._config = config; }
  getCardSize() { return 3; }
}

customElements.define('custom-todo-card', CustomTodoCard);

window.customCards = window.customCards || [];
window.customCards.push({
  type: 'custom-todo-card',
  name: 'Custom Todo Card',
  description: 'Todo card with grouping, filtering, collapsible sections, and MQTT state persistence'
});
