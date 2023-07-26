
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

function matchMagic(magic: string, data: DataView, offset: number) {
  for (var i = 0; i < magic.length; i++) {
    if (magic.charCodeAt(i) != data.getUint8(offset + i)) {
      return <const>false;
    }
  }
  return { offset: offset + magic.length };
}

function parseSequence<T extends Record<string, "u1" | "str">>(data: DataView, offset: number, spec: T) {
  var result = <any>{};
  for (var key in spec) {
    var type = spec[key];
    if (type == "u1") {
      result[key] = data.getUint8(offset++);
    } else if (type == "str") {
      var len = data.getUint8(offset++);
      var str = "";
      for (var i = 0; i < len; i++) {
        str += String.fromCharCode(data.getUint8(offset++));
      }
      result[key] = str;
    }
  }
  return { offset, result: result as { [key in keyof T]: T[key] extends "u1" ? number : string } };
}

function parseBlendFile(path: string)
{
  var file = fs.readFileSync(path);
  var data = new DataView(file.buffer);
  // "BLENDER" magic number from first 7 bytes
  // var magic = "";
  // for (var i = 0; i < 7; i++) {
  //   magic += String.fromCharCode(data.getUint8(i));
  // }
  var next = matchMagic("BLENDER", data, 0);
  if (!next) {
    return "not a blend file.";
  }
  let { offset, result } = parseSequence(data, next.offset, {
    ptr_size: "u1",
    endian: "u1",
    version: "str",
  });

  return "Sir! It's version " + result.version + " and ptr_size " + result.ptr_size + " and endian " + result.endian + " and offset " + offset;
}

const blenderSpec = {
  "meta": {
    "id": "blender_blend",
    "application": "Blender",
    "file-extension": "blend",
    "xref": {
      "justsolve": "BLEND",
      "mime": "application/x-blender",
      "pronom": [
        "fmt/902",
        "fmt/903"
      ],
      "wikidata": "Q15671948"
    },
    "license": "CC0-1.0",
    "endian": "le"
  },
  "doc": "Blender is an open source suite for 3D modelling, sculpting,\nanimation, compositing, rendering, preparation of assets for its own\ngame engine and exporting to others, etc. `.blend` is its own binary\nformat that saves whole state of suite: current scene, animations,\nall software settings, extensions, etc.\n\nInternally, .blend format is a hybrid semi-self-descriptive\nformat. On top level, it contains a simple header and a sequence of\nfile blocks, which more or less follow typical [TLV\npattern](https://en.wikipedia.org/wiki/Type-length-value). Pre-last\nblock would be a structure with code `DNA1`, which is a essentially\na machine-readable schema of all other structures used in this file.\n",
  "seq": [
    {
      "id": "hdr",
      "type": "header"
    },
    {
      "id": "blocks",
      "type": "file_block",
      "repeat": "eos"
    }
  ],
  "instances": {
    "sdna_structs": {
      "value": "blocks[blocks.size - 2].body.as<dna1_body>.structs"
    }
  },
  "types": {
    "header": {
      "seq": [
        {
          "id": "magic",
          "contents": "BLENDER"
        },
        {
          "id": "ptr_size_id",
          "type": "u1",
          "enum": "ptr_size",
          "doc": "Size of a pointer; all pointers in the file are stored in this format"
        },
        {
          "id": "endian",
          "type": "u1",
          "doc": "Type of byte ordering used",
          "enum": "endian"
        },
        {
          "id": "version",
          "type": "str",
          "size": 3,
          "encoding": "ASCII",
          "doc": "Blender version used to save this file"
        }
      ],
      "instances": {
        "psize": {
          "value": "ptr_size_id == ptr_size::bits_64 ? 8 : 4",
          "doc": "Number of bytes that a pointer occupies"
        }
      }
    },
    "file_block": {
      "seq": [
        {
          "id": "code",
          "type": "str",
          "size": 4,
          "encoding": "ASCII",
          "doc": "Identifier of the file block"
        },
        {
          "id": "len_body",
          "type": "u4",
          "doc": "Total length of the data after the header of file block"
        },
        {
          "id": "mem_addr",
          "size": "_root.hdr.psize",
          "doc": "Memory address the structure was located when written to disk"
        },
        {
          "id": "sdna_index",
          "type": "u4",
          "doc": "Index of the SDNA structure"
        },
        {
          "id": "count",
          "type": "u4",
          "doc": "Number of structure located in this file-block"
        },
        {
          "id": "body",
          "size": "len_body",
          "type": {
            "switch-on": "code",
            "cases": {
              "\"DNA1\"": "dna1_body"
            }
          }
        }
      ],
      "instances": {
        "sdna_struct": {
          "value": "_root.sdna_structs[sdna_index]",
          "if": "sdna_index != 0"
        }
      }
    },
    "dna1_body": {
      "doc": "DNA1, also known as \"Structure DNA\", is a special block in\n.blend file, which contains machine-readable specifications of\nall other structures used in this .blend file.\n\nEffectively, this block contains:\n\n* a sequence of \"names\" (strings which represent field names)\n* a sequence of \"types\" (strings which represent type name)\n* a sequence of \"type lengths\"\n* a sequence of \"structs\" (which describe contents of every\n  structure, referring to types and names by index)\n",
      "doc-ref": "https://archive.blender.org/wiki/index.php/Dev:Source/Architecture/File_Format/#Structure_DNA",
      "seq": [
        {
          "id": "id",
          "contents": "SDNA"
        },
        {
          "id": "name_magic",
          "contents": "NAME"
        },
        {
          "id": "num_names",
          "type": "u4"
        },
        {
          "id": "names",
          "type": "strz",
          "encoding": "UTF-8",
          "repeat": "expr",
          "repeat-expr": "num_names"
        },
        {
          "id": "padding_1",
          "size": "(4 - _io.pos) % 4"
        },
        {
          "id": "type_magic",
          "contents": "TYPE"
        },
        {
          "id": "num_types",
          "type": "u4"
        },
        {
          "id": "types",
          "type": "strz",
          "encoding": "UTF-8",
          "repeat": "expr",
          "repeat-expr": "num_types"
        },
        {
          "id": "padding_2",
          "size": "(4 - _io.pos) % 4"
        },
        {
          "id": "tlen_magic",
          "contents": "TLEN"
        },
        {
          "id": "lengths",
          "type": "u2",
          "repeat": "expr",
          "repeat-expr": "num_types"
        },
        {
          "id": "padding_3",
          "size": "(4 - _io.pos) % 4"
        },
        {
          "id": "strc_magic",
          "contents": "STRC"
        },
        {
          "id": "num_structs",
          "type": "u4"
        },
        {
          "id": "structs",
          "type": "dna_struct",
          "repeat": "expr",
          "repeat-expr": "num_structs"
        }
      ]
    },
    "dna_struct": {
      "doc": "DNA struct contains a `type` (type name), which is specified as\nan index in types table, and sequence of fields.\n",
      "seq": [
        {
          "id": "idx_type",
          "type": "u2"
        },
        {
          "id": "num_fields",
          "type": "u2"
        },
        {
          "id": "fields",
          "type": "dna_field",
          "repeat": "expr",
          "repeat-expr": "num_fields"
        }
      ],
      "instances": {
        "type": {
          "value": "_parent.types[idx_type]"
        }
      }
    },
    "dna_field": {
      "seq": [
        {
          "id": "idx_type",
          "type": "u2"
        },
        {
          "id": "idx_name",
          "type": "u2"
        }
      ],
      "instances": {
        "type": {
          "value": "_parent._parent.types[idx_type]"
        },
        "name": {
          "value": "_parent._parent.names[idx_name]"
        }
      }
    }
  },
  "enums": {
    "ptr_size": {
      "45": "bits_64",
      "95": "bits_32"
    },
    "endian": {
      "86": "be",
      "118": "le"
    }
  }
};

export = init;