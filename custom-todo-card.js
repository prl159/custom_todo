class CustomTodoCard extends HTMLElement {
  set hass(hass) {
    const config = this._config;

    if (!config.name) {
      throw new Error("Card 'name' is required to persist task data.");
    }

    const entityId = 'input_text.custom_todo_' + config.name.toLowerCase().replace(/[^a-z0-9_]+/g, '_').replace(/^_+|_+$/g, '');

    let tasks = [];
    if (hass.states[entityId]) {
      try {
        const parsed = JSON.parse(hass.states[entityId].state || '{}');
        tasks = parsed.tasks || [];
      } catch {
        tasks = [];
      }
    }

    const incomplete = tasks.filter(t => !t.checks.every(c => c));
    const completed = tasks.filter(t => t.checks.every(c => c));

    this.innerHTML = `
      <ha-card header="${config.title || 'Custom Todo'}">
        <div class="card-content">
          ${!hass.states[entityId] ? `
            <div class="warning">
              🛠 Entity <code>${entityId}</code> not found.<br>
              <button id="create-entity">Create it</button>
            </div>` : `
            <div class="add-row">
              <input id="new-task-input" type="text" placeholder="New task name">
              <button id="add-task-button">Add</button>
            </div>

            ${tasks.length === 0 ? `<div class="no-tasks">📭 No tasks</div>` : ''}

            ${incomplete.length > 0 ? `<div class="section"><div class="section-title">In Progress</div>${incomplete.map((task, i) => this.renderTask(task, i)).join('')}</div>` : ''}
            ${completed.length > 0 ? `<div class="section"><div class="section-title">Completed</div>${completed.map((task, i) => this.renderTask(task, i)).join('')}</div>` : ''}
          `}
        </div>
      </ha-card>

      <style>
        .card-content {
          padding: 0 16px 16px;
        }
        .task-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 8px 0;
          border-bottom: 1px solid var(--divider-color, #e0e0e0);
        }
        .task-name {
          flex-grow: 1;
          font-size: 1rem;
        }
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
        .warning button {
          margin-top: 6px;
        }
      </style>
    `;

    if (!hass.states[entityId]) {
      this.querySelector('#create-entity').addEventListener('click', () => {
        hass.callService('script', 'create_todo_entity', {
          name: config.name
        });
      });
      return;
    }

    this.attachCheckboxHandlers(tasks, hass, entityId);
    this.attachAddButtonHandler(hass, entityId);
  }

  renderTask(task, i) {
    return `
      <div class="task-row">
        <div class="task-name">${task.name}</div>
        <div class="checkbox-group">
          ${[0,1,2,3,4].map(j => `
            <input type="checkbox" ${task.checks[j] ? 'checked' : ''} data-task="${i}" data-check="${j}">
          `).join('')}
        </div>
      </div>
    `;
  }

  attachCheckboxHandlers(tasks, hass, entityId) {
    this.querySelectorAll('input[type="checkbox"]').forEach(input => {
      input.addEventListener('change', (e) => {
        const taskIdx = parseInt(e.target.dataset.task);
        const checkIdx = parseInt(e.target.dataset.check);
        const newTasks = JSON.parse(JSON.stringify(tasks));
        newTasks[taskIdx].checks[checkIdx] = e.target.checked;

        hass.callService('input_text', 'set_value', {
          entity_id: entityId,
          value: JSON.stringify({ tasks: newTasks })
        });
      });
    });
  }

  attachAddButtonHandler(hass, entityId) {
    const input = this.querySelector('#new-task-input');
    const button = this.querySelector('#add-task-button');

    button.addEventListener('click', () => {
      const name = input.value.trim();
      if (!name) return;

      let currentTasks = [];

      // Always fetch the latest state from HA
      try {
        const raw = hass.states[entityId].state;
        const parsed = JSON.parse(raw || '{}');
        currentTasks = parsed.tasks || [];
      } catch {
        currentTasks = [];
      }

      const updatedTasks = [...currentTasks, {
        name,
        checks: [false, false, false, false, false]
      }];

      hass.callService('input_text', 'set_value', {
        entity_id: entityId,
        value: JSON.stringify({ tasks: updatedTasks })
      });

      input.value = '';
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
  description: 'Stores all tasks in a single input_text.custom_todo_<name> entity.'
});
