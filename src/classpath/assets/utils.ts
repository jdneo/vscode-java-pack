// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.

import { ProjectType } from "../types";

export function encodeCommandUri(command: string, args?: string[]) {
  let ret = `command:${command}`;
  if (args && args.length > 0) {
    ret += `?${encodeURIComponent(JSON.stringify(args))}`;
  }
  return ret;
}

// RPC calls to VS Code
declare function acquireVsCodeApi(): any;
const vscode = acquireVsCodeApi && acquireVsCodeApi();

export function onWillListProjects() {
  vscode.postMessage({
    command: "onWillListProjects"
  });
}

export function onWillLoadProjectClasspath(uri: string) {
  vscode.postMessage({
    command: "onWillLoadProjectClasspath",
    uri,
  });
}

export function onWillSelectOutputPath() {
  vscode.postMessage({
    command: "onWillSelectOutputPath"
  });
}

export function onWillAddSourcePath() {
  vscode.postMessage({
    command: "onWillAddSourcePath"
  });
}

export function onWillAddReferencedLibraries() {
  vscode.postMessage({
    command: "onWillAddReferencedLibraries"
  });
}

export function onWillRemoveReferencedLibraries(path: string) {
  vscode.postMessage({
    command: "onWillRemoveReferencedLibraries",
    path,
  });
}

export function onClickGotoProjectConfiguration(rootUri: string, projectType: ProjectType) {
  vscode.postMessage({
    command: "onClickGotoProjectConfiguration",
    rootUri,
    projectType,
  });
}