// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.

import React, { useEffect } from "react";
import { Col, Container, Row, Spinner } from "react-bootstrap";
import { useSelector, useDispatch } from "react-redux";
import { Dispatch } from "@reduxjs/toolkit";
import Output from "./components/Output";
import ProjectSelector from "./components/ProjectSelector";
import Sources from "./components/Sources";
import ReferencedLibraries from "./components/ReferencedLibraries";
import Header from "./components/Header";
import Exception from "./components/Exception";
import { ProjectInfo } from "../../../types";
import { listProjects, loadClasspath } from "./classpathConfigurationViewSlice";
import { onWillListProjects } from "../../utils";
import JdkRuntime from "./components/JdkRuntime";

const ClasspathConfigurationView = (): JSX.Element => {

  const projects: ProjectInfo[] | undefined = useSelector((state: any) => state.classpathConfig.projects);
  let content: JSX.Element;
  if (projects === undefined) {
    content = <Spinner animation="border" role="status" size="sm"><span className="sr-only">Loading...</span></Spinner>
  } else if (projects.length === 0) {
    content = <Exception />;
  } else {
    content = (
      <div>
        <ProjectSelector />
        <Row className="setting-section">
          <Col>
            <Sources />
          </Col>
        </Row>
        <Row className="setting-section">
          <Col>
            <Output />
          </Col>
        </Row>
        <Row className="setting-section">
          <Col>
            <JdkRuntime />
          </Col>
        </Row>
        <Row className="setting-section">
          <Col>
            <ReferencedLibraries />
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
      <Row className="setting-header">
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
