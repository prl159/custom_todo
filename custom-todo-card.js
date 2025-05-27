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
          width: 100%;
          height: 40px;
          font-size: 1rem;
          padding: 8px;
          border: var(--input-border, 1px solid var(--divider-color));
          border-radius: var(--input-border-radius, 4px);
          background-color: var(--card-background-color);
          color: var(--primary-text-color);
        }
        .add-row button {
          height: 40px;
          font-size: 1rem;
          padding: 0 16px;
          margin-left: 8px;
        }
      `;
      this.appendChild(style);

      const typeInputHTML = containsType ? `<div class="type-row"><input id="new-type-input" type="text" placeholder="Type (optional)"></div>` : '';

      this.innerHTML += `
        <ha-card>
          <div class="card-header" style="display:flex; align-items:center; justify-content:space-between; padding: 16px; font-size: 1.1em;">
            <span style="font-weight:500;">${config.title || 'Custom Todo'}</span>
            <ha-icon icon="${config.icon || entity?.attributes?.icon || 'mdi:checkbox-marked-outline'}" style="color: var(--primary-text-color);"></ha-icon>
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

  // Placeholder for the rest of the class methods
  // e.g., renderTaskArea, renderTask, addTask, attachCheckboxHandlers, etc.

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
