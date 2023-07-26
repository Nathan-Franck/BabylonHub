
import type tsModule from 'typescript/lib/tsserverlibrary';
import type ts from 'typescript/lib/tsserverlibrary';
import fs from 'fs';
import path from 'path';

function init(modules: { typescript: typeof ts }) {
  /**
   * This example plugin removes a specified list of entries from the completion list.
   */

  // function create(info: ts.server.PluginCreateInfo) {
  //   // Get a list of things to remove from the completion list from the config object.
  //   // If nothing was specified, we'll just remove 'caller'
  //   const whatToRemove: string[] = info.config.remove || ["caller"];

  //   // Diagnostic logging
  //   info.project.projectService.logger.info(
  //     "I'm getting set up now! Check the log for this message."
  //   );

  //   // Set up decorator object
  //   const proxy: ts.LanguageService = Object.create(null);
  //   for (let k of Object.keys(info.languageService) as Array<keyof ts.LanguageService>) {
  //     const x = info.languageService[k]!;
  //     // @ts-expect-error - JS runtime trickery which is tricky to type tersely
  //     proxy[k] = (...args: Array<{}>) => x.apply(info.languageService, args);
  //   }

  //   // Remove specified entries from completion list
  //   proxy.getCompletionsAtPosition = (fileName, position, options) => {
  //     const prior = info.languageService.getCompletionsAtPosition(fileName, position, options);
  //     if (!prior) return

  //     const oldLength = prior.entries.length;
  //     prior.entries = prior.entries.filter(e => whatToRemove.indexOf(e.name) < 0);

  //     // Sample logging for diagnostic purposes
  //     if (oldLength !== prior.entries.length) {
  //       const entriesRemoved = oldLength - prior.entries.length;
  //       info.project.projectService.logger.info(
  //         `Removed ${entriesRemoved} entries from the completion list`
  //       );
  //     }

  //     return prior;
  //   };

  //   return proxy;
  // }


  /**
   * Now the real deal - when a .blend file is imported, load in the .blend file using parseBlend.ts, and provide a extend Record<string, string> of objects and their parents
   */
  function create(info: ts.server.PluginCreateInfo) {
    // Diagnostic logging
    info.project.projectService.logger.info(
      "I'm getting set up now! Check the log for this message."
    );

    // Set up decorator object
    const languageServiceHost = {} as Partial<ts.LanguageServiceHost>;
    const languageServiceHostProxy = new Proxy(info.languageServiceHost, {
      get(target, key: keyof ts.LanguageServiceHost) {
        return languageServiceHost[key]
          ? languageServiceHost[key]
          : target[key];
      },
    });

    languageServiceHost.getScriptSnapshot = (fileName: string) => {
      if (fileName.endsWith('.blend')) {
        var parseResult = parseBlendFile(fileName);
        return modules.typescript.ScriptSnapshot.fromString(`
declare const blend: { parseResult: "${parseResult}" };
export = blend;
        `);
        // const text = fs.readFileSync(fileName, 'utf8');
        // const snapshot = modules.typescript.ScriptSnapshot.fromString(text);
        // return snapshot;
      }

      // Fall back to the default behavior.
      const result = info.languageServiceHost.getScriptSnapshot(fileName);
      return result;
    };

    languageServiceHost.resolveModuleNameLiterals = (
      moduleNames,
      containingFile,
      redirectedReference,
      options,
      sourceFile,
      reusedNames
    ) => {
      return moduleNames.map(moduleName => {
        if (moduleName.text.endsWith('.blend')) {
          const resolvedModule: ts.ResolvedModuleFull = {
            resolvedFileName: path.resolve(
              path.dirname(containingFile),
              moduleName.text,
            ),
            extension: modules.typescript.Extension.Dts,
            isExternalLibraryImport: false,
          };
          return { resolvedModule };
        }

        // Fall back to the default behavior. (What I think is default?)
        const result = modules.typescript.resolveModuleName(moduleName.text, containingFile, options, languageServiceHostProxy);
        return { resolvedModule: result.resolvedModule };
      });
    };

    const languageService = modules.typescript.createLanguageService(
      languageServiceHostProxy,
    );

    return languageService;
  }

  return { create };
}

function parseBlendFile(path: string)
{
  var file = fs.readFileSync(path);
  var data = new DataView(file.buffer);
  // "BLENDER" magic number
  var magic = data.getUint32(0, true);
  if (magic != 0x464c4572) {
      return "Invalid magic number";
  }
  return "cool man.";
}

export = init;