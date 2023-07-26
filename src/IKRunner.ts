import { engine } from "app";
import { Vector3, Quaternion, TransformNode, MeshBuilder, Scene, Color4 } from "babylonjs";
import { newElement } from "HtmlUtils"
import { ObjUtil } from "ObjUtil";

export function AngleBetween3Lengths(a: number, b: number, c: number): number {
  return Math.acos((a * a + b * b - c * c) / (2 * a * b));
}
export function ikRunner(
  scene: Scene,
  state: {
    position: Vector3;
    rotation: Quaternion;
  },
  settings: {
    BlendElbowToWristYaw: number;
    ForearmBlend: number;
    ForarmLength: number;
    UpperArmLength: number;
  },
  nodes: {
    Shoulder: TransformNode;
    Elbow: TransformNode;
    Forearm: TransformNode;
    ForearmMid: TransformNode;
    Hand: TransformNode;
  }
) {
  // Elbow should try to get to orientation target
  const {
    BlendElbowToWristYaw, ForarmLength, UpperArmLength, ForearmBlend
  } = settings;

  settings.ForearmBlend;

  // Automatically cross-cross the 'up' direction to get it orthoganal to the forward direction
  function SafeFromLookDirection(forward: Vector3, up: Vector3) {
    const finalUp = Vector3.Normalize(Vector3.Cross(forward, Vector3.Cross(up, forward)));
    debug_normals(scene, {
      finalUp: { position: state.position, normal: finalUp, color: new Color4(1, 0, 0, 1) },
      forward: { position: state.position, normal: forward, color: new Color4(0, 0, 1, 1) }
    });
    return Quaternion.FromLookDirectionLH(
      Vector3.Normalize(forward),
      finalUp,
    );
  }

  /**
   * @param scene
   * @param elements
   * @example
   * lazyDebugNormals(scene, {
  *   finalUp: { position: state.position, normal: finalUp, color: new Color4(1, 0, 0, 1) },
  *   forward: { position: state.position, normal: forward, color: new Color4(0, 0, 1, 1) }
  * });
  */
  function debug_normals<Keys extends string>(
    scene: Scene,
    elements: Record<Keys, { position: Vector3, normal: Vector3, color: Color4 }>
  ) {
    debug_lines(scene, ObjUtil.mapValues(elements, ({ value: { position, normal, color } }) => ({
      points: [position, position.add(normal)], color
    })));
  }
  function debug_lines(scene: Scene, elements: Record<string, { points: Vector3[], color: Color4 }>) {
    const entries = Object.entries(elements);
    entries.forEach(([key, { points, color }]) => {
      const debugLine = scene.getMeshByName(key);
      if (debugLine) {
        debugLine.dispose();
      }
      MeshBuilder.CreateLines(key, { points, colors: points.map(_ => color) }, scene);
    });
    debug_label(scene, ObjUtil.mapValues(elements, ({ value: { points: [start, end] } }) => ({
      position: start.add(end).scale(0.5), text: "debug"
    })));

  }

  function debug_label(scene: Scene, elements: Record<string, { position: Vector3, text: string }>) {
    Object.entries(elements).forEach(([key, { position, text }]) => {
      const screenspacePosition = Vector3.One();//Vector3.Project(
        // vector: position,
        // world: scene.cameras[0].getWorldMatrix(),
        // transform: scene.(),
        // scene.cameras[0].viewport.toGlobal(engine.getRenderWidth(), engine.getRenderHeight()));
      const labelDiv = document.getElementById(key);
      if (labelDiv) {
        labelDiv.remove();
      }
      newElement("div", document.body, {
        style: {
          position: "absolute",
          left: `${screenspacePosition.x}px`,
          top: `${screenspacePosition.y}px`,
          color: "white",
          zIndex: "1000",
        },
        id: key,
        innerHTML: text,
      });
    });
  }

  // Orient shoulder to have down facing the elbow target, and forward facing the wrist target
  const shoulderToHandTarget: Vector3 = state.position.subtract(nodes.Shoulder.absolutePosition);
  const startingShoulderRotation: Quaternion = SafeFromLookDirection(
    shoulderToHandTarget,
    // Vector3.Lerp(
    Vector3.Up(),
    // Vector3.Up().applyRotationQuaternion(state.rotation),
    // BlendElbowToWristYaw)
  );

  // Calculate elbow angle required to get wrist to target position
  const shoulderToWristDistance: number = shoulderToHandTarget.length();
  const elbowAngle: number = AngleBetween3Lengths(ForarmLength, UpperArmLength, shoulderToWristDistance);
  const shoulderAngle: number = AngleBetween3Lengths(shoulderToWristDistance, UpperArmLength, ForarmLength);

  const halfPi = Math.PI * 0.5;

  nodes.Shoulder.rotationQuaternion = Quaternion.Identity()
    .multiply(Quaternion.RotationAxis(Vector3.Forward(), Math.PI))
    .multiply(startingShoulderRotation)
    .multiply(Quaternion.RotationAxis(Vector3.Right(), halfPi - shoulderAngle))
    .multiply(Quaternion.RotationAxis(Vector3.Up(), -halfPi))
  nodes.Elbow.rotationQuaternion = Quaternion.RotationAxis(Vector3.Forward(), Math.PI + elbowAngle);

  // TODO - actually get the next lines to work!

  // // Orient forearm to view wrist target within reasonable limits
  // nodes.Forearm.rotationQuaternion = Quaternion.FromLookDirectionLH(Vector3.Up(), Vector3.Forward().applyRotationQuaternion(Quaternion.Inverse(nodes.Elbow.absoluteRotationQuaternion).multiply(state.rotation))).multiply(Quaternion.RotationAxis(Vector3.Right(), halfPi));
  // // Rotate mid region half of what forearm got rotated
  // nodes.ForearmMid.rotationQuaternion = Quaternion.Slerp(Quaternion.Identity(), nodes.Forearm.rotationQuaternion, ForearmBlend);
  // // Rotate wrist to view wrist target - only allow a very small amount of Yaw
  // nodes.Hand.rotationQuaternion = Quaternion.FromLookDirectionLH(Vector3.Right(), Vector3.Up().applyRotationQuaternion(Quaternion.Inverse(nodes.Forearm.absoluteRotationQuaternion).multiply(state.rotation))).multiply(Quaternion.RotationAxis(Vector3.Up(), -90));

  // remove previous "debugLine" mesh
  debug_lines(scene, {
    handToPosition: { points: [nodes.Hand.getAbsolutePosition(), state.position], color: new Color4(0, 1, 0, 1) }
  });
}
