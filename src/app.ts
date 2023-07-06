import { Engine, Scene, ArcRotateCamera, Vector3, HemisphericLight, TransformNode, Vector2, MeshBuilder, Matrix } from "babylonjs";
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
  // Collect all transform nodes that are prefixed with stats and are children of a dish.
  const DishStats = ObjUtil.mapValues(Dishes.transformNodes, ({ key, value }) => { });

  const StackingCompatability: Partial<Record<Dish, Dish[]>> = {
    Plate: ["Plate", "Bowl", "Cup"],
    Bowl: ["Cup"],
    Cup: [],
  };

  var dishModelStats = new StaticGLTF.ModelStats(DishesSpec.transformNodes, Dishes.transformNodes);
  var radiusAndPosition = (node: TransformNode) => ({
    radius: node.scaling.x,
    position: node.position,
  });
  var stats = {
    ...dishModelStats.fromChildNode("Top", radiusAndPosition),
    ...dishModelStats.fromChildNode("Bottom", radiusAndPosition),
  };
  console.log(stats);

  ObjUtil.entries(Dishes.meshes).forEach(([name, mesh]) => {
    const thickness = DishThicknesses[name];
    const stack = [mesh];
    for (let i = 0; i < 3; i++) {
      const dish = mesh.clone(`${name}${i}`, null)!;
      dish.position = mesh.position.add(new Vector3(0, i * thickness, 0));
      stack.push(dish);
    }
  });

  // Given a position, radius, and count, return a spiral of positions (Vector3) around the position.
  function fillCircleFromOutside(circleRadius: number, itemDiameter: number, count: number) {
    const positions: Vector2[] = [];
    const itemsTowardsCenter = Math.round(circleRadius / itemDiameter);
    const innerOffsetPerItem = circleRadius / itemsTowardsCenter;
    fill: for (let j = 0; j < itemsTowardsCenter; j++) {
      const radius = circleRadius - (j + 0.5) * innerOffsetPerItem;
      const offset = j % 2 === 0 ? itemDiameter / 2 : 0;
      const itemsInRadius = Math.round(2 * Math.PI * radius / itemDiameter);
      const anglePerItem = 2 * Math.PI / itemsInRadius;
      for (let i = 0; i < itemsInRadius; i++) {
        const angle = (i + offset) * anglePerItem;
        positions.push(new Vector2(Math.cos(angle) * radius, Math.sin(angle) * radius));
        if (positions.length >= count) break fill;
      }
    }
    return positions;
  }

  // Duplicate a bowl, take the top diameter of it and fill it with 5cm spheres.
  const bowl = Dishes.meshes.Bowl.clone("bowl", null)!;
  bowl.position = new Vector3(3, 0, 0);
  fillCircleFromOutside(stats.Top.Bowl.radius, 0.2, 70)
    .forEach((position) => {
      const sphere = MeshBuilder.CreateSphere("sphere", { diameter: 0.2 }, scene);
      sphere.parent = bowl;
      sphere.position = stats.Top.Bowl.position.add(new Vector3(position.x, 0, position.y));
    });

  // Using the radius of the bottom of the fork, fill another bowl with forks.
  const bowl2 = Dishes.meshes.Bowl.clone("bowl2", null)!;
  bowl2.position = new Vector3(0, 0, 3);
  fillCircleFromOutside(stats.Top.Bowl.radius, stats.Bottom.Fork.radius * 2, 70)
    .forEach((position) => {
      const fork = Dishes.meshes.Fork.clone("fork", null)!;
      fork.parent = bowl2;
      fork.position = stats.Top.Bowl.position.add(new Vector3(position.x, 0, position.y));
      // make forks point up at a random angle.
      fork.rotation = new Vector3(0, Math.random() * Math.PI * 2, Math.PI / 2);
    });

  // Stack some dishes.
  async function generateRandomStack() {
    const stack: Dish[] = [];
    const stackNode = new TransformNode("stack", scene);
    for (let i = 0; i < 100; i++) {
      stack.push(ObjUtil.randomKey(StackingCompatability));
      stack.sort((a, b) =>
        StackingCompatability[a]?.includes(b)
          ? -1
          : StackingCompatability[b]?.includes(a)
            ? 1
            : 0);
      stackNode.getChildMeshes().forEach((mesh) => mesh.dispose());
      var currentHeight = 0;
      stack.forEach((dish, i) => {
        const mesh = Dishes.meshes[dish].clone(`${dish}${i}`, stackNode)!;
        mesh.position = Vector3.Up().scale(currentHeight);
        currentHeight += DishThicknesses[dish];
      });
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }

  }
  generateRandomStack();

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
