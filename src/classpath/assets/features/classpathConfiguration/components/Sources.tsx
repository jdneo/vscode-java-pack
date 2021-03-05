// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.

import { Icon } from "@iconify/react";
import closeIcon from "@iconify-icons/codicon/chrome-close";
import React, { useEffect } from "react";
import { useSelector, useDispatch } from "react-redux";
import { ListGroup } from "react-bootstrap";
import { Dispatch } from "@reduxjs/toolkit";
import { removeSource, addSource } from "../classpathConfigurationViewSlice";
import { onWillAddSourcePath } from "../../../utils";
import { ProjectType } from "../../../../types";

const Sources = (): JSX.Element => {
  const sources: string[] = useSelector((state: any) => state.classpathConfig.sources);
  const projectType: ProjectType = useSelector((state: any) => state.classpathConfig.projectType);
  const dispatch: Dispatch<any> = useDispatch();

  const handleRemove = (index: number) => {
    dispatch(removeSource(index));
  };

  const handleAdd = () => {
    onWillAddSourcePath();
  };

  const onDidAddSourceFolder = (event: OnDidAddSourceFolderEvent) => {
    const {data} = event;
    if (data.command === "onDidAddSourceFolder") {
      dispatch(addSource(data.relativePath));
    }
  };

  useEffect(() => {
    window.addEventListener("message", onDidAddSourceFolder);
    return () => window.removeEventListener("message", onDidAddSourceFolder);
  }, []);

  const sourceSections = sources.map((source, index) => (
    <ListGroup.Item className={`${projectType !== ProjectType.UnmanagedFolder ? "inactive" : ""} list-row-body pl-0 py-0`} key={source}>
      <span className="ml-1">{source}</span>
      {projectType === ProjectType.UnmanagedFolder &&
        <span className="scale-up float-right">
          <a onClick={() => handleRemove(index)}>
            <Icon className="codicon cursor-pointer" icon={closeIcon} />
          </a>
        </span>
      }
    </ListGroup.Item>
  ));

  return (
    <div>
      <div className="setting-section-header mb-1">
        <h4 className="mb-0">Sources</h4>
        {projectType !== ProjectType.UnmanagedFolder &&
          <span className="ml-2">(Read-only)</span>
        }
      </div>
      <span className="setting-section-description">Specify the source locations.</span>
      <ListGroup className="list mt-1">
        <ListGroup.Item className="list-row-header pr-2 pl-0 py-0">
          <span className="ml-1">Path</span>
        </ListGroup.Item>
        {sourceSections}
      </ListGroup>
      {projectType === ProjectType.UnmanagedFolder &&
        <a role="button" className="btn btn-action mt-2" onClick={() => handleAdd()}>Add</a>
      }
    </div>
  );
};

interface OnDidAddSourceFolderEvent {
  data: {
    command: string;
    relativePath: string;
  };
}

export default Sources;
