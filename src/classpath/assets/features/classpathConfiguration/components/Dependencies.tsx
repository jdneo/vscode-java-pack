// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.

import { Dispatch } from "@reduxjs/toolkit";
import React, { useEffect } from "react";
import { useSelector, useDispatch } from "react-redux";
import { ListGroup } from "react-bootstrap";
import { Icon } from "@iconify/react";
import closeIcon from "@iconify-icons/codicon/chrome-close";
import { removeReferencedLibrary, addReferencedLibraries } from "../classpathConfigurationViewSlice";
import { encodeCommandUri, onWillAddReferencedLibraries, onWillRemoveReferencedLibraries } from "../../../utils";
import { ProjectType } from "../../../../types";

const Dependencies = (): JSX.Element => {
  const referencedLibraries: string[] = useSelector((state: any) => state.classpathConfig.referencedLibraries);
  const projectType: ProjectType = useSelector((state: any) => state.classpathConfig.projectType);
  const dispatch: Dispatch<any> = useDispatch();

  const handleRemove = (index: number) => {
    onWillRemoveReferencedLibraries(referencedLibraries[index]);
    dispatch(removeReferencedLibrary(index));
  };

  const handleAdd = () => {
    onWillAddReferencedLibraries();
  };

  const onDidAddReferencedLibraries = (event: OnDidAddReferencedLibrariesEvent) => {
    const {data} = event;
      if (data.command === "onDidAddReferencedLibraries") {
        dispatch(addReferencedLibraries(data.jars));
      }
  };

  useEffect(() => {
    window.addEventListener("message", onDidAddReferencedLibraries);
    return () => window.removeEventListener("message", onDidAddReferencedLibraries);
  }, []);

  const referencedLibrariesSections = referencedLibraries.map((library, index) => (
    <ListGroup.Item action className="flex-vertical-center cursor-default pl-0 py-0" key={library}>
      <span className="ml-1">{library}</span>
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
        <h3 className="header">Dependencies</h3>
        <div className="mb-2">
          <h5 className="header">Runtime</h5>
          <span className="description">Map Java execution environment to local JDKs. Edit in <a href={encodeCommandUri("java.runtime")}>Configure Java Runtime</a>.</span>
        </div>
        <div>
          <h5 className="header">Referenced Libraries</h5>
          <span className="description">Specify referenced libraries of the project.</span>
          <ListGroup className="list mt-2">
          <ListGroup.Item className="list-row-header pr-2 pl-0 py-0">
            <span className="ml-1">Path</span>
          </ListGroup.Item>
            {referencedLibrariesSections}
          </ListGroup>
          {projectType === ProjectType.UnmanagedFolder &&
            <a role="button" className="btn btn-add mt-1" onClick={() => handleAdd()}>Add</a>
          }
        </div>
      </div>
  );
};

interface OnDidAddReferencedLibrariesEvent {
  data: {
    command: string;
    jars: string[];
  };
}

export default Dependencies;
