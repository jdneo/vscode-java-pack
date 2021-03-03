// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.

import React from "react";

const Exception = (): JSX.Element => {

  return (
    <div>
      <span>There is no Java projects opened in the current workspace. Please <a href="">open a Java project</a>.</span>
    </div>
  );
};

export default Exception;
