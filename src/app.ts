import { ArcRotateCamera, Engine, HemisphericLight, Mesh, MeshBuilder, Scene, SceneLoader, Vector3, Quaternion, Node, TransformNode, Light, Skeleton, AnimationGroup } from "babylonjs";
import { Inspector } from "babylonjs-inspector";
import { FpsRigSpec } from "../public/FPS Rig";
import { DishesSpec } from "../public/Dishes";

function AngleBetween3Lengths(a: number, b: number, c: number): number {
  return Math.acos((a * a + b * b - c * c) / (2 * a * b));
}

namespace ObjUtil {
  // Strongly typed Object.fromEntries implementation
  export function entries<T>(obj: T) {
    return Object.entries(obj as any) as any as Array<readonly [keyof T, T[keyof T]]>;
  }
  export function fromEntries<K extends string | number | symbol, V>(entries: Array<readonly [K, V]>) {
    return Object.fromEntries(entries) as { [key in K]: V };
  }
  export function mapValues<T, U>(obj: T, fn: (entry: { key: keyof T, value: T[keyof T] }) => U): { [key in keyof T]: U } {
    return fromEntries(entries(obj).map(([key, value]) => <const>[key, fn({ key, value })]));
  }
}

function ikRunner(
  state: {
    position: Vector3,
    rotation: Quaternion,
  },
  settings: {
    BlendElbowToWristYaw: number,
    ForearmBlend: number,
    ForarmLength: number,
    UpperArmLength: number,
  },
  nodes: {
    Shoulder: TransformNode,
    Elbow: TransformNode,
    Forearm: TransformNode,
    ForearmMid: TransformNode,
    Wrist: TransformNode,
  }
) {
  // Elbow should try to get to orientation target
  const {
    BlendElbowToWristYaw,
    ForarmLength,
    UpperArmLength,
    ForearmBlend
  } = settings;

  // Orient shoulder to have down facing the elbow target, and forward facing the wrist target
  const shoulderToWrist: Vector3 = state.position.subtract(nodes.Shoulder.position);
  const startingShoulderRotation: Quaternion = Quaternion.FromLookDirectionLH // LH or RH?
    (shoulderToWrist, Vector3.Lerp(Vector3.Up(), Vector3.Up().applyRotationQuaternion(state.rotation), BlendElbowToWristYaw));

  // Calculate elbow angle required to get wrist to target position
  const shoulderToWristDistance: number = shoulderToWrist.length();
  const elbowAngle: number = AngleBetween3Lengths(ForarmLength, UpperArmLength, shoulderToWristDistance);
  const shoulderAngle: number = AngleBetween3Lengths(shoulderToWristDistance, UpperArmLength, ForarmLength);

  const halfPi = Math.PI * 0.5;

  nodes.Shoulder.rotationQuaternion = startingShoulderRotation.multiply(Quaternion.RotationAxis(Vector3.Right(), halfPi + shoulderAngle)).multiply(Quaternion.RotationAxis(Vector3.Up(), -90));
  nodes.Elbow.rotationQuaternion = Quaternion.RotationAxis(Vector3.Forward(), Math.PI - elbowAngle);

  // Orient forearm to view wrist target within reasonable limits
  nodes.Forearm.rotationQuaternion = Quaternion.FromLookDirectionLH(Vector3.Up(), Vector3.Forward().applyRotationQuaternion(Quaternion.Inverse(nodes.Elbow.absoluteRotationQuaternion).multiply(state.rotation))).multiply(Quaternion.RotationAxis(Vector3.Right(), halfPi));
  // Rotate mid region half of what forearm got rotated
  nodes.ForearmMid.rotationQuaternion = Quaternion.Slerp(Quaternion.Identity(), nodes.Forearm.rotationQuaternion, ForearmBlend);
  // Rotate wrist to view wrist target - only allow a very small amount of Yaw
  nodes.Wrist.rotationQuaternion = Quaternion.FromLookDirectionLH(Vector3.Right(), Vector3.Up().applyRotationQuaternion(Quaternion.Inverse(nodes.Forearm.absoluteRotationQuaternion).multiply(state.rotation))).multiply(Quaternion.RotationAxis(Vector3.Up(), -90));
}

async function run() {
  // create the canvas html element and attach it to the webpage
  const canvas = document.createElement("canvas");
  canvas.style.width = "100%";
  canvas.style.height = "100%";
  canvas.id = "gameCanvas";
  document.body.style.margin = "0px";
  document.body.style.width = "100%";
  document.body.style.height = "100%";
  document.body.style.overflow = "hidden";
  const app = document.getElementById("app")!;
  app.style.width = "100%";
  app.style.height = "100%";
  app.style.position = "absolute";
  app.style.top = "0px";
  app.style.left = "0px";
  app.appendChild(canvas);

  // initialize babylon scene and engine
  const engine = new Engine(canvas, true);
  const scene = new Scene(engine);

  const camera: ArcRotateCamera = new ArcRotateCamera("Camera", Math.PI / 2, Math.PI / 2, 2, Vector3.Zero(), scene);
  camera.attachControl(canvas, true);
  const light1: HemisphericLight = new HemisphericLight("light1", new Vector3(1, 1, 0), scene);
  // const sphere: Mesh = MeshBuilder.CreateSphere("sphere", { diameter: 1 }, scene);

  // Load glb from public/FPS Rig.glb
  const FPSRig = await loadStaticGLTF(scene, "FPS Rig.glb", FpsRigSpec);
  {
    const { Armature, Shoulder, "Finger.Middle.A": middleA } = FPSRig.transformNodes;
    Armature.scaling = Vector3.One().scale(.1);
    console.log(Shoulder.id + " " + middleA.id);
  }
  {
    const { WristCurl, Slip } = FPSRig.animationGroups;
    WristCurl.play(true);
    Slip.play(true);
  }

  const DishThicknesses: Record<keyof typeof DishesSpec.meshes, number> = {
    Plate: 0.2,
    Bowl: 0.2,
    Cup: 0.3,
    Fork: 0.1,
    Knife: 0.1,
    Spoon: 0.1,
  };

  const Dishes = await loadStaticGLTF(scene, "Dishes.gltf", DishesSpec);
  {
    // Duplicate the Dishes 3 times and stack them
    ObjUtil.entries(Dishes.meshes).forEach(([name, mesh]) => {
      const thickness = DishThicknesses[name];
      const { position, rotationQuaternion } = mesh;
      const stack = [mesh];
      for (let i = 0; i < 3; i++) {
        const dish = mesh.clone(`${name}${i}`, null)!;
        dish.position = position.add(new Vector3(0, i * thickness, 0));
        dish.rotationQuaternion = rotationQuaternion;
        stack.push(dish);
      }
    });
  };


  // Hide/show the Inspector
  window.addEventListener("keydown", (ev) => {
    // Shift+Ctrl+Alt+I
    if (ev.shiftKey && ev.ctrlKey && ev.altKey && ev.key === 'i') {
      if (scene.debugLayer.isVisible()) {
        scene.debugLayer.hide();
      } else {
        scene.debugLayer.show();
      }
    }
  });

  // Setup inspector
  Inspector.Show(scene, {
    embedMode: true,
    handleResize: true,
    enableClose: false,
    enablePopup: false,
  });

  // Window resize handler
  window.addEventListener("resize", () => {
    engine.resize();
  });


  // Run the main render loop
  engine.runRenderLoop(() => {
    scene.render();
    // ikRunner(
    //   {
    //     rotation: camera.rotationQuaternion,
    //     position: camera.position,
    //   },
    //   {
    //     BlendElbowToWristYaw: 0.5,
    //     ForearmBlend: 0.5,
    //     ForarmLength: 0.5,
    //     UpperArmLength: 0.5,
    //   },
    //   FPSRig.transformNodes,
    // );
  });
}

run();
type GLTFNodeNames = {
  readonly meshes: Record<string, true>,
  readonly transformNodes: Record<string, true>,
  readonly skeletons: Record<string, true>,
  readonly lights: Record<string, true>,
  readonly animationGroups: Record<string, true>,
};
async function loadStaticGLTF<
  T extends GLTFNodeNames,
>(parentScene: Scene, path: string, names: T) {
  const gltf = await SceneLoader.ImportMeshAsync(null, "/", path, parentScene);
  console.log(gltf.meshes);
  const nodes = {
    meshes: ObjUtil.mapValues(names.meshes, ({ key }) => gltf.meshes.find(m => m.name === key)) as { [key in keyof T["meshes"]]: Mesh },
    transformNodes: ObjUtil.mapValues(names.transformNodes, ({ key }) => gltf.transformNodes.find(t => t.name === key)) as { [key in keyof T["transformNodes"]]: TransformNode },
    skeletons: ObjUtil.mapValues(names.skeletons, ({ key }) => gltf.skeletons.find(s => s.name === key)) as { [key in keyof T["skeletons"]]: Skeleton },
    lights: ObjUtil.mapValues(names.lights, ({ key }) => gltf.lights.find(l => l.name === key)) as { [key in keyof T["lights"]]: Light },
    animationGroups: ObjUtil.mapValues(names.animationGroups, ({ key }) => gltf.animationGroups.find(a => a.name === key)) as { [key in keyof T["animationGroups"]]: AnimationGroup },
  };
  return {
    ...gltf,
    ...nodes,
  };
}