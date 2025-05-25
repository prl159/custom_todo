# Custom Todo Card

A Lovelace card for Home Assistant that allows you to manage tasks with 5 checkboxes per item, grouped into "In Progress" and "Completed."

## Features

- Add tasks directly from the UI
- 5 progress checkboxes per task
- Grouped view for "In Progress" and "Completed"
- Stores state in `input_text.custom_todo`

## Installation

1. Add this repo as a custom repository in HACS (see below)
2. Install the card via HACS → Frontend
3. Add the resource manually if needed:

```yaml
- url: /hacsfiles/custom_todo/dist/customtodocard.js
  type: module
