/**
 * iPhone and iPad WebKit: every iOS browser, and iPadOS that reports itself
 * as a Mac. Pages there share a tight memory budget, and going over it makes
 * iOS kill the page ("A problem repeatedly occurred"), so the game trims its
 * memory use on these devices only.
 */
export const IS_IOS = typeof navigator !== 'undefined'
  && (/iPad|iPhone|iPod/.test(navigator.userAgent)
    || (/Macintosh/.test(navigator.userAgent) && navigator.maxTouchPoints > 1));
