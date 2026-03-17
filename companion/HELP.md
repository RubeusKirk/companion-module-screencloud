# ScreenCloud Integration for Bitfocus Companion

This module enables full control and monitoring of ScreenCloud screens via Bitfocus Companion. It communicates directly with the ScreenCloud GraphQL API to switch channels, retrieve real-time status, and automatically filter out faulty channels using an intelligent deep scan.

---

## 1. Setup & Configuration

To connect the module to your ScreenCloud account, you need an API key (Personal Access Token).

1. Log in to your ScreenCloud web portal.
2. Navigate to your account settings / Developer / API Tokens.
3. Create a new token with read and write permissions (Read/Write).
4. Enter this **API key** in the configuration of this Companion module.
5. The **GraphQL endpoint** is preset to Europe (`https://graphql.eu.screencloud.com/graphql`) by default. If your account is hosted on a US server, adjust the URL according to the ScreenCloud documentation.
6. Click *Save* – the status should change to `OK` and the module will automatically load your available screens and channels.

---

## 2. Actions

* **Set Screen Content:** Assigns a specific channel to a specific screen. 
* **Deep-scan for dead channels:** Starts an automatic scan to identify and block “zombie channels” that are no longer functioning (see Section 5). Here, a dedicated target screen can (and should!) be selected for the test run.

---

## 3. Feedback

This module uses real “API feedback.” This means a button only lights up once the ScreenCloud server has officially confirmed the channel change.

* **Color active channel:** Changes the button’s color (default: green) when the selected channel is running on the selected screen. 
  * *Note on speed:* After pressing the button, it may take a few seconds for the button to turn green. The module waits for the actual confirmation from the API and does not “cheat” locally.
  * *Variable Name:* Here you can assign a name (e.g., `ch1`). The module then automatically creates a companion variable that permanently displays the name of the selected channel.
* **Deep-scan running:** Changes the color of a button (default: red) as long as the deep scan is active in the background.

---

## 4. Variables

The module provides global and dynamic variables:

* `$(Screencloud:scanning)`: Returns `true` or `false`, depending on whether the deep scan is currently running.
* `$(Screencloud:scan_progress)`: Displays the progress of the current scan as a percentage (e.g., `45%` or `Done`).
* **Dynamic Custom Labels:** If you assign a variable name (e.g., `ch1`) in the `Color active channel` feedback, the module creates the variable `$(Screencloud:ch1)`. This always displays the format `[Screen Name]: [Channel Name]`.

---

## 5. The Deep Scan & Dummy Screens

**The Problem:** Sometimes the ScreenCloud API returns channels that are internally broken. If you try to switch to such a channel, the API returns a `NOT_FOUND` error.
**The Solution:** The Deep Scan briefly tests all channels once. If the API throws an error, the channel ID is added to an invisible blacklist and no longer disrupts your workflow.

**Best Practice: Set up a dummy screen!**
Since the scanner switches between channels in a fraction of a second, real screens in your setup would flicker during the scan.
1. Create a new, fictitious screen in the ScreenCloud web portal (name it, for example, “Companion Scanner”).
2. Do **not** assign any real hardware to this screen.
3. In the Companion, click the dropdown next to your “Deep-scan” action and select this “Companion Scanner” as the target.
The scan will now run completely silently and invisibly in the background.

*(Tip: To unblock channels that were mistakenly blocked, simply delete the contents of the “Blacklisted channel IDs” field in the module settings).*

---

## 6. Tutorial: Building the Perfect Channel Button

Since actions and feedbacks work separately in Companion, here’s the quickest way to create perfect buttons:

1. **Create a master button:**
   * Add the `Set Screen Content` action and select Screen A and Channel 1.
   * Add the feedback `Color active channel`, also selecting Screen A and Channel 1.
   * In the feedback, enter a *Variable name* such as `ch1`.
   * In the button text (at the top in Companion), enter the variable: `$(Screencloud:ch1)`
2. **Copy & Customize:**
   * Copy this finished master button to other buttons.
   * All you need to do now is change the channel to “Channel 2” in the action and feedback, and increment the variable name in the feedback to `ch2`. The button text will update automatically!