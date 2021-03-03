// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.

import { Dispatch } from "@reduxjs/toolkit";
import React, { useEffect } from "react";
import { useSelector, useDispatch } from "react-redux";
import { ProjectType } from "../../../../types";
import { onWillSelectOutputPath } from "../../../utils";
import { setOutputPath } from "../classpathConfigurationViewSlice";

const Output = (): JSX.Element => {
    const output: string = useSelector((state: any) => state.classpathConfig.output);
    const projectType: ProjectType = useSelector((state: any) => state.classpathConfig.projectType);
    const dispatch: Dispatch<any> = useDispatch();
    const handleClick = () => {
      onWillSelectOutputPath();
    };

    const onDidSelectOutputPath = (event: OnDidSelectOutputPathEvent) => {
      const {data} = event;
      if (data.command === "onDidSelectOutputPath") {
        dispatch(setOutputPath(data.output));
      }
    };

    useEffect(() => {
      window.addEventListener("message", onDidSelectOutputPath);
      return () => window.removeEventListener("message", onDidSelectOutputPath);
    }, []);

    return (
      <div>
        <h3 className="header">Output</h3>
        <span className="description">Specify compile output path location.</span>
        <div className="input text-break pl-1 mb-1 mt-2">{output}</div>
        {projectType === ProjectType.UnmanagedFolder &&
          <a role="button" className="btn btn-add" onClick={() => handleClick()}>
            Browse
          </a>
        }
      </div>
    );
};

interface OnDidSelectOutputPathEvent {
  data: {
    command: string
    output: string
  };
}

export default Output;
