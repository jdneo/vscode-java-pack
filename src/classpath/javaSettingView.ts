// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.

import * as vscode from "vscode";
import * as path from "path";
import { loadTextFromFile } from "../utils";
import * as fse from "fs-extra";
import { ProjectInfo, ClasspathComponent, ProjectType } from "./types";
import _ from "lodash";
import minimatch from "minimatch";
import { instrumentOperation, sendInfo, setUserError } from "vscode-extension-telemetry-wrapper";

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

    classpathConfigurationPanel.iconPath = {
        light: vscode.Uri.file(path.join(context.extensionPath, "caption.light.svg")),
        dark: vscode.Uri.file(path.join(context.extensionPath, "caption.dark.svg"))
    };
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
                await addSourcePath(currentProjectRoot);
                break;
            case "onWillRemoveSourcePath":
                removeSourcePath(currentProjectRoot, message.sourcePaths);
                break;
            case "onWillAddReferencedLibraries":
                await addReferencedLibraries(currentProjectRoot);
                break;
            case "onWillRemoveReferencedLibraries":
                removeReferencedLibrary(currentProjectRoot, message.path);
                break;
            case "onClickGotoProjectConfiguration":
                gotoProjectConfigurationFile(message.rootUri, message.projectType);
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

const listProjects = instrumentOperation("classpath.listProjects", async (operationId: string) => {
    let projects: ProjectInfo[] = await getProjectsFromLS();

    _.remove(projects, (p: ProjectInfo) => {
        return isDefaultProject(p.rootPath);
    });

    classpathConfigurationPanel?.webview.postMessage({
        command: "onDidListProjects",
        projectInfo: projects,
    });

    sendInfo(operationId, {
        projectNumber: projects.length,
    });
});

const loadProjectClasspath = instrumentOperation("classpath.loadClasspath", async (operationId: string, currentProjectRoot: vscode.Uri) => {
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

    sendInfo(operationId, {
        projectType: classpath.projectType,
    });
});

const addSourcePath = instrumentOperation("classpath.addSourcePath", async (_operationId: string, currentProjectRoot: vscode.Uri) => {
    const sourceFolder: vscode.Uri[] | undefined = await vscode.window.showOpenDialog({
        defaultUri: vscode.workspace.workspaceFolders?.[0].uri,
        openLabel: "Select Source Folder",
        canSelectFiles: false,
        canSelectFolders: true,
        canSelectMany: false,
    });
    if (sourceFolder) {
        const sourceFolderPath: string = sourceFolder[0].fsPath;
        const projectRootPath: string = currentProjectRoot.fsPath;
        let relativePath: string = path.relative(projectRootPath, sourceFolderPath);
        if (relativePath.startsWith("..")) {
            const err: Error = new Error("Cannot set the source path outside the project root.");
            vscode.window.showErrorMessage(err.message);
            setUserError(err);
            throw(err);
        }
        if (!relativePath) {
            relativePath = ".";
        }
        const sourcePaths: string[] = vscode.workspace.getConfiguration("java", currentProjectRoot).get<string[]>("project.sourcePaths") || [];
        if (sourcePaths.includes(relativePath)) {
            vscode.window.showInformationMessage(`The path ${relativePath} has already been a source path.`);
            return;
        }
        sourcePaths.push(relativePath);
        vscode.workspace.getConfiguration("java", currentProjectRoot).update(
            "project.sourcePaths",
            sourcePaths,
            vscode.ConfigurationTarget.Workspace,
        );
        classpathConfigurationPanel?.webview.postMessage({
            command: "onDidUpdateSourceFolder",
            sourcePaths,
        });
    }
});

const removeSourcePath = instrumentOperation("classpath.removeSourcePath", (_operationId: string, currentProjectRoot: vscode.Uri, sourcePaths: string[]) => {
    vscode.workspace.getConfiguration("java", currentProjectRoot).update(
        "project.sourcePaths",
        sourcePaths,
        vscode.ConfigurationTarget.Workspace
    );
});

const setOutputPath = instrumentOperation("classpath.setOutputPath", async (_operationId: string, currentProjectRoot: vscode.Uri) => {
    const outputFolder: vscode.Uri[] | undefined = await vscode.window.showOpenDialog({
        defaultUri: vscode.workspace.workspaceFolders?.[0].uri,
        openLabel: "Select Output Folder",
        canSelectFiles: false,
        canSelectFolders: true,
        canSelectMany: false,
    });
    if (outputFolder) {
        const projectRootPath: string = currentProjectRoot.fsPath;
        const outputFullPath: string = outputFolder[0].fsPath;
        if ((await fse.readdir(outputFullPath)).length) {
            const err: Error = new Error("Cannot set the output path to an un-empty folder.");
            vscode.window.showErrorMessage(err.message);
            setUserError(err);
            throw(err);
        }
        const output: string = path.relative(projectRootPath, outputFullPath);
        if (output.startsWith("..")) {
            const err: Error = new Error("Cannot set the output path outside the project root.");
            vscode.window.showErrorMessage(err.message);
            setUserError(err);
            throw(err);
        }
        if (!output) {
            const err: Error = new Error("Cannot set the project root path as the output path.");
            vscode.window.showErrorMessage(err.message);
            setUserError(err);
            throw(err);
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
});

const addReferencedLibraries = instrumentOperation("classpath.addReferencedLibraries", async (_operationId: string, currentProjectRoot: vscode.Uri) => {
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
});

const removeReferencedLibrary = instrumentOperation("classpath.removeReferencedLibrary", async (_operationId: string, currentProjectRoot: vscode.Uri, removalFsPath: string) => {
    if (!path.isAbsolute(removalFsPath)) {
        removalFsPath = path.join(currentProjectRoot.fsPath, removalFsPath);
    }
    const setting = getReferencedLibrariesSetting();
    const removedPaths = _.remove(setting.include, (include) => {
        if (path.isAbsolute(include)) {
            return vscode.Uri.file(include).fsPath === removalFsPath;
        } else {
            return include === vscode.workspace.asRelativePath(removalFsPath, false);
        }
    });
    if (removedPaths.length === 0) {
        // No duplicated item in include array, add it into the exclude field
        setting.exclude = updatePatternArray(setting.exclude, vscode.workspace.asRelativePath(removalFsPath, false));
    }
    updateReferencedLibraries(setting);
});

const gotoProjectConfigurationFile = instrumentOperation("classpath.gotoProjectConfigurationFile", (operationId: string, rootUri: string, projectType: ProjectType) => {
    const rootPath: string = vscode.Uri.parse(rootUri).fsPath;
    let configurationPath: string = "";
    if (projectType === ProjectType.Gradle) {
        configurationPath = path.join(rootPath, "build.gradle");
    } else if (projectType === ProjectType.Maven) {
        configurationPath = path.join(rootPath, "pom.xml");
    }

    if (!configurationPath) {
        const err: Error = new Error(`The configuration file: '${configurationPath}' does not exist.`);
        vscode.window.showErrorMessage(err.message);
        throw(err);
    }
    vscode.commands.executeCommand("vscode.open", vscode.Uri.file(configurationPath));
    sendInfo(operationId, {
        projectType,
    });
});

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

function isDefaultProject(path: string): boolean {
    return path.indexOf("jdt.ls-java-project") > -1;
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