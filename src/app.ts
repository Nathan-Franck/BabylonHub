import { ArcRotateCamera, Engine, HemisphericLight, Mesh, MeshBuilder, Scene, SceneLoader, Vector3 } from "babylonjs";
import { Inspector } from "babylonjs-inspector";

async function run() {
  // create the canvas html element and attach it to the webpage
  var canvas = document.createElement("canvas");
  canvas.style.width = "100%";
  canvas.style.height = "100%";
  canvas.id = "gameCanvas";
  document.body.style.margin = "0px";
  document.body.style.width = "100%";
  document.body.style.height = "100%";
  document.body.style.overflow = "hidden";
  var app = document.getElementById("app");
  app.style.width = "100%";
  app.style.height = "100%";
  app.style.position = "absolute";
  app.style.top = "0px";
  app.style.left = "0px";
  app.appendChild(canvas);

  // initialize babylon scene and engine
  var engine = new Engine(canvas, true);
  var scene = new Scene(engine);

  var camera: ArcRotateCamera = new ArcRotateCamera("Camera", Math.PI / 2, Math.PI / 2, 2, Vector3.Zero(), scene);
  camera.attachControl(canvas, true);
  var light1: HemisphericLight = new HemisphericLight("light1", new Vector3(1, 1, 0), scene);
  // var sphere: Mesh = MeshBuilder.CreateSphere("sphere", { diameter: 1 }, scene);

  // Load glb from public/FPS Rig.glb
  var gltf = await SceneLoader.ImportMeshAsync(null, "/", "FPS Rig.glb", scene);
  gltf.meshes[0].scaling = Vector3.One().scale(.1);

  var armatureStructure = {
    "Shoulder": {
      "Elbow": {
        "Forearm": {
          "Hand": {
            "Finger.Pinky.A": {
              "Finger.Pinky.B": {
                "Finger.Pinky.C": {}
              }
            },
            "Finger.Ring.A": {
              "Finger.Ring.B": {
                "Finger.Ring.C": {}
              }
            },
            "Finger.Middle.A": {
              "Finger.Middle.B": {
                "Finger.Middle.C": {}
              }
            },
            "Finger.Index.A": {
              "Finger.Index.B": {
                "Finger.Index.C": {}
              }
            },
            "Finger.Thumb.A": {
              "Finger.Thumb.B": {
                "Finger.Thumb.C": {}
              }
            }
          }
        }
      }
    }
  };

  console.log(gltf.transformNodes.find(t => t.name === "Shoulder"));

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
  });
}

run();
