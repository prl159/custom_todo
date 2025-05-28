# 📋 Custom Todo Card for Home Assistant

A powerful, instant-search-enabled, collapsible and grouped todo list card for Home Assistant with full MQTT state persistence.

---

## 🧩 Features

- ✅ Add, delete, and check off tasks
- ✅ Multi-step tasks with configurable checkboxes (`no_of_ticks`)
- ✅ Group tasks by type (optional)
- ✅ Collapsible sections per group, plus **Completed** and **In Progress**
- ✅ Persisted draft task input and search filter
- ✅ Instant filtering with Enter key support and debounce
- ✅ All changes published to MQTT via a Home Assistant script
- ✅ Responsive layout with configurable group columns

---

## 📸 Demo

![image](https://github.com/user-attachments/assets/ca87d851-9fe6-4455-8c7c-60c40ac14e71)

---

## ⚙️ Configuration

Add the following to your **Lovelace dashboard**:

```yaml
type: custom-todo-card
name: TodoList                   # required, used to build sensor ID
title: "My Tasks"                # optional card title
icon: mdi:clipboard-text         # optional icon
no_of_ticks: 3                   # optional, default is 1
contains_type: true              # optional, allows task grouping
no_grouped_columns: 2            # optional, default is 1
```

<script type="text/javascript" src="https://cdnjs.buymeacoffee.com/1.0.0/button.prod.min.js" data-name="bmc-button" data-slug="paullittlek" data-color="#FFDD00" data-emoji=""  data-font="Cookie" data-text="Buy me a coffee" data-outline-color="#000000" data-font-color="#000000" data-coffee-color="#ffffff" ></script>

[![Add to Home Assistant](https://my.home-assistant.io/badges/add_repository.svg)](https://my.home-assistant.io/redirect/supervisor_addons/?repository_url=https%3A%2F%2Fgithub.com%2Fpaullittledev%2Fcustom-todo-card)

---

## 🧪 Requirements

### 🟢 1. MQTT Sensor

Add this to your `configuration.yaml` or via the MQTT integration:

```yaml
sensor:
  - platform: mqtt
    name: "Custom Todo TodoList"
    state_topic: "home/custom_todo/todolist/attributes"
    json_attributes_topic: "home/custom_todo/todolist/attributes"
    value_template: "OK"
```

> Replace `todolist` with the **lowercased, underscore-safe** version of your `name:` field above.

---

### 🟢 2. Save Script

Define a script called `set_custom_todo_mqtt` in Home Assistant:

```yaml
script:
  set_custom_todo_mqtt:
    alias: "Set Custom Todo via MQTT"
    mode: queued
    fields:
      topic:
        description: "MQTT topic to publish to"
        example: "home/custom_todo/todolist/attributes"
      tasks:
        description: "Array of tasks to store"
        example: "[{ id: 'task_1', name: 'Buy milk', checks: [true] }]"
    sequence:
      - service: mqtt.publish
        data:
          topic: "{{ topic }}"
          payload: >
            { "tasks": {{ tasks | to_json }} }
          retain: true
```

This script:
- Publishes tasks to MQTT
- Ensures they’re retained for reboots
- Works with the sensor to auto-reload the list

---

## 📦 Task Format

Each task object looks like:

```json
{
  "id": "buy_milk_1701000000000",
  "name": "Buy milk",
  "type": "Shopping",        // optional
  "checks": [true, false, false] // length = no_of_ticks
}
```

---

## 🛠️ Advanced Options

| Config Option         | Description                                                                 |
|----------------------|-----------------------------------------------------------------------------|
| `no_of_ticks`         | Number of checkboxes per task (1–5 recommended)                            |
| `contains_type`       | Enable input for task "type" (used for grouping)                           |
| `no_grouped_columns`  | Columns in each group (responsive grid layout)                             |
| `title`               | Custom card title                                                          |
| `icon`                | Custom icon from [Material Design Icons](https://materialdesignicons.com/) |

---

## 💾 Persistent Storage

Stored in **localStorage**:
- Expanded/collapsed state per group
- Completed and In Progress toggle state
- Last search filter
- In-progress input drafts for task and type fields

Stored in **MQTT**:
- Full task list (checked, unchecked, grouped)

---

## 🚀 Future Ideas

- [ ] Edit existing task names
- [ ] Drag-to-reorder
- [ ] Sort by last updated
- [ ] Badge counters per section

---

## 🧑‍💻 Developer Notes

This card is written as a single `customElements.define` module with no build tools required.  
To use:
1. Copy the JS file to your `www/` folder (e.g., `www/custom-todo-card.js`)
2. Add to Lovelace resources:

```yaml
resources:
  - url: /local/custom-todo-card.js
    type: module
```

---

## 💬 Feedback

Found a bug? Want to add a feature?  
Open an issue or start a discussion here on GitHub!
