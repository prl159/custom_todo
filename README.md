# Custom Todo Card

A Lovelace card for Home Assistant that tracks to-do tasks, each with 5 checkboxes. Tasks are stored centrally in a single `input_text` entity per card.

---

## ✅ Features

- Add unlimited to-do items
- Each item includes 5 checkbox slots
- Completed and In Progress sections
- Task data is stored centrally in Home Assistant
- State survives reboots and syncs across all devices
- One `input_text.custom_todo_<name>` per card instance

---

## 🚀 Usage

### 1. Card Configuration (Lovelace YAML or UI)

```yaml
type: custom:custom-todo-card
title: Baby Tasks
name: baby_tasks
