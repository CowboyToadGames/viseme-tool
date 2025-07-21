# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a web-based lip-sync animation tool that creates viseme animations for characters based on audio input and text. The application uses Google Gemini AI to convert text to IPA (International Phonetic Alphabet) notation for accurate lip-sync timing.

## Architecture

### Core Components

- **index.html** - Main application interface with character selection, audio upload, text input, and animation preview
- **login.html** - Authentication page for Gemini API key entry
- **lipsync.js** - Main application logic containing the `LipSyncApp` class

### Key Classes and Functions

- **LipSyncApp** (lipsync.js:21) - Main application class handling all functionality
- **PHONEME_MAP** (lipsync.js:1) - Maps IPA phonemes to viseme categories
- **convertTextToIPA()** (lipsync.js:220) - Calls Gemini API to convert text to IPA notation
- **parsePhonetics()** (lipsync.js:253) - Converts IPA string to phoneme segments
- **generateTimeline()** (lipsync.js:292) - Creates frame-by-frame animation timeline
- **exportVideo()** (lipsync.js:432) - Renders and exports WebM video using MediaRecorder API

### Data Structure

- **Character Assets**: SVG files organized as `{character}/{angle}/{viseme}.svg`
  - Characters: diego, ted
  - Angles: 90°, 135°, 180°, 225°, 270°
  - Visemes: MBP, E, O, A, FV, TS, LN
- **Authentication**: Gemini API key stored in localStorage
- **Animation**: Frame-based timeline system with configurable FPS (10-30)

## Development Notes

### Authentication System
The app requires a valid Gemini API key for text-to-IPA conversion. Users authenticate via login.html and are redirected to index.html on success.

### Viseme Categories
- **MBP**: Bilabial sounds (p, b, m)
- **E**: Front vowels (i, e, etc.)
- **O**: Back rounded vowels (u, o, etc.)
- **A**: Central/back vowels (a, ʌ, etc.)
- **FV**: Labiodental sounds (f, v)
- **TS**: Tongue/teeth sounds (t, s, z, etc.)
- **LN**: Lateral/dental sounds (l, θ, ð)

### External Dependencies
- Pico CSS framework for styling
- Google Fonts (Jost)
- Tabler Icons
- Google Gemini API for text-to-IPA conversion

### Key Features
- Real-time character preview with angle selection
- Audio file upload with duration detection
- Text-to-IPA conversion via Gemini AI
- Frame-accurate lip-sync animation
- WebM video export with configurable framerate
- Responsive canvas rendering (1080x1080)

## Common Development Patterns

### Error Handling
The application handles audio loading errors, API failures, and missing assets gracefully with user feedback.

### Image Management
SVG assets are preloaded and cached in a Map for smooth animation playback.

### Animation System
Uses requestAnimationFrame for smooth preview animation and setTimeout for precise video export timing.