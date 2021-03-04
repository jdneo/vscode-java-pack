// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.

import React from "react";
import { encodeCommandUri } from "../../../utils";

const JdkRuntime = (): JSX.Element => {
  return (
    <div>
      <h4 className="setting-section-header mb-1">JDK Runtime</h4>
      <span className="setting-section-description">Map Java execution environment to local JDKs. Edit in <a href={encodeCommandUri("java.runtime")}>Configure Java Runtime</a>.</span>
    </div>
  );
};

export default JdkRuntime;
