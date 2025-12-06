/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as functions_audio from "../functions/audio.js";
import type * as functions_generationEvents from "../functions/generationEvents.js";
import type * as functions_images from "../functions/images.js";
import type * as functions_projects from "../functions/projects.js";
import type * as functions_scenes from "../functions/scenes.js";
import type * as functions_script from "../functions/script.js";
import type * as functions_seed from "../functions/seed.js";
import type * as functions_storyboard from "../functions/storyboard.js";
import type * as functions_styles from "../functions/styles.js";
import type * as functions_test from "../functions/test.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  "functions/audio": typeof functions_audio;
  "functions/generationEvents": typeof functions_generationEvents;
  "functions/images": typeof functions_images;
  "functions/projects": typeof functions_projects;
  "functions/scenes": typeof functions_scenes;
  "functions/script": typeof functions_script;
  "functions/seed": typeof functions_seed;
  "functions/storyboard": typeof functions_storyboard;
  "functions/styles": typeof functions_styles;
  "functions/test": typeof functions_test;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};
