// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.

import React, { useEffect } from "react";
import { Dropdown } from "react-bootstrap";
import { useSelector, useDispatch } from "react-redux";
import { ProjectInfo, ProjectType } from "../../../../types";
import { Col, Row } from "react-bootstrap";
import { Dispatch } from "@reduxjs/toolkit";
import { activeProjectChange } from "../classpathConfigurationViewSlice";
import { onClickGotoProjectConfiguration, onWillLoadProjectClasspath } from "../../../utils";

const ProjectSelector = (): JSX.Element | null => {
  const activeProjectIndex: number = useSelector((state: any) => state.classpathConfig.activeProjectIndex);
  const projects: ProjectInfo[] = useSelector((state: any) => state.classpathConfig.projects);
  const projectType: ProjectType = useSelector((state: any) => state.classpathConfig.projectType);
  let buildFile: string = "";
  if (projectType === ProjectType.Maven) {
    buildFile = "pom.xml";
  } else if (projectType === ProjectType.Gradle) {
    buildFile = "build.gradle";
  }

  const dispatch: Dispatch<any> = useDispatch();

  const handleActiveProjectChange = (index: number) => {
    dispatch(activeProjectChange(index));
  };

  const handleOpenBuildFile = () => {
    onClickGotoProjectConfiguration(projects[activeProjectIndex].rootPath, projectType);
  };

  useEffect(() => {
    onWillLoadProjectClasspath(projects[activeProjectIndex].rootPath);
  }, [activeProjectIndex, projects]);

  const projectSelections = projects.map((project, index) => {
    return (
      <Dropdown.Item className="dropdown-item py-0 pl-1" key={project.rootPath} onSelect={() => handleActiveProjectChange(index)}>
        {project.name}
      </Dropdown.Item>
    );
  });

  return (
    <Row className="my-4">
      <Col>
        <span>Select the project.</span>
        <Dropdown>
          <Dropdown.Toggle className="dropdown-button flex-vertical-center text-left">
            {projects[activeProjectIndex].name}
          </Dropdown.Toggle>

          <Dropdown.Menu className="dropdown-menu mt-0 p-0">
            {projectSelections}
          </Dropdown.Menu>
        </Dropdown>
        {(projectType === ProjectType.Gradle || projectType === ProjectType.Maven) &&
          <div className="mt-2">
            <span>
              Below settings are only applicable for non-build tool projects. for the {projectType} project, please edit them in the <a href="" onClick={() => handleOpenBuildFile()}>{buildFile}</a> file.
            </span>
          </div>
        }
      </Col>
    </Row>
  );
};

export default ProjectSelector;
