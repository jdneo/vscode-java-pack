// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.

import * as vscode from "vscode";
import { getReleaseNotesEntries, findLatestReleaseNotes, timeToString, getExtensionVersion } from "../utils";

export enum HelpViewType {
  Auto = "auto",
  Overview = "overview",
  GettingStarted = "gettingStarted",
  None = "none",
}

function showInfoButton() {
  const config = vscode.workspace.getConfiguration("java.help");
  const firstView = config.get("firstView");

  let infoButton = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right);
  switch (firstView) {
    case HelpViewType.None:
      return;
    case HelpViewType.GettingStarted:
      infoButton.command = "java.gettingStarted";
      break;
    default:
      infoButton.command = "java.overview";
  }

  infoButton.text = "$(info)";
  infoButton.tooltip = "Learn more about Java features";
  infoButton.show();
}

type ReleaseNotesPresentationHistoryEntry = { version: string, timeStamp: string };
const RELEASE_NOTE_PRESENTATION_HISTORY = "releaseNotesPresentationHistory";

export async function showReleaseNotesOnStart(context: vscode.ExtensionContext) {
  const entries = await getReleaseNotesEntries(context);
  const latest = findLatestReleaseNotes(entries);
  if(latest.version !== getExtensionVersion()) {
    return; // in case we don't draft release note for a version.
  }

  const history: ReleaseNotesPresentationHistoryEntry[] = context.globalState.get(RELEASE_NOTE_PRESENTATION_HISTORY) || [];
  if (history.some(entry => entry.version === latest.version)) {
    return;
  }

  await vscode.commands.executeCommand("java.showReleaseNotes", "latest");

  history.push({
    version: latest.version,
    timeStamp: timeToString(new Date())
  });

  context.globalState.update(RELEASE_NOTE_PRESENTATION_HISTORY, history);
}

export function initialize(_context: vscode.ExtensionContext) {
  showInfoButton();
}
