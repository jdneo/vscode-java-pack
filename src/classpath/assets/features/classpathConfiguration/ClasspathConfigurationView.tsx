// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.

import React, { useEffect } from "react";
import { Col, Container, Row } from "react-bootstrap";
import { Icon } from "@iconify/react";
import loadingIcon from "@iconify-icons/codicon/loading";
import { useSelector, useDispatch } from "react-redux";
import { Dispatch } from "@reduxjs/toolkit";
import Output from "./components/Output";
import ProjectSelector from "./components/ProjectSelector";
import Sources from "./components/Sources";
import Dependencies from "./components/Dependencies";
import Header from "./components/Header";
import Exception from "./components/Exception";
import { ProjectInfo } from "../../../types";
import { listProjects, loadClasspath } from "./classpathConfigurationViewSlice";
import { onWillListProjects } from "../../utils";

const ClasspathConfigurationView = (): JSX.Element => {

  const projects: ProjectInfo[] | undefined = useSelector((state: any) => state.classpathConfig.projects);
  let content: JSX.Element;
  if (projects === undefined) {
    content = <h3><Icon className="codicon spin" icon={loadingIcon} /></h3>;
  } else if (projects.length === 0) {
    content = <Exception />;
  } else {
    content = (
      <div>
        <ProjectSelector />
        <Row className="my-4">
          <Col>
            <Sources />
          </Col>
        </Row>
        <Row className="my-4">
          <Col>
            <Output />
          </Col>
        </Row>
        <Row className="my-4">
          <Col>
            <Dependencies />
          </Col>
        </Row>
      </div>
    );
  }

  const dispatch: Dispatch<any> = useDispatch();

  const onDidLoadProjects = (event: OnDidLoadProjectsEvent) => {
    const {data} = event;
    if (data.command === "onDidListProjects") {
      dispatch(listProjects(data.projectInfo));
    } else if (data.command === "onDidLoadProjectClasspath") {
      dispatch(loadClasspath(data));
    }
  };



  useEffect(() => {
    onWillListProjects();
    window.addEventListener("message", onDidLoadProjects);
    return () => window.removeEventListener("message", onDidLoadProjects);
  }, []);

  return (
    <Container className="root">
      <Row className="my-4">
        <Col>
          <Header />
        </Col>
      </Row>
      {content}
    </Container>
  );
};

interface OnDidLoadProjectsEvent {
  data: {
    command: string;
    projectInfo?: {
      name: string;
      rootPath: string;
      projectType: string;
    }[];
    sources?: string[];
    output?: string;
    referencedLibraries?: string[];
  };
}

export default ClasspathConfigurationView;
