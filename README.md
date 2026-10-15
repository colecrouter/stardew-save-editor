# Stardew Valley Save Editor

> [!IMPORTANT]
> [Link to editor here](https://adam110th.github.io/stardew-save-editor/)

A web-based save editor for Stardew Valley. Safely edit your save files directly in your browser.

## Features

### Current Features

- ✅ Character Customization
  - Edit appearance, name, and farm name
  - Modify skills and money
  - Change relationships with NPCs, with each villager's description and loved gifts
- ✅ Inventory Management  
  - Add/remove items
  - Modify existing items
- ✅ Recipe Management
  - Unlock cooking recipes
  - Unlock crafting recipes
  - See each recipe's item description
- ✅ Farm Settings
  - Edit farm name, profit margin (any percentage), monster spawning and mine rewards
  - View settings fixed at farm creation (farm type, random seed, and more)
- ✅ Buildings
  - Edit farm animals in barns and coops
  - See each building's description and build cost (gold and materials)
- ✅ Save Management
  - Switch between farmhands
  - Automatic save backups
  - Cross-platform support

### Planned Features

- 🔄 Animal editing
  - Add new animals to existing barns and coops
- 🔄 Building management
  - Add new buildings to the farm
- 🔄 Weather/calendar controls
- 🔄 Community Center bundle management
  - Finish the bundles page (currently marked "under construction")
- 🔄 Quest management
- 🔄 Fill gaps in existing menus
  - Audit each menu against the save data for editable fields not yet exposed
    (e.g. is a tool's weight stored in the save, and can it be edited?)
- 🔄 Event management
  - View and edit which events the player has seen (the save's `eventsSeen` list), e.g. to replay heart events or skip cutscenes
  - Name each event using the [List of Vanilla Event IDs](https://stardewmodding.wiki.gg/wiki/List_of_Vanilla_Event_IDs)
- 🔄 Full code and security review of this fork

## Usage

1. Visit the [live editor](https://adam110th.github.io/stardew-save-editor/)
2. Backup your original save file
3. Upload your save file
4. Make your desired changes
5. Download the modified save
6. Replace your original save with the modified version

> [!WARNING]
> Always backup your save files before editing. Save editing can potentially corrupt files or cause unexpected game behavior.

## Compatibility

### Game Versions

- ✅ Stardew Valley 1.6.x (fully supported)
- ❌ Stardew Valley 1.5.x (no longer supported)

### Platforms

- ✅ Windows/macOS/Linux
- ✅ Android/iOS
- 🟡 Switch/PlayStation (see [SUPPORT.md](./SUPPORT.md))

## Development

See [CONTRIBUTING.md](CONTRIBUTING.md) for detailed development setup and contribution guidelines.

## Legal

This project uses assets from Stardew Valley under Fair Use. These assets are owned by ConcernedApe and are not covered by this project's license. See [LICENSE.md](./LICENSE.md) for details.
