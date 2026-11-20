/**
 * German for the interface's own text: screens, menus, labels and tips, keyed
 * the way tr() normalises them ({name} for the hero's name, {0}, {1}, … for
 * numbers). The story dictionary in de.ts wins wherever both have a key.
 */
export const DE_UI: Readonly<Record<string, string>> = {
  // An unnamed hero's title in saves from before the default name became Mr Mario.
  'Sound Keeper': 'Klanghüter',

  // The same in German; listed so the missing-key log shows only real gaps.
  'HP': 'HP',
  'XP': 'XP',
  'Max': 'Max',
  'Lv {0}': 'Lv {0}',
  'Level {0}': 'Level {0}',
  'Pause': 'Pause',
  'Pause (Esc)': 'Pause (Esc)',

  // Title screen and name dialog
  'Coming soon': 'Bald verfügbar',
  'Sound Quest is in development.': 'Sound Quest ist in Entwicklung.',
  // As short as the English: the tagline sits under the logo's wide letters.
  'Find the lost track': 'Finde den Lost Track',
  'Continue': 'Weiter',
  'New game': 'Neues Spiel',
  'Start game': 'Spiel starten',
  '{0}/{1} fragments': '{0}/{1} Fragmente',
  'or press any key': 'oder drück eine beliebige Taste',
  'What should we call you?': 'Wie sollen wir dich nennen?',
  'Characters in the world will greet you by this name.': 'Die Leute in der Welt begrüßen dich mit diesem Namen.',
  'A new journey replaces the saved one': 'Eine neue Reise ersetzt die gespeicherte',
  'level {0}': 'Level {0}',
  'Your name': 'Dein Name',
  'Up to {0} characters.': 'Bis zu {0} Zeichen.',
  'Back': 'Zurück',
  'Start journey': 'Reise beginnen',
  'Open world editor': 'Welt-Editor öffnen',

  // Loading screen
  'Loading the world': 'Die Welt lädt',

  // HUD
  'Player status': 'Spielerstatus',
  'Pause menu': 'Pausemenü',
  'Fragments': 'Fragmente',
  'Sound fragments: {0} of {1}': 'Klangfragmente: {0} von {1}',

  // Pause menu
  'Game paused': 'Spiel pausiert',
  'Settings': 'Einstellungen',
  'Music': 'Musik',
  'Music volume': 'Musiklautstärke',
  'Effects': 'Effekte',
  'Sound effects volume': 'Lautstärke der Soundeffekte',
  'Mute all sound': 'Alles stummschalten',
  'Shortcut: M, also in battle': 'Tastenkürzel: M, auch im Kampf',
  'Language': 'Sprache',
  'Resume': 'Weiter',
  'Sound': 'Ton',
  'Sound off': 'Ton aus',
  'Sound on': 'Ton an',
  'Press M to turn it back on.': 'Drück M, um den Ton wieder einzuschalten.',

  // Settings tip
  'Tip': 'Tipp',
  'Press Esc or the pause button to change music and sound volume.': 'Drück Esc oder den Pause-Button, um Musik und Sound lauter oder leiser zu stellen.',
  'Tap the pause button to change music and sound volume.': 'Tippe auf den Pause-Button, um Musik und Sound lauter oder leiser zu stellen.',

  // Dialogue box and touch controls
  'Tap to continue': 'Zum Fortfahren tippen',
  'Movement pad': 'Steuerkreuz',
  'Continue dialogue': 'Dialog fortsetzen',
  'Interact': 'Interagieren',
  'Next': 'Weiter',

  // Battle
  'Battle': 'Kampf',
  'Moves': 'Attacken',
  'Unlocks at level {0}': 'Ab Level {0} freigeschaltet',

  // Defeat screen
  // One line on a phone, like the English: a longer one wraps away from its dot.
  'The Gatekeeper silenced you': 'Der Gatekeeper war stärker',
  'Defeated by Static Noise': 'Besiegt von Static Noise',
  'Defeated by Broken Signal': 'Besiegt von Broken Signal',
  'Defeated by Silence': 'Besiegt von Silence',
  'You were defeated': 'Du wurdest besiegt',
  'Signal lost': 'Signal verloren',
  'You keep your level and XP, and wake up in Echo Village with full HP.': 'Du behältst Level und XP und wachst mit vollen HP in Echo Village auf.',
  'Level {0}, maximum level': 'Level {0}, Höchstlevel',
  'Level {0}, {1} of {2} XP to level {3}': 'Level {0}, {1} von {2} XP bis Level {3}',
  'Max level': 'Höchstlevel',
  '{0} XP to Lv {1}': 'Noch {0} XP bis Lv {1}',
  'The Gatekeeper hits harder once it drops to {0}% and again at {1}% health. Reach level {2} first to unlock Reverb Strike.':
    'Der Gatekeeper schlägt härter zu, sobald er auf {0}% fällt, und noch einmal bei {1}%. Erreiche vorher Level {2}, um Reverb Strike freizuschalten.',
  'The Gatekeeper hits harder once it drops to {0}% and again at {1}% health. Go in with full HP.':
    'Der Gatekeeper schlägt härter zu, sobald er auf {0}% fällt, und noch einmal bei {1}%. Geh mit vollen HP hinein.',
  'Battles in the tall grass earn XP. {0} more XP unlocks Echo Wave at level {1}.':
    'Kämpfe im hohen Gras bringen XP. Noch {0} XP, dann schaltest du auf Level {1} Echo Wave frei.',
  'Battles in the tall grass earn XP. {0} more XP unlocks Hook Impact at level {1}.':
    'Kämpfe im hohen Gras bringen XP. Noch {0} XP, dann schaltest du auf Level {1} Hook Impact frei.',
  'Battles in the tall grass earn XP. {0} more XP unlocks Reverb Strike at level {1}.':
    'Kämpfe im hohen Gras bringen XP. Noch {0} XP, dann schaltest du auf Level {1} Reverb Strike frei.',
  'Battles in the tall grass earn XP. {0} more XP unlocks a new move at level {1}.':
    'Kämpfe im hohen Gras bringen XP. Noch {0} XP, dann schaltest du auf Level {1} eine neue Attacke frei.',
  'Hurt after a fight? Talk to Professor Krys in Echo Village and she restores your HP.':
    'Verletzt nach einem Kampf? Sprich mit Professor Krys in Echo Village, sie füllt deine HP wieder auf.',
  'Reconnecting…': 'Verbinde neu…',
  'Respawn': 'Wiederbeleben',

  // Lost Track reward
  'Open the Lost Track': 'Lost Track öffnen',
  'Now playing': 'Läuft gerade',
  'Paused': 'Pausiert',
  'Ready to play': 'Bereit',
  'Quest complete': 'Quest abgeschlossen',
  'Recovered by': 'Zurückgeholt von',
  'Close': 'Schließen',
  'Lost Track recovered': 'Lost Track zurückgeholt',
  'Signal restored.': 'Signal wiederhergestellt.',
  "You broke the Gatekeeper's silence. This track is your reward. Press play and take it with you.":
    'Du hast die Stille des Gatekeepers gebrochen. Dieser Track ist deine Belohnung. Drück auf Play und nimm ihn mit.',
  'Track position': 'Position im Track',
  '{0}:{1} of {2}:{3}': '{0}:{1} von {2}:{3}',
  'Waveform unavailable.': 'Wellenform nicht verfügbar.',
  'Loading waveform…': 'Wellenform lädt…',
  'Play': 'Abspielen',
  'Save MP{0}': 'MP{0} speichern',
  'Volume': 'Lautstärke',
  'Muted': 'Stumm',
  'The song could not be played. Please try again.': 'Der Song konnte nicht abgespielt werden. Versuch es bitte noch einmal.',
  'Back to the world': 'Zurück in die Welt',
  'Join the WhatsApp community': 'Zur WhatsApp-Community',
};
