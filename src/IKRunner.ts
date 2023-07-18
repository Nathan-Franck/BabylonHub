import { Vector3, Quaternion, TransformNode, MeshBuilder, Scene, Color4 } from "babylonjs";
import { newElement } from "HtmlUtils"

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

  // Automatically cross-cross the 'up' direction to get it orthoganal to the forward direction
  function lazyFromLookDirection(forward: Vector3, up: Vector3) {
    const finalUp = Vector3.Normalize(Vector3.Cross(forward, Vector3.Cross(up, forward)));
    lazyDebugNormal(scene, "finalUp", state.position, finalUp, new Color4(1, 0, 0, 1));
    lazyDebugNormal(scene, "forward", state.position, forward, new Color4(0, 0, 1, 1));
    return Quaternion.FromLookDirectionLH(
      Vector3.Normalize(forward),
      finalUp,
    );
  }

  function lazyDebugNormal(scene: Scene, identifier: string, position: Vector3, normal: Vector3, color: Color4) {
    lazyDebugLine(scene, identifier, [position, position.add(normal)], color);
  }
  function lazyDebugLine(scene: Scene, identifier: string, points: Vector3[], color: Color4) {
    const debugLine = scene.getMeshByName(identifier);
    if (debugLine) {
      debugLine.dispose();
    }
    MeshBuilder.CreateLines(identifier, { points, colors: points.map(_ => color) }, scene);
  }

  // Orient shoulder to have down facing the elbow target, and forward facing the wrist target
  const shoulderToHandTarget: Vector3 = state.position.subtract(nodes.Shoulder.absolutePosition);
  const startingShoulderRotation: Quaternion = lazyFromLookDirection(
    shoulderToHandTarget,
    // Vector3.Lerp(
    Vector3.Up(),
    // Vector3.Up().applyRotationQuaternion(state.rotation),
    // BlendElbowToWristYaw)
  );

  // Calculate elbow angle required to get wrist to target position
  const shoulderToWristDistance: number = shoulderToHandTarget.length();
  // Find and remove existing shoulderToWristDstance div
  const existingShoulderToWristDistanceDiv = document.getElementById("shoulderToWristDistance");
  if (existingShoulderToWristDistanceDiv) {
    existingShoulderToWristDistanceDiv.remove();
  }
  newElement("div", document.body, {
    id: "shoulderToWristDistance",
    innerHTML: `shoulderToWristDistance: ${shoulderToWristDistance}`,
    style: { position: 'absolute', top: '100px', left: '0px' }
  });
  const elbowAngle: number = AngleBetween3Lengths(ForarmLength, UpperArmLength, shoulderToWristDistance);
  const shoulderAngle: number = AngleBetween3Lengths(shoulderToWristDistance, UpperArmLength, ForarmLength);

  const halfPi = Math.PI * 0.5;

  nodes.Shoulder.rotationQuaternion = Quaternion.Identity()
    .multiply(Quaternion.RotationAxis(Vector3.Forward(), Math.PI))
    .multiply(startingShoulderRotation)
    .multiply(Quaternion.RotationAxis(Vector3.Right(), halfPi - shoulderAngle))
    .multiply(Quaternion.RotationAxis(Vector3.Up(), -halfPi))
  nodes.Elbow.rotationQuaternion = Quaternion.RotationAxis(Vector3.Forward(), Math.PI + elbowAngle);

  // // Orient forearm to view wrist target within reasonable limits
  // nodes.Forearm.rotationQuaternion = Quaternion.FromLookDirectionLH(Vector3.Up(), Vector3.Forward().applyRotationQuaternion(Quaternion.Inverse(nodes.Elbow.absoluteRotationQuaternion).multiply(state.rotation))).multiply(Quaternion.RotationAxis(Vector3.Right(), halfPi));
  // // Rotate mid region half of what forearm got rotated
  // nodes.ForearmMid.rotationQuaternion = Quaternion.Slerp(Quaternion.Identity(), nodes.Forearm.rotationQuaternion, ForearmBlend);
  // // Rotate wrist to view wrist target - only allow a very small amount of Yaw
  // nodes.Hand.rotationQuaternion = Quaternion.FromLookDirectionLH(Vector3.Right(), Vector3.Up().applyRotationQuaternion(Quaternion.Inverse(nodes.Forearm.absoluteRotationQuaternion).multiply(state.rotation))).multiply(Quaternion.RotationAxis(Vector3.Up(), -90));

  // remove previous "debugLine" mesh
  ;
  lazyDebugLine(scene, "debugLine", [nodes.Hand.getAbsolutePosition(), state.position], new Color4(0, 1, 0, 1));
}
