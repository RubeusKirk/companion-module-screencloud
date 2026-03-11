# ScreenCloud Controller



This module allows you to control ScreenCloud playlists (channels) on your screens directly via Bitfocus Companion.



### Features

\* Status overview: Current content per screen available as a variable.

\* Content change: Easy switching of playlists/channels on specific screens.

\* Feedback: Feedback system to show which channel is active on which screen.



### Setup

1\. Generate API key: Log in to your ScreenCloud account and generate an API key (bearer token) in the developer dashboard.

 	(Account Settings -> Developer) Make sure to give all permissions.

2\. Configuration:

   - Add the “ScreenCloud” instance in Companion.

   - Enter your API key in the configuration field.

   - The module automatically loads all available screens and channels.



### Actions

\* change screen content: Select a screen from the list and assign a channel to it.



### Feedback

\* color active: Changes the button color when a specific channel is active on a screen.



### Variables

\* $(Screencloud:status\_YOUR\_SCREEN): Provides feedback on what content is currently playing on the selected screen.

\* $(Screencloud:YOUR\_VARIABLE\_NAME): You can assign a separate variable name to each piece of feedback, which will then display the name of the selected channel.



### Troubleshooting

\* If no buttons appear: Check the log to see if the API key has been accepted correctly.

\* The list of screens/channels is automatically updated every 30 seconds.



### Support \& Issues

This module was developed for integration into ScreenCloud via GraphQL. If you encounter any errors or have feature requests, please create an issue in this repository.



### License

MIT

