class CustomTodoCard extends HTMLElement {
  set hass(hass) {
    const config = this._config;

    if (!Array.isArray(config.tasks) && !config.entity) {
      throw new Error("Either 'tasks' or 'entity' must be provided");
    }

    let tasks = [];

    if (Array.isArray(config.tasks)) {
      tasks = config.tasks;
    } else if (config.entity && hass.states[config.entity]) {
      try {
        const data = JSON.parse(hass.states[config.entity].state || '{}');
        tasks = data.tasks || [];
      } catch {
        tasks = [];
      }
    }

    const incomplete = tasks.filter(t => !t.checks.every(c => c));
    const completed = tasks.filter(t => t.checks.every(c => c));

    this.innerHTML = \`
      <ha-card header="\${config.title || 'Todo Progress'}">
        <div class="card-content">
          <div class="add-row">
            <input id="new-task-input" type="text" placeholder="New task name">
            <button id="add-task-button">Add</button>
          </div>

          \${tasks.length === 0 ? \`<div class="no-tasks">📭 No entities</div>\` : ''}

          \${incomplete.length > 0 ? \`<div class="section"><div class="section-title">In Progress</div>\${incomplete.map((task, i) => this.renderTask(task, i)).join('')}</div>\` : ''}
          \${completed.length > 0 ? \`<div class="section"><div class="section-title">Completed</div>\${completed.map((task, i) => this.renderTask(task, i)).join('')}</div>\` : ''}
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
          accent-color: var(--primary-color);
        }
        .section-title {
          font-size: 0.9rem;
          font-weight: bold;
          margin: 16px 0 4px;
          color: var(--primary-text-color);
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
          margin-top: 1em;
        }
      </style>
    \`;

    this.attachCheckboxHandlers(tasks, hass);
    this.attachAddButtonHandler(tasks, hass, config.entity);
  }

  renderTask(task, i) {
    return \`
      <div class="task-row">
        <div class="task-name">\${task.name}</div>
        <div class="checkbox-group">
          \${[0,1,2,3,4].map(j => \`
            <input type="checkbox" \${task.checks[j] ? 'checked' : ''} data-task="\${i}" data-check="\${j}">
          \`).join('')}
        </div>
      </div>
    \`;
  }

  attachCheckboxHandlers(tasks, hass) {
    this.querySelectorAll('input[type="checkbox"]').forEach(input => {
      input.addEventListener('change', (e) => {
        const taskIdx = parseInt(e.target.dataset.task);
        const checkIdx = parseInt(e.target.dataset.check);
        const newTasks = JSON.parse(JSON.stringify(tasks));
        newTasks[taskIdx].checks[checkIdx] = e.target.checked;

        if (this._config.entity) {
          hass.callService('input_text', 'set_value', {
            entity_id: this._config.entity,
            value: JSON.stringify({ tasks: newTasks })
          });
        }
      });
    });
  }

  attachAddButtonHandler(tasks, hass, entity_id) {
    const input = this.querySelector('#new-task-input');
    const button = this.querySelector('#add-task-button');

    button.addEventListener('click', () => {
      const name = input.value.trim();
      if (!name) return;

      const updatedTasks = [...tasks, { name, checks: [false, false, false, false, false] }];

      if (entity_id) {
        hass.callService('input_text', 'set_value', {
          entity_id,
          value: JSON.stringify({ tasks: updatedTasks })
        });
      }

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
  description: 'A to-do list with 5 checkboxes per item.'
});
