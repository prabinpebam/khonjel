# Privacy Policy

_Last updated: 2026-06-25_

Khonjel is a local-first, privacy-first desktop application. It is designed so that your voice,
transcripts, and personal data stay on your own device. **Khonjel does not collect, transmit, sell,
or share your personal data, and it contains no analytics or telemetry.**

## Summary

- **Offline by default.** Audio is captured, transcribed, and cleaned up locally on your machine.
- **No telemetry, no tracking, no accounts.** The project does not operate any server that receives your data.
- **Your data stays with you.** Transcripts, notes, history, and dictionary entries are stored locally on your device.

## What Khonjel processes

- **Audio.** Microphone audio is transcribed on-device. It is processed in memory and any temporary
  file is deleted immediately after transcription — **recordings are not retained.**
- **Transcripts and content.** Transcription history, notes, chat, and dictionary entries are stored
  locally in your user-data folder and are encrypted at rest.
- **Settings.** Your preferences are stored locally on your device.
- **Credentials.** If you connect an optional cloud provider, the API key is stored in your operating
  system's secure keychain. It is never written in plaintext and is never sent anywhere except the
  provider you configured.

## When data leaves your device

Khonjel only sends data off your device when **you** explicitly enable it:

- **Optional cloud providers.** If you configure a cloud or self-hosted AI provider (for example
  Azure OpenAI or an OpenAI-compatible endpoint), the text or audio for that specific task is sent to
  the provider you chose, under that provider's own privacy policy and terms. This is opt-in and off
  by default.
- **Software updates.** The installed app checks for new versions by requesting release metadata from
  GitHub. This is a standard network request to GitHub and is subject to
  [GitHub's Privacy Statement](https://docs.github.com/site-policy/privacy-policies/github-privacy-statement).
  No personal data or usage information is included.

Other than the above, Khonjel performs no network communication with the developer or any third party.

## Data sharing

The Khonjel project does not receive, store, or have access to your data, and therefore does not share
it with anyone.

## Children's privacy

Khonjel is not directed to children and does not knowingly collect personal information from anyone.

## Code signing

Windows builds are code-signed using a free Open Source certificate provided by
[SignPath Foundation](https://signpath.org/), with code signing by [SignPath.io](https://signpath.io/).
Certificates are issued in SignPath Foundation's name.

## Changes to this policy

This policy may be updated over time. Material changes will be reflected in this file in the
repository, along with an updated date above.

## Contact

Questions about privacy can be raised via the project's
[GitHub issues](https://github.com/prabinpebam/khonjel/issues).
