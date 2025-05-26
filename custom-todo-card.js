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

    this.innerHTML = `
      <ha-card header="${config.title || 'Custom Todo'}">
        <div class="card-content">
          ${!entity ? `
            <div class="warning">🚫 Entity <code>${entityId}</code> not found.</div>
          ` : `
            <div class="add-row">
              <input id="new-task-input" type="text" placeholder="New task name">
              <button id="add-task-button">Add</button>
            </div>
            <div class="search-row">
              <input id="search-task-input" type="text" placeholder="Search..." value="${this._filter || ''}">
            </div>
            ${tasks.length === 0 ? `<div class="no-tasks">📭 No tasks</div>` : ''}
            <h2 class="section-title">In Progress</h2>
            ${groupHtml}
            ${completed.length > 0 ? completedHtml : ''}
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
        localStorage.setItem("custom_todo_expand_state", JSON.stringify({
          groups: this._expandedGroups,
          completed: this._showCompleted,
          filter: this._filter
        }));
        this.setHass(this._hass);
      });
    }

    if (!entity) return;
    this.attachCheckboxHandlers(hass, entityId, tasks);
    this.attachAddButtonHandler(hass, entityId, tasks);
    this.attachDeleteButtonHandlers(hass, entityId, tasks);
    this.attachToggleHandlers();
  }

  // ... (rest of the code remains unchanged)
