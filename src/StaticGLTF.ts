import { Mesh, Scene, SceneLoader, TransformNode, Light, Skeleton, AnimationGroup } from "babylonjs";
import { ObjUtil } from "./ObjUtil";

export namespace StaticGLTF {
  type NodeNames = {
    readonly meshes: Record<string, string | null>;
    readonly transformNodes: Record<string, string | null>;
    readonly skeletons: Record<string, true>;
    readonly lights: Record<string, true>;
    readonly animationGroups: Record<string, true>;
  };
  export async function Load<
    T extends NodeNames
  >(parentScene: Scene, path: string, names: T) {
    const gltf = await SceneLoader.ImportMeshAsync(null, "/", path, parentScene);
    console.log(gltf.meshes);
    const nodes = {
      meshes: ObjUtil.mapValues(names.meshes, ({ key }) => gltf.meshes.find(m => m.name === key)) as {
        [key in keyof T["meshes"]]: Mesh;
      },
      transformNodes: ObjUtil.mapValues(names.transformNodes, ({ key }) => gltf.transformNodes.find(t => t.name === key)) as {
        [key in keyof T["transformNodes"]]: TransformNode;
      },
      skeletons: ObjUtil.mapValues(names.skeletons, ({ key }) => gltf.skeletons.find(s => s.name === key)) as {
        [key in keyof T["skeletons"]]: Skeleton;
      },
      lights: ObjUtil.mapValues(names.lights, ({ key }) => gltf.lights.find(l => l.name === key)) as {
        [key in keyof T["lights"]]: Light;
      },
      animationGroups: ObjUtil.mapValues(names.animationGroups, ({ key }) => gltf.animationGroups.find(a => a.name === key)) as {
        [key in keyof T["animationGroups"]]: AnimationGroup;
      },
    };
    return {
      ...gltf,
      ...nodes,
    };
  }

  export class ModelStats<T extends Record<string, any>> {
    constructor(public statToSubject: T, public transformNodes: Record<keyof T, TransformNode>) {
    }
    gatherFromScale<Prefix extends string>(prefix: Prefix) {
      return ObjUtil.singleKeyObject(prefix, ObjUtil.mapValues(ObjUtil.invert(ObjUtil.filterByPrefix(this.statToSubject, prefix)), ({ value }) => this.transformNodes[value].scaling.x));
    }
  }
}