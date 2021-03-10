// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.

import React from "react";
import { encodeCommandUriWithTelemetry, supportedByNavigator } from "../../../../../utils/webview";
import { WEBVIEW_ID } from "../../../utils";

const Exception = (): JSX.Element => {

  let command: string = "workbench.action.files.openFolder";
  if (supportedByNavigator("mac")) {
    command = "workbench.action.files.openFileFolder";
  }

  return (
    <div>
      <span>There is no Java projects opened in the current workspace. Please <a href={encodeCommandUriWithTelemetry(WEBVIEW_ID, "classpath.openProject", command)}>open a Java project</a>.</span>
    </div>
  );
};

export default Exception;
