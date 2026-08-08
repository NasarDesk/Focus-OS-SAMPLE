# Focus OS

This is the modular refactor of the working Focus OS single-file application.

## Runtime

- Static HTML/CSS/JavaScript; no build system required.
- External dependencies remain Chart.js 4.4.0 and jsPDF 2.5.1 via CDN.
- Open through a normal web server for deployment or local testing.

## Data safety

- Existing storage key remains `focusOS_data_v1`.
- Existing data structures, migration, backup, and restore code are unchanged.
- The original source files remain in the parent folder as untouched references.
