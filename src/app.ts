import { CreateStandardCanvas } from "CreateStandardCanvas";
import { DishesSpec } from "Dishes";
import {
  Engine,
  Scene,
  ArcRotateCamera,
  Vector3,
  HemisphericLight,
  TransformNode,
  Vector2,
  MeshBuilder,
  Quaternion,
  DirectionalLight,
  ShadowGenerator,
  Color3,
} from "babylonjs";
import { FpsRigSpec } from "FPS Rig";
import { Inspector } from "babylonjs-inspector";
import { ObjUtil } from "ObjUtil";
import { StaticGLTF } from "StaticGLTF";
import { StateStore } from "StateStore";
import { RoomSpec } from "Room";
import { newElement } from "HtmlUtils";
import { ikRunner } from "IKRunner";

export async function timeAsync<T>(name: string, f: () => T): Promise<T> {
  const startTime = performance.now();
  const result = await f();
  console.log(name, performance.now() - startTime, "ms");
  return result;
}

async function run() {
  const startTime = performance.now();
  const canvas = CreateStandardCanvas();

  // initialize babylon scene and engine
  const engine = new Engine(canvas, true);
  const scene = new Scene(engine);

  const debugStateStore = new StateStore("debug", {
    camera: { alpha: 0, beta: 0, radius: 1 },
    inspector: false
  });
  const camera: ArcRotateCamera = new ArcRotateCamera(
    "Camera",
    Math.PI / 2,
    Math.PI / 2,
    2,
    Vector3.Zero(),
    scene);
  camera.attachControl(canvas, true);
  {
    const skyLight = new HemisphericLight("light1", new Vector3(0, 1, 0), scene);
    skyLight.intensity = 0.05
    skyLight.diffuse = new Color3(0.31, 0.4, 0.5);
    const groundLight = new HemisphericLight("light2", new Vector3(0, -1, 0), scene);
    groundLight.intensity = 0.025
    groundLight.diffuse = new Color3(0.5, 0.4, 0.31);
  }

  const light = new DirectionalLight("light2", new Vector3(-1, -1, -1), scene);
  {
    light.position = new Vector3(0, 10, 0);
    light.shadowEnabled = true;
  }
  const shadowGenerator = new ShadowGenerator(1024, light);
  {
    shadowGenerator.useBlurExponentialShadowMap = true;
    shadowGenerator.blurKernel = 32;
    shadowGenerator.useKernelBlur = true;
    shadowGenerator.blurScale = 2;
    shadowGenerator.blurBoxOffset = 1;
    shadowGenerator.usePercentageCloserFiltering = true;
    shadowGenerator.filteringQuality = ShadowGenerator.QUALITY_HIGH;
    shadowGenerator.bias = 0.00001;
    shadowGenerator.normalBias = 0.01;
  }

  // set camera angle from debug state
  {
    const { alpha, beta, radius } = debugStateStore.getState().camera;
    camera.alpha = alpha;
    camera.beta = beta;
    camera.radius = radius;
  }

  const FPSRig = await StaticGLTF.Load(scene, "FPS Rig.glb", FpsRigSpec);
  FPSRig.root.position = new Vector3(-10, 0, 0);
  FPSRig.root.rotationQuaternion = Quaternion.Identity();

  // Get some transforms.
  {
    const { Armature, Shoulder, "Finger.Middle.A": middleA } = FPSRig.transformNodes;
    Armature.scaling = Vector3.One().scale(.1);
    Armature.rotationQuaternion = Quaternion.Identity();
    console.log(Shoulder.id + " " + middleA.id);
  }

  // Play some animations.
  {
    const { ArmatureAction, WristCurl, Slip } = FPSRig.animationGroups;
    ArmatureAction.stop();
    WristCurl.stop();
    Slip.stop();

  }

  const Room = await StaticGLTF.Load(scene, "Room.glb", RoomSpec);
  console.table(Room.transformNodes);
  const Dishes = await StaticGLTF.Load(scene, "Dishes.glb", DishesSpec);

  // Move dishes to the right.
  Dishes.root.position = new Vector3(10, 0, 0);

  type Dish = keyof typeof DishesSpec.meshes;
  const DishThicknesses: Record<Dish, number> = {
    Plate: 0.1,
    Bowl: 0.3,
    Cup: 0.5,
    Fork: 0.06,
    Knife: 0.1,
    Spoon: 0.06,
  };

  // Collect all transform nodes that are prefixed with stats and are children of a dish.
  const StackingCompatability: Partial<Record<Dish, Dish[]>> = {
    Plate: ["Plate", "Bowl", "Cup"],
    Bowl: ["Cup"],
    Cup: [],
  };

  var dishModelStats = new StaticGLTF.ModelStats(
    DishesSpec.transformNodes,
    Dishes.transformNodes
  );
  var radiusAndPosition = (node: TransformNode) => ({
    radius: node.scaling.x,
    position: node.position,
  });
  var stats = {
    ...dishModelStats.fromChildNode("Top", radiusAndPosition),
    ...dishModelStats.fromChildNode("Bottom", radiusAndPosition),
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

  // Given a position, radius, and count, return a spiral of positions (Vector3) around the position.
  function fillCircleFromOutside(circleRadius: number, itemRadius: number, count: number) {
    const positions: Vector2[] = [];
    const itemDiameter = itemRadius * 2;
    const itemsTowardsCenter = Math.round(circleRadius / itemDiameter);
    const innerOffsetPerItem = circleRadius / itemsTowardsCenter;
    fill: for (let j = 0; j < itemsTowardsCenter; j++) {
      const radius = circleRadius - (j + 0.5) * innerOffsetPerItem;
      const offset = j % 2 === 0 ? itemRadius : 0;
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
  shadowGenerator.addShadowCaster(bowl);
  bowl.position = new Vector3(4, 0, 0);
  fillCircleFromOutside(stats.Top.Bowl.radius, 0.1, 70)
    .forEach((position) => {
      const sphere = MeshBuilder.CreateSphere("sphere", { diameter: 0.2 }, scene);
      shadowGenerator.addShadowCaster(sphere);
      sphere.parent = bowl;
      sphere.position = stats.Top.Bowl.position.add(new Vector3(position.x, 0, position.y));
    });

  // seed randomness
  function mulberry32(a: number) {
    return function() {
      var t = a += 0x6D2B79F5;
      t = Math.imul(t ^ t >>> 15, t | 1);
      t ^= t + Math.imul(t ^ t >>> 7, t | 61);
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    }
  }

  const pseudoRandom01 = mulberry32(0);

  // this is a comment
  // Using the radius of the bottom of the fork, fill another bowl with forks.
  function FillItWithSpoons(dishToFill: Dish, offset: Vector3) {
    const dishInstance = Dishes.meshes[dishToFill].clone(`${dishToFill}-instance`, null)!;
    shadowGenerator.addShadowCaster(dishInstance);
    dishInstance.receiveShadows = true;
    dishInstance.parent = null;
    dishInstance.position = offset;
    const spoonBottomPositions = fillCircleFromOutside(
      stats.Bottom[dishToFill].radius,
      stats.Bottom.Spoon.radius,
      70
    )
      .map(position => new Vector3(position.x, 0, position.y))
      .map(position => stats.Bottom[dishToFill].position.add(position));
    const spoonTopPositions = fillCircleFromOutside(
      stats.Top[dishToFill].radius,
      stats.Top.Spoon.radius,
      spoonBottomPositions.length
    )
      .map(position => new Vector3(position.y, 0, -position.x))
      .map(position => stats.Top[dishToFill].position.add(position));

    // randomize order of spoonTopPositions
    for (let i = spoonTopPositions.length - 1; i > 0; i--) {
      const j = Math.floor(pseudoRandom01() * (i + 1));
      [spoonTopPositions[i], spoonTopPositions[j]] = [spoonTopPositions[j], spoonTopPositions[i]];
    }

    spoonBottomPositions
      .slice(0, spoonTopPositions.length)
      .forEach((bottomPosition, index) => {
        const spoon = Dishes.meshes.Spoon.clone("spoon", null)!;
        shadowGenerator.addShadowCaster(spoon);
        spoon.receiveShadows = true;
        spoon.parent = dishInstance;
        const pointingDirection = Vector3.Normalize(spoonTopPositions[index].subtract(bottomPosition));
        spoon.rotationQuaternion = Quaternion.FromLookDirectionLH(
          pointingDirection,
          Vector3.Normalize(Vector3.Cross(
            pointingDirection,
            Vector3.Up()
          ))
        )
          .multiply(Quaternion.FromEulerAngles(pseudoRandom01() * Math.PI * 2, Math.PI / 2, 0));
        spoon.computeWorldMatrix(true);
        spoon.position = bottomPosition
          .subtract(Vector3.TransformNormal(stats.Bottom.Spoon.position, spoon._localMatrix));
      });

    return dishInstance;
  }
  FillItWithSpoons("Bowl", new Vector3(-2, 0, 0));
  FillItWithSpoons("Cup", new Vector3(0, 0, 0));
  FillItWithSpoons("Plate", new Vector3(2, 0, 0));

  // spin triangles backwards
  {
    const mesh = Room.meshes.Floorboards;
    mesh.flipFaces(true);
  }

  // Focus camera on bounds of mesh
  {
    const bounds = FPSRig.meshes.Arm.getHierarchyBoundingVectors();
    const center = bounds.max.add(bounds.min).scale(0.5);
    camera.setTarget(center);
  }

  // Stack some dishes.
  (async () => {
    const stack: Dish[] = [];
    const stackNode = new TransformNode("stack", scene);
    stackNode.position = new Vector3(0, 0, -3);
    for (let i = 0; i < 30; i++) {
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
        shadowGenerator.addShadowCaster(mesh);
        mesh.receiveShadows = true;
        mesh.position = Vector3.Up().scale(currentHeight);
        currentHeight += DishThicknesses[dish];
      });
      await new Promise((resolve) => setTimeout(
        resolve,
        100
      ));
    }
  })();

  // force all models in scene to cast and receive shadows
  scene.meshes.forEach((mesh) => {
    shadowGenerator.addShadowCaster(mesh);
    mesh.receiveShadows = true;
  });

  // Setup inspector
  Inspector.Show(scene, {
    embedMode: true,
    handleResize: true,
    enablePopup: false,
  });


  newElement("button", document.body, {
    innerText: "Show Inspector",
    onclick: () => {
      Inspector.Show(scene, {
        embedMode: true,
        handleResize: true,
        enablePopup: false,
      });
    },
    style: {
      position: "absolute",
      top: "0",
      left: "0",
      zIndex: "100"
    }
  });

  // const fpsCounter = newElement("div", document.body, {
  //   innerText: "0 fps",
  //   style: {
  //     position: "absolute",
  //     top: "0",
  //     right: "0",
  //     zIndex: "100"
  //   }
  // });
  // scene.registerBeforeRender(() => {
  //   fpsCounter.innerText = `${engine.getFps().toFixed()} fps`;
  // });

  if (!debugStateStore.getState().inspector) Inspector.Hide();

  // Window resize handler
  window.addEventListener("resize", () => {
    engine.resize();
  });

  // Force recaltulate world matrices recursively up from FPSRig
  ObjUtil.values(FPSRig.transformNodes).forEach(node => node.computeWorldMatrix(true));
  const ikTestPosition = FPSRig.transformNodes.Hand.absolutePosition.add(new Vector3(0, -1, 0));
  const ikStats = {
    BlendElbowToWristYaw: 0,
    ForearmBlend: 1,
    ForarmLength: FPSRig.transformNodes.Hand.absolutePosition
      .subtract(FPSRig.transformNodes.Elbow.absolutePosition)
      .length(),
    UpperArmLength: FPSRig.transformNodes.Shoulder.absolutePosition
      .subtract(FPSRig.transformNodes.Elbow.absolutePosition)
      .length(),
  };

  scene.registerBeforeRender(() => {
    ikRunner(
      scene,
      {
        position: ikTestPosition.add(new Vector3(
          Math.cos(performance.now() / 1000) * 0.5,
          Math.sin(performance.now() / 1000) * 0.5,
          0
        )),
        rotation: new Quaternion(0, 0, 0, 1),
      },
      ikStats,
      FPSRig.transformNodes,
    );
  });

  // Run the main render loop
  engine.runRenderLoop(() => {
    scene.render();
    debugStateStore.setState({
      camera: { alpha: camera.alpha, beta: camera.beta, radius: camera.radius },
      inspector: Inspector.IsVisible
    });
  });

  console.log(performance.now() - startTime, "ms to load scene");
}

run()
