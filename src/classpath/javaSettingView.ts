// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.

import * as vscode from "vscode";
import * as path from "path";
import { loadTextFromFile } from "../utils";
import * as fse from "fs-extra";
import { ProjectInfo, ClasspathComponent, ProjectType } from "./types";
import _ from "lodash";
import minimatch from "minimatch";

let classpathConfigurationPanel: vscode.WebviewPanel | undefined;
let lsApi: LanguageServerAPI | undefined;
const SOURCE_PATH_KEY: string = "org.eclipse.jdt.ls.core.sourcePaths";
const OUTPUT_PATH_KEY: string = "org.eclipse.jdt.ls.core.defaultOutputPath";
const REFERENCED_LIBRARIES_KEY: string = "org.eclipse.jdt.ls.core.referencedLibraries";

export async function showClasspathConfigurationPage(context: vscode.ExtensionContext): Promise<void> {
    let currentProjectRoot: vscode.Uri;
    if (classpathConfigurationPanel) {
        classpathConfigurationPanel.reveal();
        return;
    }

    lsApi = await checkRequirement();
    if (!lsApi) {
        return;
    }

    classpathConfigurationPanel = vscode.window.createWebviewPanel(
        "java.classpathConfiguration",
        "Classpath Configuration",
        vscode.ViewColumn.Active,
        {
            enableScripts: true,
            enableCommandUris: true,
            retainContextWhenHidden: true
        }
    );

    classpathConfigurationPanel.iconPath = vscode.Uri.file(path.join(context.extensionPath, "logo.svg"));
    const resourceUri = context.asAbsolutePath("./out/assets/classpath/index.html");
    classpathConfigurationPanel.webview.html = await loadTextFromFile(resourceUri);
    context.subscriptions.push(classpathConfigurationPanel.onDidDispose(_e => classpathConfigurationPanel = undefined));
    context.subscriptions.push(classpathConfigurationPanel.webview.onDidReceiveMessage((async (message) => {
        switch (message.command) {
            case "onWillListProjects":
                await listProjects();
                break;
            case "onWillLoadProjectClasspath":
                currentProjectRoot = vscode.Uri.parse(message.uri);
                await loadProjectClasspath(currentProjectRoot);
                break;
            case "onWillSelectOutputPath":
                await setOutputPath(currentProjectRoot);
                break;
            case "onWillAddSourcePath":
                const sourceFolder: vscode.Uri[] | undefined = await vscode.window.showOpenDialog({
                    defaultUri: vscode.workspace.workspaceFolders?.[0].uri,
                    openLabel: "Select Source Folder",
                    canSelectFiles: false,
                    canSelectFolders: true,
                    canSelectMany: false,
                });
                if (sourceFolder) {
                    classpathConfigurationPanel?.webview.postMessage({
                        command: "onDidAddSourceFolder",
                        // todo: change to relative path
                        relativePath: sourceFolder[0].fsPath,
                    });
                }
                break;
            case "onWillAddReferencedLibraries":
                await addLibraries(currentProjectRoot);
                break;
            case "onWillRemoveReferencedLibraries":
                let libPath: string = message.path;
                if (!path.isAbsolute(libPath)) {
                    libPath = path.join(currentProjectRoot.fsPath, libPath);
                }
                removeLibrary(libPath);
                break;
            case "onClickGotoProjectConfiguration":
                const rootPath: string = vscode.Uri.parse(message.rootUri).fsPath;
                const projectType: ProjectType = message.projectType;
                let configurationPath: string = "";
                if (projectType === ProjectType.Gradle) {
                    configurationPath = path.join(rootPath, "build.gradle");
                } else if (projectType === ProjectType.Maven) {
                    configurationPath = path.join(rootPath, "pom.xml");
                }

                if (!configurationPath) {
                    // TODO: handle exception
                }
                vscode.commands.executeCommand("vscode.open", vscode.Uri.file(configurationPath));
                break;
            default:
                break;
        }
    })));

    context.subscriptions.push(lsApi.onDidProjectsImport(() => {
        listProjects();
    }));

    context.subscriptions.push(lsApi.onDidClasspathUpdate((uri: vscode.Uri) => {
        if (!path.relative(uri.fsPath, currentProjectRoot.fsPath)) {
            loadProjectClasspath(uri);
        }
    }));
}

async function checkRequirement(): Promise<LanguageServerAPI | undefined> {
    const javaExt = vscode.extensions.getExtension("redhat.java");
    if (!javaExt) {
        // TODO: check extension version
        return undefined;
    }
    await javaExt.activate();
    return javaExt.exports;
}

async function listProjects() {
    let projects: ProjectInfo[] = await getProjectsFromLS();

    _.remove(projects, (p: ProjectInfo) => {
        return isDefaultProject(p.rootPath);
    });

    classpathConfigurationPanel?.webview.postMessage({
        command: "onDidListProjects",
        projectInfo: projects,
    });
}

async function getProjectsFromLS(): Promise<ProjectInfo[]> {
    const ret: ProjectInfo[] = [];
    let projects: string[] = [];
    try {
        projects = await vscode.commands.executeCommand("java.execute.workspaceCommand", "java.project.getAll") || [];
    } catch (error) {
        // LS not ready
    }

    for (const projectRoot of projects) {
        ret.push({
            name: path.basename(projectRoot),
            rootPath: projectRoot,
        });
    }
    return ret;
}

function isDefaultProject(path: string): boolean {
    return path.indexOf("jdt.ls-java-project") > -1;
}

async function getProjectType(fsPath: string): Promise<ProjectType> {
    if (isDefaultProject(fsPath)) {
        return ProjectType.Default;
    }
    const dotProjectFile = path.join(fsPath, ".project");
    if (!await fse.pathExists(dotProjectFile)) { // for invisible projects, .project file is located in workspace storage.
      return ProjectType.UnmanagedFolder;
    }
    const buildDotGradleFile = path.join(fsPath, "build.gradle");
    if (await fse.pathExists(buildDotGradleFile)) {
      return ProjectType.Gradle;
    }
    const pomDotXmlFile = path.join(fsPath, "pom.xml");
    if (await fse.pathExists(pomDotXmlFile)) {
      return ProjectType.Maven;
    }
    return ProjectType.Others;
  }

async function loadProjectClasspath(currentProjectRoot: vscode.Uri) {
    const classpath = await getProjectClasspathFromLS(currentProjectRoot);
    if (classpath) {
        classpathConfigurationPanel?.webview.postMessage({
            command: "onDidLoadProjectClasspath",
            projectType: classpath.projectType,
            sources: classpath.sourcePaths,
            output: classpath.defaultOutputPath,
            referencedLibraries: classpath.referenceLibraries
        });
    }
}

async function getProjectClasspathFromLS(uri: vscode.Uri): Promise<ClasspathComponent> {
    const javaExt = vscode.extensions.getExtension("redhat.java");
    const extensionApi: any = javaExt?.exports;

    const queryKeys: string[] = [
        SOURCE_PATH_KEY,
        OUTPUT_PATH_KEY,
        REFERENCED_LIBRARIES_KEY
    ];

    const response = await extensionApi.getProjectSettings(
        uri.toString(),
        queryKeys
    );
    const classpath: ClasspathComponent = {
        projectType: await getProjectType(uri.fsPath),
        sourcePaths: response[SOURCE_PATH_KEY] as string[],
        defaultOutputPath: response[OUTPUT_PATH_KEY] as string,
        referenceLibraries: response[REFERENCED_LIBRARIES_KEY] as string[],
    };
    const baseFsPath = uri.fsPath;
    classpath.sourcePaths = classpath.sourcePaths.map(p => {
        const relativePath: string = path.relative(baseFsPath, p);
        if (!relativePath) {
            return ".";
        }
        return relativePath;
    });
    classpath.defaultOutputPath = path.relative(baseFsPath, classpath.defaultOutputPath);
    classpath.referenceLibraries = classpath.referenceLibraries.map(p => {
        const normalizedPath: string = vscode.Uri.file(p).fsPath;
        if (normalizedPath.startsWith(baseFsPath)) {
            return path.relative(baseFsPath, normalizedPath);
        }
        return normalizedPath;
    });
    return classpath;
}

async function setOutputPath(currentProjectRoot: vscode.Uri) {
    const outputFolder: vscode.Uri[] | undefined = await vscode.window.showOpenDialog({
        defaultUri: vscode.workspace.workspaceFolders?.[0].uri,
        openLabel: "Select Output Folder",
        canSelectFiles: false,
        canSelectFolders: true,
        canSelectMany: false,
    });
    if (outputFolder) {
        const projectRootPath: string = currentProjectRoot.fsPath;
        if (!outputFolder[0].fsPath.startsWith(projectRootPath)) {
            vscode.window.showErrorMessage("Cannot set the output path outside the project root.");
            return;
        }
        if ((await fse.readdir(outputFolder[0].fsPath)).length) {
            vscode.window.showErrorMessage("Cannot set the output path to an un-empty folder.");
            return;
        }
        const output: string = path.relative(projectRootPath, outputFolder[0].fsPath);
        if (!output) {
            vscode.window.showErrorMessage("Cannot set the project root path as the output path.");
            return;
        }
        vscode.workspace.getConfiguration("java", currentProjectRoot).update(
            "project.outputPath",
            output,
            vscode.ConfigurationTarget.Workspace,
        );
        classpathConfigurationPanel?.webview.postMessage({
            command: "onDidSelectOutputPath",
            output,
        });
    }
}

async function addLibraries(currentProjectRoot: vscode.Uri) {
    const jarFiles: vscode.Uri[] | undefined = await vscode.window.showOpenDialog({
        defaultUri: vscode.workspace.workspaceFolders?.[0].uri,
        openLabel: "Select Jar File",
        canSelectFiles: true,
        canSelectFolders: false,
        canSelectMany: true,
        filters: {
            "Jar": ["jar"],
        },
    });
    if (jarFiles) {
        const jarPaths: string[] = jarFiles.map(uri => {
            if (uri.fsPath.startsWith(currentProjectRoot.fsPath)) {
                return path.relative(currentProjectRoot.fsPath, uri.fsPath);
            }
            return uri.fsPath;
        });
        addLibraryGlobs(jarPaths);
        classpathConfigurationPanel?.webview.postMessage({
            command: "onDidAddReferencedLibraries",
            jars: jarPaths,
        });
    }
}

function getReferencedLibrariesSetting(): IReferencedLibraries {
    const setting = vscode.workspace.getConfiguration("java.project").get<string[] | Partial<IReferencedLibraries>>("referencedLibraries");
    const defaultSetting: IReferencedLibraries = { include: [], exclude: [], sources: {} };
    if (Array.isArray(setting)) {
        return { ...defaultSetting, include: setting };
    } else {
        return { ...defaultSetting, ...setting };
    }
}

function updateReferencedLibraries(libraries: IReferencedLibraries): void {
    let updateSetting: string[] | Partial<IReferencedLibraries> = {
        include: libraries.include,
        exclude: libraries.exclude.length > 0 ? libraries.exclude : undefined,
        sources: Object.keys(libraries.sources).length > 0 ? libraries.sources : undefined,
    };
    if (!updateSetting.exclude && !updateSetting.sources) {
        updateSetting = libraries.include;
    }
    vscode.workspace.getConfiguration().update("java.project.referencedLibraries", updateSetting);
}

function addLibraryGlobs(libraryGlobs: string[]) {
    const setting = getReferencedLibrariesSetting();
    setting.exclude = dedupAlreadyCoveredPattern(libraryGlobs, ...setting.exclude);
    setting.include = updatePatternArray(setting.include, ...libraryGlobs);
    updateReferencedLibraries(setting);
}

function removeLibrary(removalFsPath: string) {
    const setting = getReferencedLibrariesSetting();
    const removedPaths = _.remove(setting.include, (include) => {
        if (path.isAbsolute(include)) {
            return vscode.Uri.file(include).fsPath === removalFsPath;
        } else {
            // TODO: asRelative??
            return include === vscode.workspace.asRelativePath(removalFsPath, false);
        }
    });
    if (removedPaths.length === 0) {
        // No duplicated item in include array, add it into the exclude field
        setting.exclude = updatePatternArray(setting.exclude, vscode.workspace.asRelativePath(removalFsPath, false));
    }
    updateReferencedLibraries(setting);
}

/**
 * Check if the `update` patterns are already covered by `origin` patterns and return those uncovered
 */
function dedupAlreadyCoveredPattern(origin: string[], ...update: string[]): string[] {
    return update.filter((newPattern) => {
        return !origin.some((originPattern) => {
            return minimatch(newPattern, originPattern);
        });
    });
}

function updatePatternArray(origin: string[], ...update: string[]): string[] {
    update = dedupAlreadyCoveredPattern(origin, ...update);
    origin.push(...update);
    return _.uniq(origin);
}

interface LanguageServerAPI {
    onDidProjectsImport: vscode.Event<vscode.Uri>;
    onDidClasspathUpdate: vscode.Event<vscode.Uri>;
}

interface IReferencedLibraries {
    include: string[];
    exclude: string[];
    sources: { [binary: string]: string };
}