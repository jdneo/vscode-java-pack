# Configure Classpath

There are several settings that can help configure the classpath components of your unmanaged folder.
> Note: For project with build tools, like Maven and Gradle, please configure the classpath in the `pom.xml` or `build.gradle` file.

* `java.project.sourcePaths`: Relative paths to the workspace where stores the source files. `Only` effective in the `WORKSPACE` scope. The setting will `NOT` affect Maven or Gradle project.

* `java.project.outputPath`: A relative path to the workspace where stores the compiled output. `Only` effective in the `WORKSPACE` scope. The setting will `NOT` affect Maven or Gradle project.

* `java.configuration.runtimes`: Map Java Execution Environments to local JDKs.

* `java.project.referencedLibraries`: Configure glob patterns for referencing local libraries to a Java project.