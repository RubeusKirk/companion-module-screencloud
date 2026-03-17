## [1.0.1] - 2026-03-15

### New (Features)
- Deep Scan Feature (Switch Test): An active scanner tests all loaded channels on the server. Channels blocked by the API with a NOT_FOUND error (“zombies”) are automatically blacklisted and removed from the dropdown menus.
- Selectable target screen for scan: The Deep Scan can now be routed to a specific monitor (e.g., an invisible dummy screen) so that live monitors do not flicker during the scan.
- Live variables for scanner: New variables indicate whether the scan is currently running (true/false) and what percentage has already been completed (e.g., 45%).
- New “Deep-Scan running” feedback: Turns the scan button red while the scan is active.

### Added
- Persistent blacklist for invalid channels in the instance configuration.
- Filter for system channels (Blank/Brand Channel).
- Screens and channels now appear in alphabetical order.
- The GraphQL endpoint can now be entered manually (EU server by default)

### Fixed
- Fixed an issue with duplicates in the channel list.
- Fixed a crash caused by invalid screen data (scope error).