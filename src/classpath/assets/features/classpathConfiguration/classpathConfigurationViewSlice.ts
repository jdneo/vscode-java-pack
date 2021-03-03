// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.

import { createSlice } from "@reduxjs/toolkit";
import _ from "lodash";

export const classpathConfigurationViewSlice = createSlice({
    name: "classpathConfig",
    initialState: {
      activeProjectIndex: 0,
      projects: undefined,
      projectType: undefined,
      sources: [] as string[],
      output: "",
      referencedLibraries: [] as string[],
    },
    reducers: {
      listProjects: (state, action) => {
        state.projects = action.payload;
        state.activeProjectIndex = 0;
      },
      activeProjectChange: (state, action) => {
        state.activeProjectIndex = action.payload;
      },
      loadClasspath: (state, action) => {
        state.projectType = action.payload.projectType;
        state.sources = action.payload.sources;
        state.output = action.payload.output;
        // Only update the array when they have different elements.
        if (!_.isEmpty(_.xor(state.referencedLibraries, action.payload.referencedLibraries))) {
          state.referencedLibraries = action.payload.referencedLibraries;
        }
      },
      // TODO: merge remove & add to update?
      removeSource: (state, action) => {
        const removedIndex: number = action.payload as number;
        if (removedIndex > -1 && removedIndex < state.sources.length) {
          state.sources.splice(removedIndex, 1);
        }
      },
      addSource: (state, action) => {
        state.sources.push(action.payload);
      },
      setOutputPath: (state, action) => {
        state.output = action.payload;
      },
      removeReferencedLibrary: (state, action) => {
        const removedIndex: number = action.payload as number;
        if (removedIndex > -1 && removedIndex < state.referencedLibraries.length) {
          state.referencedLibraries.splice(removedIndex, 1);
        }
      },
      addReferencedLibraries: (state, action) => {
        state.referencedLibraries.push(...action.payload);
        state.referencedLibraries = _.uniq(state.referencedLibraries);
      },
    },
});

export const {
  listProjects,
  activeProjectChange,
  loadClasspath,
  removeSource,
  addSource,
  setOutputPath,
  removeReferencedLibrary,
  addReferencedLibraries,
} = classpathConfigurationViewSlice.actions;

export default classpathConfigurationViewSlice.reducer;