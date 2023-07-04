import { Engine, Scene, ArcRotateCamera, Vector3, HemisphericLight, TransformNode } from "babylonjs";
import { Inspector } from "babylonjs-inspector";
import { DishesSpec } from "../public/Dishes";
import { FpsRigSpec } from "../public/FPS Rig";
import { CreateStandardCanvas } from "./CreateStandardCanvas";
import { ObjUtil } from "./ObjUtil";
import { StaticGLTF } from "./StaticGLTF";

async function run() {
  const canvas = CreateStandardCanvas();

  // initialize babylon scene and engine
  const engine = new Engine(canvas, true);
  const scene = new Scene(engine);

  const camera: ArcRotateCamera = new ArcRotateCamera("Camera", Math.PI / 2, Math.PI / 2, 2, Vector3.Zero(), scene);
  camera.attachControl(canvas, true);
  const light1: HemisphericLight = new HemisphericLight("light1", new Vector3(1, 1, 0), scene);

  const FPSRig = await StaticGLTF.Load(scene, "FPS Rig.glb", FpsRigSpec);

  // Get some transforms.
  {
    const { Armature, Shoulder, "Finger.Middle.A": middleA } = FPSRig.transformNodes;
    Armature.scaling = Vector3.One().scale(.1);
    console.log(Shoulder.id + " " + middleA.id);
  }

  // Play some animations.
  {
    const { WristCurl, Slip } = FPSRig.animationGroups;
    WristCurl.play(true);
    Slip.play(true);
  }

  const Dishes = await StaticGLTF.Load(scene, "Dishes.gltf", DishesSpec);

  type Dish = keyof typeof DishesSpec.meshes;
  const DishThicknesses: Record<Dish, number> = {
    Plate: 0.3,
    Bowl: 0.3,
    Cup: 0.5,
    Fork: 0.06,
    Knife: 0.1,
    Spoon: 0.06,
  };

  const StackingCompatability: Partial<Record<Dish, Dish[]>> = {
    Plate: ["Plate", "Bowl", "Cup"],
    Bowl: ["Cup"],
    Cup: [],
  };

  ObjUtil.entries(Dishes.meshes).forEach(([name, mesh]) => {
    const thickness = DishThicknesses[name];
    const stack = [mesh];
    for (let i = 0; i < 3; i++) {
      const dish = mesh.clone(`${name}${i}`, null)!;
      dish.position = mesh.position.add(new Vector3(0, i * thickness, 0));
      stack.push(dish);
    }
  });

  async function generateRandomStack() {
    const stack: Dish[] = [];
    // Create new empty node to add dish models under.
    const stackNode = new TransformNode("stack", scene);
    for (let i = 0; i < 100; i ++)
    {
      // Add a random dish to the stack.
      const dish = ObjUtil.randomKey(StackingCompatability) as Dish;
      stack.push(dish);
      // Sort the stack by compatability.
      stack.sort((a, b) => {
        const compatability = StackingCompatability[a];
        if (compatability?.includes(b)) {
          return -1;
        }
        const compatability2 = StackingCompatability[b];
        if (compatability2?.includes(a)) {
          return 1;
        }
        return 0;
      });
      // Clear all existing children under stackNode
      stackNode.getChildMeshes().forEach((mesh) => mesh.dispose());
      // Add all dishes in the stack to the stackNode.
      var currentHeight = 0;
      stack.forEach((dish, i) => {
        const mesh = Dishes.meshes[dish].clone(`${dish}${i}`, stackNode)!;
        mesh.position = Vector3.Up().scale(currentHeight);
        currentHeight += DishThicknesses[dish];
      });
      // Wait 1 second
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }

    setTimeout(generateRandomStack, 1000);
  }
  setTimeout(generateRandomStack, 1000);

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
  });
}

run();
