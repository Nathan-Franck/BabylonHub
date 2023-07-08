import { CreateStandardCanvas } from "CreateStandardCanvas";
import { CubeSpec } from "Cube";
import { DishesSpec } from "Dishes";
import { Engine, Scene, ArcRotateCamera, Vector3, HemisphericLight, TransformNode, Vector2, MeshBuilder, Matrix, Quaternion, DirectionalLight, ShadowGenerator, Color3 } from "babylonjs";
import { FpsRigSpec } from "FPS Rig";
import { Inspector } from "babylonjs-inspector";
import { ObjUtil } from "ObjUtil";
import { Perf } from "Perf";
import { StaticGLTF } from "StaticGLTF";

/**
 * Store some state in the web browser.
 */
class StateStore<T extends Record<any, any>> {
  constructor(private key: string, private state: T) {
    const stored = localStorage.getItem(key);
    if (stored) {
      this.state = JSON.parse(stored);
      // Iterate through all elements of the initial state and compare, if they are not the same types, then just use the initial state.
      var objectsToCheck: Array<{ stored: Record<any, any>, initial: Record<any, any> }> = [{ stored: this.state, initial: state }];
      check: while (objectsToCheck.length > 0) {
        const { stored, initial } = objectsToCheck.pop()!;
        for (const key in initial) {
          console.log("StateStore: checking state type", key, typeof initial[key], typeof stored[key]);
          if (typeof initial[key] !== typeof stored[key]) {
            console.log("StateStore: state type mismatch, using initial state", key, initial[key], this.state[key]);
            this.state = state;
            break check;
          }
          if (typeof initial[key] === "object") {
            objectsToCheck.push({ stored: stored[key], initial: initial[key] });
          }
        }
      }
    }
  }
  getState() {
    return this.state;
  }
  setState(state: T) {
    this.state = state;
    localStorage.setItem(this.key, JSON.stringify(state));
  }
}

async function timeAsync<T>(name: string, f: () => T): Promise<T> {
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

  const debugStateStore = new StateStore("debug", { camera: { alpha: 0, beta: 0, radius: 1 }, inspector: false });
  const camera: ArcRotateCamera = new ArcRotateCamera("Camera", Math.PI / 2, Math.PI / 2, 2, Vector3.Zero(), scene);
  camera.attachControl(canvas, true);
  {
    const skyLight = new HemisphericLight("light1", new Vector3(0, 1, 0), scene);
    skyLight.intensity = 0.05
    // sky blue color
    skyLight.diffuse = new Color3(0.31, 0.4, 0.5);
    const groundLight = new HemisphericLight("light2", new Vector3(0, -1, 0), scene);
    groundLight.intensity = 0.025
    // soft brown color
    groundLight.diffuse = new Color3(0.5, 0.4, 0.31);
  }
  const light = new DirectionalLight("light2", new Vector3(-1, -1, -1), scene);
  {
    light.position = new Vector3(0, 10, 0);
    light.shadowEnabled = true;
  }
  const shadowGenerator = new ShadowGenerator(1024, light);
  {
    // shadowGenerator.useBlurExponentialShadowMap = true;
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

  const Cube = await Perf.timeAsync("Cube", async () => await StaticGLTF.Load(scene, "Cube.glb", CubeSpec));
  const Dishes = await Perf.timeAsync("Dishes", async () => await StaticGLTF.Load(scene, "Dishes.glb", DishesSpec));

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
    return function () {
      var t = a += 0x6D2B79F5;
      t = Math.imul(t ^ t >>> 15, t | 1);
      t ^= t + Math.imul(t ^ t >>> 7, t | 61);
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    }
  }

  const pseudoRandom01 = mulberry32(0);

  // Using the radius of the bottom of the fork, fill another bowl with forks.
  function FillItWithForks(dishToFill: Dish, offset: Vector3) {
    const dishInstance = Dishes.meshes[dishToFill].clone(`${dishToFill}-instance`, null)!;
    shadowGenerator.addShadowCaster(dishInstance);
    dishInstance.receiveShadows = true;
    dishInstance.parent = null;
    dishInstance.position = offset;
    const forkBottomPositions = fillCircleFromOutside(
      stats.Bottom[dishToFill].radius,
      stats.Bottom.Fork.radius,
      70
    )
      .map(position => new Vector3(position.x, 0, position.y))
      .map(position => stats.Bottom[dishToFill].position.add(position));
    const forkTopPositions = fillCircleFromOutside(
      stats.Top[dishToFill].radius,
      stats.Top.Fork.radius,
      forkBottomPositions.length
    )
      .map(position => new Vector3(position.y, 0, -position.x))
      .map(position => stats.Top[dishToFill].position.add(position));

    forkBottomPositions
      .forEach((bottomPosition, index) => {
        const fork = Dishes.meshes.Fork.clone("fork", null)!;
        shadowGenerator.addShadowCaster(fork);
        fork.receiveShadows = true;
        fork.parent = dishInstance;
        const pointingDirection = Vector3.Normalize(forkTopPositions[index].subtract(bottomPosition));
        fork.rotationQuaternion = Quaternion.FromLookDirectionLH(
          pointingDirection,
          Vector3.Normalize(Vector3.Cross(
            pointingDirection,
            Vector3.Up()
          ))
        )
          .multiply(Quaternion.FromEulerAngles(pseudoRandom01() * Math.PI * 2, Math.PI / 2, 0));
        fork.computeWorldMatrix(true);
        fork.position = bottomPosition
          .subtract(Vector3.TransformNormal(stats.Bottom.Fork.position, fork._localMatrix));
      });

    return dishInstance;
  }
  FillItWithForks("Bowl", new Vector3(-2, 0, 0));
  const cupWithForks = FillItWithForks("Cup", new Vector3(0, 0, 0));
  FillItWithForks("Plate", new Vector3(2, 0, 0));

  // Frame camera on bowl2
  {
    var bowlCenter = cupWithForks.getBoundingInfo().boundingBox.centerWorld;
    // camera.setTarget(bowlCenter);
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
      await new Promise((resolve) => setTimeout(resolve, 100));
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

  // Create a 'show' inspector button in the top right corner of the canvas
  // manipulate dom for this
  const inspectorButton = document.createElement("button");
  inspectorButton.innerText = "Show Inspector";
  inspectorButton.style.position = "absolute";
  inspectorButton.style.top = "0";
  inspectorButton.style.left = "0";
  inspectorButton.style.zIndex = "100";
  inspectorButton.addEventListener("click", () => {
    Inspector.Show(scene, {
      embedMode: true,
      handleResize: true,
      enablePopup: false,
    });
  });
  document.body.appendChild(inspectorButton);

  if (!debugStateStore.getState().inspector) Inspector.Hide();

  // Window resize handler
  window.addEventListener("resize", () => {
    engine.resize();
  });

  // Run the main render loop
  engine.runRenderLoop(() => {
    scene.render();
    debugStateStore.setState({ camera: { alpha: camera.alpha, beta: camera.beta, radius: camera.radius }, inspector: Inspector.IsVisible });
  });

  console.log(performance.now() - startTime, "ms to load scene");
}

run();
