class CustomTodoCard extends HTMLElement {
  constructor() {
    super();
    this.sectionStates = { 'In Progress': true, 'Completed': true };
    this.groupStates = {};
    this.filterText = '';
  }

  set hass(hass) {
    const config = this._config;
    if (!config.name) throw new Error("Card 'name' is required");
    const ticks = Number(config.no_of_ticks || 1);

    const entityId = `sensor.custom_todo_${config.name.toLowerCase().replace(/[^a-z0-9_]+/g, '_')}`;
    const entity = hass.states[entityId];
    const existingInput = this.querySelector?.('#new-task-input');
    const existingFilter = this.querySelector?.('#search-task-input');
    const inputValue = existingInput ? existingInput.value : '';
    const filterValue = existingFilter ? existingFilter.value : this.filterText;
    const tasks = entity?.attributes?.tasks || [];

    this.innerHTML = `
      <ha-card header="${config.title || 'Custom Todo'}">
        <div class="card-content">
          ${!entity ? `<div class="warning">🚫 Entity <code>${entityId}</code> not found.</div>` : `
            <div class="add-row">
              <input id="new-task-input" type="text" placeholder="New task name">
              <button id="add-task-button">Add</button>
            </div>
            <div class="search-row">
              <input id="search-task-input" type="text" placeholder="Search tasks..." value="${filterValue}">
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
        h2.toggle, h3.toggle {
          cursor: pointer;
          display: flex;
          align-items: center;
          gap: 8px;
        }
        h2.toggle::before, h3.toggle::before {
          content: '\25BC';
          display: inline-block;
          transition: transform 0.2s ease-in-out;
        }
        h2.toggle.collapsed::before, h3.toggle.collapsed::before {
          transform: rotate(-90deg);
        }
        .add-row, .search-row { display: flex; gap: 8px; margin-bottom: 16px; }
        .add-row input, .search-row input { flex-grow: 1; padding: 6px 8px; }
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

    const searchInput = this.querySelector('#search-task-input');
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        this.filterText = e.target.value.trim().toLowerCase();
        this.setHass(this._hass);
      });
    }

    setTimeout(() => {
      this.renderGroupedTasks(tasks, ticks);
      this.attachCheckboxHandlers(hass, entityId, tasks);
      this.attachAddButtonHandler(hass, entityId, tasks, ticks);
    }, 0);
  }

  renderGroupedTasks(tasks, ticks) {
    const filter = this.filterText;
    const visibleTasks = filter ? tasks.filter(t => t.name.toLowerCase().includes(filter)) : tasks;

    const inProgress = visibleTasks.filter(t => !t.checks.every(c => c));
    const completed = visibleTasks.filter(t => t.checks.every(c => c));

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
          ${Array.from({ length: ticks }).map((_, j) => `
            <input type="checkbox" ${task.checks[j] ? 'checked' : ''} data-name="${task.name}" data-check="${j}">
          `).join('')}
        </div>
      </div>
    `;

    const renderGrouped = (tasks, section) => {
      const grouped = groupByType(tasks);
      return Object.entries(grouped).map(([type, items]) => {
        const groupId = `${section}-${type}`.replace(/\s+/g, '_');
        const collapsed = this.groupStates[groupId] === false;
        return `
          <h3 class="toggle ${collapsed ? 'collapsed' : ''}" data-group-id="${groupId}">${type}</h3>
          <div class="group-content" style="display: ${collapsed ? 'none' : 'block'}" data-group-id="${groupId}">
            ${items.map(renderTask).join('')}
          </div>
        `;
      }).join('');
    };

    const setSection = (id, label, tasks) => {
      const sectionEl = this.querySelector(`#${id}`);
      const collapsed = this.sectionStates[label] === false;
      sectionEl.innerHTML = tasks.length
        ? `<h2 class="toggle ${collapsed ? 'collapsed' : ''}" data-section="${label}">${label}</h2>
           <div class="section-content" style="display: ${collapsed ? 'none' : 'block'}">
             ${renderGrouped(tasks, label)}
           </div>` : '';
    };

    setSection('in-progress-section', 'In Progress', inProgress);
    setSection('completed-section', 'Completed', completed);

    this.querySelectorAll('h2.toggle').forEach(h2 => {
      h2.addEventListener('click', () => {
        const label = h2.dataset.section;
        this.sectionStates[label] = !this.sectionStates[label];
        this.setHass(this._hass);
      });
    });

    this.querySelectorAll('h3.toggle').forEach(h3 => {
      h3.addEventListener('click', () => {
        const groupId = h3.dataset.groupId;
        this.groupStates[groupId] = !this.groupStates[groupId];
        this.setHass(this._hass);
      });
    });
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

  attachAddButtonHandler(hass, entityId, tasks, ticks) {
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
      const updatedTasks = [...tasks, { name, type: 'Unsorted', checks: Array(ticks).fill(false) }];
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

  setHass(hass) {
    this._hass = hass;
    this.hass = hass;
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
  description: 'Grouped by type, collapsible, filterable, stored in MQTT via backend script'
});
